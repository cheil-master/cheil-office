/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'QR maken',
  offline:
    'Maak QR-codes op deze pc zonder internet, server of account. Invoer wordt niet verzonden.',
  content: 'URL of tekst',
  placeholder: 'Voer https://example.com of tekst in.',
  limit: 'Maximaal 1.000 UTF-8-bytes',
  size: 'Afbeeldingsgrootte',
  generate: 'QR maken',
  invalid: 'Voer inhoud van maximaal 1.000 bytes in.',
  scan: 'Controleer voor het delen met uw telefoon. Gebruik grotere afbeeldingen voor langere inhoud.',
  copy: 'Afbeelding kopiëren',
  savePng: 'PNG opslaan',
  empty: 'Voer inhoud in en kies QR maken voor een voorbeeld.',
  static: 'Statische QR zonder bezoekregistratie. Maak een nieuwe code om de inhoud te wijzigen.',
} satisfies Record<keyof typeof zh, string>
export default words
