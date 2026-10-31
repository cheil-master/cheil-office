/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const ja = {
  label: '業務用ドキュメントテンプレート',
  add: 'テンプレートを追加',
  adding: '追加中…',
  hint: 'Word・PowerPoint・Excel ファイル（最大50 MB）を追加し、カードから新しい文書を作成できます。',
  own: '自分で追加',
  use: '新しい文書を作成',
  loading: '保存済みテンプレートを読み込み中…',
  retry: '再試行',
  added: 'テンプレートを追加しました。カードから新しい文書のコピーを開けます。',
  failed: 'テンプレートを読み込めませんでした。ファイルと保存先を確認して再試行してください。',
  unreadable:
    'ファイルを読めませんでした。DRM・パスワード保護を解除し、正常に開ける文書を選んでください。',
  tooLarge: '50 MB以下のファイルを選んでください。',
  rename: '名前を変更',
  remove: '削除',
  renameTitle: '文書テンプレートの名前を変更',
  nameLabel: 'テンプレート名',
  nameHint: '新しい名前だけを入力してください。拡張子は変わりません。',
  save: '保存',
  cancel: 'キャンセル',
  deleteTitle: 'この文書テンプレートを削除しますか？',
  deleteHint:
    '登録したテンプレートのコピーをごみ箱に移動します。元のファイルと作成済みの文書は残ります。',
  confirmDelete: 'ごみ箱に移動',
  renamed: 'テンプレート名を変更しました。',
  deleted: '登録したテンプレートをごみ箱に移動しました。',
  invalidName: '無効な名前です。パス記号や予約名を使わず150文字以内で入力してください。',
  exists: '同じ名前のテンプレートがあります。別の名前を入力してください。',
  working: '処理中…',
  changed: 'テンプレートが別の場所で変更されました。更新されたカードから再試行してください。',
} satisfies Record<keyof typeof zh, string>
