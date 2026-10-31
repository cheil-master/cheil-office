/** Cheil fork: reusable document appearance, with no source document body. */
export type StyleBasis = 'direct' | 'theme'
export interface StyleToken {
  value: string
  count: number
  basis: StyleBasis
}
export interface DocumentStyle {
  template?: import('./reference-template').ReferenceTemplate
  version: 1
  name: string
  format: 'pptx' | 'docx' | 'xlsx' | 'catalog' | 'moodboard'
  fonts: StyleToken[]
  colors: StyleToken[]
  sizes: StyleToken[]
  shapes: StyleToken[]
  moodboard?: { sampledPins: number; previewPins: number; totalPins: number; sampledAt: string }
  warnings: string[]
  source: {
    sha256?: string
    url?: string
    revision?: string
    author?: string
    license?: string
    licenseUrl?: string
    modified?: boolean
  }
}
export interface StyleSelection {
  font?: string
  headingPt?: number
  bodyPt?: number
  accent?: string
  text?: string
  background?: string
}

export interface SavedStyle {
  id: string
  version: string
  updatedAt: string
  profile: DocumentStyle
  selection: StyleSelection
}
export interface StyleDraft {
  id: string
  profile: DocumentStyle
  selection: StyleSelection
}
export interface LogoResult {
  slug: string
  title: string
  variants: string[]
  license: string
  guidelines?: string
}
import type { PinterestRequest, PinterestState } from './cheil-pinterest-api'
export type StyleRequest =
  | PinterestRequest
  | { op: 'designList' }
  | { op: 'designImport' }
  | { op: 'designOpen'; key: string }
  | ({ op: 'designCreate' } & import('../main/cheil/design-studio').DesignStart)
  | { op: 'list' }
  | { op: 'extract' }
  | { op: 'referenceImage' }
  | { op: 'draftText' }
  | { op: 'import' }
  | { op: 'load'; id: string }
  | {
      op: 'save'
      draft: string
      name: string
      selection: StyleSelection
      template?: import('./reference-template').ReferenceTemplate
      id?: string
      version?: string
    }
  | { op: 'open'; id: string }
  | {
      op: 'export' | 'instruction'
      draft: string
      name: string
      selection: StyleSelection
      template?: import('./reference-template').ReferenceTemplate
    }
  | {
      template?: import('./reference-template').ReferenceTemplate
      op: 'create'
      draft: string
      name: string
      selection: StyleSelection
      format: 'docx' | 'pptx' | 'xlsx'
      title: string
      body: string
    }
  | { op: 'catalogSearch'; query: string }
  | { op: 'catalogLoad'; slug: string }
  | { op: 'logoSearch'; query: string }
  | {
      op: 'logoAsset' | 'logoSource' | 'logoSave'
      slug: string
      variant?: string
      accepted?: boolean
    }
export type StyleReply =
  | {
      ok: true
      designs?: import('../../../slides/src/shared/design-reference').DesignReferenceEntry[]
      pinterest?: PinterestState
      saved?: SavedStyle
      styles?: SavedStyle[]
      draft?: StyleDraft
      canceled?: boolean
      text?: string
      entries?: Array<{ slug: string; name: string }>
      logos?: LogoResult[]
      svg?: string
      opened?: boolean
    }
  | {
      ok: false
      reason: 'failed' | 'invalid' | 'conflict' | 'unreadable' | 'unavailable' | 'unsupported'
    }
export interface CheilStyleApi {
  request(req: StyleRequest): Promise<StyleReply>
}
export const CHEIL_STYLE_CHANNEL = 'cheil:styles'
export const CHEIL_STYLE_BRIDGE = 'aiOfficeCheilStyles'
