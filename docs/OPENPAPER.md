# Open Paper integration (FratNotes)

This app can talk to a running [Open Paper](https://github.com/khoj-ai/openpaper) FastAPI server for chat, search, knowledge-base features, and optional PDF sync. Open Paper is **not** an npm package; run their `server/` (and `jobs/` for full PDF pipelines) separately.

## Repository layout

- Upstream clone: `FratNotes/openpaper/` (sibling to `fratnotes/`) — reference for APIs and UI patterns.
- Infra: [`docker-compose.openpaper.yml`](../docker-compose.openpaper.yml) at the FratNotes repo root — Postgres, Redis, RabbitMQ for Open Paper.

## Open Paper environment (server)

From `openpaper/server/.env.example`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL (required) |
| `GEMINI_API_KEY` | Google Gemini (required for LLM features) |
| `CLIENT_DOMAIN` | Your FratNotes origin, e.g. `http://localhost:3000` (CORS) |
| `API_DOMAIN` | Open Paper API origin, e.g. `http://localhost:8000` |
| `POSTHOG_*` | Optional telemetry |

Full PDF + Celery pipeline also needs **S3**, **RabbitMQ**, **Redis**, and the `jobs/` worker — see `openpaper/jobs/README.md`.

## FratNotes environment

| Variable | Purpose |
|----------|---------|
| `OPENPAPER_ENABLED` | `true` to enable proxy + UI features |
| `OPENPAPER_API_URL` | Base URL of Open Paper API, e.g. `http://localhost:8000` |
| `NEXT_PUBLIC_OPENPAPER_ENABLED` | `true` to show Open Paper panels in the browser |
| `OPENPAPER_DEFAULT_BEARER_TOKEN` | Optional dev-only session token (see below) |

### Bearer token (auth bridge)

Open Paper accepts `Authorization: Bearer <session_token>` (see `server/app/auth/dependencies.py`). Obtain a session token by signing in to Open Paper’s own client (`openpaper/client`) against the same API, then copy the token from a successful `/api/auth/me` request or set it in env for a single shared test user.

Per-user tokens: store via **Settings → Open Paper** (uses `User.openPaperSessionToken` in Prisma). Server routes prefer the user token over `OPENPAPER_DEFAULT_BEARER_TOKEN`.

## Running locally (minimal)

1. Start dependencies: `docker compose -f docker-compose.openpaper.yml up -d`
2. Configure and run Open Paper `server` (Python/uv) per `openpaper/server/README.md`
3. Set FratNotes env vars above and run `npm run dev`

Without the full jobs stack + S3, **sync upload** to Open Paper may stay pending; FratNotes still works offline with local PDFs and Prisma storage.

**Highlights and drawings** stay in FratNotes (SQLite) as today. Bi-directional sync of highlights to Open Paper’s `/api/highlight` would be an additional step if you need a single source of truth there.

## License

Open Paper is **AGPL-3.0**. If you redistribute combined work, comply with AGPL terms.
