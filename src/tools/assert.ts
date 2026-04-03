import { browserManager } from '../browser.js';

export const assertTool = {
  name: 'assert',
  description: 'Assert a condition about the current page state. Returns pass/fail with details — use this to verify test expectations.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['title_contains', 'url_contains', 'text_visible', 'element_exists',
               'element_hidden', 'input_value', 'element_count'],
        description: 'The type of assertion to perform',
      },
      selector: {
        type: 'string',
        description: 'CSS selector (required for element_exists, element_hidden, input_value, element_count, text_visible with scope)',
      },
      expected: {
        type: 'string',
        description: 'Expected value or text to match against',
      },
      count: {
        type: 'number',
        description: 'Expected element count (for element_count type)',
      },
    },
    required: ['type'],
  },
} as const;

type AssertType =
  | 'title_contains' | 'url_contains' | 'text_visible'
  | 'element_exists' | 'element_hidden' | 'input_value' | 'element_count';

export async function assert(args: {
  type: AssertType;
  selector?: string;
  expected?: string;
  count?: number;
}) {
  const page = await browserManager.getPage();

  let passed = false;
  let actual: unknown = null;

  switch (args.type) {
    case 'title_contains': {
      actual = await page.title();
      passed = (actual as string).includes(args.expected ?? '');
      break;
    }
    case 'url_contains': {
      actual = page.url();
      passed = (actual as string).includes(args.expected ?? '');
      break;
    }
    case 'text_visible': {
      if (args.selector) {
        actual = await page.locator(args.selector).innerText().catch(() => '');
        passed = (actual as string).includes(args.expected ?? '');
      } else {
        actual = await page.evaluate(() => document.body.innerText);
        passed = (actual as string).includes(args.expected ?? '');
      }
      break;
    }
    case 'element_exists': {
      const count = await page.locator(args.selector!).count();
      actual = count;
      passed = count > 0;
      break;
    }
    case 'element_hidden': {
      const count = await page.locator(args.selector!).count();
      actual = count;
      passed = count === 0;
      break;
    }
    case 'input_value': {
      actual = await page.locator(args.selector!).inputValue().catch(() => '');
      passed = actual === args.expected;
      break;
    }
    case 'element_count': {
      actual = await page.locator(args.selector!).count();
      passed = actual === args.count;
      break;
    }
  }

  return {
    passed,
    type:     args.type,
    selector: args.selector ?? null,
    expected: args.expected ?? args.count ?? null,
    actual,
    message:  passed
      ? `✓ ${args.type} passed`
      : `✗ ${args.type} failed — expected "${args.expected ?? args.count}", got "${actual}"`,
  };
}
