# Odometer: the built app and the API in one container on port 3001, with all data in /data.

# Build the app. It imports shared/ (logic the server uses too) from next to app/.
FROM node:22-alpine AS app-build
WORKDIR /build/app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY shared/ /build/shared/
COPY app/ ./
RUN npm run build

# Install the server's production dependencies.
FROM node:22-alpine AS server-deps
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Run: the server, which also serves the built app.
FROM node:22-alpine
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3001 \
    PUID=1000 \
    PGID=1000
WORKDIR /opt/odometer/server
COPY --from=server-deps /build/server/node_modules ./node_modules
COPY shared/ /opt/odometer/shared/
COPY server/ ./
COPY --from=app-build /build/app/dist /opt/odometer/app/dist
VOLUME /data
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1
# Starts as root only to give /data to PUID:PGID, then runs the server as that user (see docker-entrypoint.js).
CMD ["node", "docker-entrypoint.js"]
