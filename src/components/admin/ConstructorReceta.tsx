'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  guardarReceta,
  previsualizarReceta,
  probarCombinacion,
  type RecetaFormData,
} from '@/server/actions/recetas'
import { IconoElemento } from '@/components/game/IconoElemento'
import { BuscadorElemento } from './BuscadorElemento'
import { CreadorRapido } from './CreadorRapido'
import type { ElementoOpcion, RecetaEditable, RecetaOutputEditable } from './tiposReceta'

export type { ElementoOpcion, RecetaEditable, RecetaOutputEditable } from './tiposReceta'

type Fila = { elementId: string; quantity: number }

export default function ConstructorReceta({
  elementos,
  receta,
  ingredientesIniciales,
  caminos = [],
  categorias = [],
}: {
  elementos: ElementoOpcion[]
  receta: RecetaEditable | null
  ingredientesIniciales: Fila[]
  // Para vincular el primer resultado a un camino (existente o nuevo).
  caminos?: { id: string; name: string }[]
  categorias?: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [todos, setTodos] = useState<ElementoOpcion[]>(elementos)
  const [filas, setFilas] = useState<Fila[]>(
    receta?.ingredientes ?? ingredientesIniciales,
  )
  const [outputs, setOutputs] = useState<RecetaOutputEditable[]>(
    receta?.outputs ?? [],
  )
  const [nombre, setNombre] = useState(receta?.name ?? '')
  const [successText, setSuccessText] = useState(receta?.successText ?? '')
  const [hintText, setHintText] = useState(receta?.hintText ?? '')
  const [activa, setActiva] = useState(receta?.isActive ?? true)
  const [inputKey, setInputKey] = useState<string | null>(null)
  const [existenteData, setExistenteData] = useState<{
    id: string
    outputs: RecetaOutputEditable[]
    successText: string | null
    hintText: string | null
    isActive: boolean
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prueba, setPrueba] = useState<string | null>(null)
  // '' = sin vínculo · 'nuevo' = crear camino · otro valor = id de camino existente
  const [caminoSel, setCaminoSel] = useState('')
  const [nuevoNombreCamino, setNuevoNombreCamino] = useState('')
  const [nuevaCategoriaId, setNuevaCategoriaId] = useState('')
  const [numeroSecuencia, setNumeroSecuencia] = useState(9)
  const [nombreSecuencia, setNombreSecuencia] = useState('')
  const [guardando, startGuardar] = useTransition()
  const [probando, startProbar] = useTransition()

  const caminoIncompleto =
    caminoSel === 'nuevo' && (!nuevoNombreCamino.trim() || !nuevaCategoriaId)
  // Sin resultados explícitos, la receta puede producir una secuencia nueva:
  // basta con vincular un camino y darle nombre a la secuencia.
  const secuenciaComoResultado = caminoSel !== '' && nombreSecuencia.trim() !== ''
  const resultadoValido = outputs.length > 0 || secuenciaComoResultado

  const porId = useMemo(() => new Map(todos.map((e) => [e.id, e])), [todos])

  const registrarNuevo = (el: ElementoOpcion) =>
    setTodos((t) => [...t, el].sort((a, b) => a.name.localeCompare(b.name, 'es')))
  const totalUnidades = filas.reduce((s, f) => s + f.quantity, 0)
  const salidaNombres =
    outputs
      .map((o) => porId.get(o.elementId)?.name)
      .filter(Boolean)
      .join(', ') ||
    (caminoSel && nombreSecuencia.trim() ? `${nombreSecuencia.trim()} (secuencia nueva)` : '…')

  // Previsualización con la inputKey calculada en el servidor (debounce).
  useEffect(() => {
    setPrueba(null)
    if (filas.length === 0) {
      setInputKey(null)
      setExistenteData(null)
      return
    }
    const t = setTimeout(async () => {
      const res = await previsualizarReceta(filas, receta?.id)
      setInputKey(res.inputKey)
      setExistenteData(res.existente)
    }, 300)
    return () => clearTimeout(t)
  }, [filas, receta?.id])

  const cargarExistente = () => {
    if (!existenteData) return
    setOutputs(existenteData.outputs)
    setNombre('')
    setSuccessText(existenteData.successText ?? '')
    setHintText(existenteData.hintText ?? '')
    setActiva(existenteData.isActive)
  }

  const agregarIngrediente = (elementId: string) => {
    setFilas((f) => {
      const existente = f.find((x) => x.elementId === elementId)
      // Repetir el mismo ingrediente suma cantidad (una sola fila por elemento).
      if (existente) {
        return f.map((x) =>
          x.elementId === elementId ? { ...x, quantity: x.quantity + 1 } : x,
        )
      }
      return [...f, { elementId, quantity: 1 }]
    })
  }

  const agregarOutput = (elementId: string) =>
    setOutputs((prev) => [
      ...prev,
      { elementId, quantity: 1, chance: 1.0, sortOrder: prev.length },
    ])

  const previsualizacion =
    filas.length > 0
      ? `${filas
          .map((f) => `${porId.get(f.elementId)?.name ?? '?'} × ${f.quantity}`)
          .join(' + ')} → ${salidaNombres}`
      : null

  const enviar = () => {
    setError(null)
    const datos: RecetaFormData = {
      name: nombre,
      outputs: outputs.map((o, idx) => ({ ...o, sortOrder: idx })),
      successText,
      hintText,
      isActive: activa,
      ingredientes: filas,
      camino: caminoSel
        ? {
            pathwayId: caminoSel === 'nuevo' ? '' : caminoSel,
            nuevoNombre: caminoSel === 'nuevo' ? nuevoNombreCamino : '',
            nuevaCategoriaId,
            numero: numeroSecuencia,
            nombreSecuencia,
          }
        : null,
    }
    startGuardar(async () => {
      const res = await guardarReceta(receta?.id ?? null, datos)
      if (res.ok) router.push('/admin/recetas')
      else setError(res.error)
    })
  }

  const probar = () => {
    startProbar(async () => {
      const res = await probarCombinacion(filas)
      setPrueba(res.mensaje)
    })
  }

  return (
    <div className="max-w-2xl space-y-5">
      {error && (
        <p role="alert" className="rounded-md border border-wine bg-wine/20 px-3 py-2 text-sm">{error}</p>
      )}

      <section className="rounded-lg mist-card p-4">
        <h2 className="etiqueta">Ingredientes (dos unidades en total)</h2>
        <BuscadorElemento
          elementos={todos}
          onPick={agregarIngrediente}
          placeholder="Buscar y añadir ingrediente…"
        />
        <CreadorRapido
          etiqueta="Nuevo ingrediente"
          onCreado={(el) => {
            registrarNuevo(el)
            agregarIngrediente(el.id)
          }}
        />
        <ul className="mt-3 space-y-2">
          {filas.map((f) => {
            const el = porId.get(f.elementId)
            return (
              <li key={f.elementId} className="flex items-center gap-3">
                <IconoElemento iconKey={el?.iconKey ?? 'sparkles'} className="h-5 w-5 text-brass" />
                <span className="flex-1 text-sm text-parchment">{el?.name ?? '?'}</span>
                <label className="flex items-center gap-1 text-xs text-fog">
                  Cantidad
                  <input
                    type="number"
                    min={1}
                    max={9}
                    value={f.quantity}
                    onChange={(e) =>
                      setFilas((prev) =>
                        prev.map((x) =>
                          x.elementId === f.elementId
                            ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) }
                            : x,
                        ),
                      )
                    }
                    className="campo w-16"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setFilas((prev) => prev.filter((x) => x.elementId !== f.elementId))}
                  className="text-fog hover:text-parchment"
                  aria-label={`Quitar ${el?.name ?? 'ingrediente'}`}
                >
                  ✕
                </button>
              </li>
            )
          })}
          {filas.length === 0 && <li className="text-sm italic text-fog">Aún no hay ingredientes.</li>}
        </ul>
        <p className={`mt-2 text-xs ${totalUnidades === 2 ? 'text-fog' : 'text-wine'}`}>
          Unidades totales: {totalUnidades}{' '}
          {totalUnidades !== 2 && '— la primera versión del juego exige exactamente 2.'}
        </p>
      </section>

      <section className="rounded-lg mist-card p-4">
        <h2 className="etiqueta">Resultados</h2>
        <BuscadorElemento
          elementos={todos}
          onPick={agregarOutput}
          placeholder="Buscar elemento resultado…"
        />
        <CreadorRapido
          etiqueta="Nuevo resultado"
          onCreado={(el) => {
            registrarNuevo(el)
            agregarOutput(el.id)
          }}
        />
        <ul className="mt-3 space-y-2">
          {outputs.map((o, idx) => {
            const el = porId.get(o.elementId)
            return (
              <li key={o.elementId} className="flex items-center gap-3">
                <IconoElemento iconKey={el?.iconKey ?? 'sparkles'} className="h-5 w-5 text-brass" />
                <span className="flex-1 text-sm text-parchment">{el?.name ?? '?'}</span>
                <label className="flex items-center gap-1 text-xs text-fog">
                  Cantidad
                  <input
                    type="number"
                    min={1}
                    max={9}
                    value={o.quantity}
                    onChange={(e) =>
                      setOutputs((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x,
                        ),
                      )
                    }
                    className="campo w-16"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-fog">
                  Prob.
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={o.chance}
                    onChange={(e) =>
                      setOutputs((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, chance: Math.min(1, Math.max(0, Number(e.target.value) || 1)) } : x,
                        ),
                      )
                    }
                    className="campo w-16"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setOutputs((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-fog hover:text-parchment"
                  aria-label={`Quitar ${el?.name ?? 'resultado'}`}
                >
                  ✕
                </button>
              </li>
            )
          })}
          {outputs.length === 0 && <li className="text-sm italic text-fog">Aún no hay resultados.</li>}
        </ul>
        {outputs.length === 0 && (
          <p className="mt-2 text-xs text-fog">
            También puedes dejar esto vacío: vincula un camino más abajo y dale
            nombre a la secuencia, y su elemento se creará automáticamente.
          </p>
        )}
      </section>

      <section className="rounded-lg mist-card p-4">
        <h2 className="etiqueta">Previsualización</h2>
        <p className="text-lg text-parchment">{previsualizacion ?? '—'}</p>
        <p className="mt-1 text-xs text-fog">
          Clave interna (automática): <code>{inputKey ?? '—'}</code>
        </p>
        {existenteData && (
          <div className="mt-3 rounded-md border border-brass-deep/30 bg-brass/5 p-3">
            <p className="text-sm text-brass">
              Ya existe una receta para esta combinación.
            </p>
            <button
              type="button"
              onClick={cargarExistente}
              className="mt-2 text-sm text-brass underline hover:text-parchment"
            >
              Cargar resultados existentes para editar
            </button>
          </div>
        )}
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={probar} disabled={probando || filas.length === 0} className="btn-ghost">
            {probando ? 'Probando…' : 'Probar combinación'}
          </button>
          {prueba && <span className="text-sm text-fog">{prueba}</span>}
        </div>
      </section>

      <section className="rounded-lg mist-card p-4">
        <h2 className="etiqueta">Camino y secuencia (opcional)</h2>
        <p className="mb-2 text-xs text-fog">
          El primer resultado puede unirse a un camino existente o fundar uno
          nuevo como secuencia (p. ej. Secuencia 9 de un camino Beyonder).
        </p>
        <select
          value={caminoSel}
          onChange={(e) => setCaminoSel(e.target.value)}
          className="campo"
          aria-label="Camino al que se vincula el resultado"
        >
          <option value="">— Sin vínculo con caminos —</option>
          {caminos.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="nuevo">+ Crear un camino nuevo…</option>
        </select>
        {caminoSel === 'nuevo' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="rc-nombre" className="etiqueta">Nombre del camino nuevo</label>
              <input
                id="rc-nombre"
                value={nuevoNombreCamino}
                maxLength={80}
                placeholder="p. ej. Camino del Apotecario"
                onChange={(e) => setNuevoNombreCamino(e.target.value)}
                className="campo"
              />
            </div>
            <div>
              <label htmlFor="rc-cat" className="etiqueta">Categoría del camino</label>
              <select
                id="rc-cat"
                value={nuevaCategoriaId}
                onChange={(e) => setNuevaCategoriaId(e.target.value)}
                className="campo"
              >
                <option value="">— Selecciona —</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {caminoSel && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="rc-numero" className="etiqueta">Número de secuencia</label>
              <input
                id="rc-numero"
                type="number"
                min={0}
                max={99}
                value={numeroSecuencia}
                onChange={(e) => setNumeroSecuencia(Math.min(99, Math.max(0, Number(e.target.value) || 0)))}
                className="campo"
              />
            </div>
            <div>
              <label htmlFor="rc-seq" className="etiqueta">Nombre de la secuencia</label>
              <input
                id="rc-seq"
                value={nombreSecuencia}
                maxLength={80}
                placeholder={porId.get(outputs[0]?.elementId ?? '')?.name ?? 'Como el resultado'}
                onChange={(e) => setNombreSecuencia(e.target.value)}
                className="campo"
              />
            </div>
          </div>
        )}
        {caminoIncompleto && (
          <p className="mt-2 text-xs text-wine">
            Completa el nombre y la categoría del camino nuevo.
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="r-nombre" className="etiqueta">Nombre interno (opcional)</label>
          <input id="r-nombre" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} className="campo" />
        </div>
        <div>
          <label htmlFor="r-exito" className="etiqueta">Texto de éxito (opcional)</label>
          <input id="r-exito" value={successText} maxLength={300} onChange={(e) => setSuccessText(e.target.value)} className="campo" />
        </div>
        <div>
          <label htmlFor="r-pista" className="etiqueta">Pista para la colección (opcional)</label>
          <input id="r-pista" value={hintText} maxLength={300} onChange={(e) => setHintText(e.target.value)} className="campo" />
        </div>
        <label className="flex items-center gap-2 self-end text-sm text-parchment">
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} className="accent-[var(--color-brass)]" />
          Receta activa
        </label>
      </section>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={enviar}
          disabled={guardando || filas.length === 0 || !resultadoValido || totalUnidades !== 2 || caminoIncompleto}
          className="btn-brass"
        >
          {guardando ? 'Guardando…' : receta ? 'Guardar cambios' : 'Crear receta'}
        </button>
        <button type="button" onClick={() => router.push('/admin/recetas')} className="btn-ghost">
          Volver
        </button>
      </div>
    </div>
  )
}
