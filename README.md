# Checkers Studio (TypeScript)

Web application for playing checkers:
- human vs computer;
- 3 AI difficulty levels;
- custom position editor to start from any setup and simulate scenarios from any move.

## Quick Start

For the global leaderboard and telemetry, run the built-in backend:

```bash
npm install
npm run build
npm run serve
```

Then open:

```text
http://localhost:8000
```

## TypeScript Development

Source code is located in `src/app.ts`.

```bash
npm install
npm run build
```

After build, `tsc` updates `dist/app.js`.
For local static testing without backend, you can use `npm run serve:static`.

## Implemented Features

- mandatory captures;
- multi-capture continuation with the same piece;
- king promotion;
- game modes: `human vs computer` and `human vs human`;
- rules variants: `classic` and `giveaway`;
- bottom-side color switch (white/black);
- stronger AI with `easy / medium / hard` levels;
- hint mode (piece and target highlight + arrow);
- global leaderboard for `vs computer` games via backend API;
- scoring: result + speed + difficulty, with hint penalty;
- game timer for both white and black;
- board coordinates labeling;
- position editor:
  - piece placement (including kings),
  - side to move selection,
  - start from the edited position.

## Deployment Checklist

- `npm run build` passes without errors.
- `npm start` runs backend in production.
- Basic SEO meta tags are present in head (description, og, twitter, canonical, JSON-LD).
- For production backend, set environment variables:
  - `SITE_URL=https://your-real-domain.com`
  - `SESSION_SECRET=<long-random-secret>`
  - `ADMIN_TOKEN=<optional-admin-access-token>` (recommended to protect `/admin`)
- Sitemap and robots are served by backend:
  - `https://your-real-domain.com/sitemap.xml`
  - `https://your-real-domain.com/robots.txt`

## Search Console

1. Add your domain property in Google Search Console.
2. Complete domain verification.
3. In the `Sitemaps` section, submit `https://your-real-domain.com/sitemap.xml`.
4. Submit the home page URL for recrawl via URL Inspection.

## Backend Anti-Cheat and Ranking

- Global leaderboard is stored on server (`data/leaderboard.json`), not in browser.
- Server session signature (`HMAC`) + server-side score calculation.
- Guards:
  - games started from position editor are not ranked;
  - minimum thresholds for game duration and move count;
  - hint usage limit;
  - one finalization per session;
  - only best score per player name is kept.

## Telemetry

Server writes telemetry events to `data/telemetry.ndjson`:
- `game_start`
- `game_finish`
- `setup_open`
- `setup_apply`
- `setup_cancel`
- `hint_request`

## Admin Dashboard (Telemetry)

- HTML dashboard: `GET /admin`
- JSON summary: `GET /api/admin/telemetry-summary?days=14`
- Metrics: daily games, win rate, setup usage, setup/hint activity.
- Period is controlled by `days` query parameter (1..120).
- If `ADMIN_TOKEN` is set, access to `/admin` and `/api/admin/telemetry-summary` requires:
  - `?token=<ADMIN_TOKEN>` or
  - header `x-admin-token: <ADMIN_TOKEN>` or
  - `Authorization: Bearer <ADMIN_TOKEN>`.

## GitHub Publish

1. Create a repository on GitHub.
2. Add remote:
   - `git remote add origin git@github.com:<username>/<repo>.git`
   - or `git remote add origin https://github.com/<username>/<repo>.git`
3. Push branch:
   - `git push -u origin main`

For deployment, set environment variables from `.env.example`.
