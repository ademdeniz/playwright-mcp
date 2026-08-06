# AI QA Stack — Command Cheat Sheet

## Daily start (after reboot) — all three are safe to re-run
```bash
colima start
cd ~/LibreChat && docker compose up -d
cd ~/playwright-mcp && npm run start:sse > /tmp/mcp-sse.log 2>&1 &
```
Then open http://localhost:3080 → My Agents → QA Engineer.
(Groq brain is cloud, nothing to start. `docker compose up -d` is required after
a `docker compose down` — down REMOVES containers, colima alone won't revive them.
If the UI still doesn't come up, run the health checks below; on this 8 GB machine
the Colima VM can be killed by memory pressure — close Chrome tabs and re-run.)

## Health checks
```bash
curl -s http://localhost:8931/health          # want {"ok":true,"sessions":1+}
docker ps --format '{{.Names}}: {{.Status}}'  # containers
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3080   # want 200
```

## Watch the agent work (ground-truth log)
```bash
tail -f /tmp/mcp-sse.log
```

## Stop everything
```bash
pkill -f "node dist/sse.js"
cd ~/LibreChat && docker compose down && colima stop
```

## Local model only (not needed for Groq)
```bash
OLLAMA_CONTEXT_LENGTH=8192 OLLAMA_KEEP_ALIVE=2h ollama serve > /tmp/ollama.log 2>&1 &
```

## After changing playwright-mcp code
```bash
cd ~/playwright-mcp && npm run build
pkill -f "node dist/sse.js"; sleep 1
npm run start:sse > /tmp/mcp-sse.log 2>&1 &
```

## After changing librechat.yaml
```bash
cd ~/LibreChat && docker compose restart api
```

## Test suite (from ~/playwright-e2e)
```bash
npm test                 # all tests
npm run test:smoke
npm run test:regression
npm run test:api
npm run test:headed
npx playwright test tests/auth/auth-guard.spec.ts --project=chromium
npm run report
```

## Playwright AI agents (Claude Code, from ~/playwright-e2e)
Not shell commands — open Claude Code in the repo and ask:
- "use the planner to map test scenarios for X"
- "use the generator on specs/login-plan.md"
- "run the healer on the failing test"

One-time scaffolding (already done): `npx playwright init-agents --loop=claude`

## LibreChat debugging
```bash
docker logs LibreChat --since 5m 2>&1 | grep -iE "mcp|error"
```

## Ports
- 3080  LibreChat UI
- 8931  playwright-mcp (SSE): /sse /messages /health
- 11434 Ollama (only when running local models)

## Repos
- https://github.com/ademdeniz/playwright-mcp
- https://github.com/ademdeniz/playwright-e2e
- ~/LibreChat (config: librechat.yaml, .env, docker-compose.override.yml)
