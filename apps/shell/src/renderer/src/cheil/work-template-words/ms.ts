/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const ms = {
  label: 'Templat dokumen kerja',
  add: 'Tambah templat dokumen',
  adding: 'Sedang menambah…',
  hint: 'Tambah fail Word, PowerPoint atau Excel (sehingga 50 MB), kemudian pilih kad untuk mencipta dokumen.',
  own: 'Ditambah oleh saya',
  use: 'Cipta dokumen baharu',
  loading: 'Memuatkan templat tersimpan…',
  retry: 'Cuba lagi',
  added: 'Templat ditambah. Pilih kadnya untuk membuka salinan dokumen baharu.',
  failed: 'Templat tidak dapat dimuatkan. Semak fail dan folder simpanan, kemudian cuba lagi.',
  unreadable:
    'Fail tidak dapat dibaca. Buang perlindungan DRM atau kata laluan dan pilih dokumen yang boleh dibuka.',
  tooLarge: 'Pilih fail tidak melebihi 50 MB.',
  rename: 'Namakan semula',
  remove: 'Padam',
  renameTitle: 'Namakan semula templat dokumen',
  nameLabel: 'Nama templat',
  nameHint: 'Masukkan nama baharu sahaja. Sambungan fail dikekalkan.',
  save: 'Simpan',
  cancel: 'Batal',
  deleteTitle: 'Padam templat dokumen ini?',
  deleteHint:
    'Salinan templat berdaftar akan dipindahkan ke Tong Kitar Semula. Fail asal dan dokumen yang dicipta daripadanya dikekalkan.',
  confirmDelete: 'Pindah ke Tong Kitar Semula',
  renamed: 'Templat dinamakan semula.',
  deleted: 'Templat berdaftar dipindahkan ke Tong Kitar Semula.',
  invalidName:
    'Nama tidak sah. Gunakan sehingga 150 aksara tanpa simbol laluan atau nama simpanan sistem.',
  exists: 'Templat dengan nama ini sudah wujud. Pilih nama lain.',
  working: 'Sedang memproses…',
  changed: 'Templat diubah di tempat lain. Cuba lagi melalui kad yang dikemas kini.',
} satisfies Record<keyof typeof zh, string>
