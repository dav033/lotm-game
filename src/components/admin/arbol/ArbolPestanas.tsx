'use client'

// Carcasa de la página del árbol: cinco vistas que comparten datos bajo
// demanda. El explorador y la espina viven montados (conservan su estado al
// cambiar de pestaña); las vistas de fases y el mapa completo comparten una
// única descarga con la configuración y el grafo entero.

import { useCallback, useEffect, useRef, useState } from 'react'
import { GitBranch, ListTree, Map as MapIcon, Maximize2, Milestone, Minimize2, Network } from 'lucide-react'
import { ArbolConexiones } from '@/components/admin/ArbolConexiones'
import type { VistaFases } from '@/server/services/fasesProgresion'
import type { CaminoLeyenda, NodoArbol } from './tipos'
import { ExploradorArbol } from './ExploradorArbol'
import { CaminoEspina } from './CaminoEspina'
import {
  MapaFases,
  type GrafoFases,
  type RespuestaArbolFases,
} from './MapaFases'
import type { PestanaArbol } from './pestanasArbol'
import { ResumenFases } from './ResumenFases'

const PESTANAS: { id: PestanaArbol; etiqueta: string; Icono: typeof ListTree }[] = [
  { id: 'explorador', etiqueta: 'Explorador', Icono: ListTree },
  { id: 'caminos', etiqueta: 'Caminos', Icono: GitBranch },
  { id: 'fases', etiqueta: 'Fases', Icono: Milestone },
  { id: 'mapa-fases', etiqueta: 'Mapa de fases', Icono: Network },
  { id: 'mapa', etiqueta: 'Mapa completo', Icono: MapIcon },
]

