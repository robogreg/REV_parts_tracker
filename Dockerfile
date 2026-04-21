FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# NODE_ENV=production is required so next.config.ts applies the production config (withPWA)
# and so NEXT_PUBLIC_ vars from .env.production are picked up at build time.
ENV NODE_ENV=production
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
# Provide runtime env vars to API routes (NEXT_PUBLIC_* and server-only vars).
# NEXT_PUBLIC_* are also baked into the client bundle at build time (above),
# but server-side Node.js code needs them from the filesystem at startup.
COPY .env.production .env.production

EXPOSE 8080
CMD ["npm", "start"]
