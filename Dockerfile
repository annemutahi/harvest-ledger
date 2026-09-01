# Frontend (TanStack Start / Vite SSR) — build for a Node server, then run it
FROM node:22-slim AS build

WORKDIR /app

# Public API base URL is baked in at build time
ARG VITE_API_URL=http://localhost:8000/api
ENV VITE_API_URL=$VITE_API_URL

# Build a plain Node server bundle (default build targets Cloudflare Workers,
# which produces no runnable server for Docker).
ENV NITRO_PRESET=node-server

COPY package.json bun.lock* package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server/index.mjs"]
