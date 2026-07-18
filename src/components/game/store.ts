'use client'

import { create } from 'zustand'
import type {
  AchievementPublicData,
  ApprenticeMemoryDelta,
  CombineResult,
  ResolvedCombineResult,
} from '@/server/domain/tipos'
import type { PublicRitualState } from '@/server/domain/ritualKnowledge'
import {
  ABILITY_DEFINITIONS,
  desbloqueosNuevos,
  facultadesDesdeSlugs,
  type AbilityKey,
  type PlayerAbilities,
  type PotentialTier,
} from '@/server/domain/habilidades'
import {
  aplicarDeltaAMemoria,
  crearEstadoInteraccionHabilidades,
  type EstadoMemoriaAprendiz,
  type ModoInteraccion,
  type ResultadoVidente,
} from './estadoHabilidades'
import type {
  DestinoArrastre,
  ElementoDescubierto,
  EstadoJuego,
  InstanciaBandeja,
  PayloadArrastre,
  RecetaPendiente,
} from './tipos'

// Marca local de "ya vio el tutorial del primer avance"; por navegador.
const TUTORIAL_AVANCE_KEY = 'am-tutorial-avance-visto'

// Store único del juego (zustand): toda la UI se suscribe por selectores, así
// un cambio en una esquina del estado solo re-renderiza quien la lee. Los
// datos canónicos viven en el servidor (perfil por cookie + SQLite); aquí se
// cachean para que la interfaz responda al instante.

export type Aviso = { id: number; texto: string; tono: 'bruma' | 'peligro' }

type JuegoState = {
  estado: EstadoJuego | null
  errorCarga: boolean
  slots: (ElementoDescubierto | null)[]
  combinando: boolean
  resultado: ResolvedCombineResult | null
  fallo: number // contador: reinicia la animación de sacudida
  /** Contador de resoluciones: re-monta tarjeta y partículas aunque se repita receta. */
  sello: number
  reveal: ResolvedCombineResult | null
  avisos: Aviso[]
  reiniciando: boolean
  pendientes: RecetaPendiente[]
  logrosPendientes: AchievementPublicData[]
  tutorialAvance: boolean
  /** Slugs descubiertos en esta sesión: llevan la insignia «Nuevo» en el panel. */
  recientes: string[]
  /** Ficha en vuelo durante el arrastre (la posición la mueve el ghost, sin React). */
  arrastre: { payload: PayloadArrastre } | null
  objetivo: DestinoArrastre
  /** Conserva el primer elemento para encadenar pruebas sin reconstruir la mesa. */
  modoRapido: boolean
  /** Instancias visuales distribuidas por el jugador durante la sesión. */
  bandeja: InstanciaBandeja[]
  ritualState: PublicRitualState
  pendingRitualRisk: PendingRitualRisk | null
  ritualActionLoading: boolean
  abilities: PlayerAbilities
  modoInteraccion: ModoInteraccion
  seerCargando: boolean
  seerResultado: ResultadoVidente | null
  mysteryActivo: boolean
  mysteryCargando: boolean
  potencialPorElemento: Record<string, PotentialTier>
  memoriaAprendiz: EstadoMemoriaAprendiz

  iniciar: (esAdmin: boolean) => void
  cargarEstado: () => Promise<void>
  mostrarAviso: (texto: string, tono?: Aviso['tono']) => void
  cerrarAviso: (id: number) => void
  colocar: (el: ElementoDescubierto) => void
  retirar: (i: number) => void
  limpiar: () => void
  colocarEnSlot: (i: number, slug: string, origen?: PayloadArrastre['origen']) => void
  usarResultado: (elementId: string) => void
  autocompletarPendiente: (recipeId: string) => void
  combinarPendiente: (recipeId: string) => void
  ejecutarCombinacion: (
    slugA: string,
    slugB: string,
    opts: OpcionesCombinacion,
  ) => Promise<void>
  combinarDirecto: (slugA: string, slugB: string) => void
  reiniciar: () => Promise<void>
  realizarRitual: (ritualId: string) => Promise<void>
  cancelarRiesgoRitual: () => void
  confirmarRiesgoRitual: () => Promise<void>
  cerrarReveal: () => void
  cerrarLogro: () => void
  cerrarTutorialAvance: () => void
  setArrastre: (a: { payload: PayloadArrastre } | null) => void
  setObjetivo: (d: DestinoArrastre) => void
  marcarVisto: (slug: string) => void
  activarModoVidente: () => void
  cancelarModoVidente: () => void
  analizarConVidente: (elementId: string) => Promise<void>
  alternarMystery: () => Promise<void>
  refrescarPotencial: () => Promise<void>
  cargarMemoriaAprendiz: () => Promise<void>
  aplicarDeltaMemoriaAprendiz: (delta: ApprenticeMemoryDelta) => void
  alternarModoRapido: () => void
  agregarABandeja: (slug: string, x: number, y: number) => void
  moverEnBandeja: (instanceId: string, x: number, y: number) => void
  combinarEnBandeja: (
    sourceInstanceId: string | null,
    targetInstanceId: string,
    sourceSlug: string,
    x: number,
    y: number,
  ) => void
  quitarDeBandeja: (instanceId: string) => void
  limpiarBandeja: () => void
}

