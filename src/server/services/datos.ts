import type { PrismaClient } from '@/generated/prisma/client'
import { isIntentionalRecipeAdvanceDualOutcome } from '@/shared/formulaOverlapPolicy'
import {
  parsePhaseRule,
  phaseRuleElementSlugs,
  serializePhaseRule,
  summarizePhaseRule,
  type PhaseRule,
} from '@/shared/phaseRules'
import { descubrirIniciales } from '../domain/descubrimientos'
import { buildRecipeInputKey } from '../domain/inputKey'
import { DIFICULTAD_LABELS, etiquetaRuta } from '../domain/diagnostico'
import { importDocumentoSchema, type ImportDocumento } from '../schemas'
import { sincronizarStartersConPrimeraFase } from './fasesProgresion'
import { cargarAnalisisProgresion } from './progresion'

export class ImportError extends Error {}

// ---------- Exportación nominal (v2) ----------

// Lista de nombres por unidad ("Ojo ×2" → ["Ojo", "Ojo"]), ordenada en español.
function nombresPorUnidad(
  ingredientes: { quantity: number; element: { name: string } }[],
): string[] {
  return ingredientes
    .flatMap((ingredient) => Array<string>(ingredient.quantity).fill(ingredient.element.name))
    .sort((a, b) => a.localeCompare(b, 'es'))
}

function nombresElementos(elementos: { element: { name: string } }[]): string[] {
  return elementos.map((e) => e.element.name).sort((a, b) => a.localeCompare(b, 'es'))
}

export type RecetaNominal = {
  tipo: 'RECETA'
  nombre?: string
  ingredientes: string[]
  descubrimientosMinimos: number
  isActive: boolean
}

export type ElementoDesencadenanteNominal = {
  elemento: string
  camino?: string
  secuencia?: number
  nombreSecuencia?: string
}

export type OrigenElementoNominal =
  | { tipo: 'INICIAL' }
  | { tipo: 'APERTURA_FASE'; fase: string }
  | { tipo: 'SIN_ORIGEN_CONFIGURADO' }
  | RecetaNominal
  | {
      tipo: 'AVANCE'
      nombreInterno: string
      camino: string
      origen: SecuenciaResumida
      destino: SecuenciaResumida
      ingredientes: string[]
      isActive: boolean
    }
  | {
      tipo: 'FALLO_RITUAL'
      nombre: string
      avance: string
      camino: string
      origen: SecuenciaResumida
      destino: SecuenciaResumida
      requiredSequenceNumber: number
      ingredientes: string[]
      isActive: boolean
    }
  | { tipo: 'DESBLOQUEO_TIPO'; tipoElemento: string }
  | { tipo: 'DESBLOQUEO_SECUENCIA'; secuencia: number; alcance: 'CUALQUIER_CAMINO' }
  | { tipo: 'DESBLOQUEO_CANTIDAD'; cantidadMinima: number }
  | { tipo: 'DESBLOQUEO_ELEMENTO'; desencadenante: ElementoDesencadenanteNominal }
  | { tipo: 'DESBLOQUEO_CONJUNTO'; requisitos: ElementoDesencadenanteNominal[] }

// Receta donde el elemento participa como ingrediente (la otra dirección de
// `combinaciones`: no quién lo produce, sino qué ayuda a producir).
export type UsoRecetaNominal = {
  tipo: 'USO_RECETA'
  nombre?: string
  ingredientes: string[]
  produce: string[]
  descubrimientosMinimos: number
  isActive: boolean
}

export type UsoAvanceNominal = {
  tipo: 'USO_AVANCE'
  nombreInterno: string
  camino: string
  origen: SecuenciaResumida
  destino: SecuenciaResumida
  isActive: boolean
}

export type UsoRitualNominal = {
  tipo: 'USO_RITUAL'
  nombre: string
  avance: string
  isActive: boolean
}

export type ElementoNominal = {
  tipo: 'ELEMENTO'
  slug: string
  nombre: string
  descripcion: string
  tipoElemento: string
  nivel: number
  categorias: string[]
  isActive: boolean
  // Progresión: el mismo análisis que alimenta el panel de diagnóstico.
  alcanzable: boolean
  /** Pasos encadenados de la ruta más corta desde un elemento inicial. */
  profundidad: number | null
  dificultad: string
  /** Mejor forma de conseguirlo hoy, en lenguaje humano. */
  rutaMasFacil: string
  /** Resumen de vías alternativas ("2 recetas · 1 avance"). */
  resumenRutas: string
  faseApertura: string | null
  condicionesDesbloqueo: {
    cualquieraDe: ElementoDesencadenanteNominal[]
    todas: {
      tipoElemento: string | null
      secuencia: number | null
      cantidadMinima: number | null
      elementos: ElementoDesencadenanteNominal[]
    }
  }
  // Bloqueos espontáneos (qué lo despierta) y su reverso (a quién despierta).
  desbloqueadoPorTipo: string | null
  desbloqueadoPorSecuencia: number | null
  desbloqueadoPorCantidad: number | null
  desbloqueadoPorCualquieraDe: string[]
  desbloqueadoPorTodos: string[]
  desbloquea: string[]
  esRequisitoDe: string[]
  camino?: string
  secuencia?: number
  nombreSecuencia?: string
  // Combinaciones en ambas direcciones: quién lo produce y dónde participa.
  combinaciones: RecetaNominal[]
  usosEnRecetas: UsoRecetaNominal[]
  usosEnAvances: UsoAvanceNominal[]
  usosEnRituales: UsoRitualNominal[]
  origenes: OrigenElementoNominal[]
}

export type RitualNominal = {
  tipo: 'RITUAL'
  nombre: string
  isActive: boolean
  requiredSequenceNumber: number
  ingredientes: string[]
  consecuenciasFallo: string[]
}

export type AvanceNominal = {
  tipo: 'AVANCE'
  nombreInterno: string
  isActive: boolean
  ingredientes: string[]
}

export type SecuenciaResumida = {
  tipo: 'SECUENCIA'
  numero: number
  nombre: string
  elemento: string
}

export type AscensionNominal = {
  tipo: 'ASCENSION'
  origen: SecuenciaResumida
  destino: SecuenciaResumida
  avance: AvanceNominal
  rituales: RitualNominal[]
}

export type SecuenciaNominal = {
  tipo: 'SECUENCIA'
  numero: number
  nombre: string
  elemento: string
  ascensiones: AscensionNominal[]
}

export type CaminoNominal = {
  tipo: 'CAMINO'
  nombre: string
  isActive: boolean
  secuencias: SecuenciaNominal[]
}

export type NodoNominal =
  | FaseNominal
  | ElementoNominal
  | RecetaNominal
  | CaminoNominal
  | SecuenciaNominal
  | AscensionNominal
  | AvanceNominal
  | RitualNominal

export type FaseNominal = {
  tipo: 'FASE'
  slug: string
  nombre: string
  descripcion: string
  orden: number
  isActive: boolean
  cierreAlcanzableAnterior: number
  reglaAvance: PhaseRule
  resumenRegla: string
  mensajeCelebracion: string
  elementosIniciales: string[]
}

