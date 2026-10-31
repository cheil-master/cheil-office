/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const de = {
  label: 'Vorlagen für Arbeitsdokumente',
  add: 'Dokumentvorlage hinzufügen',
  adding: 'Wird hinzugefügt…',
  hint: 'Word-, PowerPoint- oder Excel-Datei (bis 50 MB) hinzufügen und über die Karte ein neues Dokument erstellen.',
  own: 'Von mir hinzugefügt',
  use: 'Neues Dokument erstellen',
  loading: 'Gespeicherte Vorlagen werden geladen…',
  retry: 'Erneut versuchen',
  added: 'Vorlage hinzugefügt. Die Karte öffnet eine neue Dokumentkopie.',
  failed:
    'Vorlage konnte nicht geladen werden. Datei und Speicherordner prüfen und erneut versuchen.',
  unreadable:
    'Datei nicht lesbar. DRM- oder Kennwortschutz entfernen und eine funktionsfähige Datei auswählen.',
  tooLarge: 'Eine Datei mit höchstens 50 MB auswählen.',
  rename: 'Umbenennen',
  remove: 'Löschen',
  renameTitle: 'Dokumentvorlage umbenennen',
  nameLabel: 'Vorlagenname',
  nameHint: 'Nur den neuen Namen eingeben. Die Dateiendung bleibt erhalten.',
  save: 'Speichern',
  cancel: 'Abbrechen',
  deleteTitle: 'Diese Dokumentvorlage löschen?',
  deleteHint:
    'Die registrierte Vorlagenkopie wird in den Papierkorb verschoben. Originaldatei und daraus erstellte Dokumente bleiben erhalten.',
  confirmDelete: 'In den Papierkorb',
  renamed: 'Vorlage umbenannt.',
  deleted: 'Registrierte Vorlage in den Papierkorb verschoben.',
  invalidName:
    'Ungültiger Name. Höchstens 150 Zeichen ohne Pfadzeichen oder reservierte Namen verwenden.',
  exists: 'Eine Vorlage mit diesem Namen ist bereits vorhanden. Einen anderen Namen wählen.',
  working: 'Wird verarbeitet…',
  changed: 'Die Vorlage wurde anderswo geändert. Mit der aktualisierten Karte erneut versuchen.',
} satisfies Record<keyof typeof zh, string>
