// Cheil fork: prefer a provider's existing tab; preserve hstry's transport when no tab is ready.
export function createProviderFetch(browser, fallback = (...args) => fetch(...args)) {
  return async (input, init = {}) => {
    const url = new URL(input);
    if (!['https://chatgpt.com', 'https://claude.ai'].includes(url.origin) || url.username || url.password || url.hash || (init.method && init.method !== 'GET') || init.body) throw Error('PROVIDER_REQUEST');
    const tabs = await browser.tabs.query({ url: `${url.origin}/*` });
    tabs.sort((a, b) => Number(!!b.active) - Number(!!a.active) || (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
    for (const tab of tabs.slice(0, 3)) {
      let result;
      try {
        result = await browser.tabs.sendMessage(tab.id, { op: 'journal-provider-fetch', url: url.href, headers: init.headers ?? {} }, { frameId: 0 });
      } catch { continue; } // Existing tabs receive the static script after a normal reload.
      if (!result?.officeJournal) continue;
      if (result.error || !Number.isInteger(result.status) || result.status < 200 || result.status > 599) throw Error('TAB_REQUEST');
      const body = [204, 205, 304].includes(result.status) ? null : JSON.stringify(result.data);
      return new Response(body, { status: result.status, headers: { 'content-type': 'application/json', ...(result.retryAfter ? { 'retry-after': result.retryAfter } : {}) } });
    }
    return fallback(input, init);
  };
}
