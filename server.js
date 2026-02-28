const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 8000);
const ROOT_DIR = path.resolve(__dirname);
const DATA_DIR = path.join(ROOT_DIR, "data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");
const TELEMETRY_FILE = path.join(DATA_DIR, "telemetry.ndjson");
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const SITE_URL = (process.env.SITE_URL || "").replace(/\/+$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const LEADERBOARD_LIMIT = 20;
const LEADERBOARD_MAX = 200;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_MOVES_FOR_RANK = 6;
const MIN_ELAPSED_MS_FOR_RANK = 45_000;
const MAX_HINTS_FOR_RANK = 30;
const ADMIN_DEFAULT_DAYS = 14;
const ADMIN_MAX_DAYS = 120;
const TELEMETRY_MAX_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TELEMETRY_EVENTS = new Set([
  "game_start",
  "game_finish",
  "setup_open",
  "setup_apply",
  "setup_cancel",
  "hint_request",
]);

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

// Rate limiting: Map<IP, Map<endpoint, {count, resetTime}>>
const rateLimitStore = new Map();
const RATE_LIMITS = {
  "/api/session/start": { max: 30, windowMs: 60000 },
  "/api/leaderboard/submit": { max: 10, windowMs: 60000 },
  "/api/telemetry/event": { max: 100, windowMs: 60000 },
  "/admin": { max: 20, windowMs: 60000 },
  "/api/admin/telemetry-summary": { max: 20, windowMs: 60000 },
  default: { max: 100, windowMs: 60000 },
};

const SCORE_PAR_TIME_MS = {
  easy: 6 * 60_000,
  medium: 8 * 60_000,
  hard: 10 * 60_000,
};

const SCORE_DIFFICULTY_MULT = {
  easy: 1,
  medium: 1.4,
  hard: 1.9,
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!process.env.SESSION_SECRET) {
  console.warn("[warn] SESSION_SECRET is not set. Using insecure development secret.");
}

function isDifficulty(value) {
  return value === "easy" || value === "medium" || value === "hard";
}

function isVariant(value) {
  return value === "classic" || value === "giveaway";
}

function isGameResult(value) {
  return value === "win" || value === "loss";
}

function clampScore(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computeLeaderboardScore(result, difficulty, elapsedMs, hintsUsed, wonOnTime) {
  const speedRatio = elapsedMs / SCORE_PAR_TIME_MS[difficulty];
  let base = 0;

  if (result === "win") {
    if (speedRatio <= 0.5) {
      base = 200;
    } else if (speedRatio <= 1.0) {
      base = 150;
    } else {
      base = 110;
    }
  } else if (speedRatio <= 0.5) {
    base = -130;
  } else if (speedRatio <= 1.0) {
    base = -90;
  } else {
    base = -60;
  }

  let score = Math.round(base * SCORE_DIFFICULTY_MULT[difficulty]);
  if (hintsUsed === 0) {
    score += 20;
  } else {
    score -= Math.min(8, hintsUsed) * 10;
  }
  if (wonOnTime && result === "win") {
    score += 10;
  }
  return clampScore(score, -300, 500);
}

function sanitizeName(input) {
  if (typeof input !== "string") {
    return null;
  }
  const normalized = input
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
  if (normalized.length < 2) {
    return null;
  }
  return normalized;
}

function normalizeNameKey(name) {
  return name.toLocaleLowerCase("en-US");
}

function sortLeaderboard(entries) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.elapsedMs !== b.elapsedMs) {
      return a.elapsedMs - b.elapsedMs;
    }
    return b.playedAt - a.playedAt;
  });
}

function isLeaderboardEntry(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  return typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.score === "number"
    && isGameResult(value.result)
    && isDifficulty(value.difficulty)
    && isVariant(value.variant)
    && typeof value.elapsedMs === "number"
    && typeof value.hintsUsed === "number"
    && typeof value.moveCount === "number"
    && typeof value.playedAt === "number";
}

function loadLeaderboard() {
  try {
    if (!fs.existsSync(LEADERBOARD_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(LEADERBOARD_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return sortLeaderboard(parsed.filter(isLeaderboardEntry)).slice(0, LEADERBOARD_MAX);
  } catch {
    return [];
  }
}

function saveLeaderboard(entries) {
  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2));
}

function makeSignature(sessionId, issuedAt) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(`${sessionId}.${issuedAt}`).digest("hex");
}

