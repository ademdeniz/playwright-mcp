import { browserManager } from '../browser.js';
import { config } from '../config.js';
import { ToolInputError } from './util.js';

export const setBrowserModeTool = {
  name: 'set_browser_mode',
  description: 'Switch between a headless browser (fast, invisible: use for a first pass) and a visible window (the user can watch: use to reproduce failures, investigate unclear results, or let the user log in through SSO). Relaunches the browser and reopens the current page; with a persistent profile, logins carry over.',
  inputSchema: {
    type: 'object',
    properties: {
      headless: { type: 'boolean', description: 'true = invisible, false = visible window' },
    },
    required: ['headless'],
  },
} as const;

export async function setBrowserMode(args: { headless?: unknown }) {
  if (typeof args.headless !== 'boolean') {
    throw new ToolInputError('set_browser_mode: "headless" (true or false) is required.');
  }
  const result = await browserManager.setMode(args.headless);
  return {
    ...result,
    persistentProfile: !!config.userDataDir,
    note: config.userDataDir
      ? 'Cookies and logins are kept in the profile across the switch.'
      : 'No PLAYWRIGHT_MCP_USER_DATA_DIR is set: cookies and logins are NOT kept across the switch.',
  };
}
