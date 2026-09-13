FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Build-time placeholders only. App Runner overrides AUTH_* at runtime.
ENV AUTH_SECRET=build-placeholder
ENV AUTH_URL=http://localhost:8080
RUN npx prisma generate && npm run build \
  && chmod +x scripts/start-prod.sh

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["./scripts/start-prod.sh"]