function pruneExpiredSessions(sessionStore) {
  const now = Date.now();
  for (const [id, session] of sessionStore.entries()) {
    if (now - session.issuedAt > SESSION_TTL_MS) {
      sessionStore.delete(id);
    }
  }
}

function checkRateLimit(ip, pathname) {
  const now = Date.now();
  const limit = RATE_LIMITS[pathname] || RATE_LIMITS.default;

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, new Map());
  }

  const ipLimits = rateLimitStore.get(ip);
  const endpointData = ipLimits.get(pathname) || { count: 0, resetTime: now + limit.windowMs };

  if (now > endpointData.resetTime) {
    endpointData.count = 0;
    endpointData.resetTime = now + limit.windowMs;
  }

  endpointData.count += 1;
  ipLimits.set(pathname, endpointData);

  return endpointData.count <= limit.max;
}

function pruneRateLimitStore() {
  const now = Date.now();
  for (const [ip, endpoints] of rateLimitStore.entries()) {
    for (const [pathname, data] of endpoints.entries()) {
      if (now > data.resetTime + 60000) {
        endpoints.delete(pathname);
      }
    }
    if (endpoints.size === 0) {
      rateLimitStore.delete(ip);
    }
  }
}

function readJsonBody(req, res) {
  return new Promise((resolve) => {
    let body = "";
    let destroyed = false;
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        destroyed = true;
        res.writeHead(413, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
        res.end("Payload Too Large");
        req.destroy();
      }
    });
    req.on("end", () => {
      if (destroyed) {
        return;
      }
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => {
      if (!destroyed) {
        resolve(null);
      }
    });
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...SECURITY_HEADERS,
  });
  res.end(body);
}

function sendText(res, status, contentType, payload) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(payload),
    ...SECURITY_HEADERS,
  });
  res.end(payload);
}

function requestBaseUrl(req) {
  if (SITE_URL) {
    return SITE_URL;
  }
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function rotateTelemetryIfNeeded() {
  if (!fs.existsSync(TELEMETRY_FILE)) {
    return;
  }
  const stats = fs.statSync(TELEMETRY_FILE);
  if (stats.size >= TELEMETRY_MAX_SIZE) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rotatedFile = TELEMETRY_FILE.replace(".ndjson", `.${timestamp}.ndjson`);
    fs.renameSync(TELEMETRY_FILE, rotatedFile);
    console.log(`[info] Rotated telemetry file to ${path.basename(rotatedFile)}`);
  }
}

function appendTelemetry(record) {
  rotateTelemetryIfNeeded();
  fs.appendFileSync(TELEMETRY_FILE, `${JSON.stringify(record)}\n`);
}

function getHeaderValue(req, name) {
  const raw = req.headers[name];
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string") {
    return raw[0];
  }
  return "";
}

function hasAdminAccess(req) {
  if (!ADMIN_TOKEN) {
    return true;
  }
  const headerToken = getHeaderValue(req, "x-admin-token");
  const authHeader = getHeaderValue(req, "authorization");
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  return headerToken === ADMIN_TOKEN || bearerToken === ADMIN_TOKEN;
}

function parseAdminDays(requestUrl) {
  const raw = Number(requestUrl.searchParams.get("days") || ADMIN_DEFAULT_DAYS);
  if (!Number.isFinite(raw)) {
    return ADMIN_DEFAULT_DAYS;
  }
  return Math.max(1, Math.min(ADMIN_MAX_DAYS, Math.round(raw)));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function localDayKeyFromTs(ts) {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toPercent(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return Math.round((numerator / denominator) * 1000) / 10;
}

function readTelemetryRecords() {
  if (!fs.existsSync(TELEMETRY_FILE)) {
    return {
      records: [],
      totalLines: 0,
      parsedLines: 0,
      invalidLines: 0,
    };
  }

  const raw = fs.readFileSync(TELEMETRY_FILE, "utf8");
  const lines = raw.split(/\r?\n/);
  const records = [];
  let invalidLines = 0;
  let parsedLines = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }
    try {
      const parsed = JSON.parse(line);
      if (!parsed || typeof parsed !== "object" || typeof parsed.event !== "string") {
        invalidLines += 1;
        continue;
      }
      records.push(parsed);
      parsedLines += 1;
    } catch {
      invalidLines += 1;
    }
  }

  return {
    records,
    totalLines: parsedLines + invalidLines,
    parsedLines,
    invalidLines,
  };
}

