# AI QA Stack — Command Cheat Sheet

Every block below is a single command, safe to copy-paste as-is.

## Daily start (after reboot)

Run these three in order. All are safe to re-run if already running.

```bash
colima start
```

```bash
cd ~/LibreChat && docker compose up -d
```

```bash
cd ~/playwright-mcp && npm run start:sse > /tmp/mcp-sse.log 2>&1 &
```

Then open http://localhost:3080 → My Agents → QA Engineer.
Groq brain is cloud, nothing to start for it.

Note: `docker compose up -d` is required — a previous `docker compose down`
REMOVES containers, and `colima start` alone will not bring them back.
If the UI still does not come up: this 8 GB machine can kill the Colima VM
under memory pressure. Close Chrome tabs, then rerun the three commands.

## Health checks

MCP server + LibreChat connection. Want `{"ok":true,"sessions":1}` or more:

```bash
curl -s http://localhost:8931/health
```

Containers. Want LibreChat, mongodb, meilisearch, vectordb, rag_api all "Up":

```bash
docker ps --format '{{.Names}}: {{.Status}}'
```

LibreChat UI. Want `200`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3080
```

## Watch the agent work (ground-truth log)

```bash
tail -f /tmp/mcp-sse.log
```

## Stop everything

```bash
pkill -f "node dist/sse.js"
```

```bash
cd ~/LibreChat && docker compose down
```

```bash
colima stop
```

## Local model only (not needed for Groq)

```bash
OLLAMA_CONTEXT_LENGTH=8192 OLLAMA_KEEP_ALIVE=2h ollama serve > /tmp/ollama.log 2>&1 &
```

## After changing playwright-mcp code

```bash
cd ~/playwright-mcp && npm run build && pkill -f "node dist/sse.js"; sleep 1; cd ~/playwright-mcp && npm run start:sse > /tmp/mcp-sse.log 2>&1 &
```

## After changing librechat.yaml

```bash
cd ~/LibreChat && docker compose restart api
```

## Test suite (run from ~/playwright-e2e)

All tests, headless Chromium:

```bash
npm test
```

Smoke suite:

```bash
npm run test:smoke
```

Regression suite:

```bash
npm run test:regression
```

API tests:

```bash
npm run test:api
```

Headed mode (visible browser):

```bash
npm run test:headed
```

One file:

```bash
npx playwright test tests/auth/auth-guard.spec.ts --project=chromium
```

Open the HTML report:

```bash
npm run report
```

## Playwright AI agents (Claude Code, from ~/playwright-e2e)

Not shell commands. Open Claude Code in the repo and ask:

- "use the planner to map test scenarios for X"
- "use the generator on specs/login-plan.md"
- "run the healer on the failing test"

One-time scaffolding (already done):

```bash
npx playwright init-agents --loop=claude
```

## LibreChat debugging

```bash
docker logs LibreChat --since 5m 2>&1 | grep -iE "mcp|error"
```

## Ports

| Port | Service |
|---|---|
| 3080 | LibreChat UI |
| 8931 | playwright-mcp SSE: /sse /messages /health |
| 11434 | Ollama (only when running local models) |

## Repos

- https://github.com/ademdeniz/playwright-mcp
- https://github.com/ademdeniz/playwright-e2e
- ~/LibreChat (config: librechat.yaml, .env, docker-compose.override.yml)
