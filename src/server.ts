#!/usr/bin/env node
/**
 * playwright-mcp — MCP server exposing Playwright browser automation tools.
 *
 * Tools:
 *   navigate       — go to a URL
 *   get_page_state — read title, URL, visible text, interactive elements
 *   screenshot     — capture page or element as base64 PNG
 *   click          — click by selector or visible text
 *   fill           — type into input fields
 *   evaluate       — run arbitrary JavaScript in the page
 *   assert         — verify page state (title, URL, text, element presence)
 *   close_browser  — close browser and free resources
 *
 * Transport: stdio (compatible with Claude Desktop, Cursor, and any MCP host)
 */

import { Server }             from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { navigateTool,     navigate     } from './tools/navigate.js';
import { screenshotTool,   screenshot   } from './tools/screenshot.js';
import { clickTool,        click        } from './tools/click.js';
import { fillTool,         fill         } from './tools/fill.js';
import { getPageStateTool, getPageState } from './tools/getPageState.js';
import { evaluateTool,     evaluate     } from './tools/evaluate.js';
import { assertTool,       assert       } from './tools/assert.js';
import { closeBrowserTool, closeBrowser } from './tools/closeBrowser.js';

const ALL_TOOLS = [
  navigateTool,
  getPageStateTool,
  screenshotTool,
  clickTool,
  fillTool,
  evaluateTool,
  assertTool,
  closeBrowserTool,
];

const server = new Server(
  { name: 'playwright-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ── List tools ──────────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS,
}));

// ── Call tools ──────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'navigate':        result = await navigate(args as any);       break;
      case 'get_page_state':  result = await getPageState(args as any);   break;
      case 'screenshot':      result = await screenshot(args as any);     break;
      case 'click':           result = await click(args as any);          break;
      case 'fill':            result = await fill(args as any);           break;
      case 'evaluate':        result = await evaluate(args as any);       break;
      case 'assert':          result = await assert(args as any);         break;
      case 'close_browser':   result = await closeBrowser();              break;
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Tool "${name}" failed: ${message}` }],
      isError: true,
    };
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[playwright-mcp] Server running on stdio');
}

main().catch((err) => {
  console.error('[playwright-mcp] Fatal error:', err);
  process.exit(1);
});
