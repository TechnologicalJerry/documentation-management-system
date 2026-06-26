FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY services/auth-service ./services/auth-service
RUN npm ci || npm install
RUN npm run prisma:generate -w @devdocs/auth-service
RUN npm run build -w @devdocs/auth-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/auth-service/dist ./dist
COPY --from=builder /app/services/auth-service/prisma ./prisma
COPY --from=builder /app/services/auth-service/package.json ./package.json
EXPOSE 3001
CMD ["node", "dist/index.js"]
