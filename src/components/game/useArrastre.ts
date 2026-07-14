'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Sistema de arrastre unificado para mouse y táctil basado en Pointer Events.
// El drag-and-drop nativo de HTML5 no funciona en móvil, así que resolvemos el
// objetivo bajo el puntero con document.elementFromPoint y atributos data-*.

export type OrigenArrastre = { tipo: 'panel' } | { tipo: 'slot'; index: number }

export type PayloadArrastre = {
  slug: string
  name: string
  iconKey: string
  origen: OrigenArrastre
}

export type DestinoArrastre =
  | { tipo: 'elemento'; slug: string }
  | { tipo: 'slot'; index: number }
  | null

export type EstadoArrastre = { payload: PayloadArrastre; x: number; y: number }

// Distancia mínima (px) para distinguir un clic/tap de un arrastre real.
const UMBRAL = 6

type OpcionesArrastre = {
  onCombinarElementos: (slugA: string, slugB: string, punto: { x: number; y: number }) => void
  onSoltarEnSlot: (index: number, payload: PayloadArrastre) => void
  onTap: (payload: PayloadArrastre) => void
}

function resolverDestino(x: number, y: number): DestinoArrastre {
  const el = document.elementFromPoint(x, y)
  if (!el) return null
  const zonaEl = el.closest('[data-drop-elemento]')
  if (zonaEl) {
    return { tipo: 'elemento', slug: zonaEl.getAttribute('data-drop-elemento') ?? '' }
  }
  const zonaSlot = el.closest('[data-drop-slot]')
  if (zonaSlot) {
    return { tipo: 'slot', index: Number(zonaSlot.getAttribute('data-drop-slot')) }
  }
  return null
}

export function useArrastre(opciones: OpcionesArrastre) {
  // Las callbacks pueden cambiar de identidad en cada render; las leemos siempre
  // desde una ref para no reinstalar los listeners globales.
  const opcionesRef = useRef(opciones)
  opcionesRef.current = opciones

  const [arrastre, setArrastre] = useState<EstadoArrastre | null>(null)
  const [objetivo, setObjetivo] = useState<DestinoArrastre>(null)
  const estadoRef = useRef<{
    payload: PayloadArrastre
    inicioX: number
    inicioY: number
    activo: boolean
    pointerId: number
    objetivo: DestinoArrastre
  } | null>(null)

  useEffect(() => {
    const mover = (e: PointerEvent) => {
      const st = estadoRef.current
      if (!st || e.pointerId !== st.pointerId) return
      const dx = e.clientX - st.inicioX
      const dy = e.clientY - st.inicioY
      if (!st.activo && Math.hypot(dx, dy) < UMBRAL) return
      if (!st.activo) {
        st.activo = true
        setArrastre({ payload: st.payload, x: e.clientX, y: e.clientY })
      }
      if (e.cancelable) e.preventDefault()
      const dest = resolverDestino(e.clientX, e.clientY)
      st.objetivo = dest
      setArrastre((a) => (a ? { ...a, x: e.clientX, y: e.clientY } : a))
      setObjetivo(dest)
    }

    const finalizar = (e: PointerEvent) => {
      const st = estadoRef.current
      if (!st || e.pointerId !== st.pointerId) return
      estadoRef.current = null
      const eraActivo = st.activo
      const dest = st.objetivo
      setArrastre(null)
      setObjetivo(null)
      const o = opcionesRef.current
      if (!eraActivo) {
        o.onTap(st.payload)
        return
      }
      if (!dest) return
      if (dest.tipo === 'elemento' && dest.slug) {
        o.onCombinarElementos(st.payload.slug, dest.slug, { x: e.clientX, y: e.clientY })
      } else if (dest.tipo === 'slot') {
        o.onSoltarEnSlot(dest.index, st.payload)
      }
    }

    window.addEventListener('pointermove', mover, { passive: false })
    window.addEventListener('pointerup', finalizar)
    window.addEventListener('pointercancel', finalizar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', finalizar)
      window.removeEventListener('pointercancel', finalizar)
    }
  }, [])

  const iniciar = useCallback((e: React.PointerEvent, payload: PayloadArrastre) => {
    // Solo el botón principal del mouse (o cualquier toque).
    if (e.button > 0) return
    estadoRef.current = {
      payload,
      inicioX: e.clientX,
      inicioY: e.clientY,
      activo: false,
      pointerId: e.pointerId,
      objetivo: null,
    }
  }, [])

  return { arrastre, objetivo, iniciar }
}
