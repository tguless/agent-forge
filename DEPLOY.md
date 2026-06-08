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

- **ImageMagick** + **rembg** (`rembg[cpu]` in `/app/.venv-rembg`, `REMBG_PYTHON` set in Docker).
- **Pillow** (`python3-pil`) and ImageMagick both handle trim/resize/normalize.
- Local dev: optional `.cursor/mcp-servers/rembg/.venv` or set `REMBG_PYTHON` in `.env.local`.
- Without `GEMINI_API_KEY`, agents still generate text/skills; images use placeholders.
