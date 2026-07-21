'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SPRING_UI } from './motion'
import { parPreviamenteFallido } from './estadoHabilidades'
import { IconoElemento } from './IconoElemento'
import { useJuegoStore } from './store'
import { ghostNodeRef, ultimaPosicion } from './useArrastre'

const ANUNCIO_PAR_FALLIDO = 'Combinación intentada anteriormente sin resultado.'

// Ficha que sigue al puntero durante el arrastre. El contenedor exterior lo
// mueve useArrastre escribiendo el transform directo en el DOM (60 fps sin
// re-renderizar React); framer-motion solo anima escala y opacidad del
// contenido, así ambos sistemas nunca pisan el mismo estilo.
export function GhostArrastre() {
  const arrastre = useJuegoStore((s) => s.arrastre)

  // Memoria del Aprendiz: resuelve el slug objetivo actual (tarjeta o
  // receptáculo) y reutiliza el mismo cálculo que usan esos destinos, para
  // no duplicar la lógica de "¿este par ya falló?".
  const previouslyFailed = useJuegoStore((s) => {
    if (!s.arrastre || !s.objetivo) return false
    let targetSlug: string | null = null
    if (s.objetivo.tipo === 'elemento') {
      targetSlug = s.objetivo.slug
    } else if (s.objetivo.tipo === 'slot') {
      targetSlug = s.slots[s.objetivo.index === 0 ? 1 : 0]?.slug ?? null
    }
    if (!targetSlug) return false
    const targetKind = s.estado?.elementos.find((e) => e.slug === targetSlug)?.kind
    if (targetKind !== 'ELEMENT') return false
    return parPreviamenteFallido(
      s.memoriaAprendiz,
      s.abilities.apprenticeMemory.unlocked,
      s.arrastre.payload.slug,
      targetSlug,
    )
  })

  // Anuncio accesible: solo cuando el par pasa de no-marcado a marcado, nunca
  // en cada pointermove (objetivo ya deduplica destinos repetidos aguas arriba).
  const [anuncio, setAnuncio] = useState('')
  const anteriorRef = useRef(false)
  useEffect(() => {
    if (previouslyFailed && !anteriorRef.current) {
      setAnuncio(ANUNCIO_PAR_FALLIDO)
    } else if (!previouslyFailed && anteriorRef.current) {
      setAnuncio('')
    }
    anteriorRef.current = previouslyFailed
  }, [previouslyFailed])

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {anuncio}
      </div>
      <AnimatePresence>
        {arrastre && (
          <motion.div
            ref={(nodo: HTMLElement | null) => {
              ghostNodeRef.current = nodo
              if (nodo) {
                nodo.style.transform = `translate(${ultimaPosicion.x}px, ${ultimaPosicion.y}px) translate(-50%, -50%)`
              }
            }}
            className="pointer-events-none fixed left-0 top-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.94 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            aria-hidden
          >
            <motion.div
              initial={{ scale: 0.55, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.6, rotate: 4 }}
              transition={SPRING_UI}
              className={`flex flex-col items-center gap-1 rounded-lg mist-card brass-ring px-3 py-2 shadow-xl ${
                previouslyFailed ? 'border-wine' : 'border-brass'
              }`}
            >
              <IconoElemento iconKey={arrastre.payload.iconKey} className="h-8 w-8 text-brass" />
              <span className="text-xs text-parchment">{arrastre.payload.name}</span>
              {previouslyFailed && (
                <span className="rounded-full border border-wine px-2 py-0.5 text-[9px] uppercase tracking-widest text-wine">
                  Ya intentada
                </span>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
