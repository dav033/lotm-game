'use client'

import { useMemo } from 'react'
import { ArrowRight, Milestone } from 'lucide-react'
import type { VistaFases } from '@/server/services/fasesProgresion'
import type { AristaArbol, NodoArbol } from './tipos'
import { construirResumenFases } from './modeloResumenFases'

const ETIQUETA_INTERACCION: Record<AristaArbol['tipo'], string> = {
  receta: 'Receta',
  creacion: 'Creación',
  ascension: 'Ascensión',
  requisito: 'Requisito',
  ritual: 'Ritual',
  desbloqueo: 'Desbloqueo',
  'requisito-conjunto': 'Conjunto',
  fallo: 'Fallo',
}

export function ResumenFases({
  fases,
  grafo,
  onAbrirFase,
}: {
  fases: VistaFases
  grafo: { nodos: NodoArbol[]; aristas: AristaArbol[] }
  onAbrirFase: (id: string) => void
}) {
  const resumen = useMemo(() => construirResumenFases({
    fases: fases.phases,
    avances: fases.advances,
    recetas: fases.recipes,
    nodos: grafo.nodos,
    aristas: grafo.aristas,
  }), [fases, grafo])
  const nombrePorId = new Map(resumen.fases.map((fase) => [fase.id, fase.nombre]))
  const salientesPorFase = new Map<string, typeof resumen.interacciones>()
  for (const interaccion of resumen.interacciones) {
    salientesPorFase.set(interaccion.origenId, [
      ...(salientesPorFase.get(interaccion.origenId) ?? []),
      interaccion,
    ])
  }
  const totalCruces = resumen.interacciones.reduce(
    (total, interaccion) => total + interaccion.total,
    0,
  )
  const totalFases = resumen.fases.filter((fase) => !fase.esPool).length

  return (
    <section
      aria-labelledby="titulo-resumen-fases"
      className="overflow-hidden rounded-xl border border-line2 bg-panel/35"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-panel/65 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brass/35 bg-brass/10 text-brass">
            <Milestone aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <h2
              id="titulo-resumen-fases"
              className="font-[family-name:var(--font-display)] text-lg text-parchment"
            >
              Flujo entre fases
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-fog">
              Cada cruce cuenta una combinación una sola vez, aunque reúna varios ingredientes o resultados.
            </p>
          </div>
        </div>
        <p className="rounded-full border border-line px-2.5 py-1 text-xs tabular-nums text-fog">
          {totalFases} {totalFases === 1 ? 'fase' : 'fases'} · {totalCruces}{' '}
          {totalCruces === 1 ? 'cruce' : 'cruces'}
        </p>
      </header>

      {resumen.fases.length === 0 ? (
        <p className="m-4 rounded-lg border border-line bg-black/20 p-4 text-sm text-fog">
          Todavía no hay fases ni contenido activo que resumir.
        </p>
      ) : (
        <ol className="divide-y divide-line/80">
          {resumen.fases.map((fase) => {
            const salientes = salientesPorFase.get(fase.id) ?? []
            const totalSalientes = salientes.reduce(
              (total, interaccion) => total + interaccion.total,
              0,
            )
            const metricas = [
              ['Elementos', fase.conteos.elementos],
              ['Secuencias', fase.conteos.secuencias],
              ['Avances', fase.conteos.avances],
              ['Rituales', fase.conteos.rituales],
            ] as const

            return (
              <li key={fase.id} className="grid xl:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.4fr)]">
                <div className="border-b border-line/80 p-4 sm:p-5 xl:border-b-0 xl:border-r">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-brass-deep">
                        {fase.esPool ? 'Contenido sin asignar' : `Orden ${fase.sortOrder}`}
                      </p>
                      {fase.esPool ? (
                        <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg text-parchment">
                          {fase.nombre}
                        </h3>
                      ) : (
                        <h3 className="mt-1">
                          <button
                            type="button"
                            onClick={() => onAbrirFase(fase.id)}
                            className="group flex max-w-full items-center gap-2 rounded-md text-left font-[family-name:var(--font-display)] text-lg text-parchment hover:text-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                          >
                            <span className="min-w-0 break-words">{fase.nombre}</span>
                            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-brass-deep group-hover:text-brass" />
                            <span className="sr-only">Abrir en Mapa de fases</span>
                          </button>
                        </h3>
                      )}
                    </div>
                    {!fase.isActive && (
                      <span className="shrink-0 rounded-full border border-wine/60 bg-wine/15 px-2 py-1 text-[10px] uppercase tracking-wider text-fog">
                        Inactiva
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-fog">
                    {fase.esPool
                      ? 'Nodos activos que todavía no pertenecen a una fase.'
                      : `${fase.advancementRuleSummary} · ${fase.conteos.total} nodos activos`}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
                    {metricas.map(([etiqueta, cantidad]) => (
                      <div key={etiqueta}>
                        <dt className="text-[10px] uppercase tracking-wider text-fog">{etiqueta}</dt>
                        <dd className="mt-0.5 text-base font-semibold tabular-nums text-parchment">
                          {cantidad}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="min-w-0 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-xs font-semibold text-parchment">Interacciones salientes</h4>
                    <span className="text-xs tabular-nums text-fog">
                      {totalSalientes} {totalSalientes === 1 ? 'combinación' : 'combinaciones'}
                    </span>
                  </div>
                  {salientes.length === 0 ? (
                    <p className="mt-3 border-t border-line/70 pt-3 text-xs text-fog">
                      Sin cruces hacia otras fases.
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-line/70 border-y border-line/70">
                      {salientes.map((interaccion) => (
                        <li
                          key={interaccion.destinoId}
                          className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
                        >
                          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-brass" />
                          <span className="min-w-36 text-xs text-fog">
                            Hacia{' '}
                            <strong className="font-medium text-parchment">
                              {nombrePorId.get(interaccion.destinoId) ?? 'Sin fase'}
                            </strong>
                          </span>
                          <span className="flex flex-1 flex-wrap gap-1.5">
                            {interaccion.tipos.map(({ tipo, cantidad }) => (
                              <span
                                key={tipo}
                                className="rounded-full border border-line2 bg-panel/60 px-2 py-1 text-[11px] text-fog"
                              >
                                {ETIQUETA_INTERACCION[tipo]}{' '}
                                <strong className="font-semibold tabular-nums text-brass">{cantidad}</strong>
                              </span>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