function buildTelemetrySummary(days) {
  const { records, totalLines, parsedLines, invalidLines } = readTelemetryRecords();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const dayOrder = [];
  const dayMap = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const key = localDayKeyFromTs(d.getTime());
    dayOrder.push(key);
    dayMap.set(key, {
      date: key,
      gameStarts: 0,
      setupStarts: 0,
      gamesFinished: 0,
      wins: 0,
      losses: 0,
      hints: 0,
      setupOpen: 0,
      setupApply: 0,
      winRate: 0,
      setupUsageRate: 0,
    });
  }

  const totals = {
    gameStarts: 0,
    setupStarts: 0,
    gamesFinished: 0,
    wins: 0,
    losses: 0,
    hints: 0,
    setupOpen: 0,
    setupApply: 0,
    winRate: 0,
    setupUsageRate: 0,
  };

  let recordsInRange = 0;
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    const event = record.event;
    if (!ALLOWED_TELEMETRY_EVENTS.has(event)) {
      continue;
    }
    const tsRaw = Number(record.ts);
    const ts = Number.isFinite(tsRaw) ? tsRaw : Number(record.receivedAt);
    if (!Number.isFinite(ts)) {
      continue;
    }
    const dayKey = localDayKeyFromTs(ts);
    const day = dayMap.get(dayKey);
    if (!day) {
      continue;
    }

    recordsInRange += 1;
    const payload = (record.payload && typeof record.payload === "object") ? record.payload : {};
    switch (event) {
      case "game_start":
        day.gameStarts += 1;
        totals.gameStarts += 1;
        if (payload.startedFromSetup === true) {
          day.setupStarts += 1;
          totals.setupStarts += 1;
        }
        break;
      case "game_finish":
        day.gamesFinished += 1;
        totals.gamesFinished += 1;
        if (payload.result === "win") {
          day.wins += 1;
          totals.wins += 1;
        } else if (payload.result === "loss") {
          day.losses += 1;
          totals.losses += 1;
        }
        break;
      case "setup_open":
        day.setupOpen += 1;
        totals.setupOpen += 1;
        break;
      case "setup_apply":
        day.setupApply += 1;
        totals.setupApply += 1;
        break;
      case "hint_request":
        day.hints += 1;
        totals.hints += 1;
        break;
      default:
        break;
    }
  }

  const daily = dayOrder.map((key) => {
    const day = dayMap.get(key);
    day.winRate = toPercent(day.wins, day.gamesFinished);
    day.setupUsageRate = toPercent(day.setupStarts, day.gameStarts);
    return day;
  });

  totals.winRate = toPercent(totals.wins, totals.gamesFinished);
  totals.setupUsageRate = toPercent(totals.setupStarts, totals.gameStarts);

  return {
    generatedAt: Date.now(),
    days,
    totals,
    daily,
    stats: {
      sourceFile: path.relative(ROOT_DIR, TELEMETRY_FILE),
      totalLines,
      parsedLines,
      invalidLines,
      recordsInRange,
    },
  };
}

