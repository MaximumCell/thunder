# BytePlus Seedance AI Video Generator — Build Plan

## Project Overview

A conversational AI platform for generating videos (and images) from a free-form prompt — not limited to ad creatives, any video the user describes — built as a sponsored deliverable for a BytePlus (Seedance/Seedream) promo. Demonstrates real API integration — task submission, async polling, result retrieval, usage tracking — wrapped in a legitimate product experience, not a bare API demo script.

**This is NOT a full Higgsfield-style SaaS clone.** No canvas/node editor. Scope is intentionally kept lean: a conversational chat interface for generation + a results gallery.

## Architecture

```
User → Next.js App (chat UI, shadcn components)
         → API Route → Gemini (free tier) — conversational prompt refinement, backend-only, invisible to user
         → API Route → BytePlus ModelArk — Seedance 2.5 (video) / Seedream (image, phase 2)
         → Supabase (Auth + Postgres) — users, conversations, messages, generation_tasks, usage_logs, RLS via auth.uid()
         → Cloudinary — re-hosts BytePlus's (likely expiring) result URLs for persistent asset storage
```

**No separate backend.** Next.js API routes (App Router route handlers) handle all server-side work — Gemini calls, BytePlus calls, Supabase queries, Cloudinary uploads. Keeps API keys server-side only. A separate backend service is only justified if we later need an independent background job queue — not needed at this scope.

## Key Product Decisions (locked in)

- **Agent behavior**: Gemini is conversational — it goes back and forth with the user to refine their prompt (ad, cinematic clip, whatever they describe) into a strong generation prompt, not single-shot expansion.
- **Scope of generation**: General-purpose — any video from a text prompt, not an ad-only tool. Ads are one use case among many, not the product's ceiling.
- **Gemini visibility**: Backend only. BytePlus stays the hero of the product and the video — Gemini just powers the assistant quietly.
- **Generation scope**: Both video (Seedance 2.5) and image (Seedream) — built step by step, video first.
- **No canvas/node editor.** Chat + gallery only.
- **Auth**: Real signed-up accounts via Supabase Auth (not anonymous/session-only) — history persists across visits.
- **DB choice**: Supabase (Postgres) over Mongo — the data is inherently relational (users → conversations → messages → generation_tasks → usage_logs), and Supabase gives Auth + RLS + realtime out of the box.
- **Asset storage**: Cloudinary — BytePlus's returned media URLs are likely temporary, so results must be re-hosted for a persistent gallery.
- **UI library**: shadcn components — avoid generic/templated "AI slop" look.
- **Landing page**: Includes a hero section with a real Seedance-generated AI video (generated directly, doesn't depend on the app's own generation flow existing yet) — doubles as marketing and as an early proof point.
- **Build order**: Frontend first (fully clickable with mock data), THEN Supabase + Cloudinary integration added after.

## BytePlus API Notes (confirmed from docs)

- Seedance 2.5 = **video generation only** (async: submit task → poll/retrieve by task ID).
- Image generation is a **separate model/API**: Seedream (currently Seedream 5.0 Pro), same ModelArk platform, different endpoint.
- To offer both video and image generation, the app calls two separate ModelArk model endpoints — not one endpoint doing both. Be accurate about this on camera (it's "ModelArk's suite," not "Seedance alone," doing images).
- Result URLs from BytePlus are expected to expire — must be re-uploaded to Cloudinary promptly after task completion.

## Cross-Session Progress Log (`PROGRESS.md`)

Maintain a `PROGRESS.md` at the project root. Every agent/session reads it first before starting work, and updates it last before ending a session. Required contents:

- Current stage / step number (from the plan below)
- What was completed this session (files touched, key decisions made)
- Known issues / blockers
- What the next session should do first
- Any deviations from this plan and why

This is the persistent memory across Claude Code sessions — treat it as required, not optional, at the end of every work session.

---

## Build Steps

### Step 0 — Project Setup
- Init Next.js (App Router) + shadcn
- Set up project structure, `.env.example` for API keys (Gemini, BytePlus, Supabase, Cloudinary — added as each step needs them)
- Create `PROGRESS.md` with initial entry

### Step 1 — Landing Page
- Marketing page: value prop, CTA to sign up / try the app
- Hero section featuring a Seedance-generated AI video (generate manually via BytePlus dashboard/script for now — not blocked on the app's generation flow)
- shadcn components throughout

### Step 2 — App Frontend Only (mock data, no live APIs)
- Chat-style conversational UI
- Results/gallery view
- All UI states covered: empty, loading, generating, completed, error
- Fully clickable using mock/dummy responses and placeholder media
- No backend calls yet

### Step 3 — Gemini Conversational Agent (backend)
- Next.js API route wired to Gemini free-tier API
- Conversational back-and-forth: refine user's prompt (any video concept, not just ads) into a structured, strong generation prompt
- Conversation state handled client-side/in-memory at this stage (DB comes in Step 5)
- Gemini output/role stays invisible in the UI — user just sees "the assistant"

### Step 4 — BytePlus Seedance Integration (video)
- API route: submit video generation task to Seedance 2.5 using the Gemini-refined prompt
- API route: poll/retrieve task status and result
- Milestone: full end-to-end video generation works (brief → refined prompt → generated video)

### Step 5 — Supabase (Auth + DB)
- Supabase Auth: real signup/login
- Schema: `users`, `conversations`, `messages`, `generation_tasks`, `usage_logs`
- RLS policies tied to `auth.uid()`
- Replace in-memory conversation state with persisted DB records

### Step 6 — Cloudinary (asset persistence)
- On task completion, pull BytePlus result URL and re-upload to Cloudinary before expiry
- Store Cloudinary URL in `generation_tasks`
- Gallery now shows permanent, persistent assets

### Step 7 — Usage Tracking
- Log cost/tokens/API calls per generation into `usage_logs`
- Surface usage somewhere visible in the UI (simple is fine) — this is core to the "API demo" value, not just a UI nicety

### Step 8 — Seedream Integration (image generation, phase 2)
- Repeat the pattern from Steps 4/6/7 for the image endpoint
- Extend chat UI / gallery to support image results alongside video

---

## Notes for Claude Code

- Follow the steps in order. Do not skip ahead to Supabase/Cloudinary before the frontend (Step 2) is complete — this is an explicit build-order requirement from the project owner.
- Read `PROGRESS.md` at the start of every session. Update it at the end of every session, even if a step is only partially done.
- Keep API keys server-side only (Next.js API routes / route handlers) — never expose Gemini, BytePlus, Supabase service role, or Cloudinary keys client-side.
- Use shadcn components for UI — avoid default/generic-looking Tailwind UI.
- Confirm BytePlus request/response shapes (params, auth headers, task polling interval, error codes) against the live ModelArk docs before finalizing Step 4 and Step 8 — API details may shift.
