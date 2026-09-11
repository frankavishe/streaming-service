# Multi-stage build: a shared dependency/build stage, then two runtime targets — `api` (no
# ffmpeg needed) and `worker` (installs ffmpeg for the transcode pipeline). Same NestJS source
# for both, so trailer/media DTOs and Prisma models are never duplicated (plan.md Structure
# Decision).

FROM node:20-alpine AS build
WORKDIR /app
# Prisma's query/schema engine needs OpenSSL to be present to detect the right engine binary on
# musl (Alpine) — without it, "Could not parse schema engine response" at runtime.
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
# Compiled separately from the Nest build (prisma/ is outside src/'s rootDir) so the seed script
# can run as plain Node in the production image without devDependencies like ts-node.
RUN npx tsc prisma/seed.ts --outDir dist/prisma --module commonjs --target ES2021 \
      --esModuleInterop --skipLibCheck --resolveJsonModule

FROM node:20-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/main.js"]

FROM node:20-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache ffmpeg openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
CMD ["node", "dist/worker/main.worker.js"]
