import Juego from '@/components/game/Juego'
import { haySesionAdmin } from '@/server/adminAuth'

export const runtime = 'nodejs'

// El juego es interactivo de punta a punta: el estado real vive en el
// servidor (perfil por cookie + SQLite) y se consulta vía /api/estado. Si hay
// sesión de admin activa, se habilita el panel de recetas pendientes.
export default async function PaginaJuego() {
  const esAdmin = await haySesionAdmin()
  return <Juego esAdmin={esAdmin} />
}
