# Stage 1: Dependencies installation
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY apps/web/package.json ./apps/web/
WORKDIR /app/apps/web
RUN npm install

# Stage 2: Application Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
WORKDIR /app/apps/web
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

RUN if [ -f ./apps/web/server.js ] && [ ! -f ./server.js ]; then cp ./apps/web/server.js ./server.js; fi && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
