/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'QR作成',
  offline: 'ネット・サーバー・登録不要で、このPCで作成します。入力内容は外部に送信しません。',
  content: 'URLまたはテキスト',
  placeholder: 'https://example.com または文章を入力してください。',
  limit: '最大1,000 UTF-8バイト',
  size: '画像サイズ',
  generate: 'QRを作成',
  invalid: '1,000バイト以内で内容を入力してください。',
  scan: '配布前にスマートフォンで確認してください。長い内容は大きな画像で保存してください。',
  copy: '画像をコピー',
  savePng: 'PNGを保存',
  empty: '内容を入力してQRを作成すると、ここに表示されます。',
  static: '訪問追跡のない静的QRです。内容変更には再作成が必要です。',
} satisfies Record<keyof typeof zh, string>
export default words
