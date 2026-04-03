# playwright-mcp

> An MCP server that gives Claude direct control of a real browser via Playwright — enabling AI-driven web testing, autonomous test execution, and live failure analysis through natural language.

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![Playwright](https://img.shields.io/badge/Playwright-1.43+-green?logo=playwright)
![MCP](https://img.shields.io/badge/MCP-stdio-purple)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What It Does

Connect this server to Claude Desktop or Cursor and Claude gains the ability to:

- Navigate to any URL and read the full page state
- Click elements, fill forms, and submit data
- Take screenshots and attach them to its reasoning
- Run arbitrary JavaScript in the page context
- Assert expected conditions — pass/fail with full context
- Analyze failures autonomously without you touching a test script

**Example prompt to Claude:**
> *"Test the login flow on the-internet.herokuapp.com. Use username 'tomsmith' and password 'SuperSecretPassword!'. Verify the success message and take a screenshot."*

Claude will navigate, fill the form, click submit, assert the result, and take a screenshot — all without you writing a single line of test code.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│              Claude Desktop / Cursor                  │
│                                                       │
│   "Test the login flow on example.com"                │
└──────────────────────┬───────────────────────────────┘
                       │ MCP (stdio)
┌──────────────────────▼───────────────────────────────┐
│               playwright-mcp server                   │
│                                                       │
│  Tools:                                               │
│   navigate       → page.goto(url)                    │
│   get_page_state → title + text + elements + errors  │
│   screenshot     → page.screenshot() → base64        │
│   click          → locator.click()                   │
│   fill           → locator.fill(value)               │
│   evaluate       → page.evaluate(js)                 │
│   assert         → built-in assertions (8 types)     │
│   close_browser  → browser.close()                   │
└──────────────────────┬───────────────────────────────┘
                       │ Playwright CDP
┌──────────────────────▼───────────────────────────────┐
│           Chromium (headless)                         │
└──────────────────────────────────────────────────────┘
```

---

## Tools

| Tool | Description |
|---|---|
| `navigate` | Go to a URL, returns title + status code |
| `get_page_state` | Read title, URL, visible text, interactive elements, console errors |
| `screenshot` | Capture full page or specific element as base64 PNG |
| `click` | Click by CSS selector or visible text |
| `fill` | Type into input fields |
| `evaluate` | Run JavaScript in the page context |
| `assert` | Verify title, URL, text, element presence/absence, input values |
| `close_browser` | Close browser and release resources |

---

## Setup

### Prerequisites
- Node.js 18+
- Claude Desktop or any MCP-compatible host

### Install

```bash
git clone https://github.com/ademdeniz/playwright-mcp.git
cd playwright-mcp
npm install
npm run install-browsers   # downloads Chromium
npm run build
```

### Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": ["/absolute/path/to/playwright-mcp/dist/server.js"]
    }
  }
}
```

Restart Claude Desktop. You'll see a 🔌 icon showing the server is connected.

### Connect to Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": ["/absolute/path/to/playwright-mcp/dist/server.js"]
    }
  }
}
```

---

## Example Flows

### Login test
```
You: "Test login on https://the-internet.herokuapp.com/login
      with tomsmith / SuperSecretPassword!"

Claude: navigate → fill username → fill password → click Login
        assert text_visible "You logged into a secure area!" → ✓ PASSED
        screenshot → saved to screenshots/login_success.png
```

### Broken image analysis
```
You: "Check https://the-internet.herokuapp.com/broken_images
      and tell me which images failed to load"

Claude: navigate → get_page_state → evaluate (check naturalWidth)
        "2 of 3 images are broken — both return 404.
         Root cause: server paths do not exist."
```

### Form validation
```
You: "Submit the contact form on example.com with empty fields
      and verify the validation errors appear"

Claude: navigate → click Submit → get_page_state
        assert element_exists ".error-message" → ✓
        assert text_visible "This field is required" → ✓
```

---

## Project Structure

```
playwright-mcp/
├── src/
│   ├── server.ts              # MCP server — registers tools, handles requests
│   ├── browser.ts             # BrowserManager — single browser/page lifecycle
│   └── tools/
│       ├── navigate.ts        # page.goto()
│       ├── getPageState.ts    # title + text + elements + errors
│       ├── screenshot.ts      # page/element screenshot → base64
│       ├── click.ts           # locator.click() by selector or text
│       ├── fill.ts            # locator.fill()
│       ├── evaluate.ts        # page.evaluate(js)
│       ├── assert.ts          # 8 assertion types
│       └── closeBrowser.ts    # browser.close()
├── examples/
│   ├── claude_desktop_config.json
│   ├── login_flow.md
│   └── failure_analysis.md
├── package.json
└── tsconfig.json
```

---

## Related Projects

This server is part of a broader AI-powered QA tooling portfolio:

- **[appium-ai-agent](https://github.com/ademdeniz/appium-ai-agent)** — same MCP pattern for iOS/Android mobile test automation
- **[flaky-guard](https://github.com/ademdeniz/flaky-guard)** — detect and score flaky tests from JUnit XML
- **[self-healing-locator](https://github.com/ademdeniz/self-healing-locator)** — automatic locator fallback chains for Selenium

---

## What's Next

- [ ] Trace recording — capture Playwright traces for failed sessions
- [ ] Network interception — mock API responses mid-test
- [ ] Multi-tab support
- [ ] `wait_for` tool — wait for element, URL, or network idle

---

## Author

**Adem Garic** — SDET / QA Engineer
4+ years in mobile and web test automation (Appium, Selenium, Jenkins, BrowserStack)
[LinkedIn](https://linkedin.com/in/adem-garic-sdet-qa) · [GitHub](https://github.com/ademdeniz)