export type DocumentoElementosNominal = {
  version: 4
  exportadoEn: string
  fases: FaseNominal[]
  elementos: ElementoNominal[]
  caminos: CaminoNominal[]
}

// Exportación nominal para lectura humana o LLM: contrato TypeScript explícito,
// sin garantías de compatibilidad con formas anteriores. Cada nodo lleva un
// discriminador literal para que el tipo sea inequívoco. La v3 añade
// procedencia completa en ambos sentidos (quién produce cada cosa y dónde se
// usa) más la profundidad y dificultad del análisis de progresión.
export async function exportarElementosYCombinaciones(
  db: PrismaClient,
): Promise<DocumentoElementosNominal> {
  const [elementos, caminos, fases, progresion] = await Promise.all([
    db.element.findMany({
      include: {
        sequence: { include: { pathway: { select: { name: true } } } },
        categories: { include: { category: { select: { name: true } } } },
        availableFromPhase: { select: { slug: true, name: true } },
        unlockTriggers: {
          include: {
            trigger: {
              select: {
                name: true,
                sequence: {
                  select: {
                    number: true,
                    name: true,
                    pathway: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        unlockRequirements: {
          include: {
            required: {
              select: {
                name: true,
                sequence: {
                  select: {
                    number: true,
                    name: true,
                    pathway: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        // Reverso de los bloqueos: a quién despierta este elemento.
        desencadena: { include: { element: { select: { name: true } } } },
        requiredFor: { include: { element: { select: { name: true } } } },
        outputs: {
          include: {
            recipe: {
              include: {
                ingredients: {
                  include: { element: { select: { name: true } } },
                },
              },
            },
          },
        },
        // Usos: dónde participa como ingrediente.
        usedIn: {
          include: {
            recipe: {
              include: {
                ingredients: { include: { element: { select: { name: true } } } },
                outputs: { include: { element: { select: { name: true } } } },
              },
            },
          },
        },
        advanceIngredients: {
          include: {
            advance: {
              include: {
                sourceSequence: {
                  include: {
                    element: { select: { name: true } },
                    pathway: { select: { name: true } },
                  },
                },
                targetSequence: { include: { element: { select: { name: true } } } },
              },
            },
          },
        },
        ritualIngredients: {
          include: {
            ritual: { include: { advance: { select: { internalName: true } } } },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    db.pathway.findMany({
      include: {
        sequences: {
          // De la secuencia más alta (donde se empieza) a la más profunda.
          orderBy: { number: 'desc' },
          include: {
            element: { select: { id: true, name: true } },
            advancesTo: {
              include: {
                ingredients: { include: { element: { select: { name: true } } } },
                sourceSequence: { include: { element: { select: { name: true } } } },
                rituals: {
                  include: {
                    ingredients: { include: { element: { select: { name: true } } } },
                    failureOutputs: { include: { element: { select: { name: true } } } },
                  },
                  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                },
              },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.progressionPhase.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        elements: {
          select: { name: true },
          orderBy: { name: 'asc' },
        },
      },
    }),
    cargarAnalisisProgresion(db),
  ])

  const avancesPorElemento = new Map<string, OrigenElementoNominal[]>()
  const fallosPorElemento = new Map<string, OrigenElementoNominal[]>()
  const agregarOrigen = (
    mapa: Map<string, OrigenElementoNominal[]>,
    elemento: string,
    origen: OrigenElementoNominal,
  ) => mapa.set(elemento, [...(mapa.get(elemento) ?? []), origen])

  for (const camino of caminos) {
    for (const secuencia of camino.sequences) {
      const destino: SecuenciaResumida = {
        tipo: 'SECUENCIA',
        numero: secuencia.number,
        nombre: secuencia.name,
        elemento: secuencia.element.name,
      }
      for (const avance of secuencia.advancesTo) {
        const origen: SecuenciaResumida = {
          tipo: 'SECUENCIA',
          numero: avance.sourceSequence.number,
          nombre: avance.sourceSequence.name,
          elemento: avance.sourceSequence.element.name,
        }
        agregarOrigen(avancesPorElemento, secuencia.element.id, {
          tipo: 'AVANCE',
          nombreInterno: avance.internalName,
          camino: camino.name,
          origen,
          destino,
          ingredientes: nombresPorUnidad(avance.ingredients),
          isActive: avance.isActive,
        })
        for (const ritual of avance.rituals) {
          for (const consecuencia of ritual.failureOutputs) {
            agregarOrigen(fallosPorElemento, consecuencia.elementId, {
              tipo: 'FALLO_RITUAL',
              nombre: ritual.name,
              avance: avance.internalName,
              camino: camino.name,
              origen,
              destino,
              requiredSequenceNumber: ritual.requiredSequenceNumber,
              ingredientes: nombresPorUnidad(ritual.ingredients),
              isActive: avance.isActive && ritual.isActive,
            })
          }
        }
      }
    }
  }

  const referenciaDesencadenante = (elemento: {
    name: string
    sequence: null | {
      number: number
      name: string
      pathway: { name: string }
    }
  }): ElementoDesencadenanteNominal => ({
    elemento: elemento.name,
    ...(elemento.sequence
      ? {
          camino: elemento.sequence.pathway.name,
          secuencia: elemento.sequence.number,
          nombreSecuencia: elemento.sequence.name,
        }
      : {}),
  })
  const elementNameBySlug = new Map(elementos.map((elemento) => [elemento.slug, elemento.name]))

  return {
    version: 4 as const,
    exportadoEn: new Date().toISOString(),
    fases: fases.map((fase) => {
      const rule = parsePhaseRule(fase.advancementRuleJson, fase.unlockAtDiscoveryCount)
      return {
        tipo: 'FASE' as const,
        slug: fase.slug,
        nombre: fase.name,
        descripcion: fase.description,
        orden: fase.sortOrder,
        isActive: fase.isActive,
        cierreAlcanzableAnterior: fase.unlockAtDiscoveryCount,
        reglaAvance: rule,
        resumenRegla: summarizePhaseRule(rule, elementNameBySlug),
        mensajeCelebracion: fase.celebrationMessage,
        elementosIniciales: fase.elements.map((elemento) => elemento.name),
      }
    }),
    elementos: elementos.map((elemento) => {
      const res = progresion.analisis.get(elemento.id)

      const combinaciones: RecetaNominal[] = elemento.outputs
        .slice()
        .sort((a, b) => a.recipe.inputKey.localeCompare(b.recipe.inputKey))
        .map((output) => ({
          tipo: 'RECETA' as const,
          ...(output.recipe.name ? { nombre: output.recipe.name } : {}),
          ingredientes: nombresPorUnidad(output.recipe.ingredients),
          descubrimientosMinimos: output.recipe.minimumDiscoveries,
          isActive: output.recipe.isActive,
        }))

      const usosEnRecetas: UsoRecetaNominal[] = elemento.usedIn
        .slice()
        .sort((a, b) => a.recipe.inputKey.localeCompare(b.recipe.inputKey))
        .map((uso) => ({
          tipo: 'USO_RECETA' as const,
          ...(uso.recipe.name ? { nombre: uso.recipe.name } : {}),
          ingredientes: nombresPorUnidad(uso.recipe.ingredients),
          produce: nombresElementos(uso.recipe.outputs),
          descubrimientosMinimos: uso.recipe.minimumDiscoveries,
          isActive: uso.recipe.isActive,
        }))

      const usosEnAvances: UsoAvanceNominal[] = elemento.advanceIngredients.map((uso) => ({
        tipo: 'USO_AVANCE' as const,
        nombreInterno: uso.advance.internalName,
        camino: uso.advance.sourceSequence.pathway.name,
        origen: {
          tipo: 'SECUENCIA' as const,
          numero: uso.advance.sourceSequence.number,
          nombre: uso.advance.sourceSequence.name,
          elemento: uso.advance.sourceSequence.element.name,
        },
        destino: {
          tipo: 'SECUENCIA' as const,
          numero: uso.advance.targetSequence.number,
          nombre: uso.advance.targetSequence.name,
          elemento: uso.advance.targetSequence.element.name,
        },
        isActive: uso.advance.isActive,
      }))

      const usosEnRituales: UsoRitualNominal[] = elemento.ritualIngredients.map((uso) => ({
        tipo: 'USO_RITUAL' as const,
        nombre: uso.ritual.name,
        avance: uso.ritual.advance.internalName,
        isActive: uso.ritual.isActive,
      }))

      const origenes: OrigenElementoNominal[] = [
        ...(elemento.isStarter ? [{ tipo: 'INICIAL' as const }] : []),
        ...(elemento.availableFromPhase
          ? [{ tipo: 'APERTURA_FASE' as const, fase: elemento.availableFromPhase.name }]
          : []),
        ...combinaciones,
        ...(avancesPorElemento.get(elemento.id) ?? []),
        ...(fallosPorElemento.get(elemento.id) ?? []),
        ...(elemento.unlockedByType
          ? [{ tipo: 'DESBLOQUEO_TIPO' as const, tipoElemento: elemento.unlockedByType }]
          : []),
        ...(elemento.unlockedBySequenceNumber !== null
          ? [
              {
                tipo: 'DESBLOQUEO_SECUENCIA' as const,
                secuencia: elemento.unlockedBySequenceNumber,
                alcance: 'CUALQUIER_CAMINO' as const,
              },
            ]
          : []),
        ...(elemento.unlockedAtDiscoveryCount !== null
          ? [
              {
                tipo: 'DESBLOQUEO_CANTIDAD' as const,
                cantidadMinima: elemento.unlockedAtDiscoveryCount,
              },
            ]
          : []),
        ...elemento.unlockTriggers.map((trigger) => ({
          tipo: 'DESBLOQUEO_ELEMENTO' as const,
          desencadenante: referenciaDesencadenante(trigger.trigger),
        })),
        ...(elemento.unlockRequirements.length > 0
          ? [
              {
                tipo: 'DESBLOQUEO_CONJUNTO' as const,
                requisitos: elemento.unlockRequirements
                  .map((requirement) => referenciaDesencadenante(requirement.required))
                  .sort((a, b) => a.elemento.localeCompare(b.elemento, 'es')),
              },
            ]
          : []),
      ]
      if (origenes.length === 0) origenes.push({ tipo: 'SIN_ORIGEN_CONFIGURADO' })

      return {
        tipo: 'ELEMENTO' as const,
        slug: elemento.slug,
        nombre: elemento.name,
        descripcion: elemento.description,
        tipoElemento: elemento.type,
        nivel: elemento.tier,
        categorias: elemento.categories
          .map((c) => c.category.name)
          .sort((a, b) => a.localeCompare(b, 'es')),
        isActive: elemento.isActive,
        alcanzable: res?.reachable ?? false,
        profundidad: res?.depth ?? null,
        dificultad: DIFICULTAD_LABELS[res?.difficulty ?? 'impossible'],
        rutaMasFacil: res ? etiquetaRuta(res.bestRoute) : 'Sin ruta válida',
        resumenRutas: res?.routeSummary ?? '—',
        faseApertura: elemento.availableFromPhase?.name ?? null,
        condicionesDesbloqueo: {
          cualquieraDe: elemento.unlockTriggers
            .map((trigger) => referenciaDesencadenante(trigger.trigger))
            .sort((a, b) => a.elemento.localeCompare(b.elemento, 'es')),
          todas: {
            tipoElemento: elemento.unlockedByType,
            secuencia: elemento.unlockedBySequenceNumber,
            cantidadMinima: elemento.unlockedAtDiscoveryCount,
            elementos: elemento.unlockRequirements
              .map((requirement) => referenciaDesencadenante(requirement.required))
              .sort((a, b) => a.elemento.localeCompare(b.elemento, 'es')),
          },
        },
        desbloqueadoPorTipo: elemento.unlockedByType,
        desbloqueadoPorSecuencia: elemento.unlockedBySequenceNumber,
        desbloqueadoPorCantidad: elemento.unlockedAtDiscoveryCount,
        desbloqueadoPorCualquieraDe: elemento.unlockTriggers
          .map((trigger) => trigger.trigger.name)
          .sort((a, b) => a.localeCompare(b, 'es')),
        desbloqueadoPorTodos: elemento.unlockRequirements
          .map((requirement) => requirement.required.name)
          .sort((a, b) => a.localeCompare(b, 'es')),
        desbloquea: elemento.desencadena
          .map((t) => t.element.name)
          .sort((a, b) => a.localeCompare(b, 'es')),
        esRequisitoDe: elemento.requiredFor
          .map((r) => r.element.name)
          .sort((a, b) => a.localeCompare(b, 'es')),
        ...(elemento.sequence
          ? {
              camino: elemento.sequence.pathway.name,
              secuencia: elemento.sequence.number,
              nombreSecuencia: elemento.sequence.name,
            }
          : {}),
        combinaciones,
        usosEnRecetas,
        usosEnAvances,
        usosEnRituales,
        origenes,
      }
    }),
    caminos: caminos.map((camino) => ({
      tipo: 'CAMINO' as const,
      nombre: camino.name,
      isActive: camino.isActive,
      secuencias: camino.sequences.map((secuencia) => {
        const destino: SecuenciaResumida = {
          tipo: 'SECUENCIA',
          numero: secuencia.number,
          nombre: secuencia.name,
          elemento: secuencia.element.name,
        }
        return {
          tipo: 'SECUENCIA' as const,
          numero: secuencia.number,
          nombre: secuencia.name,
          elemento: secuencia.element.name,
          ascensiones: secuencia.advancesTo
            .slice()
            .sort((a, b) => a.sourceSequence.number - b.sourceSequence.number)
            .map((avance) => ({
              tipo: 'ASCENSION' as const,
              origen: {
                tipo: 'SECUENCIA' as const,
                numero: avance.sourceSequence.number,
                nombre: avance.sourceSequence.name,
                elemento: avance.sourceSequence.element.name,
              },
              destino,
              avance: {
                tipo: 'AVANCE' as const,
                nombreInterno: avance.internalName,
                isActive: avance.isActive,
                ingredientes: nombresPorUnidad(avance.ingredients),
              },
              rituales: avance.rituals.map((ritual) => ({
                tipo: 'RITUAL' as const,
                nombre: ritual.name,
                isActive: ritual.isActive,
                requiredSequenceNumber: ritual.requiredSequenceNumber,
                ingredientes: nombresPorUnidad(ritual.ingredients),
                consecuenciasFallo: nombresElementos(ritual.failureOutputs),
              })),
            })),
        }
      }),
    })),
  }
}

export async function exportarContenido(db: PrismaClient) {
  const [fases, featureGates, categorias, elementos, caminos, secuencias, recetas, avances, rituales, logros] = await Promise.all([
    db.progressionPhase.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.featureGate.findMany({ orderBy: { key: 'asc' } }),
    db.category.findMany({ include: { parent: { select: { slug: true } } }, orderBy: { sortOrder: 'asc' } }),
    db.element.findMany({
      include: {
        categories: { include: { category: { select: { slug: true } } } },
        unlockTriggers: { include: { trigger: { select: { slug: true } } } },
        unlockRequirements: { include: { required: { select: { slug: true } } } },
        availableFromPhase: { select: { slug: true } },
      },
      orderBy: { slug: 'asc' },
    }),
    db.pathway.findMany({ include: { category: { select: { slug: true } } }, orderBy: { slug: 'asc' } }),
    db.sequence.findMany({
      include: { pathway: { select: { slug: true } }, element: { select: { slug: true } } },
      orderBy: [{ pathwayId: 'asc' }, { number: 'asc' }],
    }),
    db.recipe.findMany({
      include: {
        outputs: { include: { element: { select: { slug: true } } } },
        ingredients: { include: { element: { select: { slug: true } } } },
      },
      orderBy: { inputKey: 'asc' },
    }),
    db.advance.findMany({
      include: {
        ingredients: { include: { element: { select: { slug: true } } } },
        sourceSequence: { include: { pathway: { select: { slug: true } } } },
        targetSequence: true,
      },
      orderBy: { inputKey: 'asc' },
    }),
    db.ritual.findMany({
      include: {
        advance: { include: { ingredients: { include: { element: { select: { slug: true } } } } } },
        ingredients: { include: { element: { select: { slug: true } } } },
        failureOutputs: { include: { element: { select: { slug: true } } } },
      },
      orderBy: { inputKey: 'asc' },
    }),
    db.achievement.findMany({
      include: {
        triggerElement: { select: { slug: true } },
        triggerSequence: { include: { pathway: { select: { slug: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return {
    version: 5 as const,
    exportadoEn: new Date().toISOString(),
    fases: fases.map((phase) => ({
      slug: phase.slug,
      name: phase.name,
      description: phase.description,
      sortOrder: phase.sortOrder,
      unlockAtDiscoveryCount: phase.unlockAtDiscoveryCount,
      advancementRule: parsePhaseRule(
        phase.advancementRuleJson,
        phase.unlockAtDiscoveryCount,
      ),
      celebrationMessage: phase.celebrationMessage,
      isActive: phase.isActive,
    })),
    featureGates: featureGates.map((gate) => ({
      key: gate.key,
      minimumPhaseSortOrder: gate.minimumPhaseSortOrder,
    })),
    categorias: categorias.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      parentSlug: c.parent?.slug ?? null,
      sortOrder: c.sortOrder,
      isHidden: c.isHidden,
      isActive: c.isActive,
    })),
    elementos: elementos.map((e) => ({
      slug: e.slug,
      name: e.name,
      description: e.description,
      iconKey: e.iconKey,
      imageUrl: e.imageUrl,
      type: e.type,
      tier: e.tier,
      isStarter: e.isStarter,
      isHiddenUntilDiscovered: e.isHiddenUntilDiscovered,
      isMajorDiscovery: e.isMajorDiscovery,
      revealTitle: e.revealTitle,
      revealText: e.revealText,
      unlockedByType: e.unlockedByType,
      unlockedBySequenceNumber: e.unlockedBySequenceNumber,
      unlockedAtDiscoveryCount: e.unlockedAtDiscoveryCount,
      unlockedByElements: e.unlockTriggers.map((t) => t.trigger.slug),
      unlockedByAllElements: e.unlockRequirements.map((r) => r.required.slug),
      openingPhaseSlug: e.availableFromPhase?.slug ?? null,
      isActive: e.isActive,
      categorias: e.categories.map((ec) => ({
        slug: ec.category.slug,
        isPrimary: ec.isPrimary,
      })),
    })),
    caminos: caminos.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      categorySlug: p.category.slug,
      iconKey: p.iconKey,
      isHiddenUntilDiscovered: p.isHiddenUntilDiscovered,
      isActive: p.isActive,
    })),
    secuencias: secuencias.map((s) => ({
      pathwaySlug: s.pathway.slug,
      number: s.number,
      name: s.name,
      description: s.description,
      elementSlug: s.element.slug,
    })),
    recetas: recetas.map((r) => ({
      name: r.name,
      outputs: r.outputs.map((o) => ({
        elementSlug: o.element.slug,
        quantity: o.quantity,
        chance: o.chance,
        sortOrder: o.sortOrder,
      })),
      successText: r.successText,
      hintText: r.hintText,
      minimumDiscoveries: r.minimumDiscoveries,
      isActive: r.isActive,
      ingredientes: r.ingredients.map((i) => ({
        elementSlug: i.element.slug,
        quantity: i.quantity,
      })),
    })),
    avances: avances.map((advance) => ({
      internalName: advance.internalName,
      pathwaySlug: advance.sourceSequence.pathway.slug,
      sourceSequenceNumber: advance.sourceSequence.number,
      targetSequenceNumber: advance.targetSequence.number,
      isActive: advance.isActive,
      ingredientes: advance.ingredients.map((ingredient) => ({
        elementSlug: ingredient.element.slug,
        quantity: ingredient.quantity,
      })),
    })),
    rituales: rituales.map((ritual) => ({
      name: ritual.name,
      requiredSequenceNumber: ritual.requiredSequenceNumber,
      isActive: ritual.isActive,
      advanceIngredients: ritual.advance.ingredients.map((ingredient) => ({
        elementSlug: ingredient.element.slug,
        quantity: ingredient.quantity,
      })),
      ingredientes: ritual.ingredients.map((ingredient) => ({
        elementSlug: ingredient.element.slug,
        quantity: ingredient.quantity,
      })),
      failureOutputSlugs: ritual.failureOutputs.map((output) => output.element.slug),
    })),
    logros: logros.map((achievement) =>
      achievement.triggerSequence
        ? {
            slug: achievement.slug,
            name: achievement.name,
            description: achievement.description,
            iconKey: achievement.iconKey,
            isHiddenUntilUnlocked: achievement.isHiddenUntilUnlocked,
            isActive: achievement.isActive,
            triggerType: 'SEQUENCE' as const,
            triggerPathwaySlug: achievement.triggerSequence.pathway.slug,
            triggerSequenceNumber: achievement.triggerSequence.number,
          }
        : {
            slug: achievement.slug,
            name: achievement.name,
            description: achievement.description,
            iconKey: achievement.iconKey,
            isHiddenUntilUnlocked: achievement.isHiddenUntilUnlocked,
            isActive: achievement.isActive,
            triggerType: 'ELEMENT' as const,
            triggerElementSlug: achievement.triggerElement?.slug ?? '',
          },
    ),
  }
}

// ---------- Validación previa a la importación ----------

export type ResumenImportacion = {
  fases: number
  featureGates: number
  categorias: number
  elementos: number
  caminos: number
  secuencias: number
  recetas: number
  avances: number
  rituales: number
  logros: number
  problemas: string[]
}

export function validarDocumento(raw: unknown): { doc: ImportDocumento; resumen: ResumenImportacion } {
  const parsed = importDocumentoSchema.safeParse(raw)
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .slice(0, 8)
      .map((i) => `${i.path.join('.') || 'raíz'}: ${i.message}`)
      .join(' · ')
    throw new ImportError(`El archivo no tiene un formato válido. ${detalle}`)
  }
  const doc = parsed.data
  const problemas: string[] = []

  const catSlugs = new Set(doc.categorias.map((c) => c.slug))
  const elSlugs = new Set(doc.elementos.map((e) => e.slug))
  const caminoSlugs = new Set(doc.caminos.map((p) => p.slug))

  if (catSlugs.size !== doc.categorias.length) problemas.push('Hay categorías con slug repetido.')
  if (elSlugs.size !== doc.elementos.length) problemas.push('Hay elementos con slug repetido.')
  if (caminoSlugs.size !== doc.caminos.length) problemas.push('Hay caminos con slug repetido.')

  for (const c of doc.categorias) {
    if (c.parentSlug && !catSlugs.has(c.parentSlug))
      problemas.push(`La categoría «${c.slug}» apunta a un padre inexistente («${c.parentSlug}»).`)
  }
  for (const e of doc.elementos) {
    for (const ec of e.categorias) {
      if (!catSlugs.has(ec.slug))
        problemas.push(`El elemento «${e.slug}» usa la categoría inexistente «${ec.slug}».`)
    }
    for (const t of e.unlockedByElements) {
      if (!elSlugs.has(t))
        problemas.push(`El elemento «${e.slug}» tiene el desencadenante inexistente «${t}».`)
      if (t === e.slug)
        problemas.push(`El elemento «${e.slug}» se desencadena a sí mismo.`)
    }
    for (const t of e.unlockedByAllElements) {
      if (!elSlugs.has(t))
        problemas.push(`El elemento «${e.slug}» tiene el requisito AND inexistente «${t}».`)
      if (t === e.slug)
        problemas.push(`El elemento «${e.slug}» se requiere a sí mismo en un AND.`)
    }
  }
  for (const p of doc.caminos) {
    if (!catSlugs.has(p.categorySlug))
      problemas.push(`El camino «${p.slug}» usa la categoría inexistente «${p.categorySlug}».`)
  }
  const seqPorElemento = new Set<string>()
  const seqPorCaminoNumero = new Set<string>()
  const elementoPorCaminoNumero = new Map<string, string>()
  for (const s of doc.secuencias) {
    if (!caminoSlugs.has(s.pathwaySlug))
      problemas.push(`La secuencia ${s.number} referencia el camino inexistente «${s.pathwaySlug}».`)
    if (!elSlugs.has(s.elementSlug))
      problemas.push(`La secuencia ${s.number} referencia el elemento inexistente «${s.elementSlug}».`)
    if (seqPorElemento.has(s.elementSlug))
      problemas.push(`El elemento «${s.elementSlug}» representa más de una secuencia.`)
    seqPorElemento.add(s.elementSlug)
    const key = `${s.pathwaySlug}#${s.number}`
    if (seqPorCaminoNumero.has(key))
      problemas.push(`El camino «${s.pathwaySlug}» repite la secuencia número ${s.number}.`)
    seqPorCaminoNumero.add(key)
    elementoPorCaminoNumero.set(key, s.elementSlug)
  }
  const claves = new Set<string>()
  const recetasPorClave = new Map<string, (typeof doc.recetas)[number]>()
  for (const r of doc.recetas) {
    if (r.outputs.length === 0) {
      problemas.push('Una receta no tiene ningún resultado.')
    }
    for (const o of r.outputs) {
      if (!elSlugs.has(o.elementSlug))
        problemas.push(`Una receta produce el elemento inexistente «${o.elementSlug}».`)
    }
    for (const i of r.ingredientes) {
      if (!elSlugs.has(i.elementSlug))
        problemas.push(`Una receta usa el ingrediente inexistente «${i.elementSlug}».`)
    }
    // La inputKey SIEMPRE se recalcula aquí; la del archivo (si viene) se ignora.
    const key = buildRecipeInputKey(
      r.ingredientes.map((i) => ({ slug: i.elementSlug, quantity: i.quantity })),
    )
    if (claves.has(key)) problemas.push(`Hay recetas duplicadas para la combinación «${key}».`)
    claves.add(key)
    recetasPorClave.set(key, r)
  }
  const advanceKeys = new Set<string>()
  const advancesByKey = new Map<string, (typeof doc.avances)[number]>()
  for (const advance of doc.avances) {
    if (!caminoSlugs.has(advance.pathwaySlug)) {
      problemas.push(`Un avance usa el camino inexistente «${advance.pathwaySlug}».`)
    }
    if (!seqPorCaminoNumero.has(`${advance.pathwaySlug}#${advance.sourceSequenceNumber}`)) {
      problemas.push(`Un avance usa una secuencia de origen inexistente.`)
    }
    if (!seqPorCaminoNumero.has(`${advance.pathwaySlug}#${advance.targetSequenceNumber}`)) {
      problemas.push(`Un avance usa una secuencia de destino inexistente.`)
    }
    if (advance.sourceSequenceNumber === advance.targetSequenceNumber) {
      problemas.push(`El avance «${advance.internalName}» usa la misma secuencia como origen y destino.`)
    }
    for (const ingredient of advance.ingredientes) {
      if (!elSlugs.has(ingredient.elementSlug)) {
        problemas.push(`Un avance usa el ingrediente inexistente «${ingredient.elementSlug}».`)
      }
    }
    const key = buildRecipeInputKey(
      advance.ingredientes.map((ingredient) => ({
        slug: ingredient.elementSlug,
        quantity: ingredient.quantity,
      })),
    )
    const overlappingRecipe = recetasPorClave.get(key)
    const targetSlug = elementoPorCaminoNumero.get(
      `${advance.pathwaySlug}#${advance.targetSequenceNumber}`,
    )
    if (
      overlappingRecipe &&
      (!targetSlug ||
        !isIntentionalRecipeAdvanceDualOutcome({
          inputKey: key,
          recipeOutputSlugs: overlappingRecipe.outputs.map((output) => output.elementSlug),
          advanceTargetSlug: targetSlug,
        }))
    ) {
      problemas.push(`La combinación «${key}» está repetida entre recetas y avances.`)
    }
    if (advanceKeys.has(key)) problemas.push(`Hay avances duplicados para la combinación «${key}».`)
    claves.add(key)
    advanceKeys.add(key)
    advancesByKey.set(key, advance)
  }
  const ritualKeys = new Set<string>()
  for (const ritual of doc.rituales) {
    for (const ingredient of [...ritual.ingredientes, ...ritual.advanceIngredients]) {
      if (!elSlugs.has(ingredient.elementSlug)) {
        problemas.push(`El ritual «${ritual.name}» usa el elemento inexistente «${ingredient.elementSlug}».`)
      }
    }
    for (const slug of ritual.failureOutputSlugs) {
      if (!elSlugs.has(slug)) problemas.push(`El ritual «${ritual.name}» produce el elemento inexistente «${slug}».`)
    }
    const key = buildRecipeInputKey(
      ritual.ingredientes.map((ingredient) => ({ slug: ingredient.elementSlug, quantity: ingredient.quantity })),
    )
    if (ritualKeys.has(key)) problemas.push(`Hay rituales duplicados para la combinación «${key}».`)
    ritualKeys.add(key)
    const advanceKey = buildRecipeInputKey(
      ritual.advanceIngredients.map((ingredient) => ({ slug: ingredient.elementSlug, quantity: ingredient.quantity })),
    )
    if (!advanceKeys.has(advanceKey)) problemas.push(`El ritual «${ritual.name}» usa un avance inexistente.`)
    const linkedAdvance = advancesByKey.get(advanceKey)
    if (
      linkedAdvance &&
      ritual.requiredSequenceNumber !== linkedAdvance.sourceSequenceNumber
    ) {
      problemas.push(
        `El ritual «${ritual.name}» exige la secuencia ${ritual.requiredSequenceNumber}, pero su avance parte de la ${linkedAdvance.sourceSequenceNumber}.`,
      )
    }
  }
  const logroSlugs = new Set<string>()
  for (const achievement of doc.logros) {
    if (logroSlugs.has(achievement.slug)) problemas.push(`Hay logros con el slug repetido «${achievement.slug}».`)
    logroSlugs.add(achievement.slug)
    if (achievement.triggerType === 'ELEMENT') {
      if (!elSlugs.has(achievement.triggerElementSlug)) {
        problemas.push(`El logro «${achievement.slug}» usa un elemento inexistente.`)
      }
    } else if (!seqPorCaminoNumero.has(`${achievement.triggerPathwaySlug}#${achievement.triggerSequenceNumber}`)) {
      problemas.push(`El logro «${achievement.slug}» usa una secuencia inexistente.`)
    }
  }
  const phaseSlugs = new Set<string>()
  const phaseOrders = new Set<number>()
  for (const phase of doc.fases) {
    if (phaseSlugs.has(phase.slug)) problemas.push(`Hay fases con el slug repetido «${phase.slug}».`)
    if (phaseOrders.has(phase.sortOrder)) problemas.push(`Hay fases con el orden repetido ${phase.sortOrder}.`)
    phaseSlugs.add(phase.slug)
    phaseOrders.add(phase.sortOrder)
    for (const elementSlug of phaseRuleElementSlugs(phase.advancementRule)) {
      if (!elSlugs.has(elementSlug)) {
        problemas.push(
          `La regla de la fase «${phase.slug}» referencia el elemento inexistente «${elementSlug}».`,
        )
      }
    }
  }
  for (const element of doc.elementos) {
    if (
      element.openingPhaseSlug !== undefined &&
      element.openingPhaseSlug !== null &&
      !phaseSlugs.has(element.openingPhaseSlug)
    ) {
      problemas.push(
        `El elemento «${element.slug}» referencia la fase inexistente «${element.openingPhaseSlug}».`,
      )
    }
  }
  if (new Set(doc.featureGates.map((gate) => gate.key)).size !== doc.featureGates.length) {
    problemas.push('Hay features repetidas.')
  }

  return {
    doc,
    resumen: {
      fases: doc.fases.length,
      featureGates: doc.featureGates.length,
      categorias: doc.categorias.length,
      elementos: doc.elementos.length,
      caminos: doc.caminos.length,
      secuencias: doc.secuencias.length,
      recetas: doc.recetas.length,
      avances: doc.avances.length,
      rituales: doc.rituales.length,
      logros: doc.logros.length,
      problemas,
    },
  }
}

// ---------- Importación (transaccional: o todo o nada) ----------

export async function importarContenido(
  db: PrismaClient,
  raw: unknown,
  modo: 'reemplazar' | 'fusionar',
): Promise<ResumenImportacion> {
  const { doc, resumen } = validarDocumento(raw)
  if (resumen.problemas.length > 0) {
    throw new ImportError(`El archivo tiene problemas: ${resumen.problemas.join(' · ')}`)
  }

  await db.$transaction(async (tx) => {
    if (modo === 'reemplazar') {
      const progressCounts = await Promise.all([
        tx.playerDiscovery.count(),
        tx.playerPathwayUnlock.count(),
        tx.playerAdvance.count(),
        tx.playerRitual.count(),
        tx.playerAchievement.count(),
        tx.playerCombinationStat.count(),
      ])
      if (progressCounts.some((count) => count > 0)) {
        throw new ImportError(
          'No se puede reemplazar el catálogo mientras exista progreso de jugadores. Usa fusión o una base nueva.',
        )
      }
      await tx.recipeIngredient.deleteMany({})
      await tx.recipe.deleteMany({})
      await tx.advance.deleteMany({})
      await tx.achievement.deleteMany({})
      await tx.sequence.deleteMany({})
      await tx.pathway.deleteMany({})
      await tx.elementCategory.deleteMany({})
      await tx.element.deleteMany({})
      await tx.progressionPhase.deleteMany({})
      await tx.category.deleteMany({})
    }

    for (const phase of doc.fases) {
      const phaseData = {
        name: phase.name,
        description: phase.description,
        sortOrder: phase.sortOrder,
        unlockAtDiscoveryCount: phase.unlockAtDiscoveryCount,
        advancementRuleJson: serializePhaseRule(phase.advancementRule),
        celebrationMessage: phase.celebrationMessage,
        isActive: phase.isActive,
      }
      await tx.progressionPhase.upsert({
        where: { slug: phase.slug },
        update: phaseData,
        create: { slug: phase.slug, ...phaseData },
      })
    }
    const phaseIdBySlug = new Map(
      (
        await tx.progressionPhase.findMany({ select: { id: true, slug: true } })
      ).map((phase) => [phase.slug, phase.id]),
    )

    for (const gate of doc.featureGates) {
      await tx.featureGate.upsert({
        where: { key: gate.key },
        update: { minimumPhaseSortOrder: gate.minimumPhaseSortOrder },
        create: gate,
      })
    }

    // Categorías: primero sin padre (dos pasadas para tolerar cualquier orden).
    for (const c of doc.categorias) {
      await tx.category.upsert({
        where: { slug: c.slug },
        update: {
          name: c.name,
          description: c.description ?? null,
          sortOrder: c.sortOrder,
          isHidden: c.isHidden,
          isActive: c.isActive,
        },
        create: {
          slug: c.slug,
          name: c.name,
          description: c.description ?? null,
          sortOrder: c.sortOrder,
          isHidden: c.isHidden,
          isActive: c.isActive,
        },
      })
    }
    for (const c of doc.categorias) {
      if (!c.parentSlug) continue
      const padre = await tx.category.findUnique({ where: { slug: c.parentSlug } })
      await tx.category.update({
        where: { slug: c.slug },
        data: { parentId: padre?.id ?? null },
      })
    }

    for (const e of doc.elementos) {
      const data = {
        name: e.name,
        description: e.description,
        iconKey: e.iconKey,
        imageUrl: e.imageUrl ?? null,
        type: e.type,
        tier: e.tier,
        isStarter: e.isStarter,
        isHiddenUntilDiscovered: e.isHiddenUntilDiscovered,
        isMajorDiscovery: e.isMajorDiscovery,
        revealTitle: e.revealTitle ?? null,
        revealText: e.revealText ?? null,
        unlockedByType: e.unlockedByType ?? null,
        unlockedBySequenceNumber: e.unlockedBySequenceNumber ?? null,
        unlockedAtDiscoveryCount: e.unlockedAtDiscoveryCount ?? null,
        ...(e.openingPhaseSlug !== undefined
          ? {
              availableFromPhaseId: e.openingPhaseSlug
                ? (phaseIdBySlug.get(e.openingPhaseSlug) ?? null)
                : null,
            }
          : {}),
        isActive: e.isActive,
      }
      const el = await tx.element.upsert({
        where: { slug: e.slug },
        update: data,
        create: { slug: e.slug, ...data },
      })
      await tx.elementCategory.deleteMany({ where: { elementId: el.id } })
      for (const ec of e.categorias) {
        const cat = await tx.category.findUnique({ where: { slug: ec.slug } })
        if (!cat) throw new ImportError(`Categoría no encontrada: ${ec.slug}`)
        await tx.elementCategory.create({
          data: { elementId: el.id, categoryId: cat.id, isPrimary: ec.isPrimary },
        })
      }
    }

    // Desencadenantes espontáneos: segunda pasada, cuando ya existen todos
    // los elementos (pueden referenciarse en cualquier orden).
    for (const e of doc.elementos) {
      const el = await tx.element.findUnique({ where: { slug: e.slug } })
      if (!el) continue
      await tx.elementUnlockTrigger.deleteMany({ where: { elementId: el.id } })
      for (const slug of new Set(e.unlockedByElements)) {
        if (slug === e.slug) continue
        const trigger = await tx.element.findUnique({ where: { slug } })
        if (!trigger) throw new ImportError(`Desencadenante no encontrado: ${slug}`)
        await tx.elementUnlockTrigger.create({
          data: { elementId: el.id, triggerId: trigger.id },
        })
      }
    }

    // Requisitos AND: sincronizar en una segunda pasada, cuando ya existen todos los elementos.
    for (const e of doc.elementos) {
      const el = await tx.element.findUnique({ where: { slug: e.slug } })
      if (!el) continue
      await tx.elementUnlockRequirement.deleteMany({ where: { elementId: el.id } })
      for (const slug of new Set(e.unlockedByAllElements)) {
        if (slug === e.slug) continue
        const required = await tx.element.findUnique({ where: { slug } })
        if (!required) throw new ImportError(`Requisito AND no encontrado: ${slug}`)
        await tx.elementUnlockRequirement.create({
          data: { elementId: el.id, requiredElementId: required.id },
        })
      }
    }

    for (const p of doc.caminos) {
      const cat = await tx.category.findUnique({ where: { slug: p.categorySlug } })
      if (!cat) throw new ImportError(`Categoría no encontrada: ${p.categorySlug}`)
      const data = {
        name: p.name,
        description: p.description,
        categoryId: cat.id,
        iconKey: p.iconKey ?? null,
        isHiddenUntilDiscovered: p.isHiddenUntilDiscovered,
        isActive: p.isActive,
      }
      await tx.pathway.upsert({
        where: { slug: p.slug },
        update: data,
        create: { slug: p.slug, ...data },
      })
    }

    for (const s of doc.secuencias) {
      const [camino, elemento] = await Promise.all([
        tx.pathway.findUnique({ where: { slug: s.pathwaySlug } }),
        tx.element.findUnique({ where: { slug: s.elementSlug } }),
      ])
      if (!camino || !elemento) throw new ImportError('Secuencia con referencias inválidas.')
      await tx.sequence.upsert({
        where: { elementId: elemento.id },
        update: {
          pathwayId: camino.id,
          number: s.number,
          name: s.name,
          description: s.description ?? null,
        },
        create: {
          pathwayId: camino.id,
          number: s.number,
          name: s.name,
          description: s.description ?? null,
          elementId: elemento.id,
        },
      })
    }

    for (const r of doc.recetas) {
      const outputs: { elementId: string; quantity: number; chance: number; sortOrder: number }[] = []
      for (const o of r.outputs) {
        const el = await tx.element.findUnique({ where: { slug: o.elementSlug } })
        if (!el) throw new ImportError(`Elemento resultado no encontrado: ${o.elementSlug}`)
        outputs.push({ elementId: el.id, quantity: o.quantity, chance: o.chance, sortOrder: o.sortOrder })
      }
      const inputKey = buildRecipeInputKey(
        r.ingredientes.map((i) => ({ slug: i.elementSlug, quantity: i.quantity })),
      )
      const existingAdvance = await tx.advance.findUnique({
        where: { inputKey },
        select: { targetSequence: { select: { element: { select: { slug: true } } } } },
      })
      if (
        existingAdvance &&
        !isIntentionalRecipeAdvanceDualOutcome({
          inputKey,
          recipeOutputSlugs: r.outputs.map((output) => output.elementSlug),
          advanceTargetSlug: existingAdvance.targetSequence.element.slug,
        })
      ) {
        throw new ImportError(`La combinación «${inputKey}» ya pertenece a un avance.`)
      }
      const ingredientes: { elementId: string; quantity: number }[] = []
      for (const i of r.ingredientes) {
        const el = await tx.element.findUnique({ where: { slug: i.elementSlug } })
        if (!el) throw new ImportError(`Ingrediente no encontrado: ${i.elementSlug}`)
        ingredientes.push({ elementId: el.id, quantity: i.quantity })
      }
      const data = {
        name: r.name ?? null,
        successText: r.successText ?? null,
        hintText: r.hintText ?? null,
        isActive: r.isActive,
        minimumDiscoveries: r.minimumDiscoveries,
      }
      const receta = await tx.recipe.upsert({
        where: { inputKey },
        update: data,
        create: { inputKey, ...data },
      })
      await tx.recipeIngredient.deleteMany({ where: { recipeId: receta.id } })
      await tx.recipeOutput.deleteMany({ where: { recipeId: receta.id } })
      for (const i of ingredientes) {
        await tx.recipeIngredient.create({ data: { recipeId: receta.id, ...i } })
      }
      for (const o of outputs) {
        await tx.recipeOutput.create({ data: { recipeId: receta.id, ...o } })
      }
    }

    for (const advance of doc.avances) {
      const pathway = await tx.pathway.findUnique({ where: { slug: advance.pathwaySlug } })
      if (!pathway) throw new ImportError(`Camino no encontrado: ${advance.pathwaySlug}`)
      const [sourceSequence, targetSequence] = await Promise.all([
        tx.sequence.findUnique({
          where: {
            pathwayId_number: {
              pathwayId: pathway.id,
              number: advance.sourceSequenceNumber,
            },
          },
          include: { element: { select: { slug: true } } },
        }),
        tx.sequence.findUnique({
          where: {
            pathwayId_number: {
              pathwayId: pathway.id,
              number: advance.targetSequenceNumber,
            },
          },
          include: { element: { select: { slug: true } } },
        }),
      ])
      if (!sourceSequence || !targetSequence) {
        throw new ImportError(`El avance «${advance.internalName}» tiene secuencias inválidas.`)
      }

      const ingredients: { elementId: string; quantity: number }[] = []
      for (const ingredient of advance.ingredientes) {
        const element = await tx.element.findUnique({ where: { slug: ingredient.elementSlug } })
        if (!element) throw new ImportError(`Ingrediente no encontrado: ${ingredient.elementSlug}`)
        ingredients.push({ elementId: element.id, quantity: ingredient.quantity })
      }
      const inputKey = buildRecipeInputKey(
        advance.ingredientes.map((ingredient) => ({
          slug: ingredient.elementSlug,
          quantity: ingredient.quantity,
        })),
      )
      const existingRecipe = await tx.recipe.findUnique({
        where: { inputKey },
        select: { outputs: { select: { element: { select: { slug: true } } } } },
      })
      if (
        existingRecipe &&
        !isIntentionalRecipeAdvanceDualOutcome({
          inputKey,
          recipeOutputSlugs: existingRecipe.outputs.map((output) => output.element.slug),
          advanceTargetSlug: targetSequence.element.slug,
        })
      ) {
        throw new ImportError(`La combinación «${inputKey}» ya pertenece a una receta.`)
      }
      const saved = await tx.advance.upsert({
        where: { inputKey },
        update: {
          internalName: advance.internalName,
          sourceSequenceId: sourceSequence.id,
          targetSequenceId: targetSequence.id,
          isActive: advance.isActive,
        },
        create: {
          internalName: advance.internalName,
          inputKey,
          sourceSequenceId: sourceSequence.id,
          targetSequenceId: targetSequence.id,
          isActive: advance.isActive,
        },
      })
      await tx.advanceIngredient.deleteMany({ where: { advanceId: saved.id } })
      await tx.advanceIngredient.createMany({
        data: ingredients.map((ingredient) => ({ advanceId: saved.id, ...ingredient })),
      })
    }

    for (const ritual of doc.rituales) {
      const advanceInputKey = buildRecipeInputKey(
        ritual.advanceIngredients.map((ingredient) => ({
          slug: ingredient.elementSlug,
          quantity: ingredient.quantity,
        })),
      )
      const advance = await tx.advance.findUnique({ where: { inputKey: advanceInputKey } })
      if (!advance) throw new ImportError(`Avance del ritual «${ritual.name}» no encontrado.`)
      const inputKey = buildRecipeInputKey(
        ritual.ingredientes.map((ingredient) => ({
          slug: ingredient.elementSlug,
          quantity: ingredient.quantity,
        })),
      )
      const ingredients: { elementId: string; quantity: number }[] = []
      for (const ingredient of ritual.ingredientes) {
        const element = await tx.element.findUnique({ where: { slug: ingredient.elementSlug } })
        if (!element) throw new ImportError(`Ingrediente de ritual no encontrado: ${ingredient.elementSlug}`)
        ingredients.push({ elementId: element.id, quantity: ingredient.quantity })
      }
      const failureOutputs: string[] = []
      for (const slug of ritual.failureOutputSlugs) {
        const element = await tx.element.findUnique({ where: { slug } })
        if (!element) throw new ImportError(`Consecuencia de ritual no encontrada: ${slug}`)
        failureOutputs.push(element.id)
      }
      const saved = await tx.ritual.upsert({
        where: { inputKey },
        update: {
          name: ritual.name,
          advanceId: advance.id,
          requiredSequenceNumber: ritual.requiredSequenceNumber,
          isActive: ritual.isActive,
        },
        create: {
          name: ritual.name,
          inputKey,
          advanceId: advance.id,
          requiredSequenceNumber: ritual.requiredSequenceNumber,
          isActive: ritual.isActive,
        },
      })
      await tx.ritualIngredient.deleteMany({ where: { ritualId: saved.id } })
      await tx.ritualFailureOutput.deleteMany({ where: { ritualId: saved.id } })
      await tx.ritualIngredient.createMany({
        data: ingredients.map((ingredient) => ({ ritualId: saved.id, ...ingredient })),
      })
      await tx.ritualFailureOutput.createMany({
        data: failureOutputs.map((elementId) => ({ ritualId: saved.id, elementId })),
      })
    }

    for (const achievement of doc.logros) {
      let triggerElementId: string | null = null
      let triggerSequenceId: string | null = null
      if (achievement.triggerType === 'ELEMENT') {
        const element = await tx.element.findUnique({
          where: { slug: achievement.triggerElementSlug },
        })
        if (!element) throw new ImportError(`Elemento de logro no encontrado: ${achievement.triggerElementSlug}`)
        triggerElementId = element.id
      } else {
        const pathway = await tx.pathway.findUnique({
          where: { slug: achievement.triggerPathwaySlug },
        })
        if (!pathway) throw new ImportError(`Camino de logro no encontrado: ${achievement.triggerPathwaySlug}`)
        const sequence = await tx.sequence.findUnique({
          where: {
            pathwayId_number: {
              pathwayId: pathway.id,
              number: achievement.triggerSequenceNumber,
            },
          },
        })
        if (!sequence) throw new ImportError(`Secuencia del logro «${achievement.slug}» no encontrada.`)
        triggerSequenceId = sequence.id
      }
      const data = {
        name: achievement.name,
        description: achievement.description,
        iconKey: achievement.iconKey,
        triggerElementId,
        triggerSequenceId,
        isHiddenUntilUnlocked: achievement.isHiddenUntilUnlocked,
        isActive: achievement.isActive,
      }
      await tx.achievement.upsert({
        where: { slug: achievement.slug },
        update: data,
        create: { slug: achievement.slug, ...data },
      })
    }
    await sincronizarStartersConPrimeraFase(tx)
    const profiles = await tx.playerProfile.findMany({ select: { id: true } })
    for (const profile of profiles) await descubrirIniciales(tx, profile.id)
  })

  return resumen
}
