# Her Signs

Learn how heart attack, endometriosis and ADHD show up differently in women. A 3D avatar
teacher tells a real-life scenario, quizzes you, then explains what's happening in the body
and cites a trusted source (AHA, CDC, NIH, MedlinePlus, womenshealth.gov, ACOG) for every fact.

Live: https://her-health-wheat.vercel.app

Built solo at Cal Hacks 13.0. Education, not medical advice.

## Stack
Next.js 16 + TypeScript + Tailwind · React Three Fiber + `@pixiv/three-vrm` (VRoid avatar) ·
Convex · Elastic Serverless (semantic search, Agent Builder) · Claude API · Cartesia Sonic ·
Vercel

## Setup

```bash
npm install
cp .env.example .env.local      # fill in keys; never commit this file
npx convex dev                  # logs in, creates a dev deployment, writes Convex vars to .env.local
npm run dev                     # http://localhost:3000
```

### Avatar
The teacher is `public/avatar.glb`: the CC0 "mpfb.glb" example avatar from
[TalkingHead](https://github.com/met4citizen/TalkingHead), made with MakeHuman/MPFB, with ARKit and
viseme blendshapes for lip sync. It was compressed with
`npx @gltf-transform/cli optimize ... --compress meshopt --texture-compress webp --texture-size 1024`
(37 MB to 3 MB). The app recolors its shirt and poses the arms at load time.

### Trusted sources into Elastic
1. Create an Elastic Cloud **Serverless** project (Elasticsearch, general purpose).
2. Copy the Elasticsearch endpoint and create an API key; put them in `.env.local` as
   `ELASTIC_URL` and `ELASTIC_API_KEY`.
3. Index the pages listed in `data/sources.json`:
   ```bash
   npm run ingest            # add -- --reset to rebuild the index from scratch
   npm run search -- "heart attack symptoms women jaw" heart-attack
   ```

## Deploy
1. Import the GitHub repo in Vercel (framework: Next.js).
2. In Convex dashboard → production → Settings, create a **Deploy Key**; add it to Vercel as
   `CONVEX_DEPLOY_KEY`.
3. Set the Vercel build command to `npx convex deploy --cmd 'npm run build'`.
4. Server-side keys (Anthropic, Cartesia, Elastic) go in Convex env vars:
   `npx convex env set --prod ANTHROPIC_API_KEY ...`

## Safety
The app never diagnoses. Urgent conditions show a "call 911" banner, every lesson says it is
education rather than medical advice, and every fact links to its source.
