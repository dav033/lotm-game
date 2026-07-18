'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useJuegoStore } from './store'
import { permiteArrastre } from './estadoHabilidades'
import type { DestinoArrastre, PayloadArrastre } from './tipos'

export type { DestinoArrastre, OrigenArrastre, PayloadArrastre } from './tipos'

// Sistema de arrastre unificado para mouse y táctil basado en Pointer Events.
// El drag-and-drop nativo de HTML5 no funciona en móvil, así que resolvemos el
// objetivo bajo el puntero con document.elementFromPoint y atributos data-*.
//
// Rendimiento: la posición de la ficha fantasma se escribe directo en el DOM
// (transform), sin pasar por React; el store solo recibe qué ficha se arrastra
// y sobre qué destino está el puntero (y únicamente cuando el destino cambia).

// Distancia mínima (px) para distinguir un clic/tap de un arrastre real.
const UMBRAL = 6

// Nodo del ghost compartido con GhostArrastre: el hook lo mueve por ref.
export const ghostNodeRef: { current: HTMLElement | null } = { current: null }
// Última posición conocida del puntero: el ghost se coloca ahí al montarse,
// sin esperar al siguiente pointermove.
export const ultimaPosicion = { x: 0, y: 0 }

function posicionarGhost(x: number, y: number) {
  ultimaPosicion.x = x
  ultimaPosicion.y = y
  const nodo = ghostNodeRef.current
  if (nodo) nodo.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
}

function posicionRelativa(zona: Element, x: number, y: number) {
  const rect = zona.getBoundingClientRect()
  return {
    x: rect.width > 0 ? (x - rect.left) / rect.width : 0.5,
    y: rect.height > 0 ? (y - rect.top) / rect.height : 0.5,
  }
}

function resolverDestino(x: number, y: number): DestinoArrastre {
  const el = document.elementFromPoint(x, y)
  if (!el) return null
  const zonaEl = el.closest('[data-drop-elemento]')
  if (zonaEl) {
    const zonaBandeja = zonaEl.closest('[data-drop-bandeja]')
    const posicion = zonaBandeja ? posicionRelativa(zonaBandeja, x, y) : null
    return {
      tipo: 'elemento',
      slug: zonaEl.getAttribute('data-drop-elemento') ?? '',
      bandejaInstanceId: zonaEl.getAttribute('data-bandeja-instance') ?? undefined,
      bandejaX: posicion?.x,
      bandejaY: posicion?.y,
    }
  }
  const zonaSlot = el.closest('[data-drop-slot]')
  if (zonaSlot) {
    return { tipo: 'slot', index: Number(zonaSlot.getAttribute('data-drop-slot')) }
  }
  const zonaBandeja = el.closest('[data-drop-bandeja]')
  if (zonaBandeja) {
    return { tipo: 'bandeja', ...posicionRelativa(zonaBandeja, x, y) }
  }
  return null
}

export function useArrastre() {
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
      const store = useJuegoStore.getState()
      if (!st.activo) {
        st.activo = true
        store.setArrastre({ payload: st.payload })
        posicionarGhost(e.clientX, e.clientY)
      }
      if (e.cancelable) e.preventDefault()
      const dest = resolverDestino(e.clientX, e.clientY)
      st.objetivo = dest
      // La ficha sigue al dedo sin re-renderizar React; el destino sí pasa
      // por el store, pero setObjetivo ignora valores repetidos.
      posicionarGhost(e.clientX, e.clientY)
      store.setObjetivo(dest)
    }

    const finalizar = (e: PointerEvent) => {
      const st = estadoRef.current
      if (!st || e.pointerId !== st.pointerId) return
      estadoRef.current = null
      const eraActivo = st.activo
      const dest = st.objetivo
      const store = useJuegoStore.getState()
      store.setArrastre(null)
      store.setObjetivo(null)
      if (!eraActivo) {
        // Tap/clic: las fichas del panel y la bandeja se colocan en el círculo.
        if (st.payload.origen.tipo === 'slot') return
        const el = store.estado?.elementos.find((x) => x.slug === st.payload.slug)
        if (el) store.colocar(el)
        return
      }
      if (!dest) return
      if (dest.tipo === 'elemento' && dest.slug) {
        if (dest.bandejaInstanceId) {
          const sourceInstanceId =
            st.payload.origen.tipo === 'bandeja' ? st.payload.origen.instanceId : null
          if (sourceInstanceId === dest.bandejaInstanceId) {
            store.moverEnBandeja(
              sourceInstanceId,
              dest.bandejaX ?? 0.5,
              dest.bandejaY ?? 0.5,
            )
          } else {
            store.combinarEnBandeja(
              sourceInstanceId,
              dest.bandejaInstanceId,
              st.payload.slug,
              dest.bandejaX ?? 0.5,
              dest.bandejaY ?? 0.5,
            )
          }
        } else {
          store.combinarDirecto(st.payload.slug, dest.slug)
        }
      } else if (dest.tipo === 'slot') {
        store.colocarEnSlot(dest.index, st.payload.slug, st.payload.origen)
      } else if (dest.tipo === 'bandeja') {
        if (st.payload.origen.tipo === 'bandeja') {
          store.moverEnBandeja(st.payload.origen.instanceId, dest.x, dest.y)
        } else {
          store.agregarABandeja(st.payload.slug, dest.x, dest.y)
        }
      }
    }

    const cancelar = (e: PointerEvent) => {
      const st = estadoRef.current
      if (!st || e.pointerId !== st.pointerId) return
      estadoRef.current = null
      const store = useJuegoStore.getState()
      store.setArrastre(null)
      store.setObjetivo(null)
    }

    window.addEventListener('pointermove', mover, { passive: false })
    window.addEventListener('pointerup', finalizar)
    window.addEventListener('pointercancel', cancelar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', finalizar)
      window.removeEventListener('pointercancel', cancelar)
      estadoRef.current = null
      const store = useJuegoStore.getState()
      store.setArrastre(null)
      store.setObjetivo(null)
    }
  }, [])

  const iniciar = useCallback((e: React.PointerEvent, payload: PayloadArrastre) => {
    // Solo el botón principal del mouse (o cualquier toque).
    if (e.button > 0) return
    // El modo objetivo del Vidente convierte las tarjetas en botones de
    // análisis. Bloquear aquí protege tanto el panel como los receptáculos:
    // ninguna ruta de arrastre puede lanzar una combinación por accidente.
    const juego = useJuegoStore.getState()
    if (!permiteArrastre(juego.modoInteraccion) || juego.combinando || juego.reiniciando) return
    estadoRef.current = {
      payload,
      inicioX: e.clientX,
      inicioY: e.clientY,
      activo: false,
      pointerId: e.pointerId,
      objetivo: null,
    }
  }, [])

  return { iniciar }
}
