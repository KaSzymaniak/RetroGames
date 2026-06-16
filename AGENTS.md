# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

RetroGames is a browser-based retro arcade (Polish UI). The repo has no root `package.json` or formal monorepo tooling—only:

- `frontend/` — lobby (`index.html`, ES modules)
- `backend/` — Express API (`server.js`)
- `gry/` — individual games (Saper, Catchstar)

See `README.md` for the high-level description.

### Services

| Service | Port | Start (from repo root) |
|---------|------|------------------------|
| Backend API | 3000 (override with `PORT`) | `cd backend && npm start` |
| Static frontend | 8080 (example) | `npx --yes serve . -p 8080` |

Both are required for full E2E: lobby status, Saper score submit. Catchstar works with static server only (localStorage).

**Important:** Open the lobby at `http://localhost:8080/frontend/index.html` or `http://127.0.0.1:8080/...`. `frontend/config.js` only points `API_URL` to `http://localhost:3000` when the page hostname is `localhost` or `127.0.0.1`; other hostnames use the production placeholder URL and backend calls will fail.

ES modules require HTTP—do not open HTML via `file://`.

### Lint / test / build

This repo has no ESLint, Prettier, test runner, or frontend build step. Verification is manual or API smoke tests:

```bash
curl -s http://localhost:3000/api/status
curl -s -X POST http://localhost:3000/api/zapisz-wynik \
  -H "Content-Type: application/json" \
  -d '{"gra":"saper","punkty":42,"gracz":"test"}'
```

### Long-running processes

Use **tmux** for dev servers (see Cloud Agent shell rules). Example session names: `retro-backend`, `retro-frontend`.

### API endpoints

- `GET /api/status` — lobby “System Status”
- `POST /api/zapisz-wynik` — body: `{ gra, punkty, gracz }` (logged to console; no DB yet)
