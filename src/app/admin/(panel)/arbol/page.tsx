import { exigirAdminPagina } from '@/server/adminAuth'
import { datosIniciales } from '@/server/services/arbolGrafo'
import { ArbolPestanas } from '@/components/admin/arbol/ArbolPestanas'

export const runtime = 'nodejs'

// Árbol de habilidades en tres vistas: explorador expandible (por defecto),
// espina por camino y mapa completo. La página solo embebe los elementos
// iniciales; el resto llega bajo demanda desde /api/admin/arbol, así el peso
// no crece con el contenido del juego.
export default async function PaginaArbolAdmin() {
  await exigirAdminPagina()

  const { nodos, caminos, totales } = await datosIniciales()

  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Árbol de habilidades
      </h1>
      <p className="mb-4 text-sm text-fog">
        {totales.nodos} habilidades y {totales.aristas} conexiones. Explora expandiendo desde los
        elementos iniciales, revisa cada camino como espina o abre el mapa completo.
      </p>
      <ArbolPestanas inicial={nodos} caminos={caminos} totales={totales} />
    </div>
  )
}
