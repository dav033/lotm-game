'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Envoltorio común de los modales del juego: telón oscuro con desenfoque,
// tarjeta con siglos en las esquinas y entrada/salida con física de resorte.
// Debe montarse dentro de <AnimatePresence> para que la salida se anime.
export function ModalOculto({
  titulo,
  descripcionId,
  onCerrar,
  children,
}: {
  titulo: string
  descripcionId?: string
  onCerrar: () => void
  children: React.ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const frame = window.requestAnimationFrame(() => {
      if (dialog && !dialog.contains(document.activeElement)) dialog.focus()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCerrar()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const controls = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.getAttribute('aria-hidden') !== 'true',
      )
      if (controls.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault()
        const destination = event.shiftKey ? last : first
        destination.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [onCerrar])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={onCerrar}
        aria-hidden
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        aria-describedby={descripcionId}
        tabIndex={-1}
        className="mist-card brass-ring relative w-full max-w-md overflow-hidden rounded-xl p-8 text-center"
        initial={{ opacity: 0, scale: 0.88, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 14 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <span className="sigilo-esquina left-2.5 top-2" aria-hidden>✦</span>
        <span className="sigilo-esquina right-2.5 top-2" aria-hidden>✦</span>
        <span className="sigilo-esquina bottom-2 left-2.5" aria-hidden>✦</span>
        <span className="sigilo-esquina bottom-2 right-2.5" aria-hidden>✦</span>
        {children}
      </motion.div>
    </motion.div>
  )
}
