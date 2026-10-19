# Test plan — Login (the-internet.herokuapp.com)

**Feature under test:** `GET/POST /login`, the authenticated `/secure` area, `GET /logout`
**Base URL:** `https://the-internet.herokuapp.com`
**Sources:** on-page instructions, plus a live walkthrough through the Playwright MCP server
(11 actions: happy path, wrong password, unknown username, empty submit, logout, direct `/secure` hit)

## Observed facts (verified live, 2026-10-19)

| Thing | Actual |
|---|---|
| Fields | `#username` (text, label "Username"), `#password` (password, label "Password") |
| Submit | `button[type="submit"]`, text "Login" |
| Valid credentials | `tomsmith` / `SuperSecretPassword!` |
| Success | 302 to `/secure`; flash `You logged into a secure area!`; page heading "Secure Area" |
| Wrong password | stays on `/login`; flash `Your password is invalid!` |
| Unknown username | stays on `/login`; flash `Your username is invalid!` |
| Empty submit | no client-side validation fires; server returns `Your username is invalid!` |
| Logout | `a[href="/logout"]` → `/login`, flash `You logged out of the secure area!` |
| `/secure` while logged out | redirects to `/login`, flash `You must login to view the secure area!` |
| Flash container | `#flash` (dismissable via the `×` link) |

## Open questions (block sign-off)

1. **Username enumeration is by design?** The app distinguishes "username is invalid" from
   "password is invalid", which tells an attacker which accounts exist. Intended demo behaviour,
   or a finding to raise? This decides whether LOGIN-3/4 assert the current text or a generic one.
2. **Is the username case-sensitive?** Not documented. Unverified in this pass.
3. **Is whitespace trimmed?** Does `" tomsmith "` authenticate?
4. **Is there any rate limiting or lockout** after N failed attempts? Nothing observed.
5. **Session lifetime / cookie flags** — expiry, `Secure`, `HttpOnly`, `SameSite` not inspected.
6. **Is there a post-login redirect target?** Hitting `/secure` while logged out loses the
   intended destination — after login you land on `/secure` by luck, not by deep-link return.
   Worth confirming whether that is expected for other protected paths.
7. **No "forgot password", "remember me", or sign-up** on the page — confirm these are out of scope.

## Case table

| ID | Case | Type | Pri | Automate? |
|---|---|---|---|---|
| LOGIN-1 | Valid credentials land on `/secure` with success flash | Acceptance | P1 | Yes — E2E |
| LOGIN-2 | `/secure` while logged out redirects to `/login` with "must login" flash | Permissions | P1 | Yes — E2E |
| LOGIN-3 | Valid username + wrong password → `Your password is invalid!`, stays on `/login` | Negative | P1 | Yes — E2E |
| LOGIN-4 | Unknown username → `Your username is invalid!` | Negative | P1 | Yes — E2E |
| LOGIN-5 | Logout returns to `/login` and the session is really dead (Back then `/secure` ⇒ login) | State | P1 | Yes — E2E |
| LOGIN-6 | Empty username and password submit → `Your username is invalid!`, no crash | Boundary | P2 | Yes — E2E |
| LOGIN-7 | Valid username, empty password → password error | Boundary | P2 | Yes — E2E |
| LOGIN-8 | Password field masks input (`type="password"`) and is not echoed in the page source | Non-func | P2 | Yes — unit/DOM |
| LOGIN-9 | Credentials are not sent in the query string (POST body only) | Security | P2 | Yes — API |
| LOGIN-10 | Username case variants (`TomSmith`, `TOMSMITH`) — behaviour matches Q2 answer | Variation | P2 | Yes — API |
| LOGIN-11 | Leading/trailing spaces in username — behaviour matches Q3 answer | Boundary | P2 | Yes — API |
| LOGIN-12 | Enter key in either field submits the form | Interrupt | P2 | Yes — E2E |
| LOGIN-13 | Browser Back after login does not show a cached `/secure` page once logged out | State | P2 | Yes — E2E |
| LOGIN-14 | Double-click Login does not produce two sessions or an error page | Interrupt | P2 | Yes — E2E |
| LOGIN-15 | Both inputs have programmatic labels and a sane tab order; flash is announced | A11y | P2 | Partly |
| LOGIN-16 | Flash `×` dismisses the message and it does not reappear on the next render | Integration | P3 | No — explore |
| LOGIN-17 | Over-long username (e.g. 5 000 chars) returns an error, not a 500 | Boundary | P3 | Yes — API |
| LOGIN-18 | SQLi / XSS payloads in username are rejected and not reflected unescaped | Security | P3 | Yes — API |
| LOGIN-19 | Rapid repeated failures — lockout or rate limit (per Q4) | Security | P3 | No — explore |
| LOGIN-20 | Login in two tabs, logout in one — the other tab's `/secure` reload redirects | Interrupt | P3 | No — explore |
| LOGIN-21 | Layout at 375×812: fields and button usable, nothing clipped | Responsive | P3 | Partly |

