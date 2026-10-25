# HerHealth

Women's symptoms often get missed because medicine studied men. HerHealth is an AI teacher that turns
any health topic into a lesson for women, with every fact checked against trusted sources.

A 3D teacher talks you through a real-life case, quizzes you, shows what's happening in the body, and
answers your questions out loud. Every fact links to the trusted medical source and the exact sentence
it came from.

Live: https://her-health-wheat.vercel.app

Built solo at Cal Hacks 13.0. Education, not medical advice.

## What it does
- **Make a lesson on anything:** type a topic or paste a link and get a full lesson in about 40
  seconds. Every lesson is framed around a woman and what the sources say about the topic in women
  (how symptoms differ, why it gets missed, pregnancy, periods, menopause, differences in risk). Besides
  MedlinePlus, it runs a web search limited to the trusted sites below to find pages about the topic in
  women. If the sources describe no difference, the lesson says so instead of inventing one.
- **Three ready-made lessons:** heart attack, endometriosis and ADHD. Each lesson starts with a welcome
  from the teacher and a short intro, then a "Before we start" true/false check, a case with a
  question, and an explanation on a body map. It ends with "Check what you learned" and the sources,
  with the exact quote behind each fact.
- **A teacher that talks:** a 3D avatar with lip sync and a natural American voice from Cartesia.
  She starts speaking on her own and stops when you leave the page.
- **Ask the teacher:** ask by mic or by typing. You get a short answer drawn only from the lesson's
  sources. In the built-in lessons, the answer comes from an Elastic Agent Builder agent (the
  "HerHealth tutor") that searches the trusted-source index with an ES|QL tool. If the agent is
  unavailable, Claude answers instead.
- **Med student mode:** a clinical vignette, a board-style question, red flags, and what else to
  consider.
- **Chrome extension:** "Teach me this page", or right-click a highlighted phrase to turn it into a
  lesson. You can download it from the Make a lesson page.
- **Your progress:** the home page lists every lesson you've started or finished, including ones you
  made, with your before → after scores. It's saved in your browser with a random ID; there are no
  accounts and no personal data.
- **Impact page:** shows how much learners improve from the first check to the last, across the
  built-in lessons.

## How we keep it accurate
1. **Trusted sources only.** Lessons are built from NIH, MedlinePlus, CDC, womenshealth.gov, ACOG,
   WHO, FDA, Mayo Clinic, Cleveland Clinic and NHS. A link from any other site is never taught from.
   The app works out its topic and teaches that topic from MedlinePlus instead, with a note that says so.
   The web search for Make a lesson is restricted to these same domains.
2. **Grounded writing.** Claude may only use facts stated in the retrieved passages. Each fact must
   cite its source and quote one sentence word for word.
3. **Quote check.** Code checks that every quote really appears in its source. Facts and quiz items
   whose quotes don't match are dropped.
4. **Second reviewer.** A separate Claude call checks the answer, the facts, the quiz items, the red
   flags and what else to consider against the sources. Anything unsupported is removed. If the
   answer itself isn't supported, no lesson is made.
5. **Safety.** The app never diagnoses. Urgent conditions show a "call 911" banner, and every page
   says it is education rather than medical advice.

## Stack
Next.js 16 + TypeScript + Tailwind · React Three Fiber (3D avatar, lip sync from Web Audio) ·
Convex (backend, lesson cache, learner progress) · Elastic Serverless (semantic search over the
indexed trusted sources, Agent Builder tutor) · MedlinePlus API · Claude API (lesson writing, fact review, Q&A) ·
Cartesia Sonic (voice) · Web Speech API (mic questions) · Chrome MV3 extension · Vercel

## Project layout
- `src/components/Classroom.tsx`: the lesson flow (welcome, intro, checks, case, explanation)
- `src/components/Avatar.tsx`, `TeacherVoice.tsx`, `AskTeacher.tsx`: the teacher
- `src/components/MyProgress.tsx`, `convex/attempts.ts`: quiz scores, Your progress and the impact page
- `convex/lessons.ts`: built-in lessons from Elastic, the lesson rules, and the fact-check (`checkLesson`)
- `convex/custom.ts`: Make a lesson, including the trusted-domain allowlist, MedlinePlus lookup and the
  trusted-site web search
- `convex/ask.ts`, `convex/agent.ts`, `convex/speech.ts`: answers (Agent Builder tutor, Claude fallback) and voice
- `extension/`: the Chrome extension (zipped to `public/her-health-extension.zip`)

## Setup

```bash
npm install
cp .env.example .env.local      # fill in keys; never commit this file
npx convex dev                  # logs in, creates a dev deployment, writes Convex vars to .env.local
npm run dev                     # http://localhost:3000
```

### Avatar
The teacher is `public/avatar.glb`: the "brunette.glb" example avatar from
[TalkingHead](https://github.com/met4citizen/TalkingHead), created at Ready Player Me and licensed
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (non-commercial use, attribution).
It has ARKit and viseme blendshapes for lip sync. It was compressed with
`npx @gltf-transform/cli optimize ... --compress meshopt --texture-compress webp --texture-size 1024`.
The app recolors her top and poses the arms at load time. For commercial use, swap in a CC0 model
such as TalkingHead's "mpfb.glb".

### Trusted sources into Elastic
1. Create an Elastic Cloud **Serverless** project (Elasticsearch, general purpose).
2. Copy the Elasticsearch endpoint and create an API key; put them in `.env.local` as
   `ELASTIC_URL` and `ELASTIC_API_KEY`.
3. Index the pages listed in `data/sources.json`:
   ```bash
   npm run ingest            # add -- --reset to rebuild the index from scratch
   npm run search -- "heart attack symptoms women jaw" heart-attack
   ```
4. Create the Agent Builder tutor and its search tool (`convex/agent.ts`, `scripts/agent.ts`):
   ```bash
   npm run agent -- "Can a heart attack feel like heartburn?"
   ```
   Kibana's URL is worked out from `ELASTIC_URL`, or you can set `KIBANA_URL`.

## Deploy
1. Deploy the backend: `npx convex deploy` (pushes the functions in `convex/` to your production
   deployment).
2. Server-side keys (Anthropic, Cartesia, Elastic) go in Convex env vars, never in the frontend:
   `npx convex env set --prod ANTHROPIC_API_KEY ...`
3. Import the GitHub repo in Vercel (framework: Next.js) and set `NEXT_PUBLIC_CONVEX_URL` to the
   production Convex URL. Vercel redeploys the frontend on every push to `main`.

### Chrome extension
Unzip `public/her-health-extension.zip`, open `chrome://extensions`, turn on Developer mode, and
choose **Load unpacked**. To point it at your own deployment, edit `extension/config.js`.
