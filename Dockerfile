FROM oven/bun:1-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json bun.lock* ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile
RUN bunx prisma generate

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DEPLOY_COMMIT=unknown
ARG DEPLOY_TIME=unknown
ARG NEXT_PUBLIC_APP_URL=https://workspace.mediend.com
ENV DEPLOY_COMMIT=$DEPLOY_COMMIT
ENV DEPLOY_TIME=$DEPLOY_TIME
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV DIRECT_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
RUN bun run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN apk add --no-cache openssl
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
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]

# Stage for running one-off migrations and tool scripts (full source + deps).
# Examples: prisma migrate deploy, db:seed:masters, scripts under scripts/.
FROM builder AS migrate
WORKDIR /app
CMD ["bun", "run", "migrate:case-stages-v2"]
