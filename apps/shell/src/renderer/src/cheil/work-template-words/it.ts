/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const it = {
  label: 'Modelli di documenti di lavoro',
  add: 'Aggiungi modello',
  adding: 'Aggiunta in corso…',
  hint: 'Aggiungi un file Word, PowerPoint o Excel (fino a 50 MB), poi seleziona la scheda per creare un documento.',
  own: 'Aggiunto da me',
  use: 'Crea documento',
  loading: 'Caricamento dei modelli salvati…',
  retry: 'Riprova',
  added: 'Modello aggiunto. La scheda apre una nuova copia del documento.',
  failed:
    'Impossibile caricare il modello. Controlla il file e la cartella di archiviazione e riprova.',
  unreadable: 'Impossibile leggere il file. Rimuovi DRM o password e scegli un documento valido.',
  tooLarge: 'Scegli un file di massimo 50 MB.',
  rename: 'Rinomina',
  remove: 'Elimina',
  renameTitle: 'Rinomina modello di documento',
  nameLabel: 'Nome del modello',
  nameHint: 'Inserisci solo il nuovo nome. L’estensione rimane invariata.',
  save: 'Salva',
  cancel: 'Annulla',
  deleteTitle: 'Eliminare questo modello?',
  deleteHint:
    'La copia registrata del modello verrà spostata nel Cestino. Il file originale e i documenti creati verranno conservati.',
  confirmDelete: 'Sposta nel Cestino',
  renamed: 'Modello rinominato.',
  deleted: 'Modello registrato spostato nel Cestino.',
  invalidName:
    'Nome non valido. Usa fino a 150 caratteri senza simboli di percorso o nomi riservati.',
  exists: 'Esiste già un modello con questo nome. Scegline un altro.',
  working: 'Elaborazione…',
  changed: 'Il modello è stato modificato altrove. Riprova dalla scheda aggiornata.',
} satisfies Record<keyof typeof zh, string>
