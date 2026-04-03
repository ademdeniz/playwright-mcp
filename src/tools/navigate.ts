import { browserManager } from '../browser.js';

export const navigateTool = {
  name: 'navigate',
  description: 'Navigate the browser to a URL and return the page title and final URL after redirects.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to navigate to (must include protocol, e.g. https://)',
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

export async function navigate(args: { url: string; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }) {
  const page = await browserManager.getPage();
  const response = await page.goto(args.url, {
    waitUntil: args.waitUntil ?? 'load',
    timeout: 30_000,
  });

  return {
    title:      await page.title(),
    url:        page.url(),
    statusCode: response?.status() ?? null,
  };
}
