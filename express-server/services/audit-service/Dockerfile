FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY services/audit-service ./services/audit-service
RUN npm ci || npm install
RUN npm run build -w @devdocs/audit-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/audit-service/dist ./dist
COPY --from=builder /app/services/audit-service/package.json ./package.json
EXPOSE 3010
CMD ["node", "dist/index.js"]
