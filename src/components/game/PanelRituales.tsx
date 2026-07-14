'use client'

import type { RitualPublicData } from '@/server/domain/tipos'
import { IconoElemento } from './IconoElemento'

export function PanelRituales({
  rituals,
  onRealizar,
}: {
  rituals: RitualPublicData[]
  onRealizar: (ritualId: string) => void
}) {
  if (rituals.length === 0) return null

  return (
    <section className="mb-7 rounded-lg mist-card p-5" aria-label="Rituales">
      <h2 className="font-[family-name:var(--font-display)] text-lg text-brass">Rituales</h2>
      <p className="mt-1 text-xs text-fog">
        Preparaciones pasivas necesarias para sobrevivir a ciertos avances.
      </p>
      <div className="mt-4 space-y-4">
        {rituals.map((ritual) => {
          const ready = ritual.ingredients.every((ingredient) => ingredient.discovered)
          return (
            <article key={ritual.id} className="rounded-md border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-parchment">{ritual.name}</h3>
                {ritual.isCompleted && (
                  <span className="rounded-full border border-brass-deep px-2 py-0.5 text-[10px] uppercase tracking-wider text-brass">
                    Preparado
                  </span>
                )}
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {ritual.ingredients.map((ingredient) => (
                  <li
                    key={ingredient.element.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                      ingredient.discovered
                        ? 'border-brass-deep text-parchment'
                        : 'border-line text-fog opacity-60'
                    }`}
                  >
                    <IconoElemento iconKey={ingredient.element.iconKey} className="h-4 w-4 text-brass" />
                    {ingredient.element.name} × {ingredient.quantity}
                  </li>
                ))}
              </ul>
              {!ritual.isCompleted && (
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => onRealizar(ritual.id)}
                  className="btn-brass mt-3 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Preparar ritual
                </button>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
