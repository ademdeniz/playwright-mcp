# playwright-mcp

> An MCP server that gives Claude direct control of a real browser via Playwright — enabling AI-driven web testing, autonomous test execution, and live failure analysis through natural language.

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![Playwright](https://img.shields.io/badge/Playwright-1.43+-green?logo=playwright)
![MCP](https://img.shields.io/badge/MCP-stdio%20%7C%20HTTP%20%7C%20SSE-purple)
![CI](https://github.com/ademdeniz/playwright-mcp/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What It Does

Connect this server to Claude Desktop or Cursor and Claude gains the ability to:

- Navigate to any URL and read the full page state
- Click elements, fill forms, pick dropdown options, press keys, and submit data
- Wait for slow content instead of guessing with sleeps
- Take screenshots it can actually see (returned as images, not base64 text)
- Read console errors, uncaught exceptions, and failed network requests
- Assert expected conditions — with auto-retry, pass/fail with the actual value
- Analyze failures autonomously without you touching a test script

It ships with two portable QA skills ([`skills/`](skills/)) that work with this
server **or** Microsoft's `@playwright/mcp`: one runs written test scenarios and
reports a PASS/FAIL table with a root cause, the other turns a verified run into a
Playwright spec that follows your repo's conventions.

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
                       │ MCP (stdio, Streamable HTTP, or SSE)
┌──────────────────────▼───────────────────────────────┐
│               playwright-mcp server                   │
│                                                       │
│  Tools:                                               │
│   navigate       → page.goto(url)                    │
│   get_page_state → text + elements + errors          │
│   screenshot     → page.screenshot() → image         │
│   click / fill   → locator.click() / .fill()         │
│   select_option  → locator.selectOption()            │
│   press_key      → keyboard.press()                  │
│   wait_for       → element / text / URL              │
│   evaluate       → page.evaluate(js)                 │
│   assert         → 9 assertion types, auto-retry     │
│   close_browser  → browser.close()                   │
└──────────────────────┬───────────────────────────────┘
                       │ Playwright CDP
┌──────────────────────▼───────────────────────────────┐
│      Chromium / Firefox / WebKit (headless)           │
└──────────────────────────────────────────────────────┘
```

---

## Tools

| Tool | Description |
|---|---|
| `navigate` | Go to a URL, returns title, final URL, status code; resets the error log |
| `get_page_state` | Title, URL, visible text, interactive elements **with ready-to-use selectors**, console errors, uncaught exceptions, failed requests |
| `screenshot` | Capture viewport, full page, or one element — returned as an image; optional save |
| `click` | Click by CSS selector or visible text; follows links that open a new tab |
| `fill` | Type into input fields (password values are never echoed back or logged) |
| `select_option` | Choose a `<select>` option by value, label, or index |
| `press_key` | Press `Enter`, `Escape`, `Tab`, chords like `Control+A` |
| `wait_for` | Wait for an element state, visible text, or URL |
| `set_viewport` | Resize the viewport (e.g. 320 px wide for mobile layout and reflow checks); reports horizontal scrolling |
| `evaluate` | Run JavaScript in the page context (can be disabled) |
| `assert` | `title_contains`, `url_contains`, `text_visible`, `text_absent`, `element_exists`, `element_visible`, `element_hidden`, `input_value`, `element_count` — retries up to 5 s by default |
| `close_browser` | Close browser and release resources |

Only visible elements are targeted, so hidden duplicates (mobile menus,
templates) don't cause timeouts.

---

## Setup

### Prerequisites
- Node.js 20+
- Claude Desktop or any MCP-compatible host

### Install

```bash
git clone https://github.com/ademdeniz/playwright-mcp.git
cd playwright-mcp
npm install
npm run install-browsers   # downloads Chromium
npm run build
```

### Connect to Claude Code

```bash
claude mcp add playwright -- node /absolute/path/to/playwright-mcp/dist/server.js
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

## QA Agent Setup (LibreChat + SSE)

> Day-to-day operations (start, stop, health checks, logs) are collected in
> [COMMANDS.md](COMMANDS.md). The complete agent recipe (endpoint, model
> parameters, instructions, skills) is in
> [examples/qa-agent-setup.md](examples/qa-agent-setup.md).

Beyond stdio hosts, this server ships an **SSE transport** so Docker-hosted MCP
clients — like a self-hosted [LibreChat](https://www.librechat.ai/) — can drive
the browser over HTTP. This powers a full **AI QA Engineer agent**: a chat UI
where you type test steps in plain English and watch them execute against a
real browser, with tunable model parameters, reusable skills, and a local
audit log of every tool call.

### Run the HTTP server

```bash
npm run start:sse          # http://127.0.0.1:8931 — /mcp, GET /sse, POST /messages, GET /health
PORT=9000 npm run start:sse
```

It serves both **Streamable HTTP** (`/mcp`, the current MCP spec) and legacy
**SSE** (`/sse`). It listens on `127.0.0.1` only by default. Docker containers
can't reach that, so for LibreChat see [Securing the HTTP server](#securing-the-http-server).

### Register in LibreChat (`librechat.yaml`)

```yaml
mcpSettings:
  allowedAddresses:        # SSRF exemption for the host-mapped address
    - 'host.docker.internal:8931'

mcpServers:
  playwright:
    type: sse
    url: http://host.docker.internal:8931/sse
    timeout: 300000
    headers:                 # only when PLAYWRIGHT_MCP_TOKEN is set (recommended)
      Authorization: "Bearer ${PLAYWRIGHT_MCP_TOKEN}"
```

Then build an agent in LibreChat's Agent Builder: attach the `playwright` MCP
tools, paste [`examples/librechat-agent-instructions.md`](examples/librechat-agent-instructions.md)
into the Instructions field, and add the skills: the generic ones from
[`skills/`](skills/) plus the app-specific ones from
[`examples/skills/`](examples/skills/) (app selector map, repo conventions) and
the scenarios in [`examples/scenarios/`](examples/scenarios/).

### Model notes (learned the hard way)

- **Context window matters**: Ollama defaults to 4096 tokens, which silently
  truncates tool schemas — the model then hallucinates Selenium code instead of
  calling tools. Run `OLLAMA_CONTEXT_LENGTH=8192 ollama serve` minimum.
- **Thinking models stall**: qwen3-style reasoning burns minutes of monologue
  per tool call on modest hardware. Use a non-thinking instruct variant, or a
  fast cloud endpoint (Groq / Gemini free tiers) for the agent brain while the
  browser and tests stay local.
- **Some models batch tool calls**: llama-3.3 emits all steps at once, which
  arrive in scrambled order. The server rejects concurrent calls with an
  instructive error so such clients recover by re-issuing steps one at a time.

### Hardening built into the server

- **Per-call timeout** — a call that hangs (e.g. an infinite loop in `evaluate`)
  is cut off after 60 s and the browser is reset, so the server never wedges
- **Crash recovery** — a crashed or closed browser is relaunched on the next call
- **Auto-retrying asserts** — checks wait for the page to settle instead of
  failing on the first look
- **Clear argument errors** — a missing selector returns a message the model
  can act on, not a stack trace
- **Clean shutdown** — the browser is closed on exit, so no orphaned processes
- **One tool at a time** — concurrent calls are rejected, not queued, so a
  stray `close_browser` can never execute mid-scenario
- **Launch lock** — concurrent `getPage()` calls share one Chromium launch
  instead of racing several
- **Token-lean page state** — `get_page_state` caps text and element output,
  since agent loops re-pay for every past tool result on each round
- **Call logging** — every tool call is logged with its arguments; when the
  client's transcript and reality disagree, the server log is ground truth

---

## Configuration

All options are environment variables. Put them in the `env` block of your MCP
client config, or prefix the start command.

| Variable | Default | Purpose |
|---|---|---|
| `PLAYWRIGHT_MCP_BROWSER` | `chromium` | `chromium`, `firefox`, or `webkit` (install with `npx playwright install <name>`) |
| `PLAYWRIGHT_MCP_HEADLESS` | `true` | `false` shows the browser window — handy for watching a run |
| `PLAYWRIGHT_MCP_VIEWPORT` | `1280x800` | Viewport size, `WIDTHxHEIGHT` |
| `PLAYWRIGHT_MCP_USER_AGENT` | browser default | Override the user agent |
| `PLAYWRIGHT_MCP_TOOL_TIMEOUT_MS` | `60000` | Hard limit per tool call; on timeout the browser is reset |
| `PLAYWRIGHT_MCP_OUTPUT_DIR` | `<tmp>/playwright-mcp` | Screenshots can only be saved inside this directory |
| `PLAYWRIGHT_MCP_SCREENSHOT_IMAGE` | `true` | `false` returns screenshot metadata only (for text-only models) |
| `PLAYWRIGHT_MCP_DISABLE_EVALUATE` | `false` | `true` removes the `evaluate` tool |
| `PLAYWRIGHT_MCP_ALLOW_FILE_URLS` | `false` | `true` allows `navigate` to `file://` URLs |
| `PLAYWRIGHT_MCP_USER_DATA_DIR` | — | Persistent browser profile folder: cookies and SSO logins survive `close_browser` and restarts (see below) |
| `PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS` | `false` | `true` accepts self-signed / internal certificates. Test environments only |
| `HOST` / `PORT` | `127.0.0.1` / `8931` | HTTP server bind address and port |
| `PLAYWRIGHT_MCP_TOKEN` | — | HTTP server: require `Authorization: Bearer <token>` |
| `PLAYWRIGHT_MCP_ALLOW_NO_AUTH` | `false` | HTTP server: allow a non-localhost bind without a token |

---

## Testing behind SSO (company environments)

The agent never types your SSO credentials: **you** log in once, in a visible
browser, and the server keeps that session.

1. Register the server with a visible browser and a persistent profile:

   ```bash
   claude mcp add --scope user playwright \
     -e PLAYWRIGHT_MCP_HEADLESS=false \
     -e PLAYWRIGHT_MCP_USER_DATA_DIR=~/.playwright-mcp/profile \
     -- node /absolute/path/to/playwright-mcp/dist/server.js
   ```

   Add `-e PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS=true` if your preview/test
   environments use internal certificates the browser doesn't trust.
2. Ask the agent to open your environment (e.g. a preview URL). When it lands
   on the SSO page, log in yourself in the browser window it opened, then tell
   the agent to continue.
3. The SSO session is stored in the profile. Later sessions — and other
   preview environments behind the same identity provider — usually go straight
   through without logging in again, until your company's SSO session expires.

Notes:

- **One session per profile.** A visible browser locks its profile, so a second
  session on the same folder gets a clear error. Give parallel sessions their
  own folder (`…/profile-2`). Headless browsers don't lock it, so don't share a
  profile between headless sessions either.
- **The profile holds live login cookies.** Keep it in your home folder, never
  in a repository, and delete it (`rm -rf ~/.playwright-mcp/profile`) to log out
  everywhere.
- Use test or preview environments and test accounts — not production.

---

## Securing the HTTP server

Whoever can reach the HTTP server can drive the browser and run JavaScript in
it, so it is locked down by default:

- **Localhost only.** It binds `127.0.0.1` and rejects requests whose `Host` or
  `Origin` header isn't localhost, which blocks DNS-rebinding attacks from web
  pages you visit.
- **Token for anything wider.** Binding another address (e.g. `HOST=0.0.0.0` for
  Docker) is refused unless you set a token:

  ```bash
  export PLAYWRIGHT_MCP_TOKEN="$(openssl rand -hex 32)"
  HOST=0.0.0.0 npm run start:sse
  ```

  Clients then send `Authorization: Bearer <token>` (see the LibreChat
  `headers` example above; LibreChat reads `${PLAYWRIGHT_MCP_TOKEN}` from its
  own `.env`).
- **Opting out** on a fully trusted network: `PLAYWRIGHT_MCP_ALLOW_NO_AUTH=1`.
  [`scripts/start-stack.sh`](scripts/start-stack.sh) uses the token when it's
  exported and falls back to this with a warning.

The stdio transport has no network surface and needs none of this.

---

## Skills

[`skills/`](skills/) holds portable skills in the open
`SKILL.md` format for Claude Code, Cursor, Copilot, and other agents. Each
works with this server or Microsoft's [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp):

| Skill | What it does |
|---|---|
| [`regression-scenarios`](skills/regression-scenarios/SKILL.md) | Runs written scenarios (smoke, regression, ad-hoc steps), classifies each failure (product defect, expected rejection, test issue, environment), and reports a PASS/FAIL table with evidence |
| [`write-playwright-test`](skills/write-playwright-test/SKILL.md) | Turns a verified run into a Playwright Test spec that follows the repo's own page objects, fixtures, tags, and locator style |

Install in Claude Code by copying a folder into `~/.claude/skills/` (all
projects) or `.claude/skills/` (one project):

```bash
cp -r skills/regression-scenarios skills/write-playwright-test ~/.claude/skills/
```

App-specific examples — a selector map, repo conventions, and scenarios for
the-internet.herokuapp.com — are in [`examples/`](examples/).

---

## Development

```bash
npm test     # builds, then runs the end-to-end suite against local fixture pages
```

The suite drives a real Chromium through the MCP protocol (stdio, Streamable
HTTP, and SSE), including the auth rules above. CI runs it on Node 20 and 22.

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
│   ├── server.ts              # MCP server — tool registry, one-at-a-time execution, timeouts, call log
│   ├── sse.ts                 # HTTP transport — Streamable HTTP + SSE, localhost/token auth
│   ├── browser.ts             # BrowserManager — launch lock, crash recovery, tabs, diagnostics
│   ├── config.ts              # environment-variable configuration
│   └── tools/
│       ├── navigate.ts        # page.goto()
│       ├── getPageState.ts    # text + elements with selectors + errors (token-lean)
│       ├── screenshot.ts      # page/element screenshot → image content
│       ├── click.ts           # locator.click() — selector preferred over text
│       ├── fill.ts            # locator.fill()
│       ├── selectOption.ts    # locator.selectOption()
│       ├── pressKey.ts        # keyboard.press()
│       ├── waitFor.ts         # wait for element / text / URL
│       ├── setViewport.ts     # page.setViewportSize()
│       ├── evaluate.ts        # page.evaluate(js)
│       ├── assert.ts          # 9 assertion types, auto-retry
│       ├── closeBrowser.ts    # browser.close()
│       └── util.ts            # shared helpers
├── skills/                    # portable SKILL.md skills (work with either Playwright MCP)
├── test/                      # end-to-end tests against local fixture pages
├── examples/
│   ├── claude_desktop_config.json
│   ├── librechat-agent-instructions.md   # QA agent system prompt for LibreChat
│   ├── skills/                # app-specific skills — the-internet selector map, playwright-e2e conventions
│   ├── scenarios/             # example scenario file for the regression-scenarios skill
│   ├── login_flow.md
│   └── failure_analysis.md
├── LICENSE
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
- [ ] Multi-tab control (new tabs are followed automatically today)
- [x] `wait_for` tool — wait for element, text, or URL

---

## Author

**Adem Garic** — SDET / QA Engineer
6+ years in mobile and web test automation (Appium, Selenium, Playwright, Jenkins, BrowserStack)
[LinkedIn](https://linkedin.com/in/adem-garic-sdet-qa) · [GitHub](https://github.com/ademdeniz)
