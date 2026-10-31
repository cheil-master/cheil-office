/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'Buat QR',
  offline: 'Buat QR di komputer ini tanpa internet, server, atau akun. Isi tidak dikirim keluar.',
  content: 'URL atau teks',
  placeholder: 'Masukkan https://example.com atau teks.',
  limit: 'Maksimal 1.000 byte UTF-8',
  size: 'Ukuran gambar',
  generate: 'Buat QR',
  invalid: 'Masukkan isi hingga 1.000 byte.',
  scan: 'Uji dengan ponsel sebelum berbagi. Simpan gambar lebih besar untuk isi panjang.',
  copy: 'Salin gambar',
  savePng: 'Simpan PNG',
  empty: 'Masukkan isi dan pilih Buat QR untuk pratinjau.',
  static: 'QR statis tanpa pelacakan kunjungan. Buat kode baru untuk mengubah isi.',
} satisfies Record<keyof typeof zh, string>
export default words
