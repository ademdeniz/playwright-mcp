import { browserManager } from '../browser.js';

export const clickTool = {
  name: 'click',
  description: 'Click an element on the page identified by a CSS selector or text content.',
  inputSchema: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the element to click',
      },
      text: {
        type: 'string',
        description: 'Visible text of the element to click (alternative to selector)',
      },
      waitForNavigation: {
        type: 'boolean',
        description: 'Wait for navigation after click (default: false)',
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
  const page = await browserManager.getPage();

  const locator = args.text
    ? page.getByText(args.text, { exact: false }).first()
    : page.locator(args.selector!).first();

  if (args.waitForNavigation) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 15_000 }).catch(() => {}),
      locator.click({ timeout: 10_000 }),
    ]);
  } else {
    await locator.click({ timeout: 10_000 });
  }

  return {
    clicked:    args.selector ?? `text="${args.text}"`,
    currentUrl: page.url(),
    pageTitle:  await page.title(),
  };
}
