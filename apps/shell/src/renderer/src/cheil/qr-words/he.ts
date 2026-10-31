/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'יצירת QR',
  offline: 'יצירת קודים במחשב ללא אינטרנט, שרת או חשבון. התוכן לא נשלח החוצה.',
  content: 'כתובת או טקסט',
  placeholder: 'הקלידו https://example.com או טקסט.',
  limit: 'עד 1,000 בתי UTF-8',
  size: 'גודל התמונה',
  generate: 'יצירת QR',
  invalid: 'הזינו תוכן עד 1,000 בתים.',
  scan: 'בדקו בטלפון לפני שיתוף. לתוכן ארוך שמרו תמונה גדולה יותר.',
  copy: 'העתקת תמונה',
  savePng: 'שמירת PNG',
  empty: 'הזינו תוכן ובחרו ביצירת QR לתצוגה מקדימה.',
  static: 'קוד קבוע ללא מעקב ביקורים. לשינוי התוכן יש ליצור קוד חדש.',
} satisfies Record<keyof typeof zh, string>
export default words
