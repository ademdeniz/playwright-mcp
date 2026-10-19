# QA Engineer Agent — Complete Setup Reference

The full recipe for the LibreChat agent that drives this MCP server. Five layers,
each with a distinct job:

```
Endpoint (which brains are available)
  └─ Agent (name, model, parameters)
       └─ Instructions (always-loaded behavior rules)
            └─ Skills (on-demand knowledge packs)
                 └─ MCP tools (the 12 browser tools from this server)
```

## 1. Endpoint — librechat.yaml

Multiple providers can coexist; the agent picks one. Working examples:

```yaml
endpoints:
  custom:
    - name: "Groq"                     # free tier, fast llama / gpt-oss
      apiKey: "user_provided"
      baseURL: "https://api.groq.com/openai/v1"
      dropParams: ["reasoning_effort", "reasoning_summary", "verbosity", "frequency_penalty", "presence_penalty"]
      addParams:
        parallel_tool_calls: false
      models:
        default: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"]
        fetch: true
```

Anthropic is a built-in endpoint: set `ANTHROPIC_API_KEY` in `.env` (or enter it
per-user in the UI) and it appears as a provider automatically.

Lessons encoded above:
- `dropParams` strips parameters some models reject (llama 400s on `reasoning_effort`)
- `parallel_tool_calls: false` asks the model not to batch tool calls
  (the server also enforces this — defense in depth)

## 2. Agent — Agent Builder

- **Name**: QA Engineer
- **Model**: pick per your budget/quality needs. Observed behavior across brains:
  - `claude-opus` class: best sequencing and failure diagnosis, paid
  - `openai/gpt-oss-120b` (Groq free): disciplined tool caller, good default
  - `llama-3.3-70b` (Groq free): fast but batches tool calls; needs the guardrails
  - local 4b models (Ollama): workable for demos only; see README "Model notes"
- **Tools**: attach the `playwright` MCP server (all 12 tools)

## 3. Model parameters (values that work, and why)

| Parameter | Value | Why |
|---|---|---|
| Temperature | 0.1–0.2 | Test execution wants determinism, not creativity |
| Top P | 0.7–0.85 | Trims the low-probability tail that invents selectors |
| Top K (Anthropic) | 5 | Same goal, harder cap |
| Frequency/Presence penalty | 0.00 | Never negative — negative values reward repeating (loops) |
| Prompt caching (Anthropic) | ON | Agent loops resend instructions + tools every round; caching makes rounds cheap and fast |
| Thinking (Anthropic) | ON, budget ~2000 | Bounded reasoning helps planning without the unbounded monologue problem |
| Reasoning params (for non-reasoning models) | Unset | Models that don't support them return 400 |
| Max context/output | default | Page states are big; don't cap artificially |

## 4. Instructions

Paste from [`librechat-agent-instructions.md`](librechat-agent-instructions.md).
Key design principles, learned on small models and kept for all models:

- **One tool call per response** — stated in instructions AND enforced by the server
- **Lookup-table style rules** ("a fill step = one fill call"), not judgment calls —
  removes deliberation loops
- **close_browser strictly last** — a mid-run close kills the session
- **Selector over text for clicks** — precise beats fuzzy

## 5. Skills (reusable knowledge packs)

Name + Description + Instructions per skill. The Description is the trigger:
it's how the model decides when to pull the skill in.

| Skill | Source | Contents | Why it exists |
|---|---|---|---|
| `regression-scenarios` | [`skills/`](../skills/regression-scenarios/SKILL.md) | How to run scenarios, failure classes, report format | "Run AUTH-1" just works, failures get a root cause |
| `write-playwright-test` | [`skills/`](../skills/write-playwright-test/SKILL.md) | Locator priority, step → Playwright mapping, delivery checklist | "Write this as a test" produces committable specs |
| `the-internet-app-map` | [`examples/skills/`](skills/the-internet-app-map.md) | Verified URLs, selectors, credentials, expected messages | Kills selector hallucination — answers are in context |
| `playwright-e2e-conventions` | [`examples/skills/`](skills/playwright-e2e-conventions.md) | playwright-e2e repo: POM, fixtures, tags | Specs match that repo exactly |
| `the-internet` scenarios | [`examples/scenarios/`](scenarios/the-internet.md) | AUTH-1..3, UI-1..2 | The runbooks `regression-scenarios` executes |

Split rationale: **Instructions = always-loaded behavior. Skills = on-demand
knowledge.** The two generic skills never change; a new target app needs only a
new app map and scenario file, agent untouched.

## Validation: what a healthy run looks like

Positive test (AUTH-1, valid credentials): every step PASS, verdict PASSED.

Negative test (wrong username on purpose):

```
Step  Action                                          Result
1     Navigate to /login                              PASS
2     Fill #username = "jhondoe"                      PASS
3     Fill #password = "SuperSecretPassword!"         PASS
4     Click Login button                              PASS
5     Assert url_contains "/secure"                   FAIL
6     Assert text_visible "You logged into a..."      FAIL
7     Close browser                                   PASS
Verdict: FAILED — login rejected with "Your username is invalid!"
```

This is the important capability: the agent distinguishes "my actions failed"
(steps 1–4 would fail) from "the app correctly rejected the input" (asserts fail,
actions pass) and reports the actual error message as the root cause.

## Troubleshooting quick hits

- Agent writes code instead of calling tools → tool schemas truncated (context
  too small) or agent has no tools attached
- `400 reasoning_effort not supported` → stale reasoning params; Reset Model
  Parameters or add to `dropParams`
- `429 rate limit` → free-tier TPM exhausted; wait 60s, switch model bucket, or
  trim context (fewer skills attached)
- Tool calls arrive scrambled / REJECTED lines in server log → model is batching;
  the server rejection recovers it, but a better model fixes it at the source
- UI transcript looks fine but run failed → read `/tmp/mcp-sse.log`; the server
  log is ground truth
- `401` / `403` in the server log → token mismatch, or the server is bound to
  localhost; check `HOST` and `PLAYWRIGHT_MCP_TOKEN` (README "Securing the HTTP server")
- Model can't make sense of screenshots / errors on a text-only model → set
  `PLAYWRIGHT_MCP_SCREENSHOT_IMAGE=false`
