---
name: write-playwright-test
description: Turn a browser flow that was just explored or verified (through a Playwright MCP server, a scenario file, or a description) into a committable Playwright Test spec that follows the target repo's own conventions — page objects, fixtures, tags, locator style. Use when asked to "write a test for this", "generate a spec", "automate this scenario", "add this to the suite", or "convert this run into Playwright".
---

# Write a Playwright test from a verified flow

Goal: a spec that drops into the user's repo, passes on the first run, and
reads like their existing tests. Verified behavior is the input — never assert
something you did not see in the browser or the scenario.

## 1. Learn the repo before writing anything

If you can read the project, check (quickly — skim, don't audit):

- `playwright.config.*` → `testDir`, `baseURL`, projects, `testIdAttribute`
- Two or three existing specs → naming, `test.describe` use, tag style
  (`@smoke` in titles vs `{ tag: '@smoke' }`), assertion style
- Page objects (`pages/`, `page-objects/`, `pom/`, `*.page.ts`) → class shape,
  how locators are exposed (getters, readonly fields, methods)
- Custom fixtures (`fixtures/`, `test.extend`) → import path, available fixtures,
  any pre-authenticated fixture
- Auth setup (`storageState`, `global-setup`, `auth.setup.ts`)

**Follow what the repo does.** If it has page objects, add methods to the
existing one or create a new one in the same style — don't inline selectors.
If it has a logged-in fixture, use it instead of re-doing login. If there is no
repo to read, use the defaults in section 4 and say so.

## 2. Map the verified steps to Playwright

| Verified step | Playwright Test |
|---|---|
| navigate to `/path` | `await page.goto('/path')` (relative when `baseURL` is set) |
| fill field | `await page.getByLabel('Email').fill('…')` |
| click | `await page.getByRole('button', { name: 'Sign in' }).click()` |
| select option | `await page.getByLabel('Country').selectOption({ label: 'Canada' })` |
| press key | `await page.getByRole('searchbox').press('Enter')` |
| wait for text | nothing — the following `expect` auto-waits |
| URL contains | `await expect(page).toHaveURL(/\/dashboard/)` |
| text visible | `await expect(page.getByText('Welcome back')).toBeVisible()` |
| element hidden | `await expect(locator).toBeHidden()` |
| field value | `await expect(locator).toHaveValue('2')` |
| element count | `await expect(locator).toHaveCount(3)` |

## 3. Locator priority

Use the first that uniquely identifies the element:

1. `getByRole(role, { name })` — what users and assistive tech see
2. `getByLabel` / `getByPlaceholder` — form fields
3. `getByTestId` — when the repo uses test ids
4. `getByText` — static, non-interactive content
5. CSS by `#id` or `[name=…]` — when the repo already does this, or nothing above is unique

Converting from the MCP run:
- A CSS selector from `get_page_state` (e.g. `#username`) is fine if the repo uses
  CSS locators; otherwise translate it using the element's `label`/`text`
  (e.g. `getByLabel('Username')`).
- A Microsoft `browser_snapshot` line such as `button "Sign in" [ref=e12]` maps
  directly to `getByRole('button', { name: 'Sign in' })`. If
  `browser_generate_locator` is available, use it. Never put `ref=` values in a test.

Never use XPath, `nth-child` chains, generated class names (`.css-1x2y3z`), or
`page.waitForTimeout`.

## 4. Defaults when the repo has no conventions

```ts
import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('valid credentials land on the secure area', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('tomsmith');
    await page.getByLabel('Password').fill(process.env.QA_PASSWORD!);
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL(/\/secure/);
    await expect(page.getByText('You logged into a secure area!')).toBeVisible();
  });
});
```

- One behavior per test; the title states the expected outcome.
- `@smoke` for critical path, `@regression` otherwise.
- Secrets come from environment variables, never literals — unless the value
  is a published demo credential the user supplied.
- Each test sets up its own state; no ordering dependencies between tests.

## 5. Deliver

1. The target path, e.g. `tests/auth/login.spec.ts`.
2. The complete spec in one code block.
3. Any page-object or fixture changes, each as a complete file or a clear diff.
4. If you can run commands: run `npx playwright test <path>` and report the
   result. If it fails, fix the test (not the assertion's meaning) and re-run.
   If you can't run it, give the exact command for the user.
5. One line on anything you assumed (e.g. "assumed `baseURL` is set to staging").
