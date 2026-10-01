import runtimeModule from '../ferramentas/external-calc-runtime/v0/runtime.js';
import trackedModelModule from '../ferramentas/external-calc-tracked-model/v0/tracked-model-api.js';

const { createExternalCalcWorkerRuntime } = runtimeModule;
const { createTrackedModelApiV0 } = trackedModelModule;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

async function supabaseRpc(env, name, payload) {
  const response = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'apikey': env.SUPABASE_ANON_KEY,
      'authorization': 'Bearer ' + env.SUPABASE_ANON_KEY
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!response.ok) {
    return { ok: false, status: response.status, error: data || text || 'SUPABASE_RPC_FAILED' };
  }

  return { ok: true, status: response.status, data };
}

async function serviceRoleRpc(env, name, payload) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, status: 500, error: 'MISSING_SERVICE_ROLE_KEY' };
  }

  const response = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!response.ok) {
    return { ok: false, status: response.status, error: data || text || 'SUPABASE_SERVICE_RPC_FAILED' };
  }

  return { ok: true, status: response.status, data };
}

const hex = (bytes) => Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');

async function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret) return false;
  if (!signatureHeader.startsWith('sha256=')) return false;

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

async function handleWhatsAppWebhook(request, env, url) {
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

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const rawBody = await request.text();
  if (rawBody.length > 1024 * 1024) {
    return json({ ok: false, reason: 'PAYLOAD_TOO_LARGE' }, 413);
  }

  const signature = request.headers.get('x-hub-signature-256') || '';
  const valid = await verifyMetaSignature(rawBody, signature, env.WHATSAPP_APP_SECRET);
  if (!valid) return new Response('Unauthorized', { status: 401 });

  let body = null;
  try { body = JSON.parse(rawBody); } catch { return json({ ok: false, reason: 'INVALID_JSON' }, 400); }

  const ingested = [];
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field !== 'messages') continue;
      const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];

      for (const message of messages) {
        if (message?.type !== 'text') continue;
        const messageId = String(message?.id || '').trim();
        const from = String(message?.from || '').trim();
        const textBody = String(message?.text?.body || '');

        if (!messageId || !from) continue;

        const rpc = await serviceRoleRpc(env, 'pitsquad_ingest_whatsapp_message_v0', {
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

function landingHtml(token) {
  const safeToken = esc(token);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pitstop Imports</title>
<style>
:root{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;background:#f8fafc}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
main{width:min(100%,460px);background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.07)}
.brand{font-weight:750;font-size:15px;margin-bottom:34px}.eyebrow{font-size:12px;color:#64748b;margin-bottom:7px}
h1{font-size:30px;line-height:1.05;letter-spacing:-.04em;margin:0 0 10px}p{color:#64748b;line-height:1.5;margin:0 0 22px}
label{display:block;font-size:12px;font-weight:650;margin-bottom:7px}
input{width:100%;height:48px;border:1px solid #cbd5e1;border-radius:11px;padding:0 13px;font:inherit;outline:none}
input:focus{border-color:#2878f0;box-shadow:0 0 0 3px rgba(40,120,240,.12)}
button{margin-top:11px;width:100%;height:48px;border:0;border-radius:11px;background:#2878f0;color:#fff;font:700 14px inherit;cursor:pointer}
button:disabled{opacity:.55;cursor:wait}.msg{min-height:20px;margin-top:11px;font-size:12px}.ok{color:#237a47}.err{color:#b42318}
small{display:block;margin-top:26px;color:#94a3b8;font-size:10px;line-height:1.4}
</style>
</head>
<body>
<main>
  <div class="brand">Pitstop Imports</div>
  <div class="eyebrow" id="eyebrow">Atendimento</div>
  <h1 id="title">Vamos continuar pelo WhatsApp.</h1>
  <p>Informe seu número. A equipe recebe seu contato junto com a referência correta desta ação.</p>
  <form id="form"><input id="company" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0">
    <label for="whatsapp">Seu WhatsApp</label>
    <input id="whatsapp" name="whatsapp" inputmode="tel" autocomplete="tel" placeholder="(21) 99999-9999" required>
    <button id="submit" type="submit">Quero atendimento</button>
    <div class="msg" id="msg"></div>
  </form>
  <small>Seu número será usado pela Pitstop para dar continuidade ao atendimento solicitado.</small>
</main>
<script>
const token=${JSON.stringify(safeToken)};
const form=document.getElementById('form');
const btn=document.getElementById('submit');
const msg=document.getElementById('msg');
fetch('/api/pitsquad/acquisition/action/'+encodeURIComponent(token))
  .then(r=>r.json()).then(d=>{
    if(d&&d.ok&&d.label) document.getElementById('eyebrow').textContent=d.label;
  }).catch(()=>{});
form.addEventListener('submit',async(e)=>{
  e.preventDefault();
  msg.className='msg';msg.textContent='';btn.disabled=true;
  try{
    const r=await fetch('/api/pitsquad/acquisition/capture',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({token,whatsapp:document.getElementById('whatsapp').value,company:document.getElementById('company').value})
    });
    const d=await r.json();
    if(!r.ok||!d.ok) throw new Error(d.reason||'CAPTURE_FAILED');
    form.querySelector('input').disabled=true;btn.disabled=true;
    btn.textContent='Contato enviado';
    msg.className='msg ok';
    msg.textContent='Pronto. A equipe da Pitstop já pode identificar de qual ação veio seu contato.';
  }catch(err){
    btn.disabled=false;msg.className='msg err';
    msg.textContent='Não foi possível registrar agora. Confira o número e tente novamente.';
  }
});
</script>
</body>
</html>`;
}

async function handlePitsquad(request, env, url) {
  if (request.method === 'GET' && url.pathname.startsWith('/a/')) {
    const token = url.pathname.slice(3).trim();
    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      return new Response('Link inválido.', { status: 404 });
    }
    return new Response(landingHtml(token), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow'
      }
    });
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/pitsquad/acquisition/action/')) {
    const token = url.pathname.split('/').pop() || '';
    if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ ok: false, reason: 'INVALID_TOKEN' }, 400);

    const rpc = await supabaseRpc(env, 'pitsquad_public_acquisition_action_v0', { p_token: token });
    if (!rpc.ok) return json({ ok: false, reason: 'ACTION_LOOKUP_FAILED' }, 502);
    return json(rpc.data || { ok: false, state: 'NOT_FOUND' });
  }

  if (request.method === 'POST' && url.pathname === '/api/pitsquad/acquisition/capture') {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 2048) return json({ ok: false, reason: 'PAYLOAD_TOO_LARGE' }, 413);

    let body = null;
    try { body = await request.json(); } catch { return json({ ok: false, reason: 'INVALID_JSON' }, 400); }
    const token = String(body?.token || '').trim();
    const whatsapp = String(body?.whatsapp || '').trim();
    const company = String(body?.company || '').trim();

    if (company) return json({ ok: false, reason: 'BOT_REJECTED' }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ ok: false, reason: 'INVALID_TOKEN' }, 400);
    if (!whatsapp || whatsapp.length > 40) return json({ ok: false, reason: 'INVALID_WHATSAPP' }, 400);

    const rpc = await supabaseRpc(env, 'pitsquad_public_capture_acquisition_v0', {
      p_token: token,
      p_whatsapp: whatsapp
    });

    if (!rpc.ok) return json({ ok: false, reason: 'CAPTURE_RPC_FAILED' }, 502);
    return json(rpc.data || { ok: false, reason: 'EMPTY_RPC_RESPONSE' }, rpc.data?.ok ? 200 : 400);
  }

  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const whatsappWebhook = await handleWhatsAppWebhook(request, env, url);
    if (whatsappWebhook) return whatsappWebhook;

    const pitsquad = await handlePitsquad(request, env, url);
    if (pitsquad) return pitsquad;

    const trackedModelApi = createTrackedModelApiV0({ env });
    if (trackedModelApi.matches(url.pathname)) return trackedModelApi.handle(request);

    const runtime = createExternalCalcWorkerRuntime({ env });
    return runtime.fetch(request);
  }
};
