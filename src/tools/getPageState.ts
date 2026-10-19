import { browserManager } from '../browser.js';

export const getPageStateTool = {
  name: 'get_page_state',
  description: 'Get the current state of the page — title, URL, visible text, interactive elements (each with a ready-to-use CSS selector when one exists), and console errors, uncaught exceptions and failed network requests since the last navigate. Use this to understand what is on screen before deciding the next action.',
  inputSchema: {
    type: 'object',
    properties: {
      includeHtml: {
        type: 'boolean',
        description: 'Include truncated outer HTML of the body (default: false)',
      },
      selector: {
        type: 'string',
        description: 'Scope visible text and elements to a specific element',
      },
      maxElements: {
        type: 'number',
        description: 'Maximum interactive elements to return (default: 25, max: 100)',
      },
    },
    required: [],
  },
} as const;

export async function getPageState(args: { includeHtml?: boolean; selector?: string; maxElements?: number }) {
  const page = await browserManager.getPage();
  const scope = args.selector ?? null;
  const maxElements = Math.min(Math.max(args.maxElements ?? 25, 1), 100);

  const title = await page.title();
  const url   = page.url();

  // Visible text (trimmed — every char here is a token the LLM pays for each round)
  const visibleText = await page.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : document.body;
    return (root as HTMLElement)?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 800) ?? '';
  }, scope);

  // Interactive elements — visible ones only, null fields omitted, compact
  const interactiveElements = await page.evaluate(({ sel, max }) => {
    const root = sel ? document.querySelector(sel) : document;
    if (!root) return [];
    const els = Array.from(root.querySelectorAll(
      'button, input, select, textarea, a[href], [role="button"], [role="link"], [role="checkbox"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
    ));

    const isVisible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const quote = (v: string) => `"${v.replace(/["\\]/g, '\\$&')}"`;
    const unique = (s: string) => { try { return document.querySelectorAll(s).length === 1; } catch { return false; } };

    // Most stable selector that matches exactly this element, if any
    const selectorFor = (el: Element): string | undefined => {
      const tag = el.tagName.toLowerCase();
      const candidates: string[] = [];
      if (el.id) candidates.push(`#${CSS.escape(el.id)}`);
      for (const attr of ['data-testid', 'data-test', 'data-qa']) {
        const v = el.getAttribute(attr);
        if (v) candidates.push(`[${attr}=${quote(v)}]`);
      }
      const name = el.getAttribute('name');
      if (name) candidates.push(`${tag}[name=${quote(name)}]`);
      const aria = el.getAttribute('aria-label');
      if (aria) candidates.push(`${tag}[aria-label=${quote(aria)}]`);
      const href = el.getAttribute('href');
      if (tag === 'a' && href) candidates.push(`a[href=${quote(href)}]`);
      const type = el.getAttribute('type');
      if (type && tag !== 'a') candidates.push(`${tag}[type=${quote(type)}]`);
      return candidates.find(unique);
    };

    return els.filter(isVisible).slice(0, max).map(el => {
      const input = el as HTMLInputElement;
      const entry: Record<string, string | boolean> = { tag: el.tagName.toLowerCase() };
      const selector    = selectorFor(el);
      const type        = input.type;
      const text        = (el as HTMLElement).innerText?.trim().replace(/\s+/g, ' ').slice(0, 60);
      const label       = input.labels?.[0]?.innerText?.trim().slice(0, 60);
      const placeholder = input.placeholder;
      const href        = el.getAttribute('href') ?? '';
      if (selector)    entry.selector = selector;
      if (type && el.tagName !== 'A' && el.tagName !== 'BUTTON') entry.type = type;
      if (text)        entry.text = text;
      if (label)       entry.label = label;
      if (placeholder) entry.placeholder = placeholder;
      if (href)        entry.href = href.slice(0, 100);
      if (type === 'checkbox' || type === 'radio') entry.checked = input.checked;
      if (input.disabled) entry.disabled = true;
      if (el.tagName === 'SELECT') entry.value = (el as HTMLSelectElement).value;
      return entry;
    });
  }, { sel: scope, max: maxElements });

  const diagnostics = browserManager.getDiagnostics();
  const result: Record<string, unknown> = {
    title,
    url,
    visibleText,
    interactiveElements,
    consoleErrors:  diagnostics.consoleErrors.slice(-10),
    pageErrors:     diagnostics.pageErrors.slice(-10),
    failedRequests: diagnostics.failedRequests.slice(-10),
  };

  if (args.includeHtml) {
    result.html = await page.evaluate(() =>
      document.body.outerHTML.slice(0, 5000)
    );
  }

  return result;
}
