import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 600

export async function GET(request: Request) {
  const source = new URL(request.url)
  const base = process.env.CARDS_MCP_INTERNAL_URL
    || (process.env.NODE_ENV === 'production' ? 'http://cards-mcp:3101' : 'http://127.0.0.1:3101')
  const target = new URL('/export', base)
  target.search = source.search

  try {
    const upstream = await fetch(target, { cache: 'no-store' })
    if (!upstream.ok) {
      const body = await upstream.json().catch(() => ({ error: 'No se pudo generar el ZIP.' }))
      return NextResponse.json(body, { status: upstream.status })
    }
    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/zip',
        'Content-Disposition': upstream.headers.get('content-disposition') || 'attachment; filename="cards.zip"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[cards:export-proxy]', error)
    return NextResponse.json({ error: 'No se pudo conectar con el exportador.' }, { status: 502 })
  }
}
