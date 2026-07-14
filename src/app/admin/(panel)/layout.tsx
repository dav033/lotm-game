import Link from 'next/link'
import { exigirAdminPagina } from '@/server/adminAuth'
import { logoutAction } from '@/server/actions/auth'

const SECCIONES = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/elementos', label: 'Elementos' },
  { href: '/admin/recetas', label: 'Recetas' },
  { href: '/admin/avances', label: 'Avances' },
  { href: '/admin/logros', label: 'Logros' },
  { href: '/admin/rituales', label: 'Rituales' },
  { href: '/admin/categorias', label: 'Categorías' },
  { href: '/admin/caminos', label: 'Caminos' },
  { href: '/admin/combinaciones-fallidas', label: 'Combinaciones fallidas' },
  { href: '/admin/diagnostico', label: 'Diagnóstico' },
  { href: '/admin/datos', label: 'Importar / Exportar' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Guard de servidor para todo el panel; cada Server Action revalida además
  // la sesión por su cuenta.
  await exigirAdminPagina()

  return (
    <div className="mist-bg min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-[family-name:var(--font-display)] font-bold text-brass">
            Administración del archivo
          </span>
          <form action={logoutAction} className="ml-auto">
            <button type="submit" className="btn-ghost text-sm">Cerrar sesión</button>
          </form>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
        <nav aria-label="Secciones de administración" className="md:w-56 md:shrink-0">
          <ul className="flex flex-wrap gap-1 md:flex-col">
            {SECCIONES.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="block rounded-md px-3 py-2 text-sm text-fog hover:bg-panel hover:text-parchment"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
