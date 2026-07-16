FROM node:26-alpine AS build

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY . .
RUN npx tsc

FROM node:26-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node

HEALTHCHECK --interval=10s --timeout=5s --retries=10 --start-period=30s \
    CMD wget -q --spider http://127.0.0.1:${INTERNAL_API_PORT:-4000}/internal/health || exit 1

CMD ["node", "dist/src/index.js"]
