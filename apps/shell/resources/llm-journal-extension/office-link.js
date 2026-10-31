// Cheil fork: one bounded local transport, shared by the setup document and worker.
export function checkedConnection(value) {
  if (value?.port !== 41871 || typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token.trim())) throw Error('CONFIG');
  return { port: 41871, token: value.token.trim() };
}

export async function officeRequest(value, path, body) {
  const connection = checkedConnection(value);
  if (!['/health', '/status', '/ingest'].includes(path)) throw Error('CONFIG');
  let response;
  try {
    response = await fetch(`http://127.0.0.1:41871${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${connection.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw Error('NETWORK'); }
  if (!response.ok) throw Error(`HTTP_${response.status}`);
  try { return await response.json(); } catch { throw Error('RESPONSE'); }
}

export function diagnosticCode(error) {
  return /^(CONFIG|NETWORK|RESPONSE|WORKER|PAIR_EXPIRED|HTTP_\d{3})$/.test(error?.message ?? '') ? error.message : 'WORKER';
}

export async function pairingRequest(operation, identity) {
  if (!['request', 'complete'].includes(operation) || !/^[a-p]{32}$/.test(identity?.id ?? '') || !/^[a-f0-9]{64}$/.test(identity?.nonce ?? '')) throw Error('CONFIG');
  let response;
  try {
    response = await fetch(`http://127.0.0.1:41871/pair/${operation}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(identity), signal: AbortSignal.timeout(15000) });
  } catch { throw Error('NETWORK'); }
  if (!response.ok) throw Error(`HTTP_${response.status}`);
  try { return await response.json(); } catch { throw Error('RESPONSE'); }
}
