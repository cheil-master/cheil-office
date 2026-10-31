/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'Utwórz QR',
  offline:
    'Twórz kody QR na tym komputerze bez internetu, serwera i konta. Treść nie jest wysyłana.',
  content: 'URL lub tekst',
  placeholder: 'Wpisz https://example.com lub tekst.',
  limit: 'Maksymalnie 1000 bajtów UTF-8',
  size: 'Rozmiar obrazu',
  generate: 'Utwórz QR',
  invalid: 'Wpisz treść do 1000 bajtów.',
  scan: 'Przed udostępnieniem sprawdź telefonem. Dla dłuższej treści zapisz większy obraz.',
  copy: 'Kopiuj obraz',
  savePng: 'Zapisz PNG',
  empty: 'Wpisz treść i wybierz Utwórz QR, aby zobaczyć podgląd.',
  static: 'Statyczny QR bez śledzenia odwiedzin. Zmiana treści wymaga nowego kodu.',
} satisfies Record<keyof typeof zh, string>
export default words
