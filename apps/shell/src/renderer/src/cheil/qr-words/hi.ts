/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'QR बनाएँ',
  offline: 'बिना इंटरनेट, सर्वर या खाते के इस कंप्यूटर पर QR बनाएँ। सामग्री बाहर नहीं भेजी जाती।',
  content: 'URL या पाठ',
  placeholder: 'https://example.com या पाठ लिखें।',
  limit: 'अधिकतम 1,000 UTF-8 बाइट',
  size: 'चित्र का आकार',
  generate: 'QR बनाएँ',
  invalid: '1,000 बाइट तक की सामग्री लिखें।',
  scan: 'साझा करने से पहले फ़ोन से जाँचें। लंबी सामग्री के लिए बड़ा चित्र सहेजें।',
  copy: 'चित्र कॉपी करें',
  savePng: 'PNG सहेजें',
  empty: 'सामग्री लिखकर QR बनाएँ चुनें, पूर्वावलोकन यहाँ दिखेगा।',
  static: 'यह स्थिर QR है, विज़िट ट्रैक नहीं होतीं। सामग्री बदलने के लिए नया कोड बनाएँ।',
} satisfies Record<keyof typeof zh, string>
export default words
