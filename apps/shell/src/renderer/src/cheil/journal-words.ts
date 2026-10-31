/** Cheil fork: journal strings in all supported languages. */
import type { Lang } from '@genoffice/i18n'
import ko from './journal-words/ko'
import en from './journal-words/en'
import ja from './journal-words/ja'
import zh from './journal-words/zh'
import zhTW from './journal-words/zh-TW'
import fr from './journal-words/fr'
import de from './journal-words/de'
import es from './journal-words/es'
import pt from './journal-words/pt'
import it from './journal-words/it'
import nl from './journal-words/nl'
import pl from './journal-words/pl'
import cs from './journal-words/cs'
import ru from './journal-words/ru'
import ar from './journal-words/ar'
import he from './journal-words/he'
import hi from './journal-words/hi'
import id from './journal-words/id'
import ms from './journal-words/ms'
import th from './journal-words/th'
import vi from './journal-words/vi'
const words = {
  ko: ko,
  en: en,
  ja: ja,
  zh: zh,
  'zh-TW': zhTW,
  fr: fr,
  de: de,
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
export const journalWords = (lang: Lang) => words[lang]
