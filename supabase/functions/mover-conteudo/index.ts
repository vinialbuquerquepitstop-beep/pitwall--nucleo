// ============================================================
// mover-conteudo
//
// O Pit Wall vira controle remoto do Notion: arrastar/mover um card no kanban
// da aba Conteudo escreve o Status de volta no Notion. O Notion segue FONTE
// UNICA; o espelho local (tabela conteudo) so muda DEPOIS que o PATCH passa.
//
// Mesma razao da sincronizar-conteudo existir: o navegador nao pode chamar
// api.notion.com (CORS, e o token ficaria publico no app.js). Esta function e
// esse andar de servidor.
//
// ORDEM DE ESCRITA (invariante): Notion primeiro, local so se o PATCH passar.
// Se a integracao do Notion nao tiver a capability "Update content", o PATCH
// volta 403 e NADA muda: o card volta pra coluna de origem na tela e um toast
// explica. Falhar visivel, nunca gravar errado.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const NOTION_API = 'https://api.notion.com/v1';
// Pinada de proposito, igual a sincronizar-conteudo.
const NOTION_VERSION = '2022-06-28';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');

// Codigo estavel da coluna -> nome EXATO da opcao no Notion (propriedade Status,
// type select, conferido no schema em 23/07/2026). O nome e o vocabulario do
// Notion, pinado como a NOTION_VERSION: renomear a opcao la quebra o PATCH com
// 400 "option does not exist", que e o comportamento certo (loud). Descartado
// NAO entra: e coluna colapsada de leitura, nao alvo de arrasto.
const COLUNA_NOTION: Record<string, string> = {
  a_produzir: 'A produzir',
  em_producao: 'Em produção',
  pronto: 'Pronto',
  publicado: 'Publicado',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

// Le a claim role do JWT ja validado na borda (verify_jwt=true). A anon key
// tambem e um JWT valido do projeto, por isso o papel e conferido: mover card e
// acao de operador logado, nunca do cron nem do anonimo.
function papelDoJwt(auth: string | null): string | null {
  if (!auth) return null;
  try {
    const t = auth.replace(/^Bearer\s+/i, '');
    const p = JSON.parse(
      atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    );
    return p?.role ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const auth = req.headers.get('Authorization');
  if (papelDoJwt(auth) !== 'authenticated') {
    return responder({ ok: false, msg: 'Nao autorizado.' }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const id = String(body?.id ?? '').trim();
  const para = String(body?.para ?? '').trim();
  const opcao = COLUNA_NOTION[para];
  if (!id) return responder({ ok: false, msg: 'Sem id do card.' });
  if (!opcao) return responder({ ok: false, msg: 'Coluna destino invalida.' });
  if (!NOTION_TOKEN) return responder({ ok: false, msg: 'Token do Notion nao configurado.' });

  // 1) Le o card COM O TOKEN DO USUARIO: a RLS de conteudo (tenant_id =
  //    fn_tenant_atual) garante que so acha o card do proprio tenant. Sem isto
  //    um tenant moveria card de outro so mandando o id.
  const user = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth! } },
  });
  const { data: cards, error: eLer } = await user
    .from('conteudo')
    .select('id, tenant_id, notion_page_id, status_codigo')
    .eq('id', id)
    .limit(1);
  if (eLer) return responder({ ok: false, msg: `Nao consegui ler o card: ${eLer.message}` });
  const card = (cards ?? [])[0] as
    | { id: string; tenant_id: string; notion_page_id: string; status_codigo: string }
    | undefined;
  if (!card) return responder({ ok: false, msg: 'Card nao encontrado na sua base.' }, 404);
  if (!card.notion_page_id) {
    return responder({ ok: false, msg: 'Card sem notion_page_id: nao da pra escrever no Notion.' });
  }
  if (card.status_codigo === para) {
    return responder({ ok: true, inalterado: true, status_codigo: para, status_rotulo: opcao });
  }

  // 2) NOTION PRIMEIRO. Local so muda se este PATCH passar.
  const res = await fetch(`${NOTION_API}/pages/${card.notion_page_id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties: { Status: { select: { name: opcao } } } }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    let msg: string;
    if (res.status === 403) {
      msg = 'Notion recusou a escrita (403). Falta a capability "Update content" na integracao.';
    } else if (res.status === 404) {
      msg = 'Notion respondeu 404: pagina inexistente ou nao compartilhada com a integracao.';
    } else if (res.status === 401) {
      msg = 'Notion recusou o token (401). Conferir a integracao.';
    } else if (res.status === 429) {
      msg = 'Notion pediu para esperar (429). Tente de novo em instantes.';
    } else {
      msg = `Notion respondeu ${res.status}. ${txt.slice(0, 200)}`;
    }
    // Nada tocou o local: o card volta pra origem na tela.
    return responder({ ok: false, msg, status: res.status });
  }

  // 3) Espelho local (service key, escopo tenant+id ja conferido no passo 1).
  //    Notion e a fonte; isto so mantem a leitura coerente ate o proximo sync.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { error: eUp } = await admin
    .from('conteudo')
    .update({ status_rotulo: opcao, status_codigo: para, sincronizado_em: new Date().toISOString() })
    .eq('tenant_id', card.tenant_id)
    .eq('id', card.id);

  if (eUp) {
    // O Notion JA mudou. Nao mentir que falhou: avisa que o espelho reconcilia
    // no proximo Sincronizar (o sync le o Notion e corrige o local).
    return responder({
      ok: true,
      status_codigo: para,
      status_rotulo: opcao,
      aviso: 'Movido no Notion. O painel reconcilia no proximo Sincronizar.',
    });
  }

  return responder({ ok: true, status_codigo: para, status_rotulo: opcao });
});
