'use client'

import React from 'react'
import { Check, LockKeyhole, ShieldCheck } from 'lucide-react'
import type { PublicRitualState } from '@/server/domain/ritualKnowledge'
import { IconoElemento } from './IconoElemento'

export function PanelRituales({
  ritualState,
  actionLoading,
  onRealizar,
}: {
  ritualState: PublicRitualState
  actionLoading: boolean
  onRealizar: (ritualId: string) => void
}) {
  if (ritualState.status === 'HIDDEN') return null

  if (ritualState.status === 'SEALED') {
    return (
      <section
        className="mb-7 rounded-lg border border-line2 bg-panel/80 p-5"
        aria-labelledby="ritual-sellado-titulo"
      >
        <div className="flex items-start gap-4">
          <div className="rounded-full border border-line2 bg-ink/60 p-3 text-fog" aria-hidden>
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-fog">
              Conocimiento bloqueado
            </p>
            <h2
              id="ritual-sellado-titulo"
              className="font-[family-name:var(--font-arcana)] text-lg text-parchment"
            >
              Conocimiento ritual sellado
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fog">
              Has alcanzado una frontera que un avance por sí solo no puede superar. El método
              necesario permanece fuera de tu comprensión.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-7 rounded-lg mist-card p-5" aria-labelledby="rituales-titulo">
      <h2
        id="rituales-titulo"
        className="font-[family-name:var(--font-arcana)] text-lg text-brass"
      >
        Preparaciones rituales
      </h2>
      <p className="mt-1 text-xs text-fog">
        Prepara una protección antes de aplicar el avance correspondiente.
      </p>

      <div className="mt-5 space-y-5">
        {ritualState.groups.map((group) => (
          <article key={group.groupKey} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="rounded-full border border-brass-deep/60 bg-ink/50 p-2.5" aria-hidden>
                <IconoElemento
                  iconKey={group.sourceSequence.iconKey}
                  className="h-5 w-5 text-brass"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-parchment">
                  Preparación para la siguiente ascensión de {group.sourceSequence.name}
                </h3>
                <p className="mt-0.5 text-xs text-fog">
                  Secuencia {group.sourceSequence.number} · {group.sourceSequence.pathwayName}
                </p>
              </div>
              {group.protected && (
                <span className="flex items-center gap-1.5 rounded-full border border-spectral px-2.5 py-1 text-[10px] uppercase tracking-wider text-spectral">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  Ascensión protegida
                </span>
              )}
            </div>

            {group.options.length > 1 && !group.protected && (
              <p className="mt-4 text-xs italic text-fog">
                Completa una de estas preparaciones.
              </p>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {group.options.map((option) => {
                const discovered = option.ingredients.filter(
                  (ingredient) => ingredient.discovered,
                ).length
                return (
                  <section
                    key={option.ritualId}
                    className="rounded-md border border-line2 bg-ink/30 p-4"
                    aria-label={option.optionLabel}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium text-parchment">{option.optionLabel}</h4>
                      {option.completed && (
                        <span className="flex items-center gap-1 text-xs text-spectral">
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          Preparación completada
                        </span>
                      )}
                    </div>

                    <ul className="mt-3 space-y-2">
                      {option.ingredients.map((ingredient, index) => (
                        <li
                          key={`${ingredient.name}-${index}`}
                          className="flex items-center gap-2 rounded border border-line/70 px-3 py-2 text-xs"
                        >
                          <IconoElemento
                            iconKey={ingredient.iconKey}
                            className="h-4 w-4 shrink-0 text-brass"
                          />
                          <span className="min-w-0 flex-1 truncate text-parchment">
                            {ingredient.name} × {ingredient.quantity}
                          </span>
                          <span className={ingredient.discovered ? 'text-spectral' : 'text-fog'}>
                            {ingredient.discovered ? 'Descubierto' : 'No descubierto'}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-3 text-xs text-fog">
                      Ingredientes descubiertos: {discovered}/{option.ingredients.length}
                    </p>

                    {!option.completed && !group.protected && (
                      <button
                        type="button"
                        disabled={!option.canPerform || actionLoading}
                        onClick={() => onRealizar(option.ritualId)}
                        className="btn-brass mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Preparar ${option.optionLabel}`}
                      >
                        {actionLoading ? 'Preparando…' : 'Preparar ritual'}
                      </button>
                    )}
                  </section>
                )
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
