/**
 * Playwright browser manager.
 * Maintains a single browser + page instance across MCP tool calls.
 */

import { Browser, BrowserContext, Page, chromium } from 'playwright';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  // Concurrent getPage() calls must share one launch, not race several
  private launchLock: Promise<Page> | null = null;

  async getPage(): Promise<Page> {
    if (this.page) return this.page;
    if (!this.launchLock) {
      this.launchLock = (async () => {
        if (!this.browser) {
          this.browser = await chromium.launch({ headless: true });
          this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: 'playwright-mcp/1.0',
          });
        }
        this.page = await this.context!.newPage();
        return this.page;
      })().finally(() => { this.launchLock = null; });
    }
    return this.launchLock;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser  = null;
      this.context  = null;
      this.page     = null;
    }
  }

  isOpen(): boolean {
    return this.browser !== null;
  }
}

export const browserManager = new BrowserManager();
