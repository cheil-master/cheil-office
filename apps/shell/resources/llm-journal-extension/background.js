// Cheil fork: hstry collectors with a paired, forward-only office recording gate.
import { syncChatGPT } from './providers/chatgpt.js';
import { syncClaude } from './providers/claude.js';
import { NotLoggedInError, setProviderFetch } from './lib/common.js';
import { createProviderFetch } from './provider-transport.js';
setProviderFetch(createProviderFetch(chrome));
import { officeRequest as office, diagnosticCode } from './office-link.js';

let running = false;
export async function syncNow() {
  if (running) return { ok: true, status: 'syncing' };
  running = true;
  try {
    const { connection, cursors = {}, captureSince } = await chrome.storage.local.get(['connection', 'cursors', 'captureSince']);
    const health = await office(connection, '/health');
    if (!health.capture?.enabled || !Number.isFinite(health.capture.since)) return { ok: true, status: 'paused' };
    const cutoff = health.capture.since;
    const current = captureSince === cutoff ? cursors : {};
    const providers = {};
    for (const [provider, collect] of [['chatgpt', syncChatGPT], ['claude', syncClaude]]) {
      const check = await office(connection, '/health');
      if (!check.capture?.enabled || check.capture.since !== cutoff) break;
      await office(connection, '/status', { provider, status: 'syncing' });
      try {
        let providerFailed = false;
        const result = await collect({
          state: current[provider] ?? {}, cutoffMs: cutoff,
          register: async () => {}, log: () => { providerFailed = true; },
          push: async (source, adapter, conversations) => {
            const selected = conversations.map(conversation => ({
              externalId: conversation.externalId,
              metadata: { url: conversation.metadata?.url },
              messages: conversation.messages.filter(message =>
                ['user', 'assistant'].includes(message.role) &&
                Number.isFinite(message.createdAt) && message.createdAt >= cutoff &&
                typeof message.content === 'string' && !!message.content.trim()
              ).map(({ role, content, createdAt, externalId }) => ({ role, content, createdAt, externalId })),
            }));
            await office(connection, '/ingest', { source, adapter, conversations: selected });
            return conversations.length;
          },
        });
        current[provider] = result.state;
        providers[provider] = providerFailed ? 'failed' : 'received';
        await office(connection, '/status', { provider, status: providerFailed ? 'failed' : 'ok' });
      } catch (error) {
        providers[provider] = error instanceof NotLoggedInError ? 'signIn' : 'failed';
        await office(connection, '/status', { provider, status: error instanceof NotLoggedInError ? 'signed-out' : 'failed' }).catch(() => {});
      }
    }
    await chrome.storage.local.set({ cursors: current, captureSince: cutoff, lastSync: Date.now() });
    return { ok: true, status: 'received', providers };
  } catch (error) {
    return { ok: false, status: 'failed', code: diagnosticCode(error) };
  } finally { running = false; }
}

chrome.action.onClicked.addListener(() => { void chrome.runtime.openOptionsPage(); });
chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create('office-journal', { periodInMinutes: 5 }); });
chrome.runtime.onStartup.addListener(() => { chrome.alarms.create('office-journal', { periodInMinutes: 5 }); void syncNow(); });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'office-journal') void syncNow(); });
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !['pair', 'sync'].includes(message?.op)) return;
  void (async () => {
    if (message.op === 'pair') {
      const { port, token } = message.connection ?? {};
      const connection = { port, token };
      await office(connection, '/health');
      await chrome.storage.local.set({ connection, cursors: {}, captureSince: null });
      return { ok: true, status: 'paired' };
    }
    return syncNow();
  })().then(reply, error => reply({ ok: false, status: 'failed', code: diagnosticCode(error) }));
  return true;
});
