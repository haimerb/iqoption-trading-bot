# ── Build stage ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock* ./
RUN yarn install --non-interactive

COPY . .

# La URL del API la inyecta docker-compose en tiempo de build
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN yarn build

# ── Runtime stage ─────────────────────────────────────────────────
FROM nginx:1.25-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración nginx para SPA (React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