P1 ×5 · P2 ×10 · P3 ×6

## Executable scenarios (P1 + key P2)

### LOGIN-1 · Valid credentials land on the secure area (@smoke)

1. Navigate → `/login`
2. Fill `#username` → `tomsmith`
3. Fill `#password` → `SuperSecretPassword!`
4. Click `button[type="submit"]`
5. Check URL is `/secure`
6. Check text visible `You logged into a secure area!`
7. Check text visible `Secure Area`

### LOGIN-2 · Secure area is protected (@smoke)

1. Navigate → `/logout` (ensure clean state)
2. Navigate → `/secure`
3. Check URL is `/login`
4. Check element `#flash` has text `You must login to view the secure area!`

### LOGIN-3 · Wrong password is rejected (@smoke)

1. Navigate → `/login`
2. Fill `#username` → `tomsmith`
3. Fill `#password` → `WrongPassword!`
4. Click `button[type="submit"]`
5. Check URL is `/login`
6. Check element `#flash` has text `Your password is invalid!`
7. Check text not visible `Secure Area`

### LOGIN-4 · Unknown username is rejected (@smoke)

1. Navigate → `/login`
2. Fill `#username` → `nosuchuser`
3. Fill `#password` → `SuperSecretPassword!`
4. Click `button[type="submit"]`
5. Check element `#flash` has text `Your username is invalid!`

### LOGIN-5 · Logout ends the session (@smoke)

1. Navigate → `/login`
2. Fill `#username` → `tomsmith`
3. Fill `#password` → `SuperSecretPassword!`
4. Click `button[type="submit"]`
5. Click `a[href="/logout"]`
6. Check URL is `/login`
7. Check element `#flash` has text `You logged out of the secure area!`
8. Navigate → `/secure`
9. Check URL is `/login`
10. Check element `#flash` has text `You must login to view the secure area!`

### LOGIN-6 · Empty submit (@regression)

1. Navigate → `/login`
2. Click `button[type="submit"]`
3. Check URL is `/login`
4. Check element `#flash` has text `Your username is invalid!`
   *(Note: no HTML5 `required` attribute is present — the request reaches the server.)*

### LOGIN-7 · Valid username, empty password (@regression)

1. Navigate → `/login`
2. Fill `#username` → `tomsmith`
3. Click `button[type="submit"]`
4. Check element `#flash` has text `Your password is invalid!`

### LOGIN-12 · Enter key submits (@regression)

1. Navigate → `/login`
2. Fill `#username` → `tomsmith`
3. Fill `#password` → `SuperSecretPassword!`
4. Press key `Enter` in `#password`
5. Check URL is `/secure`

### LOGIN-13 · Back button does not resurrect the secure page (@regression)

1. Run LOGIN-5 steps 1–5 (log in, then log out)
2. Press browser Back
3. Reload the page
4. Check URL is `/login`
5. Check text not visible `Welcome to the Secure Area`

### LOGIN-14 · Double submit (@regression)

1. Navigate → `/login`
2. Fill `#username` → `tomsmith`
3. Fill `#password` → `SuperSecretPassword!`
4. Click `button[type="submit"]` twice in quick succession
5. Check URL is `/secure`
6. Check no 5xx page and exactly one success flash

## Risk statement

The highest-value risks are **authorization enforcement on `/secure`** (LOGIN-2, LOGIN-5, LOGIN-13 —
a stale cookie or cached page here is a real security defect) and **session teardown on logout**.
The error messaging is the most likely source of a reportable finding: the app deliberately
distinguishes invalid-username from invalid-password, which is username enumeration, and there is
no observed rate limiting or client-side validation. Everything behind the open questions above
(case sensitivity, trimming, cookie flags, lockout) is currently untested and unspecified.

## Automation

The five P1 scenarios are implemented in
[`examples/e2e/tests/auth/login.spec.ts`](../../examples/e2e/tests/auth/login.spec.ts)
(`cd examples/e2e && npm install && npm run test:smoke`). All five pass against the live site
as of 2026-10-19. P2 and P3 cases are not yet automated.
