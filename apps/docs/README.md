# LazyCanvas documentation site

The site at the heart of the LazyCanvas docs: guides, live examples and the generated API reference. It is a [Next.js](https://nextjs.org) app built on [Magic Docs](https://once-ui.com/products/magic-docs) by Once UI (CC BY-NC 4.0, see [LICENSE](./LICENSE)).

## Layout

| Path | What it is |
| --- | --- |
| `src/content/docs/*.mdx` | The hand-written guides. Order is set in `src/content/docs/meta.json`. |
| `src/content/reference/` | The API reference. **Generated** and git-ignored — see below. |
| `src/examples/*.tsx` | Live examples. Each is a client component built on `@nmmty/adapter-react`. |
| `src/product/Example.tsx` | The `<Example name="…" />` MDX component: renders an example next to its own source. |
| `src/resources/once-ui.config.js` | Site name, metadata, theme, fonts. |
| `src/resources/icons.ts`, `once-ui.d.ts` | Icons added on top of Once UI's built-in set (register in both). |

## Working on it

From the repository root:

```bash
pnpm install
pnpm build                                   # the examples import the built packages
pnpm --filter @nmmty/lazycanvas docgen       # generate the API reference
pnpm docs:dev                                # http://localhost:3000
```

`pnpm docs:build` runs all of the above and produces a production build.

### Adding a guide

Create `src/content/docs/<slug>.mdx` with this front matter and add the slug to `meta.json`:

```mdx
---
title: "Title"
summary: "One sentence for search results and link previews."
updatedAt: "2026-10-09T12:00:00.000Z"
navIcon: "learn"
---
```

### Adding a live example

1. Create `src/examples/<name>.tsx`: a `"use client"` component that renders a `<Scene>`.
2. Register it in `src/examples/index.ts`.
3. Use it in a guide with `<Example name="<name>" />` (add `hideCode` to show only the result). The code shown on the page is the file itself, so it cannot drift from what runs.

## Notes on Once UI 2

- `CodeBlock` is imported from `@once-ui-system/core/code` (it needs `prismjs`), and Once UI needs Next.js 15.5 or newer.
- Use Once UI components rather than raw HTML tags (`Column`/`Row`, `Text`, `Input`, `Select`, `Slider`, `Table`, `SmartLink`, …). The two exceptions are the `<head>` script in `layout.tsx` and the Open Graph image route, which is rendered by Satori and takes plain elements.
- `Select` (2.0.0) reopens itself right after a choice: closing the dropdown restores focus to the trigger, whose `onFocus` opens it again. The examples use `ToggleButton` rows instead; check the Select again before using it on the site.
- The `next/font` variable classes are set on `<body>`, not `<html>`: Once UI's `tokens.css` declares `:root { --font-heading: var(--font-heading) }`, which is invalid and leaves the font variables empty if the classes sit on `<html>`.

## Deployment

`vercel.json` in the repository root builds with `pnpm docs:build`. Set `NEXT_PUBLIC_SITE_URL` to the public address of the site; on Vercel the production domain is picked up automatically.

## License

The Magic Docs template is distributed under CC BY-NC 4.0 (attribution required, non-commercial). The LazyCanvas content — guides, examples — is MIT like the rest of the repository.
