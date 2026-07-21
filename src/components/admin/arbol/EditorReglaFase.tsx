'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { PhaseRule } from '@/shared/phaseRules'

type RuleType = PhaseRule['type']

type ElementOption = {
  slug: string
  name: string
  isActive: boolean
}

const RULE_TYPES: Array<{ value: RuleType; label: string }> = [
  { value: 'ALWAYS', label: 'Abrir desde el inicio' },
  { value: 'DISCOVERY_COUNT', label: 'Cantidad descubierta' },
  { value: 'DISCOVERY_PERCENTAGE', label: 'Porcentaje del cierre alcanzable' },
  { value: 'ELEMENT_DISCOVERED', label: 'Elemento específico descubierto' },
  { value: 'AND', label: 'Grupo AND (todas)' },
  { value: 'OR', label: 'Grupo OR (cualquiera)' },
]

export function EditorReglaFase({
  value,
  onChange,
  elements,
  reachableElementCount,
  disabled = false,
}: {
  value: PhaseRule
  onChange: (rule: PhaseRule) => void
  elements: readonly ElementOption[]
  reachableElementCount: number
  disabled?: boolean
}) {
  const sortedElements = [...elements].sort((left, right) =>
    left.name.localeCompare(right.name, 'es'),
  )

  return (
    <fieldset className="rounded-lg border border-brass/25 bg-black/15 p-3 sm:p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-brass">
        Regla de avance
      </legend>
      <p id="phase-rule-help" className="mb-3 text-xs leading-5 text-fog">
        El porcentaje usa los {reachableElementCount} elementos alcanzables antes de abrir esta fase.
        Combina condiciones con grupos AND/OR; los grupos pueden anidarse.
      </p>
      <RuleNodeEditor
        rule={value}
        onChange={onChange}
        elements={sortedElements}
        path="root"
        level={0}
        disabled={disabled}
      />
    </fieldset>
  )
}

