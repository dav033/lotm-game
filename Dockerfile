# ---------- Compilación ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# Las rutas son dinámicas: el build genera el cliente sin consultar PostgreSQL.
RUN npx prisma generate && npm run build

# ---------- Ejecución ----------
FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/src ./src
COPY --from=build /app/next.config.ts ./next.config.ts

# /app/data conserva cards.db y las exportaciones del generador de cartas.
VOLUME /app/data
EXPOSE 3000

# La estructura se migra; el contenido autoritativo ya vive en PostgreSQL.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
