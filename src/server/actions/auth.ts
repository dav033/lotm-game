'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  cerrarSesionAdmin,
  esPasswordAdminCorrecta,
  iniciarSesionAdmin,
} from '../adminAuth'

const loginSchema = z.object({ password: z.string().min(1).max(200) })

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({ password: formData.get('password') })
  // La contraseña solo se compara aquí, en el servidor, en tiempo constante.
  if (!parsed.success || !esPasswordAdminCorrecta(parsed.data.password)) {
    redirect('/admin/login?error=1')
  }
  await iniciarSesionAdmin()
  redirect('/admin')
}

export async function logoutAction() {
  await cerrarSesionAdmin()
  redirect('/admin/login')
}
