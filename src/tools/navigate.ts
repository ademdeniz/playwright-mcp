import { browserManager } from '../browser.js';
import { config } from '../config.js';
import { ToolInputError, requireString } from './util.js';

export const navigateTool = {
  name: 'navigate',
  description: 'Navigate the browser to a URL and return the page title, final URL after redirects, and HTTP status. Resets the console/network error log for the new page.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to navigate to, e.g. https://example.com/login (https:// is assumed if omitted)',
      },
      waitUntil: {
        type: 'string',
        enum: ['load', 'domcontentloaded', 'networkidle'],
        description: 'When to consider navigation complete (default: load)',
      },
    },
    required: ['url'],
  },
} as const;

export function normalizeUrl(raw: string): string {
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ToolInputError(`navigate: "${raw}" is not a valid URL.`);
  }
  const allowed = ['http:', 'https:', 'about:', ...(config.allowFileUrls ? ['file:'] : [])];
  if (!allowed.includes(url.protocol)) {
    throw new ToolInputError(`navigate: ${url.protocol} URLs are not allowed. Use http(s)://`);
  }
  return url.toString();
}

export async function navigate(args: Record<string, unknown>) {
  const target = normalizeUrl(requireString(args, 'url', 'navigate'));
  const page = await browserManager.getPage();
  browserManager.clearDiagnostics();

  const response = await page.goto(target, {
    waitUntil: (args.waitUntil as 'load' | 'domcontentloaded' | 'networkidle') ?? 'load',
    timeout: 30_000,
  });
  const status = response?.status() ?? null;

  return {
    title:      await page.title(),
    url:        page.url(),
    statusCode: status,
    ok:         status === null || status < 400,
  };
}
