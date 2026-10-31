/** Cheil fork: localized Pinterest connection controls. */
import type { Lang } from '@genoffice/i18n'
const keys = [
  'connected',
  'disconnected',
  'connect',
  'boards',
  'disconnect',
  'hint',
  'confirm',
  'cancel',
  'working',
  'failed',
  'login',
  'empty',
  'more',
  'preview',
] as const
const rows: Record<Lang, string> = {
  ko: '연결됨|연결 안 됨|연결 / 다시 로그인|내 보드 새로고침|연결 해제|Pinterest 창에서 직접 로그인하세요. 앱 전용 연결이 이 PC에 유지됩니다. 외부 AI 전송은 없습니다.|이 앱의 Pinterest 로그인 정보를 삭제할까요?|취소|처리 중… 로그인 창이 열렸다면 로그인을 마쳐 주세요.|목록을 불러오지 못했습니다. 다시 로그인하거나 잠시 후 재시도하세요.|Pinterest 로그인이 필요합니다.|표시할 항목이 없습니다.|보드 더 보기|선택한 보드의 이미지 미리보기입니다(최대 30개). 스타일 자동 분석은 아직 포함되지 않습니다.',
  en: 'Connected|Not connected|Connect / sign in again|Refresh my boards|Disconnect|Sign in directly in the Pinterest window. This PC keeps a separate app session. Nothing is sent to AI.|Delete this app’s Pinterest session?|Cancel|Working… Complete sign-in if the login window is open.|Could not load. Sign in again or retry later.|Pinterest sign-in is required.|No items to display.|More boards|Preview of the selected board (up to 30 images). Automatic style analysis is not included yet.',
  ja: '接続済み|未接続|接続 / 再ログイン|ボードを更新|接続解除|Pinterestの画面でログインします。このPCに専用セッションを保存します。AIには送信しません。|このアプリのPinterestセッションを削除しますか？|キャンセル|処理中… ログイン画面で操作を完了してください。|読み込めません。再ログインするか後でお試しください。|Pinterestへのログインが必要です。|項目がありません。|ボードをさらに表示|選択したボードのプレビュー（最大30枚）。スタイルの自動分析は未対応です。',
  zh: '已连接|未连接|连接 / 重新登录|刷新我的画板|断开连接|请在Pinterest窗口登录。本机保留应用专用会话，不向AI发送数据。|删除此应用的Pinterest会话？|取消|处理中… 请在登录窗口完成登录。|无法加载，请重新登录或稍后重试。|需要登录Pinterest。|没有可显示的项目。|更多画板|所选画板预览（最多30张）。暂不包含自动风格分析。',
  'zh-TW':
    '已連線|未連線|連線 / 重新登入|重新整理圖板|中斷連線|請在Pinterest視窗登入。本機保留應用程式專用工作階段，不傳送至AI。|刪除此應用程式的Pinterest工作階段？|取消|處理中… 請在登入視窗完成登入。|無法載入，請重新登入或稍後重試。|需要登入Pinterest。|沒有可顯示的項目。|更多圖板|所選圖板預覽（最多30張）。尚未包含自動風格分析。',
  de: 'Verbunden|Nicht verbunden|Verbinden / erneut anmelden|Boards aktualisieren|Trennen|Im Pinterest-Fenster anmelden. Eine eigene Sitzung bleibt auf diesem PC. Keine KI-Übertragung.|Pinterest-Sitzung dieser App löschen?|Abbrechen|Bitte Anmeldung im geöffneten Fenster abschließen…|Laden fehlgeschlagen. Erneut anmelden oder später versuchen.|Pinterest-Anmeldung erforderlich.|Keine Einträge.|Weitere Boards|Vorschau mit bis zu 30 Bildern. Automatische Stilanalyse ist noch nicht enthalten.',
  fr: 'Connecté|Non connecté|Connecter / se reconnecter|Actualiser mes tableaux|Déconnecter|Connectez-vous dans la fenêtre Pinterest. Session dédiée sur ce PC, sans envoi à une IA.|Supprimer la session Pinterest de cette application ?|Annuler|Chargement… Terminez la connexion dans la fenêtre ouverte.|Échec du chargement. Reconnectez-vous ou réessayez plus tard.|Connexion Pinterest requise.|Aucun élément.|Plus de tableaux|Aperçu du tableau (30 images maximum). Analyse automatique du style non incluse.',
  es: 'Conectado|Sin conexión|Conectar / iniciar sesión|Actualizar mis tableros|Desconectar|Inicia sesión en la ventana de Pinterest. Sesión propia en este PC, sin envío a IA.|¿Eliminar la sesión de Pinterest de esta aplicación?|Cancelar|Procesando… Completa el inicio de sesión.|No se pudo cargar. Inicia sesión de nuevo o reintenta más tarde.|Se requiere iniciar sesión en Pinterest.|Sin elementos.|Más tableros|Vista previa de hasta 30 imágenes. Aún no incluye análisis automático del estilo.',
  it: 'Connesso|Non connesso|Connetti / accedi di nuovo|Aggiorna bacheche|Disconnetti|Accedi nella finestra Pinterest. Sessione dedicata su questo PC, senza invio a IA.|Eliminare la sessione Pinterest di questa app?|Annulla|Elaborazione… Completa l’accesso.|Caricamento non riuscito. Accedi di nuovo o riprova più tardi.|Accesso Pinterest necessario.|Nessun elemento.|Altre bacheche|Anteprima fino a 30 immagini. Analisi automatica dello stile non ancora inclusa.',
  pt: 'Conectado|Não conectado|Conectar / entrar novamente|Atualizar pastas|Desconectar|Entre na janela do Pinterest. Sessão própria neste PC, sem envio à IA.|Excluir a sessão Pinterest deste aplicativo?|Cancelar|Processando… Conclua o acesso.|Não foi possível carregar. Entre novamente ou tente mais tarde.|É necessário entrar no Pinterest.|Nenhum item.|Mais pastas|Prévia de até 30 imagens. Análise automática de estilo ainda não incluída.',
  ru: 'Подключено|Не подключено|Подключить / войти снова|Обновить доски|Отключить|Войдите в окне Pinterest. Отдельный сеанс хранится на этом ПК. Данные не отправляются ИИ.|Удалить сеанс Pinterest этого приложения?|Отмена|Обработка… Завершите вход.|Не удалось загрузить. Войдите снова или повторите позже.|Требуется вход в Pinterest.|Нет элементов.|Ещё доски|Просмотр до 30 изображений. Автоматический анализ стиля пока недоступен.',
  nl: 'Verbonden|Niet verbonden|Verbinden / opnieuw aanmelden|Borden vernieuwen|Verbinding verbreken|Meld aan in het Pinterest-venster. Aparte sessie op deze pc, zonder AI-verzending.|Pinterest-sessie van deze app verwijderen?|Annuleren|Bezig… Rond de aanmelding af.|Laden mislukt. Meld opnieuw aan of probeer later.|Pinterest-aanmelding vereist.|Geen items.|Meer borden|Voorbeeld met maximaal 30 afbeeldingen. Automatische stijlanalyse is nog niet inbegrepen.',
  pl: 'Połączono|Nie połączono|Połącz / zaloguj ponownie|Odśwież tablice|Rozłącz|Zaloguj się w oknie Pinterest. Osobna sesja na tym komputerze, bez wysyłania do AI.|Usunąć sesję Pinterest tej aplikacji?|Anuluj|Przetwarzanie… Dokończ logowanie.|Nie udało się wczytać. Zaloguj się ponownie lub spróbuj później.|Wymagane logowanie do Pinterest.|Brak elementów.|Więcej tablic|Podgląd do 30 obrazów. Automatyczna analiza stylu nie jest jeszcze dostępna.',
  cs: 'Připojeno|Nepřipojeno|Připojit / přihlásit znovu|Obnovit nástěnky|Odpojit|Přihlaste se v okně Pinterest. Samostatná relace v tomto PC, bez odesílání do AI.|Smazat relaci Pinterest této aplikace?|Zrušit|Zpracování… Dokončete přihlášení.|Načtení selhalo. Přihlaste se znovu nebo zkuste později.|Je nutné přihlášení k Pinterest.|Žádné položky.|Další nástěnky|Náhled až 30 obrázků. Automatická analýza stylu zatím není zahrnuta.',
  th: 'เชื่อมต่อแล้ว|ยังไม่เชื่อมต่อ|เชื่อมต่อ / เข้าสู่ระบบอีกครั้ง|รีเฟรชบอร์ด|ตัดการเชื่อมต่อ|เข้าสู่ระบบในหน้าต่าง Pinterest เก็บเซสชันแยกในเครื่องนี้และไม่ส่งข้อมูลไปยัง AI|ลบเซสชัน Pinterest ของแอปนี้หรือไม่?|ยกเลิก|กำลังทำงาน… โปรดเข้าสู่ระบบให้เสร็จ|โหลดไม่ได้ โปรดเข้าสู่ระบบอีกครั้งหรือลองภายหลัง|ต้องเข้าสู่ระบบ Pinterest|ไม่มีรายการ|บอร์ดเพิ่มเติม|ตัวอย่างสูงสุด 30 ภาพ ยังไม่มีการวิเคราะห์สไตล์อัตโนมัติ',
  vi: 'Đã kết nối|Chưa kết nối|Kết nối / đăng nhập lại|Làm mới bảng|Ngắt kết nối|Đăng nhập trong cửa sổ Pinterest. Phiên riêng được lưu trên máy này, không gửi tới AI.|Xóa phiên Pinterest của ứng dụng này?|Hủy|Đang xử lý… Hãy hoàn tất đăng nhập.|Không thể tải. Đăng nhập lại hoặc thử sau.|Cần đăng nhập Pinterest.|Không có mục nào.|Thêm bảng|Xem trước tối đa 30 ảnh. Chưa bao gồm phân tích phong cách tự động.',
  id: 'Terhubung|Belum terhubung|Hubungkan / masuk lagi|Segarkan papan|Putuskan|Masuk di jendela Pinterest. Sesi khusus disimpan di PC ini, tanpa mengirim ke AI.|Hapus sesi Pinterest aplikasi ini?|Batal|Memproses… Selesaikan masuk.|Gagal memuat. Masuk lagi atau coba nanti.|Perlu masuk ke Pinterest.|Tidak ada item.|Papan lainnya|Pratinjau hingga 30 gambar. Analisis gaya otomatis belum tersedia.',
  ms: 'Disambungkan|Belum disambungkan|Sambung / log masuk semula|Segar semula papan|Putuskan|Log masuk dalam tetingkap Pinterest. Sesi berasingan disimpan pada PC ini, tanpa penghantaran ke AI.|Padam sesi Pinterest aplikasi ini?|Batal|Memproses… Lengkapkan log masuk.|Gagal memuatkan. Log masuk semula atau cuba kemudian.|Log masuk Pinterest diperlukan.|Tiada item.|Lagi papan|Pratonton sehingga 30 imej. Analisis gaya automatik belum disertakan.',
  ar: 'متصل|غير متصل|اتصال / تسجيل الدخول مجددًا|تحديث لوحاتي|قطع الاتصال|سجّل الدخول في نافذة Pinterest. تُحفظ جلسة مستقلة على هذا الجهاز دون إرسال للذكاء الاصطناعي.|حذف جلسة Pinterest لهذا التطبيق؟|إلغاء|جارٍ العمل… أكمل تسجيل الدخول.|تعذر التحميل. سجّل الدخول مجددًا أو حاول لاحقًا.|يلزم تسجيل الدخول إلى Pinterest.|لا توجد عناصر.|المزيد من اللوحات|معاينة حتى 30 صورة. تحليل النمط التلقائي غير متاح بعد.',
  he: 'מחובר|לא מחובר|חיבור / כניסה מחדש|רענון הלוחות|ניתוק|יש להיכנס בחלון Pinterest. הפעלה נפרדת נשמרת במחשב זה ללא שליחה לבינה מלאכותית.|למחוק את הפעלת Pinterest של יישום זה?|ביטול|בעבודה… יש להשלים את הכניסה.|הטעינה נכשלה. יש להיכנס שוב או לנסות מאוחר יותר.|נדרשת כניסה ל-Pinterest.|אין פריטים.|לוחות נוספים|תצוגה מקדימה של עד 30 תמונות. ניתוח סגנון אוטומטי עדיין אינו כלול.',
  hi: 'जुड़ा है|जुड़ा नहीं है|जोड़ें / फिर प्रवेश करें|बोर्ड ताज़ा करें|कनेक्शन हटाएँ|Pinterest विंडो में प्रवेश करें। इस पीसी पर अलग सत्र रहता है, AI को डेटा नहीं भेजा जाता।|इस ऐप का Pinterest सत्र हटाएँ?|रद्द करें|प्रक्रिया जारी… प्रवेश पूरा करें।|लोड नहीं हुआ। फिर प्रवेश करें या बाद में कोशिश करें।|Pinterest में प्रवेश आवश्यक है।|कोई आइटम नहीं।|और बोर्ड|अधिकतम 30 चित्रों का पूर्वावलोकन। स्वचालित शैली विश्लेषण अभी शामिल नहीं है।',
}
export function pinterestWords(lang: Lang) {
  const values = rows[lang].split('|')
  if (values.length !== keys.length) throw Error('Invalid Pinterest translation')
  return Object.fromEntries(keys.map((key, i) => [key, values[i]])) as Record<
    (typeof keys)[number],
    string
  >
}
