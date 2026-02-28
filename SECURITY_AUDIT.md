# Security Audit Report - Checkers Studio

**Date**: 2026-02-27
**Severity Levels**: CRITICAL | HIGH | MEDIUM | LOW

## Executive Summary

This audit identified 8 security issues and 3 bugs. Most critical issues relate to missing security headers, lack of rate limiting, and potential DoS vulnerabilities.

---

## Security Vulnerabilities

### 1. Missing Security Headers [MEDIUM]
**Location**: `server.js` - All HTTP responses
**Issue**: No security headers are set (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
**Risk**: Clickjacking, MIME-sniffing attacks, XSS via injected scripts
**Recommendation**: Add security headers to all responses:
```javascript
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
};
```

### 2. No Rate Limiting [HIGH]
**Location**: `server.js` - All API endpoints
**Issue**: No rate limiting on any endpoints
**Risk**:
- DoS attacks via request flooding
- Leaderboard spam/manipulation
- Telemetry flooding
- Brute force of admin token
**Recommendation**: Implement rate limiting per IP:
- General endpoints: 100 req/min
- `/api/leaderboard/submit`: 10 req/min
- `/api/session/start`: 30 req/min
- `/admin` and `/api/admin/*`: 20 req/min

### 3. Request Body Size DoS [MEDIUM]
**Location**: `server.js:202-204`
**Issue**: When body exceeds 1MB, connection is destroyed without response
```javascript
req.on("data", (chunk) => {
  body += chunk;
  if (body.length > 1_000_000) {
    req.destroy(); // No response sent
  }
});
```
**Risk**: Client receives confusing error, poor UX
**Recommendation**: Send proper 413 Payload Too Large response before destroying

### 4. Admin Token in Query Parameters [MEDIUM]
**Location**: `server.js:255-259`
**Issue**: Admin token can be passed via query parameter `?token=...`
**Risk**:
- Token logged in server access logs
- Token visible in browser history
- Token leaked via Referer header
**Recommendation**: Remove query parameter auth, use only headers

### 5. No HTTPS Enforcement [MEDIUM]
**Location**: `server.js` - Server setup
**Issue**: No redirect from HTTP to HTTPS in production
**Risk**: Session tokens and admin tokens transmitted in plain text
**Recommendation**: Add HTTPS redirect for production:
```javascript
if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
  res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
  return res.end();
}
```

### 6. Path Traversal Protection Could Be Bypassed [LOW]
**Location**: `server.js:814`
**Issue**: Protection relies on `path.resolve()` but no check for symlinks
```javascript
if (!filePath.startsWith(ROOT_DIR)) {
  return sendText(res, 403, "text/plain; charset=utf-8", "Forbidden");
}
```
**Risk**: If attacker creates symlinks in ROOT_DIR, could potentially read files outside
**Recommendation**: Add `fs.realpathSync()` check:
```javascript
const realPath = fs.realpathSync(filePath);
if (!realPath.startsWith(ROOT_DIR)) {
  return sendText(res, 403, "text/plain; charset=utf-8", "Forbidden");
}
```

### 7. No CORS Configuration [LOW]
**Location**: `server.js` - API endpoints
**Issue**: No CORS headers set, relying on same-origin by default
**Risk**: If frontend is ever served from different domain, needs CORS
**Status**: Currently safe (same-origin), but document for future

### 8. Session Replay Attack Possible [LOW]
**Location**: `server.js:631-658` - Session creation
**Issue**: Sessions don't have nonce/counter to prevent replay
**Risk**: If attacker captures session token, could replay old sessions within TTL
**Current Mitigation**: Session can only be finalized once (`session.finalized` flag)
**Status**: Low risk due to one-time finalization, but could add timestamp validation

---

## Bugs Identified

### Bug 1: Leaderboard Score Comparison [MEDIUM]
**Location**: `server.js:727`
**Issue**: Score comparison uses wrong index when board is not full
```javascript
const isQualified = leaderboard.length < LEADERBOARD_LIMIT
  || score > leaderboard[Math.min(leaderboard.length, LEADERBOARD_LIMIT) - 1].score;
```
Should be:
```javascript
const isQualified = leaderboard.length < LEADERBOARD_LIMIT
  || score > leaderboard[LEADERBOARD_LIMIT - 1].score;
```
**Impact**: When leaderboard has fewer entries than limit, wrong entry is compared

### Bug 2: No Content-Length Header [LOW]
**Location**: `server.js:217-219, 222-224`
**Issue**: Responses don't include Content-Length header
**Impact**: Client cannot show download progress, HTTP/1.1 may use chunked encoding
**Recommendation**: Add Content-Length for better performance:
```javascript
const payload = JSON.stringify(data);
res.writeHead(status, {
  'Content-Type': 'application/json; charset=utf-8',
  'Content-Length': Buffer.byteLength(payload)
});
res.end(payload);
```

### Bug 3: Telemetry File Could Grow Unbounded [MEDIUM]
**Location**: `server.js:236-238` - appendTelemetry
**Issue**: Telemetry file grows forever with no rotation
**Impact**: Disk space exhaustion over time
**Recommendation**: Implement log rotation:
- Rotate when file exceeds size (e.g., 10MB)
- Or rotate daily
- Keep last N rotated files

---

## Good Security Practices Found

✓ HMAC session signatures prevent tampering
✓ Input sanitization for player names (NFKC normalization, whitelist)
✓ Server-side score calculation (client score ignored)
✓ Anti-cheat guards (move count, time limits, hint limits)
✓ One finalization per session
✓ Path traversal protection for static files
✓ Session expiration (6 hour TTL)
✓ JSON body size limit
✓ Proper Unicode handling (NFKC normalization)

---

## Recommendations Priority

**Immediate (Before Production)**:
1. Add security headers
2. Implement rate limiting
3. Remove query param admin auth
4. Add HTTPS redirect
5. Fix body size DoS response

**Short Term**:
1. Fix leaderboard score comparison bug
2. Add log rotation for telemetry
3. Add Content-Length headers

**Long Term**:
1. Consider adding CSRF tokens for state-changing operations
2. Add session nonce for replay protection
3. Implement IP-based anomaly detection
4. Add structured logging
