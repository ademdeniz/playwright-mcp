# Scenarios: the-internet.herokuapp.com

Worked example of the scenario format used by the
[`regression-scenarios`](../../skills/regression-scenarios/SKILL.md) skill,
mirroring the playwright-e2e suite. Selectors and messages come from
[`the-internet-app-map`](../skills/the-internet-app-map.md).

Base URL: https://the-internet.herokuapp.com

## AUTH-1 · Valid login (@smoke)

1. Navigate → /login
2. Fill `#username` → `tomsmith`
3. Fill `#password` → `SuperSecretPassword!`
4. Click `button[type="submit"]`
5. Check URL contains `/secure`
6. Check text visible `You logged into a secure area!`

## AUTH-2 · Invalid password shows error (@smoke)

1. Navigate → /login
2. Fill `#username` → `tomsmith`
3. Fill `#password` → `wrongpassword`
4. Click `button[type="submit"]`
5. Check URL contains `/login`
6. Check text visible `Your password is invalid!`

## AUTH-3 · Logout returns to login (@regression)

1. Run AUTH-1
2. Click `a[href="/logout"]`
3. Check URL contains `/login`
4. Check text visible `You logged out of the secure area!`

## UI-1 · Dynamic loading completes (@smoke)

1. Navigate → /dynamic_loading/1
2. Click `#start button`
3. Wait for `#finish` (takes up to ~10 s — do not re-click Start)
4. Check text visible `Hello World!` in `#finish`

## UI-2 · Dropdown selection (@regression)

1. Navigate → /dropdown
2. Select `#dropdown` → `Option 1`
3. Check `#dropdown` value is `1`

(The credentials above are the site's published demo credentials.)
