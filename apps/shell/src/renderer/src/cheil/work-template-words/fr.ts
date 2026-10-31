/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const fr = {
  label: 'Modèles de documents professionnels',
  add: 'Ajouter un modèle',
  adding: 'Ajout en cours…',
  hint: 'Ajoutez un fichier Word, PowerPoint ou Excel (50 Mo maximum), puis utilisez sa carte pour créer un document.',
  own: 'Ajouté par moi',
  use: 'Créer un document',
  loading: 'Chargement des modèles enregistrés…',
  retry: 'Réessayer',
  added: 'Modèle ajouté. Sa carte ouvre une nouvelle copie du document.',
  failed:
    'Impossible de charger le modèle. Vérifiez le fichier et le dossier de stockage, puis réessayez.',
  unreadable:
    'Fichier illisible. Retirez la protection DRM ou le mot de passe et choisissez un document valide.',
  tooLarge: 'Choisissez un fichier de 50 Mo maximum.',
  rename: 'Renommer',
  remove: 'Supprimer',
  renameTitle: 'Renommer le modèle de document',
  nameLabel: 'Nom du modèle',
  nameHint: 'Saisissez uniquement le nouveau nom. L’extension est conservée.',
  save: 'Enregistrer',
  cancel: 'Annuler',
  deleteTitle: 'Supprimer ce modèle de document ?',
  deleteHint:
    'La copie enregistrée du modèle sera déplacée vers la corbeille. Le fichier original et les documents créés seront conservés.',
  confirmDelete: 'Déplacer vers la corbeille',
  renamed: 'Modèle renommé.',
  deleted: 'Modèle enregistré déplacé vers la corbeille.',
  invalidName:
    'Nom invalide. Utilisez au maximum 150 caractères sans symboles de chemin ni noms réservés.',
  exists: 'Un modèle porte déjà ce nom. Choisissez un autre nom.',
  working: 'Traitement…',
  changed: 'Le modèle a été modifié ailleurs. Réessayez depuis la carte actualisée.',
} satisfies Record<keyof typeof zh, string>
