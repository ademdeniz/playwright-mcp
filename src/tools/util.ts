/**
 * Helpers shared by the tool implementations.
 */

import { Locator, Page } from 'playwright';

/** Thrown for bad tool arguments; the message is written for the calling model. */
export class ToolInputError extends Error {}

export function requireString(args: Record<string, unknown>, key: string, tool: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value === '') {
    throw new ToolInputError(`${tool}: "${key}" is required and must be a non-empty string.`);
  }
  return value;
}

/** A tool result that carries images alongside its JSON payload. */
export class RichResult {
  constructor(
    public json: unknown,
    public images: { data: string; mimeType: string }[] = [],
  ) {}
}

/**
 * First *visible* match for a selector. Pages often contain hidden duplicates
 * (mobile menus, templates), and acting on those just times out.
 */
export function visible(page: Page, selector: string): Locator {
  return page.locator(selector).filter({ visible: true }).first();
}

/** Collapse whitespace so text checks don't fail on line breaks or indentation. */
export function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
