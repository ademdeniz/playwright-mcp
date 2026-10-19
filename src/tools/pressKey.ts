import { browserManager } from '../browser.js';
import { requireString, visible } from './util.js';

export const pressKeyTool = {
  name: 'press_key',
  description: 'Press a keyboard key or chord, e.g. "Enter", "Escape", "Tab", "ArrowDown", "Control+A". Optionally focus an element first.',
  inputSchema: {
    type: 'object',
    properties: {
      key:      { type: 'string', description: 'Key name as Playwright understands it, e.g. "Enter" or "Shift+Tab"' },
      selector: { type: 'string', description: 'Optional CSS selector of the element to focus before pressing' },
    },
    required: ['key'],
  },
} as const;

export async function pressKey(args: Record<string, unknown>) {
  const key = requireString(args, 'key', 'press_key');
  const page = await browserManager.getPage();
  if (typeof args.selector === 'string' && args.selector) {
    await visible(page, args.selector).press(key, { timeout: 10_000 });
  } else {
    await page.keyboard.press(key);
  }
  const active = await browserManager.getPage();
  return { pressed: key, currentUrl: active.url() };
}
