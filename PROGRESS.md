# PROGRESS.md

Cross-session log for the Thunder build. Read this first before starting work; update it before ending a session.

## Current stage

Steps 0, 1, and 2 complete. Next up: Step 3 (Gemini conversational agent, backend).

## Completed across sessions

**Step 0 — Project Setup**
- Scaffolded Next.js 16 (App Router, TypeScript, Tailwind v4, ESLint) via `create-next-app` — had to scaffold into a temp `thunder-app/` subfolder first (npm rejects capitalized package names, and the project dir is `Thunder`) then move contents up to project root.
- Initialized shadcn/ui (`components.json`, `src/components/ui/`, `src/lib/utils.ts`). This shadcn setup uses `@base-ui/react` primitives, not Radix — `Button` takes `render={<Link .../>}` for polymorphic rendering (not `asChild`), and when `render` points at a non-`<button>` element you must also pass `nativeButton={false}` or Base UI logs a console warning about missing native button semantics.
- `.env.example` created with placeholders for Gemini, BytePlus, Supabase, and Cloudinary keys, grouped by which step introduces each.
- `next.config.ts` pins `turbopack.root` to the project dir — there's an unrelated `package-lock.json`/`node_modules` in the parent `C:\Users\Its_Sensei` folder that was confusing Turbopack's workspace root detection and spamming a warning on every request.

**Step 1 — Landing Page** (`src/app/page.tsx`)
- Went through two full redesigns based on direct user feedback before landing on the current look — see Key Decisions below for the final design system.
- **Current structure**: full-bleed hero (nav + headline + CTAs overlaid on a rolling video reel, corner-anchored copy, not a centered generic layout) → partner/stack strip → "what it does" statement → showcase row (contained, fixed-width video cards, horizontally scrollable — deliberately *not* full-viewport video, after user feedback that full-bleed square videos didn't fit the screen) → "how it works" (3 bordered step cards) → closing CTA → footer.
- **Hero reel** (`src/components/hero-reel.tsx`, client component): plays `public/videos/1.mp4`–`5.mp4` one at a time, crossfading to the next only when the current clip's native `ended` event fires (not a fixed timer) — real duration-aware pacing, no abrupt cuts. Only the active `<video>` plays; the rest are paused and pre-decoded.
- **Showcase row**: `public/videos/6.mp4` and `7.mp4` (square clips) in fixed-width (256–288px) cards, `overflow-x-auto` so the row never exceeds the viewport regardless of clip count.
- **Scroll animations** (`src/components/reveal.tsx`, client component): `IntersectionObserver`-driven fade/slide-up wrapper, used on every below-fold section with staggered delays on grouped items (steps, showcase cards). Pure CSS transitions, no animation library. `prefers-reduced-motion: reduce` is respected globally (`globals.css`, collapses all transition/animation durations to ~0).
- CTAs link to `/app` (now a real route as of Step 2).

**Step 2 — App Frontend (mock data)** (`src/app/app/page.tsx` + `src/components/dashboard/`)
- Client-only dashboard, no backend calls. Went through two versions — see below.
- **v1** (first pass): classic two-pane chat-left/gallery-right layout with a persistent message log. Superseded after the user supplied a reference screenshot of a "creation studio" hub (thin icon sidebar, centered headline + single prompt box with filter pills, model cards, masonry inspiration grid) and asked for that instead.
- **v2 (current)**: `Sidebar` (`sidebar.tsx`) — narrow icon rail (Home link, active Studio indicator, disabled Account icon titled as pending Step 5 auth). `PromptStudio` (`prompt-studio.tsx`) — centered headline, single prompt box that collapses the "conversational refinement" into an inline 2-turn exchange (assistant asks one clarifying question inside the same card, user answers inline, then it fires the generation) rather than a persistent chat log; also has a functional ratio selector (16:9/1:1/9:16 — actually changes the resulting card's aspect) and 4 quick-start prompt chips. A "Video · Available" / "Image · Soon" toggle and a models row (Seedance 2.5 available, Seedream marked "Coming soon") are honest about current capability — no fabricated feature list. `GenerationsGrid` (`generations-grid.tsx`) — CSS-columns masonry (not a fixed grid), matching the reference's inspiration-wall look, seeded with 4 pre-completed entries via `seedGenerations()` so it isn't empty on first load.
- Mock conversation + generation lifecycle lives in `src/lib/mock-generations.ts`: `runMockGeneration()` drives a generation through queued → generating (staged progress via `setTimeout`) → completed (random pick from the 7 videos in `public/videos/`) or error (~20% chance, retryable). This is explicitly a stand-in for the real BytePlus task-submit/poll flow that Step 4 will replace.
- No Supabase/DB — all dashboard state is in-memory only (`useState`), lost on refresh, as the plan specifies for this step.

## Key decisions

- **Design system (current)**: pure black/white monochrome (no accent color) — background `#000000`, card `#0A0A0A`, foreground `#F5F5F7`, border `rgba(255,255,255,.12)`. Single font family, Inter, across headings and body (`ui-ux-pro-max` → "Spatial Clear" pairing, chosen specifically because it's built for legibility over moving video backgrounds). Pill-shaped buttons, generous whitespace, no drop shadows — explicit "Apple-style premium minimal" direction per user request, superseding two earlier attempts (a navy/pink "AI-native" palette, then a red-accent editorial-agency palette) that the user rejected as generic/"AI slop."
- Design system was **not** persisted to a `design-system/` folder — still small enough to track by reading the actual CSS/components.
- Dashboard mock lifecycle intentionally has a ~20% random failure rate so the error+retry UI path is actually exercised during manual testing, not just theoretical.

## Known issues / blockers

- Could not visually verify any of this in a real browser — the Chrome extension (`claude-in-chrome`) has not connected in any session so far. Verified instead via `npx tsc --noEmit` (pass), `npx next build` (pass), and `curl` against `next dev` confirming markup/copy renders. **Next session: do a real visual/interaction pass in-browser once the extension is reachable** — especially the chat scroll behavior, generation card states, and mobile stacking of the dashboard grid, none of which have been eyeballed yet.
- A request to "build like ai.byteplus.com" could not be fulfilled by actually loading that page (Chrome extension offline, and a direct fetch returns nothing since it's a client-rendered SPA) — the showcase/card redesign was done from general product-page conventions instead, not a verified copy of that site. Said so explicitly to the user at the time.

## Next session should

1. Do the visual/browser check noted above.
2. Start Step 3: Gemini conversational agent (backend API route), replacing the canned two-turn mock in `mock-generations.ts` with real refinement — keep the mock generation lifecycle (queued/generating/completed/error) as-is until Step 4 replaces it with real BytePlus calls.

## Deviations from plan

- Landing page went through two full visual redesigns mid-build based on user feedback — not scope changes, quality-bar corrections (see Step 1 notes).
- Product scope clarified as general-purpose video generation (not ad-only) — `plan.md` updated to match; this was a real scope change from the original doc.
