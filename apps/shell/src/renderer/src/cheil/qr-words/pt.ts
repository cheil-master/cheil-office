/** Cheil fork: local QR tool translations. */
import type zh from './zh'
const words = {
  title: 'Criar QR',
  offline:
    'Crie códigos QR neste computador sem internet, servidor ou conta. O conteúdo não é enviado.',
  content: 'URL ou texto',
  placeholder: 'Digite https://example.com ou texto.',
  limit: 'Até 1.000 bytes UTF-8',
  size: 'Tamanho da imagem',
  generate: 'Criar QR',
  invalid: 'Digite conteúdo de até 1.000 bytes.',
  scan: 'Teste com o celular antes de compartilhar. Use imagens maiores para conteúdo longo.',
  copy: 'Copiar imagem',
  savePng: 'Salvar PNG',
  empty: 'Digite conteúdo e selecione Criar QR para visualizar.',
  static: 'QR estático sem rastreamento de visitas. Gere outro código para alterar o conteúdo.',
} satisfies Record<keyof typeof zh, string>
export default words
