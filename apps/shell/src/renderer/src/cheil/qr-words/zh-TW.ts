/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: '產生QR碼',
  offline: '在本機產生，無需網路、伺服器或帳號。輸入內容不會傳送至外部。',
  content: '網址或文字',
  placeholder: '輸入 https://example.com 或要編碼的文字。',
  limit: '最多1,000個UTF-8位元組',
  size: '圖片尺寸',
  generate: '產生QR碼',
  invalid: '請輸入不超過1,000位元組的內容。',
  scan: '分享前用手機掃描確認。內容較長時請儲存大圖。',
  copy: '複製圖片',
  savePng: '儲存PNG',
  empty: '輸入內容並按產生QR碼，即可預覽。',
  static: '靜態QR碼，不追蹤造訪。修改內容需重新產生。',
} satisfies Record<keyof typeof zh, string>
export default words