function RuleNodeEditor({
  rule,
  onChange,
  onRemove,
  elements,
  path,
  level,
  disabled,
}: {
  rule: PhaseRule
  onChange: (rule: PhaseRule) => void
  onRemove?: () => void
  elements: readonly ElementOption[]
  path: string
  level: number
  disabled: boolean
}) {
  const typeId = `phase-rule-${path}-type`
  const isGroup = rule.type === 'AND' || rule.type === 'OR'

  return (
    <fieldset
      className={`min-w-0 rounded-md border p-3 ${
        level === 0 ? 'border-line2 bg-panel/45' : 'border-line bg-black/20'
      }`}
    >
      <legend className="px-1 text-[10px] uppercase tracking-[0.14em] text-fog">
        {level === 0 ? 'Condición principal' : `Condición ${path.split('-').at(-1)}`}
      </legend>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor={typeId} className="etiqueta">Tipo</label>
          <select
            id={typeId}
            name={`${path}-type`}
            value={rule.type}
            disabled={disabled}
            aria-describedby="phase-rule-help"
            onChange={(event) => onChange(defaultRule(event.target.value as RuleType, elements))}
            className="campo w-full"
          >
            {RULE_TYPES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {rule.type === 'DISCOVERY_COUNT' && (
          <div className="min-w-36 flex-1">
            <label htmlFor={`${path}-count`} className="etiqueta">Mínimo</label>
            <input
              id={`${path}-count`}
              name={`${path}-count`}
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              value={rule.minimum}
              disabled={disabled}
              onChange={(event) => {
                if (Number.isInteger(event.target.valueAsNumber)) {
                  onChange({ type: 'DISCOVERY_COUNT', minimum: event.target.valueAsNumber })
                }
              }}
              className="campo w-full tabular-nums"
            />
          </div>
        )}

        {rule.type === 'DISCOVERY_PERCENTAGE' && (
          <div className="min-w-36 flex-1">
            <label htmlFor={`${path}-percentage`} className="etiqueta">Porcentaje</label>
            <div className="flex items-center gap-2">
              <input
                id={`${path}-percentage`}
                name={`${path}-percentage`}
                type="number"
                inputMode="decimal"
                min={0.01}
                max={100}
                step={0.01}
                value={rule.basisPoints / 100}
                disabled={disabled}
                onChange={(event) => {
                  if (Number.isFinite(event.target.valueAsNumber)) {
                    onChange({
                      type: 'DISCOVERY_PERCENTAGE',
                      basisPoints: Math.round(event.target.valueAsNumber * 100),
                    })
                  }
                }}
                className="campo w-full tabular-nums"
              />
              <span aria-hidden="true" className="text-sm text-fog">%</span>
            </div>
          </div>
        )}

        {rule.type === 'ELEMENT_DISCOVERED' && (
          <div className="min-w-0 flex-[2]">
            <label htmlFor={`${path}-element`} className="etiqueta">Elemento requerido</label>
            <select
              id={`${path}-element`}
              name={`${path}-element`}
              value={rule.elementSlug}
              disabled={disabled || elements.length === 0}
              onChange={(event) => onChange({
                type: 'ELEMENT_DISCOVERED',
                elementSlug: event.target.value,
              })}
              className="campo w-full"
            >
              {elements.map((element) => (
                <option key={element.slug} value={element.slug}>
                  {element.name}{element.isActive ? '' : ' (inactivo)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {onRemove && (
          <button
            type="button"
            aria-label={`Eliminar condición ${path.split('-').at(-1)}`}
            disabled={disabled}
            onClick={onRemove}
            className="touch-manipulation rounded-md border border-wine/50 p-2 text-wine transition-colors hover:bg-wine/10 focus-visible:ring-2 focus-visible:ring-brass disabled:pointer-events-none disabled:opacity-50"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>

      {rule.type === 'ALWAYS' && (
        <p className="mt-2 text-xs text-fog">No exige progreso previo. Úsala normalmente solo en la primera fase.</p>
      )}

      {isGroup && (
        <div className="mt-3 border-l border-brass-deep/70 pl-3">
          <div className="space-y-2">
            {rule.conditions.map((condition, index) => (
              <RuleNodeEditor
                key={`${path}-${index}`}
                rule={condition}
                onChange={(next) => onChange({
                  ...rule,
                  conditions: rule.conditions.map((item, itemIndex) =>
                    itemIndex === index ? next : item,
                  ),
                })}
                onRemove={rule.conditions.length > 1
                  ? () => onChange({
                      ...rule,
                      conditions: rule.conditions.filter((_, itemIndex) => itemIndex !== index),
                    })
                  : undefined}
                elements={elements}
                path={`${path}-${index + 1}`}
                level={level + 1}
                disabled={disabled}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || rule.conditions.length >= 20}
              onClick={() => onChange({
                ...rule,
                conditions: [...rule.conditions, { type: 'DISCOVERY_COUNT', minimum: 1 }],
              })}
              className="touch-manipulation flex items-center gap-1.5 rounded-md border border-line2 px-2.5 py-1.5 text-xs text-fog transition-colors hover:border-brass hover:text-parchment focus-visible:ring-2 focus-visible:ring-brass disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Añadir condición
            </button>
            <button
              type="button"
              disabled={disabled || rule.conditions.length >= 20}
              onClick={() => onChange({
                ...rule,
                conditions: [
                  ...rule.conditions,
                  { type: 'AND', conditions: [{ type: 'DISCOVERY_COUNT', minimum: 1 }] },
                ],
              })}
              className="touch-manipulation flex items-center gap-1.5 rounded-md border border-line2 px-2.5 py-1.5 text-xs text-fog transition-colors hover:border-brass hover:text-parchment focus-visible:ring-2 focus-visible:ring-brass disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Añadir grupo
            </button>
          </div>
        </div>
      )}
    </fieldset>
  )
}

function defaultRule(type: RuleType, elements: readonly ElementOption[]): PhaseRule {
  switch (type) {
    case 'ALWAYS':
      return { type: 'ALWAYS' }
    case 'DISCOVERY_COUNT':
      return { type: 'DISCOVERY_COUNT', minimum: 1 }
    case 'DISCOVERY_PERCENTAGE':
      return { type: 'DISCOVERY_PERCENTAGE', basisPoints: 10_000 }
    case 'ELEMENT_DISCOVERED':
      return { type: 'ELEMENT_DISCOVERED', elementSlug: elements[0]?.slug ?? 'sin-elemento' }
    case 'AND':
    case 'OR':
      return { type, conditions: [{ type: 'DISCOVERY_COUNT', minimum: 1 }] }
  }
}
