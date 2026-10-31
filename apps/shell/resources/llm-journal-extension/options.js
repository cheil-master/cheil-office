import { syncResultText } from './sync-result.js';
// Cheil fork: no connection secrets are copied; the office approves a short-lived request.
import { checkedConnection, pairingRequest, diagnosticCode } from './office-link.js';
const locales = await (await fetch(chrome.runtime.getURL('locales.json'))).json();
const language = navigator.language === 'zh-TW' ? 'zh-TW' : navigator.language.split('-')[0];
const w = locales[language] ?? locales.en;
for (const [id, text] of Object.entries({ title: w.title, intro: w.intro, label: w.step2, pair: w.connect, sync: w.sync, local: w.local })) document.getElementById(id).textContent = text;
const status = document.getElementById('status');
const codeElement = document.getElementById('pair-code');
async function run(op) {
  const buttons = [...document.querySelectorAll('button')];
  buttons.forEach(button => { button.disabled = true; });
  try {
    let connection;
    if (op === 'pair') {
      const nonce = [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, '0')).join('');
      const identity = { id: chrome.runtime.id, nonce };
      const request = await pairingRequest('request', identity);
      codeElement.textContent = request.code;
      status.textContent = w.step2;
      for (let attempt = 0; attempt < 85; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const result = await pairingRequest('complete', identity);
        if (result.paired) { connection = checkedConnection(result.connection); break; }
      }
      if (!connection) throw Error('PAIR_EXPIRED');
    }
    const result = await chrome.runtime.sendMessage({ op, ...(op === 'pair' ? { connection } : {}) });
    if (!result?.ok) throw Error(result?.code || 'WORKER');
    status.textContent = syncResultText(result, w);
    codeElement.textContent = '';
    if (op === 'pair') void chrome.runtime.sendMessage({ op: 'sync' });
  } catch (error) { status.textContent = `${w.failed} (${diagnosticCode(error)})`; }
  finally { buttons.forEach(button => { button.disabled = false; }); }
}
document.getElementById('pair').addEventListener('click', () => void run('pair'));
document.getElementById('sync').addEventListener('click', () => void run('sync'));
