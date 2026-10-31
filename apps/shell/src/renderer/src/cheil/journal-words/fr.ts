/** Cheil fork: journal interface strings. */
import type zh from './zh'
export default {
  title: 'Journal de travail LLM',
  intro:
    'Continuez sur ChatGPT et Claude web et conservez de brèves notes de questions et réponses.',
  local:
    'Extraits locaux · aucun appel IA supplémentaire · nouvelles questions seulement · heure de Corée',
  start: 'Démarrer',
  stop: 'Arrêter',
  since: 'Début du suivi',
  connection: 'Extension connectée',
  received: 'Collecté',
  signIn: 'Connectez-vous dans Chrome',
  failed: 'Échec de connexion ou de sauvegarde',
  waiting: 'En attente',
  unavailable: 'Le récepteur ne démarre pas. Vérifiez les autres instances.',
  setup: 'Connecter l’extension Chrome (une fois)',
  step1: 'Ouvrez le dossier et chargez l’extension décompressée dans chrome://extensions.',
  step2:
    'Cliquez sur Connecter, puis approuvez dans l’application affichant le même code à six chiffres. Aucun copier-coller.',
  step3: 'Connectez puis démarrez. Collecte toutes les 5 minutes ou sur demande.',
  extension: 'Dossier de l’extension',
  copy: 'Copier la connexion',
  copied: 'Connexion copiée.',
  day: 'Date',
  open: 'Ouvrir MD',
  folder: 'Dossier de stockage',
  empty: 'Aucune note. Démarrez et posez une nouvelle question sur le web.',
  question: 'Question',
  answer: 'Extrait de réponse',
  connect: 'Connecter',
  sync: 'Collecter maintenant',
  paired: 'Connecté à l’application.',
  paused: 'Suivi en pause',
} satisfies Record<keyof typeof zh, string>
