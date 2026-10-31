/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'สร้าง QR',
  offline:
    'สร้าง QR บนคอมพิวเตอร์นี้โดยไม่ใช้อินเทอร์เน็ต เซิร์ฟเวอร์ หรือบัญชี ไม่มีการส่งข้อมูลออกไป',
  content: 'URL หรือข้อความ',
  placeholder: 'ป้อน https://example.com หรือข้อความ',
  limit: 'สูงสุด 1,000 ไบต์ UTF-8',
  size: 'ขนาดภาพ',
  generate: 'สร้าง QR',
  invalid: 'ป้อนเนื้อหาไม่เกิน 1,000 ไบต์',
  scan: 'ทดสอบด้วยโทรศัพท์ก่อนแชร์ บันทึกภาพขนาดใหญ่เมื่อเนื้อหายาว',
  copy: 'คัดลอกภาพ',
  savePng: 'บันทึก PNG',
  empty: 'ป้อนเนื้อหาแล้วเลือกสร้าง QR เพื่อดูตัวอย่าง',
  static: 'QR แบบคงที่ ไม่มีการติดตามการเข้าชม หากเปลี่ยนเนื้อหาต้องสร้างใหม่',
} satisfies Record<keyof typeof zh, string>
export default words