function renderAdminDashboard(summary) {
  const dailyRows = summary.daily.length > 0
    ? summary.daily.map((day) => (
      `<tr>`
      + `<td>${escapeHtml(day.date)}</td>`
      + `<td>${day.gamesFinished}</td>`
      + `<td>${day.wins}</td>`
      + `<td>${day.losses}</td>`
      + `<td>${day.winRate}%</td>`
      + `<td>${day.gameStarts}</td>`
      + `<td>${day.setupStarts}</td>`
      + `<td>${day.setupUsageRate}%</td>`
      + `</tr>`
    )).join("")
    : `<tr><td colspan="8">No telemetry in selected range.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Checkers Studio Admin</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      line-height: 1.4;
    }
    main {
      max-width: 1080px;
      margin: 0 auto;
      padding: 20px 16px 28px;
    }
    h1 { margin: 0 0 8px; font-size: 1.55rem; }
    p { margin: 0 0 12px; color: #334155; }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 14px;
    }
    .grid {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
    .metric {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px;
      background: #ffffff;
    }
    .metric strong { display: block; font-size: 1.15rem; margin-top: 4px; }
    label { font-weight: 600; font-size: 0.95rem; }
    input, button {
      font: inherit;
      margin-top: 4px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 10px;
    }
    button { cursor: pointer; background: #0f172a; color: #ffffff; border-color: #0f172a; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    th, td {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 0.92rem;
    }
    th { background: #f8fafc; }
    tr:last-child td { border-bottom: none; }
    .muted { color: #64748b; font-size: 0.86rem; }
  </style>
</head>
<body>
  <main>
    <h1>Checkers Studio Admin</h1>
    <p>Telemetry summary from <code>${escapeHtml(summary.stats.sourceFile)}</code>. Last update: ${escapeHtml(new Date(summary.generatedAt).toISOString())}</p>
    <section class="card">
      <form method="GET" action="/admin">
        <label for="days">Period (days, max ${ADMIN_MAX_DAYS})</label><br>
        <input id="days" name="days" type="number" min="1" max="${ADMIN_MAX_DAYS}" value="${summary.days}">
        <button type="submit">Refresh</button>
      </form>
      <p class="muted">Win rate = wins / finished games. Setup usage = setup-started games / all game starts.</p>
      <p class="muted">Note: Use x-admin-token header or Authorization: Bearer header to access this page when ADMIN_TOKEN is set.</p>
    </section>
    <section class="card grid">
      <div class="metric">Finished games<strong>${summary.totals.gamesFinished}</strong></div>
      <div class="metric">Win rate<strong>${summary.totals.winRate}%</strong></div>
      <div class="metric">Game starts<strong>${summary.totals.gameStarts}</strong></div>
      <div class="metric">Setup usage<strong>${summary.totals.setupUsageRate}%</strong></div>
      <div class="metric">Setup opens<strong>${summary.totals.setupOpen}</strong></div>
      <div class="metric">Setup applies<strong>${summary.totals.setupApply}</strong></div>
      <div class="metric">Hint requests<strong>${summary.totals.hints}</strong></div>
      <div class="metric">Telemetry rows parsed<strong>${summary.stats.parsedLines}</strong></div>
    </section>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Finished</th>
          <th>Wins</th>
          <th>Losses</th>
          <th>Win rate</th>
          <th>Starts</th>
          <th>Setup starts</th>
          <th>Setup usage</th>
        </tr>
      </thead>
      <tbody>${dailyRows}</tbody>
    </table>
    <p class="muted">Lines: ${summary.stats.totalLines}, invalid: ${summary.stats.invalidLines}, in range: ${summary.stats.recordsInRange}.</p>
  </main>
</body>
</html>`;
}

