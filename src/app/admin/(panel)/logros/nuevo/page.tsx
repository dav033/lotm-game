import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import FormularioLogro from '@/components/admin/FormularioLogro'

export const runtime = 'nodejs'

export default async function PaginaNuevoLogro() {
  await exigirAdminPagina()
  const [elements, sequences] = await Promise.all([
    prisma.element.findMany({
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
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-parchment">Nuevo logro</h1>
      <FormularioLogro logro={null} elementos={elements} secuencias={sequences} />
    </div>
  )
}
