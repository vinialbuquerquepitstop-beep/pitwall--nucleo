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
var TABELAS = { v_lead: LEADS, dicionario_rotulos: ROTULOS,
  captacao_frente: [{ codigo: 'instagram_dm', rotulo: 'Instagram · DM', ordem: 1, ativo: true }] };
var CAP = [];
// ---- Fase 6: estado mutavel do dia/rotina/conteudo. O stub espelha o contrato
// REAL das RPCs (painel_do_dia etc.), lido de pg_get_functiondef em 17/07/2026.
var ROT_CATS = [{ codigo: 'atendimento', rotulo: 'Atendimento & Vendas', ordem: 1 }];
var ROT_TAREFAS = [{ id: 'rt1', categoria: 'atendimento', titulo: 'Abertura: responder WhatsApp + Direct', dias_semana: null, ordem: 1, ativa: true }];
var DIA = [{ id: 'dt1', categoria: 'atendimento', titulo: 'Abertura: responder WhatsApp + Direct', origem: 'molde', concluida: false, removida: false }];
var DIA_NOTA = ''; var LEMB = [];
var SYNC = { ok: true, quando: '2026-07-17T05:30:00Z', msg: null, horas: 3 };
var CONT = [
  { id: 'c1', titulo: 'Reel bastidores iPhone 17', data: '2026-07-17', tipo_rotulo: 'Reel', tipo_codigo: 'reel', status_rotulo: 'A produzir', status_codigo: 'a_produzir', semana: null, url: 'https://www.notion.so/c1', hoje: true },
  { id: 'c2', titulo: 'Story enquete de acessórios', data: '2026-07-18', tipo_rotulo: 'Story', tipo_codigo: 'story', status_rotulo: 'Planejado', status_codigo: 'planejado', semana: null, url: null, hoje: false }];
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
  ok('cor computada da categoria é --dim (92,102,117)', corCat === 'rgb(92, 102, 117)', corCat);

  // marcar risca e persiste
  var tarefa = document.querySelector('#lista .dia-tarefa');
  ok('tarefa do molde renderizou', !!tarefa && tarefa.textContent.indexOf('Abertura') >= 0);
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
  ok('lembrete apareceu', document.body.textContent.indexOf('Separar película') >= 0);

  ok('"sincronizado há 3h" aparece', document.body.textContent.indexOf('sincronizado há 3h') >= 0);
  ok('conteúdo de hoje lista o Reel', document.body.textContent.indexOf('Reel bastidores') >= 0);

  // ================= FASE 6: aba Conteúdo =================
  document.getElementById('abaConteudo').click();
  await espera(260);
  ok('título virou Conteúdo', document.getElementById('topoTit').textContent === 'Conteúdo');
  ok('pitboard de LEAD escondido no Conteúdo',
     getComputedStyle(document.getElementById('pitboard')).display === 'none');
  ok('agrupou por data com marcador de hoje', !!document.querySelector('#lista .cont-data .hoje-tag'));
  ok('link do Notion presente', !!document.querySelector('#lista .cont-link'));

  // token ausente: mostra mensagem, NÃO trava, e a lista NÃO esvazia
  window.__SYNC_FALHA = 1;
  document.querySelector('[data-acao="sync-agora"]').click();
  await espera(320);
  ok('functions.invoke foi chamado', window.__invocacoes.length === 1, 'n=' + window.__invocacoes.length);
  ok('a falha do token vira toast de erro', document.getElementById('toast').className.indexOf('erro') >= 0,
     document.getElementById('toast').className);
  ok('a lista NÃO esvaziou com o sync falhando', document.querySelectorAll('#lista .cont-lin').length >= 2,
     'n=' + document.querySelectorAll('#lista .cont-lin').length);
  window.__SYNC_FALHA = 0;

  // sync >24h ganha o aviso
  SYNC.horas = 30;
  document.getElementById('abaHoje').click(); await espera(200);
  document.getElementById('abaConteudo').click(); await espera(260);
  ok('sync velho (>24h) ganha a classe de aviso', !!document.querySelector('#lista .sync-lin.velho'));
  SYNC.horas = 3;

  // ================= FASE 6: aba Rotina =================
  document.getElementById('abaRotina').click();
  await espera(260);
  ok('título virou Rotina', document.getElementById('topoTit').textContent === 'Rotina');
  ok('molde mostra "todos os dias"', document.body.textContent.indexOf('todos os dias') >= 0);

  // nova categoria: o código é slug ESTÁVEL do rótulo (a chave nunca é o rótulo)
  document.getElementById('rotNovaCatRot').value = 'Conteúdo & Marketing';
  document.querySelector('[data-acao="rot-add-cat"]').click();
  await espera(260);
  var chCat = window.__rpcChamadas.filter(function (r) { return r.nome === 'salvar_rotina_categoria'; }).pop();
  ok('slug sem acento e sem &', !!chCat && chCat.args.p_codigo === 'conteudo_marketing',
     chCat ? chCat.args.p_codigo : 'não chamou');
  ok('rótulo preservado com acento', !!chCat && chCat.args.p_rotulo === 'Conteúdo & Marketing');
  ok('a categoria nova apareceu', document.body.textContent.indexOf('Conteúdo & Marketing') >= 0);

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
  ok('a tarefa aparece com seg · qua · sex', document.body.textContent.indexOf('seg · qua · sex') >= 0);

  var rmMolde = document.querySelector('#lista [data-acao="rot-rm-tarefa"]');
  rmMolde.click();
  await espera(260);
  ok('remover_rotina_tarefa chamada', window.__rpcChamadas.some(function (r) { return r.nome === 'remover_rotina_tarefa'; }));

  // ---- decisão 7: barra de 5 + Mais (viewport headless = 800px, mobile)
  ok('botão Mais existe', !!document.getElementById('abaMais'));
  ok('4 abas raras', document.querySelectorAll('.aba-rara').length === 4);
  ok('rara começa escondida no mobile', getComputedStyle(document.getElementById('abaDash')).display === 'none');
  document.getElementById('abaMais').click();
  await espera(80);
  ok('Mais abre as raras', getComputedStyle(document.getElementById('abaDash')).display === 'flex');
  ok('aria-expanded acompanha', document.getElementById('abaMais').getAttribute('aria-expanded') === 'true');
  document.getElementById('abaMais').click();
  await espera(80);
  ok('Mais fecha de novo', getComputedStyle(document.getElementById('abaDash')).display === 'none');

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
rodar();
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
if 'RESULTADO' not in dom:
    print('o teste nao chegou ao fim. DOM:', len(dom), 'chars'); print(out.stderr[-1500:]); sys.exit(1)
res = dom.split('id="RESULTADO">', 1)[1].split('</pre>', 1)[0]
import html as H
res = H.unescape(res)
print(res)
n_falhou = res.count('FALHOU')
print(f'\n{res.count("PASSOU")} passou, {n_falhou} falhou')
sys.exit(1 if n_falhou else 0)
