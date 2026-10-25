/**
 * Cheil fork (2026-10-25): the deployed app runs on the person's own API key
 * (Claude, GPT or Solar, Settings → AI "내 API 키로 연결"). An AI panel with
 * nothing connected leads with that instead of the upstream line ("use the
 * Claude or Codex subscription you already have; no API key needed"), which
 * stays as the subscription heading in Settings. The subscription and free
 * paths stay below as the other ways in.
 *
 * Korean, with English for every other UI language, like the fork's other words.
 */
export interface CheilApiConnectText {
  /** the lead line in place of the upstream one */
  body: string
  /** the button that opens Settings → AI, where the key cards are first */
  button: string
  /** the line before the subscription and free paths */
  or: string
}

export function cheilApiConnectText(lang: string): CheilApiConnectText {
  return lang === 'ko'
    ? {
        body: '가지고 있는 Claude·GPT·Solar API 키를 넣으면 바로 씁니다. 키는 설정 → AI 맨 위에서 넣습니다.',
        button: 'API 키 넣기',
        or: 'Claude·ChatGPT 구독이 있거나 무료로 써 보려면 아래에서 연결합니다.',
      }
    : {
        body: 'Add a Claude, GPT or Solar API key to start. Keys go in at the top of Settings → AI.',
        button: 'Add an API key',
        or: 'With a Claude or ChatGPT subscription, or to try it free, connect below.',
      }
}
