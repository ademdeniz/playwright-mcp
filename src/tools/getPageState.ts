import { browserManager } from '../browser.js';

export const getPageStateTool = {
  name: 'get_page_state',
  description: 'Get the current state of the page — title, URL, visible text, interactive elements, and console errors. Use this to understand what is on screen before deciding the next action.',
  inputSchema: {
    type: 'object',
    properties: {
      includeHtml: {
        type: 'boolean',
        description: 'Include truncated outer HTML of the body (default: false)',
      },
      selector: {
        type: 'string',
        description: 'Scope to a specific element — returns only that element\'s state',
      },
    },
    required: [],
  },
} as const;

export async function getPageState(args: { includeHtml?: boolean; selector?: string }) {
  const page = await browserManager.getPage();

  // Collect console errors captured during the session
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const title = await page.title();
  const url   = page.url();

  // Visible text (trimmed, max 3000 chars)
  const visibleText = await page.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : document.body;
    return (root as HTMLElement)?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 3000) ?? '';
  }, args.selector ?? null);

  // Interactive elements
  const interactive = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(
      'button, input, select, textarea, a[href], [role="button"], [tabindex]'
    ));
    return els.slice(0, 50).map(el => ({
      tag:         el.tagName.toLowerCase(),
      id:          el.id || null,
      name:        (el as HTMLInputElement).name || null,
      type:        (el as HTMLInputElement).type || null,
      text:        (el as HTMLElement).innerText?.trim().slice(0, 80) || null,
      placeholder: (el as HTMLInputElement).placeholder || null,
      href:        (el as HTMLAnchorElement).href || null,
      visible:     (el as HTMLElement).offsetParent !== null,
    }));
  });

  const result: Record<string, unknown> = {
    title,
    url,
    visibleText,
    interactiveElements: interactive,
    consoleErrors,
  };

  if (args.includeHtml) {
    result.html = await page.evaluate(() =>
      document.body.outerHTML.slice(0, 5000)
    );
  }

  return result;
}
