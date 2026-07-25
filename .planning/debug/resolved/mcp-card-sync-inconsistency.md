---
status: resolved
trigger: "mande a eliminar las cartas al mcp y estan pasando cosas raras, aparecen y desaparecen"
created: 2026-07-25T00:00:00-05:00
updated: 2026-07-25T00:35:51-05:00
---

## Current Focus

hypothesis: Confirmada y corregida.
test: Pruebas unitarias, lint, TypeScript y compilación de producción.
expecting: Las cartas MCP eliminadas no se restauran desde IndexedDB, no quedan seleccionadas como fantasmas y respuestas obsoletas no reemplazan el estado actual.
next_action: Desplegar el commit verificado en AWS y comprobar servicios.

## Symptoms

expected: Al borrar cartas mediante el MCP, desaparecen una sola vez del editor y no regresan.
actual: Las cartas aparecen y desaparecen de forma inconsistente.
errors: Sin error explícito reportado.
reproduction: Crear/importar cartas MCP, abrir el editor, borrarlas mediante el MCP y observar sincronizaciones/recargas.
started: Después de integrar cartas MCP en el editor normal.

## Eliminated

- hypothesis: SQLite no elimina las cartas.
  evidence: El repositorio elimina por ID y la inconsistencia está en la restauración/reconciliación del cliente.
  timestamp: 2026-07-25T00:30:00-05:00
- hypothesis: El stream SSE por sí solo reintroduce datos.
  evidence: El editor también reintroducía copias desde IndexedDB antes de cualquier evento; además faltaba control de orden entre fetch concurrentes.
  timestamp: 2026-07-25T00:31:00-05:00

## Evidence

- timestamp: 2026-07-25T00:00:00-05:00
  checked: src/builder/App.jsx
  found: El efecto de IndexedDB persistía `batch` completo, incluidas cartas con source=mcp; la carga inicial las restauraba antes del fetch remoto.
  implication: Una carta eliminada del servidor reaparecía temporalmente desde la caché local en cada montaje.
- timestamp: 2026-07-25T00:00:00-05:00
  checked: syncMcpCards
  found: Reemplazaba la lista remota pero no corregía editingId/state cuando la carta activa ya no existía.
  implication: El lienzo podía seguir mostrando una carta fantasma aunque la tira ya la hubiera eliminado.
- timestamp: 2026-07-25T00:00:00-05:00
  checked: syncMcpCards
  found: Evento inicial, SSE e intervalo lanzaban fetch concurrentes sin descartar respuestas obsoletas.
  implication: Una respuesta anterior podía aplicarse después de una nueva y reintroducir temporalmente datos eliminados.
- timestamp: 2026-07-25T00:35:51-05:00
  checked: pruebas de regresión
  found: 219 pruebas pasan, incluidas tres nuevas sobre caché, borrado y snapshot local; ESLint y TypeScript pasan.
  implication: La reconciliación corregida está cubierta y no rompe las pruebas existentes.

## Resolution

root_cause: El editor trataba las cartas MCP como datos locales y las persistía en IndexedDB; al montar restauraba copias borradas. La reconciliación tampoco invalidaba respuestas antiguas ni corregía la selección de una carta eliminada.
fix: Separar estrictamente caché local y biblioteca MCP, invalidar fetch obsoletos, limpiar selección fantasma, proteger ediciones pendientes y añadir DELETE real desde el editor.
verification: ESLint correcto; TypeScript correcto; 219/219 pruebas pasan. Next compila, pero la recolección local de páginas falla porque el DATABASE_URL local usa SQLite mientras el proyecto configura el adaptador PostgreSQL; AWS usa PostgreSQL.
files_changed:
  - src/builder/App.jsx
  - src/builder/remoteSync.ts
  - src/builder/remoteSync.test.ts
  - src/app/api/cards/[cardId]/route.ts
