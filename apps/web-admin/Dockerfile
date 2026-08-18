# syntax=docker/dockerfile:1.4
# Multi-stage build for the React 19 + Vite admin SPA.
# Built/run by infra/docker-compose.yml (service "web-admin"); the gateway
# nginx (infra/nginx/) reverse-proxies to this container on port 80.

# ---------------------------------------------------------------------
# Stage 1: build the static assets
# ---------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first for better layer caching. BuildKit cache mount persists
# npm's download cache across builds so repeated deploys are much faster.
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci || npm install

COPY . .
RUN npm run build

# ---------------------------------------------------------------------
# Stage 2: serve the build with nginx
# ---------------------------------------------------------------------
FROM nginx:alpine AS runtime

# SPA config: fall back to index.html for client-side routing, and cache
# hashed static assets aggressively. Written inline so no extra file is
# needed in this app's source tree.
RUN rm -f /etc/nginx/conf.d/default.conf
RUN <<'EOF' cat > /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:css|js|mjs|svg|jpg|jpeg|png|gif|ico|webp|woff2?|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
}
EOF

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
