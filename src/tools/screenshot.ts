import { browserManager } from '../browser.js';
import * as path from 'path';
import * as fs from 'fs';

export const screenshotTool = {
  name: 'screenshot',
  description: 'Take a screenshot of the current page or a specific element. Returns base64-encoded PNG.',
  inputSchema: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector to screenshot a specific element (optional — omit for full page)',
      },
      savePath: {
        type: 'string',
        description: 'Optional file path to save the screenshot to disk',
      },
      fullPage: {
        type: 'boolean',
        description: 'Capture full scrollable page (default: false)',
      },
    },
    required: [],
  },
} as const;

export async function screenshot(args: {
  selector?: string;
  savePath?: string;
  fullPage?: boolean;
}) {
  const page = await browserManager.getPage();

  let buffer: Buffer;
  if (args.selector) {
    const el = page.locator(args.selector).first();
    buffer = await el.screenshot();
  } else {
    buffer = await page.screenshot({ fullPage: args.fullPage ?? false });
  }

  const base64 = buffer.toString('base64');

  if (args.savePath) {
    const dir = path.dirname(args.savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(args.savePath, buffer);
  }

  return {
    base64,
    size:   buffer.length,
    saved:  args.savePath ?? null,
    url:    page.url(),
  };
}
