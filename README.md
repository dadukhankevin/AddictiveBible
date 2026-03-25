# AddictiveBible

Most Bible apps are designed to make you stop reading. You open one up and the first thing you see isn't the Bible — it's a dashboard of devotionals, community features, and upsells. When you finally get to the text, every chapter ends with a hard stop that asks you to manually navigate to the next page. Social media would never do this, which is why people spend hours scrolling feeds but minutes in Scripture.

AddictiveBible applies the UX patterns that make apps engaging — infinite scroll, algorithmic discovery, zero friction — to Bible reading.

## What it does

- **Infinite scroll** — no chapter breaks, no pagination. Just keep reading.
- **Swipe to discover** — swipe or tap shuffle and the app recommends a new passage using TF-IDF similarity based on what you've read and liked.
- **Speed read mode** — RSVP-style word-by-word display with natural reading rhythm (timing adjusts for word length, punctuation, and sentence position).
- **Passage portals** — inline links to thematically related verses appear as you read.
- **Fog of war** — text reveals as you scroll, adding a sense of discovery.
- **No clutter** — opens straight to text. No ads, no accounts, no Bible study upsells.

## Data

Uses the Berean Standard Bible (BSB), which is CC0 public domain. The full text (31,102 verses, 66 books) is included as JSON.

## Tech

Vanilla JS + Vite. No framework, no runtime dependencies. ~5KB JS bundle + ~1.5MB Bible data. Deploys as a static site to Cloudflare Pages. Works offline as a PWA.

## Run locally

```
npm install
npm run build:data
npm run dev
```

## Deploy

```
npm run build
npx wrangler pages deploy dist/
```

Or connect the repo to Cloudflare Pages with build command `npm run build` and output directory `dist`.
