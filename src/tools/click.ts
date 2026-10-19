import { browserManager } from '../browser.js';
import { ToolInputError, visible } from './util.js';

export const clickTool = {
  name: 'click',
  description: 'Click an element identified by a CSS selector (preferred) or by its visible text. Waits up to 10 s for the element to become visible and clickable.',
  inputSchema: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the element to click',
      },
      text: {
        type: 'string',
        description: 'Visible text of the element to click (use only when no selector is known)',
      },
      waitForNavigation: {
        type: 'boolean',
        description: 'Wait for the page to navigate and load after the click (default: false)',
      },
    },
    required: [],
  },
} as const;

export async function click(args: {
  selector?: string;
  text?: string;
  waitForNavigation?: boolean;
}) {
  if (!args.selector && !args.text) {
    throw new ToolInputError('click: provide either "selector" or "text".');
  }
  const page = await browserManager.getPage();

  // An explicit CSS selector is the more precise signal — prefer it over
  // fuzzy text matching when a client supplies both.
  const locator = args.selector
    ? visible(page, args.selector)
    : page.getByText(args.text!, { exact: false }).filter({ visible: true }).first();

  const urlBefore = page.url();
  // A new tab is announced shortly *after* click() resolves, so listen first
  const popup = page.context().waitForEvent('page', { timeout: 12_000 }).catch(() => null);
  await locator.click({ timeout: 10_000 });

  const opened = await Promise.race([popup, page.waitForTimeout(300).then(() => null)]);
  if (opened) {
    // browserManager has already made it the active page
    await opened.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
  } else if (args.waitForNavigation) {
    await page.waitForURL(u => u.toString() !== urlBefore, { timeout: 15_000 }).catch(() => {});
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
  }

  const active = await browserManager.getPage();
  return {
    clicked:    args.selector ?? `text="${args.text}"`,
    currentUrl: active.url(),
    pageTitle:  await active.title(),
  };
}
