// End-to-end: spawn the stdio server like an MCP host would and drive real pages.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ROOT, startHttpsSite, startSite } from './fixtures.mjs';

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmcp-test-'));
let site;
let client;

async function connect(env = {}) {
  const c = new Client({ name: 'test', version: '0.0.0' });
  await c.connect(new StdioClientTransport({
    command: process.execPath,
    args: [path.join(ROOT, 'dist/server.js')],
    env: { ...process.env, PLAYWRIGHT_MCP_OUTPUT_DIR: outputDir, ...env },
    stderr: 'ignore',
  }));
  return c;
}

async function call(name, args = {}, c = client) {
  const res = await c.callTool({ name, arguments: args });
  const text = res.content.find(p => p.type === 'text')?.text ?? '';
  let json = null;
  try { json = JSON.parse(text); } catch { /* error text */ }
  return { ...res, text, json };
}

before(async () => {
  site = await startSite();
  client = await connect();
});

after(async () => {
  await client?.close();
  site?.close();
  fs.rmSync(outputDir, { recursive: true, force: true });
});

test('lists every tool', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(t => t.name).sort(), [
    'assert', 'click', 'close_browser', 'evaluate', 'fill', 'get_page_state',
    'navigate', 'press_key', 'screenshot', 'select_option', 'set_browser_mode', 'set_viewport', 'wait_for',
  ]);
});

test('login flow: fill, click, assert', async () => {
  const nav = await call('navigate', { url: `${site.base}/login` });
  assert.equal(nav.json.statusCode, 200);

  const state = await call('get_page_state');
  const selectors = state.json.interactiveElements.map(e => e.selector);
  assert.ok(selectors.includes('#username'), `selectors: ${selectors}`);
  assert.ok(selectors.includes('#password'));

  // Throwaway value for the local fixture page — generated so no literal credential lives in the repo
  const throwaway = `fixture-${process.pid}-${Date.now()}`;
  await call('fill', { selector: '#username', value: 'qa-user' });
  const pw = await call('fill', { selector: '#password', value: throwaway });
  assert.equal(pw.json.currentValue, '<hidden>', 'password must not be echoed');

  await call('click', { selector: 'button[type="submit"]', waitForNavigation: true });
  assert.equal((await call('assert', { type: 'url_contains', expected: '/secure' })).json.passed, true);
  assert.equal((await call('assert', { type: 'text_visible', expected: 'You logged into a secure area!' })).json.passed, true);

  const failing = await call('assert', { type: 'text_visible', expected: 'nope', timeout: 0 });
  assert.equal(failing.json.passed, false);
});

test('captures console errors, uncaught exceptions and failed requests', async () => {
  await call('navigate', { url: `${site.base}/errors` });
  assert.equal((await call('wait_for', { text: 'Broken page' })).isError, undefined);
  await new Promise(r => setTimeout(r, 300));
  const { json } = await call('get_page_state');
  assert.ok(json.consoleErrors.some(e => e.includes('boom from console')), JSON.stringify(json.consoleErrors));
  assert.ok(json.pageErrors.some(e => e.includes('uncaught boom')), JSON.stringify(json.pageErrors));
  assert.ok(json.failedRequests.some(e => e.includes('/missing.png') && e.includes('404')), JSON.stringify(json.failedRequests));

  // navigate starts a clean log for the next page
  await call('navigate', { url: `${site.base}/login` });
  const clean = await call('get_page_state');
  assert.deepEqual(clean.json.consoleErrors, []);
  assert.deepEqual(clean.json.pageErrors, []);
});

test('assert retries until slow content appears', async () => {
  await call('navigate', { url: `${site.base}/dynamic` });
  await call('click', { selector: '#start' });
  const res = await call('assert', { type: 'text_visible', selector: '#finish', expected: 'Hello World!' });
  assert.equal(res.json.passed, true, res.text);
});

test('select_option, press_key, and visible-only matching', async () => {
  await call('navigate', { url: `${site.base}/form` });
  await call('select_option', { selector: '#dropdown', label: 'Option 2' });
  assert.equal((await call('assert', { type: 'input_value', selector: '#dropdown', expected: '2' })).json.passed, true);

  await call('fill', { selector: '#search', value: 'shoes' });
  await call('press_key', { selector: '#search', key: 'Enter' });
  assert.equal((await call('assert', { type: 'text_visible', selector: '#out', expected: 'searched:shoes' })).json.passed, true);

  await call('click', { selector: 'button.dup' });
  assert.equal((await call('assert', { type: 'text_visible', expected: 'clicked' })).json.passed, true);
});

test('follows a link that opens a new tab', async () => {
  await call('navigate', { url: `${site.base}/form` });
  const res = await call('click', { selector: '#newtab' });
  assert.match(res.json.currentUrl, /\/secure$/, res.text);
  const waited = await call('wait_for', { urlContains: '/secure', timeout: 2000 });
  assert.equal(waited.isError, undefined, waited.text);
  assert.equal((await call('assert', { type: 'title_contains', expected: 'Secure' })).json.passed, true);
});

test('screenshot returns an image and stays inside the output directory', async () => {
  await call('navigate', { url: `${site.base}/login` });
  const shot = await call('screenshot', { savePath: 'login/page.png' });
  assert.ok(shot.content.some(p => p.type === 'image' && p.mimeType === 'image/png'));
  assert.ok(fs.existsSync(path.join(outputDir, 'login/page.png')));

  const escape = await call('screenshot', { savePath: '../../etc/evil.png' });
  assert.equal(escape.isError, true);
  assert.match(escape.text, /inside the output directory/);
});

