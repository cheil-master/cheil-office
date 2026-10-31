/** Cheil fork: complete language coverage for the work-template catalog. */
import type { Lang } from '@genoffice/i18n'
import { ko } from './work-template-words/ko'
import { en } from './work-template-words/en'
import { zh } from './work-template-words/zh'
import { zhTW } from './work-template-words/zh-TW'
import { ja } from './work-template-words/ja'
import { de } from './work-template-words/de'
import { fr } from './work-template-words/fr'
import { es } from './work-template-words/es'
import { it } from './work-template-words/it'
import { pt } from './work-template-words/pt'
import { ru } from './work-template-words/ru'
import { ar } from './work-template-words/ar'
import { he } from './work-template-words/he'
import { hi } from './work-template-words/hi'
import { id } from './work-template-words/id'
import { ms } from './work-template-words/ms'
import { th } from './work-template-words/th'
import { vi } from './work-template-words/vi'
import { cs } from './work-template-words/cs'
import { nl } from './work-template-words/nl'
import { pl } from './work-template-words/pl'

const words: Record<Lang, typeof zh> = {
  ko,
  en,
  zh,
  'zh-TW': zhTW,
  ja,
  de,
  fr,
  es,
  it,
  pt,
  ru,
  ar,
  he,
  hi,
  id,
  ms,
  th,
  vi,
  cs,
  nl,
  pl,
}
export const workTemplateWords = (lang: Lang) => words[lang]
