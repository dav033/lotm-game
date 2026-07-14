import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { eliminarRitual } from '@/server/actions/rituales'
import FormularioRitual from '@/components/admin/FormularioRitual'
import { BotonEliminar } from '@/components/admin/BotonEliminar'

export const runtime = 'nodejs'

export default async function PaginaRitualesAdmin({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  await exigirAdminPagina()
  const { editar } = await searchParams
  const [rituals, elements, advances] = await Promise.all([
    prisma.ritual.findMany({
      include: { ingredients: { include: { element: true } }, advance: true, failureOutputs: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.element.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.advance.findMany({ orderBy: { internalName: 'asc' }, select: { id: true, internalName: true } }),
  ])
  const editing = rituals.find((ritual) => ritual.id === editar) ?? null
  const ingredientIds = editing?.ingredients.flatMap((ingredient) => Array.from({ length: ingredient.quantity }, () => ingredient.elementId)) ?? []

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-parchment">Rituales</h1>
      <FormularioRitual
        ritual={editing ? {
          id: editing.id,
          name: editing.name,
          ingredientAId: ingredientIds[0] ?? '',
          ingredientBId: ingredientIds[1] ?? '',
          advanceId: editing.advanceId,
          requiredSequenceNumber: editing.requiredSequenceNumber,
          failureOutputIds: editing.failureOutputs.map((output) => output.elementId),
          isActive: editing.isActive,
        } : null}
        elementos={elements}
        avances={advances}
      />
      <div className="mt-6 space-y-3">
        {rituals.map((ritual) => (
          <article key={ritual.id} className="rounded-lg mist-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-brass">{ritual.name}</h2>
              <span className="text-xs text-fog">{ritual.ingredients.map((ingredient) => `${ingredient.element.name} × ${ingredient.quantity}`).join(' + ')}</span>
              <Link href={`/admin/rituales?editar=${ritual.id}`} className="ml-auto text-brass underline">Editar</Link>
              <BotonEliminar action={eliminarRitual.bind(null, ritual.id)} confirmacion="¿Eliminar este ritual?" className="text-wine underline">Eliminar</BotonEliminar>
            </div>
            <p className="mt-1 text-xs text-fog">Protege: {ritual.advance.internalName}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
