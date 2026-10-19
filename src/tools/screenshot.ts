import { browserManager } from '../browser.js';
import { config } from '../config.js';
import { RichResult, ToolInputError, visible } from './util.js';
import * as path from 'path';
import * as fs from 'fs';

export const screenshotTool = {
  name: 'screenshot',
  description: 'Take a screenshot of the current page or a specific element. Returns the PNG as an image the model can see, and optionally saves it to the output directory.',
  inputSchema: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector to screenshot a specific element (optional — omit for the viewport)',
      },
      savePath: {
        type: 'string',
        description: 'Optional file name to save under the server output directory, e.g. "login/success.png"',
      },
      fullPage: {
        type: 'boolean',
        description: 'Capture full scrollable page (default: false)',
      },
    },
    required: [],
  },
} as const;

/** Resolve a save path inside the output directory, refusing anything that escapes it. */
export function resolveSavePath(savePath: string): string {
  const resolved = path.resolve(config.outputDir, savePath);
  const relative = path.relative(config.outputDir, resolved);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ToolInputError(
      `screenshot: savePath must be a file inside the output directory (${config.outputDir}).`);
  }
  return resolved.toLowerCase().endsWith('.png') ? resolved : `${resolved}.png`;
}

export async function screenshot(args: {
  selector?: string;
  savePath?: string;
  fullPage?: boolean;
}) {
  const target = args.savePath ? resolveSavePath(args.savePath) : null;
  const page = await browserManager.getPage();

  const buffer = args.selector
    ? await visible(page, args.selector).screenshot({ timeout: 10_000 })
    : await page.screenshot({ fullPage: args.fullPage ?? false });

  if (target) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer);
  }

  const meta = {
    size:  buffer.length,
    saved: target,
    url:   page.url(),
  };
  return config.screenshotImage
    ? new RichResult(meta, [{ data: buffer.toString('base64'), mimeType: 'image/png' }])
    : meta;
}
