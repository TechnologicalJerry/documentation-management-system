FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY services/document-service ./services/document-service
RUN npm ci || npm install
RUN npm run build -w @devdocs/document-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/document-service/dist ./dist
COPY --from=builder /app/services/document-service/package.json ./package.json
EXPOSE 3004
CMD ["node", "dist/index.js"]
