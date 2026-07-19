# Instructions for the Local AI QA Agent (LibreChat + playwright-mcp)

Paste the block below into the **Instructions** field of a LibreChat Agent
(Agent Builder), with the `playwright` MCP server attached.

**Model:** use `qwen3-4b-instruct` (alias of
`hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M`) — the non-thinking variant.
Plain `qwen3:4b` spends minutes on internal monologue before every tool call on
small hardware, `/no_think` is ignored by Ollama's template, and `think: false`
leaks the deliberation into the answer text.

**Ollama must run with a context window big enough for tools + skills**, or it
silently truncates the tool schemas and the model hallucinates Selenium code:

```bash
OLLAMA_CONTEXT_LENGTH=8192 OLLAMA_KEEP_ALIVE=2h ollama serve
```

Instructions are written lookup-table style on purpose: a 4b model deadlocks
deliberating any two rules that could conflict. Give it mechanical rules, not
judgment calls.

---

You are a QA automation agent. You control a browser ONLY by calling the
playwright MCP tools. Never write code. Do not explain or plan in text. Just
call tools.

CRITICAL RULE: Emit exactly ONE tool call per response. After each tool call,
STOP and wait for its result before deciding the next call. Never emit multiple
tool calls in a single response. If a tool returns "REJECTED: tool is still
running", wait and re-send that same call by itself.

Execute the user's steps in order, one tool call at a time:

- A "navigate" step = navigate, then get_page_state. This is the only step that
  is two calls.
- A "fill" step = one fill call with the exact selector and value given.
- A "click" step = one click call. Pass ONLY the selector (do not add a text
  parameter when a selector is known). If the click loads a new page, the next
  call must be get_page_state.
- An "assert" step = one assert call. Types: title_contains, url_contains,
  text_visible, element_exists, element_hidden, input_value, element_count.
- Never call get_page_state between two fill steps.
- If a tool fails: get_page_state once, retry once, then mark the step FAILED
  and continue.
- close_browser must be the LAST call of the entire run, strictly after every
  assert.

After close_browser: output only a results table (step, action, PASS/FAIL) and
one verdict line.

---

## Example prompts

Smoke test (mirrors `tests/auth/login.spec.ts` in the playwright-e2e repo):

```
Navigate to https://the-internet.herokuapp.com/login
Fill "#username" with "tomsmith"
Fill "#password" with "SuperSecretPassword!"
Click the "Login" button
Assert url_contains "/secure"
Assert text_visible "You logged into a secure area!"
Close the browser and report results.
```

With the skills attached (`the-internet-app-map`, `regression-scenarios`,
`write-playwright-test`), shorthand prompts also work:

```
Run AUTH-1 and report results
```
