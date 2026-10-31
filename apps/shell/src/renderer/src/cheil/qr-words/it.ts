/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'Crea QR',
  offline: 'Crea QR su questo PC senza Internet, server o account. Il contenuto non viene inviato.',
  content: 'URL o testo',
  placeholder: 'Inserisci https://example.com o un testo.',
  limit: 'Fino a 1.000 byte UTF-8',
  size: 'Dimensione immagine',
  generate: 'Crea QR',
  invalid: 'Inserisci un contenuto di massimo 1.000 byte.',
  scan: 'Verifica con il telefono prima di condividere. Usa immagini più grandi per testi lunghi.',
  copy: 'Copia immagine',
  savePng: 'Salva PNG',
  empty: 'Inserisci un contenuto e seleziona Crea QR per l’anteprima.',
  static:
    'QR statico senza tracciamento delle visite. Generane uno nuovo per modificare il contenuto.',
} satisfies Record<keyof typeof zh, string>
export default words