type OpcionesCombinacion = (
  | { origen: 'mesa' | 'directo' }
  | {
      origen: 'bandeja'
      bandeja: {
        sourceInstanceId: string | null
        targetInstanceId: string
        x: number
        y: number
      }
    }
) & { confirmRitualRisk?: boolean }

type PendingRitualRisk = {
  elementos: [string, string]
  opciones: OpcionesCombinacion
}

let esAdminActual = false
let avisoId = 0
const avisoTimers = new Map<number, ReturnType<typeof setTimeout>>()
let combinandoEnCurso = false
let refrescoPotencialPendiente = false
let pendientesTimer: ReturnType<typeof setTimeout> | null = null
let instanciaBandejaId = 0

function feedbackTactil(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern)
  }
}

// Evita re-renderizados en cadena cuando el puntero pasa sobre muchos
// objetivos iguales seguidos: solo se publica un destino realmente distinto.
const mismoDestino = (a: DestinoArrastre, b: DestinoArrastre): boolean => {
  if (a === b) return true
  if (!a || !b || a.tipo !== b.tipo) return false
  if (a.tipo === 'slot' && b.tipo === 'slot') return a.index === b.index
  if (a.tipo === 'elemento' && b.tipo === 'elemento') {
    return a.slug === b.slug && a.bandejaInstanceId === b.bandejaInstanceId
  }
  if (a.tipo === 'bandeja' && b.tipo === 'bandeja') return true
  return false
}

function sincronizarBandeja(
  bandeja: InstanciaBandeja[],
  elementos: ElementoDescubierto[],
): InstanciaBandeja[] {
  const porId = new Map(elementos.map((elemento) => [elemento.id, elemento]))
  return bandeja.flatMap((instancia) => {
    const actualizado = porId.get(instancia.elemento.id)
    return actualizado ? [{ ...instancia, elemento: actualizado }] : []
  })
}

function limitarPosicion(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0.5))
}

function crearInstanciaBandeja(
  elemento: ElementoDescubierto,
  x: number,
  y: number,
): InstanciaBandeja {
  return {
    instanceId: `bandeja-${++instanciaBandejaId}`,
    elemento,
    x: limitarPosicion(x, 0.02, 0.98),
    y: limitarPosicion(y, 0.02, 0.98),
  }
}

