# Archivo de Misterios

Un juego web de combinación y descubrimiento de ambientación victoriana y
esotérica, inspirado en la mecánica de Little Alchemy. Combinas dos elementos
(que nunca se gastan: son conceptos) para descubrir otros nuevos, hasta cruzar
la frontera de lo mundano.

El proyecto también incluye, en `/cartas`, el generador de cartas para TikTok
que ya existía en este repositorio.

## Stack

- Next.js (App Router) + React + TypeScript estricto
- Tailwind CSS 4
- Prisma ORM 7 + SQLite (`@prisma/adapter-better-sqlite3`)
- Zod para validación
- Vitest para pruebas
- Sin servicios externos: todo corre en tu máquina

## 1 · Instalar dependencias

```bash
npm install
```

## 2 · Configurar el entorno

Copia el ejemplo y ajusta los valores:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env
# Linux / macOS
cp .env.example .env
```

Variables:

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Ruta del archivo SQLite. Por defecto `file:./data/game.db` |
| `ADMIN_PASSWORD` | Contraseña del panel de administración |
| `ADMIN_SESSION_SECRET` | Secreto (mínimo 16 caracteres) que firma la cookie de sesión admin |

## 3 · Crear la base de datos

```bash
npm run db:migrate
```

Esto crea `data/game.db` y aplica todas las migraciones.

## 4 · Cargar los datos iniciales

```bash
npm run db:seed
```

El seed es **idempotente**: puedes ejecutarlo las veces que quieras sin
duplicar datos. Crea las categorías (Mundano, Conceptos, Misticismo,
Beyonder), los 8 elementos, el Camino del Vidente con su Secuencia 9 y las 5
recetas iniciales.

## 5 · Iniciar la aplicación

```bash
npm run dev        # desarrollo (http://localhost:3000)
# o bien
npm run build && npm run start   # producción
```

Rutas principales:

| Ruta | Qué es |
| --- | --- |
| `/` | El juego |
| `/coleccion` | Enciclopedia y progreso |
| `/cartas` | Generador de cartas (app anterior) |
| `/admin/login` | Acceso del administrador |

## 6 · Entrar al panel administrativo

1. Abre `http://localhost:3000/admin/login` (también hay un icono de llave
   discreto en la cabecera del juego).
2. Introduce la `ADMIN_PASSWORD` de tu `.env`.
3. La sesión dura 8 horas y se guarda en una cookie firmada HTTP-only.

## 7 · Crear un elemento

1. Panel → **Elementos** → «Nuevo elemento».
2. Rellena nombre visible (p. ej. «Espejo») e identificador (`espejo`,
   minúsculas y sin acentos — es inmutable una vez usado).
3. Elige tipo, icono, categorías y si estará oculto hasta descubrirse.
4. Guarda. No hace falta reiniciar nada.

## 8 · Crear una receta

1. Panel → **Recetas** → «Nueva receta».
2. Busca y añade ingredientes (puedes repetir el mismo: Ojo × 2). La primera
   versión del juego exige exactamente **dos unidades** en total.
3. Elige el resultado y, si quieres, un texto de éxito y una pista.
4. La previsualización muestra `Ojo × 2 → Visión` y la clave interna
   calculada automáticamente; si ya existe una receta equivalente (sin
   importar el orden), te avisará.
5. Puedes pulsar «Probar combinación» antes de guardar.
6. Al guardar, la receta **funciona inmediatamente** en el juego.

Consejo: la página **Combinaciones fallidas** lista lo que los jugadores ya
intentaron sin éxito, con un botón que abre el formulario de receta con los
ingredientes precargados.

## 9 · Copia de seguridad

- **Contenido del juego** (elementos, recetas, categorías, caminos): Panel →
  **Importar / Exportar** → «Descargar JSON». Ese archivo se puede volver a
  importar en modo *fusionar* o *reemplazar*.
- **Todo, incluido el progreso de jugadores**: copia el archivo SQLite
  completo (con la aplicación detenida): `data/game.db`.

## 10 · ¿Dónde está el archivo SQLite?

En `./data/game.db` (configurable con `DATABASE_URL`). La carpeta `data/`
está fuera del control de versiones.

## 11 · Reiniciar el progreso de prueba

- Como jugador: botón «Reiniciar progreso» en la cabecera del juego (borra
  descubrimientos, desbloqueos y estadísticas de TU perfil y vuelve a
  entregar Ojo, Moneda y Humano).
- Base de datos completa desde cero: borra `data/game.db` y repite los pasos
  3 y 4.

## 12 · Despliegue con almacenamiento persistente

La única pieza con estado es `data/game.db`; móntala en un volumen persistente.

Con Docker:

```bash
docker build -t archivo-de-misterios .
docker run -p 3000:3000 \
  -v archivo_datos:/app/data \
  -e ADMIN_PASSWORD="una-contrasena-fuerte" \
  -e ADMIN_SESSION_SECRET="un-secreto-largo-y-aleatorio" \
  archivo-de-misterios
```

El contenedor aplica las migraciones y el seed (idempotente) al arrancar. En
cualquier VPS o PaaS que soporte volúmenes (Fly.io, Railway con volumen,
etc.) el requisito es el mismo: persistir `/app/data`.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run start` | Servir la compilación |
| `npm run lint` | ESLint |
| `npm run test` | Pruebas (Vitest; usan una BD temporal propia) |
| `npm run db:migrate` | Crear/actualizar la base de datos (desarrollo) |
| `npm run db:deploy` | Aplicar migraciones (producción) |
| `npm run db:seed` | Datos iniciales (idempotente) |
| `npm run db:studio` | Prisma Studio para inspeccionar la BD |

## Arquitectura (resumen)

- `src/server/domain/` — lógica pura del juego (normalización de recetas,
  combinación, diagnóstico). No conoce Next ni la base concreta.
- `src/server/services/` — casos de uso de administración (recetas,
  import/export).
- `src/server/actions/` — Server Actions; **cada mutación revalida la sesión
  admin** por su cuenta.
- `src/app/api/` — Route Handlers del juego (perfil por cookie HTTP-only).
- SQLite entra únicamente por `src/server/db.ts` (adaptador Prisma):
  sustituirlo por PostgreSQL no toca la lógica del juego.
