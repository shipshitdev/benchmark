# Build the Shipcut pricing page

You are working inside a minimal Next.js app. Your job is to design and build the pricing
page at `/pricing`.

## Product

Shipcut is a CLI tool that turns a livestream recording into a long-form recap video and a
batch of short clips, ready to publish. Buyers are solo streamers and small content teams.

## Requirements

Build out `app/pricing/page.tsx` (and any components you add under `components/` or
`app/pricing/`) into a complete pricing page with all of the following:

- Three pricing tiers aimed at different buyers (for example a solo streamer, a small team,
  and a studio or agency). Invent realistic tier names, prices, and feature lists that fit
  the product.
- A working annual/monthly billing toggle that updates the displayed price for every tier
  without a page reload.
- A feature comparison table below the tier cards that lists specific features as rows and
  the three tiers as columns, showing which tier includes which feature.
- An FAQ section with at least five realistic questions and answers (billing, cancellation,
  usage limits, supported platforms, refunds, etc).
- A clear call to action on each tier.

## Constraints

- The page must be fully responsive: usable and well laid out on a phone-width viewport, a
  tablet-width viewport, and a desktop-width viewport, with no horizontal scrolling and no
  overlapping content at any width.
- The page must be accessible: correct heading structure, sufficient color contrast,
  keyboard-operable toggle and buttons, visible focus states, and no reliance on color alone
  to convey which tier is recommended.
- The page must support both light and dark mode, following the system color scheme. Every
  piece of text must stay readable in both modes.
- Do not introduce a component library or CSS framework beyond what is already in the
  fixture (Next.js and Tailwind CSS). Do not add a backend, database, or payment
  integration; this is a static marketing page.
- Update `app/page.tsx` only if needed to keep its existing link to `/pricing` working.
- Keep `bun run build` and `bun run start` working exactly as documented in the fixture's
  README.

Work only within this fixture directory. When you are done, the page should look and feel
like something a real dev tool would ship, not a rough draft.
