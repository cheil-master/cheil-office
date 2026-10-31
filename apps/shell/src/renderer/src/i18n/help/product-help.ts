/** Cheil fork: product workflows replace inherited startup and connection guides. */
import { createI18n, productName, type Lang } from '@genoffice/i18n'
import { strings } from '../../strings'
import { productCopy, productCopyOverrides, programConnectionHint } from '../../cheil/product-copy'
import { designWords } from '../../cheil/design-words'
import { topicTitle } from './help-titles'

const translate = createI18n(strings)
const OWN_TOPICS = new Set([
  'install',
  'getting-started',
  'home-screen',
  'subscription',
  'ai-models',
  'settings-integrations',
])

export function cheilHelpBody(id: string, lang: Lang): string | null {
  if (!OWN_TOPICS.has(id)) return null
  const w = productCopy(lang)
  const d = designWords(lang)
  const t = (key: keyof typeof strings.zh) =>
    productCopyOverrides(lang)[key] ?? translate(lang, key)
  const heading = `# ${productName(lang)} · ${topicTitle(id, lang)}\n\n`
  if (id === 'install')
    return (
      heading +
      `## CheilOffice\n\n${w.manual}\n\n\`CheilOffice-Setup-<version>.exe\`\n\n## ${t('setLicenses')}\n\n${t('setLicensesDesc')}`
    )
  if (id === 'getting-started' || id === 'home-screen')
    return (
      heading +
      `## ${w.tagline}\n\n${w.welcome}\n\n- ${d.apps}: Word · Excel · PPT · Markdown · HTML · XMind · HWP · PDF\n- ${d.campaigns}: OT · DOCX · XLSX · PPTX\n- ${t('secRecent')}: ${t('openLocal')}\n- ${d.tools}: ${t('pdfToolsCard')}\n\n## ${w.ai}\n\n${w.offline}`
    )
  if (id === 'subscription' || id === 'ai-models')
    return (
      heading +
      `## ${w.ai}\n\n${w.offline}\n\n### ${t('setAiUse')}\n\n${t('setAiUseDesc')}\n\n### API\n\nClaude · OpenAI · Solar · OpenRouter\n\n### ${w.programs}\n\n${programConnectionHint(lang)}\n\n### ${w.additional}\n\n${w.additionalBody}\n\n## ${t('setAiNotice')}\n\n${t('setAiNoticeView')}`
    )
  return (
    heading +
    `## ${t('settings')}\n\n- ${w.ai}\n- ${t('setSecGeneral')}\n- ${t('setSecAbout')}\n\n## ${w.developer}\n\nMCP · CLI\n\n\`ieumoffice --help\`\n\n## ${t('versionLabel')}\n\n${w.manual}\n\n## ${t('setLicenses')}\n\n${t('setLicensesDesc')}`
  )
}
