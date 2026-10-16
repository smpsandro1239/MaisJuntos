# syntax=docker/dockerfile:1

# ---------- Estágio 1: build do frontend (Vite) ----------
# Debian (glibc) para garantir binários nativos pré-compilados em todos os deploys
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Estágio 2: runtime de produção ----------
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server.ts tsconfig.json ./
COPY src ./src

EXPOSE 3000

CMD ["npm", "start"]
