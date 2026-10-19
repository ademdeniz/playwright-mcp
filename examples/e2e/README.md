# E2E examples

Runnable Playwright specs generated from [`docs/test-plans/login.md`](../../docs/test-plans/login.md).
Self-contained: its own `package.json` and config, outside the MCP server's TypeScript build.

```bash
cd examples/e2e
npm install
npm run install-browsers
npm test            # all specs
npm run test:smoke  # P1 only
```

Point the suite at another environment with `BASE_URL=https://staging.example.com npm test`.

| Spec | Plan cases |
|---|---|
| `tests/auth/login.spec.ts` | LOGIN-1 … LOGIN-5 (all P1) |
