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
RUN npm prune --omit=dev

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

USER nestjs

EXPOSE 3000
CMD ["node", "dist/main.js"]
