'use client'

import { IconoElemento } from './IconoElemento'
import type { RecetaPendiente } from './tipos'

// Panel de depuración (solo visible con sesión de admin): recetas activas que
// el perfil aún no ha descubierto por completo. Un clic autocompleta la mesa
// con sus ingredientes para probar la combinación al instante.
export function RecetasPendientes({
  pendientes,
  onAutocompletar,
}: {
  pendientes: RecetaPendiente[]
  onAutocompletar: (recipeId: string) => void
}) {
  if (pendientes.length === 0) return null

  return (
    <section aria-label="Recetas pendientes (admin)" className="mb-8 rounded-lg border border-line2 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm uppercase tracking-widest text-fog">
        Recetas pendientes
        <span className="rounded-full border border-line2 px-2 py-0.5 text-xs text-fog">
          {pendientes.length}
        </span>
      </h2>
      <p className="mb-3 text-xs text-fog">
        Solo tú la ves (sesión de admin). Clic para cargar los ingredientes en la mesa.
      </p>
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {pendientes.map((r) => (
          <li key={r.recipeId}>
            <button
              type="button"
              onClick={() => onAutocompletar(r.recipeId)}
              className="flex w-full flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-fog hover:bg-panel2 hover:text-parchment"
            >
              {r.ingredientes.map((ing, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  {idx > 0 && <span aria-hidden>+</span>}
                  <IconoElemento iconKey={ing.iconKey} className="h-3.5 w-3.5 text-brass" />
                  {ing.name}
                  {ing.quantity > 1 && <span>×{ing.quantity}</span>}
                </span>
              ))}
              <span aria-hidden className="text-brass-deep">→</span>
              {r.resultados.map((res, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  {idx > 0 && <span aria-hidden>,</span>}
                  <IconoElemento iconKey={res.iconKey} className="h-3.5 w-3.5 text-brass" />
                  {res.name}
                </span>
              ))}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
