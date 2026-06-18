FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY services/file-service ./services/file-service
RUN npm ci || npm install
RUN npm run build -w @devdocs/file-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache vips-dev fftw-dev glib && \
    addgroup -S appgroup && adduser -S appuser -G appgroup && \
    mkdir -p /var/uploads && chown appuser:appgroup /var/uploads
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages ./packages
COPY --from=builder --chown=appuser:appgroup /app/services/file-service/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/services/file-service/package.json ./package.json
USER appuser
EXPOSE 3008
CMD ["node", "dist/index.js"]
