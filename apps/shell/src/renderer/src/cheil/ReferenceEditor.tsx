/** Cheil fork: edit executable regions and preview the actual content binding. */
import { useState } from 'react'
import { useI18n } from '../locale'
import { referenceWords } from './reference-words'
import {
  planReference,
  referenceSize,
  type ReferenceTemplate,
  type ReferenceRegion,
} from '../../../shared/reference-template'
import type { StyleSelection } from '../../../shared/cheil-style-api'
export function ReferenceEditor({
  template,
  choice,
  title,
  body,
  disabled,
  onChange,
}: {
  template: ReferenceTemplate
  choice: StyleSelection
  title: string
  body: string
  disabled: boolean
  onChange(t: ReferenceTemplate): void
}) {
  const { lang } = useI18n(),
    w = referenceWords(lang),
    [pageIndex, setPageIndex] = useState(0)
  let error = false,
    pages: ReturnType<typeof planReference> = []
  try {
    pages = planReference(template, choice, title, body)
  } catch {
    error = true
  }
  const size = referenceSize(template),
    index = Math.min(pageIndex, Math.max(0, pages.length - 1))
  const color = {
    accent: choice.accent ?? '#315C4C',
    text: choice.text ?? '#202020',
    background: choice.background ?? '#FFFFFF',
    none: 'none',
  }
  const update = (id: string, change: Partial<ReferenceRegion>) =>
    onChange({
      ...template,
      regions: template.regions.map((r) =>
        r.id === id
          ? { ...r, ...change, evidence: 'edited' }
          : change.role === 'title' && r.role === 'title'
            ? { ...r, role: 'body', evidence: 'edited' }
            : r,
      ),
    })
  return (
    <section className="cheil-reference" data-testid="reference-editor">
      <strong>{w.structure}</strong>
      <p className="cheil-style-hint">{w.hint}</p>
      {error ? (
        <p role="alert">{w.invalid}</p>
      ) : (
        <>
          <svg
            data-testid="reference-preview"
            viewBox={`0 0 ${size.width} ${size.height}`}
            role="img"
            aria-label={w.structure}
            style={{ background: color.background, width: '100%', maxHeight: 620 }}
          >
            {pages[index]?.elements.map(({ region: r, lines, fontPt }) => {
              const x = r.x * size.width,
                y = r.y * size.height,
                bw = r.w * size.width,
                bh = r.h * size.height
              return (
                <g key={r.id}>
                  {r.geometry === 'ellipse' ? (
                    <ellipse
                      cx={x + bw / 2}
                      cy={y + bh / 2}
                      rx={bw / 2}
                      ry={bh / 2}
                      fill={color[r.fill]}
                      fillOpacity={r.role === 'decoration' ? 0.15 : 1}
                      stroke={r.role === 'decoration' ? 'none' : color.accent}
                    />
                  ) : r.geometry !== 'none' ? (
                    <rect
                      x={x}
                      y={y}
                      width={bw}
                      height={bh}
                      rx={r.geometry === 'roundRect' ? Math.min(18, bh / 4) : 0}
                      fill={color[r.fill]}
                      fillOpacity={r.role === 'decoration' ? 0.15 : 1}
                      stroke={r.role === 'decoration' ? 'none' : color.accent}
                    />
                  ) : null}
                  {lines.map((line, j) => (
                    <text
                      key={j}
                      x={
                        r.align === 'center' ? x + bw / 2 : r.align === 'right' ? x + bw - 8 : x + 8
                      }
                      y={y + 6 + fontPt + j * fontPt * 1.3}
                      fontFamily={choice.font ?? 'Arial'}
                      fontSize={fontPt}
                      fontWeight={r.role === 'title' ? 700 : 400}
                      textAnchor={
                        r.align === 'center' ? 'middle' : r.align === 'right' ? 'end' : 'start'
                      }
                      fill={
                        r.fill === 'accent'
                          ? color.background
                          : r.role === 'title'
                            ? color.accent
                            : color.text
                      }
                    >
                      {line}
                    </text>
                  ))}
                </g>
              )
            })}
          </svg>
          <div className="cheil-style-toolbar">
            <button disabled={index === 0} onClick={() => setPageIndex(index - 1)}>
              {w.previous}
            </button>
            <span>
              {index + 1} / {pages.length}
            </span>
            <button disabled={index + 1 >= pages.length} onClick={() => setPageIndex(index + 1)}>
              {w.next}
            </button>
          </div>
        </>
      )}
      <details>
        <summary>{w.edit}</summary>
        <div className="cheil-reference-regions">
          {template.regions.map((r) => (
            <fieldset key={r.id} disabled={disabled}>
              <legend>{r.id}</legend>
              <label>
                {w.structure}
                <select
                  aria-label={`${r.id} role`}
                  value={r.role}
                  onChange={(e) =>
                    update(r.id, { role: e.target.value as ReferenceRegion['role'] })
                  }
                >
                  {(['title', 'body', 'label', 'decoration'] as const).map((v) => (
                    <option key={v} value={v}>
                      {w[v]}
                    </option>
                  ))}
                </select>
              </label>
              {(['x', 'y', 'w', 'h'] as const).map((k) => (
                <label key={k}>
                  {k} %
                  <input
                    aria-label={`${r.id} ${k}`}
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={Math.round(r[k] * 1000) / 10}
                    onChange={(e) => update(r.id, { [k]: Number(e.target.value) / 100 })}
                  />
                </label>
              ))}
              <label>
                {w.shape}
                <select
                  value={r.geometry}
                  onChange={(e) =>
                    update(r.id, { geometry: e.target.value as ReferenceRegion['geometry'] })
                  }
                >
                  {(['none', 'rect', 'roundRect', 'ellipse'] as const).map((v) => (
                    <option key={v} value={v}>
                      {w[v]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {w.alignment}
                <select
                  value={r.align}
                  onChange={(e) =>
                    update(r.id, { align: e.target.value as ReferenceRegion['align'] })
                  }
                >
                  {(['left', 'center', 'right'] as const).map((v) => (
                    <option key={v} value={v}>
                      {w[v]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {w.fill}
                <select
                  value={r.fill}
                  onChange={(e) =>
                    update(r.id, { fill: e.target.value as ReferenceRegion['fill'] })
                  }
                >
                  {(['none', 'accent', 'background'] as const).map((v) => (
                    <option key={v} value={v}>
                      {w[v]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {w.scale}
                <input
                  type="number"
                  min={0.5}
                  max={4}
                  step={0.1}
                  value={r.scale}
                  onChange={(e) => update(r.id, { scale: Number(e.target.value) })}
                />
              </label>
              <button
                disabled={r.role === 'title' || template.regions.length <= 2}
                onClick={() =>
                  onChange({ ...template, regions: template.regions.filter((x) => x.id !== r.id) })
                }
              >
                {w.remove}
              </button>
            </fieldset>
          ))}
        </div>
        <button
          disabled={disabled || template.regions.length >= 24}
          onClick={() =>
            onChange({
              ...template,
              regions: [
                ...template.regions,
                {
                  id: `region-${Date.now()}`,
                  role: 'body',
                  x: 0.08,
                  y: 0.55,
                  w: 0.84,
                  h: 0.3,
                  geometry: 'roundRect',
                  align: 'left',
                  scale: 1,
                  fill: 'background',
                  evidence: 'edited',
                },
              ],
            })
          }
        >
          {w.add}
        </button>
      </details>
    </section>
  )
}
