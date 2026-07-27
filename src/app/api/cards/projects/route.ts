import { NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { cardsRepository } from '@/server/cardsDb'
import { badRequest } from '@/server/apiError'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CreateProjectSchema = z.object({ name: z.string().trim().min(1).max(120) }).strict()

export async function GET() {
  return NextResponse.json(
    { projects: cardsRepository.listProjects() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: Request) {
  try {
    const { name } = CreateProjectSchema.parse(await request.json())
    return NextResponse.json({ project: cardsRepository.createProject(name) }, { status: 201 })
  } catch (error) {
    return badRequest(error, 'No se pudo crear el proyecto.')
  }
}
