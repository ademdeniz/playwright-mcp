// HTTP transport: binding, auth, and both protocol flavours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startHttpServer } from './fixtures.mjs';

const TOKEN = 'test-token-123';
const auth = { headers: { Authorization: `Bearer ${TOKEN}` } };

test('refuses a non-loopback bind without a token', async () => {
  await assert.rejects(startHttpServer({ HOST: '0.0.0.0', PLAYWRIGHT_MCP_TOKEN: '' }),
    err => /Refusing to listen/.test(err.output));
});

test('defaults to localhost and blocks foreign Host / Origin headers', async () => {
  const srv = await startHttpServer({ PLAYWRIGHT_MCP_TOKEN: '' });
  try {
    const health = await fetch(`${srv.url}/health`).then(r => r.json());
    assert.equal(health.ok, true);

    // fetch() won't let us forge Host, so use a raw request
    const { request } = await import('node:http');
    const status = await new Promise((resolve, reject) => {
      const req = request(`${srv.url}/sse`, { headers: { Host: 'evil.example:8931' } }, res => {
        resolve(res.statusCode); res.destroy();
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 403);

    const cross = await fetch(`${srv.url}/mcp`, { method: 'POST', headers: { Origin: 'https://evil.example' } });
    assert.equal(cross.status, 403);
  } finally {
    srv.stop();
  }
});

test('token auth: rejects missing/wrong tokens, accepts the right one over Streamable HTTP and SSE', async () => {
  const srv = await startHttpServer({ PLAYWRIGHT_MCP_TOKEN: TOKEN });
  try {
    assert.equal((await fetch(`${srv.url}/sse`)).status, 401);
    assert.equal((await fetch(`${srv.url}/mcp`, {
      method: 'POST', headers: { Authorization: 'Bearer wrong' },
    })).status, 401);

    const http = new Client({ name: 'test', version: '0' });
    await http.connect(new StreamableHTTPClientTransport(new URL(`${srv.url}/mcp`), { requestInit: auth }));
    assert.ok((await http.listTools()).tools.some(t => t.name === 'navigate'));
    await http.close();

    const sse = new Client({ name: 'test', version: '0' });
    await sse.connect(new SSEClientTransport(new URL(`${srv.url}/sse`), {
      requestInit: auth,
      eventSourceInit: { fetch: (url, init) => fetch(url, { ...init, headers: { ...init?.headers, ...auth.headers } }) },
    }));
    assert.ok((await sse.listTools()).tools.some(t => t.name === 'assert'));
    await sse.close();
  } finally {
    srv.stop();
  }
});
