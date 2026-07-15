'use client'

import { X } from 'lucide-react'
import type { CombineResult } from '@/server/domain/tipos'
import { IconoElemento } from './IconoElemento'
import { type ElementoDescubierto } from './tipos'
import type { DestinoArrastre, PayloadArrastre } from './useArrastre'

export function MesaCombinacion({
  slots,
  combinando,
  resultado,
  fallo,
  onRetirar,
  onLimpiar,
  onUsarResultado,
  iniciarArrastre,
  objetivo,
}: {
  slots: (ElementoDescubierto | null)[]
  combinando: boolean
  resultado: CombineResult | null
  fallo: number
  onRetirar: (i: number) => void
  onLimpiar: () => void
  onUsarResultado: (elementId: string) => void
  iniciarArrastre: (e: React.PointerEvent, payload: PayloadArrastre) => void
  objetivo: DestinoArrastre
}) {
  return (
    <section aria-label="Área de combinación">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg text-parchment">
        Mesa de combinación
      </h2>
      <p className="mb-5 text-sm text-fog">
        Arrastra un elemento <span className="text-brass">sobre otro</span> para
        combinarlos: al instante en la lista, o soltándolos en estos dos espacios.
      </p>

      <div
        key={fallo}
        className={`flex flex-wrap items-center justify-center gap-4 ${fallo > 0 && !resultado?.success ? 'anim-shake' : ''}`}
      >
        {slots.map((el, i) => {
          const esObjetivo = objetivo?.tipo === 'slot' && objetivo.index === i
          return (
            <div
              key={i}
              data-drop-slot={i}
              className={`relative flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-lg border-2 transition ${
                el ? 'mist-card border-brass-deep' : 'border-dashed border-line2'
              } ${esObjetivo ? 'scale-105 ring-2 ring-brass' : ''}`}
            >
              {el ? (
                <>
                  <div
                    onPointerDown={(e) =>
                      iniciarArrastre(e, {
                        slug: el.slug,
                        name: el.name,
                        iconKey: el.iconKey,
                        origen: { tipo: 'slot', index: i },
                      })
                    }
                    className="flex touch-none select-none flex-col items-center gap-2"
                  >
                    <IconoElemento iconKey={el.iconKey} className="h-12 w-12 text-brass" />
                    <span className="px-2 text-center text-sm text-parchment">{el.name}</span>
                    {el.sequenceLabel && (
                      <span className="rounded-full border border-brass-deep px-2 py-0.5 text-[10px] leading-tight text-brass">
                        {el.sequenceLabel}
                      </span>
                    )}
                    {el.derivationLabel && (
                      <span className="px-2 text-center text-[10px] leading-tight text-brass-deep">
                        {el.derivationLabel}
                      </span>
                    )}
                  </div>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onRetirar(i)}
                    aria-label={`Retirar ${el.name} del espacio ${i + 1}`}
                    className="absolute right-1.5 top-1.5 rounded-full p-1 text-fog hover:bg-panel2 hover:text-parchment"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </>
              ) : (
                <span className="px-4 text-center text-xs uppercase tracking-widest text-fog/70">
                  Espacio {i + 1}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {(slots[0] || slots[1]) && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={onLimpiar}
            className="rounded-md border border-line2 px-5 py-2.5 text-sm text-fog hover:text-parchment"
          >
            Limpiar
          </button>
        </div>
      )}

      <div className="mt-8 min-h-40" aria-live="polite">
        {combinando && <p className="text-center italic text-fog">Combinando…</p>}
        {resultado && !resultado.success && (
          <p className="text-center italic text-fog">{resultado.message}</p>
        )}
        {resultado && resultado.results.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4">
            {resultado.results.map((r, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onUsarResultado(r.element.id)}
                aria-label={`Usar ${r.element.name} en el primer espacio de la mesa`}
                className="anim-pop mx-auto max-w-sm rounded-lg mist-card brass-ring p-5 text-center transition hover:border-brass-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                {r.isNewDiscovery && (
                  <span className="mb-2 inline-block rounded-full border border-brass px-3 py-0.5 text-xs uppercase tracking-widest text-brass">
                    {r.element.kind === 'ADVANCE' ? '¡Nuevo avance!' : '¡Nuevo descubrimiento!'}
                  </span>
                )}
                <div className="anim-glow mx-auto my-3 flex h-20 w-20 items-center justify-center rounded-full border border-brass-deep">
                  <IconoElemento iconKey={r.element.iconKey} className="h-10 w-10 text-brass" />
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-xl text-parchment">
                  {r.element.name}
                  {r.quantity > 1 && (
                    <span className="ml-2 text-sm text-brass-deep">x{r.quantity}</span>
                  )}
                </h3>
                {r.element.sequenceLabel && (
                  <p className="mt-2 text-xs text-brass">{r.element.sequenceLabel}</p>
                )}
                {r.element.description && (
                  <p className="mt-2 text-sm italic text-fog">{r.element.description}</p>
                )}
                {r.element.derivationLabel && (
                  <p className="mt-2 text-xs text-brass-deep">
                    Derivado de: {r.element.derivationLabel}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
