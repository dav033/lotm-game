import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PrismaClient } from '@/generated/prisma/client'
import { resolverFacultades } from './habilidades'

function dbConDescubrimientos(slugs: string[]) {
  return {
    playerDiscovery: {
      // El filtro `element: { isActive: true, slug: { in } }` vive en la
      // consulta real; aquí el mock ya representa el resultado tras ese
      // filtro, así que un slug "inactivo" nunca aparece en la lista.
      findMany: async () => slugs.map((slug) => ({ element: { slug } })),
    },
  } as unknown as PrismaClient
}

describe('resolverFacultades', () => {
  it('un elemento Aprendiz activo y descubierto desbloquea la facultad', async () => {
    const facultades = await resolverFacultades(dbConDescubrimientos(['aprendiz']), 'profile')
    assert.equal(facultades.apprenticeMemory.unlocked, true)
  })

  it('un Aprendiz inactivo (excluido por la consulta) no desbloquea la facultad', async () => {
    // La consulta real filtra element.isActive=true; un Aprendiz inactivo
    // simplemente no llega en la lista de descubrimientos relevantes.
    const facultades = await resolverFacultades(dbConDescubrimientos([]), 'profile')
    assert.equal(facultades.apprenticeMemory.unlocked, false)
  })
})
