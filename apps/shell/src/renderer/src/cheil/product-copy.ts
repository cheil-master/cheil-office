/** Cheil fork: product-specific onboarding, support and connection language. */
import type { Lang } from '@genoffice/i18n'
import type { strings } from '../strings'

type Copy = {
  tagline: string
  welcome: string
  offline: string
  ai: string
  programs: string
  additional: string
  additionalBody: string
  developer: string
  manual: string
  feedback: string
}
export const PRODUCT_COPY: Record<Lang, Copy> = {
  ko: {
    tagline: '캠페인 문서와 자료를 한곳에',
    welcome:
      '캠페인을 만들고 양식으로 문서를 작성하세요. 자료는 지식베이스에서 다시 찾을 수 있습니다. AI는 필요한 작업에 연결해 사용합니다.',
    offline: '문서 작성과 자료 검색은 바로 시작할 수 있습니다. AI가 필요하면 설정에서 연결하세요.',
    ai: 'AI 연결',
    programs: '이 PC의 AI 프로그램 연결',
    additional: '추가 AI 연결',
    additionalBody: '다른 제공자를 연결할 수 있습니다. 이용 조건과 비용은 제공자별로 확인하세요.',
    developer: '개발자 도구',
    manual: '새 버전은 CheilOffice 설치 파일로 제공합니다. 자동 업데이트는 사용하지 않습니다.',
    feedback:
      'CheilOffice 프로젝트에 의견을 남길 수 있습니다. 브라우저에서 직접 작성하며, 앱이 문서를 전송하지 않습니다.',
  },
  en: {
    tagline: 'Campaign documents and materials, together',
    welcome:
      'Create a campaign and start documents from templates. Find your materials in the knowledge base. Connect AI for tasks that need it.',
    offline: 'Start writing and finding materials now. Connect AI in Settings when needed.',
    ai: 'AI connections',
    programs: 'AI programs on this computer',
    additional: 'More AI connections',
    additionalBody: 'Connect another provider. Check its usage terms and costs.',
    developer: 'Developer tools',
    manual: 'New versions are supplied as CheilOffice installers. Automatic updates are disabled.',
    feedback:
      'Leave feedback in the CheilOffice project. You write it in the browser; the app does not send your documents.',
  },
  zh: {
    tagline: '集中管理活动文档与资料',
    welcome: '创建活动并使用模板编写文档。在知识库中查找资料，需要时再连接 AI。',
    offline: '现在即可编写文档和查找资料。需要 AI 时在设置中连接。',
    ai: 'AI 连接',
    programs: '此电脑上的 AI 程序',
    additional: '更多 AI 连接',
    additionalBody: '可连接其他提供商。请确认其使用条件和费用。',
    developer: '开发者工具',
    manual: '新版本通过 CheilOffice 安装包提供，自动更新已停用。',
    feedback: '在 CheilOffice 项目中反馈意见。请在浏览器中自行填写，应用不会发送文档。',
  },
  'zh-TW': {
    tagline: '集中管理活動文件與資料',
    welcome: '建立活動並使用範本撰寫文件。在知識庫中尋找資料，需要時再連接 AI。',
    offline: '現在即可撰寫文件和尋找資料。需要 AI 時在設定中連接。',
    ai: 'AI 連線',
    programs: '此電腦上的 AI 程式',
    additional: '更多 AI 連線',
    additionalBody: '可連接其他供應商。請確認其使用條件和費用。',
    developer: '開發者工具',
    manual: '新版本透過 CheilOffice 安裝程式提供，自動更新已停用。',
    feedback: '在 CheilOffice 專案中提供意見。請在瀏覽器中自行填寫，應用程式不會傳送文件。',
  },
  ja: {
    tagline: 'キャンペーン文書と資料を一か所に',
    welcome:
      'キャンペーンを作成し、テンプレートで文書を作りましょう。資料はナレッジベースで検索できます。必要な作業に AI を接続します。',
    offline: '文書作成と資料検索はすぐに始められます。AI が必要なときに設定で接続してください。',
    ai: 'AI 接続',
    programs: 'この PC の AI プログラム',
    additional: '追加の AI 接続',
    additionalBody: '別の提供元を接続できます。利用条件と費用を確認してください。',
    developer: '開発者ツール',
    manual: '新しいバージョンは CheilOffice インストーラーで提供します。自動更新は無効です。',
    feedback:
      'CheilOffice プロジェクトに意見を送れます。ブラウザーで自分で記入し、アプリが文書を送信することはありません。',
  },
  fr: {
    tagline: 'Documents et ressources de campagne réunis',
    welcome:
      'Créez une campagne et rédigez à partir de modèles. Retrouvez vos ressources dans la base de connaissances. Connectez une IA si nécessaire.',
    offline:
      'Commencez à rédiger et à chercher vos ressources. Connectez une IA dans les paramètres si nécessaire.',
    ai: 'Connexions IA',
    programs: 'Programmes IA sur cet ordinateur',
    additional: 'Autres connexions IA',
    additionalBody: 'Connectez un autre fournisseur. Vérifiez ses conditions et ses tarifs.',
    developer: 'Outils de développement',
    manual:
      'Les nouvelles versions sont fournies par les installateurs CheilOffice. Les mises à jour automatiques sont désactivées.',
    feedback:
      'Laissez un avis dans le projet CheilOffice depuis le navigateur. L’application n’envoie pas vos documents.',
  },
  de: {
    tagline: 'Kampagnendokumente und Materialien an einem Ort',
    welcome:
      'Erstellen Sie eine Kampagne und Dokumente aus Vorlagen. Finden Sie Materialien in der Wissensbasis. Verbinden Sie bei Bedarf eine KI.',
    offline:
      'Sie können sofort schreiben und Materialien suchen. Verbinden Sie eine KI bei Bedarf in den Einstellungen.',
    ai: 'KI-Verbindungen',
    programs: 'KI-Programme auf diesem Computer',
    additional: 'Weitere KI-Verbindungen',
    additionalBody:
      'Verbinden Sie einen anderen Anbieter. Prüfen Sie dessen Bedingungen und Kosten.',
    developer: 'Entwicklerwerkzeuge',
    manual:
      'Neue Versionen werden als CheilOffice-Installationsdateien bereitgestellt. Automatische Updates sind deaktiviert.',
    feedback:
      'Geben Sie Feedback im CheilOffice-Projekt über den Browser. Die App versendet keine Dokumente.',
  },
  es: {
    tagline: 'Documentos y materiales de campaña, juntos',
    welcome:
      'Cree una campaña y documentos a partir de plantillas. Busque materiales en la base de conocimiento. Conecte una IA cuando la necesite.',
    offline:
      'Puede empezar a escribir y buscar materiales. Conecte una IA desde Ajustes cuando la necesite.',
    ai: 'Conexiones de IA',
    programs: 'Programas de IA de este equipo',
    additional: 'Más conexiones de IA',
    additionalBody: 'Conecte otro proveedor. Consulte sus condiciones y costes.',
    developer: 'Herramientas de desarrollo',
    manual:
      'Las nuevas versiones se entregan como instaladores de CheilOffice. Las actualizaciones automáticas están desactivadas.',
    feedback:
      'Deje comentarios en el proyecto CheilOffice desde el navegador. La aplicación no envía sus documentos.',
  },
  pt: {
    tagline: 'Documentos e materiais de campanha juntos',
    welcome:
      'Crie uma campanha e documentos com modelos. Encontre materiais na base de conhecimento. Conecte uma IA quando precisar.',
    offline:
      'Comece a escrever e buscar materiais. Conecte uma IA nas configurações quando precisar.',
    ai: 'Conexões de IA',
    programs: 'Programas de IA neste computador',
    additional: 'Mais conexões de IA',
    additionalBody: 'Conecte outro provedor. Confira suas condições e custos.',
    developer: 'Ferramentas de desenvolvimento',
    manual:
      'Novas versões são fornecidas como instaladores do CheilOffice. Atualizações automáticas estão desativadas.',
    feedback:
      'Envie comentários ao projeto CheilOffice pelo navegador. O aplicativo não envia seus documentos.',
  },
  it: {
    tagline: 'Documenti e materiali della campagna insieme',
    welcome:
      'Crea una campagna e documenti dai modelli. Trova i materiali nella base di conoscenza. Collega una IA quando serve.',
    offline:
      'Puoi iniziare a scrivere e cercare materiali. Collega una IA nelle impostazioni quando serve.',
    ai: 'Connessioni IA',
    programs: 'Programmi IA su questo computer',
    additional: 'Altre connessioni IA',
    additionalBody: 'Collega un altro fornitore. Verifica condizioni e costi.',
    developer: 'Strumenti per sviluppatori',
    manual:
      'Le nuove versioni sono fornite come programmi di installazione CheilOffice. Gli aggiornamenti automatici sono disattivati.',
    feedback:
      'Lascia un commento nel progetto CheilOffice dal browser. L’app non invia i tuoi documenti.',
  },
  nl: {
    tagline: 'Campagnedocumenten en materiaal bij elkaar',
    welcome:
      'Maak een campagne en documenten met sjablonen. Zoek materiaal in de kennisbank. Verbind AI wanneer nodig.',
    offline:
      'Begin meteen met schrijven en materiaal zoeken. Verbind AI indien nodig via Instellingen.',
    ai: 'AI-verbindingen',
    programs: 'AI-programma’s op deze computer',
    additional: 'Meer AI-verbindingen',
    additionalBody: 'Verbind een andere aanbieder. Controleer de voorwaarden en kosten.',
    developer: 'Ontwikkelaarstools',
    manual:
      'Nieuwe versies worden als CheilOffice-installatiebestand geleverd. Automatische updates zijn uitgeschakeld.',
    feedback:
      'Geef feedback in het CheilOffice-project via de browser. De app verstuurt uw documenten niet.',
  },
  pl: {
    tagline: 'Dokumenty i materiały kampanii razem',
    welcome:
      'Utwórz kampanię i dokumenty z szablonów. Szukaj materiałów w bazie wiedzy. Połącz AI, gdy będzie potrzebna.',
    offline: 'Możesz od razu pisać i szukać materiałów. W razie potrzeby połącz AI w ustawieniach.',
    ai: 'Połączenia AI',
    programs: 'Programy AI na tym komputerze',
    additional: 'Więcej połączeń AI',
    additionalBody: 'Połącz innego dostawcę. Sprawdź jego warunki i koszty.',
    developer: 'Narzędzia programistyczne',
    manual:
      'Nowe wersje są dostarczane jako instalatory CheilOffice. Automatyczne aktualizacje są wyłączone.',
    feedback:
      'Dodaj opinię w projekcie CheilOffice przez przeglądarkę. Aplikacja nie wysyła dokumentów.',
  },
  cs: {
    tagline: 'Dokumenty a podklady kampaně pohromadě',
    welcome:
      'Vytvořte kampaň a dokumenty ze šablon. Podklady najdete ve znalostní bázi. AI připojte podle potřeby.',
    offline: 'Můžete hned psát a hledat podklady. AI připojte v nastavení podle potřeby.',
    ai: 'Připojení AI',
    programs: 'Programy AI v tomto počítači',
    additional: 'Další připojení AI',
    additionalBody: 'Připojte jiného poskytovatele. Ověřte jeho podmínky a ceny.',
    developer: 'Vývojářské nástroje',
    manual:
      'Nové verze se dodávají jako instalátory CheilOffice. Automatické aktualizace jsou vypnuté.',
    feedback:
      'Zanechte názor v projektu CheilOffice v prohlížeči. Aplikace neposílá vaše dokumenty.',
  },
  ru: {
    tagline: 'Документы и материалы кампании вместе',
    welcome:
      'Создайте кампанию и документы по шаблонам. Ищите материалы в базе знаний. Подключайте ИИ по мере необходимости.',
    offline:
      'Можно сразу создавать документы и искать материалы. При необходимости подключите ИИ в настройках.',
    ai: 'Подключения ИИ',
    programs: 'Программы ИИ на этом компьютере',
    additional: 'Другие подключения ИИ',
    additionalBody: 'Подключите другого поставщика. Проверьте условия и стоимость.',
    developer: 'Инструменты разработчика',
    manual:
      'Новые версии предоставляются установщиками CheilOffice. Автоматическое обновление отключено.',
    feedback:
      'Оставьте отзыв в проекте CheilOffice через браузер. Приложение не отправляет ваши документы.',
  },
  vi: {
    tagline: 'Tài liệu và tư liệu chiến dịch ở cùng một nơi',
    welcome:
      'Tạo chiến dịch và soạn tài liệu từ mẫu. Tìm tư liệu trong kho kiến thức. Kết nối AI khi cần.',
    offline: 'Bạn có thể viết và tìm tư liệu ngay. Kết nối AI trong Cài đặt khi cần.',
    ai: 'Kết nối AI',
    programs: 'Chương trình AI trên máy này',
    additional: 'Kết nối AI khác',
    additionalBody: 'Kết nối nhà cung cấp khác. Kiểm tra điều kiện và chi phí của họ.',
    developer: 'Công cụ nhà phát triển',
    manual: 'Phiên bản mới được cung cấp bằng bộ cài CheilOffice. Cập nhật tự động đã tắt.',
    feedback:
      'Gửi ý kiến trong dự án CheilOffice qua trình duyệt. Ứng dụng không gửi tài liệu của bạn.',
  },
  id: {
    tagline: 'Dokumen dan bahan kampanye dalam satu tempat',
    welcome:
      'Buat kampanye dan dokumen dari templat. Temukan bahan di basis pengetahuan. Hubungkan AI saat dibutuhkan.',
    offline:
      'Mulai menulis dan mencari bahan sekarang. Hubungkan AI melalui Pengaturan saat diperlukan.',
    ai: 'Koneksi AI',
    programs: 'Program AI di komputer ini',
    additional: 'Koneksi AI lainnya',
    additionalBody: 'Hubungkan penyedia lain. Periksa ketentuan dan biayanya.',
    developer: 'Alat pengembang',
    manual: 'Versi baru disediakan sebagai pemasang CheilOffice. Pembaruan otomatis dinonaktifkan.',
    feedback:
      'Berikan masukan di proyek CheilOffice melalui peramban. Aplikasi tidak mengirim dokumen Anda.',
  },
  ms: {
    tagline: 'Dokumen dan bahan kempen di satu tempat',
    welcome:
      'Cipta kempen dan dokumen daripada templat. Cari bahan dalam pangkalan pengetahuan. Sambungkan AI apabila perlu.',
    offline: 'Mula menulis dan mencari bahan sekarang. Sambungkan AI dalam Tetapan apabila perlu.',
    ai: 'Sambungan AI',
    programs: 'Program AI pada komputer ini',
    additional: 'Sambungan AI tambahan',
    additionalBody: 'Sambungkan penyedia lain. Semak syarat dan kosnya.',
    developer: 'Alat pembangun',
    manual: 'Versi baharu disediakan sebagai pemasang CheilOffice. Kemas kini automatik dimatikan.',
    feedback:
      'Beri maklum balas dalam projek CheilOffice melalui pelayar. Aplikasi tidak menghantar dokumen anda.',
  },
  hi: {
    tagline: 'अभियान के दस्तावेज़ और सामग्री एक साथ',
    welcome:
      'अभियान बनाएँ और टेम्पलेट से दस्तावेज़ लिखें। ज्ञान आधार में सामग्री खोजें। ज़रूरत पड़ने पर AI जोड़ें।',
    offline: 'अभी लिखना और सामग्री खोजना शुरू करें। ज़रूरत होने पर सेटिंग में AI जोड़ें।',
    ai: 'AI कनेक्शन',
    programs: 'इस कंप्यूटर के AI प्रोग्राम',
    additional: 'अन्य AI कनेक्शन',
    additionalBody: 'दूसरा प्रदाता जोड़ें। उसकी शर्तें और शुल्क जाँचें।',
    developer: 'डेवलपर टूल',
    manual: 'नए संस्करण CheilOffice इंस्टॉलर के रूप में मिलते हैं। स्वचालित अपडेट बंद हैं।',
    feedback:
      'ब्राउज़र में CheilOffice प्रोजेक्ट पर प्रतिक्रिया लिखें। ऐप आपके दस्तावेज़ नहीं भेजता।',
  },
  ar: {
    tagline: 'مستندات الحملة وموادها في مكان واحد',
    welcome:
      'أنشئ حملة ومستندات من القوالب. ابحث عن المواد في قاعدة المعرفة. صِل الذكاء الاصطناعي عند الحاجة.',
    offline: 'ابدأ الكتابة والبحث عن المواد الآن. صِل الذكاء الاصطناعي من الإعدادات عند الحاجة.',
    ai: 'اتصالات الذكاء الاصطناعي',
    programs: 'برامج الذكاء الاصطناعي على هذا الجهاز',
    additional: 'اتصالات إضافية للذكاء الاصطناعي',
    additionalBody: 'صِل مزودًا آخر وتحقق من شروطه وتكاليفه.',
    developer: 'أدوات المطور',
    manual: 'تُقدَّم الإصدارات الجديدة بمثبت CheilOffice. التحديث التلقائي معطل.',
    feedback: 'اكتب ملاحظاتك في مشروع CheilOffice من المتصفح. لا يرسل التطبيق مستنداتك.',
  },
  he: {
    tagline: 'מסמכי הקמפיין והחומרים במקום אחד',
    welcome: 'צרו קמפיין ומסמכים מתבניות. חפשו חומרים במאגר הידע. חברו AI לפי הצורך.',
    offline: 'אפשר להתחיל לכתוב ולחפש חומרים כעת. חברו AI בהגדרות בעת הצורך.',
    ai: 'חיבורי AI',
    programs: 'תוכניות AI במחשב זה',
    additional: 'חיבורי AI נוספים',
    additionalBody: 'חברו ספק אחר ובדקו את התנאים והעלויות שלו.',
    developer: 'כלי פיתוח',
    manual: 'גרסאות חדשות מסופקות כמתקיני CheilOffice. עדכונים אוטומטיים מושבתים.',
    feedback: 'כתבו משוב בפרויקט CheilOffice בדפדפן. היישום אינו שולח את המסמכים שלכם.',
  },
  th: {
    tagline: 'เอกสารและข้อมูลแคมเปญในที่เดียว',
    welcome: 'สร้างแคมเปญและเอกสารจากแม่แบบ ค้นหาข้อมูลในฐานความรู้ และเชื่อมต่อ AI เมื่อต้องการ',
    offline: 'เริ่มเขียนและค้นหาข้อมูลได้ทันที เชื่อมต่อ AI ในการตั้งค่าเมื่อต้องการ',
    ai: 'การเชื่อมต่อ AI',
    programs: 'โปรแกรม AI บนคอมพิวเตอร์นี้',
    additional: 'การเชื่อมต่อ AI เพิ่มเติม',
    additionalBody: 'เชื่อมต่อผู้ให้บริการอื่นและตรวจสอบเงื่อนไขกับค่าใช้จ่าย',
    developer: 'เครื่องมือสำหรับนักพัฒนา',
    manual: 'เวอร์ชันใหม่ให้บริการผ่านตัวติดตั้ง CheilOffice ปิดการอัปเดตอัตโนมัติแล้ว',
    feedback: 'แสดงความคิดเห็นในโครงการ CheilOffice ผ่านเบราว์เซอร์ แอปจะไม่ส่งเอกสารของคุณ',
  },
}
export const productCopy = (lang: Lang): Copy => PRODUCT_COPY[lang]
export function productCopyOverrides(lang: Lang): Partial<Record<keyof typeof strings.zh, string>> {
  const w = productCopy(lang)
  return {
    onbWelcomeSubtitle: w.tagline,
    onbWelcomeBody: w.welcome,
    onbDoneNotConnected: w.offline,
    onbBody3: w.offline,
    account: w.ai,
    setSecAccount: w.ai,
    setSecAi: w.ai,
    setSubTitle: w.programs,
    setFreeTitle: w.additional,
    setFreeDesc: w.additionalBody,
    setSecIntegrations: w.developer,
    setFeedbackDesc: w.feedback,
    feedbackOpen: PROJECT_OPEN[lang],
  }
}

