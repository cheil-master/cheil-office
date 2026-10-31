/** Cheil fork: metadata search and strictly inert SVG assets; no third-party website embedding. */
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { readStylePublicFile } from './style-catalog'
export interface BrandLogo {
  slug: string
  title: string
  aliases: string[]
  categories: string[]
  variants: string[]
  license: string
  guidelines?: string
  website?: string
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const slug = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 100
const label = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length > 0 &&
  v.length <= 160 &&
  ![...v].some((c) => c.charCodeAt(0) < 32 || '<>'.includes(c))
const labels = (v: unknown) => (Array.isArray(v) ? v.filter(label).slice(0, 30) : [])
function https(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 1000) return
  try {
    const u = new URL(v)
    if (u.protocol === 'https:' && !u.username && !u.password) return u.href
  } catch {
    /* invalid metadata */
  }
}
export function parseBrandRegistry(input: unknown): BrandLogo[] {
  if (!object(input) || !Array.isArray(input.icons) || input.icons.length > 30_000)
    throw Error('invalid-brand-registry')
  const seen = new Set<string>()
  return input.icons.flatMap((row) => {
    if (
      !object(row) ||
      !slug(row.slug) ||
      !label(row.title) ||
      seen.has(row.slug) ||
      !Array.isArray(row.variants)
    )
      return []
    const variants = row.variants.filter(slug)
    if (!variants.length) return []
    seen.add(row.slug)
    return [
      {
        slug: row.slug,
        title: row.title,
        aliases: labels(row.aliases),
        categories: labels(row.categories),
        variants,
        license: label(row.license) ? row.license : 'Unknown',
        guidelines: https(row.guidelines),
        website: https(row.url),
      },
    ]
  })
}

/** Conservative subset: unsupported SVGs can still be opened at their source page. */
export function assertInertBrandSvg(xml: string): void {
  if (
    xml.length > 1_000_000 ||
    /<!DOCTYPE|<!ENTITY|<\?/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw Error('unsafe-logo-svg')
  const parsed: unknown = new XMLParser({ ignoreAttributes: false, processEntities: true }).parse(
    xml,
  )
  if (!object(parsed) || Object.keys(parsed).length !== 1 || !object(parsed.svg))
    throw Error('unsafe-logo-svg')
  const elements = new Set([
    'svg',
    'g',
    'path',
    'rect',
    'circle',
    'ellipse',
    'polygon',
    'polyline',
    'line',
    'defs',
    'linearGradient',
    'radialGradient',
    'stop',
    'clipPath',
    'mask',
    'title',
    'desc',
    'use',
  ])
  const attrs = new Set([
    'id',
    'class',
    'xmlns',
    'xmlns:xlink',
    'width',
    'height',
    'viewBox',
    'fill',
    'fill-rule',
    'fill-opacity',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit',
    'stroke-dasharray',
    'stroke-dashoffset',
    'stroke-opacity',
    'opacity',
    'transform',
    'd',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'points',
    'offset',
    'stop-color',
    'stop-opacity',
    'gradientUnits',
    'gradientTransform',
    'spreadMethod',
    'fx',
    'fy',
    'clip-path',
    'clip-rule',
    'mask',
    'maskUnits',
    'maskContentUnits',
    'preserveAspectRatio',
    'href',
    'xlink:href',
    'role',
    'aria-hidden',
    'aria-label',
    'focusable',
    'version',
  ])
  const inspect = (node: unknown, depth = 0): void => {
    if (depth > 60) throw Error('unsafe-logo-svg')
    if (Array.isArray(node)) {
      node.forEach((n) => inspect(n, depth + 1))
      return
    }
    if (!object(node)) return
    for (const [key, value] of Object.entries(node)) {
      if (key === '#text') continue
      if (key.startsWith('@_')) {
        const name = key.slice(2)
        const v = String(value)
        if (!attrs.has(name) || [...v].some((c) => c.charCodeAt(0) < 32 || c === '\\'))
          throw Error('unsafe-logo-svg')
        if ((name === 'href' || name === 'xlink:href') && !/^#[a-zA-Z_][\w.-]*$/.test(v))
          throw Error('unsafe-logo-svg')
        if (name === 'xmlns' && v !== 'http://www.w3.org/2000/svg') throw Error('unsafe-logo-svg')
        if (name === 'xmlns:xlink' && v !== 'http://www.w3.org/1999/xlink')
          throw Error('unsafe-logo-svg')
        if (/url\s*\(/i.test(v) && !/^url\(#[a-zA-Z_][\w.-]*\)$/.test(v))
          throw Error('unsafe-logo-svg')
        if (
          /javascript:|data:|https?:|@import|expression\s*\(/i.test(v) &&
          !name.startsWith('xmlns')
        )
          throw Error('unsafe-logo-svg')
      } else {
        if (!elements.has(key)) throw Error('unsafe-logo-svg')
        inspect(value, depth + 1)
      }
    }
  }
  inspect(parsed)
}

export function createBrandLibrary(fetcher: typeof fetch = fetch) {
  let registry: BrandLogo[] | undefined
  return {
    async search(query: string): Promise<BrandLogo[]> {
      if (typeof query !== 'string' || query.length > 80) throw Error('invalid-logo-query')
      registry ??= parseBrandRegistry(
        JSON.parse(
          await readStylePublicFile('https://thesvg.org/api/registry.json', 12_000_000, fetcher),
        ),
      )
      const q = query.trim().toLowerCase()
      if (!q) return []
      return registry
        .filter((r) => [r.title, r.slug, ...r.aliases].join(' ').toLowerCase().includes(q))
        .slice(0, 60)
    },
    async asset(
      id: string,
      variant: string,
    ): Promise<{ svg: string; logo: BrandLogo; source: string }> {
      const logo = registry?.find((r) => r.slug === id)
      if (!slug(id) || !slug(variant) || !logo?.variants.includes(variant))
        throw Error('select-logo-first')
      const source = `https://thesvg.org/icons/${id}/${variant}.svg`
      const svg = await readStylePublicFile(source, 1_000_000, fetcher)
      assertInertBrandSvg(svg)
      return { svg, logo, source }
    },
  }
}
