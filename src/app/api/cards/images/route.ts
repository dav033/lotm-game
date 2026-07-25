import { NextResponse } from 'next/server'
import { storeCardImage } from '@/cards/images'
import { badRequest } from '@/server/apiError'

export const runtime = 'nodejs'

// El editor sube el binario aqui y guarda en la carta solo la ruta devuelta.
export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
    }
    const url = await storeCardImage(new Uint8Array(await file.arrayBuffer()), file.type)
    return NextResponse.json({ url }, { status: 201 })
  } catch (error) {
    return badRequest(error, 'No se pudo guardar la imagen.')
  }
}
