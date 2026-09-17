# ---- Stage 1: builder ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.base.json tsconfig.node.json ./
COPY src ./src
RUN npm run typecheck:node
RUN npm run build:node

# ---- Stage 2: production ----
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist/node.js ./dist/node.js
EXPOSE 3000
CMD ["node", "dist/node.js"]