test('bad arguments return clear errors', async () => {
  const noTarget = await call('click', {});
  assert.equal(noTarget.isError, true);
  assert.match(noTarget.text, /provide either "selector" or "text"/);

  const badAssert = await call('assert', { type: 'element_exists' });
  assert.match(badAssert.text, /requires "selector"/);

  const badUrl = await call('navigate', { url: 'javascript:alert(1)' });
  assert.match(badUrl.text, /not allowed/);
});

test('rejects concurrent calls', async () => {
  await call('navigate', { url: `${site.base}/dynamic` });
  const [slow, fast] = await Promise.all([
    call('wait_for', { selector: '#never', timeout: 1500 }),
    new Promise(r => setTimeout(r, 200)).then(() => call('get_page_state')),
  ]);
  assert.equal(slow.isError, true);
  assert.match(fast.text, /REJECTED/);
});

test('a hung call times out and the browser recovers', async () => {
  const c = await connect({ PLAYWRIGHT_MCP_TOOL_TIMEOUT_MS: '2000' });
  try {
    await call('navigate', { url: `${site.base}/login` }, c);
    const hung = await call('evaluate', { expression: 'while (true) {}' }, c);
    assert.equal(hung.isError, true);
    assert.match(hung.text, /timed out/);
    const again = await call('navigate', { url: `${site.base}/login` }, c);
    assert.equal(again.json.statusCode, 200);
  } finally {
    await c.close();
  }
});

test('persistent profile keeps logins across close_browser and server restarts', async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pmcp-profile-'));
  const env = { PLAYWRIGHT_MCP_USER_DATA_DIR: profile };
  try {
    let c = await connect(env);
    await call('navigate', { url: `${site.base}/login` }, c);
    await call('evaluate', { expression: "document.cookie = 'sso_session=abc123; max-age=3600; path=/'" }, c);
    assert.equal((await call('close_browser', {}, c)).json.closed, true);

    await call('navigate', { url: `${site.base}/login` }, c);
    const afterClose = await call('evaluate', { expression: 'document.cookie' }, c);
    assert.match(afterClose.json.result, /sso_session=abc123/);
    await c.close();

    c = await connect(env);
    await call('navigate', { url: `${site.base}/login` }, c);
    const afterRestart = await call('evaluate', { expression: 'document.cookie' }, c);
    assert.match(afterRestart.json.result, /sso_session=abc123/);
    await c.close();
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
});

test('self-signed HTTPS is rejected by default and accepted when allowed', async (t) => {
  const secure = await startHttpsSite();
  if (!secure) return t.skip('openssl not available');
  try {
    const strict = await call('navigate', { url: `${secure.base}/` });
    assert.equal(strict.isError, true);
    assert.match(strict.text, /CERT|certificate/i);

    const c = await connect({ PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS: '1' });
    try {
      const relaxed = await call('navigate', { url: `${secure.base}/` }, c);
      assert.equal(relaxed.json.statusCode, 200, relaxed.text);
    } finally {
      await c.close();
    }
  } finally {
    secure.close();
  }
});

test('set_browser_mode validates input and keeps the page when the mode is unchanged', async () => {
  await call('navigate', { url: `${site.base}/login` });
  const same = await call('set_browser_mode', { headless: true });
  assert.equal(same.json.headless, true);
  assert.equal(same.json.changed, false);
  assert.match((await call('get_page_state')).json.url, /\/login$/);
  const bad = await call('set_browser_mode', {});
  assert.equal(bad.isError, true);
  assert.match(bad.text, /"headless"/);
});

test('a login made headless survives switching to a visible window and back', async (t) => {
  if (process.platform === 'linux' && !process.env.DISPLAY) return t.skip('no display for a visible browser');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pmcp-mode-'));
  const c = await connect({ PLAYWRIGHT_MCP_USER_DATA_DIR: profile, PLAYWRIGHT_MCP_HEADLESS: 'true' });
  try {
    await call('navigate', { url: `${site.base}/login` }, c);
    await call('evaluate', { expression: "document.cookie = 'sso_session=xyz789; max-age=3600; path=/'" }, c);

    const visible = await call('set_browser_mode', { headless: false }, c);
    assert.equal(visible.json.headless, false);
    assert.equal(visible.json.changed, true);
    assert.equal(visible.json.persistentProfile, true);
    assert.match(visible.json.reopened, /\/login$/, visible.text);
    assert.match((await call('evaluate', { expression: 'document.cookie' }, c)).json.result, /sso_session=xyz789/);

    const back = await call('set_browser_mode', { headless: true }, c);
    assert.equal(back.json.headless, true);
    assert.match((await call('evaluate', { expression: 'document.cookie' }, c)).json.result, /sso_session=xyz789/);
  } finally {
    await call('close_browser', {}, c).catch(() => {});
    await c.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});

test('evaluate can be disabled', async () => {
  const c = await connect({ PLAYWRIGHT_MCP_DISABLE_EVALUATE: '1' });
  try {
    const { tools } = await c.listTools();
    assert.ok(!tools.some(t => t.name === 'evaluate'));
  } finally {
    await c.close();
  }
});

test('set_viewport resizes and reports horizontal scroll', async () => {
  await call('navigate', { url: `${site.base}/login` });
  const narrow = await call('set_viewport', { width: 320, height: 640 });
  assert.equal(narrow.json.viewport.width, 320);
  assert.equal(await call('evaluate', { expression: 'window.innerWidth' }).then(r => r.json.result), 320);
  const bad = await call('set_viewport', { width: 10 });
  assert.equal(bad.isError, true);
  await call('set_viewport', { width: 1280, height: 800 });
});

test('close_browser then continue', async () => {
  assert.equal((await call('close_browser')).json.closed, true);
  const nav = await call('navigate', { url: `${site.base}/login` });
  assert.equal(nav.json.statusCode, 200);
});
