# Build from the repo root: docker build -f apps/server/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @quad/server...
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @quad/server build \
 && pnpm --filter @quad/server deploy --prod --legacy /out

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/server/package.json ./
COPY --from=build /repo/apps/server/dist ./dist
COPY --from=build /repo/apps/server/drizzle ./drizzle
USER node
EXPOSE 4000
# Apply pending migrations, then start. Seed with: node dist/scripts/seed-universities.js
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/index.js"]
