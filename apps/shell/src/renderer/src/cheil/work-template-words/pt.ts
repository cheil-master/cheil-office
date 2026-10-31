/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const pt = {
  label: 'Modelos de documentos de trabalho',
  add: 'Adicionar modelo',
  adding: 'Adicionando…',
  hint: 'Adicione um arquivo Word, PowerPoint ou Excel (até 50 MB) e selecione o cartão para criar um documento.',
  own: 'Adicionado por mim',
  use: 'Criar documento',
  loading: 'Carregando modelos salvos…',
  retry: 'Tentar novamente',
  added: 'Modelo adicionado. O cartão abre uma nova cópia do documento.',
  failed:
    'Não foi possível carregar o modelo. Verifique o arquivo e a pasta de armazenamento e tente novamente.',
  unreadable:
    'Não foi possível ler o arquivo. Remova o DRM ou a senha e escolha um documento válido.',
  tooLarge: 'Escolha um arquivo de até 50 MB.',
  rename: 'Renomear',
  remove: 'Excluir',
  renameTitle: 'Renomear modelo de documento',
  nameLabel: 'Nome do modelo',
  nameHint: 'Digite apenas o novo nome. A extensão será mantida.',
  save: 'Salvar',
  cancel: 'Cancelar',
  deleteTitle: 'Excluir este modelo?',
  deleteHint:
    'A cópia registrada do modelo será movida para a Lixeira. O arquivo original e os documentos criados serão mantidos.',
  confirmDelete: 'Mover para a Lixeira',
  renamed: 'Modelo renomeado.',
  deleted: 'Modelo registrado movido para a Lixeira.',
  invalidName: 'Nome inválido. Use até 150 caracteres sem símbolos de caminho ou nomes reservados.',
  exists: 'Já existe um modelo com esse nome. Escolha outro.',
  working: 'Processando…',
  changed: 'O modelo foi alterado em outro lugar. Tente novamente pelo cartão atualizado.',
} satisfies Record<keyof typeof zh, string>
