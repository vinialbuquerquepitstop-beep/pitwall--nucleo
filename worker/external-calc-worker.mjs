/* deploy-whatsapp-webhook-v1 */
import runtimeModule from '../ferramentas/external-calc-runtime/v0/runtime.js';
import trackedModelModule from '../ferramentas/external-calc-tracked-model/v0/tracked-model-api.js';
import listIntakeModule from '../ferramentas/external-calc-list-intake/v0/list-intake-api.js';
import batchListIntakeModule from '../ferramentas/external-calc-batch-intake/v0/batch-list-intake-api.js';
import { handleWhatsAppWebhook } from '../pitsquad/whatsapp-worker.mjs';

const { createExternalCalcWorkerRuntime } = runtimeModule;
const { createTrackedModelApiV0 } = trackedModelModule;
const { createListIntakeApiV0 } = listIntakeModule;
const { createBatchListIntakeApiV0 } = batchListIntakeModule;

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


async function validateOperatorSession(request, env) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return { ok: false, status: 401 };
  const response = await fetch(env.SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth }
  });
  if (!response.ok) return { ok: false, status: 401 };
  return { ok: true, user: await response.json() };
}

function assistantPrompt(input) {
  return [
    'Você é o Assistente Operacional de WhatsApp da Pitstop Imports.',
    'Sua função é ajudar um operador humano a responder uma mensagem recebida. Você nunca envia mensagens.',
    'Use SOMENTE a mensagem recebida e o contexto CRM fornecido como evidência.',
    'GUARDRAILS OBRIGATÓRIOS:',
    '- nunca invente preço, estoque, garantia, prazo, condição comercial ou desconto;',
    '- se uma informação necessária não estiver na evidência, registre em missing_information e não a afirme no draft;',
    '- não altere status, perfil, cadência ou qualquer dado do CRM;',
    '- não conceda desconto;',
    '- autoridade comercial continua humana;',
    '- requires_human_approval deve ser sempre true;',
    '- evidence_refs deve listar apenas referências realmente presentes no contexto.',
    'Responda em português do Brasil, com draft natural, curto e adequado a WhatsApp.',
    'Mensagem recebida: ' + JSON.stringify(input.message || ''),
    'WhatsApp informado: ' + JSON.stringify(input.whatsapp || ''),
    'Contexto CRM: ' + JSON.stringify(input.context || null)
  ].join('\n');
}

async function handlePitsquadAssistant(request, env, url) {
  if (url.pathname !== '/api/pitsquad/assistant/draft') return null;
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const session = await validateOperatorSession(request, env);
  if (!session.ok) return json({ ok: false, reason: 'UNAUTHORIZED' }, session.status);

  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, reason: 'INVALID_JSON' }, 400); }
  const message = String(body?.message || '').trim();
  const whatsapp = String(body?.whatsapp || '').trim();
  const context = body?.context || null;
  if (!message || message.length > 4000) return json({ ok: false, reason: 'INVALID_MESSAGE' }, 400);
  if (!whatsapp || whatsapp.length > 40) return json({ ok: false, reason: 'INVALID_WHATSAPP' }, 400);
  if (!env.OPENAI_API_KEY) return json({ ok: false, reason: 'AI_NOT_CONFIGURED', recoverable: true, assistant_state: 'MANUAL_ONLY' }, 503);

  const model = env.PITSQUAD_ASSISTANT_OPENAI_MODEL || 'gpt-5.6-luna';
  const maxOutputTokens = Math.min(Math.max(Number(env.PITSQUAD_ASSISTANT_MAX_OUTPUT_TOKENS || 700), 128), 1200);
  const timeoutMs = Math.min(Math.max(Number(env.PITSQUAD_ASSISTANT_TIMEOUT_MS || 12000), 3000), 30000);
  const reasoningEffort = env.PITSQUAD_ASSISTANT_REASONING_EFFORT || 'none';

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      intent: { type: 'string' },
      summary: { type: 'string' },
      missing_information: { type: 'array', items: { type: 'string' } },
      recommended_action: { type: 'string' },
      draft_reply: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      requires_human_approval: { type: 'boolean' },
      evidence_refs: { type: 'array', items: { type: 'string' } }
    },
    required: ['intent','summary','missing_information','recommended_action','draft_reply','confidence','requires_human_approval','evidence_refs']
  };

  let ai = null;
  try {
    ai = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + env.OPENAI_API_KEY
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: reasoningEffort },
        max_output_tokens: maxOutputTokens,
        input: assistantPrompt({ message, whatsapp, context }),
        text: { format: { type: 'json_schema', name: 'pitsquad_assistant_output', strict: true, schema } }
      })
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return json({
      ok: false,
      reason: timedOut ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE',
      recoverable: true,
      assistant_state: 'MANUAL_ONLY'
    }, 503);
  }
  const raw = await ai.json().catch(() => null);
  if (!ai.ok) {
    const providerCode = raw?.error?.code || null;
    const creditsRequired = ai.status === 429 && ['credit_balance_exhausted', 'insufficient_quota'].includes(providerCode || raw?.error?.type);
    return json({
      ok: false,
      reason: creditsRequired ? 'AI_CREDITS_REQUIRED' : 'AI_FAILED',
      recoverable: true,
      assistant_state: 'MANUAL_ONLY'
    }, creditsRequired ? 503 : 502);
  }
  let outputText = raw?.output_text || '';
  if (!outputText && Array.isArray(raw?.output)) {
    for (const item of raw.output) for (const part of (item?.content || [])) {
      if (part?.type === 'output_text' && part?.text) outputText += part.text;
    }
  }
  let output = null;
  try { output = JSON.parse(outputText); } catch { return json({ ok: false, reason: 'AI_INVALID_OUTPUT' }, 502); }
  output.requires_human_approval = true;
  const allowedRefs = [];
  if (context?.lead?.lead_code) allowedRefs.push('CRM:lead:' + context.lead.lead_code);
  for (const ev of (Array.isArray(context?.events) ? context.events : [])) if (ev?.id) allowedRefs.push('CRM:lead_evento:' + ev.id);
  for (const acq of (Array.isArray(context?.acquisition) ? context.acquisition : [])) if (acq?.id) allowedRefs.push('CRM:acquisition_input:' + acq.id);
  output.evidence_refs = (Array.isArray(output.evidence_refs) ? output.evidence_refs : []).filter((ref) => allowedRefs.includes(ref));
  return json({
    ok: true,
    output,
    meta: {
      model,
      usage: raw?.usage || null,
      assistant_state: 'AI_READY'
    }
  });
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

    const assistant = await handlePitsquadAssistant(request, env, url);
    if (assistant) return assistant;

    const whatsappWebhook = await handleWhatsAppWebhook(request, env, url);
    if (whatsappWebhook) return whatsappWebhook;

    const pitsquad = await handlePitsquad(request, env, url);
    if (pitsquad) return pitsquad;

    const batchListIntakeApi = createBatchListIntakeApiV0({ env });
    if (batchListIntakeApi.matches(url.pathname)) return batchListIntakeApi.handle(request);

    const listIntakeApi = createListIntakeApiV0({ env });
    if (listIntakeApi.matches(url.pathname)) return listIntakeApi.handle(request);

    const trackedModelApi = createTrackedModelApiV0({ env });
    if (trackedModelApi.matches(url.pathname)) return trackedModelApi.handle(request);

    const runtime = createExternalCalcWorkerRuntime({ env });
    return runtime.fetch(request);
  }
};
