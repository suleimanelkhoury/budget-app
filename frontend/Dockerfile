# ── Frontend Dockerfile (multi-stage) ─────────
# Stage 1: Build the React app
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve the static build with nginx (unprivileged)
FROM nginx:alpine AS frontend

# Copy the build output to nginx's serve directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config (SPA fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Replace the main config with an unprivileged variant (writable pid /
# temp paths, logs on stdout/stderr) so nginx can run as non-root
COPY nginx.main.conf /etc/nginx/nginx.conf

# nginx:alpine ships an `nginx` user (uid 101); the static files are
# world-readable, so nothing needs chown-ing
USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
