// Cheil fork: read only the provider's own API through its existing signed-in tab.
// This isolated-world script never reads cookie stores or sends credentials to the office.
(() => {
  const allowedPath = (host, path) => host === 'chatgpt.com'
    ? /^\/(?:api\/auth\/session|backend-api\/(?:accounts\/check\/v4-2023-04-27|conversations|conversation\/[\w-]+))$/.test(path)
    : host === 'claude.ai' && /^\/api\/organizations(?:\/[\w-]+\/chat_conversations(?:\/[\w-]+)?)?$/.test(path);
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || message?.op !== 'journal-provider-fetch') return;
    void (async () => {
      const url = new URL(message.url);
      if (url.origin !== location.origin || url.username || url.password || url.hash || !allowedPath(url.hostname, url.pathname)) throw Error('PATH');
      const headers = {};
      for (const [key, value] of Object.entries(message.headers ?? {})) {
        if (!['authorization', 'chatgpt-account-id'].includes(key.toLowerCase()) || typeof value !== 'string' || value.length > 16000 || /[\r\n]/.test(value)) throw Error('HEADER');
        headers[key] = value;
      }
      const response = await fetch(url.href, { method: 'GET', credentials: 'include', headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
      let data = null;
      if (response.ok) {
        const body = await response.text();
        if (body.length > 12 * 1024 * 1024) throw Error('SIZE');
        data = JSON.parse(body);
      }
      return { officeJournal: true, status: response.status, retryAfter: response.headers.get('retry-after'), data };
    })().then(reply, () => reply({ officeJournal: true, error: 'TAB_REQUEST' }));
    return true;
  });
})();
