// Local pages the tests drive, so the suite never depends on a public site.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = {
  '/login': `<!doctype html><title>Login</title>
    <form action="/secure" method="get">
      <label for="username">Username</label><input id="username" name="username">
      <label for="password">Password</label><input id="password" name="password" type="password">
      <button type="submit">Login</button>
    </form>`,
  '/secure': `<!doctype html><title>Secure area</title>
    <div id="flash">You logged into a secure area!</div><a href="/login">Logout</a>`,
  '/errors': `<!doctype html><title>Errors</title>
    <img src="/missing.png">
    <script>console.error('boom from console'); setTimeout(() => { throw new Error('uncaught boom'); });</script>
    <p>Broken page</p>`,
  '/dynamic': `<!doctype html><title>Dynamic</title>
    <button id="start" onclick="setTimeout(() => {
      const d = document.createElement('div'); d.id = 'finish'; d.textContent = 'Hello World!';
      document.body.appendChild(d); }, 1500)">Start</button>`,
  '/form': `<!doctype html><title>Form</title>
    <select id="dropdown"><option value="">Pick</option><option value="1">Option 1</option><option value="2">Option 2</option></select>
    <input id="search" onkeydown="if (event.key === 'Enter') document.getElementById('out').textContent = 'searched:' + this.value">
    <div id="out"></div>
    <button class="dup" style="display:none">Hidden twin</button><button class="dup" onclick="this.textContent='clicked'">Visible twin</button>
    <a href="/secure" target="_blank" id="newtab">Open tab</a>`,
};

export async function startSite() {
  const server = http.createServer((req, res) => {
    const page = PAGES[new URL(req.url, 'http://x').pathname];
    res.writeHead(page ? 200 : 404, { 'Content-Type': 'text/html' });
    res.end(page ?? 'not found');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

/** Start dist/sse.js and resolve once it is listening (or reject with its output if it exits). */
export async function startHttpServer(env) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(ROOT, 'dist/sse.js')], {
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let output = '';
  child.stderr.on('data', chunk => { output += chunk; });
  await new Promise((resolve, reject) => {
    child.stderr.on('data', () => { if (output.includes('listening on')) resolve(); });
    child.on('exit', code => reject(Object.assign(new Error(`exited ${code}: ${output}`), { code, output })));
  });
  return { url: `http://127.0.0.1:${port}`, child, stop: () => child.kill('SIGTERM') };
}
