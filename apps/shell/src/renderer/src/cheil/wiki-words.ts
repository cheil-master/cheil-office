/** Cheil fork: complete wiki dictionary in all supported languages. */
import type { Lang } from '@genoffice/i18n'
import ko from './wiki-words/ko'
import en from './wiki-words/en'
import zh from './wiki-words/zh'
import zhTW from './wiki-words/zh-TW'
import ja from './wiki-words/ja'
import fr from './wiki-words/fr'
import de from './wiki-words/de'
import es from './wiki-words/es'
import it from './wiki-words/it'
import pt from './wiki-words/pt'
import nl from './wiki-words/nl'
import pl from './wiki-words/pl'
import cs from './wiki-words/cs'
import ru from './wiki-words/ru'
import id from './wiki-words/id'
import ms from './wiki-words/ms'
import vi from './wiki-words/vi'
import hi from './wiki-words/hi'
import ar from './wiki-words/ar'
import he from './wiki-words/he'
import th from './wiki-words/th'
const WORDS: Record<Lang, typeof zh> = {
  ko,
  en,
  zh,
  'zh-TW': zhTW,
  ja,
  fr,
  de,
  es,
  it,
  pt,
  nl,
  pl,
  cs,
  ru,
  id,
  ms,
  vi,
  hi,
  ar,
  he,
  th,
}
export const wikiWords = (lang: Lang) => WORDS[lang]
