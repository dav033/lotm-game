'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AchievementPublicData, CombineResult } from '@/server/domain/tipos'
import type { ElementoDescubierto, EstadoJuego, RecetaPendiente } from './tipos'
import type { ResultadoDirecto } from './ResultadoFlotante'

// Estado y reglas del juego en el cliente: carga del progreso, mesa de
// combinación, llamadas a la API y avisos. Los componentes que lo consumen
// son solo presentación.
export function useJuego(esAdmin = false) {
  const [estado, setEstado] = useState<EstadoJuego | null>(null)
  const [errorCarga, setErrorCarga] = useState(false)
  const [slots, setSlots] = useState<(ElementoDescubierto | null)[]>([null, null])
  const [combinando, setCombinando] = useState(false)
  const [resultado, setResultado] = useState<CombineResult | null>(null)
  const [resultadoDirecto, setResultadoDirecto] = useState<ResultadoDirecto | null>(null)
  const [fallo, setFallo] = useState(0) // contador para reiniciar la animación
  const [reveal, setReveal] = useState<CombineResult | null>(null)
  const [conservarTrasFallo, setConservarTrasFallo] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)
  const [reiniciando, setReiniciando] = useState(false)
  const [pendientes, setPendientes] = useState<RecetaPendiente[]>([])
  const [logrosPendientes, setLogrosPendientes] = useState<AchievementPublicData[]>([])
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
    if (libre === -1) return
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

  // Panel de depuración (admin): autocompleta la mesa con los ingredientes de
  // una receta pendiente (puede que el jugador no los tenga descubiertos
  // todavía; combinar seguirá exigiéndolo del lado del servidor).
  const autocompletarPendiente = (recipeId: string) => {
    const receta = pendientes.find((r) => r.recipeId === recipeId)
    if (!receta) return
    const unidades = receta.ingredientes.flatMap((i) =>
      Array.from({ length: i.quantity }, () => ({
        ...i,
        firstDiscoveredAt: '',
        timesCreated: 0,
      })),
    )
    setSlots([unidades[0] ?? null, unidades[1] ?? null])
    setResultado(null)
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
  // (icono sobre icono). `origen` decide dónde se muestra el resultado.
  const combinandoRef = useRef(false)
  const ejecutarCombinacion = useCallback(
    async (
      slugA: string,
      slugB: string,
      opts: { origen: 'mesa' | 'directo'; punto?: { x: number; y: number } },
    ) => {
      if (combinandoRef.current) return
      combinandoRef.current = true
      setCombinando(true)
      if (opts.origen === 'mesa') setResultado(null)
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

        if (r.success && r.results.length > 0) {
          if (opts.origen === 'directo' && opts.punto) {
            setResultadoDirecto({ resultado: r, punto: opts.punto })
          } else {
            setResultado(r)
          }
          cargarPendientes()
          if (r.pathwayReveal) setReveal(r)
        } else if (opts.origen === 'mesa') {
          setResultado(r)
          setFallo((n) => n + 1)
          if (!conservarTrasFallo) setSlots([null, null])
        } else {
          // Fallo en combinación directa: un aviso discreto, sin ruido en la mesa.
          mostrarAviso(r.message)
        }
      } catch {
        mostrarAviso('No hay conexión con el archivo. Inténtalo de nuevo.')
      } finally {
        combinandoRef.current = false
        setCombinando(false)
      }
    },
    [conservarTrasFallo, mostrarAviso, cargarPendientes, registrarResultado],
  )

  const combinar = () => {
    if (!slots[0] || !slots[1]) return
    ejecutarCombinacion(slots[0].slug, slots[1].slug, { origen: 'mesa' })
  }

  // Combinación directa por arrastre: no toca la mesa, muestra el resultado
  // flotando donde se soltó.
  const combinarDirecto = (slugA: string, slugB: string, punto: { x: number; y: number }) => {
    ejecutarCombinacion(slugA, slugB, { origen: 'directo', punto })
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
    combinando,
    resultado,
    fallo,
    combinar,
    combinarDirecto,
    resultadoDirecto,
    cerrarResultadoDirecto: () => setResultadoDirecto(null),
    conservarTrasFallo,
    setConservarTrasFallo,
    reveal,
    cerrarReveal: () => setReveal(null),
    logroPendiente: logrosPendientes[0] ?? null,
    cerrarLogro,
    aviso,
    reiniciando,
    reiniciar,
    realizarRitual,
  }
}
