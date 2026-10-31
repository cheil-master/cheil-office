/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'QR 생성',
  offline: '인터넷·서버·가입 없이 이 PC에서 QR을 만듭니다. 입력 내용은 외부로 전송하지 않습니다.',
  content: 'URL 또는 텍스트',
  placeholder: 'https://example.com 또는 QR에 담을 글을 입력하세요.',
  limit: '최대 1,000 UTF-8 바이트',
  size: '이미지 크기',
  generate: 'QR 만들기',
  invalid: '내용을 입력하고 1,000바이트 이하로 줄여 주세요.',
  scan: '배포 전에 휴대폰으로 스캔해 내용을 확인하세요. 긴 내용은 큰 이미지로 저장하세요.',
  copy: '이미지 복사',
  savePng: 'PNG 저장',
  empty: '내용을 입력하고 QR 만들기를 누르면 여기에 표시됩니다.',
  static: '방문 추적이 없는 정적 QR입니다. 저장한 QR의 내용을 바꾸려면 새로 생성해야 합니다.',
} satisfies Record<keyof typeof zh, string>
export default words
