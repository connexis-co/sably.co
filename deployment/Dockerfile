# Debian provides the glibc runtime required by the workerd plugin sandbox.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
ARG SOURCE_REVISION=unversioned
ENV SOURCE_REVISION=$SOURCE_REVISION \
    SABLY_RUNTIME=node \
    SABLY_TARGET=production \
    SABLY_DATA_DIR=/app/data \
    DATABASE_PATH=/app/data/emdash.db \
    SABLY_DATABASE_PATH=/app/data/sably.db \
    EMDASH_SITE_URL=https://sably.co \
    PUBLIC_CDN_URL=https://cdn.sably.co \
    PUBLIC_LEADS_ENDPOINT=/api/v1/leads
RUN npm run build:node && npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ARG SOURCE_REVISION=unversioned
LABEL org.opencontainers.image.title="Sably EmDash" \
      org.opencontainers.image.revision=$SOURCE_REVISION
ENV NODE_ENV=production \
    SABLY_RUNTIME=node \
    SABLY_ENVIRONMENT=production \
    SABLY_DATA_DIR=/app/data \
    DATABASE_PATH=/app/data/emdash.db \
    SABLY_DATABASE_PATH=/app/data/sably.db \
    EMDASH_SITE_URL=https://sably.co \
    HOST=0.0.0.0 \
    PORT=4321
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/.emdash/migrations.json ./.emdash/migrations.json
COPY deployment/start.mjs deployment/start.mjs
RUN mkdir -p /app/data/uploads /app/data/sessions && chown -R node:node /app/data
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4321/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "deployment/start.mjs"]
