/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'Crear QR',
  offline:
    'Cree códigos QR en este equipo sin Internet, servidor ni cuenta. No se envía el contenido.',
  content: 'URL o texto',
  placeholder: 'Introduzca https://example.com o texto.',
  limit: 'Máximo 1.000 bytes UTF-8',
  size: 'Tamaño de imagen',
  generate: 'Crear QR',
  invalid: 'Introduzca contenido de hasta 1.000 bytes.',
  scan: 'Compruebe con el móvil antes de compartir. Use imágenes grandes para contenido largo.',
  copy: 'Copiar imagen',
  savePng: 'Guardar PNG',
  empty: 'Introduzca contenido y pulse Crear QR para ver la vista previa.',
  static: 'QR estático sin seguimiento de visitas. Genere uno nuevo para cambiar el contenido.',
} satisfies Record<keyof typeof zh, string>
export default words
