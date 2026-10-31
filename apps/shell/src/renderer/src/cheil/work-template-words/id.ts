/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const id = {
  label: 'Templat dokumen kerja',
  add: 'Tambah templat dokumen',
  adding: 'Menambahkan…',
  hint: 'Tambahkan berkas Word, PowerPoint, atau Excel (maksimal 50 MB), lalu pilih kartunya untuk membuat dokumen.',
  own: 'Ditambahkan oleh saya',
  use: 'Buat dokumen baru',
  loading: 'Memuat templat tersimpan…',
  retry: 'Coba lagi',
  added: 'Templat ditambahkan. Pilih kartunya untuk membuka salinan dokumen baru.',
  failed: 'Templat tidak dapat dimuat. Periksa berkas dan folder penyimpanan, lalu coba lagi.',
  unreadable:
    'Berkas tidak dapat dibaca. Hapus DRM atau kata sandi dan pilih dokumen yang dapat dibuka dengan benar.',
  tooLarge: 'Pilih berkas berukuran maksimal 50 MB.',
  rename: 'Ganti nama',
  remove: 'Hapus',
  renameTitle: 'Ganti nama templat dokumen',
  nameLabel: 'Nama templat',
  nameHint: 'Masukkan nama baru saja. Ekstensi berkas tetap sama.',
  save: 'Simpan',
  cancel: 'Batal',
  deleteTitle: 'Hapus templat dokumen ini?',
  deleteHint:
    'Salinan templat terdaftar akan dipindahkan ke Keranjang Sampah. Berkas asli dan dokumen yang telah dibuat tetap disimpan.',
  confirmDelete: 'Pindahkan ke Keranjang Sampah',
  renamed: 'Nama templat diganti.',
  deleted: 'Templat terdaftar dipindahkan ke Keranjang Sampah.',
  invalidName:
    'Nama tidak valid. Gunakan maksimal 150 karakter tanpa simbol jalur atau nama khusus sistem.',
  exists: 'Templat dengan nama ini sudah ada. Pilih nama lain.',
  working: 'Memproses…',
  changed: 'Templat berubah di tempat lain. Coba lagi melalui kartu yang diperbarui.',
} satisfies Record<keyof typeof zh, string>
