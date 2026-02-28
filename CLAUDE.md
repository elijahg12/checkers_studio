# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Build TypeScript:
```bash
npm run build
```

Build in watch mode (auto-rebuild on changes):
```bash
npm run build:watch
```

Start production server with backend (port 8000):
```bash
npm run serve
# or
npm start
```

Static file server (for testing without backend):
```bash
npm run serve:static
```

## Architecture Overview

### Client-Server Architecture

This is a checkers/draughts game with a TypeScript frontend (`src/app.ts`) and Node.js backend (`server.js`). The architecture separates game logic (client-side) from leaderboard persistence and anti-cheat (server-side).

**Frontend (src/app.ts)**:
- All game logic runs client-side in a single TypeScript file compiled to `dist/app.js`
- Game engine with AI using minimax with alpha-beta pruning
- Position editor for staging custom board setups
- UI controls for game modes (human vs AI, human vs human), variants (classic, giveaway), difficulty levels

**Backend (server.js)**:
- Simple Node.js HTTP server (no framework dependencies)
- Serves static files (`index.html`, `dist/app.js`, `styles.css`, etc.)
- RESTful API for leaderboard, session management, and telemetry
- Data persisted to JSON files in `data/` directory

### Anti-Cheat System

The backend implements a session-based anti-cheat system for leaderboard submissions:

1. **Session Creation**: Client requests session via `POST /api/session/start` with game parameters (mode, difficulty, variant)
2. **Server Issues Token**: Server creates session with UUID + timestamp, signs it with HMAC-SHA256 using `SESSION_SECRET`
3. **Server-Side Validation**: When game ends, client submits results to `POST /api/leaderboard/submit` with session token
4. **Score Calculation**: Server recalculates score server-side (client score is ignored) based on:
   - Game result (win/loss)
   - Difficulty multiplier (easy: 1x, medium: 1.4x, hard: 1.9x)
   - Speed ratio vs par time (faster = higher score)
   - Hint penalty (10 points per hint, max 8 counted)
   - Time win bonus (+10 if won on time)

**Anti-Cheat Guards** (`server.js:708-724`):
- Games started from position editor are not ranked
- Minimum 6 moves required
- Minimum 45 seconds elapsed time
- Max 30 hints allowed
- One submission per session
- Only best score per player name kept (case-insensitive comparison)

### Telemetry System

Events are logged to `data/telemetry.ndjson` (newline-delimited JSON):
- `game_start`: when game begins (tracks if started from position editor)
- `game_finish`: when game ends (tracks win/loss)
- `setup_open`: position editor opened
- `setup_apply`: custom position applied
- `setup_cancel`: position editor cancelled
- `hint_request`: hint requested

**Admin Dashboard** (`GET /admin`): Shows telemetry metrics with configurable date range (default 14 days, max 120). Protected by `ADMIN_TOKEN` environment variable if set.

### Game Engine

Key game logic components in `src/app.ts`:

- **Board representation**: 8x8 2D array, pieces track color and king status
- **AI search**: Minimax with alpha-beta pruning, transposition table, iterative deepening
- **Difficulty tuning**: Controls max search depth, time limits, randomness, and evaluation noise
- **Move generation**: Handles mandatory captures, multi-jump sequences, king promotion
- **Game variants**: Classic (capture to win) and Giveaway (lose all pieces to win)
- **Position editor**: Place/remove pieces, set side to move, start game from custom positions

## Environment Variables

For production deployment:

- `PORT`: Server port (default: 8000)
- `SESSION_SECRET`: HMAC secret for session signatures (REQUIRED in production, insecure default in dev)
- `SITE_URL`: Production domain for SEO meta tags and sitemap (e.g., `https://example.com`)
- `ADMIN_TOKEN`: Optional token to protect `/admin` dashboard and `/api/admin/telemetry-summary`

## API Endpoints

**Leaderboard**:
- `GET /api/leaderboard?limit=20`: Fetch top entries
- `POST /api/session/start`: Create game session
- `POST /api/leaderboard/submit`: Submit score (requires valid session)

**Telemetry**:
- `POST /api/telemetry/event`: Log client event
- `GET /api/admin/telemetry-summary?days=14`: Admin metrics (protected by ADMIN_TOKEN)
- `GET /admin`: HTML dashboard (protected by ADMIN_TOKEN)

**System**:
- `GET /api/health`: Health check
- `GET /sitemap.xml`: SEO sitemap
- `GET /robots.txt`: Robots file

## Key Files

- `src/app.ts`: Entire game engine and UI logic (single file)
- `server.js`: Backend API and static file server
- `index.html`: Main HTML structure with UI elements
- `styles.css`: Application styles
- `tsconfig.json`: TypeScript compiler configuration
- `data/leaderboard.json`: Persistent leaderboard (auto-created)
- `data/telemetry.ndjson`: Event log (auto-created)

## TypeScript Build

TypeScript config (`tsconfig.json`):
- Target: ES2020
- Module: ES2020
- Source: `src/` → Output: `dist/`
- Strict mode disabled (legacy codebase)

After `npm run build`, the compiled `dist/app.js` is served by the backend.
