'use client'

import {
  Fragment,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { Ban, Check, ChevronRight, Eye, EyeOff, LockKeyhole, Pencil, Plus, Search, Sparkles, Trash2, TriangleAlert, X } from 'lucide-react'
import ConstructorReceta from '@/components/admin/ConstructorReceta'
import { IconoElemento } from '@/components/game/IconoElemento'
import type { PhaseRule } from '@/shared/phaseRules'
import { FEATURE_DEFINITIONS, type FeatureKey } from '@/shared/featureGates'
import { defaultPhaseCelebrationMessage } from '@/shared/phaseCelebrations'
import {
  asignarElementosAFase,
  eliminarFase,
  guardarCondicionesDesbloqueo,
  guardarFeatureGate,
  guardarFase,
} from '@/server/actions/fases'
import { alternarElementoActivo } from '@/server/actions/elementos'
import { alternarRecetaActiva, eliminarReceta } from '@/server/actions/recetas'
import { alternarRitualActivo } from '@/server/actions/rituales'
import type { VistaFases } from '@/server/services/fasesProgresion'
import { ArbolConexiones } from '../ArbolConexiones'
import {
  agruparContenidoPorBloqueadores,
  agruparElementosDeFase,
  compararCercaniaBloqueo,
  filtrarCandidatosIniciales,
  type OrdenBloqueos,
} from './agrupacionFases'
import { construirSubgrafoFase } from './subgrafoFase'
import { EditorReglaFase } from './EditorReglaFase'
import {
  normalizarTexto,
  type AristaArbol,
  type CaminoLeyenda,
  type NodoArbol,
} from './tipos'

type EstadoElemento = 'disponible' | 'sin-ruta' | 'frontera' | 'bloqueado' | 'inactivo'
type Filtro = 'todos' | EstadoElemento
type EditorReceta =
  | { kind: 'editar'; recipeId: string }
  | { kind: 'nueva-como-resultado'; elementId: string }
  | { kind: 'nueva-como-ingrediente'; elementId: string }

export type GrafoFases = {
  nodos: NodoArbol[]
  aristas: AristaArbol[]
  caminos: CaminoLeyenda[]
}

export type RespuestaArbolFases = {
  fases: VistaFases
  grafo: GrafoFases
}

const ESTADO_META: Record<EstadoElemento, { label: string; className: string }> = {
  disponible: {
    label: 'Alcanzable',
    className: 'border-emerald-500/45 bg-emerald-950/20 text-emerald-100',
  },
  'sin-ruta': {
    label: 'Sin ruta',
    className: 'border-amber-500/45 bg-amber-950/20 text-amber-100',
  },
  frontera: {
    label: 'Frontera',
    className: 'border-brass/70 bg-brass/15 text-parchment',
  },
  bloqueado: {
    label: 'Bloqueado',
    className: 'border-line bg-black/20 text-fog',
  },
  inactivo: {
    label: 'Inactivo',
    className: 'border-wine/40 bg-wine/10 text-fog',
  },
}

function GrafoDeFase({
  grafo,
  phase,
  previousPhase,
  inactiveRecipeIds,
  selectedElementId,
  onSelectElement,
}: {
  grafo: GrafoFases
  phase: VistaFases['phases'][number]
  previousPhase: VistaFases['phases'][number] | undefined
  inactiveRecipeIds: readonly string[]
  selectedElementId: string | null
  onSelectElement: (id: string | null) => void
}) {
  const subgrafo = useMemo(() => {
    return construirSubgrafoFase({
      nodos: grafo.nodos,
      aristas: grafo.aristas,
      phaseElementIds: phase.ownElementIds,
      initialElementIds: phase.initialElementIds,
      reachableElementIds: phase.reachableElementIds,
      previousReachableElementIds: previousPhase?.reachableElementIds ?? [],
      inactiveRecipeIds,
    })
  }, [grafo, phase, previousPhase, inactiveRecipeIds])

  const selectedNodeId = selectedElementId && subgrafo.nodos.some(
    (nodo) => nodo.id === `el:${selectedElementId}`,
  )
    ? `el:${selectedElementId}`
    : null

  return (
    <section
      aria-labelledby={`mapa-fase-${phase.id}`}
      className="mist-card rounded-xl border border-brass/25 p-4"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id={`mapa-fase-${phase.id}`}
            className="font-[family-name:var(--font-display)] text-xl text-parchment"
          >
            Mapa de conexiones de {phase.name}
          </h2>
          <p className="mt-1 text-xs text-fog">
            Rutas que vuelven alcanzables los nuevos elementos de la etapa.
          </p>
        </div>
        <span className="rounded-full border border-line px-2.5 py-1 text-xs tabular-nums text-fog">
          {subgrafo.nodos.length} nodos · {subgrafo.aristas.length} conexiones
        </span>
      </div>
      {subgrafo.nodos.length === 0 ? (
        <p className="rounded-lg border border-line bg-black/15 p-4 text-sm text-fog">
          Esta fase todavía no tiene elementos ni conexiones.
        </p>
      ) : (
        <ArbolConexiones
          nodos={subgrafo.nodos}
          aristas={subgrafo.aristas}
          caminos={grafo.caminos}
          seleccionId={selectedNodeId}
          onSeleccionChange={(id) => {
            onSelectElement(id?.startsWith('el:') ? id.slice(3) : null)
          }}
          mostrarDetalle={false}
          titulo={`Dependencias de ${phase.name}`}
          subtitulo="Selecciona un elemento para abrir su expediente y editarlo."
        />
      )}
    </section>
  )
}

export function MapaFases({
  initialData,
  grafo,
  onDataChange,
  mode,
  selectedPhaseId: controlledSelectedPhaseId,
  onSelectedPhaseChange,
}: {
  initialData: VistaFases
  grafo: GrafoFases
  onDataChange: (data: RespuestaArbolFases) => void
  mode: 'editor' | 'mapa'
  selectedPhaseId?: string
  onSelectedPhaseChange?: (id: string) => void
}) {
  const [data, setData] = useState(initialData)
  const [localSelectedPhaseId, setLocalSelectedPhaseId] = useState(
    initialData.phases.filter((phase) => phase.isActive).at(-1)?.id ??
      initialData.phases.at(-1)?.id ??
      '',
  )
  const selectedPhaseId = controlledSelectedPhaseId ?? localSelectedPhaseId
  const setSelectedPhaseId = (id: string) => {
    if (controlledSelectedPhaseId === undefined) setLocalSelectedPhaseId(id)
    onSelectedPhaseChange?.(id)
  }
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [selectedRitualId, setSelectedRitualId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filtro>('todos')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [editorFase, setEditorFase] = useState<'nueva' | 'editar' | null>(null)
  const [phaseRule, setPhaseRule] = useState<PhaseRule>({ type: 'ALWAYS' })
  const [condCount, setCondCount] = useState('')
  const [condReqIds, setCondReqIds] = useState<string[]>([])
  const [condQuery, setCondQuery] = useState('')
  const [initialSearch, setInitialSearch] = useState('')
  const [selectedInitialIds, setSelectedInitialIds] = useState<string[]>([])
  const [showUnreachableRituals, setShowUnreachableRituals] = useState(true)
  const [showBlockerView, setShowBlockerView] = useState(true)
  const [collapsedBlockerGroups, setCollapsedBlockerGroups] = useState<string[]>([])
  const [blockerOrder, setBlockerOrder] = useState<OrdenBloqueos>('cercanos')
  const [collapsedReachableGroups, setCollapsedReachableGroups] = useState<string[]>([])
  const [recipeEditor, setRecipeEditor] = useState<EditorReceta | null>(null)
  const deferredQuery = useDeferredValue(query)
  const deferredInitialSearch = useDeferredValue(initialSearch)
  const inspectorRef = useRef<HTMLDialogElement | null>(null)
  const ritualInspectorRef = useRef<HTMLDialogElement | null>(null)
  const initialPickerRef = useRef<HTMLDialogElement | null>(null)
  const recipeEditorRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => setData(initialData), [initialData])

  useEffect(() => {
    const dialog = inspectorRef.current
    if (!dialog) return
    if (selectedElementId && !dialog.open) dialog.showModal()
    else if (!selectedElementId && dialog.open) dialog.close()
  }, [selectedElementId])

  useEffect(() => {
    const dialog = ritualInspectorRef.current
    if (!dialog) return
    if (selectedRitualId && !dialog.open) dialog.showModal()
    else if (!selectedRitualId && dialog.open) dialog.close()
  }, [selectedRitualId])

  useEffect(() => {
    const dialog = recipeEditorRef.current
    if (!dialog) return
    if (recipeEditor && !dialog.open) dialog.showModal()
    else if (!recipeEditor && dialog.open) dialog.close()
  }, [recipeEditor])

  // Carga las condiciones de desbloqueo del elemento abierto (y las recarga
  // tras guardar, cuando llega la vista fresca del servidor).
  const condicionesDe = data.elements.find((element) => element.id === selectedElementId)
  const condCountServidor = condicionesDe?.unlockedAtDiscoveryCount ?? null
  const condReqServidor = condicionesDe?.requiredElementIds ?? []
  useEffect(() => {
    setCondCount(condCountServidor?.toString() ?? '')
    setCondReqIds(condReqServidor)
    setCondQuery('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElementId, data])

  const selectedPhase =
    data.phases.find((phase) => phase.id === selectedPhaseId) ??
    data.phases.filter((phase) => phase.isActive).at(-1) ??
    data.phases.at(-1)
  useEffect(() => {
    if (editorFase === 'editar' && selectedPhase) {
      setPhaseRule(selectedPhase.advancementRule)
    }
  }, [editorFase, selectedPhase])
  if (!selectedPhase) {
    return <p className="rounded-lg border border-wine/50 bg-wine/10 p-4 text-sm">No hay fases configuradas.</p>
  }

  const reachable = new Set(selectedPhase.reachableElementIds)
  const unreachableAvailable = new Set(selectedPhase.unreachableAvailableElementIds)
  const frontier = new Set(selectedPhase.frontierElementIds)

  const impactoActualDe = (id: string) =>
    selectedPhase.impactElementIdsBySourceId[id]?.length ?? 0

  const stateOf = (element: VistaFases['elements'][number]): EstadoElemento => {
    if (!element.isActive) return 'inactivo'
    if (reachable.has(element.id)) return 'disponible'
    if (unreachableAvailable.has(element.id)) return 'sin-ruta'
    if (frontier.has(element.id)) return 'frontera'
    return 'bloqueado'
  }

  const previousActivePhase = data.phases
    .filter((phase) => phase.isActive && phase.sortOrder < selectedPhase.sortOrder)
    .at(-1)
  const agrupado = agruparElementosDeFase(
    data.elements,
    selectedPhase,
    data.phases,
  )
  const phaseElements = agrupado.phaseElements
    .sort((left, right) => impactoActualDe(right.id) - impactoActualDe(left.id))
  const initialElementIds = new Set(selectedPhase.initialElementIds)
  const newReachableElementIds = new Set(selectedPhase.newReachableElementIds)
  const initialElements = phaseElements.filter((element) => initialElementIds.has(element.id))
  const newReachableElements = phaseElements.filter((element) => newReachableElementIds.has(element.id))
  const newReachableSequences = newReachableElements.filter(
    (element) => element.isBeyonderSequence,
  )
  const otherNewReachableElements = newReachableElements.filter(
    (element) => !element.isBeyonderSequence,
  )
  const poolElements = agrupado.poolElements
  const normalizedQuery = normalizarTexto(deferredQuery.trim())
  const matchesActiveFilters = (element: VistaFases['elements'][number]) => {
    const state = stateOf(element)
    if (filter !== 'todos' && state !== filter) return false
    return (
      normalizedQuery.length === 0 ||
      normalizarTexto(`${element.name} ${element.slug} ${element.type}`).includes(normalizedQuery)
    )
  }
  const visibleInitialElements = initialElements.filter(matchesActiveFilters)
  const visibleNewReachableSequences = newReachableSequences.filter(matchesActiveFilters)
  const visibleOtherNewReachableElements = otherNewReachableElements.filter(matchesActiveFilters)
  const visiblePoolElements = poolElements.filter(matchesActiveFilters)
  const scopedElements = [...phaseElements, ...poolElements]
  const ownedRitualIds = new Set(data.phases.flatMap((phase) => phase.ownRitualIds))
  const phaseRitualIds = new Set(selectedPhase.ownRitualIds)
  const phaseRituals = data.rituals.filter((ritual) => phaseRitualIds.has(ritual.id))
  const poolRituals = data.rituals.filter((ritual) => !ownedRitualIds.has(ritual.id))
  const preparedRitualIds = new Set(selectedPhase.preparedRitualIds)
  const ritualStateOf = (ritual: VistaFases['rituals'][number]): EstadoElemento => {
    if (!ritual.isActive || !ritual.advanceIsActive) return 'inactivo'
    return phaseRitualIds.has(ritual.id) ? 'disponible' : 'bloqueado'
  }
  const selectedElement = data.elements.find((element) => element.id === selectedElementId) ?? null
  const incoming = selectedElement
    ? data.recipes.filter((recipe) => recipe.outputElementIds.includes(selectedElement.id))
    : []
  const incomingAdvances = selectedElement
    ? data.advances.filter((advance) => advance.targetElementId === selectedElement.id)
    : []
  const outgoing = selectedElement
    ? data.recipes.filter((recipe) => recipe.ingredientElementIds.includes(selectedElement.id))
    : []
  const elementById = new Map(data.elements.map((element) => [element.id, element]))
  const ritualById = new Map(data.rituals.map((ritual) => [ritual.id, ritual]))
  const selectedRitual = selectedRitualId ? ritualById.get(selectedRitualId) ?? null : null
  const selectedRitualBlockers = selectedRitual
    ? selectedPhase.ritualBlockersById[selectedRitual.id]
    : undefined
  const ritualBlockingElements = (selectedRitualBlockers?.elementIds ?? []).flatMap((id) => {
    const element = elementById.get(id)
    return element ? [element] : []
  })
  const selectedRitualOwnerPhase = selectedRitual
    ? data.phases.find((phase) => phase.ownRitualIds.includes(selectedRitual.id))
    : undefined
  const selectedRitualPrepared = selectedRitual
    ? preparedRitualIds.has(selectedRitual.id)
    : false
  const selectedRitualAvailable = selectedRitual
    ? phaseRitualIds.has(selectedRitual.id)
    : false
  const editableRecipe = recipeEditor?.kind === 'editar'
    ? data.recipes.find((recipe) => recipe.id === recipeEditor.recipeId) ?? null
    : null
  const recipeContextElement = recipeEditor && recipeEditor.kind !== 'editar'
    ? elementById.get(recipeEditor.elementId) ?? null
    : null
  const recipeEditorTitle = recipeEditor?.kind === 'editar'
    ? 'Editar receta'
    : recipeEditor?.kind === 'nueva-como-resultado'
      ? `Nueva receta para obtener ${recipeContextElement?.name ?? 'el elemento'}`
      : `Nueva receta con ${recipeContextElement?.name ?? 'el elemento'}`
  const selectedBlockers = selectedElement
    ? selectedPhase.blockersByElementId[selectedElement.id]
    : undefined
  const blockingElements = (selectedBlockers?.elementIds ?? [])
    .filter((id) => id !== selectedElement?.id)
    .flatMap((id) => {
      const element = elementById.get(id)
      return element ? [element] : []
    })
  const selectedOpeningPhase = data.phases.find(
    (phase) => phase.id === selectedElement?.availableFromPhaseId,
  )
  const terminalBlockingReason = !selectedElement?.isActive
    ? 'El elemento está inactivo.'
    : selectedOpeningPhase && !selectedOpeningPhase.isActive
      ? `Su apertura pertenece a ${selectedOpeningPhase.name}, que está inactiva.`
      : selectedOpeningPhase && selectedOpeningPhase.sortOrder > selectedPhase.sortOrder
        ? `Se concede al abrir ${selectedOpeningPhase.name}.`
        : 'No tiene una ruta activa configurada desde el contenido de esta fase.'
  const matchesRitualFilters = (ritual: VistaFases['rituals'][number]) => {
    const state = ritualStateOf(ritual)
    if (filter !== 'todos' && state !== filter) return false
    const relatedNames = [
      ritual.sourceElementId,
      ritual.targetElementId,
      ...ritual.ingredientElementIds,
    ].map((id) => elementById.get(id)?.name ?? '')
    return (
      normalizedQuery.length === 0 ||
      normalizarTexto(`${ritual.name} ${ritual.advanceName} ${relatedNames.join(' ')}`).includes(
        normalizedQuery,
      )
    )
  }
  const visiblePhaseRituals = phaseRituals.filter(matchesRitualFilters)
  const visiblePoolRituals = poolRituals.filter(matchesRitualFilters)
  const scopedRituals = [...phaseRituals, ...poolRituals]
  const unreachableGroups = agruparContenidoPorBloqueadores([
    ...visiblePoolElements.map((element) => {
      const blockers = selectedPhase.blockersByElementId[element.id]
      const blockerIds = blockers?.elementIds ?? []
      const effectiveBlockerCount = new Set(
        blockerIds.filter((id) => id !== element.id),
      ).size
      return {
        id: element.id,
        kind: 'elemento' as const,
        blockerIds,
        targetElementId: element.id,
        missingCount: effectiveBlockerCount + (blockers?.conditions.length ?? 0),
        distance: blockers?.steps ?? null,
        fallbackGroup: !element.isActive
          ? 'Contenido inactivo'
          : blockers?.conditions.length
            ? 'Condición de progreso'
            : 'Sin ruta activa',
      }
    }),
    ...(showUnreachableRituals ? visiblePoolRituals : []).map((ritual) => {
      const blockers = selectedPhase.ritualBlockersById[ritual.id]
      const conditions = blockers?.conditions ?? []
      const blockerIds = blockers?.elementIds ?? []
      return {
        id: ritual.id,
        kind: 'ritual' as const,
        blockerIds,
        missingCount: new Set(blockerIds).size + conditions.length,
        distance: blockers?.steps ?? null,
        fallbackGroup: !ritual.isActive || !ritual.advanceIsActive
          ? 'Contenido inactivo'
          : conditions.some((condition) => condition.includes('destino ya'))
            ? 'Destino ya alcanzable'
            : conditions.some((condition) => condition.includes('Otro ritual'))
              ? 'Alternativa ya preparada'
              : conditions.length
                ? 'Condición de progreso'
                : 'Sin ruta activa',
      }
    }),
  ]).map((group) => {
    const items = [...group.items].sort((left, right) =>
      compararCercaniaBloqueo(left, right, blockerOrder),
    )
    return {
      ...group,
      items,
      missingCount: items[0]?.missingCount ?? 0,
      distance: items[0]?.distance ?? null,
      label: group.blockerIds.length > 0
        ? group.blockerIds.map((id) => elementById.get(id)?.name ?? '?').join(' + ')
        : group.fallbackGroup ?? 'Sin ruta activa',
    }
  }).sort((left, right) =>
    compararCercaniaBloqueo(left, right, blockerOrder) ||
    left.label.localeCompare(right.label, 'es'),
  )
  const initialCandidates = filtrarCandidatosIniciales(
    data.elements,
    data.phases.flatMap((phase) => phase.initialElementIds),
    data.recipeOutputElementIds,
  )
  const normalizedInitialSearch = normalizarTexto(deferredInitialSearch.trim())
  const visibleInitialCandidates = initialCandidates.filter(
    (element) =>
      normalizedInitialSearch.length === 0 ||
      normalizarTexto(`${element.name} ${element.slug} ${element.type}`).includes(
        normalizedInitialSearch,
      ),
  )
  const allVisibleCandidatesSelected =
    visibleInitialCandidates.length > 0 &&
    visibleInitialCandidates.every((element) => selectedInitialIds.includes(element.id))
  const ownerPhaseIdByElementId = new Map(
    data.phases.flatMap((phase) => phase.ownElementIds.map((id) => [id, phase.id] as const)),
  )

  const downstream = new Set(
    selectedElement
      ? (selectedPhase.impactElementIdsBySourceId[selectedElement.id] ?? [])
      : [],
  )
  const impactoPorFase = new Map<string | null, VistaFases['elements'][number][]>()
  for (const elementId of downstream) {
    const element = elementById.get(elementId)
    if (!element) continue
    const ownerPhaseId = ownerPhaseIdByElementId.get(element.id) ?? null
    const bucket = impactoPorFase.get(ownerPhaseId)
    if (bucket) bucket.push(element)
    else impactoPorFase.set(ownerPhaseId, [element])
  }
  for (const bucket of impactoPorFase.values()) {
    bucket.sort((left, right) => left.name.localeCompare(right.name, 'es'))
  }

  const reload = async () => {
    const response = await fetch('/api/admin/arbol?vista=fases', { cache: 'no-store' })
    if (!response.ok) throw new Error('No se pudo actualizar la vista.')
    const fresh = (await response.json()) as RespuestaArbolFases
    setData(fresh.fases)
    onDataChange(fresh)
    return fresh.fases
  }

  const assign = (
    elementIds: string[],
    phaseId: string | null,
    successMessage = 'Apertura automática actualizada. El cambio ya afecta al juego.',
    onSuccess?: () => void,
  ) => {
    if (elementIds.length === 0 || saving) return
    setSaving(true)
    setMessage(null)
    startTransition(async () => {
      const result = await asignarElementosAFase(elementIds, phaseId)
      if (!result.ok) {
        setMessage(result.error)
        setSaving(false)
        return
      }
      try {
        await reload()
        onSuccess?.()
        setMessage(successMessage)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la vista.')
      } finally {
        setSaving(false)
      }
    })
  }

  const addSelectedInitials = () => {
    const count = selectedInitialIds.length
    assign(
      selectedInitialIds,
      selectedPhase.id,
      count === 1
        ? 'Elemento añadido a los iniciales de la fase.'
        : `${count} elementos añadidos a los iniciales de la fase.`,
      () => initialPickerRef.current?.close(),
    )
  }

  const toggleReceta = (recipeId: string) => {
    if (saving) return
    const wasActive = data.recipes.find((recipe) => recipe.id === recipeId)?.isActive
    setSaving(true)
    setMessage(null)
    startTransition(async () => {
      try {
        await alternarRecetaActiva(recipeId)
        const fresh = await reload()
        const nowActive = fresh.recipes.find((recipe) => recipe.id === recipeId)?.isActive
        if (nowActive === wasActive) {
          setMessage('La receta no cambió: su producto está protegido por un avance activo.')
        } else {
          setMessage(nowActive ? 'Receta desbloqueada. El cambio ya afecta al juego.' : 'Receta bloqueada. El cambio ya afecta al juego.')
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la receta.')
      } finally {
        setSaving(false)
      }
    })
  }

  const borrarReceta = (recipeId: string) => {
    if (saving) return
    const recipe = data.recipes.find((item) => item.id === recipeId)
    const outputNames = recipe?.outputs
      .map((output) => elementById.get(output.elementId)?.name)
      .filter(Boolean)
      .join(', ')
    if (
      !window.confirm(
        `¿Eliminar esta receta? Los resultados${outputNames ? ` (${outputNames})` : ''} perderán esta ruta y podrán convertirse en elementos sin receta.`,
      )
    ) {
      return
    }

    setSaving(true)
    setMessage(null)
    startTransition(async () => {
      const result = await eliminarReceta(recipeId)
      if (!result.ok) {
        setMessage(result.error)
        setSaving(false)
        return
      }
      try {
        await reload()
        setMessage('Receta eliminada. Sus resultados ya no dependen de esa fórmula.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'La receta se eliminó, pero no se pudo actualizar la vista.')
      } finally {
        setSaving(false)
      }
    })
  }

  const toggleRitual = (ritualId: string) => {
    if (saving) return
    const wasActive = data.rituals.find((ritual) => ritual.id === ritualId)?.isActive
    setSaving(true)
    setMessage(null)
    startTransition(async () => {
      const result = await alternarRitualActivo(ritualId)
      if (!result.ok) {
        setMessage(result.error)
        setSaving(false)
        return
      }
      try {
        await reload()
        setMessage(wasActive ? 'Ritual bloqueado.' : 'Ritual activado.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el ritual.')
      } finally {
        setSaving(false)
      }
    })
  }

  const toggleActivo = () => {
    if (!selectedElement || saving) return
    const desactivando = selectedElement.isActive
    if (
      desactivando &&
      !window.confirm(
        `¿Desactivar «${selectedElement.name}»? Desaparece del juego y de todos los cálculos hasta reactivarlo.`,
      )
    ) {
      return
    }
    setSaving(true)
    setMessage(null)
    startTransition(async () => {
      try {
        await alternarElementoActivo(selectedElement.id)
        await reload()
        setMessage(desactivando ? 'Elemento desactivado.' : 'Elemento reactivado.')
      } catch {
        setMessage('No se pudo cambiar el estado del elemento.')
      } finally {
        setSaving(false)
      }
    })
  }

  const guardarCondiciones = () => {
    if (!selectedElement || saving) return
    const raw = condCount.trim()
    const count = raw === '' ? null : Number(raw)
    if (count !== null && (!Number.isInteger(count) || count < 0 || count > 9999)) {
      setMessage('La cantidad debe ser un entero entre 0 y 9999.')
      return
    }
    setSaving(true)
    setMessage(null)
    startTransition(async () => {
      const result = await guardarCondicionesDesbloqueo(selectedElement.id, {
        unlockedAtDiscoveryCount: count,
        requiredElementIds: condReqIds,
      })
      if (!result.ok) {
        setMessage(result.error)
        setSaving(false)
        return
      }
      try {
        await reload()
        setMessage('Condiciones guardadas. El cambio ya afecta al juego.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la vista.')
      } finally {
        setSaving(false)
      }
    })
  }

  const submitFase = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const form = new FormData(event.currentTarget)
    const id = editorFase === 'editar' ? selectedPhase.id : null
    setSaving(true)
    setMessage(null)
    startTransition(async () => {
      const result = await guardarFase(id, {
        slug: form.get('slug'),
        name: form.get('name'),
        description: form.get('description'),
        celebrationMessage: form.get('celebrationMessage'),
        sortOrder: form.get('sortOrder'),
        isActive: form.get('isActive') === 'on',
        advancementRule: phaseRule,
      })
      if (!result.ok) {
        setMessage(result.error)
        setSaving(false)
        return
      }
      try {
        await reload()
        setEditorFase(null)
        setMessage(id ? 'Fase actualizada.' : 'Fase creada.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la vista.')
      } finally {
        setSaving(false)
      }
    })
  }

  const submitFeatureGate = (event: React.FormEvent<HTMLFormElement>, key: FeatureKey) => {
    event.preventDefault()
    if (saving) return
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setMessage(null)
    startTransition(async () => {
      const result = await guardarFeatureGate({
        key,
        minimumPhaseSortOrder: form.get('minimumPhaseSortOrder'),
      })
      if (!result.ok) {
        setMessage(result.error)
        setSaving(false)
        return
      }
      try {
        await reload()
        setMessage('Feature actualizada. El cambio ya afecta al juego.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la vista.')
      } finally {
        setSaving(false)
      }
    })
  }

  const borrarFase = () => {
    if (saving) return
    const asignados = data.elements.filter(
      (element) => element.availableFromPhaseId === selectedPhase.id,
    )
    const aviso =
      asignados.length > 0
        ? `¿Eliminar «${selectedPhase.name}»? Sus ${asignados.length} elementos iniciales volverán al pool global.`
        : `¿Eliminar «${selectedPhase.name}»?`
    if (!window.confirm(aviso)) return
    setSaving(true)
    setMessage(null)
    startTransition(async () => {
      const result = await eliminarFase(selectedPhase.id)
      if (!result.ok) {
        setMessage(result.error)
        setSaving(false)
        return
      }
      try {
        await reload()
        setSelectedPhaseId('')
        setEditorFase(null)
        setMessage('Fase eliminada.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la vista.')
      } finally {
        setSaving(false)
      }
    })
  }

  const countByState = (state: EstadoElemento) =>
    scopedElements.filter((element) => stateOf(element) === state).length +
    scopedRituals.filter((ritual) => ritualStateOf(ritual) === state).length
  const filters: { id: Filtro; label: string; count: number }[] = [
    { id: 'todos', label: 'Todos', count: scopedElements.length + scopedRituals.length },
    {
      id: 'disponible',
      label: 'Alcanzables',
      count: countByState('disponible'),
    },
    {
      id: 'frontera',
      label: 'Frontera',
      count: countByState('frontera'),
    },
    {
      id: 'bloqueado',
      label: 'Bloqueados',
      count: countByState('bloqueado'),
    },
    {
      id: 'sin-ruta',
      label: 'Sin ruta',
      count: countByState('sin-ruta'),
    },
    { id: 'inactivo', label: 'Inactivos', count: countByState('inactivo') },
  ]

  return (
    <div className="space-y-4">
      <section className="mist-card overflow-hidden rounded-xl border border-line2">
        <div className="border-b border-line bg-black/15 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.2em] text-brass">Línea de progresión</p>
            {mode === 'editor' && <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditorFase((prev) => {
                    if (prev === 'editar') return null
                    setPhaseRule(selectedPhase.advancementRule)
                    return 'editar'
                  })
                  setMessage(null)
                }}
                className="flex items-center gap-1.5 rounded-md border border-line2 px-2.5 py-1.5 text-xs text-fog transition hover:border-brass hover:text-parchment"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar {selectedPhase.name}
              </button>
            </div>}
          </div>
          {message && !editorFase && !selectedElement && (
            <p role="status" className="mt-2 text-xs text-fog">{message}</p>
          )}
          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2">
            {data.phases.map((phase) => {
              const active = phase.id === selectedPhase.id
              return (
                <button
                  key={phase.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedPhaseId(phase.id)}
                  className={`min-h-28 min-w-0 rounded-lg border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brass ${
                    active
                      ? 'border-brass bg-brass/15 shadow-[0_0_24px_rgba(201,163,92,0.12)]'
                      : 'border-line2 bg-panel/50 hover:border-brass-deep'
                  }`}
                >
                  <span className="block break-words font-[family-name:var(--font-display)] text-lg text-parchment">
                    {phase.name}
                  </span>
                  <span className="mt-2 block text-[11px] leading-4 text-fog">
                    <span className="block">
                      {phase.ownElementIds.length} elementos · {phase.ownRitualIds.length} rituales
                    </span>
                    <span className="block line-clamp-2" title={phase.advancementRuleSummary}>
                      {phase.advancementRuleSummary}
                      {!phase.isActive && <span className="ml-1 text-wine">· inactiva</span>}
                    </span>
                  </span>
                </button>
              )
            })}
            {mode === 'editor' && (
              <button
                type="button"
                onClick={() => {
                  const previousClosure = data.phases
                    .filter((phase) => phase.isActive)
                    .at(-1)?.reachableElementIds.length ?? 0
                  setPhaseRule(
                    previousClosure === 0
                      ? { type: 'ALWAYS' }
                      : { type: 'DISCOVERY_COUNT', minimum: previousClosure },
                  )
                  setEditorFase('nueva')
                  setMessage(null)
                }}
                className="min-h-28 min-w-0 rounded-lg border border-dashed border-brass-deep bg-brass/5 p-3 text-left transition hover:border-brass focus-visible:ring-2 focus-visible:ring-brass"
              >
                <span className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg text-brass">
                  <Plus aria-hidden="true" className="h-4 w-4" /> Nueva fase
                </span>
                <span className="mt-2 block text-[11px] leading-4 text-fog">
                  Añadir una etapa a la progresión
                </span>
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-fog">Elementos iniciales</p>
            <p className="mt-1 text-2xl font-semibold text-parchment">{initialElements.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-fog">Nuevos alcanzables</p>
            <p className="mt-1 text-2xl font-semibold text-brass">{newReachableElements.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-fog">Cierre alcanzable</p>
            <p className="mt-1 text-2xl font-semibold text-parchment">{selectedPhase.reachableElementIds.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-fog">Rituales habilitados</p>
            <p className="mt-1 text-2xl font-semibold text-brass">{selectedPhase.reachableRitualIds.length}</p>
          </div>
        </div>
      </section>

      {mode === 'editor' && (
        <section aria-labelledby="features-title" className="mist-card rounded-xl border border-line2 p-4">
          <div className="mb-3">
            <h2 id="features-title" className="font-[family-name:var(--font-display)] text-lg text-parchment">
              Features por fase
            </h2>
            <p className="mt-1 text-xs text-fog">
              Cada feature se habilita al alcanzar el orden indicado y permanece disponible después.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {FEATURE_DEFINITIONS.map((definition) => {
              const configured = data.featureGates.find((gate) => gate.key === definition.key)
              return (
                <form
                  key={definition.key}
                  onSubmit={(event) => submitFeatureGate(event, definition.key)}
                  className="flex flex-col gap-3 rounded-lg border border-line bg-black/15 p-3 sm:flex-row sm:items-end"
                >
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`feature-${definition.key}`} className="block text-sm font-medium text-parchment">
                      {definition.label}
                    </label>
                    <p className="mt-1 text-xs text-fog">{definition.description}</p>
                  </div>
                  <div className="w-full sm:w-40">
                    <label htmlFor={`feature-${definition.key}`} className="etiqueta">Desde fase</label>
                    <input
                      id={`feature-${definition.key}`}
                      name="minimumPhaseSortOrder"
                      type="number"
                      min={1}
                      max={9999}
                      required
                      disabled={saving}
                      defaultValue={configured?.minimumPhaseSortOrder ?? definition.defaultMinimumPhaseSortOrder}
                      className="campo"
                    />
                  </div>
                  <button type="submit" disabled={saving} className="btn-brass text-sm disabled:opacity-50">
                    Guardar
                  </button>
                </form>
              )
            })}
          </div>
        </section>
      )}

      {mode === 'editor' && editorFase && (
        <section aria-label="Editor de fase" className="mist-card rounded-xl border border-brass/35 p-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-parchment">
            {editorFase === 'nueva' ? 'Nueva fase' : `Editar ${selectedPhase.name}`}
          </h2>
          {(() => {
            const fase = editorFase === 'editar' ? selectedPhase : null
            const nextOrder = Math.max(0, ...data.phases.map((phase) => phase.sortOrder)) + 1
            return (
              <form
                key={fase?.id ?? 'nueva'}
                onSubmit={submitFase}
                className="mt-3 space-y-3"
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label htmlFor="f-name" className="etiqueta">Nombre</label>
                    <input id="f-name" name="name" required maxLength={80} defaultValue={fase?.name ?? ''} className="campo" />
                  </div>
                  <div>
                    <label htmlFor="f-slug" className="etiqueta">Identificador (slug)</label>
                    <input
                      id="f-slug" name="slug" required maxLength={60}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      title="Solo minúsculas, números y guiones."
                      defaultValue={fase?.slug ?? ''} className="campo"
                    />
                  </div>
                  <div>
                    <label htmlFor="f-orden" className="etiqueta">Orden en la línea</label>
                    <input
                      id="f-orden" name="sortOrder" type="number" min={1} max={9999} required
                      defaultValue={fase?.sortOrder ?? nextOrder} className="campo"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="f-desc" className="etiqueta">Descripción</label>
                  <input id="f-desc" name="description" maxLength={500} defaultValue={fase?.description ?? ''} className="campo" />
                </div>
                <div>
                  <label htmlFor="f-celebration" className="etiqueta">Mensaje al entrar en esta fase</label>
                  <textarea
                    id="f-celebration"
                    name="celebrationMessage"
                    rows={3}
                    maxLength={500}
                    autoComplete="off"
                    defaultValue={
                      fase?.celebrationMessage ?? defaultPhaseCelebrationMessage(nextOrder)
                    }
                    className="campo resize-y"
                    aria-describedby="f-celebration-help"
                  />
                  <p id="f-celebration-help" className="mt-1 text-xs text-fog">
                    Aparece al avanzar a esta fase. Déjalo vacío para omitir el cartel.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-parchment">
                  <input type="checkbox" name="isActive" defaultChecked={fase?.isActive ?? true} className="accent-[var(--color-brass)]" />
                  Activa (las fases inactivas no cuentan para el juego)
                </label>
                <EditorReglaFase
                  value={phaseRule}
                  onChange={setPhaseRule}
                  elements={data.elements}
                  reachableElementCount={
                    fase?.unlockAtDiscoveryCount ??
                    data.phases.filter((phase) => phase.isActive).at(-1)?.reachableElementIds.length ??
                    0
                  }
                  disabled={saving}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" disabled={saving} className="btn-brass text-sm disabled:opacity-50">
                    {fase ? 'Guardar cambios' : 'Crear fase'}
                  </button>
                  {fase && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={borrarFase}
                      className="rounded-md border border-wine/60 px-3 py-2 text-sm text-wine transition hover:bg-wine/10 disabled:opacity-50"
                    >
                      Eliminar fase
                    </button>
                  )}
                  <button type="button" onClick={() => setEditorFase(null)} className="btn-ghost text-sm">
                    Cancelar
                  </button>
                  {message && <p role="status" className="text-xs text-fog">{message}</p>}
                </div>
              </form>
            )
          })()}
        </section>
      )}

      {mode === 'mapa' && (
        <GrafoDeFase
          grafo={grafo}
          phase={selectedPhase}
          previousPhase={previousActivePhase}
          inactiveRecipeIds={data.recipes.filter((recipe) => !recipe.isActive).map((recipe) => recipe.id)}
          selectedElementId={selectedElementId}
          onSelectElement={setSelectedElementId}
        />
      )}

      {mode === 'editor' && <>
        <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-fog" />
          <span className="sr-only">Buscar elemento o ritual</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar elementos o rituales…"
            className="campo w-full pl-9"
          />
        </label>
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              filter === item.id
                ? 'border-brass bg-brass/15 text-parchment'
                : 'border-line2 text-fog hover:border-brass-deep'
            }`}
          >
            {item.label} {item.count}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={showBlockerView}
          onClick={() => setShowBlockerView((visible) => !visible)}
          className="flex items-center gap-1.5 rounded-full border border-line2 px-3 py-1.5 text-xs text-fog transition hover:border-brass hover:text-parchment focus-visible:ring-2 focus-visible:ring-brass"
        >
          {showBlockerView ? (
            <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <Eye aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {showBlockerView ? 'Ocultar bloqueos' : 'Mostrar bloqueos'}
        </button>
        </div>

        <div className={`grid items-start gap-4 ${showBlockerView ? 'xl:grid-cols-2' : ''}`}>
        <section
          aria-label={`Contenido de ${selectedPhase.name}`}
          className="mist-card overflow-hidden rounded-xl border border-brass/35"
        >
          <header className="border-b border-line bg-brass/5 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-xl text-parchment">
                Contenido de {selectedPhase.name}
              </h2>
              <span className="rounded-full border border-brass/40 bg-brass/10 px-2.5 py-1 text-xs text-parchment">
                {phaseElements.length + phaseRituals.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-fog">
              Elementos y rituales asignados dinámicamente por el simulador completo.
            </p>
          </header>

          <div className="space-y-5 p-4">
            <section aria-labelledby="iniciales-fase">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 id="iniciales-fase" className="text-xs uppercase tracking-[0.16em] text-brass">
                    Elementos iniciales
                  </h3>
                  <p className="mt-1 text-xs text-fog">
                    {previousActivePhase
                      ? `Se conceden al completar ${previousActivePhase.name}.`
                      : 'Se conceden al comenzar la partida.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-fog">{initialElements.length}</span>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    disabled={saving}
                    onClick={() => {
                      setMessage(null)
                      setInitialSearch('')
                      setSelectedInitialIds([])
                      initialPickerRef.current?.showModal()
                    }}
                    className="flex items-center gap-1.5 rounded-md border border-brass/45 bg-brass/10 px-2.5 py-1.5 text-xs text-parchment transition hover:border-brass hover:bg-brass/15 focus-visible:ring-2 focus-visible:ring-brass disabled:opacity-50"
                  >
                    <Plus aria-hidden="true" className="h-3.5 w-3.5 text-brass" />
                    Añadir
                  </button>
                </div>
              </div>
              <ElementGrid
                elements={visibleInitialElements}
                selectedElementId={selectedElementId}
                stateOf={stateOf}
                onSelect={setSelectedElementId}
                emptyMessage="Esta fase no tiene elementos iniciales para este filtro."
                impactoDe={impactoActualDe}
                labelOf={() => 'Inicial'}
                onRemove={(element) =>
                  assign(
                    [element.id],
                    null,
                    `«${element.name}» ya no es inicial de ${selectedPhase.name}.`,
                  )
                }
                removeDisabled={saving}
              />
            </section>

            <section aria-labelledby="alcanzables-fase" className="border-t border-line pt-4">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 id="alcanzables-fase" className="text-xs uppercase tracking-[0.16em] text-brass">
                    Nuevos alcanzables
                  </h3>
                  <p className="mt-1 text-xs text-fog">
                    Primera fase donde aparecen por una ruta válida, ordenados por clase de contenido.
                  </p>
                </div>
                <span className="text-xs tabular-nums text-fog">
                  {newReachableElements.length + phaseRituals.length}
                </span>
              </div>
              <div className="space-y-2">
                <CollapsibleContentGroup
                  id={`alcanzables-secuencias-${mode}-${selectedPhase.id}`}
                  title="Secuencias"
                  description="Secuencias Beyonder alcanzadas por primera vez en esta fase."
                  count={newReachableSequences.length}
                  collapsed={collapsedReachableGroups.includes('secuencias')}
                  onToggle={() => setCollapsedReachableGroups((current) =>
                    current.includes('secuencias')
                      ? current.filter((key) => key !== 'secuencias')
                      : [...current, 'secuencias'],
                  )}
                >
                  <ElementGrid
                    elements={visibleNewReachableSequences}
                    selectedElementId={selectedElementId}
                    stateOf={stateOf}
                    onSelect={setSelectedElementId}
                    emptyMessage="Esta fase no tiene secuencias nuevas para este filtro."
                    impactoDe={impactoActualDe}
                    labelOf={() => 'Secuencia'}
                  />
                </CollapsibleContentGroup>

                <CollapsibleContentGroup
                  id={`alcanzables-rituales-${mode}-${selectedPhase.id}`}
                  title="Rituales"
                  description="Preparaciones habilitadas por el conocimiento y la secuencia de origen."
                  count={phaseRituals.length}
                  collapsed={collapsedReachableGroups.includes('rituales')}
                  onToggle={() => setCollapsedReachableGroups((current) =>
                    current.includes('rituales')
                      ? current.filter((key) => key !== 'rituales')
                      : [...current, 'rituales'],
                  )}
                >
                  <RitualGrid
                    rituals={visiblePhaseRituals}
                    elementById={elementById}
                    stateOf={ritualStateOf}
                    preparedRitualIds={preparedRitualIds}
                    selectedRitualId={selectedRitualId}
                    saving={saving}
                    onSelect={(id) => {
                      setSelectedElementId(null)
                      setSelectedRitualId(id)
                    }}
                    onToggle={toggleRitual}
                    emptyMessage="Esta fase no habilita rituales para este filtro."
                  />
                </CollapsibleContentGroup>

                <CollapsibleContentGroup
                  id={`alcanzables-elementos-${mode}-${selectedPhase.id}`}
                  title="Otros elementos"
                  description="Conceptos, criaturas y demás descubrimientos nuevos de la fase."
                  count={otherNewReachableElements.length}
                  collapsed={collapsedReachableGroups.includes('elementos')}
                  onToggle={() => setCollapsedReachableGroups((current) =>
                    current.includes('elementos')
                      ? current.filter((key) => key !== 'elementos')
                      : [...current, 'elementos'],
                  )}
                >
                  <ElementGrid
                    elements={visibleOtherNewReachableElements}
                    selectedElementId={selectedElementId}
                    stateOf={stateOf}
                    onSelect={setSelectedElementId}
                    emptyMessage="Esta fase no tiene otros elementos nuevos para este filtro."
                    impactoDe={impactoActualDe}
                    labelOf={() => 'Alcanzable'}
                  />
                </CollapsibleContentGroup>
              </div>
            </section>
          </div>
        </section>

        {showBlockerView && <section
          id="vista-bloqueos-no-alcanzables"
          aria-label="Contenido no alcanzable"
          className="mist-card overflow-hidden rounded-xl border border-line2"
        >
          <header className="border-b border-line bg-black/15 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-xl text-parchment">No alcanzables</h2>
              <span className="rounded-full border border-line2 px-2.5 py-1 text-xs text-fog">
                {poolElements.length + poolRituals.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-fog">
              Elementos y rituales agrupados por la frontera mínima que impide alcanzarlos.
            </p>
          </header>
          <div className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.16em] text-fog">
                {unreachableGroups.length} {unreachableGroups.length === 1 ? 'grupo de bloqueo' : 'grupos de bloqueo'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-fog">
                  Orden
                  <select
                    value={blockerOrder}
                    onChange={(event) => setBlockerOrder(event.target.value as OrdenBloqueos)}
                    className="rounded-md border border-line2 bg-ink px-2.5 py-1.5 text-xs text-parchment focus-visible:ring-2 focus-visible:ring-brass"
                  >
                    <option value="cercanos">Más cercanos primero</option>
                    <option value="lejanos">Más lejanos primero</option>
                  </select>
                </label>
                <button
                  type="button"
                  aria-pressed={showUnreachableRituals}
                  onClick={() => setShowUnreachableRituals((visible) => !visible)}
                  className="flex items-center gap-1.5 rounded-md border border-line2 px-2.5 py-1.5 text-xs text-fog transition hover:border-brass hover:text-parchment focus-visible:ring-2 focus-visible:ring-brass"
                >
                  {showUnreachableRituals ? (
                    <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : (
                    <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  {showUnreachableRituals ? 'Ocultar rituales' : 'Mostrar rituales'}
                </button>
              </div>
            </div>

            <div id="grupos-no-alcanzables">
              {unreachableGroups.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-fog">
                  No hay contenido no alcanzable para este filtro.
                </p>
              ) : (
                <div className="space-y-3">
                {unreachableGroups.map((group, index) => {
                  const elements = group.items
                    .filter((item) => item.kind === 'elemento')
                    .flatMap((item) => {
                      const element = elementById.get(item.id)
                      return element ? [element] : []
                    })
                  const rituals = group.items
                    .filter((item) => item.kind === 'ritual')
                    .flatMap((item) => {
                      const ritual = ritualById.get(item.id)
                      return ritual ? [ritual] : []
                    })
                  const mixed = elements.length > 0 && rituals.length > 0
                  const collapsed = collapsedBlockerGroups.includes(group.key)
                  return (
                    <section
                      key={group.key}
                      aria-labelledby={`grupo-bloqueo-${index}`}
                      className="overflow-hidden rounded-lg border border-line bg-black/15"
                    >
                      <button
                        type="button"
                        aria-expanded={!collapsed}
                        aria-controls={`contenido-grupo-bloqueo-${index}`}
                        onClick={() => setCollapsedBlockerGroups((current) =>
                          current.includes(group.key)
                            ? current.filter((key) => key !== group.key)
                            : [...current, group.key],
                        )}
                        className="flex w-full items-start gap-3 border-b border-line bg-black/15 px-3 py-2.5 text-left transition hover:bg-brass/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brass"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] uppercase tracking-[0.14em] text-fog">
                            {group.blockerIds.length > 0 ? 'Bloqueados por' : 'Motivo'}
                          </span>
                          <span
                            id={`grupo-bloqueo-${index}`}
                            className="mt-0.5 block break-words text-sm font-medium text-brass"
                          >
                            {group.label}
                          </span>
                          <span className="mt-1 block text-[10px] tabular-nums text-fog">
                            {group.distance === null
                              ? 'Sin distancia calculable'
                              : `${group.missingCount} ${group.missingCount === 1 ? 'bloqueador' : 'bloqueadores'} · ${group.distance} ${group.distance === 1 ? 'paso' : 'pasos'}`}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full border border-line2 px-2 py-0.5 text-xs tabular-nums text-fog">
                          {group.items.length}
                        </span>
                        <ChevronRight
                          aria-hidden="true"
                          className={`mt-0.5 h-4 w-4 shrink-0 text-brass transition-transform ${
                            collapsed ? '' : 'rotate-90'
                          }`}
                        />
                      </button>
                      <div
                        id={`contenido-grupo-bloqueo-${index}`}
                        hidden={collapsed}
                        className="space-y-3 p-3"
                      >
                        {elements.length > 0 && (
                          <div>
                            {mixed && (
                              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-fog">Elementos</p>
                            )}
                            <ElementGrid
                              elements={elements}
                              selectedElementId={selectedElementId}
                              stateOf={stateOf}
                              onSelect={setSelectedElementId}
                              emptyMessage="Sin elementos."
                            />
                          </div>
                        )}
                        {rituals.length > 0 && (
                          <div>
                            {mixed && (
                              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-fog">Rituales</p>
                            )}
                            <RitualGrid
                              rituals={rituals}
                              elementById={elementById}
                              stateOf={ritualStateOf}
                              preparedRitualIds={preparedRitualIds}
                              selectedRitualId={selectedRitualId}
                              saving={saving}
                              onSelect={(id) => {
                                setSelectedElementId(null)
                                setSelectedRitualId(id)
                              }}
                              onToggle={toggleRitual}
                              emptyMessage="Sin rituales."
                            />
                          </div>
                        )}
                      </div>
                    </section>
                  )
                })}
                </div>
              )}
              </div>
          </div>
        </section>}
        </div>
      </>}

      <dialog
        ref={initialPickerRef}
        aria-labelledby="selector-iniciales-titulo"
        onClose={() => {
          setInitialSearch('')
          setSelectedInitialIds([])
        }}
        onCancel={(event) => {
          if (saving) event.preventDefault()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !saving) initialPickerRef.current?.close()
        }}
        className="m-auto w-[min(92vw,54rem)] overscroll-contain bg-transparent p-0 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        <div aria-busy={saving} className="mist-card brass-ring overflow-hidden rounded-xl text-parchment">
          <header className="flex items-start justify-between gap-4 border-b border-line2 bg-black/35 px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.22em] text-brass">Apertura de fase</p>
              <h2
                id="selector-iniciales-titulo"
                className="mt-1 text-pretty font-[family-name:var(--font-display)] text-xl text-parchment"
              >
                Añadir iniciales a {selectedPhase.name}
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-fog">
                Elige elementos sin receta que no sean secuencias Beyonder ni iniciales de otra fase.
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar selector de elementos iniciales"
              disabled={saving}
              onClick={() => initialPickerRef.current?.close()}
              className="shrink-0 rounded-md border border-line2 p-1.5 text-fog transition hover:border-brass hover:text-parchment focus-visible:ring-2 focus-visible:ring-brass disabled:opacity-50"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </header>

          <div className="space-y-3 p-5">
            <label htmlFor="buscar-inicial" className="sr-only">Buscar elemento sin receta</label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-fog" />
              <input
                id="buscar-inicial"
                name="buscarInicial"
                type="search"
                autoComplete="off"
                value={initialSearch}
                onChange={(event) => setInitialSearch(event.target.value)}
                placeholder="Buscar por nombre, slug o tipo…"
                className="campo w-full pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-fog">
              <span className="tabular-nums">
                {visibleInitialCandidates.length} de {initialCandidates.length} disponibles · {selectedInitialIds.length} seleccionados
              </span>
              <button
                type="button"
                disabled={visibleInitialCandidates.length === 0 || saving}
                onClick={() => {
                  const visibleIds = new Set(visibleInitialCandidates.map((element) => element.id))
                  setSelectedInitialIds((current) =>
                    allVisibleCandidatesSelected
                      ? current.filter((id) => !visibleIds.has(id))
                      : [...new Set([...current, ...visibleIds])],
                  )
                }}
                className="rounded-md border border-line2 px-2.5 py-1.5 text-fog transition hover:border-brass hover:text-parchment focus-visible:ring-2 focus-visible:ring-brass disabled:opacity-45"
              >
                {allVisibleCandidatesSelected ? 'Quitar selección visible' : 'Seleccionar visibles'}
              </button>
            </div>

            {visibleInitialCandidates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-fog">
                {initialCandidates.length === 0
                  ? 'No quedan elementos sin receta disponibles.'
                  : 'Ningún elemento coincide con la búsqueda.'}
              </p>
            ) : (
              <ul className="grid max-h-[52vh] grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">
                {visibleInitialCandidates.map((element) => {
                  const selected = selectedInitialIds.includes(element.id)
                  return (
                    <li key={element.id} className="[content-visibility:auto]">
                      <label
                        className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition focus-within:ring-2 focus-within:ring-brass ${
                          selected
                            ? 'border-brass bg-brass/15 text-parchment'
                            : 'border-line2 bg-black/15 text-fog hover:border-brass-deep hover:text-parchment'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={saving}
                          onChange={() =>
                            setSelectedInitialIds((current) =>
                              selected
                                ? current.filter((id) => id !== element.id)
                                : [...current, element.id],
                            )
                          }
                          className="h-4 w-4 shrink-0 accent-[var(--color-brass)]"
                        />
                        <IconoElemento
                          iconKey={element.iconKey}
                          className="h-6 w-6 shrink-0 text-brass"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{element.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] uppercase tracking-wider opacity-70">
                            {element.type} · {element.slug}
                          </span>
                        </span>
                        {!element.isActive && (
                          <span className="shrink-0 rounded-full border border-wine/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-wine">
                            Inactivo
                          </span>
                        )}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line2 bg-black/20 px-5 py-3">
            {message && <p role="status" aria-live="polite" className="mr-auto text-xs text-fog">{message}</p>}
            <button
              type="button"
              disabled={saving}
              onClick={() => initialPickerRef.current?.close()}
              className="btn-ghost text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={selectedInitialIds.length === 0 || saving}
              onClick={addSelectedInitials}
              className="btn-brass text-sm disabled:opacity-50"
            >
              {saving
                ? 'Guardando…'
                : selectedInitialIds.length === 0
                  ? 'Añadir elementos'
                  : `Añadir ${selectedInitialIds.length} ${selectedInitialIds.length === 1 ? 'elemento' : 'elementos'}`}
            </button>
          </footer>
        </div>
      </dialog>

      <dialog
        ref={inspectorRef}
        aria-label="Expediente del elemento"
        onClose={() => setSelectedElementId(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) inspectorRef.current?.close()
        }}
        className="m-auto w-[min(92vw,60rem)] bg-transparent p-0 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        {selectedElement && (
          <div className="mist-card brass-ring anim-pop relative overflow-hidden rounded-xl text-parchment">
            <span className="sigilo-esquina left-2.5 top-2" aria-hidden>✦</span>
            <span className="sigilo-esquina right-2.5 top-2" aria-hidden>✦</span>
            <span className="sigilo-esquina bottom-2 left-2.5" aria-hidden>✦</span>
            <span className="sigilo-esquina bottom-2 right-2.5" aria-hidden>✦</span>

            <header className="border-b border-line2 bg-black/35 px-6 pb-5 pt-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-brass">
                  Expediente del archivo
                </p>
                <button
                  type="button"
                  onClick={() => inspectorRef.current?.close()}
                  aria-label="Cerrar expediente"
                  className="rounded-md border border-line2 p-1.5 text-fog transition hover:border-brass hover:text-parchment"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex items-start gap-4">
                <div className="rounded-lg border border-brass/40 bg-brass/10 p-3 text-brass shadow-[0_0_24px_rgba(201,163,92,0.18)]">
                  <IconoElemento iconKey={selectedElement.iconKey} className="h-8 w-8" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-[family-name:var(--font-display)] text-2xl leading-tight text-parchment">
                    {selectedElement.name}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs">
                    <code className="text-fog">{selectedElement.slug}</code>
                    <Link
                      href={`/admin/elementos/${selectedElement.id}`}
                      className="text-brass underline hover:brightness-110"
                    >
                      Ficha completa del elemento →
                    </Link>
                  </p>
                  {selectedElement.description && (
                    <p className="mt-2 max-w-prose text-sm italic leading-6 text-fog">
                      {selectedElement.description}
                    </p>
                  )}
                </div>
              </div>
            </header>

            <div className="max-h-[66vh] overflow-y-auto px-6 py-5">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div>
              <FormulaList
                title="Se obtiene con"
                recipes={incoming}
                elementById={elementById}
                onSelect={setSelectedElementId}
                onToggle={toggleReceta}
                onDelete={borrarReceta}
                onEdit={(recipeId) => setRecipeEditor({ kind: 'editar', recipeId })}
                onAdd={() => setRecipeEditor({
                  kind: 'nueva-como-resultado',
                  elementId: selectedElement.id,
                })}
                addLabel={`Añadir una receta que produzca ${selectedElement.name}`}
                saving={saving}
                advanceCount={incomingAdvances.length}
              />
              <AdvanceConditionsList
                advances={incomingAdvances}
                rituals={data.rituals}
                elementById={elementById}
                onSelect={setSelectedElementId}
              />
              {!reachable.has(selectedElement.id) && (
                <BlockingReasons
                  targetName={selectedElement.name}
                  blockers={blockingElements}
                  conditions={selectedBlockers?.conditions ?? []}
                  terminalReason={terminalBlockingReason}
                  stateOf={stateOf}
                  onSelect={setSelectedElementId}
                />
              )}
              <FormulaList
                title="Permite obtener"
                recipes={outgoing}
                elementById={elementById}
                onSelect={setSelectedElementId}
                onToggle={toggleReceta}
                onDelete={borrarReceta}
                onEdit={(recipeId) => setRecipeEditor({ kind: 'editar', recipeId })}
                onAdd={() => setRecipeEditor({
                  kind: 'nueva-como-ingrediente',
                  elementId: selectedElement.id,
                })}
                addLabel={`Añadir una receta que use ${selectedElement.name}`}
                saving={saving}
              />

              <section aria-label="Impacto en cadena" className="mt-6">
                <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                  <h4 className="text-xs uppercase tracking-[0.16em] text-brass">Impacto en cadena</h4>
                  <span className="text-[11px] tabular-nums text-fog">
                    {downstream.size} {downstream.size === 1 ? 'elemento' : 'elementos'}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-fog">
                  Descubrimientos del cierre de {selectedPhase.name} que dejarían de ser
                  alcanzables sin «{selectedElement.name}», agrupados por fase.
                </p>
                {downstream.size === 0 ? (
                  <p className="mt-2 text-xs text-fog">No desbloquea ningún otro elemento.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {[
                      ...data.phases.map((phase) => ({
                        key: phase.id,
                        label: phase.name,
                        current: phase.id === selectedPhase.id,
                        elements: impactoPorFase.get(phase.id) ?? [],
                      })),
                      {
                        key: 'sin-fase',
                        label: 'Sin fase calculada',
                        current: false,
                        elements: impactoPorFase.get(null) ?? [],
                      },
                    ]
                      .filter((group) => group.elements.length > 0)
                      .map((group) => (
                        <details
                          key={group.key}
                          className={`group rounded-lg border ${
                            group.current ? 'border-brass/45 bg-brass/5' : 'border-line bg-black/15'
                          }`}
                        >
                          <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 text-sm">
                            <ChevronRight
                              aria-hidden
                              className="h-4 w-4 shrink-0 text-brass-deep transition-transform group-open:rotate-90"
                            />
                            <span className={`flex-1 ${group.current ? 'text-parchment' : 'text-fog'}`}>
                              {group.label}
                            </span>
                            {group.current && (
                              <span className="rounded-full border border-brass/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brass">
                                Fase actual
                              </span>
                            )}
                            <span className="rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 text-xs tabular-nums text-brass">
                              {group.elements.length}
                            </span>
                          </summary>
                          <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-2.5">
                            {group.elements.map((element) => (
                              <button
                                key={element.id}
                                type="button"
                                onClick={() => setSelectedElementId(element.id)}
                                className="flex items-center gap-1.5 rounded-md border border-line2 bg-black/20 px-2 py-1 text-xs text-parchment transition hover:border-brass hover:text-brass"
                              >
                                <IconoElemento iconKey={element.iconKey} className="h-3.5 w-3.5 text-brass" />
                                {element.name}
                              </button>
                            ))}
                          </div>
                        </details>
                      ))}
                  </div>
                )}
              </section>
            </div>

            <div className="h-fit space-y-4">
            <div className="rounded-lg border border-line bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-brass">Elemento inicial de etapa</p>
              <p className="mt-1.5 text-xs leading-5 text-fog">
                Elige cuándo se concede el elemento o devuélvelo al pool global.
              </p>
              <div className="mt-3 grid gap-2">
                {data.phases.map((phase) => {
                  const active = selectedElement.availableFromPhaseId === phase.id
                  return (
                    <button
                      key={phase.id}
                      type="button"
                      disabled={saving}
                      onClick={() => assign([selectedElement.id], phase.id)}
                      className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
                        active
                          ? 'border-brass bg-brass/15 text-parchment'
                          : 'border-line2 text-fog hover:border-brass-deep hover:text-parchment'
                      }`}
                    >
                      Al abrir {phase.name}{!phase.isActive && ' · inactiva'}
                      {active && <Check className="h-4 w-4 shrink-0 text-brass" />}
                    </button>
                  )
                })}
                {data.phases.some(
                  (phase) =>
                    phase.id === selectedElement.availableFromPhaseId && !phase.isActive,
                ) && (
                  <p className="text-[11px] leading-4 text-wine">
                    Apertura retenida: la fase configurada está inactiva.
                  </p>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => assign([selectedElement.id], null)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                    selectedElement.availableFromPhaseId === null
                      ? 'border-wine bg-wine/15 text-parchment'
                      : 'border-line2 text-fog hover:border-wine/60'
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  <Ban className="h-4 w-4" /> Pool global · sin apertura automática
                </button>
              </div>
              <div className="mt-3 border-t border-line pt-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={toggleActivo}
                  className={`w-full rounded-md border px-3 py-2 text-sm transition disabled:opacity-50 ${
                    selectedElement.isActive
                      ? 'border-wine/60 text-wine hover:bg-wine/10'
                      : 'border-brass/45 text-brass hover:border-brass'
                  }`}
                >
                  {selectedElement.isActive ? 'Desactivar elemento' : 'Reactivar elemento'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-brass">Condiciones de desbloqueo</p>
              <p className="mt-1.5 text-xs leading-5 text-fog">
                En el pool global, aparece espontáneamente al cumplir estas condiciones. Una
                apertura de fase las ignora mientras siga asignada.
              </p>
              <label className="mt-3 block">
                <span className="etiqueta">Descubrimientos mínimos</span>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={condCount}
                  onChange={(event) => setCondCount(event.target.value)}
                  placeholder="Sin condición"
                  className="campo w-full"
                />
              </label>
              <div className="mt-3">
                <span className="etiqueta">Requiere descubrir (todos)</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {condReqIds.length === 0 && (
                    <span className="text-xs text-fog">Sin elementos requeridos.</span>
                  )}
                  {condReqIds.map((id) => (
                    <span
                      key={id}
                      className="flex items-center gap-1.5 rounded-md border border-line2 bg-black/20 px-2 py-1 text-xs text-parchment"
                    >
                      <IconoElemento
                        iconKey={elementById.get(id)?.iconKey ?? ''}
                        className="h-3.5 w-3.5 text-brass"
                      />
                      {elementById.get(id)?.name ?? '?'}
                      <button
                        type="button"
                        aria-label={`Quitar ${elementById.get(id)?.name ?? 'elemento'}`}
                        onClick={() => setCondReqIds((prev) => prev.filter((otro) => otro !== id))}
                        className="text-fog transition hover:text-wine"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={condQuery}
                  onChange={(event) => setCondQuery(event.target.value)}
                  placeholder="Añadir elemento…"
                  className="campo mt-2 w-full"
                />
                {condQuery.trim().length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {data.elements
                      .filter(
                        (element) =>
                          element.id !== selectedElement.id &&
                          !condReqIds.includes(element.id) &&
                          normalizarTexto(`${element.name} ${element.slug}`).includes(
                            normalizarTexto(condQuery.trim()),
                          ),
                      )
                      .slice(0, 6)
                      .map((element) => (
                        <button
                          key={element.id}
                          type="button"
                          onClick={() => {
                            setCondReqIds((prev) => [...prev, element.id])
                            setCondQuery('')
                          }}
                          className="flex items-center gap-1.5 rounded-md border border-brass/40 bg-brass/5 px-2 py-1 text-xs text-parchment transition hover:border-brass"
                        >
                          <Plus className="h-3 w-3 text-brass" />
                          <IconoElemento iconKey={element.iconKey} className="h-3.5 w-3.5 text-brass" />
                          {element.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={guardarCondiciones}
                className="btn-brass mt-4 w-full text-sm disabled:opacity-50"
              >
                Guardar condiciones
              </button>
            </div>

            {message && <p role="status" className="text-xs text-fog">{message}</p>}
            </div>
              </div>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        ref={ritualInspectorRef}
        aria-labelledby="expediente-ritual-titulo"
        onClose={() => setSelectedRitualId(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) ritualInspectorRef.current?.close()
        }}
        className="m-auto w-[min(92vw,52rem)] overscroll-contain bg-transparent p-0 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        {selectedRitual && (
          <div className="mist-card brass-ring overflow-hidden rounded-xl text-parchment">
            <header className="border-b border-line2 bg-black/35 px-6 pb-5 pt-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-brass">
                  Expediente ritual
                </p>
                <button
                  type="button"
                  aria-label="Cerrar expediente ritual"
                  onClick={() => ritualInspectorRef.current?.close()}
                  className="rounded-md border border-line2 p-1.5 text-fog transition hover:border-brass hover:text-parchment focus-visible:ring-2 focus-visible:ring-brass"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex items-start gap-4">
                <div className="rounded-lg border border-brass/40 bg-brass/10 p-3 text-brass shadow-[0_0_24px_rgba(201,163,92,0.18)]">
                  <Sparkles aria-hidden="true" className="h-8 w-8" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="expediente-ritual-titulo"
                    className="text-pretty font-[family-name:var(--font-display)] text-2xl leading-tight text-parchment"
                  >
                    {selectedRitual.name}
                  </h2>
                  <p className="mt-1 text-xs text-fog">
                    Protege {selectedRitual.advanceName}
                  </p>
                </div>
              </div>
            </header>

            <div className="max-h-[70vh] overflow-y-auto overscroll-contain p-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="min-w-0">
                  <section aria-labelledby="ruta-ritual-titulo">
                    <h3
                      id="ruta-ritual-titulo"
                      className="border-b border-line pb-1.5 text-xs uppercase tracking-[0.16em] text-brass"
                    >
                      Ruta de ascensión
                    </h3>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-black/20 p-3">
                      <FichaElemento
                        id={selectedRitual.sourceElementId}
                        elementById={elementById}
                        onSelect={(id) => {
                          setSelectedRitualId(null)
                          setSelectedElementId(id)
                        }}
                      />
                      <span aria-hidden="true" className="px-0.5 text-sm font-semibold text-brass">→</span>
                      <FichaElemento
                        id={selectedRitual.targetElementId}
                        elementById={elementById}
                        onSelect={(id) => {
                          setSelectedRitualId(null)
                          setSelectedElementId(id)
                        }}
                      />
                    </div>
                  </section>

                  <section aria-labelledby="ingredientes-ritual-titulo" className="mt-5">
                    <h3
                      id="ingredientes-ritual-titulo"
                      className="border-b border-line pb-1.5 text-xs uppercase tracking-[0.16em] text-brass"
                    >
                      Ingredientes rituales
                    </h3>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {selectedRitual.ingredientElementIds.map((id, index) => (
                        <Fragment key={`${selectedRitual.id}-ingredient-${id}-${index}`}>
                          {index > 0 && <span aria-hidden="true" className="text-sm text-brass-deep">+</span>}
                          <FichaElemento
                            id={id}
                            elementById={elementById}
                            onSelect={(elementId) => {
                              setSelectedRitualId(null)
                              setSelectedElementId(elementId)
                            }}
                          />
                        </Fragment>
                      ))}
                    </div>
                  </section>

                  {selectedRitualPrepared ? (
                    <section className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/15 p-3">
                      <div className="flex items-center gap-2 text-emerald-100">
                        <Check aria-hidden="true" className="h-4 w-4" />
                        <h3 className="text-xs uppercase tracking-[0.16em]">Preparado en esta fase</h3>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-fog">
                        El conocimiento, la secuencia y los ingredientes necesarios ya son alcanzables.
                      </p>
                    </section>
                  ) : (
                    <BlockingReasons
                      targetName={selectedRitual.name}
                      blockers={ritualBlockingElements}
                      conditions={selectedRitualBlockers?.conditions ?? []}
                      terminalReason={
                        !selectedRitual.isActive
                          ? 'El ritual está inactivo.'
                          : !selectedRitual.advanceIsActive
                            ? 'El avance protegido está inactivo.'
                            : selectedRitualAvailable
                              ? 'El ritual está habilitado, pero aún no figura como preparado.'
                              : 'No tiene una ruta activa desde el contenido de esta fase.'
                      }
                      stateOf={stateOf}
                      onSelect={(id) => {
                        setSelectedRitualId(null)
                        setSelectedElementId(id)
                      }}
                      title={selectedRitualAvailable ? 'Preparación pendiente' : 'Bloqueado en esta fase'}
                      description={selectedRitualAvailable
                        ? 'Frontera mínima para preparar esta alternativa ritual.'
                        : 'Frontera mínima para habilitar y preparar el ritual. Los intermediarios construibles están omitidos.'}
                    />
                  )}
                </div>

                <aside className="h-fit space-y-4">
                  <div className="rounded-lg border border-line bg-black/25 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-brass">Estado en la fase</p>
                    <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs ${
                      ESTADO_META[ritualStateOf(selectedRitual)].className
                    }`}>
                      {selectedRitualPrepared
                        ? 'Preparado'
                        : selectedRitualAvailable
                          ? 'Habilitado'
                          : ESTADO_META[ritualStateOf(selectedRitual)].label}
                    </span>
                    <p className="mt-3 text-xs leading-5 text-fog">
                      {selectedRitualOwnerPhase
                        ? `Primera disponibilidad: ${selectedRitualOwnerPhase.name}.`
                        : 'No se habilita en ninguna fase activa.'}
                    </p>
                  </div>

                  <div className="grid gap-2 rounded-lg border border-line bg-black/25 p-4">
                    <Link
                      href={`/admin/rituales?editar=${selectedRitual.id}`}
                      className="rounded-md border border-brass/45 bg-brass/10 px-3 py-2 text-center text-sm text-brass transition hover:border-brass hover:bg-brass/15 focus-visible:ring-2 focus-visible:ring-brass"
                    >
                      Editar ritual
                    </Link>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggleRitual(selectedRitual.id)}
                      className={`rounded-md border px-3 py-2 text-sm transition focus-visible:ring-2 focus-visible:ring-brass disabled:opacity-50 ${
                        selectedRitual.isActive
                          ? 'border-wine/60 text-wine hover:bg-wine/10'
                          : 'border-brass/45 text-brass hover:bg-brass/10'
                      }`}
                    >
                      {selectedRitual.isActive ? 'Bloquear ritual' : 'Activar ritual'}
                    </button>
                  </div>

                  {message && <p role="status" aria-live="polite" className="text-xs text-fog">{message}</p>}
                </aside>
              </div>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        ref={recipeEditorRef}
        aria-labelledby="editor-receta-expediente-titulo"
        onClose={() => setRecipeEditor(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) recipeEditorRef.current?.close()
        }}
        className="m-auto w-[min(92vw,56rem)] overscroll-contain bg-transparent p-0 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        {recipeEditor && (
          <div className="mist-card brass-ring overflow-hidden rounded-xl text-parchment">
            <header className="flex items-start justify-between gap-4 border-b border-line2 bg-black/35 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.22em] text-brass">Fórmula del archivo</p>
                <h2
                  id="editor-receta-expediente-titulo"
                  className="mt-1 text-pretty font-[family-name:var(--font-display)] text-xl text-parchment"
                >
                  {recipeEditorTitle}
                </h2>
                <p className="mt-1 text-xs leading-5 text-fog">
                  Guarda la fórmula y el expediente actualizará sus rutas de progresión.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar editor de receta"
                onClick={() => recipeEditorRef.current?.close()}
                className="shrink-0 rounded-md border border-line2 p-1.5 text-fog transition hover:border-brass hover:text-parchment focus-visible:ring-2 focus-visible:ring-brass"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </header>
            <div className="max-h-[78vh] overflow-y-auto overscroll-contain p-5">
              <ConstructorReceta
                key={recipeEditor.kind === 'editar'
                  ? `editar:${recipeEditor.recipeId}`
                  : `${recipeEditor.kind}:${recipeEditor.elementId}`}
                elementos={data.elements}
                receta={editableRecipe}
                ingredientesIniciales={recipeEditor.kind === 'nueva-como-ingrediente'
                  ? [{ elementId: recipeEditor.elementId, quantity: 1 }]
                  : []}
                outputsIniciales={recipeEditor.kind === 'nueva-como-resultado'
                  ? [{
                      elementId: recipeEditor.elementId,
                      quantity: 1,
                      chance: 1,
                      sortOrder: 0,
                    }]
                  : []}
                caminos={data.caminos}
                categorias={data.categorias}
                onSaved={async () => {
                  const successMessage = recipeEditor.kind === 'editar'
                    ? 'Receta actualizada. Las fases ya fueron recalculadas.'
                    : 'Receta creada. Las fases ya fueron recalculadas.'
                  try {
                    await reload()
                    setMessage(successMessage)
                  } catch (error) {
                    setMessage(error instanceof Error
                      ? error.message
                      : 'La receta se guardó, pero no se pudo actualizar la vista.')
                  } finally {
                    recipeEditorRef.current?.close()
                  }
                }}
                onCancel={() => recipeEditorRef.current?.close()}
              />
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}

function CollapsibleContentGroup({
  id,
  title,
  description,
  count,
  collapsed,
  onToggle,
  children,
}: {
  id: string
  title: string
  description: string
  count: number
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="overflow-hidden rounded-lg border border-line bg-black/15">
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={`${id}-content`}
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-brass/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brass"
      >
        <span className="min-w-0 flex-1">
          <span id={`${id}-title`} className="block text-sm font-medium text-parchment">
            {title}
          </span>
          <span className="mt-0.5 block text-pretty text-[11px] leading-4 text-fog">
            {description}
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-line2 px-2 py-0.5 text-xs tabular-nums text-fog">
          {count}
        </span>
        <ChevronRight
          aria-hidden="true"
          className={`mt-0.5 h-4 w-4 shrink-0 text-brass transition-transform ${
            collapsed ? '' : 'rotate-90'
          }`}
        />
      </button>
      <div id={`${id}-content`} hidden={collapsed} className="border-t border-line p-3">
        {children}
      </div>
    </section>
  )
}

function ElementGrid({
  elements,
  selectedElementId,
  stateOf,
  onSelect,
  emptyMessage,
  impactoDe,
  labelOf,
  onRemove,
  removeDisabled,
}: {
  elements: VistaFases['elements']
  selectedElementId: string | null
  stateOf: (element: VistaFases['elements'][number]) => EstadoElemento
  onSelect: (id: string) => void
  emptyMessage: string
  impactoDe?: (id: string) => number
  labelOf?: (element: VistaFases['elements'][number]) => string
  onRemove?: (element: VistaFases['elements'][number]) => void
  removeDisabled?: boolean
}) {
  if (elements.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-fog">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
      {elements.map((element) => {
        const state = stateOf(element)
        const meta = ESTADO_META[state]
        const selected = selectedElementId === element.id
        return (
          <div key={element.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(element.id)}
              aria-pressed={selected}
              className={`min-h-28 w-full rounded-lg border p-3 text-left transition ${meta.className} ${
                selected
                  ? 'ring-2 ring-brass ring-offset-2 ring-offset-ink'
                  : '[@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5'
              }`}
            >
              <div className={`flex items-start justify-between gap-2 ${onRemove ? 'pr-8' : ''}`}>
                <IconoElemento iconKey={element.iconKey} className="h-6 w-6 shrink-0" />
                {state === 'disponible' && <Check className="h-4 w-4" />}
                {state === 'frontera' && <TriangleAlert className="h-4 w-4" />}
                {state === 'bloqueado' && <LockKeyhole className="h-4 w-4" />}
              </div>
              <span className="mt-3 block text-sm font-medium">{element.name}</span>
              <span className="mt-1 block text-[10px] uppercase tracking-wider opacity-70">
                {labelOf?.(element) ?? meta.label}
                {impactoDe && <> · {impactoDe(element.id)} en cadena</>}
              </span>
            </button>
            {onRemove && (
              <button
                type="button"
                aria-label={`Quitar ${element.name} de los elementos iniciales`}
                title={`Quitar ${element.name} de la fase`}
                disabled={removeDisabled}
                onClick={() => onRemove(element)}
                className="pointer-events-none absolute right-2 top-2 rounded-md border border-wine/50 bg-ink/90 p-1.5 text-wine opacity-0 transition hover:border-wine hover:bg-wine/15 hover:text-parchment focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-wine disabled:opacity-35 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-70"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RitualGrid({
  rituals,
  elementById,
  stateOf,
  preparedRitualIds,
  selectedRitualId,
  saving,
  onSelect,
  onToggle,
  emptyMessage,
}: {
  rituals: VistaFases['rituals']
  elementById: Map<string, VistaFases['elements'][number]>
  stateOf: (ritual: VistaFases['rituals'][number]) => EstadoElemento
  preparedRitualIds: ReadonlySet<string>
  selectedRitualId: string | null
  saving: boolean
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  emptyMessage: string
}) {
  if (rituals.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-fog">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 2xl:grid-cols-2">
      {rituals.map((ritual) => {
        const state = stateOf(ritual)
        const meta = ESTADO_META[state]
        const selected = selectedRitualId === ritual.id
        const source = elementById.get(ritual.sourceElementId)?.name ?? 'Origen desconocido'
        const target = elementById.get(ritual.targetElementId)?.name ?? 'Destino desconocido'
        const ingredients = ritual.ingredientElementIds
          .map((id) => elementById.get(id)?.name ?? '?')
          .join(' + ')
        return (
          <article
            key={ritual.id}
            className={`flex min-h-40 flex-col rounded-lg border p-3 ${meta.className} ${
              selected ? 'ring-2 ring-brass ring-offset-2 ring-offset-ink' : ''
            }`}
          >
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => onSelect(ritual.id)}
              className="flex flex-1 flex-col rounded-md text-left transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-brass"
            >
              <span className="flex min-w-0 items-start gap-2.5">
                <span className="rounded-md border border-current/25 bg-black/15 p-1.5">
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{ritual.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] uppercase tracking-wider opacity-70">
                    {preparedRitualIds.has(ritual.id) ? 'Preparado' : meta.label}
                  </span>
                </span>
                {!ritual.advanceIsActive && (
                  <span className="shrink-0 rounded-full border border-wine/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-wine">
                    Avance inactivo
                  </span>
                )}
              </span>
              <span className="mt-3 block text-xs leading-5 opacity-85">
                <span className="font-medium">{source}</span> → <span className="font-medium">{target}</span>
              </span>
              <span className="line-clamp-2 text-xs leading-5 opacity-70">
                {ingredients || 'Sin ingredientes'} · protege {ritual.advanceName}
              </span>
            </button>
            <div className="mt-auto flex items-center justify-end gap-2 border-t border-current/15 pt-3">
              <Link
                href={`/admin/rituales?editar=${ritual.id}`}
                className="rounded-md border border-current/25 px-2.5 py-1.5 text-xs transition hover:bg-black/15 focus-visible:ring-2 focus-visible:ring-brass"
              >
                Editar
              </Link>
              <button
                type="button"
                disabled={saving}
                onClick={() => onToggle(ritual.id)}
                className={`rounded-md border px-2.5 py-1.5 text-xs transition focus-visible:ring-2 focus-visible:ring-brass disabled:opacity-50 ${
                  ritual.isActive
                    ? 'border-wine/60 text-wine hover:bg-wine/10'
                    : 'border-brass/45 text-brass hover:bg-brass/10'
                }`}
              >
                {ritual.isActive ? 'Bloquear' : 'Activar'}
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function FichaElemento({
  id,
  elementById,
  onSelect,
}: {
  id: string
  elementById: Map<string, VistaFases['elements'][number]>
  onSelect: (id: string) => void
}) {
  const element = elementById.get(id)
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className="flex items-center gap-1.5 rounded-md border border-line2 bg-black/20 px-2 py-1 text-xs text-parchment transition hover:border-brass hover:text-brass focus-visible:ring-2 focus-visible:ring-brass"
    >
      <IconoElemento iconKey={element?.iconKey ?? ''} className="h-3.5 w-3.5 text-brass" />
      {element?.name ?? '?'}
    </button>
  )
}

function BlockingReasons({
  targetName,
  blockers,
  conditions,
  terminalReason,
  stateOf,
  onSelect,
  title = 'Bloqueado en esta fase',
  description = 'Frontera mínima de la ruta más cercana. Los intermediarios construibles están omitidos.',
}: {
  targetName: string
  blockers: VistaFases['elements']
  conditions: string[]
  terminalReason: string
  stateOf: (element: VistaFases['elements'][number]) => EstadoElemento
  onSelect: (id: string) => void
  title?: string
  description?: string
}) {
  return (
    <section aria-label={`${title} de ${targetName}`} className="mt-4 rounded-lg border border-amber-500/35 bg-amber-950/10 p-3">
      <div className="flex items-center gap-2 text-amber-100">
        <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
        <h4 className="text-xs uppercase tracking-[0.16em]">{title}</h4>
      </div>
      {blockers.length > 0 || conditions.length > 0 ? (
        <>
          <p className="mt-2 text-xs leading-5 text-fog">{description}</p>
          {blockers.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {blockers.map((element) => {
                const meta = ESTADO_META[stateOf(element)]
                return (
                  <button
                    key={element.id}
                    type="button"
                    onClick={() => onSelect(element.id)}
                    className={`flex min-w-0 items-center gap-2 rounded-md border p-2 text-left transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-brass ${meta.className}`}
                  >
                    <IconoElemento iconKey={element.iconKey} className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{element.name}</span>
                      <span className="block text-[10px] uppercase tracking-wider opacity-70">{meta.label}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {conditions.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-100/85">
              {conditions.map((condition) => <li key={condition}>· {condition}</li>)}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs leading-5 text-fog">{terminalReason}</p>
      )}
    </section>
  )
}

function AdvanceConditionsList({
  advances,
  rituals,
  elementById,
  onSelect,
}: {
  advances: VistaFases['advances']
  rituals: VistaFases['rituals']
  elementById: Map<string, VistaFases['elements'][number]>
  onSelect: (id: string) => void
}) {
  if (advances.length === 0) return null

  return (
    <div className="mt-3 space-y-3">
      {advances.map((advance) => {
        const activeRituals = rituals.filter(
          (ritual) => ritual.advanceId === advance.id && ritual.isActive,
        )
        return (
          <article
            key={advance.id}
            className={`rounded-lg border p-3 ${
              advance.isActive ? 'border-brass/35 bg-brass/5' : 'border-wine/45 bg-wine/10'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-brass">Ruta de avance</p>
                <p className="mt-0.5 text-sm font-medium text-parchment">{advance.internalName}</p>
              </div>
              <div className="flex items-center gap-2">
                {!advance.isActive && (
                  <span className="rounded-full border border-wine/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-wine">
                    Inactivo
                  </span>
                )}
                <Link
                  href={`/admin/avances/${advance.id}`}
                  className="text-xs text-brass underline hover:brightness-110 focus-visible:ring-2 focus-visible:ring-brass"
                >
                  Editar avance
                </Link>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-black/20 p-2.5">
              <FichaElemento
                id={advance.sourceElementId}
                elementById={elementById}
                onSelect={onSelect}
              />
              <span aria-hidden="true" className="text-sm text-brass-deep">+</span>
              <Link
                href={`/admin/avances/${advance.id}`}
                className="rounded-md border border-brass/40 bg-brass/10 px-2 py-1 text-xs text-parchment transition hover:border-brass hover:text-brass focus-visible:ring-2 focus-visible:ring-brass"
              >
                Avance «{advance.internalName}»
              </Link>
              <span aria-hidden="true" className="px-0.5 text-sm font-semibold text-brass">→</span>
              <FichaElemento
                id={advance.targetElementId}
                elementById={elementById}
                onSelect={onSelect}
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <section className="rounded-md border border-line bg-black/15 p-2.5">
                <h5 className="text-[10px] uppercase tracking-[0.14em] text-fog">Crear la carta de avance</h5>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {advance.ingredientElementIds.map((id, index) => (
                    <Fragment key={`${advance.id}-ingredient-${id}-${index}`}>
                      {index > 0 && <span aria-hidden="true" className="text-sm text-brass-deep">+</span>}
                      <FichaElemento id={id} elementById={elementById} onSelect={onSelect} />
                    </Fragment>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-line bg-black/15 p-2.5">
                <h5 className="text-[10px] uppercase tracking-[0.14em] text-fog">Ritual requerido</h5>
                {activeRituals.length === 0 ? (
                  <p className="mt-2 text-xs text-fog">Este avance no exige un ritual activo.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {activeRituals.length > 1 && (
                      <p className="text-[11px] text-fog">Basta preparar uno de estos rituales.</p>
                    )}
                    {activeRituals.map((ritual) => (
                      <div key={ritual.id} className="rounded-md border border-brass/25 bg-brass/5 p-2">
                        <Link
                          href={`/admin/rituales?editar=${ritual.id}`}
                          className="text-xs font-medium text-brass underline hover:brightness-110 focus-visible:ring-2 focus-visible:ring-brass"
                        >
                          {ritual.name}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {ritual.ingredientElementIds.map((id, index) => (
                            <Fragment key={`${ritual.id}-ingredient-${id}-${index}`}>
                              {index > 0 && <span aria-hidden="true" className="text-sm text-brass-deep">+</span>}
                              <FichaElemento id={id} elementById={elementById} onSelect={onSelect} />
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function FormulaList({
  title,
  recipes,
  elementById,
  onSelect,
  onToggle,
  onDelete,
  onEdit,
  onAdd,
  addLabel,
  saving,
  advanceCount = 0,
}: {
  title: string
  recipes: VistaFases['recipes']
  elementById: Map<string, VistaFases['elements'][number]>
  onSelect: (id: string) => void
  onToggle: (recipeId: string) => void
  onDelete: (recipeId: string) => void
  onEdit: (recipeId: string) => void
  onAdd: () => void
  addLabel: string
  saving: boolean
  advanceCount?: number
}) {
  return (
    <section className="mt-6 first:mt-0">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5">
        <h4 className="text-xs uppercase tracking-[0.16em] text-brass">{title}</h4>
        <div className="flex items-center gap-2">
          <span className="text-[11px] tabular-nums text-fog">
            {recipes.length} {recipes.length === 1 ? 'receta' : 'recetas'}
            {advanceCount > 0 && <> · {advanceCount} {advanceCount === 1 ? 'avance' : 'avances'}</>}
          </span>
          <button
            type="button"
            aria-label={addLabel}
            disabled={saving}
            onClick={onAdd}
            className="flex items-center gap-1 rounded-md border border-brass/40 bg-brass/5 px-2 py-1 text-[11px] text-brass transition hover:border-brass hover:bg-brass/10 focus-visible:ring-2 focus-visible:ring-brass disabled:opacity-50"
          >
            <Plus aria-hidden="true" className="h-3 w-3" />
            Añadir
          </button>
        </div>
      </div>
      {recipes.length === 0 && advanceCount === 0 && (
        <p className="mt-2 text-xs text-fog">Sin recetas directas.</p>
      )}
      {recipes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {recipes.map((recipe) => (
            <li
              key={recipe.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5 ${
                recipe.isActive ? 'border-line bg-black/15' : 'border-wine/45 bg-wine/10'
              }`}
            >
              <div
                className={`flex min-w-0 flex-1 flex-wrap items-center gap-1.5 ${
                  recipe.isActive ? '' : 'opacity-60'
                }`}
              >
                {recipe.ingredientElementIds.map((id, index) => (
                  <Fragment key={`${recipe.id}-in-${id}-${index}`}>
                    {index > 0 && <span className="text-sm text-brass-deep">+</span>}
                    <FichaElemento id={id} elementById={elementById} onSelect={onSelect} />
                  </Fragment>
                ))}
                <span className="px-0.5 text-sm font-semibold text-brass">→</span>
                {recipe.outputElementIds.map((id, index) => (
                  <Fragment key={`${recipe.id}-out-${id}-${index}`}>
                    {index > 0 && <span className="text-sm text-brass-deep">+</span>}
                    <FichaElemento id={id} elementById={elementById} onSelect={onSelect} />
                  </Fragment>
                ))}
              </div>
              {!recipe.isActive && (
                <span className="shrink-0 rounded-full border border-wine/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-wine">
                  Bloqueada
                </span>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => onEdit(recipe.id)}
                className="flex shrink-0 items-center gap-1 rounded-md border border-line2 px-2.5 py-1 text-[11px] text-fog transition hover:border-brass hover:text-parchment focus-visible:ring-2 focus-visible:ring-brass disabled:opacity-50"
              >
                <Pencil aria-hidden="true" className="h-3 w-3" />
                Editar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => onToggle(recipe.id)}
                className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] transition disabled:opacity-50 ${
                  recipe.isActive
                    ? 'border-line2 text-fog hover:border-wine/60 hover:text-parchment'
                    : 'border-brass/40 text-brass hover:border-brass'
                }`}
              >
                {recipe.isActive ? 'Bloquear' : 'Desbloquear'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => onDelete(recipe.id)}
                className="flex shrink-0 items-center gap-1 rounded-md border border-wine/50 px-2.5 py-1 text-[11px] text-wine transition hover:border-wine hover:bg-wine/10 hover:text-parchment focus-visible:ring-2 focus-visible:ring-wine disabled:opacity-50"
              >
                <Trash2 aria-hidden="true" className="h-3 w-3" />
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
