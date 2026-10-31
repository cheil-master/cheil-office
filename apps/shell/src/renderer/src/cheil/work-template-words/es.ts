/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const es = {
  label: 'Plantillas de documentos de trabajo',
  add: 'Añadir plantilla',
  adding: 'Añadiendo…',
  hint: 'Añada un archivo Word, PowerPoint o Excel (hasta 50 MB) y seleccione su tarjeta para crear un documento.',
  own: 'Añadida por mí',
  use: 'Crear documento',
  loading: 'Cargando plantillas guardadas…',
  retry: 'Reintentar',
  added: 'Plantilla añadida. Su tarjeta abre una nueva copia del documento.',
  failed:
    'No se pudo cargar la plantilla. Revise el archivo y la carpeta de almacenamiento e inténtelo de nuevo.',
  unreadable:
    'No se pudo leer el archivo. Quite la protección DRM o la contraseña y elija un documento válido.',
  tooLarge: 'Elija un archivo de hasta 50 MB.',
  rename: 'Cambiar nombre',
  remove: 'Eliminar',
  renameTitle: 'Cambiar nombre de plantilla',
  nameLabel: 'Nombre de la plantilla',
  nameHint: 'Introduzca solo el nuevo nombre. Se conserva la extensión.',
  save: 'Guardar',
  cancel: 'Cancelar',
  deleteTitle: '¿Eliminar esta plantilla?',
  deleteHint:
    'La copia registrada de la plantilla se moverá a la papelera. Se conservarán el archivo original y los documentos creados.',
  confirmDelete: 'Mover a la papelera',
  renamed: 'Nombre de plantilla cambiado.',
  deleted: 'Plantilla registrada movida a la papelera.',
  invalidName:
    'Nombre no válido. Use hasta 150 caracteres sin símbolos de ruta ni nombres reservados.',
  exists: 'Ya existe una plantilla con ese nombre. Elija otro.',
  working: 'Procesando…',
  changed: 'La plantilla cambió en otro lugar. Inténtelo de nuevo desde la tarjeta actualizada.',
} satisfies Record<keyof typeof zh, string>
