# syntax=docker/dockerfile:1.7
FROM oven/bun:1-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
# Install deps first — only re-runs when package.json / bun.lock change.
COPY package.json bun.lock* ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
# Prisma generate is cheap and depends only on the schema.
COPY prisma ./prisma
RUN bunx prisma generate

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/generated ./generated
COPY . .
ARG DEPLOY_COMMIT=unknown
ARG DEPLOY_TIME=unknown
ARG NEXT_PUBLIC_APP_URL=https://workspace.mediend.com
ENV DEPLOY_COMMIT=$DEPLOY_COMMIT
ENV DEPLOY_TIME=$DEPLOY_TIME
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV DIRECT_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
# Persist Next.js incremental compile cache across builds.
RUN --mount=type=cache,target=/app/.next/cache \
    bun run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN apk add --no-cache openssl wget
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/valibot ./node_modules/valibot
COPY --from=builder /app/node_modules/effect ./node_modules/effect
RUN mkdir -p .next/cache \
  && chown -R nextjs:nodejs .next
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]

# Long-running BullMQ worker for bulk lead reassignment.
# Source + deps only — skips Next.js build to keep deploy memory usage low.
FROM base AS worker
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/generated ./generated
COPY . .
ENV NODE_ENV=production
CMD ["bun", "run", "worker:bulk-reassign"]

# Stage for running one-off migrations and tool scripts (full source + deps).
# Examples: prisma migrate deploy, db:seed:masters, scripts under scripts/.
FROM builder AS migrate
WORKDIR /app
CMD ["bun", "run", "migrate:case-stages-v2"]

# Stage for running the one-off actual-costs backfill (copies existing implant/instrument costs to new actual fields).
FROM builder AS backfill-actual-costs
WORKDIR /app
CMD ["bun", "run", "backfill-actual-costs"]
