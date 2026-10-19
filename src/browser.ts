/**
 * Playwright browser manager.
 * Maintains a single browser + active page across MCP tool calls, recovers
 * from crashed/closed browsers, follows newly opened tabs, and records page
 * diagnostics (console errors, uncaught exceptions, failed requests) from the
 * moment each page is created.
 */

import { Browser, BrowserContext, Page, chromium, firefox, webkit } from 'playwright';
import { config } from './config.js';

const MAX_DIAGNOSTICS = 50;

export interface Diagnostics {
  consoleErrors:  string[];
  pageErrors:     string[];
  failedRequests: string[];
}

function push(list: string[], entry: string) {
  list.push(entry.slice(0, 300));
  if (list.length > MAX_DIAGNOSTICS) list.shift();
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  // Concurrent getPage() calls must share one launch, not race several
  private launchLock: Promise<Page> | null = null;
  private diagnostics: Diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };

  async getPage(): Promise<Page> {
    if (this.page && !this.page.isClosed() && this.browser?.isConnected()) return this.page;

    // The active tab was closed but others remain — fall back to the newest one
    const open = this.context?.pages().filter(p => !p.isClosed()) ?? [];
    if (this.browser?.isConnected() && open.length > 0) {
      this.page = open[open.length - 1];
      return this.page;
    }

    if (!this.launchLock) {
      this.launchLock = this.launch().finally(() => { this.launchLock = null; });
    }
    return this.launchLock;
  }

  private async launch(): Promise<Page> {
    if (!this.browser?.isConnected()) {
      this.reset();
      const type = { chromium, firefox, webkit }[config.browser];
      const browser = await type.launch({ headless: config.headless });
      browser.on('disconnected', () => { if (this.browser === browser) this.reset(); });
      this.browser = browser;
      this.context = await browser.newContext({
        viewport:  config.viewport,
        userAgent: config.userAgent,
      });
      // A click that opens a new tab makes that tab the active page
      this.context.on('page', page => {
        this.watch(page);
        this.page = page;
      });
    }
    const page = await this.context!.newPage();
    this.page = page;
    return page;
  }

  private watch(page: Page) {
    const d = this.diagnostics;
    page.on('console', msg => {
      if (msg.type() === 'error') push(d.consoleErrors, msg.text());
    });
    page.on('pageerror', err => push(d.pageErrors, err.message));
    page.on('requestfailed', req =>
      push(d.failedRequests, `${req.method()} ${req.url()} — ${req.failure()?.errorText ?? 'failed'}`));
    page.on('response', res => {
      if (res.status() >= 400) push(d.failedRequests, `${res.request().method()} ${res.url()} — HTTP ${res.status()}`);
    });
  }

  getDiagnostics(): Diagnostics {
    return {
      consoleErrors:  [...this.diagnostics.consoleErrors],
      pageErrors:     [...this.diagnostics.pageErrors],
      failedRequests: [...this.diagnostics.failedRequests],
    };
  }

  clearDiagnostics() {
    this.diagnostics.consoleErrors.length  = 0;
    this.diagnostics.pageErrors.length     = 0;
    this.diagnostics.failedRequests.length = 0;
  }

  private reset() {
    this.browser = null;
    this.context = null;
    this.page    = null;
    this.clearDiagnostics();
  }

  async close(): Promise<void> {
    const browser = this.browser;
    this.reset();
    if (browser) await browser.close().catch(() => {});
  }

  isOpen(): boolean {
    return this.browser?.isConnected() ?? false;
  }
}

export const browserManager = new BrowserManager();
