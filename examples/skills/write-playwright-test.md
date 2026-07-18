---
name: write-playwright-test
description: Convert an explored/verified browser scenario into a Playwright TypeScript spec matching the playwright-e2e repo conventions (Page Object Model, custom fixtures, @smoke/@regression tags). Use when asked to "write a test", "generate a spec", or "add this to the suite".
---

# Writing tests for the playwright-e2e repo

After manually verifying a scenario in the browser, produce a spec file that drops
straight into the repo. Follow these conventions exactly.

## Repo layout

- Page objects: `pages/*.ts` — classes extending `BasePage`, locators as getters
- Fixtures: `fixtures/index.ts` — exports `test` extended with `loginPage`,
  `dynamicPage`, `checkboxPage`, `dropdownPage`, and `authenticatedPage` (already logged in)
- Specs: `tests/<area>/<name>.spec.ts` where area is `auth`, `ui`, or `api`

## Rules

1. **Reuse existing page objects** (`LoginPage`, `DynamicPage`, `CheckboxPage`, `DropdownPage`)
   before writing raw locators. If the scenario needs a new page, create a new POM class
   with locators as getters — never inline selectors in the spec.
2. **Tag every test** in the title: `@smoke` for critical-path, `@regression` for the rest.
3. **Use web-first assertions** (`await expect(locator).toContainText(...)`) — never
   `waitForTimeout`, never manual sleeps. Playwright auto-waits.
4. Prefer the **custom fixtures** import when a POM fixture exists:
   ```ts
   import { test } from '../../fixtures';
   test('@smoke ...', async ({ loginPage }) => { ... });
   ```
   Use the `authenticatedPage` fixture for scenarios that start logged in.
5. No XPath. No brittle CSS chains. Stable attribute/ID selectors only.

## Template

```ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

test.describe('<Feature>', () => {
  test('@smoke <behavior being verified>', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    // actions...
    // assertions...
  });
});
```

## Output format

Return the complete spec file in one TypeScript code block, state the target path
(e.g. `tests/auth/password-reset.spec.ts`), and list any new POM methods needed.
