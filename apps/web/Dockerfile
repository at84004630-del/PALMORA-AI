# Stage 1: Dependencies installation
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN npm install -g pnpm

# Copy workspace package manifests and lockfile
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm install --frozen-lockfile || pnpm install

# Stage 2: Application Builder
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY . .

# Build shared types contract package first, then Next.js web application
RUN pnpm --filter @palmora/shared-types build && \
    pnpm --filter @palmora/web build

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output and static assets
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Ensure server.js entrypoint can be executed directly via CMD ["node", "server.js"]
RUN if [ -f ./apps/web/server.js ] && [ ! -f ./server.js ]; then cp ./apps/web/server.js ./server.js; fi && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
