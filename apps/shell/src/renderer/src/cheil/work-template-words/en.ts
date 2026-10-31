/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const en = {
  label: 'Work document templates',
  add: 'Add document template',
  adding: 'Adding…',
  hint: 'Keep the content and formatting of a Word, PowerPoint or Excel file (up to 50 MB), then reuse it as a new document copy.',
  own: 'Added by me',
  use: 'Create new document',
  loading: 'Loading saved templates…',
  retry: 'Try again',
  added: 'Template added. Select its card to open a new document copy.',
  failed: 'Could not load the template. Check the file and storage folder, then try again.',
  unreadable:
    'Could not read this file. Remove DRM or password protection and choose a document that opens correctly.',
  tooLarge: 'Choose a file no larger than 50 MB.',
  rename: 'Rename',
  remove: 'Delete',
  renameTitle: 'Rename document template',
  nameLabel: 'Template name',
  nameHint: 'Enter the new name only. The file extension stays the same.',
  save: 'Save',
  cancel: 'Cancel',
  deleteTitle: 'Delete this document template?',
  deleteHint:
    'Move the registered template copy to the Recycle Bin. The original file and documents created from it are kept.',
  confirmDelete: 'Move to Recycle Bin',
  renamed: 'Template renamed.',
  deleted: 'Registered template moved to the Recycle Bin.',
  invalidName: 'Invalid name. Use up to 150 characters without path symbols or reserved names.',
  exists: 'A template with this name already exists. Choose another name.',
  working: 'Working…',
  changed: 'The template changed elsewhere. Try again using the refreshed card.',
} satisfies Record<keyof typeof zh, string>
