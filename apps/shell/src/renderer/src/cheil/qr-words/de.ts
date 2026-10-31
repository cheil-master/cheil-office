/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'QR erstellen',
  offline:
    'QR-Codes lokal ohne Internet, Server oder Konto erstellen. Eingaben werden nicht versendet.',
  content: 'URL oder Text',
  placeholder: 'https://example.com oder Text eingeben.',
  limit: 'Bis zu 1.000 UTF-8-Bytes',
  size: 'Bildgröße',
  generate: 'QR erstellen',
  invalid: 'Inhalt mit höchstens 1.000 Bytes eingeben.',
  scan: 'Vor dem Teilen mit dem Handy prüfen. Für längere Inhalte größere Bilder speichern.',
  copy: 'Bild kopieren',
  savePng: 'PNG speichern',
  empty: 'Inhalt eingeben und QR erstellen wählen.',
  static: 'Statischer QR-Code ohne Besuchsstatistik. Bei Änderungen einen neuen Code erstellen.',
} satisfies Record<keyof typeof zh, string>
export default words
