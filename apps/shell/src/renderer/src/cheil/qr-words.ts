/** Cheil fork: complete QR strings for every supported language. */
import type { Lang } from '@genoffice/i18n'
import ko from './qr-words/ko'
import en from './qr-words/en'
import ja from './qr-words/ja'
import zh from './qr-words/zh'
import zhTW from './qr-words/zh-TW'
import de from './qr-words/de'
import fr from './qr-words/fr'
import es from './qr-words/es'
import pt from './qr-words/pt'
import it from './qr-words/it'
import nl from './qr-words/nl'
import pl from './qr-words/pl'
import cs from './qr-words/cs'
import ru from './qr-words/ru'
import ar from './qr-words/ar'
import he from './qr-words/he'
import hi from './qr-words/hi'
import id from './qr-words/id'
import ms from './qr-words/ms'
import th from './qr-words/th'
import vi from './qr-words/vi'
const words: Record<Lang, typeof zh> = {
  ko: ko,
  en: en,
  ja: ja,
  zh: zh,
  'zh-TW': zhTW,
  de: de,
  fr: fr,
  es: es,
  pt: pt,
  it: it,
  nl: nl,
  pl: pl,
  cs: cs,
  ru: ru,
  ar: ar,
  he: he,
  hi: hi,
  id: id,
  ms: ms,
  th: th,
  vi: vi,
}
export function qrWords(lang: Lang) {
  return words[lang]
}
