/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const cs = {
  label: 'Šablony pracovních dokumentů',
  add: 'Přidat šablonu',
  adding: 'Přidávání…',
  hint: 'Přidejte soubor Word, PowerPoint nebo Excel (do 50 MB) a jeho kartou vytvořte nový dokument.',
  own: 'Přidáno mnou',
  use: 'Vytvořit dokument',
  loading: 'Načítání uložených šablon…',
  retry: 'Zkusit znovu',
  added: 'Šablona přidána. Její karta otevře novou kopii dokumentu.',
  failed: 'Šablonu nelze načíst. Zkontrolujte soubor a složku úložiště a zkuste to znovu.',
  unreadable: 'Soubor nelze přečíst. Odstraňte DRM nebo heslo a vyberte funkční dokument.',
  tooLarge: 'Vyberte soubor o velikosti nejvýše 50 MB.',
  rename: 'Přejmenovat',
  remove: 'Smazat',
  renameTitle: 'Přejmenovat šablonu dokumentu',
  nameLabel: 'Název šablony',
  nameHint: 'Zadejte pouze nový název. Přípona souboru zůstane zachována.',
  save: 'Uložit',
  cancel: 'Zrušit',
  deleteTitle: 'Smazat tuto šablonu?',
  deleteHint:
    'Registrovaná kopie šablony se přesune do koše. Původní soubor a vytvořené dokumenty zůstanou zachovány.',
  confirmDelete: 'Přesunout do koše',
  renamed: 'Šablona přejmenována.',
  deleted: 'Registrovaná šablona přesunuta do koše.',
  invalidName: 'Neplatný název. Použijte nejvýše 150 znaků bez znaků cesty a vyhrazených názvů.',
  exists: 'Šablona s tímto názvem již existuje. Zvolte jiný název.',
  working: 'Zpracování…',
  changed: 'Šablona byla změněna jinde. Zkuste to znovu z aktualizované karty.',
} satisfies Record<keyof typeof zh, string>
