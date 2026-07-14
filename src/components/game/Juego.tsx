'use client'

import { RotateCcw } from 'lucide-react'
import { MesaCombinacion } from './MesaCombinacion'
import { ModalRevelacion } from './ModalRevelacion'
import { ModalLogro } from './ModalLogro'
import { PanelDescubiertos } from './PanelDescubiertos'
import { RecetasPendientes } from './RecetasPendientes'
import { PanelRituales } from './PanelRituales'
import { GhostArrastre } from './GhostArrastre'
import { ResultadoFlotante } from './ResultadoFlotante'
import { useJuego } from './useJuego'
import { useArrastre } from './useArrastre'

export default function Juego({ esAdmin = false }: { esAdmin?: boolean }) {
  const juego = useJuego(esAdmin)
  const { estado, reveal } = juego

  const { arrastre, objetivo, iniciar } = useArrastre({
    onCombinarElementos: (slugA, slugB, punto) => juego.combinarDirecto(slugA, slugB, punto),
    onSoltarEnSlot: (index, payload) => juego.colocarEnSlot(index, payload.slug),
    onTap: (payload) => {
      if (payload.origen.tipo !== 'panel') return
      const el = estado?.elementos.find((e) => e.slug === payload.slug)
      if (el) juego.colocar(el)
    },
  })

  return (
    <div className="mist-bg min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <h1 className="sr-only">Archivo de Misterios — Juego</h1>
          <span
            className="rounded-full border border-line2 px-3 py-0.5 text-sm text-fog"
            title="Porcentaje del archivo descubierto"
          >
            Archivo descubierto:{' '}
            <span className="text-brass">
              {estado ? `${estado.descubiertos}/${estado.totalElementos} · ${estado.porcentaje}%` : '…'}
            </span>
          </span>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <button
              onClick={juego.reiniciar}
              disabled={juego.reiniciando}
              className="flex items-center gap-1.5 text-fog hover:text-brass disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {juego.reiniciando ? 'Reiniciando…' : 'Reiniciar progreso'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <PanelRituales
            rituals={estado?.rituals ?? []}
            onRealizar={juego.realizarRitual}
          />
          {esAdmin && (
            <RecetasPendientes
              pendientes={juego.pendientes}
              onAutocompletar={juego.autocompletarPendiente}
            />
          )}
          <MesaCombinacion
            slots={juego.slots}
            combinando={juego.combinando}
            resultado={juego.resultado}
            fallo={juego.fallo}
            conservarTrasFallo={juego.conservarTrasFallo}
            onRetirar={juego.retirar}
            onCombinar={juego.combinar}
            onLimpiar={juego.limpiar}
            onCambiarConservar={juego.setConservarTrasFallo}
            onUsarResultado={juego.usarResultado}
            iniciarArrastre={iniciar}
            objetivo={objetivo}
          />
        </div>
        <PanelDescubiertos
          estado={estado}
          errorCarga={juego.errorCarga}
          onColocar={juego.colocar}
          onReintentar={juego.cargarEstado}
          iniciarArrastre={iniciar}
          objetivo={objetivo}
          slugArrastrado={arrastre?.payload.slug ?? null}
        />
      </main>

      <GhostArrastre arrastre={arrastre} />
      <ResultadoFlotante directo={juego.resultadoDirecto} onCerrar={juego.cerrarResultadoDirecto} />


      {reveal?.pathwayReveal && reveal.results.length > 0 && (
        <ModalRevelacion reveal={reveal.pathwayReveal} onCerrar={juego.cerrarReveal} />
      )}
      {!reveal && juego.logroPendiente && (
        <ModalLogro logro={juego.logroPendiente} onCerrar={juego.cerrarLogro} />
      )}

      {/* Avisos accesibles */}
      <div aria-live="assertive" className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
        {juego.aviso && (
          <p className="rounded-md border border-line2 bg-panel2 px-4 py-2 text-sm text-parchment shadow-lg">
            {juego.aviso}
          </p>
        )}
      </div>
    </div>
  )
}
