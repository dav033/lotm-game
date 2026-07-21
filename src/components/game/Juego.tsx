'use client'

import { useEffect } from 'react'
import { AnimatePresence, MotionConfig } from 'framer-motion'
import { RotateCcw, Sparkles } from 'lucide-react'
import { Ambiente } from './Ambiente'
import { Avisos } from './Avisos'
import { GhostArrastre } from './GhostArrastre'
import { MesaCombinacion } from './MesaCombinacion'
import { ModalLogro } from './ModalLogro'
import { ModalAvanceFase } from './ModalAvanceFase'
import { ModalRiesgoRitual } from './ModalRiesgoRitual'
import { ModalTutorialAvance } from './ModalTutorialAvance'
import { PanelDescubiertos } from './PanelDescubiertos'
import { PanelHabilidades } from './PanelHabilidades'
import { PanelRituales } from './PanelRituales'
import { RecetasPendientes } from './RecetasPendientes'
import { useJuegoStore } from './store'
import { useArrastre } from './useArrastre'

// Raíz del juego: solo compone piezas y se suscribe a datos de cabecera. Todo
// el estado vive en el store (zustand); cada hijo lee la porción exacta que
// necesita, así las interacciones de alta frecuencia no repinan el árbol.
export default function Juego({ esAdmin = false }: { esAdmin?: boolean }) {
  const { iniciar: iniciarArrastre } = useArrastre()

  const iniciarJuego = useJuegoStore((s) => s.iniciar)
  useEffect(() => {
    iniciarJuego(esAdmin)
  }, [esAdmin, iniciarJuego])

  // Cabecera: datos primitivos, suscritos por separado.
  const descubiertos = useJuegoStore((s) => s.estado?.descubiertos)
  const totalElementos = useJuegoStore((s) => s.estado?.totalElementos)
  const porcentaje = useJuegoStore((s) => s.estado?.porcentaje ?? 0)
  const phaseName = useJuegoStore((s) => s.estado?.phase?.name)
  const nextPhase = useJuegoStore((s) => s.estado?.nextPhase)
  const estadoCargado = useJuegoStore((s) => s.estado !== null)

  const reiniciando = useJuegoStore((s) => s.reiniciando)
  const reiniciar = useJuegoStore((s) => s.reiniciar)
  const faseAvanzando = useJuegoStore((s) => s.faseAvanzando)
  const avanzarFase = useJuegoStore((s) => s.avanzarFase)
  const realizarRitual = useJuegoStore((s) => s.realizarRitual)
  const ritualState = useJuegoStore((s) => s.ritualState)
  const ritualActionLoading = useJuegoStore((s) => s.ritualActionLoading)
  const pendientes = useJuegoStore((s) => s.pendientes)
  const autocompletarPendiente = useJuegoStore((s) => s.autocompletarPendiente)
  const combinarPendiente = useJuegoStore((s) => s.combinarPendiente)
  const modoInteraccion = useJuegoStore((s) => s.modoInteraccion)
  const cancelarModoVidente = useJuegoStore((s) => s.cancelarModoVidente)

  useEffect(() => {
    if (modoInteraccion !== 'vidente-objetivo') return
    const cancelarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelarModoVidente()
    }
    window.addEventListener('keydown', cancelarConEscape)
    return () => window.removeEventListener('keydown', cancelarConEscape)
  }, [modoInteraccion, cancelarModoVidente])

  // Modales: uno a la vez, con prioridad revelación → tutorial → logro.
  const tutorialAvance = useJuegoStore((s) => s.tutorialAvance)
  const logroPendiente = useJuegoStore((s) => s.logrosPendientes[0] ?? null)
  const cerrarTutorialAvance = useJuegoStore((s) => s.cerrarTutorialAvance)
  const cerrarLogro = useJuegoStore((s) => s.cerrarLogro)
  const pendingRitualRisk = useJuegoStore((s) => s.pendingRitualRisk)
  const cancelarRiesgoRitual = useJuegoStore((s) => s.cancelarRiesgoRitual)
  const confirmarRiesgoRitual = useJuegoStore((s) => s.confirmarRiesgoRitual)
  const combinando = useJuegoStore((s) => s.combinando)
  const transicionFase = useJuegoStore((s) => s.transicionFase)
  const elementos = useJuegoStore((s) => s.estado?.elementos)
  const cerrarTransicionFase = useJuegoStore((s) => s.cerrarTransicionFase)
  const aperturasTransicion = transicionFase
    ? (elementos ?? []).filter((elemento) => transicionFase.openingElementSlugs.includes(elemento.slug))
    : []

  const verAperturasEnLienzo = () => {
    cerrarTransicionFase()
    requestAnimationFrame(() => {
      const lienzo = document.getElementById('lienzo-transmutacion')
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      lienzo?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
      lienzo?.focus({ preventScroll: true })
    })
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="mist-bg min-h-screen">
      <Ambiente />

      <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <h1 className="sr-only">Archivo de Misterios — Juego</h1>
          <span
            className="rounded-full border border-line2 px-3 py-0.5 text-sm text-fog"
            title="Porcentaje del archivo descubierto"
          >
            Archivo descubierto:{' '}
            <span className="text-brass">
              {descubiertos !== undefined && totalElementos !== undefined
                ? `${descubiertos}/${totalElementos} · ${porcentaje}%`
                : '…'}
            </span>
          </span>
          <span
            className="rounded-full border border-line2 px-3 py-0.5 text-sm text-fog"
            title="Fase de progresión actual"
          >
            Fase actual:{' '}
            <span className="text-brass">
              {phaseName ?? (estadoCargado ? 'Sin fase disponible' : '…')}
            </span>
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-4 text-sm">
            {nextPhase && (
              <button
                type="button"
                onClick={() => void avanzarFase()}
                disabled={faseAvanzando || combinando || reiniciando}
                aria-busy={faseAvanzando}
                className="flex min-h-11 items-center gap-1.5 rounded-md border border-brass-deep bg-brass/10 px-3 text-brass transition-colors hover:border-brass hover:bg-brass/15 focus-visible:ring-2 focus-visible:ring-brass disabled:cursor-wait disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {faseAvanzando ? 'Abriendo fase…' : `Avanzar a ${nextPhase.name}`}
              </button>
            )}
            <button
              type="button"
              onClick={() => void reiniciar()}
              disabled={reiniciando}
              className="flex items-center gap-1.5 text-fog transition hover:text-brass disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {reiniciando ? 'Reiniciando…' : 'Reiniciar progreso'}
            </button>
          </div>
        </div>
        <div
          className="h-[3px] w-full bg-panel"
          role="progressbar"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso del archivo descubierto"
        >
          <div
            className="progreso-arcano h-full transition-[width] duration-700 ease-out"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </header>

      {modoInteraccion === 'vidente-objetivo' && (
        <div
          role="status"
          aria-live="assertive"
          className="anim-rise fixed left-1/2 top-24 z-[45] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-md border border-spectral bg-panel2/95 px-4 py-3 text-sm text-parchment shadow-xl backdrop-blur"
        >
          <span className="flex-1">
            Selecciona un elemento descubierto. Pulsa Esc para cancelar.
          </span>
          <button
            type="button"
            onClick={cancelarModoVidente}
            className="shrink-0 rounded border border-line2 px-3 py-1 text-fog hover:border-brass hover:text-brass"
          >
            Cancelar
          </button>
        </div>
      )}

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <PanelHabilidades />
        <PanelRituales
          ritualState={ritualState}
          actionLoading={ritualActionLoading}
          onRealizar={(id) => void realizarRitual(id)}
        />

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <MesaCombinacion iniciarArrastre={iniciarArrastre} />
          <PanelDescubiertos iniciarArrastre={iniciarArrastre} />
        </div>

        {esAdmin && (
          <div className="mt-10">
            <RecetasPendientes
              pendientes={pendientes}
              onAutocompletar={autocompletarPendiente}
              onCombinar={combinarPendiente}
            />
          </div>
        )}
      </main>

      <GhostArrastre />
      <Avisos />

      <AnimatePresence mode="wait">
        {pendingRitualRisk && (
          <ModalRiesgoRitual
            key="riesgo-ritual"
            cargando={combinando}
            onCancelar={cancelarRiesgoRitual}
            onConfirmar={() => void confirmarRiesgoRitual()}
          />
        )}
        {!pendingRitualRisk && transicionFase && (
          <ModalAvanceFase
            key={`fase-${transicionFase.phase.slug}`}
            transicion={transicionFase}
            aperturas={aperturasTransicion}
            onCerrar={cerrarTransicionFase}
            onVerLienzo={verAperturasEnLienzo}
          />
        )}
        {!pendingRitualRisk && !transicionFase && tutorialAvance && (
          <ModalTutorialAvance key="tutorial-avance" onCerrar={cerrarTutorialAvance} />
        )}
        {!pendingRitualRisk && !transicionFase && !tutorialAvance && logroPendiente && (
          <ModalLogro
            key={`logro-${logroPendiente.id}`}
            logro={logroPendiente}
            onCerrar={cerrarLogro}
          />
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  )
}
