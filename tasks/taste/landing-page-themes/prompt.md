# Invent a product and design its landing page five ways

You are working inside a minimal Next.js 16 app with Tailwind CSS 4. `app/page.tsx` is a
placeholder. Everything else is yours to decide.

## The job

1. **Invent a small project that needs a landing page.** Your choice of kind: a B2B SaaS, a
   developer tool, a single-product ecommerce brand (one physical product, Shopify-style), a
   paid newsletter, a course, a local service. Give it a name, a one-line positioning statement,
   a target customer, and a price or pricing model. Keep it plausible: something two people
   could launch in a year.

2. **Build five landing pages for it**, at `/themes/1`, `/themes/2`, `/themes/3`, `/themes/4`
   and `/themes/5`. Each is a complete landing page for the same product, and each is a
   genuinely different design direction: different typographic voice, layout system, color
   world, tone of copy, and kind of imagery or illustration. Five palettes on one layout does
   not count. Every page must convert: make the visitor understand the product and want to act.

3. **Follow landing-page conversion practice** on every theme. A clear value proposition in the
   first viewport. One primary call to action, visible without scrolling, repeated at the end.
   Benefits before features. Credibility signals (logos, quotes, numbers, or an honest
   substitute for a brand with no customers yet). Objection handling, such as an FAQ, a
   guarantee, or shipping and returns terms for a physical product. The price, or how to learn
   it. Readable hierarchy and contrast on a phone.

4. **Make `/` an index** that links to the five themes with a one-line description of each.

5. **Write `THEMES.md`** at the project root: the project you invented (kind, name,
   positioning, customer, pricing), one paragraph per theme describing the direction and who it is aimed at,
   and finally which theme you recommend shipping and why, in a few sentences.

## Constraints

- Next.js 16 App Router, Tailwind CSS 4, TypeScript. No additional UI libraries.
- No external images or fonts loaded over the network; inline SVG, CSS and system or
  self-hosted fonts only.
- `bun run build` must succeed and every route must render without console errors.
- Work only within this directory.
