import { z } from 'zod'

export type PhaseRule =
  | { type: 'ALWAYS' }
  | { type: 'DISCOVERY_COUNT'; minimum: number }
  | { type: 'DISCOVERY_PERCENTAGE'; basisPoints: number }
  | { type: 'ELEMENT_DISCOVERED'; elementSlug: string }
  | { type: 'AND' | 'OR'; conditions: PhaseRule[] }

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const rawPhaseRuleSchema: z.ZodType<PhaseRule> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('ALWAYS') }).strict(),
    z.object({
      type: z.literal('DISCOVERY_COUNT'),
      minimum: z.number().int().min(0).max(9999),
    }).strict(),
    z.object({
      type: z.literal('DISCOVERY_PERCENTAGE'),
      basisPoints: z.number().int().min(1).max(10_000),
    }).strict(),
    z.object({
      type: z.literal('ELEMENT_DISCOVERED'),
      elementSlug: slug,
    }).strict(),
    z.object({
      type: z.enum(['AND', 'OR']),
      conditions: z.array(rawPhaseRuleSchema).min(1).max(20),
    }).strict(),
  ]),
)

export const phaseRuleSchema = rawPhaseRuleSchema.superRefine((rule, context) => {
  const stats = phaseRuleStats(rule)
  if (stats.depth > 8) {
    context.addIssue({ code: 'custom', message: 'La regla no puede superar 8 niveles.' })
  }
  if (stats.nodes > 100) {
    context.addIssue({ code: 'custom', message: 'La regla no puede superar 100 condiciones.' })
  }
})

export type PhaseRuleContext = {
  discoveryCount: number
  reachableElementCount: number
  discoveredElementSlugs: ReadonlySet<string>
}

export function legacyPhaseRule(unlockAtDiscoveryCount: number): PhaseRule {
  return unlockAtDiscoveryCount <= 0
    ? { type: 'ALWAYS' }
    : { type: 'DISCOVERY_COUNT', minimum: unlockAtDiscoveryCount }
}

export function parsePhaseRule(raw: unknown, fallbackCount = 0): PhaseRule {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    const parsed = phaseRuleSchema.safeParse(value)
    return parsed.success ? parsed.data : legacyPhaseRule(fallbackCount)
  } catch {
    return legacyPhaseRule(fallbackCount)
  }
}

export function serializePhaseRule(rule: PhaseRule): string {
  return JSON.stringify(phaseRuleSchema.parse(rule))
}

export function evaluatePhaseRule(rule: PhaseRule, context: PhaseRuleContext): boolean {
  switch (rule.type) {
    case 'ALWAYS':
      return true
    case 'DISCOVERY_COUNT':
      return context.discoveryCount >= rule.minimum
    case 'DISCOVERY_PERCENTAGE':
      return (
        context.reachableElementCount > 0 &&
        context.discoveryCount * 10_000 >= rule.basisPoints * context.reachableElementCount
      )
    case 'ELEMENT_DISCOVERED':
      return context.discoveredElementSlugs.has(rule.elementSlug)
    case 'AND':
      return rule.conditions.every((condition) => evaluatePhaseRule(condition, context))
    case 'OR':
      return rule.conditions.some((condition) => evaluatePhaseRule(condition, context))
  }
}

export function summarizePhaseRule(
  rule: PhaseRule,
  elementNameBySlug: ReadonlyMap<string, string> = new Map(),
): string {
  switch (rule.type) {
    case 'ALWAYS':
      return 'Abierta desde el inicio'
    case 'DISCOVERY_COUNT':
      return `Descubrir ${rule.minimum} elementos`
    case 'DISCOVERY_PERCENTAGE':
      return `Descubrir ${formatPercentage(rule.basisPoints)} del cierre alcanzable`
    case 'ELEMENT_DISCOVERED':
      return `Descubrir ${elementNameBySlug.get(rule.elementSlug) ?? rule.elementSlug}`
    case 'AND':
    case 'OR': {
      const operator = rule.type === 'AND' ? ' Y ' : ' O '
      return rule.conditions.map((condition) => {
        const summary = summarizePhaseRule(condition, elementNameBySlug)
        return condition.type === 'AND' || condition.type === 'OR' ? `(${summary})` : summary
      }).join(operator)
    }
  }
}

export function phaseRuleElementSlugs(rule: PhaseRule): string[] {
  if (rule.type === 'ELEMENT_DISCOVERED') return [rule.elementSlug]
  if (rule.type === 'AND' || rule.type === 'OR') {
    return [...new Set(rule.conditions.flatMap(phaseRuleElementSlugs))]
  }
  return []
}

function phaseRuleStats(rule: PhaseRule): { nodes: number; depth: number } {
  if (rule.type !== 'AND' && rule.type !== 'OR') return { nodes: 1, depth: 1 }
  const children = rule.conditions.map(phaseRuleStats)
  return {
    nodes: 1 + children.reduce((total, child) => total + child.nodes, 0),
    depth: 1 + Math.max(0, ...children.map((child) => child.depth)),
  }
}

function formatPercentage(basisPoints: number): string {
  return `${new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(basisPoints / 100)}%`
}
