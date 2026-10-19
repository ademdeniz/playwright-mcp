import { browserManager } from '../browser.js';
import { ToolInputError, requireString, visible } from './util.js';

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
        description: 'Replace the current content (default: true). false appends by typing key by key.',
      },
    },
    required: ['selector', 'value'],
  },
} as const;

export async function fill(args: Record<string, unknown>) {
  const selector = requireString(args, 'selector', 'fill');
  if (typeof args.value !== 'string') throw new ToolInputError('fill: "value" is required and must be a string.');
  const value = args.value;

  const page = await browserManager.getPage();
  const locator = visible(page, selector);

  if (args.clearFirst === false) {
    await locator.pressSequentially(value, { timeout: 10_000 });
  } else {
    await locator.fill(value, { timeout: 10_000 });
  }

  // Never echo secrets back into the transcript
  const isPassword = await locator.getAttribute('type').then(t => t === 'password').catch(() => false);
  return {
    selector,
    filled:       true,
    currentValue: isPassword ? '<hidden>' : await locator.inputValue().catch(() => value),
  };
}
