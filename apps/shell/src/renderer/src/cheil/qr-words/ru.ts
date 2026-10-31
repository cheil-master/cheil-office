/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'Создать QR',
  offline:
    'Создавайте QR на этом ПК без интернета, сервера и аккаунта. Содержимое никуда не отправляется.',
  content: 'URL или текст',
  placeholder: 'Введите https://example.com или текст.',
  limit: 'До 1000 байт UTF-8',
  size: 'Размер изображения',
  generate: 'Создать QR',
  invalid: 'Введите содержимое не более 1000 байт.',
  scan: 'Перед отправкой проверьте телефоном. Для длинного текста сохраните большое изображение.',
  copy: 'Копировать изображение',
  savePng: 'Сохранить PNG',
  empty: 'Введите содержимое и нажмите «Создать QR» для просмотра.',
  static: 'Статический QR без учёта посещений. Для изменения содержимого создайте новый код.',
} satisfies Record<keyof typeof zh, string>
export default words
