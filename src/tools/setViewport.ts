import { browserManager } from '../browser.js';
import { ToolInputError } from './util.js';

export const setViewportTool = {
  name: 'set_viewport',
  description: 'Resize the browser viewport, e.g. 320x800 to check mobile layout and reflow (WCAG 1.4.10), or 1280x800 to return to desktop. Applies to the current page immediately.',
  inputSchema: {
    type: 'object',
    properties: {
      width:  { type: 'number', description: 'Viewport width in CSS pixels (200–3840)' },
      height: { type: 'number', description: 'Viewport height in CSS pixels (200–2160)' },
    },
    required: ['width', 'height'],
  },
} as const;

export async function setViewport(args: { width?: number; height?: number }) {
  const { width, height } = args;
  if (typeof width !== 'number' || typeof height !== 'number'
      || width < 200 || width > 3840 || height < 200 || height > 2160) {
    throw new ToolInputError('set_viewport: "width" (200–3840) and "height" (200–2160) are required numbers.');
  }
  const page = await browserManager.getPage();
  await page.setViewportSize({ width: Math.round(width), height: Math.round(height) });

  // Horizontal scrolling at narrow widths is the usual reflow failure
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  return {
    viewport: { width: Math.round(width), height: Math.round(height) },
    pageScrollWidth: scrollWidth,
    horizontalScroll: scrollWidth > Math.round(width),
  };
}
