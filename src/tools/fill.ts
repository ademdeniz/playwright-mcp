import { browserManager } from '../browser.js';

export const fillTool = {
  name: 'fill',
  description: 'Type text into an input field, textarea, or contenteditable element.',
  inputSchema: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the input field',
      },
      value: {
        type: 'string',
        description: 'Text to type into the field',
      },
      clearFirst: {
        type: 'boolean',
        description: 'Clear the field before typing (default: true)',
      },
    },
    required: ['selector', 'value'],
  },
} as const;

export async function fill(args: { selector: string; value: string; clearFirst?: boolean }) {
  const page = await browserManager.getPage();
  const locator = page.locator(args.selector).first();

  if (args.clearFirst !== false) {
    await locator.clear();
  }
  await locator.fill(args.value);

  return {
    selector:     args.selector,
    filled:       true,
    currentValue: await locator.inputValue().catch(() => args.value),
  };
}
