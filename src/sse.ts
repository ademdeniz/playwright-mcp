#!/usr/bin/env node
/**
 * playwright-mcp — SSE transport entrypoint.
 *
 * Exposes the same MCP tools as server.ts over HTTP Server-Sent Events so
 * Docker-hosted clients (e.g. LibreChat) can reach the server on the host:
 *
 *   GET  /sse        — open an SSE session
 *   POST /messages   — client → server messages (?sessionId=...)
 *   GET  /health     — liveness probe
 *
 * Binds 0.0.0.0 so containers can connect via host.docker.internal.
 *
 *   npm run start:sse            # port 8931
 *   PORT=9000 npm run start:sse  # custom port
 */

import http from 'http';
import { URL } from 'url';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer } from './server.js';

const PORT = parseInt(process.env.PORT ?? '8931', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

const transports = new Map<string, SSEServerTransport>();

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/sse') {
      const transport = new SSEServerTransport('/messages', res);
      transports.set(transport.sessionId, transport);
      res.on('close', () => {
        transports.delete(transport.sessionId);
        console.error(`[playwright-mcp] SSE session closed: ${transport.sessionId}`);
      });
      await createServer().connect(transport);
      console.error(`[playwright-mcp] SSE session opened: ${transport.sessionId}`);

    } else if (req.method === 'POST' && url.pathname === '/messages') {
      const sessionId = url.searchParams.get('sessionId') ?? '';
      const transport = transports.get(sessionId);
      if (!transport) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Unknown sessionId: ${sessionId}` }));
        return;
      }
      await transport.handlePostMessage(req, res);

    } else if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, sessions: transports.size }));

    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. Endpoints: GET /sse, POST /messages, GET /health' }));
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[playwright-mcp] Request error: ${message}`);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
  }
});

httpServer.listen(PORT, HOST, () => {
  console.error(`[playwright-mcp] SSE server listening on http://${HOST}:${PORT}/sse`);
});
