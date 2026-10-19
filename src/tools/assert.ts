import { Page } from 'playwright';
import { browserManager } from '../browser.js';
import { ToolInputError, normalize } from './util.js';

const TYPES = [
  'title_contains', 'url_contains', 'text_visible', 'text_absent',
  'element_exists', 'element_visible', 'element_hidden', 'input_value', 'element_count',
] as const;
type AssertType = typeof TYPES[number];

const NEEDS_SELECTOR: AssertType[] = ['element_exists', 'element_visible', 'element_hidden', 'input_value', 'element_count'];
const NEEDS_EXPECTED: AssertType[] = ['title_contains', 'url_contains', 'text_visible', 'text_absent', 'input_value'];

export const assertTool = {
  name: 'assert',
  description: 'Assert a condition about the current page. Retries until it passes or the timeout expires (default 5 s), so it is safe to call right after an action that updates the page. Returns pass/fail with the actual value.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: TYPES,
        description: 'title_contains / url_contains / text_visible / text_absent need "expected". ' +
                     'element_exists / element_visible / element_hidden need "selector". ' +
                     'input_value needs both. element_count needs "selector" and "count".',
      },
      selector: {
        type: 'string',
        description: 'CSS selector. For text_visible / text_absent it limits the search to that element.',
      },
      expected: {
        type: 'string',
        description: 'Expected text or value (substring match, whitespace-insensitive; exact for input_value)',
      },
      count: {
        type: 'number',
        description: 'Expected element count (for element_count)',
      },
      timeout: {
        type: 'number',
        description: 'Milliseconds to keep retrying before failing (default: 5000, 0 = check once)',
      },
    },
    required: ['type'],
  },
} as const;

interface AssertArgs {
  type: AssertType;
  selector?: string;
  expected?: string;
  count?: number;
  timeout?: number;
}

async function textOf(page: Page, selector?: string): Promise<string> {
  const texts = selector
    ? await page.locator(selector).allInnerTexts()
    : [await page.evaluate(() => document.body?.innerText ?? '')];
  return normalize(texts.join(' '));
}

async function check(page: Page, args: AssertArgs): Promise<{ passed: boolean; actual: unknown }> {
  const sel = args.selector!;
  const expected = normalize(args.expected ?? '');
  switch (args.type) {
    case 'title_contains': {
      const actual = await page.title();
      return { passed: actual.includes(args.expected!), actual };
    }
    case 'url_contains': {
      const actual = page.url();
      return { passed: actual.includes(args.expected!), actual };
    }
    case 'text_visible': {
      const text = await textOf(page, args.selector);
      return { passed: text.includes(expected), actual: text.slice(0, 300) };
    }
    case 'text_absent': {
      const text = await textOf(page, args.selector);
      return { passed: !text.includes(expected), actual: text.slice(0, 300) };
    }
    case 'element_exists': {
      const actual = await page.locator(sel).count();
      return { passed: actual > 0, actual };
    }
    case 'element_visible': {
      const actual = await page.locator(sel).filter({ visible: true }).count();
      return { passed: actual > 0, actual };
    }
    case 'element_hidden': {
      // Absent from the DOM, or present but not visible
      const actual = await page.locator(sel).filter({ visible: true }).count();
      return { passed: actual === 0, actual };
    }
    case 'input_value': {
      const actual = await page.locator(sel).first().inputValue({ timeout: 1_000 }).catch(() => null);
      return { passed: actual === args.expected, actual };
    }
    case 'element_count': {
      const actual = await page.locator(sel).count();
      return { passed: actual === args.count, actual };
    }
  }
}

export async function assert(args: AssertArgs) {
  if (!TYPES.includes(args.type)) {
    throw new ToolInputError(`assert: "type" must be one of ${TYPES.join(', ')}.`);
  }
  if (NEEDS_SELECTOR.includes(args.type) && !args.selector) {
    throw new ToolInputError(`assert: type "${args.type}" requires "selector".`);
  }
  if (NEEDS_EXPECTED.includes(args.type) && typeof args.expected !== 'string') {
    throw new ToolInputError(`assert: type "${args.type}" requires "expected".`);
  }
  if (args.type === 'element_count' && typeof args.count !== 'number') {
    throw new ToolInputError('assert: type "element_count" requires "count".');
  }

  const page = await browserManager.getPage();
  const deadline = Date.now() + Math.max(args.timeout ?? 5_000, 0);
  let result = await check(page, args);
  while (!result.passed && Date.now() < deadline) {
    await page.waitForTimeout(250);
    result = await check(page, args);
  }

  const expected = args.expected ?? args.count ?? null;
  return {
    passed:   result.passed,
    type:     args.type,
    selector: args.selector ?? null,
    expected,
    actual:   result.actual,
    message:  result.passed
      ? `✓ ${args.type} passed`
      : `✗ ${args.type} failed — expected ${JSON.stringify(expected ?? args.selector)}, got ${JSON.stringify(result.actual)}`,
  };
}
