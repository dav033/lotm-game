'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AchievementPublicData, CombineResult } from '@/server/domain/tipos'
import type { ElementoDescubierto, EstadoJuego, RecetaPendiente } from './tipos'

// Marca local de "ya vio el tutorial del primer avance"; por navegador.
const TUTORIAL_AVANCE_KEY = 'am-tutorial-avance-visto'

// Estado y reglas del juego en el cliente: carga del progreso, mesa de
// combinación, llamadas a la API y avisos. Los componentes que lo consumen
// son solo presentación.
export function useJuego(esAdmin = false) {
  const [estado, setEstado] = useState<EstadoJuego | null>(null)
  const [errorCarga, setErrorCarga] = useState(false)
  const [slots, setSlots] = useState<(ElementoDescubierto | null)[]>([null, null])
  const [combinando, setCombinando] = useState(false)
  const [resultado, setResultado] = useState<CombineResult | null>(null)
  const [fallo, setFallo] = useState(0) // contador para reiniciar la animación
  const [reveal, setReveal] = useState<CombineResult | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [reiniciando, setReiniciando] = useState(false)
  const [pendientes, setPendientes] = useState<RecetaPendiente[]>([])
  const [logrosPendientes, setLogrosPendientes] = useState<AchievementPublicData[]>([])
  const [tutorialAvance, setTutorialAvance] = useState(false)
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto)
    if (avisoTimer.current) clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(null), 4000)
  }, [])

  const cargarEstado = useCallback(async () => {
    try {
      const res = await fetch('/api/estado')
      if (!res.ok) throw new Error()
      const data = (await res.json()) as EstadoJuego
      setEstado(data)
      setLogrosPendientes(data.pendingAchievements ?? [])
      setErrorCarga(false)
    } catch {
      setErrorCarga(true)
    }
  }, [])

  // Panel de depuración (solo admin): recetas activas aún no completadas.
  const cargarPendientes = useCallback(async () => {
    if (!esAdmin) return
    try {
      const res = await fetch('/api/recetas-pendientes')
      if (!res.ok) return
      const data = await res.json()
      setPendientes(data.pendientes ?? [])
    } catch {
      // Silencioso: es una herramienta auxiliar, no afecta al juego normal.
    }
  }, [esAdmin])

  useEffect(() => {
    cargarEstado()
    cargarPendientes()
    return () => {
      if (avisoTimer.current) clearTimeout(avisoTimer.current)
    }
  }, [cargarEstado, cargarPendientes])

  const colocar = (el: ElementoDescubierto) => {
    const libre = slots.findIndex((x) => x === null)
    if (libre === -1) {
      mostrarAviso('La mesa está llena. Retira un elemento o pulsa Limpiar.')
      return
    }
    const next = [...slots]
    next[libre] = el
    setSlots(next)
    // Al quedar los dos espacios llenos, se combina solo (sin botón).
    if (next[0] && next[1]) ejecutarCombinacion(next[0].slug, next[1].slug, { origen: 'mesa' })
  }

  const retirar = (i: number) =>
    setSlots((s) => s.map((x, idx) => (idx === i ? null : x)))

  const limpiar = () => {
    setSlots([null, null])
    setResultado(null)
  }

  // Colocación por arrastre: el panel publica el slug y la mesa lo resuelve aquí.
  const colocarEnSlot = (i: number, slug: string) => {
    const el = estado?.elementos.find((x) => x.slug === slug)
    if (!el) return
    const next = slots.map((x, idx) => (idx === i ? el : x))
    setSlots(next)
    if (next[0] && next[1]) ejecutarCombinacion(next[0].slug, next[1].slug, { origen: 'mesa' })
  }

  // Clic en una tarjeta de resultado: limpia la mesa y coloca ese elemento en
  // el primer espacio, listo para seguir encadenando combinaciones.
  const usarResultado = (elementId: string) => {
    const el = estado?.elementos.find((x) => x.id === elementId)
    if (!el) return
    setSlots([el, null])
  }

  // Panel de depuración (admin): expande los ingredientes de una receta
  // pendiente en unidades sueltas (ojo ×2 → ojo, ojo) listas para la mesa.
  const unidadesDePendiente = (recipeId: string) => {
    const receta = pendientes.find((r) => r.recipeId === recipeId)
    if (!receta) return []
    return receta.ingredientes.flatMap((i) =>
      Array.from({ length: i.quantity }, () => ({
        ...i,
        firstDiscoveredAt: '',
        timesCreated: 0,
      })),
    )
  }

  // Clic: autocompleta la mesa con los ingredientes (puede que el jugador no
  // los tenga descubiertos todavía; combinar seguirá exigiéndolo del servidor).
  const autocompletarPendiente = (recipeId: string) => {
    const unidades = unidadesDePendiente(recipeId)
    if (unidades.length === 0) return
    setSlots([unidades[0] ?? null, unidades[1] ?? null])
    setResultado(null)
  }

  // Doble clic: carga los ingredientes y lanza la combinación al momento.
  const combinarPendiente = (recipeId: string) => {
    const unidades = unidadesDePendiente(recipeId)
    if (unidades.length < 2) return
    setSlots([unidades[0], unidades[1]])
    ejecutarCombinacion(unidades[0].slug, unidades[1].slug, { origen: 'mesa' })
  }

  // Registra el resultado en el estado local sin recargar todo el progreso.
  const registrarResultado = useCallback((r: CombineResult) => {
    if (r.consumedSlugs.length > 0) {
      setEstado((prev) => {
        if (!prev) return prev
        const elementos = prev.elementos.flatMap((elemento) => {
          if (!r.consumedSlugs.includes(elemento.slug)) return [elemento]
          const quantity = elemento.quantity ?? 1
          return quantity > 1 ? [{ ...elemento, quantity: quantity - 1 }] : []
        })
        return { ...prev, elementos }
      })
      setSlots([null, null])
    }
    for (const salida of r.results) {
      const nuevo = salida.element
      setEstado((prev) => {
        if (!prev) return prev
        const existe = prev.elementos.some((x) => x.id === nuevo.id)
        const elementos = existe
          ? prev.elementos.map((x) =>
              x.id === nuevo.id
                ? {
                    ...x,
                    timesCreated: x.timesCreated + 1,
                    quantity: nuevo.kind === 'ADVANCE' ? (x.quantity ?? 1) + 1 : x.quantity,
                  }
                : x,
            )
          : [
              ...prev.elementos,
              { ...nuevo, firstDiscoveredAt: new Date().toISOString(), timesCreated: 1 },
            ]
        const descubiertos = elementos.filter((elemento) => elemento.kind === 'ELEMENT').length
        return {
          ...prev,
          elementos,
          descubiertos,
          porcentaje:
            prev.totalElementos === 0
              ? 0
              : Math.round((descubiertos / prev.totalElementos) * 100),
        }
      })
    }
  }, [])

  // Núcleo de combinación compartido por la mesa y por el arrastre directo
  // (icono sobre icono). El resultado se muestra siempre en el mismo sitio:
  // el área bajo la mesa. `origen` solo decide si hay que limpiar los
  // espacios tras el éxito (mesa) o agitar la mesa en el fallo.
  const combinandoRef = useRef(false)
  const ejecutarCombinacion = useCallback(
    async (slugA: string, slugB: string, opts: { origen: 'mesa' | 'directo' }) => {
      if (combinandoRef.current) return
      combinandoRef.current = true
      setCombinando(true)
      setResultado(null)
      try {
        const res = await fetch('/api/combine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ elementos: [slugA, slugB] }),
        })
        const data = await res.json()
        if (!res.ok) {
          mostrarAviso(data?.error ?? 'El archivo guarda silencio.')
          return
        }
        const r = data as CombineResult
        if (r.unlockedAchievements.length > 0) {
          setLogrosPendientes((current) => {
            const ids = new Set(current.map((achievement) => achievement.id))
            return [
              ...current,
              ...r.unlockedAchievements.filter((achievement) => !ids.has(achievement.id)),
            ]
          })
        }
        if (r.results.length > 0) registrarResultado(r)

        // Tutorial de una sola vez: el primer avance rompe la regla de que
        // nada se gasta, así que merece una explicación puntual.
        if (
          r.results.some((salida) => salida.element.kind === 'ADVANCE') &&
          !window.localStorage.getItem(TUTORIAL_AVANCE_KEY)
        ) {
          setTutorialAvance(true)
        }

        setResultado(r)
        if (r.success && r.results.length > 0) {
          // Tras el éxito la mesa queda libre para la siguiente combinación.
          if (opts.origen === 'mesa') setSlots([null, null])
          cargarPendientes()
          if (r.pathwayReveal) setReveal(r)
        } else if (opts.origen === 'mesa') {
          // El fallo conserva los elementos: así se puede cambiar solo uno.
          setFallo((n) => n + 1)
        }
      } catch {
        mostrarAviso('No hay conexión con el archivo. Inténtalo de nuevo.')
      } finally {
        combinandoRef.current = false
        setCombinando(false)
      }
    },
    [mostrarAviso, cargarPendientes, registrarResultado],
  )

  // Combinación directa por arrastre (icono sobre icono): no toca la mesa.
  const combinarDirecto = (slugA: string, slugB: string) => {
    ejecutarCombinacion(slugA, slugB, { origen: 'directo' })
  }

  const reiniciar = async () => {
    if (
      !window.confirm(
        '¿Reiniciar tu progreso? Perderás todos tus descubrimientos y volverás a empezar con Ojo, Moneda y Humano.',
      )
    )
      return
    setReiniciando(true)
    try {
      const res = await fetch('/api/perfil/reiniciar', { method: 'POST' })
      if (!res.ok) throw new Error()
      limpiar()
      setReveal(null)
      setLogrosPendientes([])
      // Al empezar de cero, el tutorial del primer avance vuelve a mostrarse.
      window.localStorage.removeItem(TUTORIAL_AVANCE_KEY)
      await cargarEstado()
      mostrarAviso('El archivo ha sido restaurado. Empiezas de nuevo.')
    } catch {
      mostrarAviso('No se pudo reiniciar el progreso.')
    } finally {
      setReiniciando(false)
    }
  }

  const realizarRitual = async (ritualId: string) => {
    try {
      const response = await fetch('/api/rituales/realizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ritualId }),
      })
      const data = await response.json()
      if (!response.ok) {
        mostrarAviso(data?.error ?? 'El ritual no responde.')
        return
      }
      setEstado((current) =>
        current
          ? {
              ...current,
              rituals: current.rituals.map((ritual) =>
                ritual.id === ritualId ? { ...ritual, isCompleted: true } : ritual,
              ),
            }
          : current,
      )
      mostrarAviso(data.isNew ? 'El ritual ha quedado preparado.' : 'Ese ritual ya estaba preparado.')
    } catch {
      mostrarAviso('No se pudo completar el ritual.')
    }
  }

  const cerrarTutorialAvance = () => {
    window.localStorage.setItem(TUTORIAL_AVANCE_KEY, '1')
    setTutorialAvance(false)
  }

  const cerrarLogro = () => {
    const current = logrosPendientes[0]
    if (!current) return
    setLogrosPendientes((items) => items.slice(1))
    void fetch('/api/logros/vistos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievementIds: [current.id] }),
    })
  }

  return {
    estado,
    errorCarga,
    cargarEstado,
    slots,
    colocar,
    retirar,
    limpiar,
    colocarEnSlot,
    usarResultado,
    pendientes,
    autocompletarPendiente,
    combinarPendiente,
    combinando,
    resultado,
    fallo,
    combinarDirecto,
    reveal,
    cerrarReveal: () => setReveal(null),
    logroPendiente: logrosPendientes[0] ?? null,
    cerrarLogro,
    tutorialAvance,
    cerrarTutorialAvance,
    aviso,
    reiniciando,
    reiniciar,
    realizarRitual,
  }
}
