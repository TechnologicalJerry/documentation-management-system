FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY services/user-service ./services/user-service
RUN npm ci || npm install
RUN npm run prisma:generate -w @devdocs/user-service
RUN npm run build -w @devdocs/user-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/packages ./packages
COPY --from=builder --chown=appuser:appgroup /app/services/user-service/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/services/user-service/prisma ./prisma
COPY --from=builder --chown=appuser:appgroup /app/services/user-service/package.json ./package.json
USER appuser
EXPOSE 3002
CMD ["node", "dist/index.js"]
