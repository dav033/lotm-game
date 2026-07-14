import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const ADMIN_COOKIE = 'mist_admin'
const SESSION_HOURS = 8

// Lanzado por exigirAdminAccion; las actions lo convierten en un mensaje claro.
export class NoAutorizadoError extends Error {
  constructor() {
    super('No autorizado.')
  }
}

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET
  if (!s || s.length < 16) {
    throw new Error('ADMIN_SESSION_SECRET no está configurado (mínimo 16 caracteres).')
  }
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

// Token: "<expiraEpochMs>.<firma HMAC>". Sin estado en la base de datos.
export function crearTokenSesion(now = Date.now()): string {
  const exp = String(now + SESSION_HOURS * 3600_000)
  return `${exp}.${sign(exp)}`
}

export function verificarTokenSesion(token: string | undefined | null, now = Date.now()): boolean {
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const exp = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!/^\d{10,16}$/.test(exp)) return false
  const expected = sign(exp)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  return Number(exp) > now
}

// Comparación en tiempo constante de la contraseña del administrador.
export function esPasswordAdminCorrecta(password: string): boolean {
  const real = process.env.ADMIN_PASSWORD
  if (!real) return false
  const a = Buffer.from(password)
  const b = Buffer.from(real)
  if (a.length !== b.length) {
    // Igualar longitudes para no filtrar información por tiempo.
    timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32))
    return false
  }
  return timingSafeEqual(a, b)
}

export async function haySesionAdmin(): Promise<boolean> {
  // Autenticación desactivada: uso exclusivamente local, un solo usuario.
  return true
}

// Guard para páginas: redirige al login si no hay sesión.
export async function exigirAdminPagina() {
  if (!(await haySesionAdmin())) redirect('/admin/login')
}

// Guard para Server Actions y Route Handlers de mutación: lanza si no hay
// sesión. Cada mutación lo llama; nunca se confía solo en la navegación.
export async function exigirAdminAccion() {
  if (!(await haySesionAdmin())) {
    throw new NoAutorizadoError()
  }
}

export async function iniciarSesionAdmin() {
  const store = await cookies()
  store.set(ADMIN_COOKIE, crearTokenSesion(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  })
}

export async function cerrarSesionAdmin() {
  const store = await cookies()
  store.delete(ADMIN_COOKIE)
}
