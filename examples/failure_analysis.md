# Example: Claude analyzes a broken page

## Prompt

> "Go to https://the-internet.herokuapp.com/broken_images and tell me
> which images are broken and why."

## What Claude does

```
navigate        → https://the-internet.herokuapp.com/broken_images
get_page_state  → reads all visible elements
evaluate        → expression: "Array.from(document.images).map(img => ({ src: img.src, broken: img.naturalWidth === 0 }))"
screenshot      → full page capture
```

## Claude's response

> I found 3 images on the page. 2 are broken (naturalWidth === 0),
> meaning they failed to load. Both reference paths that return 404.
>
> Broken images:
>   - /img/avatar-blank.jpg  → 404 Not Found
>   - /img/ruby-sm.jpg       → 404 Not Found
>
> 1 image loaded correctly: /img/avatar-blanche.jpg
>
> Root cause: the broken images reference non-existent server paths.
> The page has no alt text on broken images, which is also an
> accessibility issue.
