import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import {
  analizarProgresion,
  detectarCiclos,
  DIFICULTAD_LABELS,
  DIFICULTAD_ORDEN,
  elementosInalcanzables,
  elementosSinUso,
  recetasDuplicadas,
  resumenParticipacion,
  type DiagAdvance,
  type DiagElement,
  type DiagRecipe,
  type DiagRitual,
  type DiagSequence,
  type DiagElementResult,
} from '@/server/domain/diagnostico'

export const runtime = 'nodejs'

export default async function PaginaDiagnostico() {
  await exigirAdminPagina()

  const [elementos, recetas, secuencias, desencadenantes, avances, rituales] = await Promise.all([
    prisma.element.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        isStarter: true,
        isActive: true,
        unlockedByType: true,
        unlockedBySequenceNumber: true,
        unlockRequirements: { select: { requiredElementId: true } },
      },
    }),
    prisma.recipe.findMany({
      include: {
        ingredients: { include: { element: { select: { name: true, isActive: true } } } },
        outputs: {
          include: {
            element: {
              include: {
                sequence: {
                  include: {
                    pathway: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.sequence.findMany({
      include: {
        pathway: { select: { isActive: true } },
        element: { select: { id: true } },
      },
    }),
    prisma.elementUnlockTrigger.findMany({ select: { elementId: true, triggerId: true } }),
    prisma.advance.findMany({
      include: {
        ingredients: { include: { element: { select: { id: true } } } },
        sourceSequence: {
          include: {
            element: { select: { id: true } },
            pathway: { select: { isActive: true } },
          },
        },
        targetSequence: {
          include: {
            element: { select: { id: true } },
            pathway: { select: { isActive: true } },
          },
        },
      },
    }),
    prisma.ritual.findMany({
      include: {
        advance: { select: { id: true } },
        ingredients: { include: { element: { select: { id: true } } } },
        failureOutputs: { include: { element: { select: { id: true } } } },
      },
      orderBy: { id: 'asc' },
    }),
  ])

  const elementosDiag: DiagElement[] = elementos.map((e) => ({
    id: e.id,
    slug: e.slug,
    name: e.name,
    type: e.type,
    isStarter: e.isStarter,
    isActive: e.isActive,
    unlockedByType: e.unlockedByType,
    unlockedBySequenceNumber: e.unlockedBySequenceNumber,
    requiredElementIds: e.unlockRequirements.map((r) => r.requiredElementId),
  }))

  const recetasDiag: DiagRecipe[] = recetas.map((r) => ({
    id: r.id,
    inputKey: r.inputKey,
    isActive: r.isActive,
    outputElementIds: r.outputs.map((o) => o.elementId),
    ingredients: r.ingredients.map((i) => ({ elementId: i.elementId, quantity: i.quantity })),
  }))

  const secuenciasDiag: DiagSequence[] = secuencias.map((s) => ({
    id: s.id,
    elementId: s.elementId,
    pathwayId: s.pathwayId,
    number: s.number,
    name: s.name,
    isActive: s.pathway.isActive,
  }))

  const ritualesPorAvance = new Map<string, typeof rituales>()
  for (const r of rituales) {
    const lista = ritualesPorAvance.get(r.advance.id) ?? []
    lista.push(r)
    ritualesPorAvance.set(r.advance.id, lista)
  }

  const avancesDiag: DiagAdvance[] = avances.map((a) => ({
    id: a.id,
    internalName: a.internalName,
    inputKey: a.inputKey,
    isActive: a.isActive,
    sourceSequenceId: a.sourceSequenceId,
    targetSequenceId: a.targetSequenceId,
    ingredients: a.ingredients.map((i) => ({ elementId: i.elementId, quantity: i.quantity })),
    rituals: (ritualesPorAvance.get(a.id) ?? []).map((r) => ({
      id: r.id,
      advanceId: a.id,
      name: r.name,
      inputKey: r.inputKey,
      isActive: r.isActive,
      requiredSequenceNumber: r.requiredSequenceNumber,
      ingredients: r.ingredients.map((i) => ({ elementId: i.elementId, quantity: i.quantity })),
      failureOutputIds: r.failureOutputs.map((o) => o.elementId),
    })),
  }))

  const ritualesDiag: DiagRitual[] = avancesDiag.flatMap((a) => a.rituals)

  const analisis = analizarProgresion(
    elementosDiag,
    recetasDiag,
    secuenciasDiag,
    avancesDiag,
    desencadenantes,
  )

  const nombreDe = new Map(elementos.map((e) => [e.id, e.name]))

  const inalcanzables = elementosInalcanzables(
    elementosDiag,
    recetasDiag,
    secuenciasDiag,
    avancesDiag,
    desencadenantes,
  )
  const duplicadas = recetasDuplicadas(recetasDiag)
  const ciclos = detectarCiclos(recetasDiag)
  const sinUso = elementosSinUso(
    elementosDiag,
    recetasDiag,
    secuenciasDiag,
    avancesDiag,
    ritualesDiag,
    desencadenantes,
  )

  const referenciasInactivas = recetas.filter(
    (r) =>
      r.isActive &&
      (r.outputs.some((o) => !o.element.isActive) ||
        r.ingredients.some((i) => !i.element.isActive) ||
        r.outputs.some((o) => o.element.sequence && !o.element.sequence.pathway.isActive)),
  )

  const filas = elementos
    .filter((e) => e.isActive)
    .map((e) => ({ elemento: e, res: analisis.get(e.id)! }))
    .sort(compararFilas)

  const Seccion = ({
    titulo,
    vacio,
    children,
    alerta,
  }: {
    titulo: string
    vacio: boolean
    children: React.ReactNode
    alerta?: boolean
  }) => (
    <section className="rounded-lg mist-card p-4">
      <h2
        className={`font-[family-name:var(--font-display)] text-lg ${
          vacio ? 'text-parchment' : alerta ? 'text-wine' : 'text-brass'
        }`}
      >
        {titulo} {vacio ? '· sin hallazgos ✓' : ''}
      </h2>
      {!vacio && <div className="mt-2 text-sm">{children}</div>}
    </section>
  )

  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Diagnóstico del árbol de combinaciones
      </h1>
      <p className="mb-4 text-sm text-fog">
        Revisiones automáticas para detectar contenido roto o huérfano antes de
        que un jugador lo encuentre.
      </p>

      <div className="space-y-4">
        <Seccion titulo="Elementos inalcanzables" vacio={inalcanzables.length === 0} alerta>
          <p className="mb-2 text-fog">
            Elementos activos que no se pueden obtener desde los iniciales
            usando recetas, ascensiones, rituales o desbloqueos espontáneos:
          </p>
          <ul className="list-inside list-disc space-y-1 text-parchment">
            {inalcanzables.map((e) => (
              <li key={e.id}>
                {e.name} <code className="text-xs text-fog">({e.slug})</code>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Recetas duplicadas" vacio={duplicadas.size === 0} alerta>
          <ul className="list-inside list-disc space-y-1 text-parchment">
            {[...duplicadas.entries()].map(([key, lista]) => (
              <li key={key}>
                <code className="text-xs">{key}</code> — {lista.length} recetas comparten esta clave.
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Recetas con referencias inactivas" vacio={referenciasInactivas.length === 0} alerta>
          <ul className="list-inside list-disc space-y-1 text-parchment">
            {referenciasInactivas.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/recetas/${r.id}`} className="text-brass underline">
                  <code className="text-xs">{r.inputKey}</code>
                </Link>{' '}
                — {r.outputs.some((o) => !o.element.isActive) && 'produce un elemento desactivado. '}
                {r.ingredients.some((i) => !i.element.isActive) && 'usa ingredientes desactivados. '}
                {r.outputs.some((o) => o.element.sequence && !o.element.sequence.pathway.isActive) &&
                  'vinculada a un camino desactivado.'}
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Ciclos (advertencia, pueden ser intencionales)" vacio={ciclos.length === 0}>
          <ul className="list-inside list-disc space-y-1 text-parchment">
            {ciclos.map((ciclo, i) => (
              <li key={i}>{ciclo.map((id) => nombreDe.get(id) ?? id).join(' → ')}</li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Elementos sin uso" vacio={sinUso.length === 0}>
          <p className="mb-2 text-fog">
            No son iniciales, no aparecen en recetas, avances, rituales,
            desbloqueos ni representan una secuencia:
          </p>
          <ul className="list-inside list-disc space-y-1 text-parchment">
            {sinUso.map((e) => (
              <li key={e.id}>
                {e.name} <code className="text-xs text-fog">({e.slug})</code>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Progresión completa" vacio={filas.length === 0}>
          <p className="mb-4 text-fog">
            Métricas estimadas del árbol activo. La <strong>profundidad</strong> es
            el número de pasos de la ruta más corta; las{' '}
            <strong>combinaciones</strong> son una estimación mínima de operaciones
            de combinación (receta +1, crear avance +1, aplicarlo +1; ritual +0).
            Las <strong>rutas</strong> cuentan recetas o avances/rituales válidos.
            La <strong>participación</strong> resume en cuántas recetas (R),
            avances (A), rituales (Ri) y desbloqueos (D) interviene cada elemento.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-fog/30 text-fog">
                  <th className="pb-2 pr-4">Elemento</th>
                  <th className="pb-2 pr-4">Vía</th>
                  <th className="pb-2 pr-4">Profundidad</th>
                  <th className="pb-2 pr-4">Combinaciones</th>
                  <th className="pb-2 pr-4">Rutas</th>
                  <th className="pb-2 pr-4">Participación</th>
                  <th className="pb-2">Dificultad</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ elemento, res }) => (
                  <tr
                    key={elemento.id}
                    className={`border-b border-fog/10 ${
                      !res.reachable ? 'opacity-70' : ''
                    }`}
                  >
                    <td className="py-2 pr-4 text-parchment">
                      {elemento.name}{' '}
                      <code className="text-xs text-fog">({elemento.slug})</code>
                    </td>
                    <td className="py-2 pr-4 text-parchment">
                      {etiquetaRuta(res.bestRoute)}
                    </td>
                    <td className="py-2 pr-4 text-fog">
                      {res.depth == null ? '—' : res.depth}
                    </td>
                    <td className="py-2 pr-4 text-fog">
                      {res.cost == null ? '—' : res.cost}
                    </td>
                    <td className="py-2 pr-4 text-fog">{res.routeSummary}</td>
                    <td className="py-2 pr-4 text-fog">
                      <span title={tooltipParticipacion(res.participation)}>
                        {resumenParticipacion(res.participation)}
                      </span>
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${colorDificultad(
                          res.difficulty,
                        )}`}
                      >
                        {DIFICULTAD_LABELS[res.difficulty]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      </div>
    </div>
  )
}

function compararFilas(
  a: { elemento: { name: string }; res: DiagElementResult },
  b: { elemento: { name: string }; res: DiagElementResult },
): number {
  if (a.res.reachable !== b.res.reachable) return a.res.reachable ? 1 : -1
  const ordenA = DIFICULTAD_ORDEN[a.res.difficulty]
  const ordenB = DIFICULTAD_ORDEN[b.res.difficulty]
  if (ordenA !== ordenB) return ordenB - ordenA
  const costoA = a.res.cost ?? -1
  const costoB = b.res.cost ?? -1
  if (costoA !== costoB) return costoB - costoA
  return a.elemento.name.localeCompare(b.elemento.name, 'es')
}

function etiquetaRuta(ruta: DiagElementResult['bestRoute']): string {
  if (ruta.kind === 'unreachable') return 'Sin ruta válida'
  if (ruta.kind === 'starter') return 'Inicial'
  if (ruta.kind === 'spontaneous') return ruta.label
  if (ruta.kind === 'recipe') return `Receta ${ruta.detail}`
  if (ruta.kind === 'advance') return `Ascensión ${ruta.detail}`
  return `Fallo ${ruta.detail}`
}

function tooltipParticipacion(p: DiagElementResult['participation']): string {
  return `Recetas: ${p.recipes}, Avances: ${p.advances}, Rituales: ${p.rituals}, Desbloqueos: ${p.spontaneous}`
}

function colorDificultad(d: DiagElementResult['difficulty']): string {
  switch (d) {
    case 'impossible':
      return 'bg-wine/20 text-wine'
    case 'extreme':
      return 'bg-red-900/30 text-red-200'
    case 'hard':
      return 'bg-orange-900/30 text-orange-200'
    case 'moderate':
      return 'bg-yellow-900/30 text-yellow-200'
    case 'easy':
      return 'bg-green-900/30 text-green-200'
    case 'trivial':
      return 'bg-brass/20 text-brass'
  }
}
