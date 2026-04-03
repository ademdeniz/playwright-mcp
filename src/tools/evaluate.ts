import { browserManager } from '../browser.js';

export const evaluateTool = {
  name: 'evaluate',
  description: 'Execute JavaScript in the browser page context and return the result. Use for assertions, reading DOM values, or custom interactions.',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'JavaScript expression to evaluate. Must be a valid JS expression (not a statement). Example: "document.title" or "document.querySelector(\'h1\').textContent"',
      },
    },
    required: ['expression'],
  },
} as const;

export async function evaluate(args: { expression: string }) {
  const page = await browserManager.getPage();
  try {
    const result = await page.evaluate(args.expression);
    return {
      result,
      type:    typeof result,
      success: true,
    };
  } catch (err: unknown) {
    return {
      result:  null,
      error:   err instanceof Error ? err.message : String(err),
      success: false,
    };
  }
}
