// ============================================================
// sincronizar-conteudo
//
// A peca de servidor que o Nucleo nao tinha. O navegador nao pode chamar
// api.notion.com (CORS, e o token ficaria publico no app.js). O Apps Script
// legado se safava porque ELE e servidor. Esta function e esse andar.
//
// REGRA CENTRAL: isto e um CANO BURRO. Zero decisao de negocio aqui.
//   - a janela e o DB id vem de conteudo_fonte (invariante 11)
//   - as datas da janela vem prontas de v_conteudo_fonte, calculadas no fuso
//     do Brasil dentro do Postgres (invariante 10)
//   - upsert, soft delete e escopo moram em sincronizar_conteudo() (a regra
//     de negocio mora num lugar so)
// Se um numero de janela aparecer neste arquivo, trocamos o defaultRoutine()
// chumbado no Index.html por janela chumbada no index.ts, e nao migramos nada.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const NOTION_API = 'https://api.notion.com/v1';
// Pinada de proposito: versao nao pinada e quebra futura sem deploy.
const NOTION_VERSION = '2022-06-28';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');

type Pagina = {
  notion_page_id: string;
  titulo: string | null;
  data: string;
  tipo_rotulo: string | null;
  tipo_codigo: string | null;
  status_rotulo: string | null;
  status_codigo: string | null;
  semana: string | null;
  url: string | null;
};

// CORS: o botao "Sincronizar" chama daqui do navegador (workers.dev ->
// supabase.co), e o Authorization forca preflight OPTIONS. Sem estes headers
// o browser bloqueia a resposta. Isto e transporte, nao regra de negocio:
// o portao continua sendo a claim role, nunca a origem.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Contrato de erro espelha o das RPCs: 200 + {ok:false, msg} para falha
// esperada (o front ja sabe ler ok:false); 5xx so para bug de verdade.
const responder = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

// 'A produzir' -> 'a_produzir'. O rotulo cru vai junto: o vocabulario e do
// Notion, o codigo e o que o CSS mapeia.
function slug(s: string | null): string | null {
  if (!s) return null;
  const v = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return v || null;
}

// O titulo se acha pelo TIPO, nunca pelo nome. Existe exatamente uma
// propriedade type:'title' por database do Notion, entao isto sobrevive ao
// dono renomear a coluna. Chumbar o nome quebraria o sync em silencio, com
// titulo nulo em toda linha e ok:true. Invariante 12: a chave e o que e
// estavel, nunca o rotulo, que e editavel.
function tituloDe(props: Record<string, any>): string | null {
  for (const p of Object.values(props ?? {})) {
    const q = p as any;
    if (q?.type === 'title') {
      const t = (q.title ?? []).map((x: any) => x?.plain_text ?? '').join('').trim();
      return t || null;
    }
  }
  return null;
}

// Aqui o nome E a chave (Tipo, Status, Semana), e o dono ja os confirmou.
// Renomear no Notion quebra: por isso ausencia vira aviso, nunca null calado.
function textoDe(props: Record<string, any>, nome: string): string | null {
  const p = props?.[nome];
  if (!p) return null;
  switch (p.type) {
    case 'select':
      return p.select?.name ?? null;
    case 'status':
      return p.status?.name ?? null;
    case 'multi_select':
      return p.multi_select?.[0]?.name ?? null;
    case 'rich_text':
      return (p.rich_text ?? []).map((x: any) => x?.plain_text ?? '').join('').trim() || null;
    default:
      return null;
  }
}

function dataDe(props: Record<string, any>): string | null {
  const p = props?.['Data'];
  if (p?.type === 'date') return p.date?.start?.slice(0, 10) ?? null;
  if (p?.type === 'formula' && p.formula?.type === 'date') return p.formula.date?.start?.slice(0, 10) ?? null;
  return null;
}

// verify_jwt=true ja validou a assinatura na borda, entao ler a claim sem
// re-verificar e seguro. O que NAO e seguro e presumir: a anon key tambem e
// um JWT valido do projeto e passaria pelo verify_jwt. Por isso o papel e
// conferido explicitamente abaixo.
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

