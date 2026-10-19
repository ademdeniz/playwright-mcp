import { browserManager } from '../browser.js';
import { requireString } from './util.js';

export const evaluateTool = {
  name: 'evaluate',
  description: 'Execute JavaScript in the browser page context and return the result. Use for reading DOM values or checks the other tools cannot express. The value of the last expression is returned.',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'JavaScript to evaluate. Example: "document.title" or "document.querySelectorAll(\'img\').length"',
      },
    },
    required: ['expression'],
  },
} as const;

export async function evaluate(args: Record<string, unknown>) {
  const expression = requireString(args, 'expression', 'evaluate');
  const page = await browserManager.getPage();
  try {
    const result = await page.evaluate(expression);
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
