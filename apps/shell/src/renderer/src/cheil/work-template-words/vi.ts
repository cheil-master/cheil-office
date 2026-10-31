/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const vi = {
  label: 'Mẫu tài liệu công việc',
  add: 'Thêm mẫu tài liệu',
  adding: 'Đang thêm…',
  hint: 'Thêm tệp Word, PowerPoint hoặc Excel (tối đa 50 MB), rồi chọn thẻ để tạo tài liệu mới.',
  own: 'Tôi đã thêm',
  use: 'Tạo tài liệu mới',
  loading: 'Đang tải mẫu đã lưu…',
  retry: 'Thử lại',
  added: 'Đã thêm mẫu. Chọn thẻ để mở bản sao tài liệu mới.',
  failed: 'Không tải được mẫu. Kiểm tra tệp và thư mục lưu trữ rồi thử lại.',
  unreadable: 'Không đọc được tệp. Gỡ DRM hoặc mật khẩu và chọn tài liệu có thể mở bình thường.',
  tooLarge: 'Chọn tệp không quá 50 MB.',
  rename: 'Đổi tên',
  remove: 'Xóa',
  renameTitle: 'Đổi tên mẫu tài liệu',
  nameLabel: 'Tên mẫu',
  nameHint: 'Chỉ nhập tên mới. Phần mở rộng tệp được giữ nguyên.',
  save: 'Lưu',
  cancel: 'Hủy',
  deleteTitle: 'Xóa mẫu tài liệu này?',
  deleteHint:
    'Bản sao mẫu đã đăng ký sẽ được chuyển vào Thùng rác. Tệp gốc và tài liệu đã tạo từ mẫu vẫn được giữ lại.',
  confirmDelete: 'Chuyển vào Thùng rác',
  renamed: 'Đã đổi tên mẫu.',
  deleted: 'Đã chuyển mẫu đã đăng ký vào Thùng rác.',
  invalidName:
    'Tên không hợp lệ. Dùng tối đa 150 ký tự, không có ký hiệu đường dẫn hoặc tên dành riêng.',
  exists: 'Đã có mẫu mang tên này. Hãy chọn tên khác.',
  working: 'Đang xử lý…',
  changed: 'Mẫu đã thay đổi ở nơi khác. Hãy thử lại từ thẻ đã làm mới.',
} satisfies Record<keyof typeof zh, string>
