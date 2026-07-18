---
name: regression-scenarios
description: Canonical executable scenarios for the-internet.herokuapp.com, mirroring the playwright-e2e suite. Use when asked to "run the smoke suite", "run regression", or execute a named scenario.
---

# Executable regression scenarios

Run these step-by-step with the playwright MCP tools. Report a per-step pass/fail
table at the end of each scenario and call `close_browser` when the run is finished.

## AUTH-1 · Valid login (@smoke)

1. `navigate` → https://the-internet.herokuapp.com/login
2. `fill` `#username` → `tomsmith`
3. `fill` `#password` → `SuperSecretPassword!`
4. `click` `button[type="submit"]`
5. `assert` url_contains `/secure`
6. `assert` text_visible `You logged into a secure area!`

## AUTH-2 · Invalid password shows error (@smoke)

1. `navigate` → https://the-internet.herokuapp.com/login
2. `fill` `#username` → `tomsmith`
3. `fill` `#password` → `wrongpassword`
4. `click` `button[type="submit"]`
5. `assert` url_contains `/login`
6. `assert` text_visible `Your password is invalid!`

## AUTH-3 · Logout returns to login (@regression)

1. Run AUTH-1 steps 1–6
2. `click` `a[href="/logout"]`
3. `assert` url_contains `/login`
4. `assert` text_visible `You logged out of the secure area!`

## UI-1 · Dynamic loading completes (@smoke)

1. `navigate` → https://the-internet.herokuapp.com/dynamic_loading/1
2. `click` `#start button`
3. Wait, then `get_page_state` until `#finish` is present (may take ~10 s — retry
   `get_page_state`, do not re-click Start)
4. `assert` element_exists `#finish`
5. `assert` text_visible `Hello World!`

## UI-2 · Dropdown selection (@regression)

1. `navigate` → https://the-internet.herokuapp.com/dropdown
2. `evaluate` → `document.querySelector('#dropdown').value = '1'; document.querySelector('#dropdown').dispatchEvent(new Event('change'))`
3. `assert` input_value `#dropdown` expected `1`

## Reporting format

```
Scenario: AUTH-1 Valid login
  Step 1 navigate ........ PASS
  Step 2 fill username ... PASS
  ...
Verdict: PASSED (6/6 steps)
```
