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

# Stage 2: Serve the static build with nginx
FROM nginx:alpine AS frontend

# Copy the build output to nginx's serve directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config (SPA fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
