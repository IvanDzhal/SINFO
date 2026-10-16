# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci --ignore-scripts

# build: повний набір залежностей; також використовується для одноразових задач (seed)
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts && npx prisma generate

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
COPY prisma ./prisma
USER node
EXPOSE 3000
# міграції застосовуються при кожному старті (idempotent)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
