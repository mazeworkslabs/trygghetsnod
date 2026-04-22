# Trygghetsnod portal + admin — multi-stage build.
#
# Stage 1: bygg admin-appen (React/Vite → statiska filer).
# Stage 2: installera portalens runtime-beroenden.
# Stage 3: minimal runtime — node, portalkoden, byggd admin-dist.

# ---- Stage 1: build admin ----
FROM node:20-alpine AS admin-builder
WORKDIR /admin
COPY trygghetsnod-admin/package.json trygghetsnod-admin/package-lock.json ./
RUN npm ci
COPY trygghetsnod-admin/ ./
RUN npm run build

# ---- Stage 2: install portal deps ----
FROM node:20-alpine AS portal-deps
WORKDIR /portal
COPY trygghetsnod-portal/package.json trygghetsnod-portal/package-lock.json ./
RUN npm ci --omit=dev

# ---- Stage 3: runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

# Portal-koden
COPY trygghetsnod-portal/src /app/trygghetsnod-portal/src
COPY trygghetsnod-portal/views /app/trygghetsnod-portal/views
COPY trygghetsnod-portal/public /app/trygghetsnod-portal/public
COPY trygghetsnod-portal/package.json /app/trygghetsnod-portal/

# Production node_modules
COPY --from=portal-deps /portal/node_modules /app/trygghetsnod-portal/node_modules

# Byggd admin
COPY --from=admin-builder /admin/dist /app/trygghetsnod-admin/dist

# Pekar på storage och kommuner via volym-mounts från host
ENV PORTAL_STORAGE_ROOT=/storage \
    PORTAL_MAPS=/storage/maps/pmtiles \
    PORTAL_ZIM=/storage/zim \
    PORTAL_ADMIN_DIST=/app/trygghetsnod-admin/dist \
    PORT=8400 \
    NODE_ENV=production

WORKDIR /app/trygghetsnod-portal
EXPOSE 8400

# KOMMUN-DIR uses default join(REPO_ROOT, 'kommuner', KOMMUN) where REPO_ROOT
# resolves to /app, so /app/kommuner/<kommun> needs to exist via mount.
# We symlink /kommuner (volume) into /app/kommuner.
RUN ln -s /kommuner /app/kommuner

CMD ["node", "src/server.js"]