// O formato NOVO de chave do Supabase (sb_secret_..., sb_publishable_...) nao e
// JWT: nao tem payload nem claim de papel, entao papelDoJwt() devolve null e o
// portao acima rejeitaria a chave de servico legitima. Foi exatamente isso que
// aconteceu em 20/07: cron com sb_secret_ valido levando 401.
// A borda (verify_jwt=true) ja provou que a credencial pertence ao projeto; o
// que falta aqui e separar SECRETA de PUBLICAVEL, e o prefixo faz isso de forma
// inequivoca. O motivo original do portao continua honrado: a chave publicavel
// (irma da anon) e recusada explicitamente, nunca por omissao.
function ehChaveDeServico(token: string): boolean {
  if (token.startsWith('sb_publishable_')) return false;
  return token.startsWith('sb_secret_');
}

type Fonte = {
  tenant_id: string;
  codigo: string;
  notion_db_id: string;
  janela_ini: string;
  janela_fim: string;
  notion_molde_page_id: string | null;
};

// Busca a janela inteira, paginando. LANCA em qualquer falha, de proposito:
// o chamador tem que abortar sem chamar a RPC. Payload parcial nunca pode
// chegar no soft delete, senao um fetch que quebrou na pagina 2 apagaria a tela.
async function buscarNotion(f: Fonte, avisos: string[]): Promise<Pagina[]> {
  const paginas: Pagina[] = [];
  let cursor: string | undefined = undefined;
  let faltaData = 0;

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: {
        and: [
          { property: 'Data', date: { on_or_after: f.janela_ini } },
          { property: 'Data', date: { on_or_before: f.janela_fim } },
        ],
      },
    };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`${NOTION_API}/databases/${f.notion_db_id}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      if (res.status === 401) {
        throw new Error('Notion recusou o token (401). Conferir a integração.');
      }
      if (res.status === 404) {
        throw new Error(
          'Notion respondeu 404. Quase sempre isto NAO e "database inexistente": ' +
            'e o Calendário não estar compartilhado com a integração.',
        );
      }
      if (res.status === 429) {
        throw new Error('Notion pediu para esperar (429). Tentar de novo em instantes.');
      }
      throw new Error(`Notion respondeu ${res.status}. ${txt.slice(0, 200)}`);
    }

    const j = await res.json();
    for (const pg of j.results ?? []) {
      const props = pg.properties ?? {};
      const data = dataDe(props);
      if (!data) {
        faltaData++;
        continue;
      }
      const tipo = textoDe(props, 'Tipo');
      const status = textoDe(props, 'Status');
      paginas.push({
        notion_page_id: pg.id,
        titulo: tituloDe(props),
        data,
        tipo_rotulo: tipo,
        tipo_codigo: slug(tipo),
        status_rotulo: status,
        status_codigo: slug(status),
        semana: textoDe(props, 'Semana'),
        url: pg.url ?? null,
      });
    }
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);

  if (faltaData > 0) {
    avisos.push(`${faltaData} card(s) sem Data ficaram de fora.`);
  }
  return paginas;
}

type Molde = { payload: Record<string, unknown>; blockId: string; version: number };

// Le o molde da pagina do Notion. LANCA em qualquer falha, pelo mesmo motivo
// de buscarNotion(): o chamador tem que abortar sem chamar a RPC. Molde
// pela metade nunca pode chegar no cache, senao um fetch que quebrou apaga a
// grade da tela.
//
// O bloco se acha pelo campo `molde` DENTRO do JSON, nunca pelo titulo da
// secao: o titulo mudou de v2 para v3 em 13/08/2026, e rotulo nao e chave
// (invariante 12). Mesmo padrao de tituloDe(), que acha o titulo pelo tipo.
//
// Nao desce em child_page nem child_database de proposito: a pagina tem os
// Pitwalls semanais e o Calendario aninhados, e varrer aquilo seria rastejar
// o workspace inteiro atras de um bloco que mora na raiz. Medido em
// 13/08/2026: o bloco esta em profundidade 0, e a recursao existe so para
// sobreviver ao dono move-lo para dentro de um toggle.
async function lerMolde(pageId: string): Promise<Molde> {
  const achados: Molde[] = [];

  async function varrer(id: string, prof: number): Promise<void> {
    if (prof > 2) return;
    let cursor: string | undefined = undefined;
    do {
      const u = new URL(`${NOTION_API}/blocks/${id}/children`);
      u.searchParams.set('page_size', '100');
      if (cursor) u.searchParams.set('start_cursor', cursor);

      const res = await fetch(u.toString(), {
        headers: { Authorization: `Bearer ${NOTION_TOKEN}`, 'Notion-Version': NOTION_VERSION },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        if (res.status === 401) {
          throw new Error('Notion recusou o token (401). Conferir a integração.');
        }
        if (res.status === 404) {
          throw new Error(
            'Notion respondeu 404. Quase sempre isto NAO e "pagina inexistente": ' +
              'e a página do molde não estar compartilhada com a integração.',
          );
        }
        if (res.status === 429) {
          throw new Error('Notion pediu para esperar (429). Tentar de novo em instantes.');
        }
        throw new Error(`Notion respondeu ${res.status}. ${txt.slice(0, 200)}`);
      }

      const j = await res.json();
      const filhos: string[] = [];
      for (const b of j.results ?? []) {
        if (b.type === 'code') {
          const txt = (b.code?.rich_text ?? []).map((x: any) => x?.plain_text ?? '').join('');
          let p: any = null;
          try {
            p = JSON.parse(txt);
          } catch {
            continue; // bloco de codigo que nao e JSON: nao e assunto nosso
          }
          if (p?.molde !== 'pitstop-grade-conteudo') continue;
          achados.push({ payload: p, blockId: b.id, version: Number(p.version ?? 0) });
          continue;
        }
        if (b.has_children && b.type !== 'child_page' && b.type !== 'child_database') {
          filhos.push(b.id);
        }
      }
      for (const f of filhos) await varrer(f, prof + 1);
      cursor = j.has_more ? j.next_cursor : undefined;
    } while (cursor);
  }

  await varrer(pageId, 0);

  if (achados.length === 0) {
    throw new Error(
      'Nenhum bloco de código com molde="pitstop-grade-conteudo" na página. ' +
        'O bloco se acha pelo campo "molde", nao pelo titulo da secao.',
    );
  }
  if (achados.length > 1) {
    achados.sort((a, b) => b.version - a.version);
    // Empate de version e ERRO, nao "escolhe um": dois moldes vigentes ao
    // mesmo tempo e exatamente a doenca que esta obra veio curar.
    if (achados[0].version === achados[1].version) {
      throw new Error(
        `Dois blocos de molde com a mesma version (${achados[0].version}) na página. ` +
          'Nada foi alterado: dois moldes vigentes e a doenca original.',
      );
    }
  }
  return achados[0];
}

Deno.serve(async (req) => {
  // Preflight nao carrega Authorization por definicao: responde antes do portao.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const t0 = Date.now();
  const auth = req.headers.get('Authorization');
  const token = (auth ?? '').replace(/^Bearer\s+/i, '');
  const servico = token !== '' && ehChaveDeServico(token);
  const papel = servico ? 'service_role' : papelDoJwt(auth);

  if (papel !== 'service_role' && papel !== 'authenticated') {
    return responder({ ok: false, msg: 'Nao autorizado.' }, 401);
  }
  const origem = papel === 'service_role' ? 'cron' : 'manual';

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Quais fontes sincronizar.
  //  - front: le v_conteudo_fonte COM O TOKEN DO USUARIO, entao a RLS resolve
  //    o tenant. O tenant nunca vem de parametro que o chamador controla.
  //  - cron: service_role nao tem tenant implicito (fn_tenant_atual() = null),
  //    entao itera as fontes ativas, que ja carregam tenant_id.
  let fontes: Fonte[] = [];
  {
    const leitor = papel === 'authenticated'
      ? createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: auth! } },
      })
      : admin;
    const { data, error } = await leitor
      .from('v_conteudo_fonte')
      .select('tenant_id, codigo, notion_db_id, janela_ini, janela_fim, notion_molde_page_id');
    if (error) {
      return responder({ ok: false, msg: `Nao consegui ler a config das fontes: ${error.message}` });
    }
    fontes = (data ?? []) as Fonte[];
  }

  if (fontes.length === 0) {
    return responder({ ok: false, msg: 'Nenhuma fonte de conteudo ativa.' });
  }

  // Token ausente: 1 log por tenant, ZERO escrita em conteudo. Esta e a trava
  // que impede o pior caso: token errado nunca chega no soft delete, senao
  // configurar errado apagaria a aba e pareceria que o calendario esvaziou.
  if (!NOTION_TOKEN) {
    const msg = 'Token do Notion nao configurado.';
    for (const f of fontes) {
      await admin.rpc('registrar_falha_sync', {
        p_tenant_id: f.tenant_id,
        p_origem: origem,
        p_msg: msg,
        p_duracao_ms: Date.now() - t0,
      });
    }
    return responder({ ok: false, msg });
  }

  const resultados: unknown[] = [];
  let algumFalhou = false;
  let moldeFalhou = false;
  let moldeMsg: string | null = null;

  for (const f of fontes) {
    // ---- MOLDE ------------------------------------------------------------
    // Try/catch PROPRIO, e ANTES do calendario de proposito: o caminho do
    // calendario faz `continue` no erro, e o molde nao pode ficar refem disso.
    // Um nao derruba o outro, nos DOIS sentidos.
    let molde: unknown = null;
    if (f.notion_molde_page_id) {
      try {
        const m = await lerMolde(f.notion_molde_page_id);
        const { data, error } = await admin.rpc('sincronizar_molde', {
          p_tenant_id: f.tenant_id,
          p_payload: m.payload,
          p_block_id: m.blockId,
          p_origem: origem,
          p_duracao_ms: Date.now() - t0,
        });
        if (error) throw new Error(`Banco recusou o molde: ${error.message}`);
        molde = data;
        // A RPC recusa molde invalido devolvendo ok:false E MANTENDO o cache.
        // Aqui isso e falha visivel, nunca sucesso silencioso.
        if (data && (data as any).ok === false) {
          moldeFalhou = true;
          moldeMsg = (data as any).msg ?? 'Molde recusado.';
        }
      } catch (e) {
        // ABORTA SO O MOLDE, sem chamar a RPC. O cache anterior fica intacto e
        // a tela vai declarar a idade dele, em vez de sumir com a grade ou,
        // pior, cair para um default embutido.
        moldeFalhou = true;
        moldeMsg = `Molde nao atualizado, cache anterior mantido. ${(e as Error).message}`;
        molde = { ok: false, msg: moldeMsg };
        await admin.rpc('registrar_falha_molde', {
          p_tenant_id: f.tenant_id,
          p_origem: origem,
          p_msg: moldeMsg,
          p_duracao_ms: Date.now() - t0,
        });
      }
    }

    const avisos: string[] = [];
    let paginas: Pagina[];
    try {
      paginas = await buscarNotion(f, avisos);
    } catch (e) {
      // ABORTA. Nao chama a RPC. Payload parcial jamais chega no soft delete.
      algumFalhou = true;
      const msg = `Sync incompleto, nada foi alterado. ${(e as Error).message}`;
      await admin.rpc('registrar_falha_sync', {
        p_tenant_id: f.tenant_id,
        p_origem: origem,
        p_msg: msg,
        p_duracao_ms: Date.now() - t0,
      });
      resultados.push({ fonte: f.codigo, ok: false, msg, molde });
      continue;
    }

    const { data, error } = await admin.rpc('sincronizar_conteudo', {
      p_tenant_id: f.tenant_id,
      p_fonte: f.codigo,
      p_paginas: paginas,
      p_janela_ini: f.janela_ini,
      p_janela_fim: f.janela_fim,
      p_completo: true, // so chega aqui se o fetch terminou INTEIRO
      p_origem: origem,
      p_duracao_ms: Date.now() - t0,
    });

    if (error) {
      algumFalhou = true;
      await admin.rpc('registrar_falha_sync', {
        p_tenant_id: f.tenant_id,
        p_origem: origem,
        p_msg: `Banco recusou o sync: ${error.message}`,
        p_duracao_ms: Date.now() - t0,
      });
      resultados.push({ fonte: f.codigo, ok: false, msg: error.message, molde });
      continue;
    }

    resultados.push({ fonte: f.codigo, ...(data as object), avisos, molde });
  }

  return responder({
    ok: !algumFalhou && !moldeFalhou,
    origem,
    duracao_ms: Date.now() - t0,
    // Calendario ok e molde falhou e um caso REAL, e a mensagem tem que dizer
    // qual dos dois caiu. Sem isto o toast diria "Sync falhou" e o dono iria
    // procurar defeito no calendario, que estava perfeito.
    msg: !algumFalhou && moldeFalhou
      ? `Calendário sincronizado. ${moldeMsg}`
      : undefined,
    fontes: resultados,
  });
});