export function ArbolPestanas({
  inicial,
  caminos,
  totales,
  pestanaInicial,
}: {
  inicial: NodoArbol[]
  caminos: CaminoLeyenda[]
  totales: { nodos: number; aristas: number }
  pestanaInicial: PestanaArbol
}) {
  const [pestana, setPestana] = useState<PestanaArbol>(pestanaInicial)
  const [grafoCompleto, setGrafoCompleto] = useState<GrafoFases | null>(null)
  const [cargandoMapa, setCargandoMapa] = useState(false)
  const [errorMapa, setErrorMapa] = useState<string | null>(null)
  const [fases, setFases] = useState<VistaFases | null>(null)
  const [cargandoFases, setCargandoFases] = useState(false)
  const [errorFases, setErrorFases] = useState<string | null>(null)
  const [selectedPhaseId, setSelectedPhaseId] = useState('')
  const [vistaMapaCompleto, setVistaMapaCompleto] = useState<'resumen' | 'grafo'>('resumen')
  const [solicitud, setSolicitud] = useState<{ id: string; nonce: number } | null>(null)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const raizRef = useRef<HTMLDivElement | null>(null)
  const cargaDatosFasesRef = useRef<Promise<RespuestaArbolFases> | null>(null)

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

  const activarPestana = useCallback((id: PestanaArbol) => {
    setPestana(id)
    const url = new URL(window.location.href)
    if (id === 'explorador') url.searchParams.delete('tab')
    else url.searchParams.set('tab', id)
    window.history.replaceState(window.history.state, '', url)
  }, [])

  const aplicarDatosFases = useCallback((data: RespuestaArbolFases) => {
    setFases(data.fases)
    setGrafoCompleto(data.grafo)
    setErrorFases(null)
    setErrorMapa(null)
  }, [])

  const descargarDatosFases = useCallback(async () => {
    if (cargaDatosFasesRef.current) return cargaDatosFasesRef.current
    const carga = (async () => {
      const response = await fetch('/api/admin/arbol?vista=fases', { cache: 'no-store' })
      if (!response.ok) throw new Error()
      return (await response.json()) as RespuestaArbolFases
    })()
    cargaDatosFasesRef.current = carga
    try {
      return await carga
    } finally {
      if (cargaDatosFasesRef.current === carga) cargaDatosFasesRef.current = null
    }
  }, [])

  const cargarMapa = useCallback(async () => {
    if ((fases && grafoCompleto) || cargandoMapa) return
    setCargandoMapa(true)
    setErrorMapa(null)
    try {
      aplicarDatosFases(await descargarDatosFases())
    } catch {
      setErrorMapa('No se pudo descargar el grafo completo.')
    } finally {
      setCargandoMapa(false)
    }
  }, [aplicarDatosFases, cargandoMapa, descargarDatosFases, fases, grafoCompleto])

  const abrirEnExplorador = useCallback((nodoId: string) => {
    setSolicitud({ id: nodoId, nonce: Date.now() })
    activarPestana('explorador')
  }, [activarPestana])

  const cargarFases = useCallback(async () => {
    if ((fases && grafoCompleto) || cargandoFases) return
    setCargandoFases(true)
    setErrorFases(null)
    try {
      aplicarDatosFases(await descargarDatosFases())
    } catch {
      setErrorFases('No se pudo cargar la configuración de fases.')
    } finally {
      setCargandoFases(false)
    }
  }, [aplicarDatosFases, cargandoFases, descargarDatosFases, fases, grafoCompleto])

  useEffect(() => {
    if (pestana === 'mapa') void cargarMapa()
    else if (pestana === 'fases' || pestana === 'mapa-fases') void cargarFases()
  }, [pestana, cargarMapa, cargarFases])

  const alTecladoPestana = (e: React.KeyboardEvent<HTMLButtonElement>, id: PestanaArbol) => {
    const indice = PESTANAS.findIndex((item) => item.id === id)
    let siguiente = indice
    if (e.key === 'ArrowRight') siguiente = (indice + 1) % PESTANAS.length
    else if (e.key === 'ArrowLeft') siguiente = (indice - 1 + PESTANAS.length) % PESTANAS.length
    else if (e.key === 'Home') siguiente = 0
    else if (e.key === 'End') siguiente = PESTANAS.length - 1
    else return
    e.preventDefault()
    const destino = PESTANAS[siguiente].id
    activarPestana(destino)
    requestAnimationFrame(() => document.getElementById(`tab-arbol-${destino}`)?.focus())
  }

  return (
    <div
      ref={raizRef}
      className={pantallaCompleta ? 'flex h-screen flex-col overflow-hidden bg-ink p-4' : ''}
    >
      <div className="mb-5 flex shrink-0 flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Vistas del árbol" className="flex flex-wrap gap-2">
          {PESTANAS.map(({ id, etiqueta, Icono }) => (
            <button
              key={id}
              id={`tab-arbol-${id}`}
              role="tab"
              type="button"
              tabIndex={pestana === id ? 0 : -1}
              aria-selected={pestana === id}
              aria-controls={`panel-arbol-${id}`}
              onClick={() => activarPestana(id)}
              onKeyDown={(e) => alTecladoPestana(e, id)}
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
        </div>
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

      <div
        id="panel-arbol-explorador"
        role="tabpanel"
        aria-labelledby="tab-arbol-explorador"
        hidden={pestana !== 'explorador'}
        className={`panel-entra${pantallaCompleta ? ' min-h-0 flex-1 overflow-auto' : ''}`}
      >
        <ExploradorArbol
          inicial={inicial}
          caminos={caminos}
          nodoSolicitado={solicitud}
          pantallaCompleta={pantallaCompleta}
        />
      </div>
      <div
        id="panel-arbol-caminos"
        role="tabpanel"
        aria-labelledby="tab-arbol-caminos"
        hidden={pestana !== 'caminos'}
        className={`panel-entra${pantallaCompleta ? ' min-h-0 flex-1 overflow-auto' : ''}`}
      >
        <CaminoEspina
          caminos={caminos}
          onAbrirEnExplorador={abrirEnExplorador}
          activo={pestana === 'caminos'}
        />
      </div>
      {(pestana === 'fases' || fases) && (
        <div
          id="panel-arbol-fases"
          role="tabpanel"
          aria-labelledby="tab-arbol-fases"
          hidden={pestana !== 'fases'}
          className={`panel-entra${pantallaCompleta ? ' min-h-0 flex-1 overflow-auto' : ''}`}
        >
          {errorFases && (
            <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-wine bg-wine/20 px-3 py-2 text-sm">
              <p>{errorFases}</p>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => void cargarFases()}>
                Reintentar
              </button>
            </div>
          )}
          {cargandoFases && <p role="status" className="text-sm text-fog">Calculando cierres de fase…</p>}
          {fases && grafoCompleto && (
            <MapaFases
              initialData={fases}
              grafo={grafoCompleto}
              onDataChange={aplicarDatosFases}
              mode="editor"
              selectedPhaseId={selectedPhaseId}
              onSelectedPhaseChange={setSelectedPhaseId}
            />
          )}
        </div>
      )}
      {(pestana === 'mapa-fases' || fases) && (
        <div
          id="panel-arbol-mapa-fases"
          role="tabpanel"
          aria-labelledby="tab-arbol-mapa-fases"
          hidden={pestana !== 'mapa-fases'}
          className={`panel-entra${pantallaCompleta ? ' min-h-0 flex-1 overflow-auto' : ''}`}
        >
          {errorFases && (
            <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-wine bg-wine/20 px-3 py-2 text-sm">
              <p>{errorFases}</p>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => void cargarFases()}>
                Reintentar
              </button>
            </div>
          )}
          {cargandoFases && <p role="status" className="text-sm text-fog">Calculando mapa de fases…</p>}
          {fases && grafoCompleto && (
            <MapaFases
              initialData={fases}
              grafo={grafoCompleto}
              onDataChange={aplicarDatosFases}
              mode="mapa"
              selectedPhaseId={selectedPhaseId}
              onSelectedPhaseChange={setSelectedPhaseId}
            />
          )}
        </div>
      )}
      {(pestana === 'mapa' || grafoCompleto) && (
        <div
          id="panel-arbol-mapa"
          role="tabpanel"
          aria-labelledby="tab-arbol-mapa"
          hidden={pestana !== 'mapa'}
          className={`panel-entra${pantallaCompleta ? ' min-h-0 flex-1 overflow-auto' : ''}`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel/65 p-3">
            <div>
              <p id="etiqueta-vista-mapa-completo" className="text-xs font-semibold text-parchment">
                Nivel de detalle
              </p>
              <p className="mt-0.5 text-xs text-fog">
                Revisa el flujo general o baja al grafo completo sin perder su posición.
              </p>
            </div>
            <div
              role="group"
              aria-labelledby="etiqueta-vista-mapa-completo"
              className="grid w-full grid-cols-1 rounded-lg border border-line2 bg-ink/70 p-1 sm:w-auto sm:grid-cols-2"
            >
              <button
                type="button"
                aria-pressed={vistaMapaCompleto === 'resumen'}
                aria-controls="vista-mapa-completo-resumen"
                onClick={() => setVistaMapaCompleto('resumen')}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                  vistaMapaCompleto === 'resumen'
                    ? 'bg-brass/15 text-parchment'
                    : 'text-fog hover:bg-panel hover:text-parchment'
                }`}
              >
                <Milestone aria-hidden="true" className="h-4 w-4" />
                Resumen por fases
              </button>
              <button
                type="button"
                aria-pressed={vistaMapaCompleto === 'grafo'}
                aria-controls="vista-mapa-completo-grafo"
                onClick={() => setVistaMapaCompleto('grafo')}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                  vistaMapaCompleto === 'grafo'
                    ? 'bg-brass/15 text-parchment'
                    : 'text-fog hover:bg-panel hover:text-parchment'
                }`}
              >
                <Network aria-hidden="true" className="h-4 w-4" />
                Grafo detallado
              </button>
            </div>
          </div>
          {errorMapa && (
            <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-wine bg-wine/20 px-3 py-2 text-sm">
              <p>{errorMapa}</p>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => void cargarMapa()}>
                Reintentar
              </button>
            </div>
          )}
          {cargandoMapa && (
            <p role="status" aria-live="polite" className="text-sm text-fog">
              Descargando el grafo completo ({totales.nodos} habilidades, {totales.aristas}{' '}
              conexiones)…
            </p>
          )}
          {fases && grafoCompleto && (
            <>
              <div
                id="vista-mapa-completo-resumen"
                role="region"
                aria-label="Resumen por fases"
                hidden={vistaMapaCompleto !== 'resumen'}
              >
                <ResumenFases
                  fases={fases}
                  grafo={grafoCompleto}
                  onAbrirFase={(id) => {
                    setSelectedPhaseId(id)
                    activarPestana('mapa-fases')
                    requestAnimationFrame(() => document.getElementById('tab-arbol-mapa-fases')?.focus())
                  }}
                />
              </div>
              <div
                id="vista-mapa-completo-grafo"
                role="region"
                aria-label="Grafo detallado"
                hidden={vistaMapaCompleto !== 'grafo'}
              >
                <ArbolConexiones
                  nodos={grafoCompleto.nodos}
                  aristas={grafoCompleto.aristas}
                  caminos={grafoCompleto.caminos}
                  pantallaCompleta={pantallaCompleta}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
