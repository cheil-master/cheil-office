/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'Créer un QR',
  offline: 'Créez des QR sur ce PC sans Internet, serveur ni compte. Aucune saisie n’est envoyée.',
  content: 'URL ou texte',
  placeholder: 'Saisissez https://example.com ou du texte.',
  limit: 'Maximum 1 000 octets UTF-8',
  size: 'Taille de l’image',
  generate: 'Créer le QR',
  invalid: 'Saisissez un contenu de 1 000 octets maximum.',
  scan: 'Testez avec votre téléphone avant de partager. Choisissez une grande image pour un contenu long.',
  copy: 'Copier l’image',
  savePng: 'Enregistrer PNG',
  empty: 'Saisissez un contenu puis créez le QR pour l’aperçu.',
  static: 'QR statique sans suivi des visites. Recréez le code pour modifier son contenu.',
} satisfies Record<keyof typeof zh, string>
export default words
