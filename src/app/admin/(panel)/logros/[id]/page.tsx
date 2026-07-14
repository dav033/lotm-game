import { notFound } from 'next/navigation'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import FormularioLogro from '@/components/admin/FormularioLogro'

export const runtime = 'nodejs'

export default async function PaginaEditarLogro({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdminPagina()
  const { id } = await params
  const [achievement, elements, sequences] = await Promise.all([
    prisma.achievement.findUnique({ where: { id } }),
    prisma.element.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
    }),
    prisma.sequence.findMany({
      include: { pathway: { select: { name: true } } },
      orderBy: [{ pathwayId: 'asc' }, { number: 'desc' }],
    }),
  ])
  if (!achievement) notFound()
  const triggerType = achievement.triggerSequenceId ? 'SEQUENCE' : 'ELEMENT'

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-parchment">Editar logro</h1>
      <FormularioLogro
        logro={{
          id: achievement.id,
          slug: achievement.slug,
          name: achievement.name,
          description: achievement.description,
          iconKey: achievement.iconKey,
          triggerType,
          triggerId: achievement.triggerSequenceId ?? achievement.triggerElementId ?? '',
          isHiddenUntilUnlocked: achievement.isHiddenUntilUnlocked,
          isActive: achievement.isActive,
        }}
        elementos={elements}
        secuencias={sequences}
      />
    </div>
  )
}
