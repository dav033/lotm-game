'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Flame, TriangleAlert } from 'lucide-react'
import { useJuegoStore } from './store'

// Avisos efímeros apilados en la base de la pantalla: feedback inmediato de
// cada acción. Pulsables para descartarlos antes de que se apaguen solos.
export function Avisos() {
  const avisos = useJuegoStore((s) => s.avisos)
  const cerrarAviso = useJuegoStore((s) => s.cerrarAviso)

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex w-full max-w-sm -translate-x-1/2 flex-col items-stretch gap-2 px-4"
    >
      <AnimatePresence initial={false}>
        {avisos.map((aviso) => (
          <motion.button
            layout
            key={aviso.id}
            type="button"
            onClick={() => cerrarAviso(aviso.id)}
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={`pointer-events-auto flex w-full items-center gap-2.5 rounded-md border bg-panel2/95 px-4 py-2.5 text-left text-sm text-parchment shadow-xl backdrop-blur ${
              aviso.tono === 'peligro' ? 'border-wine' : 'border-line2'
            }`}
          >
            {aviso.tono === 'peligro' ? (
              <TriangleAlert className="h-4 w-4 shrink-0 text-wine" aria-hidden />
            ) : (
              <Flame className="h-4 w-4 shrink-0 text-brass" aria-hidden />
            )}
            <span>{aviso.texto}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
