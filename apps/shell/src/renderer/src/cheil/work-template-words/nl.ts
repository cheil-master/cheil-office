/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const nl = {
  label: 'Sjablonen voor werkdocumenten',
  add: 'Documentsjabloon toevoegen',
  adding: 'Toevoegen…',
  hint: 'Voeg een Word-, PowerPoint- of Excel-bestand toe (tot 50 MB) en maak via de kaart een nieuw document.',
  own: 'Door mij toegevoegd',
  use: 'Nieuw document maken',
  loading: 'Opgeslagen sjablonen laden…',
  retry: 'Opnieuw proberen',
  added: 'Sjabloon toegevoegd. De kaart opent een nieuwe documentkopie.',
  failed: 'Sjabloon laden mislukt. Controleer het bestand en de opslagmap en probeer het opnieuw.',
  unreadable:
    'Bestand onleesbaar. Verwijder DRM of wachtwoordbeveiliging en kies een werkend document.',
  tooLarge: 'Kies een bestand van maximaal 50 MB.',
  rename: 'Naam wijzigen',
  remove: 'Verwijderen',
  renameTitle: 'Documentsjabloon hernoemen',
  nameLabel: 'Sjabloonnaam',
  nameHint: 'Voer alleen de nieuwe naam in. De bestandsextensie blijft behouden.',
  save: 'Opslaan',
  cancel: 'Annuleren',
  deleteTitle: 'Dit documentsjabloon verwijderen?',
  deleteHint:
    'De geregistreerde sjabloonkopie gaat naar de Prullenbak. Het originele bestand en gemaakte documenten blijven behouden.',
  confirmDelete: 'Naar Prullenbak',
  renamed: 'Sjabloonnaam gewijzigd.',
  deleted: 'Geregistreerd sjabloon naar de Prullenbak verplaatst.',
  invalidName:
    'Ongeldige naam. Gebruik maximaal 150 tekens zonder padtekens of gereserveerde namen.',
  exists: 'Er bestaat al een sjabloon met deze naam. Kies een andere naam.',
  working: 'Bezig…',
  changed: 'Het sjabloon is elders gewijzigd. Probeer het opnieuw via de vernieuwde kaart.',
} satisfies Record<keyof typeof zh, string>
