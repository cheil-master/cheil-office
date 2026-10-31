/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'Cipta QR',
  offline:
    'Cipta QR pada komputer ini tanpa internet, pelayan atau akaun. Kandungan tidak dihantar keluar.',
  content: 'URL atau teks',
  placeholder: 'Masukkan https://example.com atau teks.',
  limit: 'Maksimum 1,000 bait UTF-8',
  size: 'Saiz imej',
  generate: 'Cipta QR',
  invalid: 'Masukkan kandungan sehingga 1,000 bait.',
  scan: 'Uji dengan telefon sebelum berkongsi. Simpan imej lebih besar untuk kandungan panjang.',
  copy: 'Salin imej',
  savePng: 'Simpan PNG',
  empty: 'Masukkan kandungan dan pilih Cipta QR untuk pratonton.',
  static: 'QR statik tanpa penjejakan lawatan. Cipta kod baharu untuk menukar kandungan.',
} satisfies Record<keyof typeof zh, string>
export default words
