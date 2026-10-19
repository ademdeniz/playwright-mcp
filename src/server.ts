#!/usr/bin/env node
/**
 * playwright-mcp — MCP server exposing Playwright browser automation tools.
 *
 * Tools:
 *   navigate       — go to a URL
 *   get_page_state — read title, URL, visible text, interactive elements, errors
 *   screenshot     — capture page or element as an image
 *   click          — click by selector or visible text
 *   fill           — type into input fields
 *   select_option  — choose a <select> option
 *   press_key      — press a key or chord
 *   wait_for       — wait for an element, text, or URL
 *   evaluate       — run JavaScript in the page (can be disabled)
 *   assert         — verify page state, retrying until it passes or times out
 *   close_browser  — close browser and free resources
 *
 * Transports:
 *   stdio (this file, default) — compatible with Claude Desktop, Claude Code, Cursor, and any MCP host
 *   HTTP  (sse.ts)             — SSE + Streamable HTTP for Docker-hosted clients like LibreChat
 */

import * as fs   from 'fs';
import * as path from 'path';
import { Server }             from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { browserManager } from './browser.js';
import { config }         from './config.js';
import { RichResult, ToolInputError } from './tools/util.js';
import { navigateTool,     navigate     } from './tools/navigate.js';
import { screenshotTool,   screenshot   } from './tools/screenshot.js';
import { clickTool,        click        } from './tools/click.js';
import { fillTool,         fill         } from './tools/fill.js';
import { selectOptionTool, selectOption } from './tools/selectOption.js';
import { pressKeyTool,     pressKey     } from './tools/pressKey.js';
import { waitForTool,      waitFor      } from './tools/waitFor.js';
import { getPageStateTool, getPageState } from './tools/getPageState.js';
import { evaluateTool,     evaluate     } from './tools/evaluate.js';
import { assertTool,       assert       } from './tools/assert.js';
import { closeBrowserTool, closeBrowser } from './tools/closeBrowser.js';

export const VERSION: string = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;

type Handler = (args: any) => Promise<unknown>;

const TOOLS: { definition: { name: string }; handler: Handler }[] = [
  { definition: navigateTool,     handler: navigate     },
  { definition: getPageStateTool, handler: getPageState },
  { definition: screenshotTool,   handler: screenshot   },
  { definition: clickTool,        handler: click        },
  { definition: fillTool,         handler: fill         },
  { definition: selectOptionTool, handler: selectOption },
  { definition: pressKeyTool,     handler: pressKey     },
  { definition: waitForTool,      handler: waitFor      },
  ...(config.allowEvaluate ? [{ definition: evaluateTool, handler: evaluate }] : []),
  { definition: assertTool,       handler: assert       },
  { definition: closeBrowserTool, handler: closeBrowser },
];
const HANDLERS = new Map(TOOLS.map(t => [t.definition.name, t.handler]));

// All tool calls share one browser/page, so only one may run at a time.
// Parallel batches arrive in nondeterministic order (a close_browser can land
// mid-run), so instead of queueing them in scrambled order, reject concurrent
// calls outright — the client sees the error and re-issues steps one by one.
let activeTool: string | null = null;
const BUSY_ERROR = (name: string) => ({
  content: [{
    type: 'text' as const,
    text: `Tool "${name}" REJECTED: tool "${activeTool}" is still running. ` +
          `This server executes ONE tool at a time. Emit exactly one tool call, ` +
          `wait for its result, then send the next.`,
  }],
  isError: true,
});

/** Log line for a call, with typed values masked so passwords never reach the log. */
function describeCall(name: string, args: Record<string, unknown>): string {
  const safe = name === 'fill' && typeof args.value === 'string'
    ? { ...args, value: `<${args.value.length} chars>` }
    : args;
  return `${name} ${JSON.stringify(safe)}`;
}

class ToolTimeoutError extends Error {}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return work;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ToolTimeoutError()), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build a fully wired MCP Server instance.
 * Each transport connection gets its own Server; they all share the
 * singleton browserManager, so the browser session persists across clients.
 */
export function createServer(): Server {
  const server = new Server(
    { name: 'playwright-mcp', version: VERSION },
    { capabilities: { tools: {} } }
  );

  // ── List tools ────────────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(t => t.definition) as any,
  }));

  // ── Call tools ────────────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    console.error(`[playwright-mcp] tool call: ${describeCall(name, args)}`);

    const handler = HANDLERS.get(name);
    if (!handler) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}. Available: ${[...HANDLERS.keys()].join(', ')}` }],
        isError: true,
      };
    }
    if (activeTool) {
      console.error(`[playwright-mcp] REJECTED ${name} (busy with ${activeTool})`);
      return BUSY_ERROR(name);
    }
    activeTool = name;

    try {
      const result = await withTimeout(handler(args), config.toolTimeoutMs);
      if (result instanceof RichResult) {
        return {
          content: [
            { type: 'text', text: JSON.stringify(result.json, null, 2) },
            ...result.images.map(img => ({ type: 'image' as const, data: img.data, mimeType: img.mimeType })),
          ],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };

    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : String(err);
      if (err instanceof ToolTimeoutError) {
        // The underlying Playwright call may still be running; closing the
        // browser is the only reliable way to cancel it before the next call.
        await browserManager.close();
        message = `timed out after ${config.toolTimeoutMs} ms. The browser was reset — ` +
                  `call navigate again before continuing.`;
      } else if (!(err instanceof ToolInputError)) {
        // Playwright errors carry a long call log; the first lines say what happened
        message = message.split('\n').slice(0, 4).join('\n');
      }
      console.error(`[playwright-mcp] ${name} failed: ${message.split('\n')[0]}`);
      return {
        content: [{ type: 'text', text: `Tool "${name}" failed: ${message}` }],
        isError: true,
      };
    } finally {
      activeTool = null;
    }
  });

  return server;
}

/** Close the browser before exiting so no orphaned browser processes are left behind. */
export function installShutdownHandlers() {
  let shuttingDown = false;
  const shutdown = async (reason: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`[playwright-mcp] shutting down (${reason})`);
    await browserManager.close();
    process.exit(0);
  };
  process.on('SIGINT',  () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  return shutdown;
}

// ── Start (stdio) ────────────────────────────────────────────────────────────
async function main() {
  const shutdown = installShutdownHandlers();
  const transport = new StdioServerTransport();
  // The host closing our stdin means the session is over
  process.stdin.on('close', () => void shutdown('stdin closed'));
  await createServer().connect(transport);
  console.error(`[playwright-mcp] v${VERSION} running on stdio (${config.browser}, headless=${config.headless})`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[playwright-mcp] Fatal error:', err);
    process.exit(1);
  });
}