/** Cheil fork: distinguish a detected local login from account data synchronization. */
const PROGRAM_HINT: Record<Lang, string> = {
  ko: '이 PC의 프로그램 로그인 상태를 사용합니다. 웹 로그인이나 대화·메모리 동기화가 아닙니다.',
  en: 'Uses the login of a program on this computer. It does not sync browser sessions, chats or memory.',
  zh: '使用此电脑上程序的登录状态，不同步浏览器会话、聊天或记忆。',
  'zh-TW': '使用此電腦上程式的登入狀態，不同步瀏覽器工作階段、聊天或記憶。',
  ja: 'この PC のプログラムのログインを使用します。ブラウザーのセッション、会話、メモリは同期しません。',
  fr: 'Utilise la connexion d’un programme sur cet ordinateur. Les sessions du navigateur, conversations et souvenirs ne sont pas synchronisés.',
  de: 'Verwendet die Anmeldung eines Programms auf diesem Computer. Browsersitzungen, Chats und Erinnerungen werden nicht synchronisiert.',
  es: 'Usa el inicio de sesión de un programa de este equipo. No sincroniza sesiones del navegador, chats ni memoria.',
  pt: 'Usa o login de um programa neste computador. Não sincroniza sessões do navegador, conversas ou memória.',
  it: 'Usa l’accesso di un programma su questo computer. Non sincronizza sessioni del browser, chat o memoria.',
  nl: 'Gebruikt de aanmelding van een programma op deze computer. Browsersessies, chats en geheugen worden niet gesynchroniseerd.',
  pl: 'Używa logowania programu na tym komputerze. Nie synchronizuje sesji przeglądarki, rozmów ani pamięci.',
  cs: 'Používá přihlášení programu v tomto počítači. Nesynchronizuje relace prohlížeče, chaty ani paměť.',
  ru: 'Использует вход программы на этом компьютере. Сеансы браузера, чаты и память не синхронизируются.',
  vi: 'Dùng đăng nhập của chương trình trên máy này. Không đồng bộ phiên trình duyệt, cuộc trò chuyện hay bộ nhớ.',
  id: 'Menggunakan login program di komputer ini. Tidak menyinkronkan sesi peramban, percakapan, atau memori.',
  ms: 'Menggunakan log masuk program pada komputer ini. Tidak menyegerakkan sesi pelayar, sembang atau ingatan.',
  hi: 'इस कंप्यूटर के प्रोग्राम का लॉगिन उपयोग होता है। ब्राउज़र सत्र, चैट या मेमोरी सिंक नहीं होते।',
  ar: 'يستخدم تسجيل دخول برنامج على هذا الجهاز. لا يزامن جلسات المتصفح أو المحادثات أو الذاكرة.',
  he: 'משתמש בהתחברות של תוכנית במחשב זה. אינו מסנכרן הפעלות דפדפן, שיחות או זיכרון.',
  th: 'ใช้การเข้าสู่ระบบของโปรแกรมบนคอมพิวเตอร์นี้ ไม่ซิงค์เซสชันเบราว์เซอร์ แชต หรือความจำ',
}
export const programConnectionHint = (lang: Lang): string => PROGRAM_HINT[lang]

const PROJECT_OPEN: Record<Lang, string> = {
  ko: '프로젝트 열기',
  en: 'Open project',
  zh: '打开项目',
  'zh-TW': '開啟專案',
  ja: 'プロジェクトを開く',
  fr: 'Ouvrir le projet',
  de: 'Projekt öffnen',
  es: 'Abrir proyecto',
  pt: 'Abrir projeto',
  it: 'Apri progetto',
  nl: 'Project openen',
  pl: 'Otwórz projekt',
  cs: 'Otevřít projekt',
  ru: 'Открыть проект',
  vi: 'Mở dự án',
  id: 'Buka proyek',
  ms: 'Buka projek',
  hi: 'प्रोजेक्ट खोलें',
  ar: 'فتح المشروع',
  he: 'פתיחת הפרויקט',
  th: 'เปิดโครงการ',
}
