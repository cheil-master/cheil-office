/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'QR generator',
  offline:
    'Create QR codes on this PC without internet, a server or an account. Your input is not sent anywhere.',
  content: 'URL or text',
  placeholder: 'Enter https://example.com or text to encode.',
  limit: 'Up to 1,000 UTF-8 bytes',
  size: 'Image size',
  generate: 'Create QR',
  invalid: 'Enter content of no more than 1,000 bytes.',
  scan: 'Scan with your phone before sharing. Save larger images for longer content.',
  copy: 'Copy image',
  savePng: 'Save PNG',
  empty: 'Enter content and select Create QR to see a preview.',
  static: 'Static QR with no visit tracking. Generate a new code to change its content.',
} satisfies Record<keyof typeof zh, string>
export default words
