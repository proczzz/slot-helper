# ---- Stage 1: builder ----
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.base.json tsconfig.node.json ./
COPY src ./src
RUN npm run typecheck:node
RUN npm run build:node

# ---- Stage 2: production ----
FROM node:24-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist/node.cjs ./dist/node.cjs
EXPOSE 3000
CMD ["node", "--env-file-if-exists=.env", "dist/node.cjs"]
