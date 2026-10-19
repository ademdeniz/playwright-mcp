/**
 * Runtime configuration, read once from environment variables.
 * Every option is documented in the README "Configuration" table.
 */

import * as os from 'os';
import * as path from 'path';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(raw.toLowerCase());
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function browserName(): BrowserName {
  const raw = (process.env.PLAYWRIGHT_MCP_BROWSER ?? 'chromium').toLowerCase();
  if (raw === 'chromium' || raw === 'firefox' || raw === 'webkit') return raw;
  throw new Error(`PLAYWRIGHT_MCP_BROWSER must be chromium, firefox or webkit (got "${raw}")`);
}

function viewport(): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(process.env.PLAYWRIGHT_MCP_VIEWPORT ?? '');
  return match ? { width: +match[1], height: +match[2] } : { width: 1280, height: 800 };
}

export const config = {
  browser:          browserName(),
  headless:         bool('PLAYWRIGHT_MCP_HEADLESS', true),
  viewport:         viewport(),
  userAgent:        process.env.PLAYWRIGHT_MCP_USER_AGENT || undefined,
  // Hard ceiling per tool call. A call that exceeds it resets the browser,
  // so a hung page (e.g. an infinite loop in evaluate) can't wedge the server.
  toolTimeoutMs:    int('PLAYWRIGHT_MCP_TOOL_TIMEOUT_MS', 60_000),
  // Screenshots may only be written inside this directory.
  outputDir:        path.resolve(process.env.PLAYWRIGHT_MCP_OUTPUT_DIR
                      ?? path.join(os.tmpdir(), 'playwright-mcp')),
  screenshotImage:  bool('PLAYWRIGHT_MCP_SCREENSHOT_IMAGE', true),
  allowEvaluate:    !bool('PLAYWRIGHT_MCP_DISABLE_EVALUATE', false),
  allowFileUrls:    bool('PLAYWRIGHT_MCP_ALLOW_FILE_URLS', false),
};
