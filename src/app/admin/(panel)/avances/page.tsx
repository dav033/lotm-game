import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { TablaAvances, type AvanceVista } from '@/components/admin/TablaAvances'

export const runtime = 'nodejs'

export default async function PaginaAvancesAdmin() {
  await exigirAdminPagina()
  const advances = await prisma.advance.findMany({
    include: {
      ingredients: { include: { element: true }, orderBy: { id: 'asc' } },
      sourceSequence: { include: { pathway: true } },
      targetSequence: { include: { pathway: true } },
      _count: { select: { players: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const vista: AvanceVista[] = advances.map((advance) => ({
    id: advance.id,
    internalName: advance.internalName,
    isActive: advance.isActive,
    camino: advance.sourceSequence.pathway.name,
    ingredientes: advance.ingredients.map((i) => ({
      id: i.element.id,
      name: i.element.name,
      quantity: i.quantity,
    })),
    origen: { numero: advance.sourceSequence.number, nombre: advance.sourceSequence.name },
    destino: { numero: advance.targetSequence.number, nombre: advance.targetSequence.name },
    enPosesion: advance._count.players,
  }))

  const caminos = [...new Set(vista.map((a) => a.camino))].sort((a, b) => a.localeCompare(b, 'es'))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-parchment">Avances</h1>
          <p className="mt-1 text-sm text-fog">El nombre y el destino reales nunca se muestran al jugador.</p>
        </div>
        <Link href="/admin/avances/nuevo" className="btn-brass ml-auto">Nuevo avance</Link>
      </div>

      <TablaAvances avances={vista} caminos={caminos} />
    </div>
  )
}
