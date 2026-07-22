import fs from 'node:fs/promises'
import path from 'node:path'
import React, { type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import Card from '../builder/components/Card.jsx'
import CoverCard from '../builder/components/CoverCard.jsx'
import FullImageCoverCard from '../builder/components/FullImageCoverCard.jsx'
import TierCard from '../builder/components/TierCard.jsx'
import PathwayCard from '../builder/components/PathwayCard.jsx'
import TierExplanationCard from '../builder/components/TierExplanationCard.jsx'
import GeneralExplanationCard from '../builder/components/GeneralExplanationCard.jsx'
import {
  PATHWAYS,
  TIER_RANKS,
  PATHWAY_COLORS,
  powerTier,
  tierColor,
} from '../builder/data/pathways.js'
import { PATHWAY_ICONS } from '../builder/data/pathwayIcons.js'
import { PATHWAY_BACKGROUNDS } from '../builder/data/pathwayBackgrounds.js'
import { type BuilderCardState, type CardContent, toBuilderCardState } from './schema'

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const COVER_ACCENT = { c: '#d9b869', d: '#4a3a17', pct: 100 }
const PATHWAY_DATA = PATHWAYS as Record<string, string[]>
const TIER_DATA = TIER_RANKS as Record<string, { c: string; d: string }>
const PATHWAY_COLOR_DATA = PATHWAY_COLORS as Record<string, { c: string; d: string }>
const StaticCard = Card as unknown as ComponentType<Record<string, unknown>>
const StaticCoverCard = CoverCard as unknown as ComponentType<Record<string, unknown>>
const StaticFullImageCoverCard = FullImageCoverCard as unknown as ComponentType<Record<string, unknown>>
const StaticTierCard = TierCard as unknown as ComponentType<Record<string, unknown>>
const StaticPathwayCard = PathwayCard as unknown as ComponentType<Record<string, unknown>>
const StaticTierExplanationCard = TierExplanationCard as unknown as ComponentType<Record<string, unknown>>
const StaticGeneralExplanationCard = GeneralExplanationCard as unknown as ComponentType<Record<string, unknown>>
const FONT_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Space+Grotesk:wght@400;500;700&display=swap'

type RenderAssets = {
  css: string
  defaultCover: string
  icons: Record<string, string>
}

export class CardPngRenderer {
  private constructor(
    private readonly browser: Browser,
    private readonly context: BrowserContext,
    private readonly page: Page,
    private readonly assets: RenderAssets,
    private readonly publicDir: string,
  ) {}

  static async create(projectRoot = process.env.CARDS_PROJECT_ROOT || process.cwd()): Promise<CardPngRenderer> {
    const root = path.resolve(projectRoot)
    const publicDir = path.join(root, 'public')
    const css = await fs.readFile(path.join(root, 'src', 'builder', 'styles.css'), 'utf8')
    const iconEntries = await Promise.all(
      Object.entries(PATHWAY_ICONS as Record<string, string>).map(async ([name, source]) => [
        name,
        await resolveImageSource(source, publicDir),
      ] as const),
    )
    const assets = {
      css,
      defaultCover: await resolveImageSource('/cover-default.jpg', publicDir),
      icons: Object.fromEntries(iconEntries),
    }

    let browser: Browser
    try {
      browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CARDS_BROWSER_EXECUTABLE_PATH || undefined,
      })
    } catch (error) {
      throw new Error(
        'No se pudo iniciar Chromium. Ejecuta `npm run cards:browser` o define CARDS_BROWSER_EXECUTABLE_PATH.',
        { cause: error },
      )
    }

    const context = await browser.newContext({
      viewport: { width: 1_200, height: 900 },
      deviceScaleFactor: 2,
    })
    const page = await context.newPage()
    return new CardPngRenderer(browser, context, page, assets, publicDir)
  }

  async render(content: CardContent): Promise<Buffer> {
    const state = await resolveStateImages(toBuilderCardState(content), this.publicDir, this.assets.defaultCover)
    const markup = renderToStaticMarkup(
      <CardMarkup state={state} icons={this.assets.icons} />,
    )
    await this.page.setContent(
      `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <link rel="stylesheet" href="${FONT_STYLESHEET}">
          <style>${this.assets.css}</style>
          <style>html,body{margin:0;width:100%;min-height:100%;}body.builder-root{display:flex;align-items:flex-start;justify-content:flex-start;}</style>
        </head>
        <body class="builder-root">${markup}</body>
      </html>`,
      { waitUntil: 'networkidle', timeout: 30_000 },
    )
    await this.page.evaluate(async () => {
      await document.fonts?.ready
      await Promise.all(
        [...document.images].map((image) =>
          image.complete ? Promise.resolve() : image.decode().catch(() => undefined),
        ),
      )
    })
    return this.page.locator('#card').screenshot({ type: 'png', animations: 'disabled' })
  }

  async close(): Promise<void> {
    await this.context.close()
    await this.browser.close()
  }
}

