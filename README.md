# fountain-conversations

A standalone client for [Fountain](https://github.com/BinaryBourbon/fountain):
conversations (list, start, watch an agent work turn by turn, drive it) and
the agents, environments and vaults they run on — the user-facing pages as a
static app on its own origin, talking only to the Fountain API with an API key
you paste in once.

- **Conversations** — every conversation, live status and unread dots over one
  SSE connection, sort by activity or creation, roots-only, delete.
- **New** — agent, environment (the agent's own by default, narrowed by its
  allowlist), vault, first prompt, images; ⌘/Ctrl+Enter to start.
- **Conversation** — *Chat* mode (bubbles, tool cards, thinking) and *Timeline*
  mode (every lifecycle stage — provision, setup, turn, reattach, sandbox,
  terminate — with durations, the turn's prompt and output nested under it,
  per-stream toggles for `acp` / `stdout` / `stderr` / `stage`); follow-up
  prompts with images; interrupt, terminate, delete; the spawn tree with
  sub-conversation navigation; a link to the raw log.
- **Logs** — the raw event rows as stored, tailing live, filterable by stream
  and text.
- **Agents** — list, search, filter by runtime; create/edit with runtime, model
  (suggestions from `GET /api/catalog`), system prompt, environment, sandbox
  provider, skills (GitHub via skills.sh or inline SKILL.md), MCP servers,
  launch-time allowlists for environments and vaults, avatar upload or
  generation (`POST /api/avatars/generate`).
- **Environments** — list; create/edit with packages, env vars, repositories,
  setup script, network policy; secrets set/deleted (write-only, encrypted at
  rest).
- **Vaults** — list; create/edit with secrets.

Nothing here parses a runtime's output. Fountain serves every event with
**server-parsed blocks** (`?blocks=true` — text, thinking, tool_use,
tool_result, init, result, error, raw), the same parse its own web UI
renders, so this client only arranges them (`src/lib/blocks.ts`).

## Run it

```bash
bun install
bun run dev        # http://localhost:5173
```

On first load it asks for your Fountain URL and an API key (*Account → API
keys* in Fountain). Both stay in this browser's `localStorage`; view
preferences (chat/timeline, stream toggles, sort) do too.

The Fountain server must allow the browser origin — set on the server:

```
API_CORS_ORIGINS=http://localhost:5173        # dev
API_CORS_ORIGINS=https://jakegaylor.com       # wherever you host the build
```

Off by default; it admits only a presented bearer key, never a cookie.

## Build and host

```bash
bun run build      # dist/ — static, host it anywhere
```

The only build-time knob is `VITE_BASE`, the path the files are served under
(default `/`). This repo deploys itself to GitHub Pages on every push to `main`
(`.github/workflows/pages.yml`): https://jakegaylor.com/fountain-conversations/
— so the origin to allow on the server is `https://jakegaylor.com`.

## What it uses

| In the app | API |
|---|---|
| List, unread, status | `GET /api/conversations` |
| Live updates for everything | `GET /api/events/stream?blocks=true` — one SSE connection, `Last-Event-ID` on reconnect |
| New | `POST /api/conversations`, with `GET /api/agents`, `/api/environments`, `/api/vaults` |
| Transcript | `GET /api/conversations/:id/turns` + `/events?blocks=true` (paged until drained) |
| Prompt, interrupt, terminate, delete, read | `POST …/prompts`, `POST …/interrupt`, `POST …/terminate`, `DELETE`, `POST …/read` |
| Spawn tree, images | `GET …/tree`, `GET …/turns/:turn_id/images/:position` |
| Agents / environments / vaults | `/api/agents`, `/api/environments` (+ `/secrets`), `/api/vaults` (+ `/secrets`), `/api/agents/:id/avatar`, `GET /api/catalog`, `POST /api/avatars/generate` |

`EventSource` cannot send an `Authorization` header, so the stream is read
with `fetch` (`src/lib/sse.ts`). Markdown in replies is rendered by a small
allow-list renderer to React nodes (`src/lib/markdown.tsx`) — never HTML.

## Develop

```bash
bun run typecheck
bun test           # SSE parser, block arranging, markdown
```

Vite + React + TypeScript, no other runtime dependencies. Bun is the toolchain.
