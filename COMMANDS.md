# AI QA Stack — Command Cheat Sheet

Every block below is a single command, safe to copy-paste as-is.

## Daily start (after reboot) — ONE command

Starts everything, waits until LibreChat responds, then opens the browser itself:

```bash
~/playwright-mcp/scripts/start-stack.sh
```

When the browser opens: My Agents → QA Engineer. Groq brain is cloud, nothing to start for it.
Safe to re-run any time; it skips whatever is already running.

If it prints an error after 3 minutes: this 8 GB machine can kill the Colima VM
under memory pressure. Close Chrome tabs, then run it again.

Manual equivalent, if you ever need the individual steps:

```bash
colima start
```

```bash
cd ~/playwright-mcp && npm run start:sse > /tmp/mcp-sse.log 2>&1 &
```

```bash
cd ~/LibreChat && docker compose up -d
```

```bash
open http://localhost:3080
```

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
