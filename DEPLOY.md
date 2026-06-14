# Agent Forge — eyesense deploy

Public URL: **https://agent.paperiq.ai**

Same pattern as Patent Researcher: Docker on the home server (eyesense), CloudFront terminates HTTPS and forwards to `edgewater.homeip.net:8911`.

## Ports

| Service | Host port |
|---------|-----------|
| agent-forge web | **8911** |
| patent-researcher web | 8910 (existing) |

Forward **external TCP 8911** on your home router to the eyesense host.

## One-time server setup

```bash
ssh eyesense
git clone git@github.com:tguless/agent-forge.git ~/agent-forge
cd ~/agent-forge
cp .env.example .env.local   # or let deploy seed ANTHROPIC_* from patent-researcher
# Edit .env.local — add GEMINI_API_KEY for Nano Banana images (optional)
```

## Deploy from laptop

```bash
cd agent-forge
git add … && git commit … && git push origin main
./scripts/trigger-eyesense-deploy.sh
```

Or skip git check after push:

```bash
DEPLOY_SKIP_GIT_CHECK=1 ./scripts/trigger-eyesense-deploy.sh
```

## On-server redeploy

```bash
ssh eyesense 'cd ~/agent-forge && ./redeploy.sh'
```

## Terraform (CloudFront + DNS)

From the **llm-ocr** repo (not agent-forge):

```bash
cd terraform
terraform plan   # agent-forge-home-cloudfront.tf
terraform apply
```

Uses existing `*.paperiq.ai` ACM certificate.

## Health checks

```bash
./scripts/eyesense-status.sh
./scripts/eyesense-logs.sh 100
curl -sI https://agent.paperiq.ai/
```

## Persistent data

Docker volumes:

- `agent_forge_data` — SQLite (`forge.db`)
- `agent_forge_agents` — generated PNG assets under `/public/agents`
- `agent_forge_businesses` — generated business plaque PNGs under `/public/businesses`
- `agent_forge_tmp` — image pipeline temp files

## Open Graph banner

Social preview: `public/og-image.png` (uses C&C winged-emblem house style). Backup of the prior SaaS-style banner: `public/og-image.bak.png`.

Regenerate from llm-ocr repo root:

```bash
node scripts/generate-og-image.mjs \
  --slug agent-forge --style forge \
  --output agent-forge/public/og-image.png \
  --title "Agent Forge" \
  --subtitle "Tactical AI agent card generator" \
  --tagline "Describe a role. Forge an agent." \
  --accent "#38bdf8"
```

Commit `public/og-image.png` and redeploy for CloudFront to serve the new preview.

## Image pipeline notes

- **ImageMagick** white→alpha for icon/emblem transparency (pure `#FFFFFF` Gemini backgrounds).
- **Emblem classic (default):** rembg → `EMBLEM_WHITE_FUZZ=14%` → PIL trim/normalize — matches May 2026 Prior Auth look (soft glow preserved). rembg is auto-skipped when wing bbox shrinks below `EMBLEM_REMBG_MIN_RATIO` (default 72%) to avoid center-sculpture crop.
- **Emblem sharp:** `EMBLEM_PIPELINE=sharp` — magick-only defringe (no rembg); use when classic leaves too much white fringe.
- **Emblem normalize:** classic uses PIL alpha-bbox trim; magick fallback scales the **full frame** (no `-trim` crop — that was the Jun 8 wing crop bug).
- **rembg** is installed in Docker (`/app/.venv-rembg`). Icons always use rembg when available; emblems use rembg in classic mode with wing-span guard.
- Without `GEMINI_API_KEY`, agents still generate text/skills; images use placeholders.
- **Gemini image timeout:** default **10 minutes** per asset (`GEMINI_IMAGE_TIMEOUT_MS=600000`). 2K winged emblems can be slow; raise in `.env.local` if needed.
- **Stale forge detection:** default **45 minutes** without progress (`FORGE_STALE_GENERATING_MS`) — should exceed 3× image timeout plus skill-file writing.
- **Delete agents:** detail page → Delete profile → password `password` (override with `FORGE_DELETE_PASSWORD` in `.env.local`).
