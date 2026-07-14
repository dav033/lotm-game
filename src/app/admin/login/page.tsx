import Link from 'next/link'
import { redirect } from 'next/navigation'
import { haySesionAdmin } from '@/server/adminAuth'
import { loginAction } from '@/server/actions/auth'

export const runtime = 'nodejs'

export default async function PaginaLoginAdmin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (await haySesionAdmin()) redirect('/admin')
  const { error } = await searchParams

  return (
    <div className="mist-bg flex min-h-screen items-center justify-center p-4">
      <div className="mist-card brass-ring w-full max-w-sm rounded-xl p-8">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-brass">
          ✦ Acceso del archivista
        </h1>
        <p className="mt-1 text-sm text-fog">
          Panel de administración del Archivo de Misterios.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-md border border-wine bg-wine/20 px-3 py-2 text-sm">
            La contraseña no abre esta puerta.
          </p>
        )}

        <form action={loginAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="etiqueta">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="campo"
            />
          </div>
          <button type="submit" className="btn-brass w-full">Entrar</button>
        </form>

        <Link href="/" className="mt-4 block text-center text-sm text-fog hover:text-brass">
          Volver al juego
        </Link>
      </div>
    </div>
  )
}
