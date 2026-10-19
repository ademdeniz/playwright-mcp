#!/usr/bin/env node
/**
 * playwright-mcp — HTTP transport entrypoint.
 *
 * Exposes the same MCP tools as server.ts over HTTP, for clients that can't
 * spawn a stdio process (e.g. LibreChat running in Docker):
 *
 *   POST/GET/DELETE /mcp  — Streamable HTTP (current MCP spec)
 *   GET  /sse             — open a legacy SSE session
 *   POST /messages        — legacy SSE client → server messages (?sessionId=...)
 *   GET  /health          — liveness probe (no auth)
 *
 * Security:
 *   - Binds 127.0.0.1 by default. Set HOST=0.0.0.0 to accept connections from
 *     containers or other machines.
 *   - Set PLAYWRIGHT_MCP_TOKEN to require "Authorization: Bearer <token>".
 *   - Binding a non-loopback address without a token is refused unless
 *     PLAYWRIGHT_MCP_ALLOW_NO_AUTH=1 — anyone who can reach the port can drive
 *     the browser and run JavaScript in it.
 *   - Without a token, requests must carry a localhost Host header (and Origin,
 *     if present), which blocks DNS-rebinding attacks from web pages.
 *
 *   npm run start:sse                                        # 127.0.0.1:8931
 *   HOST=0.0.0.0 PLAYWRIGHT_MCP_TOKEN=secret npm run start:sse
 */

import http from 'http';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { URL } from 'url';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { VERSION, createServer, installShutdownHandlers } from './server.js';

const PORT       = parseInt(process.env.PORT ?? '8931', 10);
const HOST       = process.env.HOST ?? '127.0.0.1';
const TOKEN      = process.env.PLAYWRIGHT_MCP_TOKEN ?? '';
const ALLOW_OPEN = ['1', 'true', 'yes'].includes((process.env.PLAYWRIGHT_MCP_ALLOW_NO_AUTH ?? '').toLowerCase());

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const isLoopbackBind = LOOPBACK_HOSTS.has(HOST);

if (!isLoopbackBind && !TOKEN && !ALLOW_OPEN) {
  console.error(
    `[playwright-mcp] Refusing to listen on ${HOST} without authentication.\n` +
    `  Set PLAYWRIGHT_MCP_TOKEN=<secret> and send "Authorization: Bearer <secret>",\n` +
    `  or set PLAYWRIGHT_MCP_ALLOW_NO_AUTH=1 if this network is fully trusted.`);
  process.exit(1);
}

const sseTransports  = new Map<string, SSEServerTransport>();
const httpTransports = new Map<string, StreamableHTTPServerTransport>();

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const digest = (s: string) => createHash('sha256').update(s).digest();

function hasValidToken(req: http.IncomingMessage): boolean {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  // Compare fixed-length digests so the check runs in constant time
  return !!match && timingSafeEqual(digest(match[1].trim()), digest(TOKEN));
}

function hostnameOf(value: string): string {
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname;
  } catch {
    return '';
  }
}

/** Returns an error message if the request may not proceed, or null if it may. */
function authorize(req: http.IncomingMessage): { status: number; error: string } | null {
  if (TOKEN) {
    return hasValidToken(req) ? null : { status: 401, error: 'Missing or invalid bearer token' };
  }
  if (isLoopbackBind) {
    if (!LOOPBACK_HOSTS.has(hostnameOf(req.headers.host ?? ''))) {
      return { status: 403, error: 'Host header must be localhost' };
    }
    const origin = req.headers.origin;
    if (origin && !LOOPBACK_HOSTS.has(hostnameOf(origin))) {
      return { status: 403, error: 'Cross-origin requests are not allowed' };
    }
  }
  return null;
}

async function handleStreamableHttp(req: http.IncomingMessage, res: http.ServerResponse) {
  const sessionId = req.headers['mcp-session-id'];
  if (typeof sessionId === 'string') {
    const transport = httpTransports.get(sessionId);
    if (!transport) return sendJson(res, 404, { error: `Unknown session: ${sessionId}` });
    return transport.handleRequest(req, res);
  }
  if (req.method !== 'POST') {
    return sendJson(res, 400, { error: 'Start a session with a POST initialize request' });
  }

  const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      httpTransports.set(id, transport);
      console.error(`[playwright-mcp] HTTP session opened: ${id}`);
    },
  });
  transport.onclose = () => {
    if (transport.sessionId) {
      httpTransports.delete(transport.sessionId);
      console.error(`[playwright-mcp] HTTP session closed: ${transport.sessionId}`);
    }
  };
  await createServer().connect(transport);
  await transport.handleRequest(req, res);
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, {
        ok: true, version: VERSION, sessions: sseTransports.size + httpTransports.size,
      });
    }

    const denied = authorize(req);
    if (denied) {
      console.error(`[playwright-mcp] ${denied.status} ${req.method} ${url.pathname}: ${denied.error}`);
      return sendJson(res, denied.status, { error: denied.error });
    }

    if (url.pathname === '/mcp') {
      await handleStreamableHttp(req, res);

    } else if (req.method === 'GET' && url.pathname === '/sse') {
      const transport = new SSEServerTransport('/messages', res);
      sseTransports.set(transport.sessionId, transport);
      res.on('close', () => {
        sseTransports.delete(transport.sessionId);
        console.error(`[playwright-mcp] SSE session closed: ${transport.sessionId}`);
      });
      await createServer().connect(transport);
      console.error(`[playwright-mcp] SSE session opened: ${transport.sessionId}`);

    } else if (req.method === 'POST' && url.pathname === '/messages') {
      const sessionId = url.searchParams.get('sessionId') ?? '';
      const transport = sseTransports.get(sessionId);
      if (!transport) return sendJson(res, 404, { error: `Unknown sessionId: ${sessionId}` });
      await transport.handlePostMessage(req, res);

    } else {
      sendJson(res, 404, { error: 'Not found. Endpoints: /mcp, GET /sse, POST /messages, GET /health' });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[playwright-mcp] Request error: ${message}`);
    if (!res.headersSent) sendJson(res, 500, { error: message });
  }
});

installShutdownHandlers();
httpServer.listen(PORT, HOST, () => {
  const auth = TOKEN ? 'bearer token required' : isLoopbackBind ? 'localhost only' : 'NO AUTH';
  console.error(`[playwright-mcp] v${VERSION} listening on http://${HOST}:${PORT} (/mcp, /sse) — ${auth}`);
  if (!TOKEN && !isLoopbackBind) {
    console.error('[playwright-mcp] WARNING: anyone who can reach this port can control the browser.');
  }
});
