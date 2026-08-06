#!/usr/bin/env bash
# Start the full AI QA stack: Colima → LibreChat containers → playwright-mcp SSE.
# Idempotent: safe to run when everything is already up.
set -u

echo "[1/4] Colima..."
colima start

echo "[2/4] playwright-mcp SSE server..."
if curl -sf -m 2 http://localhost:8931/health >/dev/null 2>&1; then
  echo "      already running"
else
  (cd "$HOME/playwright-mcp" && nohup npm run start:sse > /tmp/mcp-sse.log 2>&1 &)
  sleep 3
fi

echo "[3/4] LibreChat containers..."
(cd "$HOME/LibreChat" && docker compose up -d)

echo "[4/4] Waiting for LibreChat UI (up to 3 min)..."
for i in $(seq 1 60); do
  if curl -sf -m 2 http://localhost:3080 >/dev/null 2>&1; then
    echo "      LibreChat is up."
    echo -n "      MCP health: "; curl -s -m 2 http://localhost:8931/health || echo "not responding yet (reconnects on first agent use)"
    echo
    open http://localhost:3080
    exit 0
  fi
  sleep 3
done

echo "ERROR: LibreChat did not come up within 3 minutes."
echo "Check: docker ps --format '{{.Names}}: {{.Status}}'"
echo "Check: docker logs LibreChat --since 5m | tail -20"
echo "On this machine the Colima VM can die under memory pressure: close Chrome tabs and rerun."
exit 1
