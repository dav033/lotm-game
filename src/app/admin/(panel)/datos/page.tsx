import { exigirAdminPagina } from '@/server/adminAuth'
import ImportadorDatos from '@/components/admin/ImportadorDatos'

export const runtime = 'nodejs'

export default async function PaginaDatosAdmin() {
  await exigirAdminPagina()

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Importar y exportar contenido
      </h1>
      <p className="mb-6 text-sm text-fog">
        El JSON incluye categorías, elementos, caminos, secuencias y recetas.
        Las claves internas (inputKey) se recalculan siempre al importar; las
        del archivo se ignoran. La importación se ejecuta en una transacción:
        si algo falla, no queda nada a medias.
      </p>

      <section className="mb-8 rounded-lg mist-card p-4">
        <h2 className="etiqueta">Exportar</h2>
        <p className="mb-3 text-sm text-fog">
          Descarga una copia completa del contenido del juego (sin progreso de
          jugadores). Útil como copia de seguridad o para migrar de entorno.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="/api/admin/exportar" className="btn-brass inline-block" download>
            Descargar backup completo
          </a>
          <a href="/api/admin/exportar-elementos" className="btn-ghost inline-block" download>
            Exportar nombres y combinaciones
          </a>
        </div>
      </section>

      <section className="rounded-lg mist-card p-4">
        <h2 className="etiqueta">Importar</h2>
        <ImportadorDatos />
      </section>
    </div>
  )
}
