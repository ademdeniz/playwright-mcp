---
name: the-internet-app-map
description: Application map for the-internet.herokuapp.com — verified URLs, selectors, credentials, and expected messages. Use whenever testing this app so selectors are never guessed.
---

# App Map: the-internet.herokuapp.com

Base URL: `https://the-internet.herokuapp.com`

These selectors are verified against the production Playwright suite (playwright-e2e repo).
Always use them exactly — never invent variants.

## Login page — `/login`

| Element | Selector |
|---|---|
| Username field | `#username` |
| Password field | `#password` |
| Login button | `button[type="submit"]` |
| Flash message (success/error banner) | `#flash` |
| Logout button (secure area) | `a[href="/logout"]` |

Valid credentials: username `tomsmith`, password `SuperSecretPassword!`

Expected flash messages (use with `assert` type `text_visible`):
- Valid login: `You logged into a secure area!` (lands on `/secure`)
- Invalid username: `Your username is invalid!` (stays on `/login`)
- Invalid password: `Your password is invalid!` (stays on `/login`)
- After logout: `You logged out of the secure area!`

## Dynamic loading — `/dynamic_loading/1`

| Element | Selector |
|---|---|
| Start button | `#start button` |
| Loading bar | `#loading` |
| Finish text | `#finish` |

After clicking Start, the loading bar appears, then `#finish` shows `Hello World!`
(takes up to ~10 seconds — re-check page state rather than assuming failure).

## Checkboxes — `/checkboxes`

Two checkboxes: `input[type="checkbox"]`. First starts unchecked, second starts checked.

## Dropdown — `/dropdown`

Select element: `#dropdown` with Option 1 and Option 2 (both initially unselected).
