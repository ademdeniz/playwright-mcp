/**
 * Playwright browser manager.
 * Maintains a single browser + active page across MCP tool calls, recovers
 * from crashed/closed browsers, follows newly opened tabs, and records page
 * diagnostics (console errors, uncaught exceptions, failed requests) from the
 * moment each page is created.
 *
 * With PLAYWRIGHT_MCP_USER_DATA_DIR set, the browser runs on a persistent
 * profile instead, so cookies and SSO sessions survive close_browser, timeout
 * resets and server restarts.
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
  // A persistent context has no Browser object, so liveness is tracked here
  private alive = false;
  // Concurrent getPage() calls must share one launch, not race several
  private launchLock: Promise<Page> | null = null;
  private diagnostics: Diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };

  async getPage(): Promise<Page> {
    if (this.page && !this.page.isClosed() && this.alive) return this.page;

    // The active tab was closed but others remain — fall back to the newest one
    const open = this.context?.pages().filter(p => !p.isClosed()) ?? [];
    if (this.alive && open.length > 0) {
      this.page = open[open.length - 1];
      return this.page;
    }

    if (!this.launchLock) {
      this.launchLock = this.launch().finally(() => { this.launchLock = null; });
    }
    return this.launchLock;
  }

  private async launch(): Promise<Page> {
    if (!this.alive) {
      this.reset();
      const type = { chromium, firefox, webkit }[config.browser];
      const options = {
        headless:          config.headless,
        viewport:          config.viewport,
        userAgent:         config.userAgent,
        ignoreHTTPSErrors: config.ignoreHttpsErrors,
      };

      let context: BrowserContext;
      if (config.userDataDir) {
        try {
          context = await type.launchPersistentContext(config.userDataDir, options);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(/ProcessSingleton|profile.*in use|lock/i.test(message)
            ? `The browser profile at ${config.userDataDir} is already in use by another browser. ` +
              `Close the other session using it, or give this one its own PLAYWRIGHT_MCP_USER_DATA_DIR.`
            : message);
        }
        context.on('close', () => { if (this.context === context) this.reset(); });
      } else {
        const { headless } = options;
        const browser = await type.launch({ headless });
        browser.on('disconnected', () => { if (this.browser === browser) this.reset(); });
        this.browser = browser;
        context = await browser.newContext(options);
      }
      this.context = context;
      this.alive = true;

      // A click that opens a new tab makes that tab the active page
      context.on('page', page => {
        this.watch(page);
        this.page = page;
      });
      // A persistent profile opens with a tab already there, before our listener
      const existing = context.pages().find(p => !p.isClosed());
      if (existing) {
        this.watch(existing);
        this.page = existing;
        return existing;
      }
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
    this.alive   = false;
    this.browser = null;
    this.context = null;
    this.page    = null;
    this.clearDiagnostics();
  }

  async close(): Promise<void> {
    const { browser, context } = this;
    this.reset();
    // Closing a persistent context flushes the profile (cookies) to disk
    if (browser) await browser.close().catch(() => {});
    else if (context) await context.close().catch(() => {});
  }

  isOpen(): boolean {
    return this.alive;
  }
}

export const browserManager = new BrowserManager();
