# ---------- Compilación ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

COPY package.json package-lock.json* ./
# El npm que trae node:22 (10.x) poda el arbol distinto al que genera el
# lockfile y da EUSAGE en npm ci. Se fija la misma version con la que se
# escribe package-lock.json; hay que moverla si cambia la de desarrollo.
RUN npm i -g npm@11.6.2 && npm ci

COPY . .
# Las rutas son dinámicas: el build genera el cliente sin consultar PostgreSQL.
RUN npx prisma generate && npm run build

# ---------- Ejecución ----------
FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && npx playwright install --with-deps chromium \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/src ./src
COPY --from=build /app/mcp ./mcp
COPY --from=build /app/next.config.ts ./next.config.ts

# /app/data conserva cards.db y las exportaciones del generador de cartas.
VOLUME /app/data
EXPOSE 3000
EXPOSE 3101

# La estructura se migra; el contenido autoritativo ya vive en PostgreSQL.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
