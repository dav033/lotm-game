'use client'

// Carcasa de la página del árbol: tres vistas que comparten datos bajo
// demanda. El explorador y la espina viven montados (conservan su estado al
// cambiar de pestaña); el mapa completo solo descarga el grafo entero la
// primera vez que se abre.

import { useCallback, useEffect, useRef, useState } from 'react'
import { GitBranch, ListTree, Map as MapIcon, Maximize2, Minimize2 } from 'lucide-react'
import { ArbolConexiones } from '@/components/admin/ArbolConexiones'
import type { AristaArbol, CaminoLeyenda, NodoArbol } from './tipos'
import { ExploradorArbol } from './ExploradorArbol'
import { CaminoEspina } from './CaminoEspina'

type Pestana = 'explorador' | 'caminos' | 'mapa'

const PESTANAS: { id: Pestana; etiqueta: string; Icono: typeof ListTree }[] = [
  { id: 'explorador', etiqueta: 'Explorador', Icono: ListTree },
  { id: 'caminos', etiqueta: 'Caminos', Icono: GitBranch },
  { id: 'mapa', etiqueta: 'Mapa completo', Icono: MapIcon },
]

export function ArbolPestanas({
  inicial,
  caminos,
  totales,
}: {
  inicial: NodoArbol[]
  caminos: CaminoLeyenda[]
  totales: { nodos: number; aristas: number }
}) {
  const [pestana, setPestana] = useState<Pestana>('explorador')
  const [grafoCompleto, setGrafoCompleto] = useState<{
    nodos: NodoArbol[]
    aristas: AristaArbol[]
  } | null>(null)
  const [cargandoMapa, setCargandoMapa] = useState(false)
  const [errorMapa, setErrorMapa] = useState<string | null>(null)
  const [solicitud, setSolicitud] = useState<{ id: string; nonce: number } | null>(null)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const raizRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const alCambiarPantalla = () => {
      setPantallaCompleta(document.fullscreenElement === raizRef.current)
    }
    document.addEventListener('fullscreenchange', alCambiarPantalla)
    return () => document.removeEventListener('fullscreenchange', alCambiarPantalla)
  }, [])

  const alternarPantallaCompleta = async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await raizRef.current?.requestFullscreen()
  }

  const abrirMapa = useCallback(async () => {
    setPestana('mapa')
    if (grafoCompleto || cargandoMapa) return
    setCargandoMapa(true)
    setErrorMapa(null)
    try {
      const res = await fetch('/api/admin/arbol?vista=completo')
      if (!res.ok) throw new Error()
      const datos = (await res.json()) as { nodos: NodoArbol[]; aristas: AristaArbol[] }
      setGrafoCompleto({ nodos: datos.nodos, aristas: datos.aristas })
    } catch {
      setErrorMapa('No se pudo descargar el grafo completo.')
    } finally {
      setCargandoMapa(false)
    }
  }, [grafoCompleto, cargandoMapa])

  const abrirEnExplorador = useCallback((nodoId: string) => {
    setSolicitud({ id: nodoId, nonce: Date.now() })
    setPestana('explorador')
  }, [])

  return (
    <div
      ref={raizRef}
      className={pantallaCompleta ? 'flex h-screen flex-col overflow-hidden bg-ink p-4' : ''}
    >
      <div role="tablist" aria-label="Vistas del árbol" className="mb-5 flex shrink-0 flex-wrap gap-2">
        {PESTANAS.map(({ id, etiqueta, Icono }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={pestana === id}
            onClick={() => (id === 'mapa' ? void abrirMapa() : setPestana(id))}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
              pestana === id
                ? 'border-brass/60 bg-brass/15 text-parchment shadow-[0_0_18px_rgba(201,163,92,0.12)]'
                : 'border-line2 bg-panel/45 text-fog hover:border-brass-deep hover:text-parchment'
            }`}
          >
            <Icono className="h-4 w-4" />
            {etiqueta}
            {id === 'mapa' && (
              <span className="rounded-full border border-line px-1.5 py-0.5 text-[10px] text-fog">
                {totales.nodos} · {totales.aristas}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="btn-ghost ml-auto flex items-center gap-2 px-3 py-2 text-sm"
          onClick={() => void alternarPantallaCompleta()}
          aria-label={pantallaCompleta ? 'Salir de pantalla completa' : 'Ver árbol en pantalla completa'}
        >
          {pantallaCompleta ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {pantallaCompleta ? 'Salir' : 'Pantalla completa'}
        </button>
      </div>

      <div className={`${pantallaCompleta ? 'min-h-0 flex-1 overflow-auto' : ''} ${pestana === 'explorador' ? '' : 'hidden'}`}>
        <ExploradorArbol
          inicial={inicial}
          caminos={caminos}
          nodoSolicitado={solicitud}
          pantallaCompleta={pantallaCompleta}
        />
      </div>
      <div className={`${pantallaCompleta ? 'min-h-0 flex-1 overflow-auto' : ''} ${pestana === 'caminos' ? '' : 'hidden'}`}>
        <CaminoEspina caminos={caminos} onAbrirEnExplorador={abrirEnExplorador} />
      </div>
      {pestana === 'mapa' && (
        <div className={pantallaCompleta ? 'min-h-0 flex-1 overflow-auto' : ''}>
          {errorMapa && (
            <p role="alert" className="mb-3 rounded-md border border-wine bg-wine/20 px-3 py-2 text-sm">
              {errorMapa}
            </p>
          )}
          {cargandoMapa && (
            <p className="text-sm text-fog">
              Descargando el grafo completo ({totales.nodos} habilidades, {totales.aristas}{' '}
              conexiones)…
            </p>
          )}
          {grafoCompleto && (
            <ArbolConexiones
              nodos={grafoCompleto.nodos}
              aristas={grafoCompleto.aristas}
              caminos={caminos}
            />
          )}
        </div>
      )}
    </div>
  )
}
