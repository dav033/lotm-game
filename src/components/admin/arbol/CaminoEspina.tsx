'use client'

// Vista por camino: la espina vertical de secuencias (9 → 0) con los avances
// y rituales entre tramos y las recetas/desbloqueos de cada secuencia
// plegados. HTML plano: legible, accesible y sin coste de layout.

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronsUp, ExternalLink, Sparkle } from 'lucide-react'
import { IconoElemento } from '@/components/game/IconoElemento'
import { COLOR_NEUTRO, colorDeCamino, type CaminoLeyenda } from './tipos'
import type { EspinaCamino } from '@/server/services/arbolGrafo'

export function CaminoEspina({
  caminos,
  onAbrirEnExplorador,
}: {
  caminos: CaminoLeyenda[]
  onAbrirEnExplorador: (nodoId: string) => void
}) {
  const [caminoId, setCaminoId] = useState<string>(caminos[0]?.id ?? '')
  const [espina, setEspina] = useState<EspinaCamino | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Map<string, EspinaCamino>>(new Map())

  const cargar = useCallback(async (id: string) => {
    if (!id) return
    const enCache = cacheRef.current.get(id)
    if (enCache) {
      setEspina(enCache)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/arbol?vista=espina&id=${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error()
      const datos = (await res.json()) as EspinaCamino
      cacheRef.current.set(id, datos)
      setEspina(datos)
    } catch {
      setError('No se pudo cargar el camino.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar(caminoId)
  }, [caminoId, cargar])

  const color = espina ? (colorDeCamino(espina.camino.index) ?? COLOR_NEUTRO) : COLOR_NEUTRO
  // Avances agrupados por la secuencia de la que parten.
  const avancesDesde = new Map<number, NonNullable<typeof espina>['avances']>()
  if (espina) {
    for (const avance of espina.avances) {
      avancesDesde.set(avance.deNumero, [...(avancesDesde.get(avance.deNumero) ?? []), avance])
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel/70 p-3 shadow-[inset_0_1px_0_rgba(201,163,92,0.06)]">
        <label className="flex items-center gap-2 text-xs text-fog">
          <span className="shrink-0 uppercase tracking-wider">Camino</span>
          <select
            value={caminoId}
            onChange={(e) => setCaminoId(e.target.value)}
            className="campo min-w-56"
            aria-label="Elegir el camino a inspeccionar"
          >
            {caminos.map((camino) => (
              <option key={camino.id ?? camino.index} value={camino.id ?? ''}>
                {camino.nombre}
              </option>
            ))}
          </select>
        </label>
        {espina?.camino.descripcion && (
          <p className="text-xs italic text-fog lg:ml-2">{espina.camino.descripcion}</p>
        )}
        <p className="text-xs text-fog lg:ml-auto">
          Secuencia 9 arriba, 0 abajo · los bloques ⇈ son los avances entre tramos.
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-md border border-wine bg-wine/20 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {cargando && !espina && <p className="text-sm text-fog">Cargando camino…</p>}

      {espina && (
        <ol className="relative mx-auto max-w-3xl space-y-0" aria-label={`Espina del camino ${espina.camino.nombre}`}>
          {espina.secuencias.map((secuencia, indice) => (
            <li key={secuencia.numero}>
              <article
                className="mist-card relative rounded-xl p-4"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <header className="flex flex-wrap items-center gap-3">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 font-[family-name:var(--font-display)] text-lg text-parchment"
                    style={{ borderColor: color, background: 'rgba(0,0,0,0.35)' }}
                    aria-label={`Secuencia ${secuencia.numero}`}
                  >
                    {secuencia.numero}
                  </span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line2 bg-ink/60 text-parchment">
                    <IconoElemento iconKey={secuencia.iconKey} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-[family-name:var(--font-display)] text-parchment">
                      {secuencia.nombre}
                      {!secuencia.activo && <span className="text-fog"> (inactivo)</span>}
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-brass-deep">
                      {secuencia.elementoNombre} · {secuencia.tipo}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost ml-auto flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs"
                    onClick={() => onAbrirEnExplorador(secuencia.elementoId)}
                    title="Añadir este elemento al explorador y enfocarlo"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Explorar
                  </button>
                </header>
                {(secuencia.descripcion || secuencia.elementoDescripcion) && (
                  <p className="mt-2 text-xs italic leading-relaxed text-fog">
                    {secuencia.descripcion || secuencia.elementoDescripcion}
                  </p>
                )}
                <div className="mt-3 space-y-1.5 text-sm">
                  {secuencia.recetas.length > 0 && (
                    <details className="group rounded-lg border border-line bg-ink/40 px-3 py-1.5">
                      <summary className="cursor-pointer select-none text-xs uppercase tracking-wider text-fog transition-colors hover:text-parchment">
                        Recetas que lo crean ({secuencia.recetas.length})
                      </summary>
                      <ul className="mt-1.5 space-y-1 pb-1 text-parchment">
                        {secuencia.recetas.map((receta, i) => (
                          <li key={i} className="text-xs">⚗ {receta}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {secuencia.desbloqueos.length > 0 && (
                    <details className="group rounded-lg border border-brass-deep/40 bg-brass/5 px-3 py-1.5">
                      <summary className="cursor-pointer select-none text-xs uppercase tracking-wider text-brass transition-colors hover:text-parchment">
                        Desbloqueos espontáneos ({secuencia.desbloqueos.length})
                      </summary>
                      <ul className="mt-1.5 space-y-1 pb-1 text-parchment">
                        {secuencia.desbloqueos.map((texto, i) => (
                          <li key={i} className="text-xs">● {texto}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {secuencia.recetas.length === 0 && secuencia.desbloqueos.length === 0 && (
                    <p className="text-xs italic text-wine">
                      Sin recetas ni desbloqueos: solo se alcanza por ascensión.
                    </p>
                  )}
                  {secuencia.usadoEnRecetas > 0 && (
                    <p className="text-[11px] text-fog">
                      Se usa como ingrediente en {secuencia.usadoEnRecetas}{' '}
                      {secuencia.usadoEnRecetas === 1 ? 'receta' : 'recetas'}.
                    </p>
                  )}
                </div>
              </article>

              {indice < espina.secuencias.length - 1 && (
                <div className="relative mx-auto w-fit py-1 pl-6">
                  <div
                    aria-hidden
                    className="absolute left-0 top-0 h-full w-px opacity-50"
                    style={{ background: color, marginLeft: '-1.5rem' }}
                  />
                  {(avancesDesde.get(secuencia.numero) ?? []).map((avance, i) => (
                    <div
                      key={i}
                      className="my-2 max-w-md rounded-lg border border-line2 bg-panel2/80 px-3 py-2"
                    >
                      <p className="flex items-center gap-1.5 text-xs text-parchment">
                        <ChevronsUp className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                        <span className="font-semibold">{avance.nombre}</span>
                        {!avance.activo && <span className="text-fog">(inactivo)</span>}
                        <span className="text-fog">→ Secuencia {avance.aNumero}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-fog">
                        Se forja con: {avance.ingredientes}
                      </p>
                      {avance.rituales.map((ritual, j) => (
                        <p key={j} className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-fog">
                          <Sparkle className="h-3 w-3 shrink-0 text-brass" />
                          <span className="text-brass">{ritual.nombre}</span>
                          <span>· exige secuencia {ritual.exigeSecuencia}</span>
                          <span>· {ritual.ingredientes}</span>
                          {ritual.fallos.length > 0 && (
                            <span className="text-wine">· al fallar: {ritual.fallos.join(', ')}</span>
                          )}
                          {!ritual.activo && <span>(inactivo)</span>}
                        </p>
                      ))}
                      {avance.rituales.length === 0 && (
                        <p className="mt-0.5 text-[11px] italic text-fog">
                          Sin ritual de protección: el avance es directo.
                        </p>
                      )}
                    </div>
                  ))}
                  {(avancesDesde.get(secuencia.numero) ?? []).length === 0 && (
                    <p className="my-2 text-[11px] italic text-wine">
                      Sin avance definido hacia la siguiente secuencia.
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
          {espina.secuencias.length === 0 && (
            <p className="text-sm italic text-fog">Este camino todavía no tiene secuencias.</p>
          )}
        </ol>
      )}
    </div>
  )
}
