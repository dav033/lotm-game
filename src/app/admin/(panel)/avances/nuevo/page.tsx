import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import FormularioAvance from '@/components/admin/FormularioAvance'

export const runtime = 'nodejs'

export default async function PaginaNuevoAvance() {
  await exigirAdminPagina()
  const [elementos, secuencias] = await Promise.all([
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

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Nuevo avance
      </h1>
      <FormularioAvance avance={null} elementos={elementos} secuencias={secuencias} />
    </div>
  )
}
