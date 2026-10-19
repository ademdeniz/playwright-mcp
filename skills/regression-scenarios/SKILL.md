---
name: regression-scenarios
description: Execute written browser test scenarios (smoke, regression, or ad-hoc numbered steps) against a live web app with a Playwright browser MCP server, then report a per-step PASS/FAIL table with evidence and a root-cause verdict. Use when asked to "run the smoke suite", "run regression", "run scenario AUTH-1", "test this flow in the browser", or to verify a bug fix or deployment by clicking through the app.
---

# Run browser regression scenarios

You execute test scenarios in a real browser through an MCP server and report
results a QA lead can trust. You never write test code in this skill — you
drive the browser, observe, and report. (To turn a verified run into a spec
file, use the `write-playwright-test` skill.)

## 1. Identify the browser tools you have

This skill works with either server. Check your tool list once, then use the
matching column for the whole run.

| Action | playwright-mcp (ademdeniz) | @playwright/mcp (Microsoft) |
|---|---|---|
| Open URL | `navigate` `{url}` | `browser_navigate` `{url}` |
| Read page | `get_page_state` (gives CSS selectors) | `browser_snapshot` (gives element `target` refs) |
| Click | `click` `{selector}` | `browser_click` `{element, target}` |
| Type | `fill` `{selector, value}` | `browser_type` `{element, target, text}` |
| Dropdown | `select_option` `{selector, value\|label}` | `browser_select_option` `{element, target, values}` |
| Key press | `press_key` `{key, selector?}` | `browser_press_key` `{key}` |
| Wait | `wait_for` `{selector\|text\|urlContains}` | `browser_wait_for` `{text\|textGone\|time}` |
| Verify | `assert` `{type, selector?, expected}` — retries 5 s | `browser_verify_*` if enabled, else `browser_snapshot` and compare |
| Errors | `consoleErrors` / `pageErrors` / `failedRequests` in `get_page_state` | `browser_console_messages`, `browser_network_requests` |
| Evidence | `screenshot` `{savePath?}` | `browser_take_screenshot` |
| Finish | `close_browser` | `browser_close` |

With Microsoft's server, element refs (`target`) change whenever the page
changes: take a fresh `browser_snapshot` after every navigation or click that
updates the page, and never reuse a ref from an older snapshot.

## 2. Find the scenarios

In order of preference:

1. Scenario IDs the user named (e.g. `AUTH-1`) → look them up in the project's
   scenario file (commonly `scenarios.md`, `qa/scenarios/*.md`, or an app-map
   skill). If the ID can't be found, say so and stop — never invent steps.
2. Numbered steps the user pasted → run them literally.
3. A plain-language request ("check checkout works") → write the steps you will
   run as a short numbered list first, then execute them.

The scenario format is documented in
[references/scenario-format.md](references/scenario-format.md).

## 3. Execution rules

- **One tool call at a time.** Wait for each result before the next call. The
  browser is shared state; parallel calls race each other.
- **Read before you act.** After every navigation, read the page once. Use
  selectors/refs that appear in that output — never guess a selector.
- **Prefer stable targets**: id, `data-testid`, `name`, or label over text or
  long CSS chains. Use visible text only when nothing stable exists.
- **No fixed sleeps.** For slow content use `wait_for` / `browser_wait_for`
  with the expected text or element. (Use a timed wait only as a last resort.)
- **Every expected result becomes an explicit check.** Don't mark a step PASS
  because nothing errored — verify the URL, text, or element the step expects.
- **On a failed action**: read the page once, retry once with a corrected
  target, then mark the step FAILED and continue with the remaining steps
  unless they depend on it (mark those BLOCKED).
- **On a failed check**: take a screenshot and capture console errors and failed
  requests before moving on. That is the evidence for the report.
- **Close the browser only after the last step** of the last scenario.
- **Never enter real credentials** that the user or scenario file did not give
  you, and never submit payments, deletions, or messages on production systems
  unless the scenario explicitly says to.

## 4. Classify every failure

Telling these apart is the point of the run:

| Class | Meaning | Typical signal |
|---|---|---|
| **Product defect** | Actions worked; the app behaved wrong | Checks fail, page shows an error message, 5xx in failed requests |
| **Expected rejection** | Negative test — the app correctly refused | Checks for the error message pass |
| **Test issue** | The scenario is out of date | Selector not found but the feature is visibly present under a new name |
| **Environment** | Can't reach or load the app | Navigation fails, timeouts, DNS errors, 502/503 |

## 5. Report

Report each scenario like this, then one overall line:

```
Scenario AUTH-1 · Valid login (@smoke)
Step  Action                                        Result
1     Navigate /login                               PASS
2     Fill username                                 PASS
3     Fill password                                 PASS
4     Click Login                                   PASS
5     Check URL contains /secure                    FAIL  (got /login)
6     Check text "You logged into a secure area!"   FAIL  (got "Your password is invalid!")
Verdict: FAILED — Test issue: the scenario's stored password is out of date.
Evidence: screenshots/auth-1-step5.png · console: none · failed requests: none

Overall: 4 scenarios · 3 passed · 1 failed (AUTH-1, test issue)
```

Keep the verdict to one line with the root cause in plain words. Quote the
actual on-screen message when there is one — it is usually the diagnosis.
