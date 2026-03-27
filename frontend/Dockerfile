# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