let leaderboard = loadLeaderboard();
const sessions = new Map();

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

  // HTTPS redirect in production
  if (SITE_URL && SITE_URL.startsWith("https://") && req.headers["x-forwarded-proto"] !== "https") {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
    return res.end();
  }

  // Rate limiting check for specific endpoints
  const rateLimitedPaths = ["/api/session/start", "/api/leaderboard/submit", "/api/telemetry/event", "/admin", "/api/admin/telemetry-summary"];
  if (rateLimitedPaths.includes(pathname) && !checkRateLimit(clientIp, pathname)) {
    return sendJson(res, 429, { ok: false, error: "too_many_requests" });
  }

  if (pathname === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/api/admin/telemetry-summary" && req.method === "GET") {
    if (!hasAdminAccess(req)) {
      return sendJson(res, 401, { ok: false, error: "unauthorized" });
    }
    const days = parseAdminDays(requestUrl);
    const summary = buildTelemetrySummary(days);
    return sendJson(res, 200, summary);
  }

  if (pathname === "/admin" && req.method === "GET") {
    if (!hasAdminAccess(req)) {
      return sendText(res, 401, "text/plain; charset=utf-8", "Unauthorized. Provide x-admin-token header or Authorization: Bearer <token>.");
    }
    const days = parseAdminDays(requestUrl);
    const summary = buildTelemetrySummary(days);
    const html = renderAdminDashboard(summary);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Length": Buffer.byteLength(html),
      ...SECURITY_HEADERS,
    });
    res.end(html);
    return;
  }

  if (pathname === "/api/leaderboard" && req.method === "GET") {
    const limitRaw = Number(requestUrl.searchParams.get("limit") || LEADERBOARD_LIMIT);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : LEADERBOARD_LIMIT;
    return sendJson(res, 200, { entries: leaderboard.slice(0, limit) });
  }

  if (pathname === "/api/session/start" && req.method === "POST") {
    const body = await readJsonBody(req, res);
    if (!body || typeof body !== "object") {
      return sendJson(res, 400, { error: "invalid_json" });
    }

    const mode = body.mode === "ai" ? "ai" : body.mode === "pvp" ? "pvp" : null;
    const difficulty = isDifficulty(body.difficulty) ? body.difficulty : null;
    const variant = isVariant(body.variant) ? body.variant : null;
    const startedFromSetup = Boolean(body.startedFromSetup);
    if (!mode || !difficulty || !variant) {
      return sendJson(res, 400, { error: "invalid_session_params" });
    }

    pruneExpiredSessions(sessions);
    const sessionId = crypto.randomUUID();
    const issuedAt = Date.now();
    const signature = makeSignature(sessionId, issuedAt);
    sessions.set(sessionId, {
      sessionId,
      issuedAt,
      mode,
      difficulty,
      variant,
      startedFromSetup,
      finalized: false,
    });
    return sendJson(res, 200, { sessionId, issuedAt, signature });
  }

  if (pathname === "/api/leaderboard/submit" && req.method === "POST") {
    const body = await readJsonBody(req, res);
    if (!body || typeof body !== "object") {
      return sendJson(res, 400, { accepted: false, reason: "invalid_json" });
    }

    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const issuedAt = Number(body.issuedAt);
    const signature = typeof body.signature === "string" ? body.signature : "";
    const name = sanitizeName(body.name);
    const result = isGameResult(body.result) ? body.result : null;
    const difficulty = isDifficulty(body.difficulty) ? body.difficulty : null;
    const variant = isVariant(body.variant) ? body.variant : null;
    const elapsedMs = Number(body.elapsedMs);
    const hintsUsed = Number(body.hintsUsed);
    const moveCount = Number(body.moveCount);
    const setupUsed = Boolean(body.setupUsed);
    const timedOut = Boolean(body.timedOut);

    const session = sessions.get(sessionId);
    if (!session) {
      return sendJson(res, 400, { accepted: false, reason: "invalid_session", leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT) });
    }
    if (session.finalized) {
      return sendJson(res, 409, { accepted: false, reason: "session_already_finalized", leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT) });
    }
    if (session.issuedAt !== issuedAt || makeSignature(sessionId, issuedAt) !== signature) {
      session.finalized = true;
      return sendJson(res, 400, { accepted: false, reason: "invalid_signature", leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT) });
    }
    if (!name || !result || !difficulty || !variant) {
      session.finalized = true;
      return sendJson(res, 400, { accepted: false, reason: "invalid_payload", leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT) });
    }
    if (session.mode !== "ai") {
      session.finalized = true;
      return sendJson(res, 400, { accepted: false, reason: "guard_not_ai", leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT) });
    }
    if (session.difficulty !== difficulty || session.variant !== variant) {
      session.finalized = true;
      return sendJson(res, 400, { accepted: false, reason: "guard_session_mismatch", leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT) });
    }
    if (Date.now() - session.issuedAt > SESSION_TTL_MS) {
      session.finalized = true;
      return sendJson(res, 400, { accepted: false, reason: "guard_session_expired", leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT) });
    }

    if (setupUsed || session.startedFromSetup) {
      session.finalized = true;
      return sendJson(res, 200, { accepted: false, reason: "rejected_setup", leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT) });
    }

    if (!Number.isFinite(elapsedMs) || elapsedMs < MIN_ELAPSED_MS_FOR_RANK) {
      session.finalized = true;
      return sendJson(res, 200, { accepted: false, reason: "guard_too_fast", leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT) });
    }
    if (!Number.isFinite(moveCount) || moveCount < MIN_MOVES_FOR_RANK) {
      session.finalized = true;
      return sendJson(res, 200, { accepted: false, reason: "guard_too_few_moves", leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT) });
    }
    if (!Number.isFinite(hintsUsed) || hintsUsed < 0 || hintsUsed > MAX_HINTS_FOR_RANK) {
      session.finalized = true;
      return sendJson(res, 200, { accepted: false, reason: "guard_hint_limit", leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT) });
    }

    const score = computeLeaderboardScore(result, difficulty, elapsedMs, hintsUsed, timedOut);
    const isQualified = leaderboard.length < LEADERBOARD_LIMIT || score > leaderboard[LEADERBOARD_LIMIT - 1].score;
    if (!isQualified) {
      session.finalized = true;
      return sendJson(res, 200, { accepted: false, reason: "not_qualified", leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT) });
    }

    const playedAt = Date.now();
    const newEntry = {
      id: `${playedAt}-${Math.floor(Math.random() * 1_000_000)}`,
      name,
      score,
      result,
      difficulty,
      variant,
      elapsedMs: Math.round(elapsedMs),
      hintsUsed: Math.round(hintsUsed),
      moveCount: Math.round(moveCount),
      playedAt,
    };

    const key = normalizeNameKey(name);
    const existingIndex = leaderboard.findIndex((entry) => normalizeNameKey(entry.name) === key);
    if (existingIndex >= 0 && leaderboard[existingIndex].score >= newEntry.score) {
      session.finalized = true;
      return sendJson(res, 200, {
        accepted: false,
        reason: "not_better_than_personal_best",
        leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT),
      });
    }

    if (existingIndex >= 0) {
      leaderboard.splice(existingIndex, 1);
    }
    leaderboard = sortLeaderboard([...leaderboard, newEntry]).slice(0, LEADERBOARD_MAX);
    saveLeaderboard(leaderboard);
    session.finalized = true;
    return sendJson(res, 200, {
      accepted: true,
      entry: newEntry,
      leaderboard: leaderboard.slice(0, LEADERBOARD_LIMIT),
    });
  }

  if (pathname === "/api/telemetry/event" && req.method === "POST") {
    const body = await readJsonBody(req, res);
    if (!body || typeof body !== "object") {
      return sendJson(res, 400, { ok: false, error: "invalid_json" });
    }
    const event = typeof body.event === "string" ? body.event : "";
    if (!ALLOWED_TELEMETRY_EVENTS.has(event)) {
      return sendJson(res, 400, { ok: false, error: "invalid_event" });
    }
    const record = {
      receivedAt: Date.now(),
      event,
      ts: Number(body.ts) || Date.now(),
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      payload: typeof body.payload === "object" && body.payload !== null ? body.payload : {},
      ip: req.socket.remoteAddress || "",
      ua: req.headers["user-agent"] || "",
    };
    appendTelemetry(record);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/sitemap.xml" && req.method === "GET") {
    const base = requestBaseUrl(req);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
      + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
      + `  <url><loc>${base}/</loc></url>\n`
      + `</urlset>\n`;
    return sendText(res, 200, "application/xml; charset=utf-8", xml);
  }

  if (pathname === "/robots.txt" && req.method === "GET") {
    const base = requestBaseUrl(req);
    const robots = `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`;
    return sendText(res, 200, "text/plain; charset=utf-8", robots);
  }

  if (!["GET", "HEAD"].includes(req.method || "")) {
    return sendText(res, 405, "text/plain; charset=utf-8", "Method Not Allowed");
  }

  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(ROOT_DIR, `.${cleanPath}`);
  if (!filePath.startsWith(ROOT_DIR)) {
    return sendText(res, 403, "text/plain; charset=utf-8", "Forbidden");
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return sendText(res, 404, "text/plain; charset=utf-8", "Not Found");
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": data.length,
    ...SECURITY_HEADERS,
  });
  res.end(data);
});

// Periodic cleanup of rate limit store and expired sessions
setInterval(() => {
  pruneRateLimitStore();
  pruneExpiredSessions(sessions);
}, 60000); // Every minute

server.listen(PORT, () => {
  console.log(`Checkers Studio server listening on http://localhost:${PORT}`);
});
