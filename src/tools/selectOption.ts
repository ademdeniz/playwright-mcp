import { browserManager } from '../browser.js';
import { ToolInputError, requireString, visible } from './util.js';

export const selectOptionTool = {
  name: 'select_option',
  description: 'Choose an option in a <select> dropdown by its value, visible label, or index. Fires the same change events a real user would.',
  inputSchema: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector for the <select> element' },
      value:    { type: 'string', description: 'Option value attribute' },
      label:    { type: 'string', description: 'Option visible text (alternative to value)' },
      index:    { type: 'number', description: 'Zero-based option index (alternative to value)' },
    },
    required: ['selector'],
  },
} as const;

export async function selectOption(args: Record<string, unknown>) {
  const selector = requireString(args, 'selector', 'select_option');
  const option =
    typeof args.value === 'string' ? { value: args.value } :
    typeof args.label === 'string' ? { label: args.label } :
    typeof args.index === 'number' ? { index: args.index } : null;
  if (!option) throw new ToolInputError('select_option: provide "value", "label" or "index".');

  const page = await browserManager.getPage();
  const selected = await visible(page, selector).selectOption(option, { timeout: 10_000 });
  return { selector, selected };
}
