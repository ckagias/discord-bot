FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

HEALTHCHECK --interval=10s --timeout=5s --retries=10 --start-period=30s \
    CMD wget -q --spider http://127.0.0.1:${INTERNAL_API_PORT:-4000}/internal/health || exit 1

CMD ["node", "src/index.js"]