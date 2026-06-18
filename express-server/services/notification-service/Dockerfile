FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY services/notification-service ./services/notification-service
RUN npm ci || npm install
RUN npm run build -w @devdocs/notification-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages ./packages
COPY --from=builder --chown=appuser:appgroup /app/services/notification-service/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/services/notification-service/src/database/migrations ./src/database/migrations
COPY --from=builder --chown=appuser:appgroup /app/services/notification-service/package.json ./package.json
USER appuser
EXPOSE 3009
CMD ["node", "dist/index.js"]
