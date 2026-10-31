/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const pl = {
  label: 'Szablony dokumentów służbowych',
  add: 'Dodaj szablon dokumentu',
  adding: 'Dodawanie…',
  hint: 'Dodaj plik Word, PowerPoint lub Excel (do 50 MB), a następnie wybierz kartę, aby utworzyć dokument.',
  own: 'Dodane przeze mnie',
  use: 'Utwórz nowy dokument',
  loading: 'Wczytywanie zapisanych szablonów…',
  retry: 'Spróbuj ponownie',
  added: 'Szablon dodany. Wybierz kartę, aby otworzyć nową kopię dokumentu.',
  failed:
    'Nie można wczytać szablonu. Sprawdź plik i folder przechowywania, a następnie spróbuj ponownie.',
  unreadable: 'Nie można odczytać pliku. Usuń DRM lub hasło i wybierz poprawny dokument.',
  tooLarge: 'Wybierz plik o rozmiarze do 50 MB.',
  rename: 'Zmień nazwę',
  remove: 'Usuń',
  renameTitle: 'Zmień nazwę szablonu dokumentu',
  nameLabel: 'Nazwa szablonu',
  nameHint: 'Wpisz tylko nową nazwę. Rozszerzenie pliku zostanie zachowane.',
  save: 'Zapisz',
  cancel: 'Anuluj',
  deleteTitle: 'Usunąć ten szablon dokumentu?',
  deleteHint:
    'Zarejestrowana kopia szablonu trafi do Kosza. Plik źródłowy i utworzone dokumenty zostaną zachowane.',
  confirmDelete: 'Przenieś do Kosza',
  renamed: 'Nazwa szablonu zmieniona.',
  deleted: 'Zarejestrowany szablon przeniesiony do Kosza.',
  invalidName: 'Nieprawidłowa nazwa. Użyj do 150 znaków bez symboli ścieżki i nazw zastrzeżonych.',
  exists: 'Szablon o tej nazwie już istnieje. Wybierz inną nazwę.',
  working: 'Przetwarzanie…',
  changed: 'Szablon zmieniono w innym miejscu. Spróbuj ponownie z odświeżonej karty.',
} satisfies Record<keyof typeof zh, string>
