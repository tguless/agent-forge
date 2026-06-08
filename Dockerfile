FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public data
ARG NEXT_PUBLIC_APP_URL=https://agent.paperiq.ai
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Debian runner: rembg[cpu] + onnxruntime; same glibc as builder (better-sqlite3).
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV REMBG_PYTHON=/app/.venv-rembg/bin/python3
ENV U2NET_HOME=/app/.u2net
ENV NUMBA_CACHE_DIR=/app/.forge_tmp/numba

COPY docker/rembg-requirements.txt /tmp/rembg-requirements.txt

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    gosu \
    imagemagick \
    python3 \
    python3-pil \
    python3-venv \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -m venv /app/.venv-rembg \
  && /app/.venv-rembg/bin/pip install --no-cache-dir --upgrade pip \
  && /app/.venv-rembg/bin/pip install --no-cache-dir -r /tmp/rembg-requirements.txt \
  && mkdir -p /app/.u2net \
  && /app/.venv-rembg/bin/python3 -c "import base64; from rembg import remove; remove(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ZkAAAAASUVORK5CYII=')); print('u2net cached')" \
  && /app/.venv-rembg/bin/python3 -c "from rembg import remove; print('rembg ok')" \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && chown -R nextjs:nodejs /app/.u2net \
  && rm /tmp/rembg-requirements.txt

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/rembg-remove.py /app/docker/rembg-remove.py
RUN chmod +x /entrypoint.sh /app/docker/rembg-remove.py
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