export const useJuegoStore = create<JuegoState>()((set, get) => {
  // Registra el resultado en el estado local sin recargar todo el progreso.
  const registrarResultado = (r: ResolvedCombineResult) => {
    const nuevasFacultades = new Set<AbilityKey>()
    if (r.consumedSlugs.length > 0) {
      set((prev) => {
        if (!prev.estado) return prev
        const elementos = prev.estado.elementos.flatMap((elemento) => {
          if (!r.consumedSlugs.includes(elemento.slug)) return [elemento]
          const quantity = elemento.quantity ?? 1
          return quantity > 1 ? [{ ...elemento, quantity: quantity - 1 }] : []
        })
        return {
          estado: { ...prev.estado, elementos },
          bandeja: sincronizarBandeja(prev.bandeja, elementos),
          slots: prev.slots.map((slot) =>
            slot ? (elementos.find((elemento) => elemento.id === slot.id) ?? null) : null,
          ),
        }
      })
    }
    for (const salida of r.results) {
      const nuevo = salida.element
      set((prev) => {
        if (!prev.estado) return prev
        const existe = prev.estado.elementos.some((x) => x.id === nuevo.id)
        const elementos = existe
          ? prev.estado.elementos.map((x) =>
              x.id === nuevo.id
                ? {
                    ...x,
                    timesCreated: x.timesCreated + 1,
                    quantity: nuevo.kind === 'ADVANCE' ? (x.quantity ?? 1) + 1 : x.quantity,
                  }
                : x,
            )
          : [
              ...prev.estado.elementos,
              { ...nuevo, firstDiscoveredAt: new Date().toISOString(), timesCreated: 1 },
            ]
        const descubiertos = elementos.filter((elemento) => elemento.kind === 'ELEMENT').length
        const recientes =
          salida.isNewDiscovery && !prev.recientes.includes(nuevo.slug)
            ? [...prev.recientes.slice(-39), nuevo.slug]
            : prev.recientes
        const abilities = facultadesDesdeSlugs(
          new Set(
            elementos
              .filter((elemento) => elemento.kind === 'ELEMENT')
              .map((elemento) => elemento.slug),
          ),
        )
        for (const key of desbloqueosNuevos(prev.abilities, abilities)) {
          nuevasFacultades.add(key)
        }
        return {
          recientes,
          abilities,
          bandeja: sincronizarBandeja(prev.bandeja, elementos),
          estado: {
            ...prev.estado,
            elementos,
            abilities,
            descubiertos,
            porcentaje:
              prev.estado.totalElementos === 0
                ? 0
                : Math.round((descubiertos / prev.estado.totalElementos) * 100),
          },
        }
      })
    }
    for (const key of nuevasFacultades) {
      get().mostrarAviso(`Nueva facultad: ${ABILITY_DEFINITIONS[key].nombre}.`)
    }
  }

  const cargarPendientes = async () => {
    if (!esAdminActual) return
    try {
      const res = await fetch('/api/recetas-pendientes')
      if (!res.ok) return
      const data = await res.json()
      set({ pendientes: data.pendientes ?? [] })
    } catch {
      // Silencioso: es una herramienta auxiliar, no afecta al juego normal.
    }
  }

  // El panel admin es costoso (recorre muchas recetas). Durante pruebas
  // rápidas esperamos a que haya una pausa, en lugar de competir con la
  // siguiente combinación por SQLite y por el hilo principal.
  const programarCargaPendientes = () => {
    if (!esAdminActual) return
    if (pendientesTimer) clearTimeout(pendientesTimer)
    pendientesTimer = setTimeout(() => {
      pendientesTimer = null
      void cargarPendientes()
    }, 750)
  }

  return {
    estado: null,
    errorCarga: false,
    slots: [null, null],
    combinando: false,
    resultado: null,
    fallo: 0,
    sello: 0,
    reveal: null,
    avisos: [],
    reiniciando: false,
    pendientes: [],
    logrosPendientes: [],
    tutorialAvance: false,
    recientes: [],
    arrastre: null,
    objetivo: null,
    modoRapido: true,
    bandeja: [],
    ritualState: { status: 'HIDDEN', groups: [] },
    pendingRitualRisk: null,
    ritualActionLoading: false,
    ...crearEstadoInteraccionHabilidades(),

    iniciar: (esAdmin) => {
      esAdminActual = esAdmin
      void get().cargarEstado()
      void cargarPendientes()
    },

    cargarEstado: async () => {
      try {
        const res = await fetch('/api/estado')
        if (!res.ok) throw new Error()
        const data = (await res.json()) as EstadoJuego
        const estadoAnterior = get().estado
        const abilitiesAnteriores = get().abilities
        set((prev) => ({
          estado: data,
          ritualState: data.ritualState,
          abilities: data.abilities,
          logrosPendientes: data.pendingAchievements ?? [],
          errorCarga: false,
          modoInteraccion: data.abilities.seer.unlocked ? prev.modoInteraccion : 'normal',
          mysteryActivo: data.abilities.mysteryPryer.unlocked ? prev.mysteryActivo : false,
          potencialPorElemento: data.abilities.mysteryPryer.unlocked
            ? prev.potencialPorElemento
            : {},
          bandeja: sincronizarBandeja(prev.bandeja, data.elementos),
        }))
        if (estadoAnterior) {
          for (const key of desbloqueosNuevos(abilitiesAnteriores, data.abilities)) {
            get().mostrarAviso(`Nueva facultad: ${ABILITY_DEFINITIONS[key].nombre}.`)
          }
        }
        if (get().mysteryActivo) void get().refrescarPotencial()
        // Se carga una sola vez: al desbloquearse y también si la facultad
        // ya venía desbloqueada en la primera carga de la sesión.
        if (data.abilities.apprenticeMemory.unlocked && get().memoriaAprendiz.status === 'idle') {
          void get().cargarMemoriaAprendiz()
        }
      } catch {
        set({ errorCarga: true, ritualState: { status: 'HIDDEN', groups: [] } })
      }
    },

    mostrarAviso: (texto, tono = 'bruma') => {
      const id = ++avisoId
      set((prev) => ({ avisos: [...prev.avisos.slice(-2), { id, texto, tono }] }))
      avisoTimers.set(
        id,
        setTimeout(() => get().cerrarAviso(id), 4200),
      )
    },

    cerrarAviso: (id) => {
      const timer = avisoTimers.get(id)
      if (timer) clearTimeout(timer)
      avisoTimers.delete(id)
      set((prev) => ({ avisos: prev.avisos.filter((a) => a.id !== id) }))
    },

    colocar: (el) => {
      const { slots, mostrarAviso, marcarVisto, combinando, modoRapido } = get()
      if (combinando) {
        mostrarAviso('El círculo aún está resolviendo la combinación.')
        return
      }
      const libre = slots.findIndex((x) => x === null)
      if (libre === -1) {
        if (modoRapido && slots[0]) {
          const next = [slots[0], el]
          set({ slots: next, resultado: null })
          marcarVisto(el.slug)
          void get().ejecutarCombinacion(slots[0].slug, el.slug, { origen: 'mesa' })
          return
        }
        mostrarAviso('El círculo está completo. Retira un elemento o pulsa Limpiar.')
        return
      }
      const next = [...slots]
      next[libre] = el
      set({ slots: next })
      marcarVisto(el.slug)
      // Al quedar los dos espacios llenos, se combina solo (sin botón).
      if (next[0] && next[1]) void get().ejecutarCombinacion(next[0].slug, next[1].slug, { origen: 'mesa' })
    },

    retirar: (i) => {
      if (get().combinando) return
      set((prev) => ({ slots: prev.slots.map((x, idx) => (idx === i ? null : x)) }))
    },

    limpiar: () => {
      if (get().combinando) return
      set({ slots: [null, null], resultado: null })
    },

    // Colocación por arrastre: el panel publica el slug y el círculo lo
    // resuelve aquí. Si la ficha viene del otro espacio, este queda libre
    // (antes se duplicaba el elemento al moverlo de un espacio al otro).
    colocarEnSlot: (i, slug, origen) => {
      const { estado, slots, combinando } = get()
      if (combinando) return
      const el = estado?.elementos.find((x) => x.slug === slug)
      if (!el) return
      const next = slots.map((x, idx) => {
        if (idx === i) return el
        if (origen?.tipo === 'slot' && idx === origen.index) return null
        return x
      })
      set({ slots: next })
      get().marcarVisto(slug)
      if (next[0] && next[1]) void get().ejecutarCombinacion(next[0].slug, next[1].slug, { origen: 'mesa' })
    },

    // Clic en una tarjeta de resultado: limpia el círculo y coloca ese
    // elemento en el primer espacio, listo para seguir encadenando.
    usarResultado: (elementId) => {
      const el = get().estado?.elementos.find((x) => x.id === elementId)
      if (!el) return
      set({ slots: [el, null] })
    },

    // Panel de depuración (admin): expande los ingredientes de una receta
    // pendiente en unidades sueltas (ojo ×2 → ojo, ojo) listas para el círculo.
    autocompletarPendiente: (recipeId) => {
      const unidades = unidadesDePendiente(get().pendientes, recipeId)
      if (unidades.length === 0) return
      set({ slots: [unidades[0] ?? null, unidades[1] ?? null], resultado: null })
    },

    // Doble clic: carga los ingredientes y lanza la combinación al momento.
    combinarPendiente: (recipeId) => {
      const unidades = unidadesDePendiente(get().pendientes, recipeId)
      if (unidades.length < 2) return
      set({ slots: [unidades[0], unidades[1]] })
      void get().ejecutarCombinacion(unidades[0].slug, unidades[1].slug, { origen: 'mesa' })
    },

    // Núcleo de combinación compartido por el círculo y los arrastres.
    // El lienzo solo altera sus instancias después de una respuesta exitosa.
    ejecutarCombinacion: async (slugA, slugB, opts) => {
      if (
        combinandoEnCurso ||
        get().reiniciando ||
        (get().pendingRitualRisk && !opts.confirmRitualRisk)
      )
        return
      combinandoEnCurso = true
      const baseRapida =
        opts.origen === 'mesa' && get().modoRapido ? (get().slots[0] ?? null) : null
      set({
        combinando: true,
        resultado: null,
      })
      try {
        const res = await fetch('/api/combine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            elementos: [slugA, slugB],
            confirmRitualRisk: opts.confirmRitualRisk ?? false,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          if (opts.confirmRitualRisk) {
            set({ pendingRitualRisk: null })
            await get().cargarEstado()
          }
          get().mostrarAviso(data?.error ?? 'El archivo guarda silencio.', 'peligro')
          return
        }
        const r = data as CombineResult
        if (r.kind === 'RITUAL_KNOWLEDGE_REQUIRED') {
          set({ pendingRitualRisk: null })
          if (opts.confirmRitualRisk) await get().cargarEstado()
          get().mostrarAviso(r.message, 'peligro')
          return
        }
        if (r.kind === 'RITUAL_PREPARATION_REQUIRED') {
          set({
            pendingRitualRisk: {
              elementos: [slugA, slugB],
              opciones: { ...opts, confirmRitualRisk: false },
            },
          })
          return
        }
        if (opts.confirmRitualRisk) set({ pendingRitualRisk: null })
        if (r.memoryDelta) get().aplicarDeltaMemoriaAprendiz(r.memoryDelta)
        if (r.unlockedAchievements.length > 0) {
          set((prev) => {
            const ids = new Set(prev.logrosPendientes.map((achievement) => achievement.id))
            return {
              logrosPendientes: [
                ...prev.logrosPendientes,
                ...r.unlockedAchievements.filter((achievement) => !ids.has(achievement.id)),
              ],
            }
          })
        }
        if (r.results.length > 0) registrarResultado(r)

        // Tutorial de una sola vez: el primer avance rompe la regla de que
        // nada se gasta, así que merece una explicación puntual.
        if (
          r.results.some((salida) => salida.element.kind === 'ADVANCE') &&
          !window.localStorage.getItem(TUTORIAL_AVANCE_KEY)
        ) {
          set({ tutorialAvance: true })
        }

        set((prev) => ({ resultado: r, sello: prev.sello + 1 }))
        if (r.success && r.results.length > 0) {
          // El modo rápido conserva la base (salvo que haya sido consumida)
          // y deja el segundo hueco listo para el siguiente toque.
          if (opts.origen === 'mesa') {
            const baseDisponible =
              baseRapida && !r.consumedSlugs.includes(baseRapida.slug) ? baseRapida : null
            set({ slots: baseRapida ? [baseDisponible, null] : [null, null] })
          } else if (opts.origen === 'bandeja') {
            const { sourceInstanceId, targetInstanceId, x, y } = opts.bandeja
            const usadas = new Set([targetInstanceId, sourceInstanceId].filter(Boolean))
            set((prev) => {
              const elementos = new Map(
                prev.estado?.elementos.map((elemento) => [elemento.id, elemento]) ?? [],
              )
              let indice = 0
              const creadas = r.results.flatMap((salida) => {
                const elemento = elementos.get(salida.element.id)
                if (!elemento) return []
                return Array.from({ length: salida.quantity }, () => {
                  const angulo = indice * 2.4
                  const radio = indice === 0 ? 0 : 0.045
                  indice += 1
                  return crearInstanciaBandeja(
                    elemento,
                    x + Math.cos(angulo) * radio,
                    y + Math.sin(angulo) * radio,
                  )
                })
              })
              return {
                bandeja: [
                  ...prev.bandeja.filter((instancia) => !usadas.has(instancia.instanceId)),
                  ...creadas,
                ],
              }
            })
          }
          programarCargaPendientes()
          if (r.pathwayReveal) set({ reveal: r })
        } else if (opts.origen === 'mesa') {
          // En modo rápido basta tocar otro elemento para el siguiente intento.
          set((prev) => ({
            fallo: prev.fallo + 1,
            ...(baseRapida ? { slots: [baseRapida, null] } : {}),
          }))
        }
        feedbackTactil(r.success && r.results.length > 0 ? [12, 28, 18] : 22)
        if (
          opts.confirmRitualRisk ||
          r.results.length > 0 ||
          r.consumedSlugs.length > 0
        ) {
          await get().cargarEstado()
          void get().refrescarPotencial()
        }
      } catch {
        get().mostrarAviso('No hay conexión con el archivo. Inténtalo de nuevo.', 'peligro')
      } finally {
        combinandoEnCurso = false
        set({ combinando: false })
      }
    },

    // Combinación directa por arrastre (icono sobre icono): no toca el círculo.
    combinarDirecto: (slugA, slugB) => {
      void get().ejecutarCombinacion(slugA, slugB, { origen: 'directo' })
    },

    reiniciar: async () => {
      if (get().combinando) {
        get().mostrarAviso('Espera a que el archivo resuelva la combinación actual.')
        return
      }
      if (
        !window.confirm(
          '¿Reiniciar tu progreso? Perderás todos tus descubrimientos y volverás a empezar con Ojo, Moneda y Humano.',
        )
      )
        return
      set({ reiniciando: true })
      try {
        const res = await fetch('/api/perfil/reiniciar', { method: 'POST' })
        if (!res.ok) throw new Error()
        refrescoPotencialPendiente = false
        set({
          slots: [null, null],
          resultado: null,
          reveal: null,
          logrosPendientes: [],
          recientes: [],
          bandeja: [],
          ritualState: { status: 'HIDDEN', groups: [] },
          pendingRitualRisk: null,
          ritualActionLoading: false,
          ...crearEstadoInteraccionHabilidades(),
          arrastre: null,
          objetivo: null,
        })
        // Al empezar de cero, el tutorial del primer avance vuelve a mostrarse.
        window.localStorage.removeItem(TUTORIAL_AVANCE_KEY)
        await get().cargarEstado()
        get().mostrarAviso('El archivo ha sido restaurado. Empiezas de nuevo.')
      } catch {
        get().mostrarAviso('No se pudo reiniciar el progreso.', 'peligro')
      } finally {
        set({ reiniciando: false })
      }
    },

    realizarRitual: async (ritualId) => {
      if (get().ritualActionLoading) return
      set({ ritualActionLoading: true })
      try {
        const response = await fetch('/api/rituales/realizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ritualId }),
        })
        const data = await response.json()
        if (!response.ok) {
          set({ ritualState: { status: 'HIDDEN', groups: [] } })
          get().mostrarAviso(data?.error ?? 'El ritual no responde.', 'peligro')
          await get().cargarEstado()
          return
        }
        set({ ritualState: data.ritualState as PublicRitualState })
        get().mostrarAviso('La preparación ritual ha quedado completada.')
        void get().refrescarPotencial()
      } catch {
        set({ ritualState: { status: 'HIDDEN', groups: [] } })
        get().mostrarAviso('No se pudo completar el ritual.', 'peligro')
        await get().cargarEstado()
      } finally {
        set({ ritualActionLoading: false })
      }
    },

    cancelarRiesgoRitual: () => {
      if (get().combinando) return
      set({ pendingRitualRisk: null })
    },

    confirmarRiesgoRitual: async () => {
      const pending = get().pendingRitualRisk
      if (!pending) return
      await get().ejecutarCombinacion(pending.elementos[0], pending.elementos[1], {
        ...pending.opciones,
        confirmRitualRisk: true,
      })
    },

    cerrarReveal: () => set({ reveal: null }),

    cerrarLogro: () => {
      const current = get().logrosPendientes[0]
      if (!current) return
      set((prev) => ({ logrosPendientes: prev.logrosPendientes.slice(1) }))
      void fetch('/api/logros/vistos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ achievementIds: [current.id] }),
      })
    },

    cerrarTutorialAvance: () => {
      window.localStorage.setItem(TUTORIAL_AVANCE_KEY, '1')
      set({ tutorialAvance: false })
    },

    setArrastre: (arrastre) => set({ arrastre }),

    setObjetivo: (d) => {
      if (!mismoDestino(get().objetivo, d)) set({ objetivo: d })
    },

    marcarVisto: (slug) => {
      if (!get().recientes.includes(slug)) return
      set((prev) => ({ recientes: prev.recientes.filter((s) => s !== slug) }))
    },

    activarModoVidente: () => {
      const { abilities, seerCargando } = get()
      if (!abilities.seer.unlocked || seerCargando) return
      set({ modoInteraccion: 'vidente-objetivo' })
    },

    cancelarModoVidente: () => set({ modoInteraccion: 'normal' }),

    analizarConVidente: async (elementId) => {
      const { abilities, estado, seerCargando } = get()
      if (!abilities.seer.unlocked || seerCargando) return
      const elemento = estado?.elementos.find(
        (item) => item.kind === 'ELEMENT' && item.id === elementId,
      )
      if (!elemento) {
        set({ modoInteraccion: 'normal' })
        get().mostrarAviso('Ese elemento no puede ser analizado.', 'peligro')
        return
      }

      // La selección termina inmediatamente; la petición continúa con el
      // botón protegido por seerCargando para evitar envíos repetidos.
      set({ modoInteraccion: 'normal', seerCargando: true })
      try {
        const response = await fetch('/api/habilidades/vidente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ elementId }),
        })
        const data = await response.json()
        if (!response.ok) {
          get().mostrarAviso(data?.error ?? 'La adivinación no responde.', 'peligro')
          return
        }
        const count = Number(data.availableCombinationCount)
        // Un reset puede ocurrir mientras la petición viaja: no restaurar un
        // resultado de una facultad que ya dejó de pertenecer al perfil.
        if (!get().abilities.seer.unlocked) return
        const resultado: ResultadoVidente = {
          elementId,
          nombre: elemento.name,
          availableCombinationCount: Number.isInteger(count) && count >= 0 ? count : 0,
        }
        set({ seerResultado: resultado })
        get().mostrarAviso(
          resultado.availableCombinationCount === 0
            ? `«${elemento.name}» no presenta combinaciones pendientes que puedas ejecutar ahora.`
            : `«${elemento.name}» conserva ${resultado.availableCombinationCount} ${
                resultado.availableCombinationCount === 1
                  ? 'combinación pendiente'
                  : 'combinaciones pendientes'
              } con tu conocimiento actual.`,
        )
      } catch {
        get().mostrarAviso('La adivinación no responde. Inténtalo de nuevo.', 'peligro')
      } finally {
        set({ seerCargando: false })
      }
    },

    alternarMystery: async () => {
      const { abilities, mysteryActivo, mysteryCargando } = get()
      if (!abilities.mysteryPryer.unlocked || mysteryCargando) return
      if (mysteryActivo) {
        refrescoPotencialPendiente = false
        set({ mysteryActivo: false, potencialPorElemento: {} })
        return
      }
      set({ mysteryActivo: true, potencialPorElemento: {} })
      await get().refrescarPotencial()
    },

    refrescarPotencial: async () => {
      if (!get().mysteryActivo) return
      if (get().mysteryCargando) {
        refrescoPotencialPendiente = true
        return
      }
      refrescoPotencialPendiente = false
      // La caché se invalida antes de pedir: un fallo nunca deja tiers viejos.
      set({ mysteryCargando: true, potencialPorElemento: {} })
      try {
        const response = await fetch('/api/habilidades/potencial')
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error ?? 'La visión no responde.')
        const potencial: Record<string, PotentialTier> = {}
        for (const entry of data.potential ?? []) {
          if (
            typeof entry?.elementId === 'string' &&
            Number.isInteger(entry?.tier) &&
            entry.tier >= 1 &&
            entry.tier <= 5
          ) {
            potencial[entry.elementId] = entry.tier as PotentialTier
          }
        }
        // El modo pudo desactivarse o el perfil reiniciarse durante la carga.
        if (!get().mysteryActivo) return
        set({ potencialPorElemento: potencial })
      } catch {
        set({ mysteryActivo: false, potencialPorElemento: {} })
        get().mostrarAviso(
          'La visión del Mystery Pryer se ha desvanecido. Inténtalo de nuevo.',
          'peligro',
        )
      } finally {
        set({ mysteryCargando: false })
        if (refrescoPotencialPendiente && get().mysteryActivo) {
          refrescoPotencialPendiente = false
          void get().refrescarPotencial()
        }
      }
    },

    // Memoria del Aprendiz: carga el historial completo UNA vez (al
    // desbloquearse o al iniciar sesión ya desbloqueada); después, cada
    // combinación lo actualiza de forma incremental vía aplicarDeltaMemoriaAprendiz.
    // Un fallo de carga deja la facultad en 'error' sin afectar el resto del
    // juego: la advertencia visual simplemente no aparece hasta reintentar.
    cargarMemoriaAprendiz: async () => {
      if (!get().abilities.apprenticeMemory.unlocked) return
      set((prev) => ({ memoriaAprendiz: { ...prev.memoriaAprendiz, status: 'loading' } }))
      try {
        const response = await fetch('/api/habilidades/aprendiz/memoria')
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error ?? 'La memoria no responde.')
        const failedInputKeys = new Set<string>(
          Array.isArray(data.failedInputKeys) ? data.failedInputKeys : [],
        )
        // El perfil pudo reiniciarse mientras la petición viajaba.
        if (!get().abilities.apprenticeMemory.unlocked) return
        set({
          memoriaAprendiz: {
            status: 'ready',
            revision: typeof data.revision === 'string' ? data.revision : null,
            failedInputKeys,
          },
        })
      } catch {
        set((prev) => ({ memoriaAprendiz: { ...prev.memoriaAprendiz, status: 'error' } }))
        get().mostrarAviso('La Memoria del Aprendiz no responde por ahora.', 'peligro')
      }
    },

    // Un delta puede llegar antes de que la carga inicial termine (o de que
    // la facultad esté desbloqueada): el propio intento actual ya lo conoce
    // el jugador, así que registrarlo no filtra nada nuevo, pero solo tiene
    // efecto visual una vez que el snapshot está 'ready'.
    aplicarDeltaMemoriaAprendiz: (delta) => {
      set((prev) => ({ memoriaAprendiz: aplicarDeltaAMemoria(prev.memoriaAprendiz, delta) }))
    },

    alternarModoRapido: () => {
      if (get().combinando) return
      set((prev) => ({ modoRapido: !prev.modoRapido }))
    },

    agregarABandeja: (slug, x, y) => {
      const { estado, bandeja, combinando } = get()
      if (combinando) return
      const elemento = estado?.elementos.find((item) => item.slug === slug)
      if (!elemento) return
      set({ bandeja: [...bandeja, crearInstanciaBandeja(elemento, x, y)] })
      get().marcarVisto(slug)
    },

    moverEnBandeja: (instanceId, x, y) => {
      if (get().combinando) return
      set((prev) => ({
        bandeja: prev.bandeja.map((instancia) =>
          instancia.instanceId === instanceId
            ? {
                ...instancia,
                x: limitarPosicion(x, 0.02, 0.98),
                y: limitarPosicion(y, 0.02, 0.98),
              }
            : instancia,
        ),
      }))
    },

    combinarEnBandeja: (sourceInstanceId, targetInstanceId, sourceSlug, x, y) => {
      const { bandeja, combinando } = get()
      if (combinando || sourceInstanceId === targetInstanceId) return
      const objetivo = bandeja.find((instancia) => instancia.instanceId === targetInstanceId)
      const origen = sourceInstanceId
        ? bandeja.find((instancia) => instancia.instanceId === sourceInstanceId)
        : null
      if (!objetivo || (sourceInstanceId && !origen)) return
      void get().ejecutarCombinacion(sourceSlug, objetivo.elemento.slug, {
        origen: 'bandeja',
        bandeja: { sourceInstanceId, targetInstanceId, x, y },
      })
    },

    quitarDeBandeja: (instanceId) => {
      if (get().combinando) return
      set((prev) => ({
        bandeja: prev.bandeja.filter((instancia) => instancia.instanceId !== instanceId),
      }))
    },

    limpiarBandeja: () => {
      if (get().combinando) return
      set({ bandeja: [] })
    },
  }
})

// Unidades sueltas de una receta pendiente (ojo ×2 → ojo, ojo).
function unidadesDePendiente(pendientes: RecetaPendiente[], recipeId: string) {
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
