import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import {
  detectarCiclos,
  elementosInalcanzables,
  elementosSinUso,
  recetasDuplicadas,
} from '@/server/domain/diagnostico'

export const runtime = 'nodejs'

export default async function PaginaDiagnostico() {
  await exigirAdminPagina()

  const [elementos, recetas, secuencias, desencadenantes] = await Promise.all([
    prisma.element.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        isStarter: true,
        isActive: true,
        unlockedByType: true,
      },
    }),
    prisma.recipe.findMany({
      include: {
        ingredients: { include: { element: { select: { name: true, isActive: true } } } },
        outputs: { include: { element: { include: { sequence: { include: { pathway: true } } } } } },
      },
    }),
    prisma.sequence.findMany({ select: { elementId: true } }),
    prisma.elementUnlockTrigger.findMany({ select: { elementId: true, triggerId: true } }),
  ])

  const recetasDiag = recetas.map((r) => ({
    id: r.id,
    inputKey: r.inputKey,
    isActive: r.isActive,
    outputElementIds: r.outputs.map((o) => o.elementId),
    ingredients: r.ingredients.map((i) => ({ elementId: i.elementId, quantity: i.quantity })),
  }))

  const nombreDe = new Map(elementos.map((e) => [e.id, e.name]))

  const inalcanzables = elementosInalcanzables(elementos, recetasDiag, desencadenantes)
  const duplicadas = recetasDuplicadas(recetasDiag)
  const ciclos = detectarCiclos(recetasDiag)
  const sinUso = elementosSinUso(
    elementos,
    recetasDiag,
    new Set(secuencias.map((s) => s.elementId)),
    desencadenantes,
  )

  const referenciasInactivas = recetas.filter(
    (r) =>
      r.isActive &&
      (r.outputs.some((o) => !o.element.isActive) ||
        r.ingredients.some((i) => !i.element.isActive) ||
        r.outputs.some((o) => o.element.sequence && !o.element.sequence.pathway.isActive)),
  )

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
      <h2 className={`font-[family-name:var(--font-display)] text-lg ${vacio ? 'text-parchment' : alerta ? 'text-wine' : 'text-brass'}`}>
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
            Elementos activos que ningún encadenamiento de recetas activas puede
            producir desde los elementos iniciales:
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
            No son iniciales, ninguna receta los produce ni los usa, y no
            representan una secuencia:
          </p>
          <ul className="list-inside list-disc space-y-1 text-parchment">
            {sinUso.map((e) => (
              <li key={e.id}>
                {e.name} <code className="text-xs text-fog">({e.slug})</code>
              </li>
            ))}
          </ul>
        </Seccion>
      </div>
    </div>
  )
}
