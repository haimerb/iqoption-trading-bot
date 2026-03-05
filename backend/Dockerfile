# ── Build stage ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock* ./
RUN yarn install --production --non-interactive

# ── Runtime stage ─────────────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production

WORKDIR /app

# Usuario no-root
RUN addgroup -g 1001 -S nodeapp && adduser -S -u 1001 -G nodeapp nodeapp

COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodeapp:nodeapp . .

# Directorio de logs
RUN mkdir -p logs && chown nodeapp:nodeapp logs

USER nodeapp

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/bot/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
