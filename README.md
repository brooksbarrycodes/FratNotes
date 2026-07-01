# FratNotes app

See the [root README](../README.md) for what FratNotes is, how it works, and what's still in progress.

This directory is the main Next.js application.

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

The dev server runs at [http://localhost:3001](http://localhost:3001).

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | SQLite path, e.g. `file:./db.sqlite` |
| `OPENAI_API_KEY` | For OpenAI | API key for study pass + chat (recommended) |
| `OPENAI_MODEL` | No | Model id, default `gpt-4o-mini` |
| `OPENAI_BASE_URL` | No | OpenRouter or other OpenAI-compatible endpoint |
| `AI_PROVIDER` | No | Set to `ollama` to use local Ollama instead of OpenAI |
| `OLLAMA_MODEL` | For Ollama | e.g. `llama3.1:8b` |
| `OLLAMA_BASE_URL` | No | Defaults to `http://127.0.0.1:11434` in dev |
| `AUTH_SECRET` | Production | NextAuth secret (`npx auth secret`) |
| `AUTH_GOOGLE_ID` | Optional | Google OAuth client id |
| `AUTH_GOOGLE_SECRET` | Optional | Google OAuth client secret |
| `OPENPAPER_ENABLED` | Optional | `true` to enable Open Paper proxy |
| `OPENPAPER_API_URL` | Optional | Open Paper API base URL |
| `NEXT_PUBLIC_OPENPAPER_ENABLED` | Optional | `true` to show Open Paper UI panels |

Copy [`.env.example`](.env.example) as a starting point. The full validated schema is in [`src/env.js`](src/env.js).

### AI providers

- **OpenAI** — set `OPENAI_API_KEY`. Most reliable for the JSON study-pass output.
- **Ollama** — set `AI_PROVIDER=ollama`, run `ollama pull llama3.1:8b`, and leave `OPENAI_API_KEY` unset.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port **3001** |
| `npm run dev:clean` | Clear Next.js cache, then start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:push` | Push Prisma schema to SQLite |
| `npm run db:studio` | Open Prisma Studio |
| `npm run typecheck` | Run TypeScript check |

## Project structure (high level)

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js App Router pages and API routes |
| `src/app/api/upload/` | PDF upload and text extraction |
| `src/app/api/ai/` | Study pass and chat endpoints |
| `src/app/notes/[id]/` | Split PDF + chat workspace |
| `src/components/` | UI components (viewer, chatbot, navbar) |
| `src/lib/` | AI prompts, annotation schema, PDF helpers |
| `src/server/` | tRPC routers, auth, Open Paper proxy |
| `prisma/` | Database schema (SQLite) |
| `docs/OPENPAPER.md` | Optional Open Paper backend integration |

## Optional: Open Paper backend

For library-wide search, "Ask library" chat, and paper briefs, see [`docs/OPENPAPER.md`](docs/OPENPAPER.md). FratNotes runs fine without it.
