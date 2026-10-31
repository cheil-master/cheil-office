import { createI18n, defineStrings, type Lang } from '@genoffice/i18n'

/**
 * Cheil fork: feedback opens the product issue form after manual confirmation.
 * The Help menu and Settings → About open it in the user's browser; the app
 * itself sends nothing. The user writes and submits the issue in the browser.
 */
export const FEEDBACK_SURVEY_URL = 'https://github.com/cheil-master/cheil-office/issues/new'

const zh = {
  menuLabel: '发送反馈',
  dialogTitle: '发送反馈',
  dialogBody: '在 CheilOffice 项目中反馈意见。请在浏览器中自行填写，应用不会发送文档。',
  details: '版本 {version}\n操作系统 {os}\n界面语言 {language}',
  btnOpen: '打开项目',
  btnCancel: '取消',
}

type Keys = Record<keyof typeof zh, string>

export const FEEDBACK_STRINGS = defineStrings({
  zh,
  en: {
    menuLabel: 'Send feedback',
    dialogTitle: 'Send feedback',
    dialogBody:
      'Leave feedback in the CheilOffice project. You write it in the browser; the app does not send your documents.',
    details: 'Version {version}\nOS {os}\nUI language {language}',
    btnOpen: 'Open project',
    btnCancel: 'Cancel',
  } satisfies Keys,
  vi: {
    menuLabel: 'Gửi phản hồi',
    dialogTitle: 'Gửi phản hồi',
    dialogBody:
      'Gửi ý kiến trong dự án CheilOffice qua trình duyệt. Ứng dụng không gửi tài liệu của bạn.',
    details: 'Phiên bản {version}\nHệ thống {os}\nNgôn ngữ {language}',
    btnOpen: 'Mở dự án',
    btnCancel: 'Hủy',
  } satisfies Keys,
  ja: {
    menuLabel: 'フィードバックを送る',
    dialogTitle: 'フィードバックを送る',
    dialogBody:
      'CheilOffice プロジェクトに意見を送れます。ブラウザーで自分で記入し、アプリが文書を送信することはありません。',
    details: 'バージョン {version}\nOS {os}\n表示言語 {language}',
    btnOpen: 'プロジェクトを開く',
    btnCancel: 'キャンセル',
  } satisfies Keys,
  ko: {
    menuLabel: '의견 보내기',
    dialogTitle: '의견 보내기',
    dialogBody:
      'CheilOffice 프로젝트에 의견을 남길 수 있습니다. 브라우저에서 직접 작성하며, 앱이 문서를 전송하지 않습니다.',
    details: '버전 {version}\n운영체제 {os}\n화면 언어 {language}',
    btnOpen: '프로젝트 열기',
    btnCancel: '취소',
  } satisfies Keys,
  fr: {
    menuLabel: 'Envoyer un commentaire',
    dialogTitle: 'Envoyer un commentaire',
    dialogBody:
      "Le questionnaire s'ouvre dans votre navigateur. Les informations ci-dessous sont copiées dans le presse-papiers pour que vous puissiez les coller dans le questionnaire. L'application n'envoie rien elle-même et le contenu des documents n'est jamais inclus.",
    details: 'Version {version}\nSystème {os}\nLangue {language}',
    btnOpen: 'Ouvrir le projet',
    btnCancel: 'Annuler',
  } satisfies Keys,
  de: {
    menuLabel: 'Feedback senden',
    dialogTitle: 'Feedback senden',
    dialogBody:
      'Geben Sie Feedback im CheilOffice-Projekt über den Browser. Die App versendet keine Dokumente.',
    details: 'Version {version}\nBetriebssystem {os}\nSprache {language}',
    btnOpen: 'Projekt öffnen',
    btnCancel: 'Abbrechen',
  } satisfies Keys,
  es: {
    menuLabel: 'Enviar comentarios',
    dialogTitle: 'Enviar comentarios',
    dialogBody:
      'Deje comentarios en el proyecto CheilOffice desde el navegador. La aplicación no envía sus documentos.',
    details: 'Versión {version}\nSistema {os}\nIdioma {language}',
    btnOpen: 'Abrir proyecto',
    btnCancel: 'Cancelar',
  } satisfies Keys,
  th: {
    menuLabel: 'ส่งข้อเสนอแนะ',
    dialogTitle: 'ส่งข้อเสนอแนะ',
    dialogBody: 'แสดงความคิดเห็นในโครงการ CheilOffice ผ่านเบราว์เซอร์ แอปจะไม่ส่งเอกสารของคุณ',
    details: 'เวอร์ชัน {version}\nระบบ {os}\nภาษา {language}',
    btnOpen: 'เปิดโครงการ',
    btnCancel: 'ยกเลิก',
  } satisfies Keys,
  id: {
    menuLabel: 'Kirim masukan',
    dialogTitle: 'Kirim masukan',
    dialogBody:
      'Berikan masukan di proyek CheilOffice melalui peramban. Aplikasi tidak mengirim dokumen Anda.',
    details: 'Versi {version}\nSistem {os}\nBahasa {language}',
    btnOpen: 'Buka proyek',
    btnCancel: 'Batal',
  } satisfies Keys,
  ru: {
    menuLabel: 'Отправить отзыв',
    dialogTitle: 'Отправить отзыв',
    dialogBody:
      'Оставьте отзыв в проекте CheilOffice через браузер. Приложение не отправляет ваши документы.',
    details: 'Версия {version}\nСистема {os}\nЯзык {language}',
    btnOpen: 'Открыть проект',
    btnCancel: 'Отмена',
  } satisfies Keys,
  ar: {
    menuLabel: 'إرسال ملاحظات',
    dialogTitle: 'إرسال ملاحظات',
    dialogBody: 'اكتب ملاحظاتك في مشروع CheilOffice من المتصفح. لا يرسل التطبيق مستنداتك.',
    details: 'الإصدار {version}\nالنظام {os}\nاللغة {language}',
    btnOpen: 'فتح المشروع',
    btnCancel: 'إلغاء',
  } satisfies Keys,
  pt: {
    menuLabel: 'Enviar comentários',
    dialogTitle: 'Enviar comentários',
    dialogBody:
      'Envie comentários ao projeto CheilOffice pelo navegador. O aplicativo não envia seus documentos.',
    details: 'Versão {version}\nSistema {os}\nIdioma {language}',
    btnOpen: 'Abrir projeto',
    btnCancel: 'Cancelar',
  } satisfies Keys,
  it: {
    menuLabel: 'Invia feedback',
    dialogTitle: 'Invia feedback',
    dialogBody:
      "Il sondaggio si apre nel browser. I dati qui sotto vengono copiati negli appunti per poterli incollare nel sondaggio. L'app non invia nulla da sola e il contenuto dei documenti non viene mai incluso.",
    details: 'Versione {version}\nSistema {os}\nLingua {language}',
    btnOpen: 'Apri progetto',
    btnCancel: 'Annulla',
  } satisfies Keys,
  pl: {
    menuLabel: 'Wyślij opinię',
    dialogTitle: 'Wyślij opinię',
    dialogBody:
      'Dodaj opinię w projekcie CheilOffice przez przeglądarkę. Aplikacja nie wysyła dokumentów.',
    details: 'Wersja {version}\nSystem {os}\nJęzyk {language}',
    btnOpen: 'Otwórz projekt',
    btnCancel: 'Anuluj',
  } satisfies Keys,
  cs: {
    menuLabel: 'Odeslat zpětnou vazbu',
    dialogTitle: 'Odeslat zpětnou vazbu',
    dialogBody:
      'Zanechte názor v projektu CheilOffice v prohlížeči. Aplikace neposílá vaše dokumenty.',
    details: 'Verze {version}\nSystém {os}\nJazyk {language}',
    btnOpen: 'Otevřít projekt',
    btnCancel: 'Zrušit',
  } satisfies Keys,
  nl: {
    menuLabel: 'Feedback sturen',
    dialogTitle: 'Feedback sturen',
    dialogBody:
      'Geef feedback in het CheilOffice-project via de browser. De app verstuurt uw documenten niet.',
    details: 'Versie {version}\nSysteem {os}\nTaal {language}',
    btnOpen: 'Project openen',
    btnCancel: 'Annuleren',
  } satisfies Keys,
  ms: {
    menuLabel: 'Hantar maklum balas',
    dialogTitle: 'Hantar maklum balas',
    dialogBody:
      'Beri maklum balas dalam projek CheilOffice melalui pelayar. Aplikasi tidak menghantar dokumen anda.',
    details: 'Versi {version}\nSistem {os}\nBahasa {language}',
    btnOpen: 'Buka projek',
    btnCancel: 'Batal',
  } satisfies Keys,
  he: {
    menuLabel: 'שליחת משוב',
    dialogTitle: 'שליחת משוב',
    dialogBody: 'כתבו משוב בפרויקט CheilOffice בדפדפן. היישום אינו שולח את המסמכים שלכם.',
    details: 'גרסה {version}\nמערכת {os}\nשפה {language}',
    btnOpen: 'פתיחת הפרויקט',
    btnCancel: 'ביטול',
  } satisfies Keys,
  hi: {
    menuLabel: 'फ़ीडबैक भेजें',
    dialogTitle: 'फ़ीडबैक भेजें',
    dialogBody:
      'ब्राउज़र में CheilOffice प्रोजेक्ट पर प्रतिक्रिया लिखें। ऐप आपके दस्तावेज़ नहीं भेजता।',
    details: 'संस्करण {version}\nसिस्टम {os}\nभाषा {language}',
    btnOpen: 'प्रोजेक्ट खोलें',
    btnCancel: 'रद्द करें',
  } satisfies Keys,
  'zh-TW': {
    menuLabel: '傳送意見回饋',
    dialogTitle: '傳送意見回饋',
    dialogBody: '在 CheilOffice 專案中提供意見。請在瀏覽器中自行填寫，應用程式不會傳送文件。',
    details: '版本 {version}\n作業系統 {os}\n介面語言 {language}',
    btnOpen: '開啟專案',
    btnCancel: '取消',
  } satisfies Keys,
})

export const feedbackText = createI18n(FEEDBACK_STRINGS)

export interface FeedbackEnvironment {
  version: string
  os: string
  language: string
}

/** `Windows`, `macOS`, `Linux`; anything else is shown as the platform names itself. */
export function platformLabel(platform: string): string {
  if (platform === 'win32') return 'Windows'
  if (platform === 'darwin') return 'macOS'
  if (platform === 'linux') return 'Linux'
  return platform
}

/** The block copied to the clipboard: version, OS and UI language, nothing else. */
export function feedbackDetails(lang: Lang, env: FeedbackEnvironment): string {
  return feedbackText(lang, 'details', {
    version: env.version,
    os: env.os,
    language: env.language,
  })
}
