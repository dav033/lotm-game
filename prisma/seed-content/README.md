# Catálogos del seed

Estos módulos solo declaran datos. `../seed-data.ts` conserva las operaciones
Prisma, las migraciones de compatibilidad y el orden de escritura.

- `elements.ts`: elementos y su categoría principal.
- `sequences.ts`: secuencias asociadas a cada camino.
- `recipes.ts`: ingredientes y resultados de recetas.
- `advances.ts`: fórmulas y transiciones de avance.
- `rituals.ts`: rituales configurados mediante el catálogo común.

Al modificar contenido, ejecuta `npm test` y `npm run db:seed`. Las pruebas de
`catalogs.test.ts` detectan referencias inexistentes y claves duplicadas.
