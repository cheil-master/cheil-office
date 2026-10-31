/** Cheil fork: reusable visual decisions, not OCR boxes or reference artwork. */
export interface DesignReference {
  version: 1
  name: string
  sources: string[]
  palette: { background: string; ink: string; accent: string; secondary: string }
  typography: string
  composition: string
  shapes: string
  avoid: string
  layouts: { cover: string; comparison: string; process: string }
}
const text = (v: unknown, min = 12, max = 2400): string => {
  if (
    typeof v !== 'string' ||
    v.trim().length < min ||
    v.length > max ||
    Array.from(v).some((c) => c.charCodeAt(0) < 9)
  )
    throw Error('invalid-design-reference')
  return v.trim()
}
export function readDesignReference(value: unknown): DesignReference {
  if (!value || typeof value !== 'object') throw Error('invalid-design-reference')
  const v = value as Record<string, unknown>
  if (v.version !== 1) throw Error('invalid-design-reference')
  const p = v.palette as Record<string, unknown> | undefined
  const l = v.layouts as Record<string, unknown> | undefined
  if (!p || !l || !Array.isArray(v.sources) || v.sources.length > 2)
    throw Error('invalid-design-reference')
  const color = (key: string) => {
    if (typeof p[key] !== 'string' || !/^#[\da-f]{6}$/i.test(p[key]))
      throw Error('invalid-design-color')
    return p[key] as string
  }
  return {
    version: 1,
    name: text(v.name, 1, 64),
    sources: v.sources.map((s) => {
      if (typeof s !== 'string' || !/^https:\/\/www\.pinterest\.com\/pin\/\d{1,30}\/$/.test(s))
        throw Error('invalid-design-source')
      return s
    }),
    palette: {
      background: color('background'),
      ink: color('ink'),
      accent: color('accent'),
      secondary: color('secondary'),
    },
    typography: text(v.typography),
    composition: text(v.composition),
    shapes: text(v.shapes),
    avoid: text(v.avoid),
    layouts: { cover: text(l.cover), comparison: text(l.comparison), process: text(l.process) },
  }
}
export function designStyleText(d: DesignReference): string {
  return `# ${d.name}\n\n16:9 / 1280 × 720. Editable native text and shapes.\n\n## Palette\n${Object.entries(
    d.palette,
  )
    .map(([k, v]) => `${k}: ${v}`)
    .join(
      '\n',
    )}\n\n## Typography\n${d.typography}\n\n## Composition and hierarchy\n${d.composition}\n\n## Shape language\n${d.shapes}\n\n## Layout recipes\n### cover_typography_hero / cover_split_color\n${d.layouts.cover}\n\n### two_column_comparison\n${d.layouts.comparison}\n\n### timeline_horizontal\n${d.layouts.process}\n\n## Avoid\n${d.avoid}\n\n## Content adaptation\nChoose the recipe by the meaning of the content. Preserve claims and qualifiers. Never invent facts or metrics. Use the draft's own copy; do not reproduce reference copy, photographs, logos or complete artwork. Keep the same palette, typography and shape language while changing composition by page role. Reserve space for actual text, split dense content instead of reducing body text below 22px. A comparison uses aligned comparable criteria; a process uses explicit ordered steps and connectors. Render, inspect overlap and overflow, and repair before completion.\n`
}
export function designMarkdown(d: DesignReference): string {
  return `${designStyleText(d)}\n## Reference sources\n${d.sources.join('\n') || 'No external source'}\n\n<!-- cheil-design-reference:v1; edit the JSON below to update reusable rules -->\n\`\`\`cheil-design-reference\n${JSON.stringify(d, null, 2)}\n\`\`\`\n`
}
export function readDesignMarkdown(md: string): DesignReference {
  if (md.length > 40000) throw Error('invalid-design-reference')
  const m = md.match(/^```cheil-design-reference\r?\n([\s\S]*?)\r?\n```$/m)
  if (!m) throw Error('invalid-design-reference')
  return readDesignReference(JSON.parse(m[1]))
}
export interface DesignReferenceEntry {
  key: string
  name: string
  createdAt: string
  design: DesignReference
}
