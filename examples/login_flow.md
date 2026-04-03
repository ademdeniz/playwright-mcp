# Example: Claude-driven login test

Once playwright-mcp is connected to Claude Desktop or Cursor,
you can ask Claude to run a full test scenario in natural language.

---

## Prompt you'd send to Claude

> "Test the login flow on https://the-internet.herokuapp.com/login.
> Use username 'tomsmith' and password 'SuperSecretPassword!'.
> Verify the success message appears and take a screenshot."

## What Claude does (tool calls)

```
navigate        → https://the-internet.herokuapp.com/login
get_page_state  → reads title, visible fields, buttons
fill            → selector="#username", value="tomsmith"
fill            → selector="#password", value="SuperSecretPassword!"
click           → selector="button[type='submit']"
assert          → type="text_visible", expected="You logged into a secure area!"
screenshot      → savePath="screenshots/login_success.png"
close_browser
```

## Claude's response

> ✓ Navigated to login page — title: "The Internet"
> ✓ Filled username and password fields
> ✓ Clicked Login button
> ✓ Assert passed: "You logged into a secure area!" is visible
> ✓ Screenshot saved to screenshots/login_success.png
>
> The login flow works correctly. The success banner appeared
> immediately after form submission with no errors.
