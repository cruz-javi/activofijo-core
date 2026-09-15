FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.5.2 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY tsconfig*.json prisma.config.ts prisma.legacy.config.ts ./
COPY prisma ./prisma
RUN pnpm prisma:generate

COPY src ./src
RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.5.2 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/infrastructure/persistence/core/generated ./dist/src/infrastructure/persistence/core/generated
COPY --from=builder /app/src/infrastructure/persistence/legacy/generated ./dist/src/infrastructure/persistence/legacy/generated

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/src/main.js"]
