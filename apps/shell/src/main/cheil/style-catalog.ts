/** Cheil fork: selected public design tokens; never execute catalog prose or fetch brand assets. */
import type { DocumentStyle, StyleToken } from '../../shared/cheil-style-api'
export const DESIGN_REVISION = 'd14df1cedf3c0b9e5d4d892f90759dadf3276302'
export interface CatalogEntry {
  slug: string
  name: string
}
const validSlug = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 80
const label = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length > 0 &&
  v.length <= 80 &&
  ![...v].some((c) => c.charCodeAt(0) < 32 || '<>`[]{}'.includes(c))
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** Fixed service URLs only, no redirects, ambient credentials, document body or search terms. */
export async function readStylePublicFile(
  url: string,
  limit: number,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const parsed = new URL(url)
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.search ||
    parsed.hash ||
    !(
      (parsed.hostname === 'www.getdesign.kr' && parsed.pathname === '/llms.txt') ||
      (parsed.hostname === 'raw.githubusercontent.com' &&
        new RegExp(
          `^/CaesiumY/ko-design-md/${DESIGN_REVISION}/services/[a-z0-9-]+\\.tokens\\.json$`,
        ).test(parsed.pathname)) ||
      (parsed.hostname === 'thesvg.org' &&
        (parsed.pathname === '/api/registry.json' ||
          /^\/icons\/[a-z0-9-]+\/[a-z0-9-]+\.svg$/.test(parsed.pathname)))
    )
  )
    throw Error('public-source-not-allowed')
  const response = await fetcher(url, {
    redirect: 'error',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok || !response.body) throw Error('public-source-unavailable')
  const declared = Number(response.headers.get('content-length'))
  if (declared > limit) {
    await response.body.cancel()
    throw Error('public-source-too-large')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let total = 0
  let text = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > limit) {
        await reader.cancel()
        throw Error('public-source-too-large')
      }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } finally {
    reader.releaseLock()
  }
}

export function parseDesignIndex(text: string): CatalogEntry[] {
  const entries = new Map<string, CatalogEntry>()
  for (const m of text.matchAll(
    /^- \[([^\]\r\n]+)\]\(https:\/\/www\.getdesign\.kr\/services\/([a-z0-9-]+)\/llms\.txt\)/gm,
  )) {
    if (validSlug(m[2]) && label(m[1])) entries.set(m[2], { slug: m[2], name: m[1] })
  }
  if (!entries.size || entries.size > 1000) throw Error('invalid-design-index')
  return [...entries.values()]
}

/** CSS Color 4 OKLCH -> sRGB; gamut is clipped for document color fields. */
export function documentHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (/^#[a-f\d]{6}$/i.test(value)) return value.toUpperCase()
  if (/^#[a-f\d]{3}$/i.test(value))
    return (
      '#' +
      value
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase()
    )
  const match = /^oklch\(\s*(\d*\.?\d+)\s+(\d*\.?\d+)\s+(-?\d*\.?\d+)\s*\)$/i.exec(value)
  if (!match) return null
  const [l, c, h] = match.slice(1).map(Number)
  if (l > 1 || c > 0.5 || Math.abs(h) > 360) return null
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const ll = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const ss = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss,
    -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss,
    -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss,
  ]
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(
          255 *
            Math.max(
              0,
              Math.min(1, v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055),
            ),
        ),
      )
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

export function adaptCatalogTokens(entry: CatalogEntry, input: unknown): DocumentStyle {
  if (!validSlug(entry.slug) || !label(entry.name) || !object(input))
    throw Error('invalid-catalog-tokens')
  const colors: StyleToken[] = []
  const sizes: StyleToken[] = []
  if (Array.isArray(input.colors))
    for (const row of input.colors.slice(0, 250)) {
      if (!object(row)) continue
      const color = documentHex(row.value)
      if (color && !colors.some((c) => c.value === color))
        colors.push({ value: color, count: 1, basis: 'theme' })
    }
  if (Array.isArray(input.typography))
    for (const row of input.typography.slice(0, 100)) {
      if (!object(row) || typeof row.size !== 'string' || !/^\d+(?:\.\d+)?px$/.test(row.size))
        continue
      const pt = Math.round(parseFloat(row.size) * 0.75 * 100) / 100
      if (pt >= 4 && pt <= 200 && !sizes.some((s) => s.value === String(pt)))
        sizes.push({ value: String(pt), count: 1, basis: 'theme' })
    }
  if (!colors.length && !sizes.length) throw Error('no-supported-catalog-tokens')
  return {
    version: 1,
    name: entry.name,
    format: 'catalog',
    fonts: [],
    colors: colors.slice(0, 40),
    sizes,
    shapes: [],
    warnings: [
      'reference-style-not-official-template',
      'web-pixels-converted-to-points',
      'oklch-converted-to-clipped-srgb',
      'brand-assets-and-font-files-excluded',
      'choose-installed-font',
    ],
    source: {
      url: `https://github.com/CaesiumY/ko-design-md/blob/${DESIGN_REVISION}/services/${entry.slug}.tokens.json`,
      revision: DESIGN_REVISION,
      author: 'ko-design-md by ChangSik Yoon',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      modified: true,
    },
  }
}

export function createStyleCatalog(fetcher: typeof fetch = fetch) {
  let index: CatalogEntry[] | undefined
  return {
    async search(query: string): Promise<CatalogEntry[]> {
      if (typeof query !== 'string' || query.length > 80) throw Error('invalid-catalog-query')
      index ??= parseDesignIndex(
        await readStylePublicFile('https://www.getdesign.kr/llms.txt', 300_000, fetcher),
      )
      const q = query.trim().toLowerCase()
      return index.filter((e) => `${e.name} ${e.slug}`.toLowerCase().includes(q)).slice(0, 100)
    },
    async load(slug: string): Promise<DocumentStyle> {
      if (!validSlug(slug) || !index?.some((e) => e.slug === slug))
        throw Error('select-catalog-entry-first')
      const entry = index.find((e) => e.slug === slug)!
      const raw = await readStylePublicFile(
        `https://raw.githubusercontent.com/CaesiumY/ko-design-md/${DESIGN_REVISION}/services/${slug}.tokens.json`,
        500_000,
        fetcher,
      )
      return adaptCatalogTokens(entry, JSON.parse(raw))
    },
  }
}