function CardMarkup({ state, icons }: { state: BuilderCardState; icons: Record<string, string> }) {
  const isCharacter = state.type === 'Character'
  const isCover = state.type === 'Cover'
  const isFullImageCover = state.type === 'Full Image Cover'
  const isTier = state.type === 'Tier'
  const isPathwayCard = state.type === 'Pathway'
  const isTierExplanation = state.type === 'Tier Explanation'
  const isGeneralExplanation = state.type === 'General Explanation'
  const rawSequences = [
    { path: state.path, seq: state.seq },
    ...(state.hasSecond ? [{ path: state.path2, seq: state.seq2 }] : []),
  ]
  const sequences = rawSequences.map(({ path: pathway, seq }) => ({
    path: pathway,
    seq,
    rank: PATHWAY_DATA[pathway][9 - seq],
    icon: icons[pathway],
    tier: tierColor(seq),
  }))
  const tierPath = state.tierPath
  const tierSeq = state.tierSeq
  const tierRank = state.tierRank
  const accent = isCover || isFullImageCover
    ? COVER_ACCENT
    : isTier || isTierExplanation
      ? { ...TIER_DATA[tierRank], pct: 100 }
      : isPathwayCard
        ? { ...PATHWAY_COLOR_DATA[state.pathwayCardPath], pct: 100 }
      : isGeneralExplanation
        ? COVER_ACCENT
      : powerTier(state.type, state.power, state.grade)
  const baseValue = isCharacter ? state.power : state.grade
  const powerValue = baseValue + (state.mod.trim() ? ` (${state.mod.trim()})` : '')
  const pathLabel = [...new Set(sequences.map(({ path: pathway }) => pathway))].join(' · ')
  const explanationScope = state.explanationPath ?? 'All pathways'

  return (
    <main data-card-render-ready="true">
      {isCover ? (
        <StaticCoverCard
          image1={state.coverImage1}
          image2={state.coverImage2}
          title={state.coverTitle}
          part={state.coverPartNum}
          onUploadImage={() => undefined}
        />
      ) : isFullImageCover ? (
        <StaticFullImageCoverCard
          image={state.fullCoverImage}
          title={state.fullCoverTitle}
          onUploadImage={() => undefined}
        />
      ) : isTier ? (
        <StaticTierCard
          path={tierPath}
          icon={icons[tierPath]}
          sequence={tierSeq}
          sequenceName={tierSeq === null ? null : PATHWAY_DATA[tierPath][9 - tierSeq]}
          rank={tierRank}
          tier={TIER_DATA[tierRank]}
          text={state.tierText}
          footerText={state.tierFooterText}
          backgroundImage={state.tierBackgroundImage}
        />
      ) : isPathwayCard ? (
        <StaticPathwayCard
          path={state.pathwayCardPath}
          icon={icons[state.pathwayCardPath]}
          sequence={state.pathwayCardSeq}
          sequenceName={state.pathwayCardSeq === null ? null : PATHWAY_DATA[state.pathwayCardPath][9 - state.pathwayCardSeq]}
          tier={PATHWAY_COLOR_DATA[state.pathwayCardPath]}
          text={state.pathwayCardText}
          footerText={state.pathwayCardFooterText}
          backgroundImage={state.pathwayCardBackgroundImage}
        />
      ) : isTierExplanation ? (
        <StaticTierExplanationCard
          rank={tierRank}
          tier={TIER_DATA[tierRank]}
          description={state.tierExplanationText}
          backgroundImage={state.tierExplanationBackgroundImage}
          scope={explanationScope}
        />
      ) : isGeneralExplanation ? (
        <StaticGeneralExplanationCard
          title={state.generalExplanationTitle}
          description={state.generalExplanationText}
          scope={explanationScope}
        />
      ) : (
        <StaticCard
          name={state.name}
          image={state.image}
          accent={accent}
          sequences={sequences}
          pathLabel={pathLabel}
          dom={state.dom}
          powerLabel={isCharacter ? 'Power' : 'Grade'}
          powerValue={powerValue}
          onUploadImage={() => undefined}
          onDropImages={() => undefined}
        />
      )}
    </main>
  )
}

