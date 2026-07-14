# ---------- Compilación ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# Cliente Prisma + compilación de Next (DATABASE_URL solo para el generate).
ENV DATABASE_URL="file:./data/game.db"
RUN npx prisma generate && npm run build

# ---------- Ejecución ----------
FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="file:./data/game.db"

COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/src ./src
COPY --from=build /app/next.config.ts ./next.config.ts

# La base vive en /app/data: monta un volumen aquí para persistirla.
VOLUME /app/data
EXPOSE 3000

# Migraciones + seed (idempotente) y arranque.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npm run start"]
