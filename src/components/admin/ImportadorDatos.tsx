'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ejecutarImportacion, validarImportacion } from '@/server/actions/datos'
import type { ResumenImportacion } from '@/server/services/datos'

export default function ImportadorDatos() {
  const router = useRouter()
  const [json, setJson] = useState('')
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [modo, setModo] = useState<'fusionar' | 'reemplazar'>('fusionar')
  const [ocupado, start] = useTransition()

  const leerArchivo = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setJson(String(ev.target?.result ?? ''))
      setResumen(null)
      setError(null)
      setExito(null)
    }
    reader.readAsText(file)
  }

  const validar = () => {
    setError(null)
    setExito(null)
    start(async () => {
      const res = await validarImportacion(json)
      if (res.ok && res.resumen) setResumen(res.resumen)
      else {
        setResumen(null)
        setError(res.error)
      }
    })
  }

  const importar = () => {
    if (
      modo === 'reemplazar' &&
      !window.confirm(
        'Modo REEMPLAZAR: se borrará TODO el contenido actual (y el progreso de los jugadores sobre elementos eliminados) antes de importar. ¿Continuar?',
      )
    )
      return
    setError(null)
    start(async () => {
      const res = await ejecutarImportacion(json, modo)
      if (res.ok && res.resumen) {
        setExito(
          `Importación completada: ${res.resumen.categorias} categorías, ${res.resumen.elementos} elementos, ${res.resumen.caminos} caminos, ${res.resumen.secuencias} secuencias, ${res.resumen.recetas} recetas, ${res.resumen.avances} avances, ${res.resumen.rituales} rituales y ${res.resumen.logros} logros.`,
        )
        setResumen(null)
        setJson('')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md border border-wine bg-wine/20 px-3 py-2 text-sm">{error}</p>
      )}
      {exito && (
        <p role="status" className="rounded-md border border-brass-deep bg-brass/10 px-3 py-2 text-sm text-brass">
          {exito}
        </p>
      )}

      <div>
        <label htmlFor="archivo" className="etiqueta">Archivo JSON</label>
        <input
          id="archivo"
          type="file"
          accept="application/json,.json"
          onChange={(e) => leerArchivo(e.target.files?.[0])}
          className="campo"
        />
      </div>
      <div>
        <label htmlFor="json" className="etiqueta">…o pega el contenido aquí</label>
        <textarea
          id="json"
          rows={8}
          value={json}
          onChange={(e) => { setJson(e.target.value); setResumen(null); setExito(null) }}
          placeholder='{"version": 1, "elementos": [...], ...}'
          className="campo font-mono text-xs"
        />
      </div>

      <button type="button" onClick={validar} disabled={ocupado || !json.trim()} className="btn-ghost">
        {ocupado && !resumen ? 'Validando…' : '1 · Validar archivo'}
      </button>

      {resumen && (
        <div className="rounded-lg mist-card p-4">
          <h3 className="etiqueta">Resumen de la importación</h3>
          <ul className="mb-3 grid grid-cols-2 gap-1 text-sm text-parchment sm:grid-cols-5">
            <li>{resumen.categorias} categorías</li>
            <li>{resumen.elementos} elementos</li>
            <li>{resumen.caminos} caminos</li>
            <li>{resumen.secuencias} secuencias</li>
            <li>{resumen.recetas} recetas</li>
            <li>{resumen.avances} avances</li>
            <li>{resumen.rituales} rituales</li>
            <li>{resumen.logros} logros</li>
          </ul>
          {resumen.problemas.length > 0 ? (
            <div className="mb-3 text-sm text-wine">
              <p className="font-semibold">Problemas encontrados (corrígelos antes de importar):</p>
              <ul className="list-inside list-disc">
                {resumen.problemas.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-4 text-sm text-parchment">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="modo"
                    checked={modo === 'fusionar'}
                    onChange={() => setModo('fusionar')}
                    className="accent-[var(--color-brass)]"
                  />
                  Fusionar (actualiza por slug, conserva el resto)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="modo"
                    checked={modo === 'reemplazar'}
                    onChange={() => setModo('reemplazar')}
                    className="accent-[var(--color-brass)]"
                  />
                  Reemplazar (borra todo el contenido antes)
                </label>
              </div>
              <button type="button" onClick={importar} disabled={ocupado} className="btn-brass">
                {ocupado ? 'Importando…' : '2 · Confirmar importación'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