async function resolveStateImages(
  state: BuilderCardState,
  publicDir: string,
  defaultCover: string,
): Promise<BuilderCardState> {
  const tierBackgroundSource = state.tierBackgroundImage
    ?? (state.type === 'Tier'
      ? (PATHWAY_BACKGROUNDS as Record<string, string>)[state.tierPath] ?? null
      : null)
  const pathwayCardBackgroundSource = state.pathwayCardBackgroundImage
    ?? (state.type === 'Pathway'
      ? (PATHWAY_BACKGROUNDS as Record<string, string>)[state.pathwayCardPath] ?? null
      : null)
  return {
    ...state,
    image: state.image ? await resolveImageSource(state.image, publicDir) : null,
    coverImage1: state.coverImage1
      ? await resolveImageSource(state.coverImage1, publicDir)
      : null,
    coverImage2: state.coverImage2
      ? await resolveImageSource(state.coverImage2, publicDir)
      : defaultCover,
    fullCoverImage: state.fullCoverImage
      ? await resolveImageSource(state.fullCoverImage, publicDir)
      : null,
    tierBackgroundImage: tierBackgroundSource
      ? await resolveImageSource(tierBackgroundSource, publicDir)
      : null,
    tierExplanationBackgroundImage: state.tierExplanationBackgroundImage
      ? await resolveImageSource(state.tierExplanationBackgroundImage, publicDir)
      : null,
    pathwayCardBackgroundImage: pathwayCardBackgroundSource
      ? await resolveImageSource(pathwayCardBackgroundSource, publicDir)
      : null,
  }
}

async function resolveImageSource(source: string, publicDir: string): Promise<string> {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`No se pudo descargar la imagen ${source}: HTTP ${response.status}.`)
    const mime = response.headers.get('content-type')?.split(';')[0]
    if (!mime?.startsWith('image/')) throw new Error(`La URL ${source} no devolvio una imagen.`)
    const declaredSize = Number(response.headers.get('content-length') ?? 0)
    if (declaredSize > MAX_IMAGE_BYTES) throw new Error(`La imagen ${source} supera 15 MB.`)
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error(`La imagen ${source} supera 15 MB.`)
    return `data:${mime};base64,${buffer.toString('base64')}`
  }

  const pathname = decodeURIComponent(new URL(source, 'http://cards.local').pathname)
  const file = path.resolve(publicDir, `.${pathname}`)
  const root = `${path.resolve(publicDir)}${path.sep}`
  if (!file.startsWith(root)) throw new Error(`Ruta de imagen no permitida: ${source}`)
  const buffer = await fs.readFile(file)
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error(`La imagen ${source} supera 15 MB.`)
  return `data:${mimeFor(file)};base64,${buffer.toString('base64')}`
}

function mimeFor(file: string): string {
  const extension = path.extname(file).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.gif') return 'image/gif'
  if (extension === '.svg') return 'image/svg+xml'
  if (extension === '.avif') return 'image/avif'
  return 'image/webp'
}
