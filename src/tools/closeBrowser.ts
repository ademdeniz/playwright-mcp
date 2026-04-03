import { browserManager } from '../browser.js';

export const closeBrowserTool = {
  name: 'close_browser',
  description: 'Close the browser and release all resources. Call this when the test session is complete.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
} as const;

export async function closeBrowser() {
  const wasOpen = browserManager.isOpen();
  await browserManager.close();
  return {
    closed:  wasOpen,
    message: wasOpen ? 'Browser closed successfully.' : 'Browser was not open.',
  };
}
