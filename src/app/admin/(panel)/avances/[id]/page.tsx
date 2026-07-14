import { notFound } from 'next/navigation'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import FormularioAvance from '@/components/admin/FormularioAvance'

export const runtime = 'nodejs'

export default async function PaginaEditarAvance({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdminPagina()
  const { id } = await params
  const [advance, elementos, secuencias] = await Promise.all([
    prisma.advance.findUnique({ where: { id }, include: { ingredients: true } }),
    prisma.element.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
    }),
    prisma.sequence.findMany({
      include: { pathway: { select: { name: true } } },
      orderBy: [{ pathwayId: 'asc' }, { number: 'desc' }],
    }),
  ])
  if (!advance) notFound()

  const ingredientIds = advance.ingredients.flatMap((ingredient) =>
    Array.from({ length: ingredient.quantity }, () => ingredient.elementId),
  )

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Editar avance
      </h1>
      <FormularioAvance
        avance={{
          id: advance.id,
          internalName: advance.internalName,
          ingredientAId: ingredientIds[0] ?? '',
          ingredientBId: ingredientIds[1] ?? '',
          sourceSequenceId: advance.sourceSequenceId,
          targetSequenceId: advance.targetSequenceId,
          isActive: advance.isActive,
        }}
        elementos={elementos}
        secuencias={secuencias}
      />
    </div>
  )
}
