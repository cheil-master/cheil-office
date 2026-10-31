/** Cheil fork: local moodboard analysis controls in all supported languages. */
import type { Lang } from '@genoffice/i18n'
const rows: Record<Lang, string> = {
  ko: '보드 스타일 MD로 저장|최대 30개 미리보기의 색상을 로컬 분석합니다. 글꼴·크기·여백은 문서용 추천이며, 이미지를 외부 AI로 보내지 않습니다.|MD 스타일을 저장하고 아래 편집기에 적용했습니다.',
  en: 'Save board as style MD|Locally sample colors from up to 30 previews. Font, sizes and spacing are recommendations. No images are sent to AI.|MD style saved and applied in the editor below.',
  ja: 'ボードをスタイルMDに保存|最大30枚からローカルで色を抽出。字体・サイズ・余白は提案です。画像はAIに送信しません。|MDスタイルを保存し、下の編集画面に適用しました。',
  zh: '将画板保存为样式MD|本地分析最多30张预览的颜色。字体、字号和间距是建议值。不向AI发送图片。|已保存MD样式并应用到下方编辑器。',
  'zh-TW':
    '將圖板存為樣式MD|在本機分析最多30張預覽的色彩。字型、字級與間距為建議值。不傳送圖片至AI。|已儲存MD樣式並套用至下方編輯器。',
  de: 'Board als Stil-MD speichern|Farben aus bis zu 30 Vorschaubildern lokal ermitteln. Schrift, Größen und Abstände sind Empfehlungen. Keine KI-Übertragung.|MD-Stil gespeichert und im Editor unten angewendet.',
  fr: 'Enregistrer le tableau en style MD|Couleurs analysées localement sur 30 aperçus maximum. Police, tailles et espacement conseillés. Aucun envoi à une IA.|Style MD enregistré et appliqué dans l’éditeur ci-dessous.',
  es: 'Guardar tablero como estilo MD|Colores analizados localmente en hasta 30 vistas previas. Fuente, tamaños y espacios recomendados. Sin envío a IA.|Estilo MD guardado y aplicado en el editor inferior.',
  it: 'Salva bacheca come stile MD|Colori analizzati localmente da 30 anteprime al massimo. Font, dimensioni e spazi sono consigli. Nessun invio a IA.|Stile MD salvato e applicato nell’editor qui sotto.',
  pt: 'Salvar pasta como estilo MD|Cores analisadas localmente em até 30 prévias. Fonte, tamanhos e espaços sugeridos. Sem envio à IA.|Estilo MD salvo e aplicado no editor abaixo.',
  ru: 'Сохранить доску как стиль MD|Локальный анализ цветов до 30 изображений. Шрифт, размеры и интервалы рекомендованы. Без передачи ИИ.|Стиль MD сохранён и применён в редакторе ниже.',
  nl: 'Bord als stijl-MD opslaan|Lokale kleuranalyse van maximaal 30 voorbeelden. Lettertype, maten en afstanden zijn aanbevelingen. Geen AI-verzending.|MD-stijl opgeslagen en toegepast in de editor hieronder.',
  pl: 'Zapisz tablicę jako styl MD|Lokalna analiza kolorów do 30 podglądów. Czcionka, rozmiary i odstępy są zaleceniami. Bez wysyłania do AI.|Styl MD zapisano i zastosowano w edytorze poniżej.',
  cs: 'Uložit nástěnku jako styl MD|Místní analýza barev až 30 náhledů. Písmo, velikosti a mezery jsou doporučení. Bez odesílání do AI.|Styl MD uložen a použit v editoru níže.',
  th: 'บันทึกบอร์ดเป็นสไตล์ MD|วิเคราะห์สีในเครื่องจากตัวอย่างไม่เกิน 30 ภาพ ฟอนต์ ขนาด และระยะห่างเป็นคำแนะนำ ไม่ส่งภาพไปยัง AI|บันทึกสไตล์ MD และนำไปใช้ในตัวแก้ไขด้านล่างแล้ว',
  vi: 'Lưu bảng thành phong cách MD|Phân tích màu cục bộ từ tối đa 30 ảnh. Phông, cỡ và khoảng cách là gợi ý. Không gửi ảnh tới AI.|Đã lưu phong cách MD và áp dụng trong trình sửa bên dưới.',
  id: 'Simpan papan sebagai gaya MD|Analisis warna lokal hingga 30 pratinjau. Font, ukuran dan jarak adalah saran. Gambar tidak dikirim ke AI.|Gaya MD disimpan dan diterapkan di editor di bawah.',
  ms: 'Simpan papan sebagai gaya MD|Analisis warna setempat sehingga 30 pratonton. Fon, saiz dan jarak ialah cadangan. Tiada imej dihantar ke AI.|Gaya MD disimpan dan digunakan dalam editor di bawah.',
  ar: 'حفظ اللوحة كنمط MD|تحليل الألوان محليًا من 30 معاينة كحد أقصى. الخط والحجم والتباعد توصيات. لا تُرسل الصور إلى الذكاء الاصطناعي.|تم حفظ نمط MD وتطبيقه في المحرر أدناه.',
  he: 'שמירת הלוח כסגנון MD|ניתוח צבעים מקומי של עד 30 תמונות. הגופן, הגדלים והריווח הם המלצות. ללא שליחת תמונות לבינה מלאכותית.|סגנון MD נשמר והוחל בעורך למטה.',
  hi: 'बोर्ड को MD शैली में सहेजें|अधिकतम 30 चित्रों के रंगों का स्थानीय विश्लेषण। फ़ॉन्ट, आकार और अंतराल सुझाव हैं। AI को चित्र नहीं भेजे जाते।|MD शैली सहेजी गई और नीचे संपादक में लागू की गई।',
}
export function moodboardWords(lang: Lang) {
  const [create, preview, saved] = rows[lang].split('|')
  return { create, preview, saved }
}
