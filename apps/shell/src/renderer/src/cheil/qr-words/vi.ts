/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'Tạo QR',
  offline:
    'Tạo QR trên máy tính này mà không cần Internet, máy chủ hay tài khoản. Nội dung không được gửi đi.',
  content: 'URL hoặc văn bản',
  placeholder: 'Nhập https://example.com hoặc văn bản.',
  limit: 'Tối đa 1.000 byte UTF-8',
  size: 'Kích thước ảnh',
  generate: 'Tạo QR',
  invalid: 'Nhập nội dung tối đa 1.000 byte.',
  scan: 'Quét thử bằng điện thoại trước khi chia sẻ. Lưu ảnh lớn hơn cho nội dung dài.',
  copy: 'Sao chép ảnh',
  savePng: 'Lưu PNG',
  empty: 'Nhập nội dung và chọn Tạo QR để xem trước.',
  static: 'QR tĩnh, không theo dõi lượt truy cập. Tạo mã mới để thay đổi nội dung.',
} satisfies Record<keyof typeof zh, string>
export default words
