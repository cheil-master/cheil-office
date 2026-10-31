/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'Vytvořit QR',
  offline: 'Vytvářejte QR v tomto počítači bez internetu, serveru a účtu. Obsah se nikam neposílá.',
  content: 'URL nebo text',
  placeholder: 'Zadejte https://example.com nebo text.',
  limit: 'Nejvýše 1 000 bajtů UTF-8',
  size: 'Velikost obrázku',
  generate: 'Vytvořit QR',
  invalid: 'Zadejte obsah do 1 000 bajtů.',
  scan: 'Před sdílením ověřte telefonem. Pro delší obsah použijte větší obrázek.',
  copy: 'Kopírovat obrázek',
  savePng: 'Uložit PNG',
  empty: 'Zadejte obsah a zvolte Vytvořit QR pro náhled.',
  static: 'Statický QR bez sledování návštěv. Pro změnu obsahu vytvořte nový kód.',
} satisfies Record<keyof typeof zh, string>
export default words
