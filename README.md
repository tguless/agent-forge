# Agent Forge

Turn a **minimal job description + a short description of your business** into a fully realized
tactical "command-card" agent — identity, mission, metrics, a detailed Markdown **skill file**, and a
generated **emblem / portrait / icon** — rendered in the same Command & Conquer–style HUD as the
PaperIQ operations command center.

A Claude agent runs a tool-use loop to populate every section of the card, writes the skill file, and
commissions the three images via **Nano Banana (Gemini)** with the **rembg + ImageMagick** background
removal pipeline. Everything is stored in a local **SQLite** database.

## How it works

```
/new (business + job description)
   → POST /api/agents/generate
       → Claude tool-use loop (src/lib/server/agentRunner.ts)
           set_identity → set_narrative → set_lists → set_metrics
           → write_skill_file
           → generate_image (emblem, portrait, icon)  [Gemini + rembg + magick]
           → finalize
       → writes to SQLite (data/forge.db) + emits generation events
   → live progress log (polls /api/agents/[slug]/events)
/        → index grid of all forged agents (lifted PaperIQ operations layout)
/agent/[slug] → full command card + tap-to-open skill module
```

The agent's "skills" (how to design identity, author the skill file, and choose visuals) live as
Markdown in [`skills/`](./skills) and are injected into the system prompt.

## Setup

```bash
cd agent-forge
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3030
```

### Environment (`.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | **Yes** | The agent brain (identity, copy, skill file). |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-5`. |
| `GEMINI_API_KEY` | Recommended | Visual assets via Nano Banana. **Without it, text + skill file still generate; images become placeholder glyphs.** |
| `GEMINI_IMAGE_MODEL` | No | `gemini-3-pro-image-preview` (Pro) or `gemini-3.1-flash-image-preview` (Flash). |
| `GEMINI_IMAGE_SIZE` | No | `2K` by default (Gemini 3 models). |
| `REMBG_PYTHON` | No | Path to a Python venv with `rembg` + `Pillow`. Auto-detects the repo's shared rembg venv. |
| `ICON_WHITE_FUZZ` | No | ImageMagick white→alpha fuzz (default `14%`). |

> **Note:** Nano Banana runs on Gemini, so visual generation needs a `GEMINI_API_KEY` in addition to
> your Anthropic key. Background removal additionally needs a `rembg` venv and `ImageMagick` (`magick`);
> all three steps degrade gracefully if a tool is missing.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **better-sqlite3** — local DB at `data/forge.db`
- **@anthropic-ai/sdk** — tool-use agent loop
- **@google/genai** — Nano Banana image generation
- **react-markdown** + **remark-gfm** — skill module rendering (with tables)

## Layout

```
src/
  app/
    page.tsx                  index grid (live)
    new/page.tsx              forge form + generation progress
    agent/[slug]/page.tsx     command card (live while forging)
    api/agents/...            generate, list, detail, skill, events
  components/                 ForgeHudHeader, HudBox, SegmentedProgress,
                              AgentCommandCard, AgentSkillsOverlay, AgentDetailCommandCard
  lib/
    db.ts, agentStore.ts, types.ts, slug.ts, detailIcons.ts
    server/
      agentRunner.ts          Anthropic loop + system prompt
      tools.ts                tool defs + handlers (DB writes, image gen)
      imagePipeline.ts        Gemini + rembg + ImageMagick (graceful degrade)
  styles/                     operations-dashboard.css, operations-detail.css (lifted), forge.css
skills/                       generator meta-skills (injected into the system prompt)
public/
  forge/detail-icons/         HUD section icons (lifted)
  agents/<slug>/              generated emblem.png, portrait.png, icon.png
data/forge.db                 SQLite (gitignored)
```

## Notes

- Generation runs as a fire-and-forget background task in the Node server process; the UI polls for
  progress. Run with `npm run dev` / `npm run start` (a long-lived Node process), not a serverless host.
- Generated images are written under `public/agents/<slug>/` and served statically.
- The UI/CSS is lifted verbatim from the PaperIQ operations command center; only the data source
  (SQLite instead of a hard-coded registry) and branding differ.
