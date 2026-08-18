# syntax=docker/dockerfile:1

##
## 1) deps - install full dependency tree (needed for the Nest/TS build step)
##
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

##
## 2) build - generate the Prisma client and compile TypeScript
##
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
# NOTE: dev deps are intentionally kept so the Prisma CLI is available at
# runtime to sync the schema on first boot (skeleton has no migrations yet).
# For production, add real migrations and prune dev deps again.

##
## 3) runtime - minimal production image
##
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

# Pre-create the task-proof uploads dir owned by the runtime user, so a FRESH
# `uploads` named volume (POST /applications/:id/attachments/upload writes here)
# initializes writable by nestjs. An ALREADY-existing volume keeps its original
# ownership and is chowned once on the host — Docker only seeds a volume from the
# image on first mount.
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

USER nestjs

EXPOSE 3000
# On start: sync the Prisma schema to the DB (creates tables on first boot —
# idempotent), then launch. Replace `db push` with `migrate deploy` once real
# migrations exist.
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/main.js"]
