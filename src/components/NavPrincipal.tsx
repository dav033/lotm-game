'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookMarked, KeyRound, Layers, Trophy, WandSparkles } from 'lucide-react'

const ENLACES = [
  { href: '/', label: 'Juego', icon: WandSparkles, exact: true },
  { href: '/coleccion', label: 'Colección', icon: BookMarked, exact: false },
  { href: '/logros', label: 'Logros', icon: Trophy, exact: false },
  { href: '/cartas', label: 'Cartas', icon: Layers, exact: false },
  { href: '/admin', label: 'Archivista', icon: KeyRound, exact: false },
]

// Barra de navegación global: presente en todas las páginas para saltar entre
// el juego, la colección, el generador de cartas y el panel de administración.
export default function NavPrincipal() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegación principal"
      className="border-b border-line bg-ink"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-2">
        <Link
          href="/"
          className="mr-2 shrink-0 font-[family-name:var(--font-display)] text-sm font-bold tracking-wide text-brass hover:brightness-110"
        >
          ✦ Archivo de Misterios
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {ENLACES.map(({ href, label, icon: Icon, exact }) => {
            const activo = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={activo ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition active:scale-[0.97] ${
                  activo
                    ? 'bg-panel2 text-brass'
                    : 'text-fog hover:bg-panel hover:text-parchment'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
