FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci 2>&1 | tail -1
COPY . .
RUN npm ls tailwindcss postcss autoprefixer 2>&1 | head -5
RUN npx vite build 2>&1
RUN wc -c /app/dist/assets/index-*.css
RUN head -3 /app/dist/assets/index-*.css

FROM alpine:3.19
RUN apk add --no-cache nodejs
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY api/_server.js ./server.js
EXPOSE 3000
CMD ["node", "server.js"]
