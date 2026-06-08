FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public data
ARG NEXT_PUBLIC_APP_URL=https://agent.paperiq.ai
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Debian runner: rembg[cpu] + onnxruntime do not build on Alpine/musl.
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV REMBG_PYTHON=/app/.venv-rembg/bin/python3

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
  && /app/.venv-rembg/bin/python3 -c "from rembg import remove; print('rembg ok')" \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && rm /tmp/rembg-requirements.txt

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
