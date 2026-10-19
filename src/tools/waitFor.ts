import { browserManager } from '../browser.js';
import { ToolInputError } from './util.js';

export const waitForTool = {
  name: 'wait_for',
  description: 'Wait until an element reaches a state, some text appears, or the URL contains a string. Use instead of re-polling get_page_state after slow actions.',
  inputSchema: {
    type: 'object',
    properties: {
      selector:    { type: 'string', description: 'CSS selector to wait for' },
      state:       {
        type: 'string',
        enum: ['visible', 'hidden', 'attached', 'detached'],
        description: 'Element state to wait for (default: visible)',
      },
      text:        { type: 'string', description: 'Visible text to wait for (alternative to selector)' },
      urlContains: { type: 'string', description: 'Wait until the page URL contains this string' },
      timeout:     { type: 'number', description: 'Milliseconds before giving up (default: 10000, max: 30000)' },
    },
    required: [],
  },
} as const;

export async function waitFor(args: {
  selector?: string;
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
  text?: string;
  urlContains?: string;
  timeout?: number;
}) {
  const timeout = Math.min(Math.max(args.timeout ?? 10_000, 0), 30_000);
  const page = await browserManager.getPage();
  const started = Date.now();

  if (args.selector) {
    await page.locator(args.selector).first().waitFor({ state: args.state ?? 'visible', timeout });
  } else if (args.text) {
    await page.getByText(args.text).filter({ visible: true }).first().waitFor({ state: 'visible', timeout });
  } else if (args.urlContains) {
    const needle = args.urlContains;
    await page.waitForURL(u => u.toString().includes(needle), { timeout });
  } else {
    throw new ToolInputError('wait_for: provide "selector", "text" or "urlContains".');
  }

  return { waitedMs: Date.now() - started, url: page.url() };
}
