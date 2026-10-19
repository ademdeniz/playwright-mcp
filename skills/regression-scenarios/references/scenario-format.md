# Scenario file format

Keep scenarios in a Markdown file in the project (for example
`qa/scenarios.md`). One heading per scenario: an ID, a title, and a tag.
Steps are numbered, one action or one check each.

```markdown
## AUTH-1 · Valid login (@smoke)

Base URL: https://staging.example.com

1. Navigate → /login
2. Fill `#email` → `qa+smoke@example.com`
3. Fill `#password` → `{{QA_PASSWORD}}`
4. Click `button[type="submit"]`
5. Check URL contains `/dashboard`
6. Check text visible `Welcome back`

## AUTH-2 · Wrong password is rejected (@smoke)

1. Navigate → /login
2. Fill `#email` → `qa+smoke@example.com`
3. Fill `#password` → `not-the-password`
4. Click `button[type="submit"]`
5. Check URL contains `/login`
6. Check text visible `Invalid email or password`

## CART-3 · Reuse a login (@regression)

1. Run AUTH-1
2. Navigate → /products/42
3. Click `[data-testid="add-to-cart"]`
4. Wait for text `Added to cart`
5. Check element `[data-testid="cart-count"]` has text `1`
```

## Step vocabulary

| Step | Meaning |
|---|---|
| `Navigate → <url or path>` | Paths are relative to the scenario's or file's Base URL |
| `Fill <target> → <value>` | Replace the field's content |
| `Click <target>` | |
| `Select <target> → <option label>` | Dropdowns |
| `Press <key>` | e.g. `Enter`, `Escape` |
| `Wait for text <text>` / `Wait for <target>` | Slow content — no fixed sleeps |
| `Check URL contains <text>` | |
| `Check text visible <text>` | Optionally `in <target>` |
| `Check element <target> visible / hidden` | |
| `Check element <target> has text <text>` | |
| `Check <target> value is <value>` | Form fields |
| `Run <ID>` | Execute another scenario's steps first |

## Conventions

- **Tags**: `@smoke` for the critical path that must pass on every deploy,
  `@regression` for the rest. "Run the smoke suite" means every `@smoke` scenario.
- **Targets**: prefer `#id`, `[data-testid=...]`, `[name=...]`. Write the
  visible text in quotes only when nothing stable exists: `Click "Sign in"`.
- **Secrets**: never write real passwords into the file. Use placeholders such as
  `{{QA_PASSWORD}}` and have the user provide the value at run time.
- **Expected messages**: copy them exactly from the app, including punctuation —
  checks are substring matches, so a shorter stable fragment is fine.

A complete worked example for the public demo site
<https://the-internet.herokuapp.com> lives in
[`examples/scenarios/the-internet.md`](https://github.com/ademdeniz/playwright-mcp/blob/main/examples/scenarios/the-internet.md).
