@AGENTS.md

# Her Signs

Web app for Cal Hacks 13.0 (solo build, deadline Sunday 9 AM) that teaches women how
conditions show up differently in women. A 3D avatar teacher speaks with Cartesia voice,
presents a real-life scenario, quizzes the learner, then explains with a body diagram and
cites a trusted source for every fact.

Conditions, in build order: **heart attack** (first, fully), **endometriosis** (Saturday
afternoon), **ADHD** (only if time allows). Two great lessons beat three broken ones.

## Rules for content
- Every fact shown or spoken must cite a trusted source: MedlinePlus, NIH (NHLBI, NICHD,
  NIMH), womenshealth.gov, AHA / Go Red for Women, ACOG, CDC. Sources live in
  `data/sources.json` and are indexed into Elastic.
- Never diagnose or tell the user what she has. Always recommend seeing a clinician.
- Urgent conditions (heart attack) show a red "If this is happening now, call 911" banner.
- Every lesson shows "This is education, not medical advice."

## Stack
- Next.js 16 (App Router, `cacheComponents` on) + TypeScript + Tailwind v4, `src/` dir.
  Read `node_modules/next/dist/docs/` before using an API you're unsure of; this Next differs
  from older training data.
- Avatar: React Three Fiber + `@pixiv/three-vrm`. Component: `src/components/Avatar.tsx`.
  Model at `public/avatar.vrm` (VRoid Studio preset export). Exposes `setMouthOpen(0..1)`
  via `AvatarHandle` for lip sync.
- Backend/data: Convex (`convex/`). Lessons are pre-generated and cached so the demo never
  waits on an API.
- Sources: Elastic Serverless index `women-health-sources` (fields: condition, title, url,
  org, passage as `semantic_text`). Ingest with `npm run ingest`, test with `npm run search`.
  Agent Builder agent "Body Literacy Tutor" wraps it later (timebox 90 min).
- Lesson generation: Claude API (Anthropic TS SDK) inside a Convex action, using only
  retrieved passages.
- Voice: Cartesia Sonic TTS, called server-side only.
- Hosting: Vercel. Mobile-friendly layout is required.

## Secrets
Keys live only in `.env.local` (local) and Vercel / Convex environment variables. Never commit
a key; `.env.example` lists the names. Cartesia's track checks this.

## Working style
Small, working increments. Run the app and check each step before the next. Commit after
each working step with a clear message.

## Build steps
0. CLAUDE.md (this file)
1. Scaffold + deploy to Vercel
2. Avatar on screen: blinks and breathes
3. Sources into Elastic: "heart attack symptoms women jaw" returns cited passages
4. Tutor brain: Convex `generateLesson(condition)` -> JSON lesson, cached
5. Voice + lip sync + captions
6. Pre/post quiz, scores in Convex, /impact page
7. Body map SVG with highlighted regions
8. Safety: emergency banner, disclaimer, sources panel, /about, cached fallback
9. Ship: domain, polish, README, Devpost
