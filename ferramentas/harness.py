# Harness de execucao real. acorn/jsdom nao rodam (sem node), mas Chrome esta instalado:
# ele e um runtime JS de verdade, melhor que jsdom, porque tambem aplica o CSS.
#
# Roda o app.js REAL contra um Supabase FALSO alimentado com linha REAL do banco.
# Usa os ganchos que o proprio app ja tem: window.__PITWALL_SEM_INIT e PitWall._setLeads.
# Clica no botao Histórico e afirma sobre o DOM resultante.
import json, pathlib, subprocess, sys, tempfile, os
sys.stdout.reconfigure(encoding='utf-8')

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PUB = RAIZ / 'public'

CHROME = None
for p in [r'C:\Program Files\Google\Chrome\Application\chrome.exe',
          r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']:
    if os.path.exists(p): CHROME = p; break
if not CHROME:
    print('sem Chrome/Edge'); sys.exit(1)

# ---- dado real, lido do banco em 16/07/2026 ----
LEADS = json.loads((RAIZ / 'ferramentas' / 'dados_teste.json').read_text(encoding='utf-8'))['leads']
ROTULOS = json.loads((RAIZ / 'ferramentas' / 'dados_teste.json').read_text(encoding='utf-8'))['rotulos']
HIST = json.loads((RAIZ / 'ferramentas' / 'dados_teste.json').read_text(encoding='utf-8'))['historico']

html = (PUB / 'index.html').read_text(encoding='utf-8')
css  = (PUB / 'app.css').read_text(encoding='utf-8')
js   = (PUB / 'app.js').read_text(encoding='utf-8')

corpo = html.split('<body>', 1)[1].split('</body>', 1)[0]
import re
corpo = re.sub(r'<script[^>]*></script>', '', corpo)
corpo = re.sub(r'<script[^>]*>.*?</script>', '', corpo, flags=re.S)

STUB = """
window.__PITWALL_SEM_INIT = 1;
window.__log = [];
var LEADS = %s, ROTULOS = %s, HIST = %s;
// Fixture de venda: uma venda concluida, com lucro ja derivado pela v_venda
// (3200 - 2600 - 30 - 30 = 540). O card tem que exibir o code e o lucro.
var VENDAS_STUB = [{ id:'v1', venda_code:'VENDA-0001', modelo_rotulo:'iPhone 13', capacidade:'128GB',
  cor:'Meia-noite', condicao:'seminovo', imei:'355000000000001', cliente_nome:'Diego Souza',
  data_venda:'2026-07-18', valor_venda:3200, lucro:540, status:'concluida', tem_trade_in:false }];
var CATALOGO_STUB = [{ id:'m1', rotulo:'iPhone 13' }, { id:'m2', rotulo:'iPhone 15' }];
var TABELAS = { v_lead: LEADS, dicionario_rotulos: ROTULOS, v_venda: VENDAS_STUB, catalogo_iphone: CATALOGO_STUB,
  captacao_frente: [{ codigo: 'instagram_dm', rotulo: 'Instagram · DM', ordem: 1, ativo: true }] };
var CAP = [];
// ---- Fase 6: estado mutavel do dia/rotina/conteudo. O stub espelha o contrato
// REAL das RPCs (painel_do_dia etc.), lido de pg_get_functiondef em 17/07/2026.
// Molde REAL lido do banco em 20/07/2026: 7 categorias, 17 tarefas ativas.
// A carga derivada tem que dar seg 10 | ter 8 | qua 8 | qui 9 | sex 10 | sab 3 | dom 0.
// Nao inventar linha aqui: o harness so vale se o dado for o que o banco entrega.
var ROT_CATS = [
  { codigo: 'fila_follow_up', rotulo: 'Fila & Follow-up', ordem: 1 },
  { codigo: 'captacao',       rotulo: 'Captação',         ordem: 2 },
  { codigo: 'conteudo',       rotulo: 'Conteúdo',         ordem: 3 },
  { codigo: 'loja_estoque',   rotulo: 'Loja & Estoque',   ordem: 4 },
  { codigo: 'pos_venda',      rotulo: 'Pós-venda',        ordem: 5 },
  { codigo: 'analise',        rotulo: 'Análise',          ordem: 6 },
  { codigo: 'fechamento',     rotulo: 'Fechamento',       ordem: 7 }];
var ROT_TAREFAS = [
  { id:'t01', categoria:'fila_follow_up', titulo:'Rodar a Fila do dia até zerar',                  dias_semana:[1,2,3,4,5],   ordem:1, ativa:true },
  { id:'t02', categoria:'fila_follow_up', titulo:'Atualizar quem respondeu',                       dias_semana:[1,2,3,4,5],   ordem:2, ativa:true },
  { id:'t03', categoria:'fila_follow_up', titulo:'Revisar lista fria',                             dias_semana:[5],           ordem:3, ativa:true },
  { id:'t04', categoria:'captacao',       titulo:'Registrar as abordagens do dia',                 dias_semana:[1,2,3,4,5,6], ordem:1, ativa:true },
  { id:'t05', categoria:'conteudo',       titulo:'Conferir o card de hoje',                        dias_semana:[1,2,3,4,5],   ordem:1, ativa:true },
  { id:'t06', categoria:'conteudo',       titulo:'Publicar a peça do dia',                         dias_semana:[1,2,3,4,5],   ordem:2, ativa:true },
  { id:'t07', categoria:'conteudo',       titulo:'Responder DM e comentário',                      dias_semana:[1,2,3,4,5,6], ordem:3, ativa:true },
  { id:'t08', categoria:'conteudo',       titulo:'Produzir os cards da semana seguinte',           dias_semana:[4],           ordem:4, ativa:true },
  { id:'t09', categoria:'conteudo',       titulo:'Agendar as publicações da semana',               dias_semana:[1],           ordem:5, ativa:true },
  { id:'t10', categoria:'loja_estoque',   titulo:'Conferir estoque e preço',                       dias_semana:[1],           ordem:1, ativa:true },
  { id:'t11', categoria:'loja_estoque',   titulo:'Revisar preço vs concorrência',                  dias_semana:[3],           ordem:2, ativa:true },
  { id:'t12', categoria:'pos_venda',      titulo:'Checar quem comprou na semana',                  dias_semana:[4],           ordem:1, ativa:true },
  { id:'t13', categoria:'pos_venda',      titulo:'Pedir depoimento de quem comprou',               dias_semana:[2],           ordem:2, ativa:true },
  { id:'t14', categoria:'analise',        titulo:'Ler a auditoria da semana e escolher 1 ação',    dias_semana:[1],           ordem:1, ativa:true },
  { id:'t15', categoria:'analise',        titulo:'Revisar o funil: leads entrados vs convertidos', dias_semana:[5],           ordem:2, ativa:true },
  { id:'t16', categoria:'analise',        titulo:'Fechar a semana: o que funcionou, o que corta',  dias_semana:[5],           ordem:3, ativa:true },
  { id:'t17', categoria:'fechamento',     titulo:'Fechar o dia: nota e pendências',                dias_semana:[1,2,3,4,5,6], ordem:1, ativa:true }];
// categoria tem que existir em ROT_CATS, senao a aba Hoje nao agrupa a tarefa
var DIA = [{ id: 'dt1', categoria: 'fila_follow_up', titulo: 'Rodar a Fila do dia até zerar', origem: 'molde', concluida: false, removida: false }];
var DIA_NOTA = ''; var LEMB = [];
var SYNC = { ok: true, quando: '2026-07-17T05:30:00Z', msg: null, horas: 3 };
// Datas RELATIVAS a hoje: com data fixa as assercoes de nivel apodreceriam
// amanha. Os cinco status_codigo reais do banco: a_produzir, em_producao,
// pronto, publicado, descartado. O stub antigo usava 'planejado', que NAO
// existe em lugar nenhum.
function _dISO(off) {
  var d = new Date(); d.setDate(d.getDate() + off);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
var CONT = [
  { id:'c1', titulo:'Story bastidores',  data:_dISO(-5), tipo_rotulo:'Story', tipo_codigo:'story', status_rotulo:'A produzir',  status_codigo:'a_produzir',  semana:'S29', url:'https://www.notion.so/c1', hoje:false },
  { id:'c2', titulo:'Reels comparativo', data:_dISO(-2), tipo_rotulo:'Reels', tipo_codigo:'reels', status_rotulo:'Em produção', status_codigo:'em_producao', semana:'S29', url:null, hoje:false },
  { id:'c3', titulo:'Reel bastidores',   data:_dISO(0),  tipo_rotulo:'Reels', tipo_codigo:'reels', status_rotulo:'A produzir',  status_codigo:'a_produzir',  semana:'S30', url:null, hoje:true },
  { id:'c4', titulo:'Feed lancamento',   data:_dISO(3),  tipo_rotulo:'Feed',  tipo_codigo:'feed',  status_rotulo:'Pronto',      status_codigo:'pronto',      semana:'S30', url:null, hoje:false },
  { id:'c5', titulo:'Reels tutorial',    data:_dISO(20), tipo_rotulo:'Reels', tipo_codigo:'reels', status_rotulo:'A produzir',  status_codigo:'a_produzir',  semana:'S32', url:null, hoje:false },
  { id:'c6', titulo:'Story recap',       data:_dISO(-6), tipo_rotulo:'Story', tipo_codigo:'story', status_rotulo:'Publicado',   status_codigo:'publicado',   semana:'S29', url:null, hoje:false },
  { id:'c7', titulo:'Story ideia velha', data:_dISO(-7), tipo_rotulo:'Story', tipo_codigo:'story', status_rotulo:'Descartado',  status_codigo:'descartado',  semana:'S29', url:null, hoje:false }];
window.__invocacoes = [];
window.__rpcChamadas = [];
window.supabase = {
  createClient: function () {
    return {
      auth: {
        getSession: function () { return Promise.resolve({ data: { session: { user: { id: 'u1' } } }, error: null }); },
        onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
        signOut: function () { return Promise.resolve({ error: null }); }
      },
      from: function (tabela) {
        var payload = { data: TABELAS[tabela] || [], error: null };
        var api = {};
        api.select = function () { return api; };
        api.eq = function () { return api; };
        api.order = function () { return Promise.resolve(payload); };
        api.then = function (f, r) { return Promise.resolve(payload).then(f, r); };
        return api;
      },
      rpc: function (nome, args) {
        window.__rpcChamadas.push({ nome: nome, args: args });
        if (nome === 'historico_lead') return Promise.resolve({ data: { ok: true, eventos: HIST }, error: null });
        if (nome === 'registrar_nota') {
          // espelha a regra REAL de registrar_nota(): recusa data futura.
          if (args.p_data && args.p_data > '2026-07-16')
            return Promise.resolve({ data: { ok: false, msg: 'Data no futuro. Use Adiar/Retomar para agendar.' }, error: null });
          if (!args.p_texto || !args.p_texto.trim())
            return Promise.resolve({ data: { ok: false, msg: 'Nota vazia' }, error: null });
          return Promise.resolve({ data: { ok: true, msg: 'Nota registrada' }, error: null });
        }
        // ---- Vendas: espelha a validacao REAL da RPC registrar_venda ----
        if (nome === 'registrar_venda') {
          var pv = (args && args.payload) || {};
          if (!(parseFloat(pv.valor_venda) > 0))
            return Promise.resolve({ data: { ok: false, erro: 'valor_venda obrigatorio' }, error: null });
          if (!pv.modelo_id)
            return Promise.resolve({ data: { ok: false, erro: 'modelo obrigatorio' }, error: null });
          return Promise.resolve({ data: { ok: true, id: 'nova', venda_code: 'VENDA-0002' }, error: null });
        }
        // ---- Fase 5. O stub espelha as regras REAIS, conferidas contra o banco em
        // transacao revertida: dedup com a data, e reabordagem bloqueada apos opt-out.
        if (nome === 'placar_captacao') {
          var feitas = CAP.filter(function (x) { return x.hoje; }).length;
          return Promise.resolve({ data: {
            ok: true, dia: '16/07/2026', alvo: 10, feitas: feitas,
            restantes: Math.max(10 - feitas, 0), total: CAP.length,
            leads_gerados: CAP.filter(function (x) { return x.virou_lead; }).length,
            pararam: CAP.filter(function (x) { return x.parou; }).length,
            frentes: [{ frente: 'instagram_dm', rotulo: 'Instagram · DM', feitas: feitas }]
          }, error: null });
        }
        if (nome === 'captacao_do_dia') {
          return Promise.resolve({ data: { ok: true, dia: '16/07/2026',
            linhas: CAP.filter(function (x) { return x.hoje; }) }, error: null });
        }
        if (nome === 'registrar_captacao') {
          var ident = String(args.p_identificador || '').trim();
          if (!ident) return Promise.resolve({ data: { ok: false, msg: 'Identificador obrigatorio (ex: @perfil)' }, error: null });
          var ja = CAP.filter(function (x) { return x.identificador === ident && x.frente === args.p_frente; })[0];
          if (ja && ja.parou)
            return Promise.resolve({ data: { ok: false, msg: 'Essa pessoa pediu para nao ser mais abordada. Nao insistir.' }, error: null });
          if (ja)
            return Promise.resolve({ data: { ok: false, duplicado: true, msg: 'Voce ja abordou ' + ident + ' nessa frente em 12/07/2026' }, error: null });
          CAP.unshift({ id: 'novo-' + CAP.length, identificador: ident, nome: args.p_nome || null,
            observacoes: args.p_observacoes || null, frente: args.p_frente,
            frente_rotulo: 'Instagram · DM', hora: '21:45', parou: false, virou_lead: false, hoje: true });
          return Promise.resolve({ data: { ok: true, msg: 'Abordagem registrada' }, error: null });
        }
        if (nome === 'registrar_opt_out') {
          CAP.forEach(function (x) { if (x.id === args.p_captacao_id) x.parou = true; });
          return Promise.resolve({ data: { ok: true, msg: 'Marcada como nao abordar' }, error: null });
        }
        // ---- Fase 6 ----
        if (nome === 'painel_do_dia') {
          var vivas = DIA.filter(function (x) { return !x.removida; });
          return Promise.resolve({ data: { ok: true, data: '2026-07-17', isodow: 5,
            contagem: { feitas: vivas.filter(function (x) { return x.concluida; }).length, total: vivas.length },
            categorias: ROT_CATS.map(function (ct) { return { codigo: ct.codigo, rotulo: ct.rotulo, ativa: true,
              tarefas: vivas.filter(function (x) { return x.categoria === ct.codigo; }).map(function (x) {
                return { id: x.id, titulo: x.titulo, origem: x.origem, concluida: x.concluida }; }) }; }),
            nota: DIA_NOTA, lembretes: LEMB.slice(),
            conteudo: CONT.filter(function (x) { return x.hoje; }), sync: SYNC }, error: null });
        }
        if (nome === 'marcar_tarefa') {
          DIA.forEach(function (x) { if (x.id === args.p_tarefa_id) x.concluida = args.p_concluida; });
          return Promise.resolve({ data: { ok: true, msg: 'Tarefa atualizada' }, error: null });
        }
        if (nome === 'adicionar_tarefa') {
          if (!ROT_CATS.some(function (c) { return c.codigo === args.p_categoria; }))
            return Promise.resolve({ data: { ok: false, msg: 'Categoria invalida.' }, error: null });
          DIA.push({ id: 'dt' + (DIA.length + 1), categoria: args.p_categoria, titulo: args.p_titulo, origem: 'manual', concluida: false, removida: false });
          return Promise.resolve({ data: { ok: true, msg: 'Tarefa adicionada' }, error: null });
        }
        if (nome === 'remover_tarefa') {
          // espelha o soft delete REAL (removida_em, P4): a linha fica, some da leitura
          DIA.forEach(function (x) { if (x.id === args.p_tarefa_id) x.removida = true; });
          return Promise.resolve({ data: { ok: true, msg: 'Tarefa removida' }, error: null });
        }
        if (nome === 'salvar_nota') { DIA_NOTA = args.p_texto; return Promise.resolve({ data: { ok: true, msg: 'Nota salva' }, error: null }); }
        if (nome === 'salvar_lembrete') { LEMB.push({ id: 'lb' + (LEMB.length + 1), texto: args.p_texto, feito: false }); return Promise.resolve({ data: { ok: true, msg: 'Lembrete salvo' }, error: null }); }
        if (nome === 'marcar_lembrete') { LEMB.forEach(function (x) { if (x.id === args.p_lembrete_id) x.feito = args.p_feito; }); return Promise.resolve({ data: { ok: true, msg: 'Lembrete atualizado' }, error: null }); }
        if (nome === 'remover_lembrete') { LEMB = LEMB.filter(function (x) { return x.id !== args.p_lembrete_id; }); return Promise.resolve({ data: { ok: true, msg: 'Lembrete removido' }, error: null }); }
        if (nome === 'puxar_rotina') { return Promise.resolve({ data: { ok: true, msg: 'Rotina do dia pronta', novas: 0 }, error: null }); }
        if (nome === 'rotina_completa') {
          return Promise.resolve({ data: { ok: true, pode_editar: true,
            categorias: ROT_CATS.map(function (ct) { return { codigo: ct.codigo, rotulo: ct.rotulo, ordem: ct.ordem,
              tarefas: ROT_TAREFAS.filter(function (x) { return x.categoria === ct.codigo && x.ativa; }).map(function (x) {
                return { id: x.id, titulo: x.titulo, dias_semana: x.dias_semana, ordem: x.ordem }; }) }; }) }, error: null });
        }
        if (nome === 'salvar_rotina_categoria') { ROT_CATS.push({ codigo: args.p_codigo, rotulo: args.p_rotulo, ordem: ROT_CATS.length + 1 }); return Promise.resolve({ data: { ok: true, msg: 'Categoria criada' }, error: null }); }
        if (nome === 'salvar_rotina_tarefa') { ROT_TAREFAS.push({ id: 'rt' + (ROT_TAREFAS.length + 1), categoria: args.p_categoria, titulo: args.p_titulo, dias_semana: args.p_dias_semana || null, ordem: 99, ativa: true }); return Promise.resolve({ data: { ok: true, msg: 'Tarefa do molde salva' }, error: null }); }
        if (nome === 'remover_rotina_tarefa') { ROT_TAREFAS.forEach(function (x) { if (x.id === args.p_id) x.ativa = false; }); return Promise.resolve({ data: { ok: true, msg: 'Tarefa removida do molde' }, error: null }); }
        if (nome === 'conteudo_periodo') { return Promise.resolve({ data: { ok: true, ini: '2026-07-10', fim: '2026-08-14', itens: CONT.slice(), sync: SYNC }, error: null }); }
        return Promise.resolve({ data: { ok: false, msg: 'rpc nao stubada: ' + nome }, error: null });
      },
      functions: {
        // o botao Sincronizar: com __SYNC_FALHA o stub devolve o contrato REAL
        // de token ausente (200 + ok:false), provado contra o servico no ar
        invoke: function (nome, opts) {
          window.__invocacoes.push({ nome: nome, opts: opts });
          if (window.__SYNC_FALHA)
            return Promise.resolve({ data: { ok: false, msg: 'Token do Notion nao configurado.' }, error: null });
          SYNC = { ok: true, quando: '2026-07-17T08:00:00Z', msg: null, horas: 0 };
          return Promise.resolve({ data: { ok: true, origem: 'manual', duracao_ms: 800, fontes: [{ fonte: 'calendario', ok: true }] }, error: null });
        }
      }
    };
  }
};
""" % (json.dumps(LEADS, ensure_ascii=False), json.dumps(ROTULOS, ensure_ascii=False), json.dumps(HIST, ensure_ascii=False))

# ---- o teste: roda depois do init, clica, e afirma sobre o DOM ----
TESTE = """
// telaTxt() inclui o texto das tags <script>, e este harness
// injeta o app.js inteiro dentro do <body>. Assertar sobre body.textContent
// testa o CODIGO-FONTE, nao a tela: provado em 21/07/2026 com a string
// 'TRILHO_ANEL' (identificador JS, nunca renderizavel) sendo encontrada.
// telaTxt() le so #lista, que nao contem script nenhum.
function telaTxt() { var l = document.getElementById('lista'); return l ? l.textContent : ''; }
function ok(nome, cond, extra) { window.__log.push((cond ? 'PASSOU  ' : 'FALHOU  ') + nome + (extra ? '  <' + extra + '>' : '')); }
function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function rodar() {
  window.PitWall.init();
  await espera(260);

  var cards = document.querySelectorAll('#lista .card');
  ok('a fila renderizou cards', cards.length > 0, 'cards=' + cards.length);
  var card = document.querySelector('.card[data-lead="LEAD-0005"]');
  if (!card) { ok('LEAD-0005 na fila', false); return fim(); }

  // ---- 1. sem clique, nao aparece e nao consulta o banco (pedido do dono) ----
  var painel = card.querySelector('[data-hist]');
  ok('painel existe no DOM', !!painel);
  ok('painel comeca VAZIO', painel.innerHTML === '', 'innerHTML=' + painel.innerHTML.length + ' chars');
  ok('painel comeca ESCONDIDO', getComputedStyle(painel).display === 'none', getComputedStyle(painel).display);
  ok('sem clique, historico_lead NAO foi chamada',
     window.__rpcChamadas.filter(function (r) { return r.nome === 'historico_lead'; }).length === 0);

  // ---- 2. clique abre ----
  var btn = card.querySelector('[data-acao="historico"]');
  ok('botao Historico existe', !!btn);
  btn.click();
  await espera(220);
  ok('painel ficou VISIVEL apos clique', getComputedStyle(painel).display === 'block', getComputedStyle(painel).display);
  ok('historico_lead foi chamada UMA vez',
     window.__rpcChamadas.filter(function (r) { return r.nome === 'historico_lead'; }).length === 1);
  ok('botao ficou marcado', btn.className.indexOf('ligado') >= 0, btn.className);

  var evs = painel.querySelectorAll('.hist-ev');
  ok('pintou os 3 eventos', evs.length === 3, 'n=' + evs.length);

  // newest-first: a primeira linha e a mais recente
  var q0 = painel.querySelector('.hist-ev .hist-quando').textContent.trim();
  ok('newest-first (topo = 11/07 15:12)', q0 === '11/07 15:12', q0);
  ok('ano foi encurtado na tela', q0.indexOf('2026') === -1, q0);

  // ator: regua nos eventos de cadencia, operador no toque
  ok('evento de cadencia = ator regua', evs[0].className.indexOf('ator-regua') >= 0, evs[0].className);
  ok('toque enviado = ator operador', evs[2].className.indexOf('ator-operador') >= 0, evs[2].className);
  ok('autor nulo vira Régua', painel.textContent.indexOf('Régua') >= 0);
  ok('autor real aparece', painel.textContent.indexOf('Albuquerque') >= 0);

  // o ponto da regua e vazado, o do operador e cheio: tem que RENDERIZAR diferente
  var pr = getComputedStyle(evs[0].querySelector('.hist-ponto'));
  var po = getComputedStyle(evs[2].querySelector('.hist-ponto'));
  ok('ponto da regua != ponto do operador', pr.backgroundColor !== po.backgroundColor,
     'regua=' + pr.backgroundColor + ' operador=' + po.backgroundColor);
  ok('ponto do operador usa o azul da marca', po.backgroundColor === 'rgb(0, 37, 204)', po.backgroundColor);

  // ---- 3. nota: form fechado ate clicar ----
  var form = painel.querySelector('.hist-form');
  ok('form de nota existe', !!form);
  ok('form comeca escondido', getComputedStyle(form).display === 'none', getComputedStyle(form).display);
  painel.querySelector('[data-acao="nota"]').click();
  await espera(60);
  ok('form abre no + Nota', getComputedStyle(form).display === 'flex', getComputedStyle(form).display);

  // ---- 4. nota vazia: barra no JS, sem ir ao banco ----
  var antes = window.__rpcChamadas.filter(function (r) { return r.nome === 'registrar_nota'; }).length;
  painel.querySelector('[data-acao="nota-ok"]').click();
  await espera(80);
  ok('nota vazia nao vai ao banco',
     window.__rpcChamadas.filter(function (r) { return r.nome === 'registrar_nota'; }).length === antes);
  ok('nota vazia mostra erro', !!painel.querySelector('.hist-erro'));

  // ---- 5. data futura: o BANCO recusa e a msg dele aparece ----
  painel.querySelector('.hist-form textarea').value = 'Cliente pediu para chamar depois do dia 20.';
  painel.querySelector('.hist-form input[type=date]').value = '2026-07-22';
  painel.querySelector('[data-acao="nota-ok"]').click();
  await espera(120);
  var erro = painel.querySelector('.hist-erro');
  ok('recusa do banco aparece na tela', !!erro && erro.textContent.indexOf('Data no futuro') >= 0,
     erro ? erro.textContent : 'sem .hist-erro');

  // ---- 6. nota valida ----
  painel.querySelector('.hist-form input[type=date]').value = '2026-07-16';
  painel.querySelector('[data-acao="nota-ok"]').click();
  await espera(160);
  var chamada = window.__rpcChamadas.filter(function (r) { return r.nome === 'registrar_nota'; }).pop();
  ok('registrar_nota recebeu o texto', chamada && chamada.args.p_texto.indexOf('depois do dia 20') >= 0);
  ok('nota valida gera UMA escrita',
     window.__rpcChamadas.filter(function (r) { return r.nome === 'registrar_nota' && r.args.p_data === '2026-07-16'; }).length === 1);
  ok('historico recarregou apos a nota',
     window.__rpcChamadas.filter(function (r) { return r.nome === 'historico_lead'; }).length === 2);

  // ---- 7. clicar de novo fecha e limpa ----
  btn.click();
  await espera(80);
  ok('segundo clique esconde', getComputedStyle(painel).display === 'none', getComputedStyle(painel).display);
  ok('segundo clique limpa o DOM', painel.innerHTML === '');
  ok('botao desmarcou', btn.className.indexOf('ligado') === -1, btn.className);

  // ---- 8. sugerir_mensagem intacta ----
  ok('painel de scripts continua no card', !!card.querySelector('[data-scripts]'));

  // ================= FASE 5: aba Captação =================
  var abaCap = document.getElementById('abaCaptacao');
  ok('a aba Captação existe', !!abaCap);
  abaCap.click();
  await espera(240);

  ok('título virou Captação', document.getElementById('topoTit').textContent === 'Captação',
     document.getElementById('topoTit').textContent);
  ok('aba ficou marcada', abaCap.getAttribute('aria-selected') === 'true');
  // o pitboard de LEAD nao pode aparecer aqui: sao numeros de outro laco
  ok('pitboard de lead escondido', getComputedStyle(document.getElementById('pitboard')).display === 'none',
     getComputedStyle(document.getElementById('pitboard')).display);

  var cels = document.querySelectorAll('#lista .pitboard .pb-celula');
  ok('placar tem 4 células', cels.length === 4, 'n=' + cels.length);
  ok('dia zerado mostra 0', cels[0].querySelector('.pb-num').textContent === '0',
     cels[0].querySelector('.pb-num').textContent);
  ok('a meta vem do banco, não do JS', cels[0].querySelector('.pb-pe').textContent === 'de 10 na meta',
     cels[0].querySelector('.pb-pe').textContent);
  ok('nada de "faltam", que repetiria "0 de 10"',
     document.querySelector('#lista .pitboard').textContent.indexOf('faltam') === -1);
  ok('sem barra de progresso azul (5o uso da marca)', !document.querySelector('#lista .cap-barra'));
  ok('vazio diz o próximo passo', document.querySelector('.cap-vazio-t').textContent.indexOf('Nenhuma abordagem') >= 0);

  // ---- o loop: digitar, Enter, próximo
  var ident = document.getElementById('capIdent');
  ok('o campo do @perfil existe', !!ident);
  ident.value = '@ana.ferraz';
  ident.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await espera(200);
  var ch = window.__rpcChamadas.filter(function (r) { return r.nome === 'registrar_captacao'; });
  ok('Enter registra (sem precisar do botão)', ch.length === 1, 'n=' + ch.length);
  ok('mandou o @perfil certo', ch[0] && ch[0].args.p_identificador === '@ana.ferraz');
  ok('mandou a frente', ch[0] && ch[0].args.p_frente === 'instagram_dm');
  ok('a linha apareceu no log', document.querySelectorAll('#lista .cap-lin').length === 1);
  ok('o placar subiu para 1', document.querySelector('#lista .pb-num').textContent === '1',
     document.querySelector('#lista .pb-num').textContent);
  ok('o campo limpou para a próxima', document.getElementById('capIdent').value === '');
  ok('o foco voltou para o campo', document.activeElement === document.getElementById('capIdent'),
     document.activeElement ? document.activeElement.id : 'nenhum');
  ok('o contador da aba mostra 1', document.getElementById('badgeCaptacao').textContent === '1',
     document.getElementById('badgeCaptacao').textContent);

  // ---- campo vazio: barra no JS, sem ir ao banco
  var antes5 = window.__rpcChamadas.filter(function (r) { return r.nome === 'registrar_captacao'; }).length;
  document.querySelector('[data-acao="cap-registrar"]').click();
  await espera(90);
  ok('campo vazio não vai ao banco',
     window.__rpcChamadas.filter(function (r) { return r.nome === 'registrar_captacao'; }).length === antes5);
  ok('campo vazio mostra erro', !!document.querySelector('.cap-msg.erro'));

  // ---- dedup: o banco recusa e diz quando foi
  document.getElementById('capIdent').value = '@ana.ferraz';
  document.querySelector('[data-acao="cap-registrar"]').click();
  await espera(180);
  var m = document.querySelector('.cap-msg');
  ok('reabordagem recusada com a data', !!m && m.textContent.indexOf('12/07/2026') >= 0,
     m ? m.textContent : 'sem msg');

  // ---- nome e observação ficam guardados (menos dado de quem não pediu contato)
  var det = document.getElementById('capDet');
  ok('nome/observação começam escondidos', getComputedStyle(det).display === 'none');
  document.querySelector('[data-acao="cap-mais"]').click();
  await espera(70);
  ok('abrem no clique', getComputedStyle(det).display === 'flex');

  // ---- opt-out: a segunda metade da regra do dono
  document.getElementById('capIdent').value = '@marcos.dev';
  document.querySelector('[data-acao="cap-registrar"]').click();
  await espera(180);
  var parar = document.querySelector('.cap-lin [data-acao="cap-parar"]');
  ok('a linha tem a ação "parar"', !!parar);
  parar.click();
  await espera(200);
  ok('registrar_opt_out foi chamada',
     window.__rpcChamadas.filter(function (r) { return r.nome === 'registrar_opt_out'; }).length === 1);
  var lin0 = document.querySelector('#lista .cap-lin');
  ok('a linha ficou marcada como não abordar', lin0.className.indexOf('parou') >= 0, lin0.className);
  ok('e perdeu a ação de parar', !lin0.querySelector('[data-acao="cap-parar"]'));
  ok('o placar contou quem parou', document.querySelectorAll('#lista .pb-num')[3].textContent === '1',
     document.querySelectorAll('#lista .pb-num')[3].textContent);

  // ---- e o banco bloqueia reabordar quem pediu para parar
  document.getElementById('capIdent').value = '@marcos.dev';
  document.querySelector('[data-acao="cap-registrar"]').click();
  await espera(180);
  var m2 = document.querySelector('.cap-msg');
  ok('reabordar quem parou é bloqueado', !!m2 && m2.textContent.indexOf('nao ser mais abordada') >= 0,
     m2 ? m2.textContent : 'sem msg');

  // ================= FASE 6: aba Hoje =================
  window.confirm = function () { return true; };
  document.getElementById('abaHoje').click();
  await espera(260);
  ok('título virou Hoje', document.getElementById('topoTit').textContent === 'Hoje',
     document.getElementById('topoTit').textContent);
  // a assercao da secao 13: o pitboard de LEAD nao aparece na aba Hoje
  ok('pitboard de LEAD escondido na aba Hoje',
     getComputedStyle(document.getElementById('pitboard')).display === 'none');
  var cels6 = document.querySelectorAll('#lista .pitboard .pb-celula');
  ok('placar do dia tem 4 células', cels6.length === 4, 'n=' + cels6.length);
  ok('rotina começa em 0%', cels6[0].querySelector('.pb-num').textContent === '0%',
     cels6[0].querySelector('.pb-num').textContent);
  ok('tile do sync diz 3h', cels6[3].querySelector('.pb-num').textContent === '3h',
     cels6[3].querySelector('.pb-num').textContent);

  // categoria e GAVETA: rótulo mono em --dim, nunca accent/quente/morno/frio/ok
  var catRot = document.querySelector('#lista .dia-cat-rot');
  ok('rótulo de categoria existe', !!catRot);
  var corCat = catRot ? getComputedStyle(catRot).color : '';
  // Prova o trilho de ponta a ponta: trilhoDe('fila_follow_up') -> var(--tr-fila-follow-up)
  // -> #5B6BA8 -> rgb(91,107,168) COMPUTADO pelo browser. Se o token sumir do
  // :root ou o style inline quebrar, isto cai. Nao ha como passar por acidente.
  ok('categoria computa a cor do trilho (#5B6BA8)', corCat === 'rgb(91, 107, 168)', corCat);
  ok('cabecalho de categoria tem icone', !!document.querySelector('#lista .dia-cat-rot svg.tr-ico'));

  // ---- ordem da aba Hoje: a nota e o ato de FECHAMENTO, vai por ultimo ----
  var tits = [].map.call(document.querySelectorAll('#lista .dia-sec-tit'), function (e) { return e.textContent; });
  ok('ordem: Rotina, Conteúdo, Lembretes, Nota',
     tits.join(' | ') === 'Rotina do dia | Conteúdo de hoje | Lembretes | Nota do dia', tits.join(' | '));


  // marcar risca e persiste
  var tarefa = document.querySelector('#lista .dia-tarefa');
  ok('tarefa do molde renderizou', !!tarefa && tarefa.textContent.indexOf('Rodar a Fila') >= 0);
  tarefa.click();
  await espera(260);
  var chMarcar = window.__rpcChamadas.filter(function (r) { return r.nome === 'marcar_tarefa'; });
  ok('marcar_tarefa chamada com p_concluida=true', chMarcar.length === 1 && chMarcar[0].args.p_concluida === true);
  tarefa = document.querySelector('#lista .dia-tarefa');
  ok('re-renderizou marcada', tarefa.getAttribute('aria-checked') === 'true');
  var deco = getComputedStyle(tarefa.querySelector('.dia-tit')).textDecorationLine;
  ok('concluída risca (line-through)', deco.indexOf('line-through') >= 0, deco);
  var corChk = getComputedStyle(tarefa.querySelector('.dia-check')).backgroundColor;
  ok('check NEUTRO: fundo --dim, não verde nem azul', corChk === 'rgb(92, 102, 117)', corChk);
  ok('o placar foi a 100%', document.querySelector('#lista .pb-num').textContent === '100%',
     document.querySelector('#lista .pb-num').textContent);

  // tarefa manual entra
  document.getElementById('diaNovoTit').value = 'Ligar para o fornecedor';
  document.querySelector('[data-acao="dia-add"]').click();
  await espera(260);
  ok('adicionar_tarefa foi chamada', window.__rpcChamadas.some(function (r) { return r.nome === 'adicionar_tarefa'; }));
  ok('a tarefa manual apareceu', document.querySelectorAll('#lista .dia-tarefa').length === 2,
     'n=' + document.querySelectorAll('#lista .dia-tarefa').length);

  // remover não apaga: o front chama remover_tarefa (soft delete), nunca DELETE
  document.querySelectorAll('#lista [data-acao="dia-remover"]')[1].click();
  await espera(260);
  ok('remover_tarefa foi chamada', window.__rpcChamadas.some(function (r) { return r.nome === 'remover_tarefa'; }));
  ok('a linha saiu da tela', document.querySelectorAll('#lista .dia-tarefa').length === 1);

  // nota persiste, e sem data do navegador (o fuso de negócio é do banco)
  document.getElementById('diaNota').value = 'Dia forte de 17 Pro.';
  document.querySelector('[data-acao="dia-nota-ok"]').click();
  await espera(220);
  var chNota = window.__rpcChamadas.filter(function (r) { return r.nome === 'salvar_nota'; }).pop();
  ok('salvar_nota levou o texto', !!chNota && chNota.args.p_texto === 'Dia forte de 17 Pro.');
  ok('salvar_nota NÃO manda p_data do navegador', !!chNota && !('p_data' in chNota.args));

  // lembrete entra e aparece
  document.getElementById('lembNovo').value = 'Separar película do 17 Pro';
  document.querySelector('[data-acao="lemb-add"]').click();
  await espera(260);
  ok('lembrete apareceu', telaTxt().indexOf('Separar película') >= 0);

  // Rede contra o risco nomeado no spec: perder um data-acao na reescrita
  // quebraria um botao EM SILENCIO. Conferido AQUI, e nao antes, porque
  // lemb-marcar e lemb-remover so existem depois que ha um lembrete na tela.
  var acoes8 = ['dia-marcar','dia-remover','dia-add','dia-puxar','lemb-marcar','lemb-remover','lemb-add','dia-nota-ok'];
  var faltando = acoes8.filter(function (a) { return !document.querySelector('#lista [data-acao="' + a + '"]'); });
  ok('os 8 data-acao da aba Hoje sobreviveram', faltando.length === 0, faltando.join(',') || 'todos presentes');

  ok('"sincronizado há 3h" aparece', telaTxt().indexOf('sincronizado há 3h') >= 0);
  ok('conteúdo de hoje lista o Reel', telaTxt().indexOf('Reel bastidores') >= 0);

  // ================= FASE 6: aba Conteúdo =================
  document.getElementById('abaConteudo').click();
  await espera(260);
  ok('título virou Conteúdo', document.getElementById('topoTit').textContent === 'Conteúdo');
  ok('pitboard de LEAD escondido no Conteúdo',
     getComputedStyle(document.getElementById('pitboard')).display === 'none');
  // ---- kanban de funil: 4 colunas, e a DATA carrega o sinal de urgencia ----
  var kcols = document.querySelectorAll('#lista .cont-col');
  ok('kanban tem 4 colunas de funil', kcols.length === 4, String(kcols.length));
  function colN(cod) {
    var c = document.querySelector('#lista .cont-col[data-col="' + cod + '"]');
    return c ? c.querySelector('.cont-col-n').textContent : 'sem coluna';
  }
  ok('a_produzir conta 3', colN('a_produzir') === '3', colN('a_produzir'));
  ok('em_producao conta 1', colN('em_producao') === '1', colN('em_producao'));
  ok('pronto conta 1', colN('pronto') === '1', colN('pronto'));
  ok('publicado conta 1', colN('publicado') === '1', colN('publicado'));

  // A className carrega nivel-* E tipo-*, entao a comparacao e por conter.
  function nivelDe(titulo) {
    var cs = document.querySelectorAll('#lista .cont-card');
    for (var i = 0; i < cs.length; i++)
      if (cs[i].textContent.indexOf(titulo) >= 0) return cs[i].className.replace('cont-card ', '');
    return 'nao achou';
  }
  function temNivel(titulo, nv) { return nivelDe(titulo).indexOf(nv) >= 0; }
  function tipoDeCard(titulo) {
    var m = nivelDe(titulo).match(/tipo-(\w+)/); return m ? m[1] : 'sem tipo';
  }
  ok('peca de 5 dias atras = vencido', temNivel('Story bastidores', 'nivel-vencido'), nivelDe('Story bastidores'));
  ok('peca de hoje = quente', temNivel('Reel bastidores', 'nivel-quente'), nivelDe('Reel bastidores'));
  ok('peca em 3 dias = morno', temNivel('Feed lancamento', 'nivel-morno'), nivelDe('Feed lancamento'));
  ok('peca em 20 dias = frio', temNivel('Reels tutorial', 'nivel-frio'), nivelDe('Reels tutorial'));
  ok('publicada = ok, nao pede acao', temNivel('Story recap', 'nivel-ok'), nivelDe('Story recap'));

  var colAP = document.querySelector('#lista .cont-col[data-col="a_produzir"]');
  ok('a_produzir avisa 1 vencida', !!colAP && colAP.querySelector('.cont-col-venc') &&
     colAP.querySelector('.cont-col-venc').textContent === '1 vencida',
     colAP && colAP.querySelector('.cont-col-venc') ? colAP.querySelector('.cont-col-venc').textContent : 'sem aviso');
  ok('publicado NAO conta vencida', !document.querySelector('#lista .cont-col[data-col="publicado"] .cont-col-venc'));
  // ---- tipo da peca: Story / Reels / Feed com cor e icone proprios ----
  ok('Story marcado como story', tipoDeCard('Story bastidores') === 'story', tipoDeCard('Story bastidores'));
  ok('Reels marcado como reels', tipoDeCard('Reels tutorial') === 'reels', tipoDeCard('Reels tutorial'));
  ok('Feed marcado como feed', tipoDeCard('Feed lancamento') === 'feed', tipoDeCard('Feed lancamento'));
  var semTipoIco = [].filter.call(document.querySelectorAll('#lista .cont-tipo'),
    function (e) { return !e.querySelector('svg.tp-ico'); }).length;
  ok('todo rotulo de tipo tem icone (matiz sozinho nao separa)', semTipoIco === 0, semTipoIco + ' sem icone');
  var stCard = null, cs2 = document.querySelectorAll('#lista .cont-card');
  for (var q = 0; q < cs2.length; q++) if (cs2[q].textContent.indexOf('Story bastidores') >= 0) stCard = cs2[q];
  var corTipo = stCard ? getComputedStyle(stCard.querySelector('.cont-tipo')).color : 'sem card';
  ok('Story computa a cor do tipo (#A8497E)', corTipo === 'rgb(168, 73, 126)', corTipo);

  ok('so as 2 vencidas ganham o selo', document.querySelectorAll('#lista .cont-venc').length === 2,
     String(document.querySelectorAll('#lista .cont-venc').length));

  ok('cabecalho diz ha quantos dias foi a ultima publicacao',
     telaTxt().indexOf('última publicação há 6 dias') >= 0);
  ok('a janela e declarada, senao a coluna Publicado mente', !!document.querySelector('#lista .cont-janela'));

  // descartado: existe, mas colapsado. Apagar seria mentir sobre a base.
  var dsc = document.querySelector('#lista .cont-desc-cab');
  ok('descartado nasce colapsado', !!dsc && dsc.getAttribute('aria-expanded') === 'false');
  ok('descartado conta 1', !!dsc && dsc.textContent.indexOf('1') >= 0);
  ok('corpo do descartado escondido', !!document.querySelector('#lista .cont-desc') &&
     getComputedStyle(document.querySelector('#lista .cont-desc-corpo')).display === 'none');
  dsc.click(); await espera(80);
  ok('descartado abre no clique', getComputedStyle(document.querySelector('#lista .cont-desc-corpo')).display !== 'none');
  dsc.click(); await espera(80);
  ok('link do Notion presente', !!document.querySelector('#lista .cont-link'));

  // token ausente: mostra mensagem, NÃO trava, e a lista NÃO esvazia
  window.__SYNC_FALHA = 1;
  document.querySelector('[data-acao="sync-agora"]').click();
  await espera(320);
  ok('functions.invoke foi chamado', window.__invocacoes.length === 1, 'n=' + window.__invocacoes.length);
  ok('a falha do token vira toast de erro', document.getElementById('toast').className.indexOf('erro') >= 0,
     document.getElementById('toast').className);
  ok('a lista NÃO esvaziou com o sync falhando', document.querySelectorAll('#lista .cont-card').length >= 2,
     'n=' + document.querySelectorAll('#lista .cont-card').length);
  window.__SYNC_FALHA = 0;

  // sync >24h ganha o aviso
  SYNC.horas = 30;
  document.getElementById('abaHoje').click(); await espera(200);
  document.getElementById('abaConteudo').click(); await espera(260);
  ok('sync velho (>24h) ganha a classe de aviso', !!document.querySelector('#lista .sync-lin.velho'));


  // ================= FASE 6: aba Rotina =================
  document.getElementById('abaRotina').click();
  await espera(260);
  ok('título virou Rotina', document.getElementById('topoTit').textContent === 'Rotina');
  // ---- grade de 7 colunas: a carga por dia era invisivel na tela antiga ----
  var cols = document.querySelectorAll('#lista .rot-col');
  ok('a grade tem 7 colunas', cols.length === 7, String(cols.length));
  var carga = [].map.call(document.querySelectorAll('#lista .rot-carga-num'), function (e) { return e.textContent; }).join(' ');
  ok('carga medida no banco: 10 8 8 9 10 3 0', carga === '10 8 8 9 10 3 0', carga);
  ok('domingo aparece vazio, nao some', cols.length === 7 && cols[6].textContent.indexOf('livre') >= 0);
  var cels = document.querySelectorAll('#lista .rot-cel');
  var semIco = [].filter.call(cels, function (e) { return !e.querySelector('svg.tr-ico'); }).length;
  ok('toda celula tem icone de trilho (matiz sozinho nao separa)', cels.length > 0 && semIco === 0, semIco + ' sem icone');
  var fila5 = [].filter.call(cols, function (col) { return col.textContent.indexOf('Rodar a Fila do dia até zerar') >= 0; }).length;
  ok('tarefa de seg-sex aparece em 5 colunas', fila5 === 5, String(fila5));
  ok('legenda lista as 7 categorias', document.querySelectorAll('#lista .rot-leg-item').length === 7);

  // nova categoria: o código é slug ESTÁVEL do rótulo (a chave nunca é o rótulo)
  document.getElementById('rotNovaCatRot').value = 'Conteúdo & Marketing';
  document.querySelector('[data-acao="rot-add-cat"]').click();
  await espera(260);
  var chCat = window.__rpcChamadas.filter(function (r) { return r.nome === 'salvar_rotina_categoria'; }).pop();
  ok('slug sem acento e sem &', !!chCat && chCat.args.p_codigo === 'conteudo_marketing',
     chCat ? chCat.args.p_codigo : 'não chamou');
  ok('rótulo preservado com acento', !!chCat && chCat.args.p_rotulo === 'Conteúdo & Marketing');
  ok('categoria nova (ainda sem tarefa) aparece na legenda', 
     [].some.call(document.querySelectorAll('#lista .rot-leg-item'), function (e) {
       return e.textContent.indexOf('Conteúdo & Marketing') >= 0; }));

  // nova tarefa seg/qua/sex: ISODOW [1,3,5], o off-by-one seria silencioso
  document.getElementById('rotNovoTit').value = 'Preparar Reel da semana';
  var togs = document.querySelectorAll('[data-acao="rot-dia"]');
  togs[0].click(); togs[2].click(); togs[4].click();
  await espera(80);
  document.querySelector('[data-acao="rot-add-tarefa"]').click();
  await espera(260);
  var chRt = window.__rpcChamadas.filter(function (r) { return r.nome === 'salvar_rotina_tarefa'; }).pop();
  ok('dias_semana = [1,3,5] (ISODOW 1=seg)', !!chRt && JSON.stringify(chRt.args.p_dias_semana) === '[1,3,5]',
     chRt ? JSON.stringify(chRt.args.p_dias_semana) : 'não chamou');
  // ISODOW off-by-one seria silencioso: a tarefa [1,3,5] tem que cair em
  // seg/qua/sex e em NENHUM outro dia. Na grade isso e verificavel por coluna.
  var cols2 = document.querySelectorAll('#lista .rot-col');
  var caiu = [];
  [].forEach.call(cols2, function (col) {
    if (col.textContent.indexOf('Preparar Reel da semana') >= 0) caiu.push(col.getAttribute('data-dia'));
  });
  ok('tarefa [1,3,5] cai exatamente em seg/qua/sex', caiu.join(',') === '1,3,5', caiu.join(',') || 'nenhuma coluna');

  var rmMolde = document.querySelector('#lista [data-acao="rot-rm-tarefa"]');
  rmMolde.click();
  await espera(260);
  ok('remover_rotina_tarefa chamada', window.__rpcChamadas.some(function (r) { return r.nome === 'remover_rotina_tarefa'; }));

  // ---- decisão 7: barra de 5 + Mais (viewport headless = 800px, mobile)
  ok('botão Mais existe', !!document.getElementById('abaMais'));
  ok('6 abas raras', document.querySelectorAll('.aba-rara').length === 6);
  ok('rara começa escondida no mobile', getComputedStyle(document.getElementById('abaDash')).display === 'none');
  document.getElementById('abaMais').click();
  await espera(80);
  ok('Mais abre as raras', getComputedStyle(document.getElementById('abaDash')).display === 'flex');
  ok('aria-expanded acompanha', document.getElementById('abaMais').getAttribute('aria-expanded') === 'true');
  document.getElementById('abaMais').click();
  await espera(80);
  ok('Mais fecha de novo', getComputedStyle(document.getElementById('abaDash')).display === 'none');

  // ================= aba Clientes: leads que compraram (perfil=comprou) =================
  ok('a aba Clientes existe', !!document.getElementById('abaClientes'));
  ok('Clientes e uma rara (nao ocupa slot fixo da barra)',
     document.getElementById('abaClientes').className.indexOf('aba-rara') >= 0);
  document.getElementById('abaClientes').click();
  await espera(140);
  ok('título virou Clientes', document.getElementById('topoTit').textContent === 'Clientes',
     document.getElementById('topoTit').textContent);
  ok('aba Clientes ficou marcada', document.getElementById('abaClientes').getAttribute('aria-selected') === 'true');
  // o fixture só tem leads 'consulta': nenhum comprou -> estado vazio próprio,
  // o que prova que filtClientes filtra por perfil (não mostra os 2 consulta)
  ok('sem comprou, aparece o estado vazio de cliente', telaTxt().indexOf('Nenhum cliente ainda') >= 0,
     telaTxt().slice(0, 60));
  ok('nenhum card de lead vaza para a aba Clientes', document.querySelectorAll('#lista .card').length === 0,
     'n=' + document.querySelectorAll('#lista .card').length);
  ok('a busca fica visível em Clientes', getComputedStyle(document.getElementById('blocoBusca')).display !== 'none');

  // ================= aba Vendas: registro de venda (fatia 1) =================
  ok('a aba Vendas existe', !!document.getElementById('abaVendas'));
  ok('Vendas e aba principal (nao rara)', document.getElementById('abaVendas').className.indexOf('aba-rara') < 0);
  document.getElementById('abaVendas').click();
  await espera(160);
  ok('título virou Vendas', document.getElementById('topoTit').textContent === 'Vendas',
     document.getElementById('topoTit').textContent);
  ok('aba Vendas ficou marcada', document.getElementById('abaVendas').getAttribute('aria-selected') === 'true');
  ok('a venda do fixture aparece com o code', telaTxt().indexOf('VENDA-0001') >= 0, telaTxt().slice(0, 80));
  ok('o lucro derivado aparece no card', telaTxt().indexOf('540,00') >= 0, telaTxt().slice(0, 120));
  ok('a busca fica visível em Vendas', getComputedStyle(document.getElementById('blocoBusca')).display !== 'none');
  // abrir o form e provar o lucro ao vivo
  document.querySelector('[data-acao="nova-venda"]').click();
  await espera(140);
  ok('o painel de venda abriu', document.getElementById('painelVenda').className.indexOf('oculto') < 0);
  document.getElementById('fvValor').value = '3200';
  document.getElementById('fvCusto').value = '2600';
  document.getElementById('fvFrete').value = '30';
  document.getElementById('fvTaxas').value = '30';
  document.getElementById('fvValor').dispatchEvent(new Event('input'));
  ok('lucro ao vivo calcula 540', document.getElementById('fvLucro').textContent.indexOf('540,00') >= 0,
     document.getElementById('fvLucro').textContent);
  // salvar chama a RPC com o payload certo e fecha o painel
  var selM = document.getElementById('fvModelo');
  selM.value = selM.options.length > 1 ? selM.options[1].value : '';
  document.getElementById('btnSalvarVenda').click();
  await espera(180);
  var chVenda = window.__rpcChamadas.filter(function (x) { return x.nome === 'registrar_venda'; })[0];
  ok('salvar chamou registrar_venda', !!chVenda);
  ok('o payload levou valor e modelo',
     !!(chVenda && chVenda.args && chVenda.args.payload && chVenda.args.payload.valor_venda && chVenda.args.payload.modelo_id));
  ok('o painel fechou apos salvar', document.getElementById('painelVenda').className.indexOf('oculto') >= 0);

  // ---- voltar para a Fila não pode deixar resíduo
  document.getElementById('abaFila').click();
  await espera(200);
  ok('pitboard de lead volta na Fila', getComputedStyle(document.getElementById('pitboard')).display !== 'none');
  ok('a Fila volta a mostrar cards', document.querySelectorAll('#lista .card').length > 0);
  fim();

}
function fim() {
  var d = document.createElement('pre'); d.id = 'RESULTADO';
  d.textContent = window.__log.join('\\n'); document.body.appendChild(d);
}
window.addEventListener('error', function (e) { window.__log.push('FALHOU  erro de runtime: ' + e.message); });
// Se rodar() estourar no meio, o <pre id=RESULTADO> nunca nascia e o lado
// Python morria com IndexError, sem dizer ONDE parou. Agora o erro vira a
// ultima linha do log e o RESULTADO sai mesmo assim.
rodar().catch(function (e) {
  window.__log.push('FALHOU  rodar() estourou: ' + (e && e.message ? e.message : e));
  var d = document.getElementById('RESULTADO');
  if (!d) { d = document.createElement('pre'); d.id = 'RESULTADO'; document.body.appendChild(d); }
  d.textContent = window.__log.join('\\n');
});
"""

pagina = f"""<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head>
<body>{corpo}
<script>{STUB}</script>
<script>{js}</script>
<script>{TESTE}</script>
</body></html>"""

tmp = pathlib.Path(tempfile.gettempdir()) / 'pitwall_harness.html'
tmp.write_text(pagina, encoding='utf-8')

perfil = tempfile.mkdtemp()
out = subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-sandbox',
                      f'--user-data-dir={perfil}', '--virtual-time-budget=25000',
                      '--dump-dom', tmp.as_uri()],
                     capture_output=True, text=True, encoding='utf-8', timeout=120)
dom = out.stdout or ''
# Procurar 'RESULTADO' cru engana: a string existe no proprio <script> injetado,
# entao o guard passava e o split estourava com IndexError. Procurar a TAG.
if 'id="RESULTADO">' not in dom:
    print('o teste nao chegou ao fim. DOM:', len(dom), 'chars')
    import re as _re
    for _ln in (out.stderr or '').splitlines():
        if 'Uncaught' in _ln or 'ERROR:' in _ln:
            print('  JS:', _ln[:400])
    print((out.stderr or '')[-2000:])
    sys.exit(1)
res = dom.split('id="RESULTADO">', 1)[1].split('</pre>', 1)[0]
import html as H
res = H.unescape(res)
print(res)
n_falhou = res.count('FALHOU')
print(f'\n{res.count("PASSOU")} passou, {n_falhou} falhou')
sys.exit(1 if n_falhou else 0)
