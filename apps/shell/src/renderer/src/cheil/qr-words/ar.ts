/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'إنشاء QR',
  offline: 'أنشئ رموز QR على هذا الجهاز دون إنترنت أو خادم أو حساب. لا يُرسل المحتوى إلى الخارج.',
  content: 'رابط أو نص',
  placeholder: 'أدخل https://example.com أو نصًا.',
  limit: 'حتى 1,000 بايت UTF-8',
  size: 'حجم الصورة',
  generate: 'إنشاء QR',
  invalid: 'أدخل محتوى لا يتجاوز 1,000 بايت.',
  scan: 'اختبر بالهاتف قبل المشاركة. احفظ صورة أكبر للمحتوى الطويل.',
  copy: 'نسخ الصورة',
  savePng: 'حفظ PNG',
  empty: 'أدخل المحتوى واختر إنشاء QR للمعاينة.',
  static: 'رمز ثابت دون تتبع الزيارات. أنشئ رمزًا جديدًا لتغيير المحتوى.',
} satisfies Record<keyof typeof zh, string>
export default words
