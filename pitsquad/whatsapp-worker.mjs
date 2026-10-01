const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

async function privilegedRpc(env, name, payload) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return { ok: false, status: 500, error: 'MISSING_PRIVILEGED_KEY' };

  const response = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: key,
      authorization: 'Bearer ' + key
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!response.ok) {
    return { ok: false, status: response.status, error: data || text || 'PRIVILEGED_RPC_FAILED' };
  }
  return { ok: true, status: response.status, data };
}

const hex = (bytes) => Array.from(new Uint8Array(bytes))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('');

async function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret || !signatureHeader.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody)
  );
  const expected = 'sha256=' + hex(digest);
  if (expected.length !== signatureHeader.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function handleWhatsAppWebhook(request, env, url) {
  const path = '/api/pitsquad/whatsapp/webhook';
  if (url.pathname !== path) return null;

  if (request.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const rawBody = await request.text();
  if (rawBody.length > 1024 * 1024) return json({ ok: false, reason: 'PAYLOAD_TOO_LARGE' }, 413);

  const signature = request.headers.get('x-hub-signature-256') || '';
  if (!(await verifyMetaSignature(rawBody, signature, env.WHATSAPP_APP_SECRET))) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body = null;
  try { body = JSON.parse(rawBody); }
  catch { return json({ ok: false, reason: 'INVALID_JSON' }, 400); }

  const ingested = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== 'messages') continue;
      for (const message of Array.isArray(change?.value?.messages) ? change.value.messages : []) {
        if (message?.type !== 'text') continue;
        const messageId = String(message?.id || '').trim();
        const from = String(message?.from || '').trim();
        const textBody = String(message?.text?.body || '');
        if (!messageId || !from) continue;

        const rpc = await privilegedRpc(env, 'pitsquad_ingest_whatsapp_message_v0', {
          p_message_id: messageId,
          p_whatsapp: from,
          p_text: textBody
        });

        ingested.push({
          message_id: messageId,
          ok: rpc.ok,
          state: rpc.data?.state || null
        });
      }
    }
  }

  return json({ ok: true, received: ingested.length, ingested });
}
