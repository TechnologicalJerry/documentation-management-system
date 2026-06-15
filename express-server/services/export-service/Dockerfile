FROM node:22-alpine AS builder
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY services/export-service ./services/export-service
RUN npm ci || npm install
RUN npm run build -w @devdocs/export-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/export-service/dist ./dist
COPY --from=builder /app/services/export-service/package.json ./package.json
EXPOSE 3007
CMD ["node", "dist/index.js"]
