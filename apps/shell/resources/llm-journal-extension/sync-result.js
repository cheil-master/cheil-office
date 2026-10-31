// Cheil fork: show each provider's result so an unused login cannot hide a successful capture.
export function syncResultText(result, words) {
  if (result.status === 'paused') return words.paused;
  if (result.providers) {
    return [['chatgpt', 'ChatGPT'], ['claude', 'Claude']]
      .filter(([provider]) => result.providers[provider])
      .map(([provider, label]) => `${label}: ${words[result.providers[provider]] ?? words.failed}`)
      .join(' · ') || words.waiting;
  }
  return words[result.status] ?? words.waiting;
}
