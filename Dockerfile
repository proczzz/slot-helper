# ---- Stage 1: builder ----
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.base.json tsconfig.node.json tsconfig.web.json vite.config.ts ./
COPY src ./src
RUN npm run typecheck:node
RUN npm run build:node
RUN npm run build:web

# ---- Stage 2: production ----
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist/node.cjs ./dist/node.cjs
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "dist/node.cjs"]
