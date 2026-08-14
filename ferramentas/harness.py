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
// A v1 tem a entrega completa; a v2 nasce SEM endereco de proposito, porque a
// linha de entrega do card tem que aparecer NOS DOIS casos: fixture so com o
// campo preenchido nunca provaria o estado que precisa de acao.
//
// v3, v4 e v5 nasceram na v52, para o painel de vendas. Cada uma existe por um
// motivo que o painel POSSA ERRAR, nao para engordar a lista:
//   v3 cancelada  -> aparece como card, mas NAO pode entrar no faturamento;
//   v4 pre_venda  -> entra no faturamento E tem que ser declarada no cabecalho;
//   v5 prejuizo   -> puxa agosto para lucro negativo, que e o unico jeito de
//                    provar que a fita muda para a cor de erro.
// Em todas, valor - custo - frete - taxas bate com o campo lucro de proposito:
// a suite compara as DUAS contas, e fixture inconsistente cegaria justamente a
// assercao que existe para pegar duas definicoes de lucro no sistema.
var VENDAS_STUB = [{ id:'v1', venda_code:'VENDA-0001', modelo_rotulo:'iPhone 13', capacidade:'128GB',
  cor:'Meia-noite', condicao:'seminovo', imei:'355000000000001', cliente_nome:'Diego Souza',
  data_venda:'2026-07-18', valor_venda:3200, lucro:540, status:'concluida', tem_trade_in:false,
  custo_aparelho:2600, despesa_frete:30, despesa_taxas:30,
  lead_id:'l9', cliente_whatsapp:'5521990000000',
  fornecedor_local_retirada:'Campo Grande', endereco_entrega:'Rua das Laranjeiras 100, apto 501',
  valor_a_cobrar:90, forma_pagamento:'pix', motoboy:'Hiago', motoboy_whatsapp:'5521987654321' },
  { id:'v2', venda_code:'VENDA-0002', modelo_rotulo:'iPhone 15', capacidade:'256GB',
  cliente_nome:'Ana Lima', data_venda:'2026-07-19', valor_venda:5000, lucro:800,
  custo_aparelho:4100, despesa_frete:90, despesa_taxas:10,
  status:'concluida', tem_trade_in:false, lead_id:'l8', cliente_whatsapp:'5521990000001',
  endereco_entrega:null, valor_a_cobrar:null, forma_pagamento:null,
  motoboy:null, motoboy_whatsapp:null },
  { id:'v3', venda_code:'VENDA-0003', modelo_rotulo:'iPhone 16', cliente_nome:'Fantasma',
  data_venda:'2026-07-20', valor_venda:9999, lucro:9999, status:'cancelada', tem_trade_in:false,
  custo_aparelho:0, despesa_frete:0, despesa_taxas:0, lead_id:'l7' },
  { id:'v4', venda_code:'VENDA-0004', modelo_rotulo:'iPhone 14', cliente_nome:'Bruno Reis',
  data_venda:'2026-08-05', valor_venda:2000, lucro:300, status:'pre_venda', tem_trade_in:false,
  custo_aparelho:1650, despesa_frete:50, despesa_taxas:0, lead_id:'l6' },
  { id:'v5', venda_code:'VENDA-0005', modelo_rotulo:'iPhone 12', cliente_nome:'Carla Nunes',
  data_venda:'2026-08-06', valor_venda:1000, lucro:-500, status:'concluida', tem_trade_in:false,
  custo_aparelho:1400, despesa_frete:100, despesa_taxas:0, lead_id:'l5' }];
// carregarVendasArq() le a TABELA venda com .not('arquivado_em','is',null). O
// stub trata .not como PASSAGEM, nao como filtro, entao quem carrega o sentido
// do filtro aqui e o proprio fixture: nesta chave entra so a linha ja
// arquivada. Ela existe por dois motivos: provar que venda arquivada fica FORA
// do faturamento do painel, e fazer aparecer o botao "1 arquivada", sem o qual
// a assercao de que abrir a gaveta nao rele a base nao roda em rodada nenhuma.
var VENDAS_ARQ_STUB = [{ id:'v9', venda_code:'VENDA-0009', modelo_texto:'iPhone 11',
  comprador_nome:'Duplicata arquivada', valor_venda:8400, data_venda:'2026-07-16',
  arquivado_em:'2026-07-27T10:00:00Z' }];
var CATALOGO_STUB = [{ id:'m1', rotulo:'iPhone 13' }, { id:'m2', rotulo:'iPhone 15' }];
// Motoboys cadastrados. O segundo nasce SEM telefone de proposito: a lista tem
// que dizer "sem WhatsApp" e o botao dele tem que recusar o despacho, em vez de
// montar um wa.me sem numero.
var MOTOBOYS = [{ id:'mb1', nome:'Hiago', whatsapp:'5521987654321' },
                { id:'mb2', nome:'Rafa sem numero', whatsapp:null }];
var TABELAS = { v_lead: LEADS, dicionario_rotulos: ROTULOS, v_venda: VENDAS_STUB,
  venda: VENDAS_ARQ_STUB, catalogo_iphone: CATALOGO_STUB,
  motoboy: MOTOBOYS,
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
// ---- Molde de conteudo (Fatia 1, 13/08/2026; cruzamento na Fatia 2, 14/08) ----
// O fixture NAO foi inventado: e o retorno real de molde_semana() medido contra
// o banco em 13 e 14/08/2026, depois de a Edge Function ler o bloco JSON da
// pagina Central de Conteudo. Molde v3: segunda reel_topo, terca carrossel,
// quarta reel, quinta nada, sexta reel, sabado nada, domingo nada. Se o molde do
// Notion mudar, este fixture fica velho de proposito: ele prova a TELA, nao o
// molde, e a prova do molde vivo e prova_molde.sql.
//
// AS DATAS SAO RELATIVAS A SEMANA CORRENTE, e isso nao e detalhe de estilo. Ate
// a Fatia 1 a semana fixa de 10 a 16/08 era inofensiva, porque a grade so
// DESCREVIA. A Fatia 2 deriva atraso a partir de hoje: com data fixa, na segunda
// 17/08 os sete dias virariam passado, todo dia sem card viraria FALTA, e a
// suite seguiria verde provando outra coisa. E o mesmo motivo pelo qual o CONT
// abaixo ja usa _dISO(off).
// Sem operador de resto de proposito: este JS mora dentro de uma string com
// formatacao por porcento do Python, e um sinal solto ali quebra o arquivo
// inteiro antes de o navegador abrir.
function _segISO(off, semanas) {
  var d = new Date(), dow = d.getDay();          // 0 = domingo
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1) + (semanas || 0) * 7 + off);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function _ddmm(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
// O cruzamento e o da semana real de 10 a 16/08/2026, medido pela RPC: segunda,
// quarta e sexta com peca criada; terca SEM o carrossel que o molde pede;
// sabado com um carrossel que o molde nao pede. Sexta vai publicada de
// proposito, para o canal de EXECUCAO ter um caso vivo em vez de so ausencias.
function _molde(semanas) {
  return {
    ok: true, tem_molde: true, version: 3, vigente_desde: '2026-08-13',
    lido_em: '2026-08-13T12:00:00Z', idade_horas: 0.4, stale_horas: 24, stale: false,
    semana_ini: _segISO(0, semanas), semana_fim: _segISO(6, semanas),
    metas: { reels_semana: 3, carrossel_semana: 1, stories_semana: 49 },
    stories: { previstos: 49, existentes: 8, no_ar: 1 },
    // Fatia 3: as cinco regras, como a RPC devolve, copiadas do payload real do
    // molde v3. Nenhuma delas e conferida contra nada: sao consulta.
    regras: {
      story_slots: [
        { slot: 1, funcao: 'bom_dia',           janela: '07h-08h' },
        { slot: 2, funcao: 'abertura_motor',    janela: '10h-11h' },
        { slot: 3, funcao: 'desenvolvimento',   janela: '12h-13h' },
        { slot: 4, funcao: 'produto_real',      janela: '15h-16h' },
        { slot: 5, funcao: 'interacao',         janela: '17h-18h' },
        { slot: 6, funcao: 'cta',               janela: '18h-19h', oferta_permitida: 'quinta' },
        { slot: 7, funcao: 'fechamento_humano', janela: '20h-21h' }
      ],
      tetos: { humor_mes: 2, humor_substitui: 'reel_sexta', humor_intervalo_dias: 7 },
      proibicoes: ['preco_em_feed', 'preco_em_reel', 'seta_fora_de_carrossel',
                   'palavra_revenda', 'autorizada_apple', 'auto_publicar_oferta',
                   'agendar_alcance_fim_de_semana', 'criativo_renderizado'],
      garantia: { seminovo: '3 meses', lacrado: '1 ano', macbook: '1 ano', ipad: '1 ano' },
      caixinha: { abre: 'sabado_slot5', responde: 'quinta_slots2a5', reabre: 'quarta_slot5' }
    },
    avisos: [],
    dias: [
      { dia: 'segunda', data: _segISO(0, semanas), motor: 'iphone_volume',         feed_previsto: 'reel_topo', horario: '10h-11h', existe: true,  no_ar: false, fora_do_molde: [] },
      { dia: 'terca',   data: _segISO(1, semanas), motor: 'macbook',               feed_previsto: 'carrossel', horario: '10h-11h', existe: false, no_ar: false, fora_do_molde: [] },
      { dia: 'quarta',  data: _segISO(2, semanas), motor: 'autoridade_apple',      feed_previsto: 'reel',      horario: '10h-11h', existe: true,  no_ar: false, fora_do_molde: [] },
      { dia: 'quinta',  data: _segISO(3, semanas), motor: 'caixinha_e_oferta',     feed_previsto: null,        horario: null,      existe: false, no_ar: false, fora_do_molde: [] },
      { dia: 'sexta',   data: _segISO(4, semanas), motor: 'seguranca_procedencia', feed_previsto: 'reel',      horario: '10h-11h', existe: true,  no_ar: true,  fora_do_molde: [] },
      { dia: 'sabado',  data: _segISO(5, semanas), motor: 'ecossistema',           feed_previsto: null,        horario: null,      existe: false, no_ar: false, fora_do_molde: ['carrossel'] },
      { dia: 'domingo', data: _segISO(6, semanas), motor: 'indicacao_posvenda',    feed_previsto: null,        horario: null,      existe: false, no_ar: false, fora_do_molde: [] }
    ]
  };
}
var MOLDE_V3 = _molde(0);
window.__MOLDE = JSON.parse(JSON.stringify(MOLDE_V3));
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
// Contador irmao do __rpcChamadas, para o lado das TABELAS. Sem ele nao da para
// afirmar "este clique nao releu a base": so se via a RPC, e a leitura de
// v_lead/dicionario_rotulos passava invisivel.
window.__fromChamadas = [];
window.supabase = {
  createClient: function () {
    return {
      auth: {
        getSession: function () { return Promise.resolve({ data: { session: { user: { id: 'u1' } } }, error: null }); },
        onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
        signOut: function () { return Promise.resolve({ error: null }); }
      },
      // Todo metodo de filtro devolve `api`, e `api` e thenable: assim o await
      // funciona seja qual for o ULTIMO elo da cadeia. A versao antiga so resolvia
      // em .order(), e nao tinha .not() nem .limit(): como o app faz
      // .select().not().order() para as vendas arquivadas, `api.not` era undefined,
      // carregarVendasArq() estourava, primeiraFalha() pegava, e o render saia
      // deixando "Lendo vendas…" na tela. Isso derrubava 3 assercoes e MATAVA a
      // rodada num null.click(), entao tudo depois da aba Vendas (incluindo a Fila)
      // nunca era testado. Stub incompleto nao falha barulhento: ele cega o teste.
      // .eq() e .neq() FILTRAM de verdade desde 11/08/2026. Antes devolviam a
      // tabela inteira, e isso cegava o teste do mesmo jeito que o .not()
      // ausente cegava: a troca cirurgica do card faz
      // .from('v_lead').select('*').eq('id', id), esperando UMA linha, e o stub
      // devolvia as 25. O app pegava data[0] (lead ERRADO) e a assercao passava
      // pelo motivo errado. Stub que ignora filtro nao e stub: e mentira.
      from: function (tabela) {
        window.__fromChamadas.push(tabela);
        var filtros = [];
        var api = {};
        ['select', 'not', 'is', 'in', 'gt', 'gte', 'lt', 'lte',
         'like', 'ilike', 'or', 'limit', 'range', 'order'].forEach(function (m) {
          api[m] = function () { return api; };
        });
        api.eq  = function (col, val) { filtros.push([col, val, false]); return api; };
        api.neq = function (col, val) { filtros.push([col, val, true]);  return api; };
        api.then = function (f, r) {
          var linhas = (TABELAS[tabela] || []).filter(function (x) {
            return filtros.every(function (ft) {
              return ft[2] ? x[ft[0]] !== ft[1] : x[ft[0]] === ft[1];
            });
          });
          return Promise.resolve({ data: linhas, error: null }).then(f, r);
        };
        return api;
      },
      rpc: function (nome, args) {
        window.__rpcChamadas.push({ nome: nome, args: args });
        if (nome === 'historico_lead') return Promise.resolve({ data: { ok: true, eventos: HIST }, error: null });
        if (nome === 'sugerir_mensagem') {
          // read-only, so devolve texto (invariante 13). 3 variantes; a 1a alimenta o Enviar da Fila.
          return Promise.resolve({ data: { ok: true, whatsapp: '5521990000000', opcoes: [
            { rotulo_variante: 'Direto',     texto: 'Texto sugerido variante 1' },
            { rotulo_variante: 'Consultivo', texto: 'Variante consultiva' },
            { rotulo_variante: 'Leve',       texto: 'Variante leve' } ] }, error: null });
        }
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
          if (!pv.modelo_id && !pv.modelo_texto)
            return Promise.resolve({ data: { ok: false, erro: 'modelo obrigatorio' }, error: null });
          return Promise.resolve({ data: { ok: true, id: 'nova', venda_code: 'VENDA-0002' }, error: null });
        }
        // ---- Entrega e motoboy: o stub espelha as regras REAIS das RPCs,
        // conferidas contra o banco em 08/08/2026 (prova_entrega.sql, 28 ok).
        if (nome === 'editar_venda') {
          var pv2 = (args && args.payload) || {};
          if (!pv2.id) return Promise.resolve({ data: { ok: false, erro: 'Informe qual venda corrigir.' }, error: null });
          var mw = String(pv2.motoboy_whatsapp || '').replace(/\D/g, '');
          if (mw && !(mw.length >= 10 && mw.length <= 15))
            return Promise.resolve({ data: { ok: false, erro: 'WhatsApp do motoboy invalido: ' + mw }, error: null });
          return Promise.resolve({ data: { ok: true, id: pv2.id, venda_code: 'VENDA-0001' }, error: null });
        }
        if (nome === 'salvar_motoboy') {
          var pm = (args && args.payload) || {};
          if (!String(pm.nome || '').trim())
            return Promise.resolve({ data: { ok: false, erro: 'O motoboy precisa de um nome.' }, error: null });
          var pmd = String(pm.whatsapp || '').replace(/\D/g, '');
          if (!pmd)
            return Promise.resolve({ data: { ok: false, erro: 'Informe o WhatsApp: e por ele que o relatorio e enviado.' }, error: null });
          if (pmd.length === 10 || pmd.length === 11) pmd = '55' + pmd;
          MOTOBOYS.push({ id: 'mb' + (MOTOBOYS.length + 1), nome: pm.nome, whatsapp: pmd });
          return Promise.resolve({ data: { ok: true, id: 'mb' + MOTOBOYS.length, msg: pm.nome + ' entrou na lista.' }, error: null });
        }
        if (nome === 'desligar_motoboy') {
          // soft delete: some da leitura viva, a linha fica (igual ao banco)
          MOTOBOYS = MOTOBOYS.filter(function (x) { return x.id !== args.p_id; });
          TABELAS.motoboy = MOTOBOYS;
          return Promise.resolve({ data: { ok: true, msg: 'saiu da lista.' }, error: null });
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
        // ---- escrita de lead. Ate 11/08/2026 NENHUMA delas era stubada: caiam
        // no 'rpc nao stubada' (ok:false), q() ia para o ramo de erro, e o
        // caminho de recarga pos-acao NUNCA era exercitado pela suite. Os
        // efeitos abaixo espelham pg_get_functiondef, lido do banco em
        // 11/08/2026:
        //   registrar_toque       -> ultimo_toque_em = now()  (tira da fila do
        //                            dia, porque entraNaFila exige
        //                            dataLocalDe(ultimo_toque_em) !== hoje)
        //   registrar_resposta    -> respondido_em = now()    (NAO tira da fila)
        //   registrar_conversando -> etapa_cadencia + ultimo_toque_em
        //   registrar_desfecho    -> sem_interesse: status=lista_fria e
        //                            proximo_contato=null
        if (nome === 'registrar_toque') {
          LEADS.forEach(function (x) { if (x.id === args.p_lead_id) x.ultimo_toque_em = new Date().toISOString(); });
          return Promise.resolve({ data: { ok: true, msg: 'Toque registrado', lead_id: args.p_lead_id }, error: null });
        }
        if (nome === 'registrar_resposta') {
          LEADS.forEach(function (x) { if (x.id === args.p_lead_id) x.respondido_em = new Date().toISOString(); });
          return Promise.resolve({ data: { ok: true, msg: 'Resposta registrada', lead_id: args.p_lead_id }, error: null });
        }
        if (nome === 'registrar_conversando') {
          LEADS.forEach(function (x) { if (x.id === args.p_lead_id) { x.etapa_cadencia = 'conversando'; x.ultimo_toque_em = new Date().toISOString(); } });
          return Promise.resolve({ data: { ok: true, msg: 'Conversa registrada', lead_id: args.p_lead_id }, error: null });
        }
        if (nome === 'registrar_desfecho') {
          if (args.p_tipo !== 'convertido' && args.p_tipo !== 'sem_interesse')
            return Promise.resolve({ data: { ok: false, msg: 'Tipo de desfecho invalido: ' + args.p_tipo }, error: null });
          LEADS.forEach(function (x) {
            if (x.id !== args.p_lead_id) return;
            if (args.p_tipo === 'sem_interesse') { x.status = 'lista_fria'; x.proximo_contato = null; }
            else x.status = 'convertido';
          });
          return Promise.resolve({ data: { ok: true, msg: 'Sem interesse (app)', lead_id: args.p_lead_id }, error: null });
        }
        if (nome === 'salvar_nota') { DIA_NOTA = args.p_texto; return Promise.resolve({ data: { ok: true, msg: 'Nota salva' }, error: null }); }
        if (nome === 'salvar_lembrete') { LEMB.push({ id: 'lb' + (LEMB.length + 1), texto: args.p_texto, feito: false }); return Promise.resolve({ data: { ok: true, msg: 'Lembrete salvo' }, error: null }); }
        if (nome === 'marcar_lembrete') { LEMB.forEach(function (x) { if (x.id === args.p_lembrete_id) x.feito = args.p_feito; }); return Promise.resolve({ data: { ok: true, msg: 'Lembrete atualizado' }, error: null }); }
        if (nome === 'remover_lembrete') { LEMB = LEMB.filter(function (x) { return x.id !== args.p_lembrete_id; }); return Promise.resolve({ data: { ok: true, msg: 'Lembrete removido' }, error: null }); }
        if (nome === 'puxar_rotina') { return Promise.resolve({ data: { ok: true, msg: 'Rotina do dia pronta', novas: 0 }, error: null }); }
        // As tres de escrita nao mudam o fixture: o que se prova aqui e que o
        // TOQUE chega na RPC com os argumentos certos. O efeito no banco ja
        // esta provado em ferramentas/prova_escopo.sql.
        if (nome === 'criar_acao_escopo')       return Promise.resolve({ data: { ok: true, id: 'ea9', msg: 'Ação criada.' }, error: null });
        if (nome === 'mudar_status_acao_escopo') return Promise.resolve({ data: { ok: true, msg: 'Pronto.' }, error: null });
        if (nome === 'descartar_acao_escopo')    return Promise.resolve({ data: { ok: true, msg: 'Descartada.' }, error: null });
        // Fatia B: a urgencia. __PRIO_ERRO devolve o contrato de ERRO de
        // transporte (data null + error), que e o caminho que o app trata em
        // O() e que nenhuma prova cobria: RPC que falha calada e pior que RPC
        // que nao existe.
        if (nome === 'definir_prioridade_acao') {
          if (window.__PRIO_ERRO) return Promise.resolve({ data: null, error: { message: 'permissao negada (prova)' } });
          return Promise.resolve({ data: { ok: true, msg: 'Urgência definida.' }, error: null });
        }
        if (nome === 'escopo_completo') {
          // As 5 frentes cobrem os casos do grafico de abandono, e nao a
          // realidade do banco: 35 dias (satura), 9 (degrau do meio), 3
          // (recente), uma sem acao nenhuma (nao vira coluna) e o grupo
          // pendencia (fora do grafico inteiro). pitscare fica PRIMEIRA de
          // proposito: as assercoes de clique da Fatia 1 pegam sempre o
          // primeiro controle do DOM, e mover a ordem quebraria as quatro.
          return Promise.resolve({ data: { ok: true, pode_editar: !window.__ESC_LEITURA, frentes: [
            { codigo:'pitscare', rotulo:'Pitscare', grupo:'frente', icone:'escudo', ordem:60,
              total:2, feitas:1, travadas:1, dias_parada:3, nota:65, faixa:'normal',
              fazendo:0, urgencia:null,
              acoes:[{ id:'ea1', titulo:'Aplicar os 19 scripts', status:'travado', motivo_trava:'capability Update content', prioridade:null },
                     { id:'ea2', titulo:'Fundir a branch', status:'a_fazer', motivo_trava:null, prioridade:null }] },
            { codigo:'colaboradores', rotulo:'Colaboradores', grupo:'frente', icone:'pessoas', ordem:10,
              total:2, feitas:0, travadas:0, dias_parada:35, nota:40, faixa:'em_baixa',
              fazendo:1, urgencia:'alta',
              acoes:[{ id:'ea3', titulo:'Criar drive com imagens', status:'fazendo', motivo_trava:null, prioridade:'alta' },
                     { id:'ea4', titulo:'Reunião com thiego', status:'a_fazer', motivo_trava:null, prioridade:null }] },
            { codigo:'calculadoras', rotulo:'Calculadoras', grupo:'frente', icone:'calculadora', ordem:80,
              total:1, feitas:0, travadas:0, dias_parada:9, nota:55, faixa:'normal',
              fazendo:0, urgencia:'baixa',
              acoes:[{ id:'ea5', titulo:'Copiar de A até X aparelho', status:'a_fazer', motivo_trava:null, prioridade:'baixa' }] },
            { codigo:'assistencia', rotulo:'Assistência técnica', grupo:'frente', icone:'chave', ordem:30,
              total:0, feitas:0, travadas:0, dias_parada:null, nota:null, faixa:'sem_dado',
              fazendo:0, urgencia:null, acoes:[] },
            { codigo:'pendencias', rotulo:'Pendências', grupo:'pendencia', icone:'alerta', ordem:99,
              total:0, feitas:0, travadas:0, dias_parada:null, nota:null, faixa:'sem_dado',
              fazendo:0, urgencia:null, acoes:[] }
          ] }, error: null });
        }
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
        // O molde vem de window.__MOLDE para o teste trocar de cena (cache
        // vazio, stale, tipo desconhecido) sem recarregar a pagina.
        if (nome === 'molde_semana') { return Promise.resolve({ data: window.__MOLDE, error: null }); }
        return Promise.resolve({ data: { ok: false, msg: 'rpc nao stubada: ' + nome }, error: null });
      },
      functions: {
        // o botao Sincronizar: com __SYNC_FALHA o stub devolve o contrato REAL
        // de token ausente (200 + ok:false), provado contra o servico no ar
        invoke: function (nome, opts) {
          window.__invocacoes.push({ nome: nome, opts: opts });
          if (nome === 'mover-conteudo') {
            var b = (opts && opts.body) || {};
            var rot = { a_produzir: 'A produzir', em_producao: 'Em produção', pronto: 'Pronto', publicado: 'Publicado' }[b.para];
            CONT.forEach(function (x) { if (x.id === b.id) { x.status_codigo = b.para; x.status_rotulo = rot; } });
            return Promise.resolve({ data: { ok: true, status_codigo: b.para, status_rotulo: rot }, error: null });
          }
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

  // A aba de arranque passou a ser Hoje em 31/07/2026 (pedido do dono). Este
  // bloco testa a FILA, entao ele declara a propria precondicao com um clique
  // em vez de herda-la do padrao do app: teste que depende de qual aba abre
  // primeiro quebra toda vez que essa decisao de produto muda, e a quebra nao
  // diz nada sobre o que ele deveria estar provando.
  ok('a aba de arranque e Hoje', document.getElementById('abaHoje').getAttribute('aria-selected') === 'true',
     'abaHoje aria-selected=' + document.getElementById('abaHoje').getAttribute('aria-selected'));

  // ---- a forma do Stitch na aba Hoje (08/08/2026) ---------------------------
  // Mesma armadilha do bloco da Fila: sem estas, o bloco "HOJE" do app.css podia
  // estar MORTO e a suite passaria a toa. Foi exatamente o que aconteceu com a
  // Fila entre 06 e 08/08: 16 regras penduradas num seletor que nunca casava.
  var lstH = document.getElementById('lista');
  ok('#lista declara a aba Hoje', lstH.getAttribute('data-aba') === 'hoje',
     'data-aba=' + lstH.getAttribute('data-aba'));
  ok('a bandeja do Hoje esta tingida (secao branca flutua)',
     getComputedStyle(lstH).backgroundColor === 'rgb(246, 247, 250)',
     getComputedStyle(lstH).backgroundColor);
  var secs = document.querySelectorAll('#lista .dia-sec');
  ok('o Hoje renderizou secoes', secs.length > 0, 'secoes=' + secs.length);
  ok('a secao do Hoje pegou o raio novo',
     getComputedStyle(secs[0]).borderTopLeftRadius === '12px',
     getComputedStyle(secs[0]).borderTopLeftRadius);
  ok('a secao do Hoje tem sombra',
     getComputedStyle(secs[0]).boxShadow.indexOf('rgba(15, 21, 35, 0.06)') >= 0,
     getComputedStyle(secs[0]).boxShadow);
  // o placar continua com os QUATRO numeros reais. Os mockups do Stitch pintam
  // este mesmo lugar com Uptime 99.98% e 70% da Capacidade Total, que nao
  // existem no banco. Esta assercao existe para que nunca entrem.
  ok('o placar do Hoje tem 4 celulas',
     document.querySelectorAll('#lista .pitboard .pb-celula').length === 4,
     'celulas=' + document.querySelectorAll('#lista .pitboard .pb-celula').length);
  var rots = Array.prototype.map.call(
    document.querySelectorAll('#lista .pitboard .pb-rot'),
    function (x) { return x.textContent.trim(); }).join(',');
  ok('e sao rotina, conteudo, lembretes e sync', rots.indexOf('sync') >= 0 && rots.indexOf('rotina') >= 0, rots);

  document.getElementById('abaFila').click();
  await espera(260);

  var cards = document.querySelectorAll('#lista .card');
  ok('a fila renderizou cards', cards.length > 0, 'cards=' + cards.length);

  // ---- o gancho [data-aba] e o estilo da Fila (03/08/2026) -----------------
  // Sem estas 4, o bloco "ABA FILA" do app.css podia estar MORTO e a suite
  // inteira passaria a toa: seletor que nunca casa nao quebra nada.
  var lst = document.getElementById('lista');
  ok('#lista declara a aba corrente', lst.getAttribute('data-aba') === 'fila',
     'data-aba=' + lst.getAttribute('data-aba'));
  ok('a bandeja da Fila esta tingida (card branco flutua)',
     getComputedStyle(lst).backgroundColor === 'rgb(246, 247, 250)',
     getComputedStyle(lst).backgroundColor);
  ok('o card da Fila pegou o raio novo',
     getComputedStyle(cards[0]).borderTopLeftRadius === '12px',
     getComputedStyle(cards[0]).borderTopLeftRadius);
  ok('o card da Fila tem sombra (a bandeja sozinha nao separa: mede 1.07)',
     getComputedStyle(cards[0]).boxShadow.indexOf('rgba(15, 21, 35, 0.06)') >= 0,
     getComputedStyle(cards[0]).boxShadow);
  var card = document.querySelector('.card[data-lead="LEAD-0005"]');
  if (!card) { ok('LEAD-0005 na fila', false); return fim(); }

  // ---- Respondeu mora no leque Desfecho (03/08/2026, pedido do dono) --------
  // Ele SO mudou de lugar. Sumir seria tirar o unico freio da regua:
  // registrar_resposta grava respondido_em, que fn_regua_varredura le, enquanto
  // registrar_conversando grava etapa_cadencia, que a regua nao le (conferido no
  // banco em 03/08/2026). Esta assercao existe para que "limpar a fileira" no
  // futuro nao vire, sem querer, apagar o freio.
  var resp = card.querySelector('[data-acao="respondeu"]');
  ok('o botao Respondeu continua existindo', !!resp);
  ok('Respondeu esta DENTRO do leque Desfecho', !!(resp && resp.closest('.desfechos')),
     resp ? resp.parentElement.className : 'ausente');
  ok('Respondeu saiu da fileira de escrita',
     !card.querySelector('.card-acoes [data-acao="respondeu"]'));
  // O seletor mudou em 11/08/2026 e a INTENCAO nao: o grupo de escrita deixou
  // de ser um .card-acoes proprio (uma faixa abaixo) e virou .acoes-escrita,
  // dentro da mesma faixa da leitura, empurrado para a direita. O guard-rail
  // nao foi calado nem a baseline repontada: ele aponta para o objeto que
  // substituiu o antigo, e segue provando que la moram DOIS botoes, nao tres.
  ok('o grupo de escrita ficou com 2 botoes',
     card.querySelectorAll('.acoes-escrita .btn-acao').length === 2,
     String(card.querySelectorAll('.acoes-escrita .btn-acao').length));
  // e ele esta na MESMA faixa da leitura, nao numa segunda: se um dia voltar a
  // ser irmao do .card-acoes em vez de filho, esta assercao cai.
  ok('o grupo de escrita mora dentro da faixa de leitura',
     !!card.querySelector('.card-acoes > .acoes-escrita'));
  ok('e o leque ainda oferece Conversando ao lado',
     !!card.querySelector('.desfechos [data-acao="conversando"]'));

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
  ok('ordem: Fila, Rotina, Conteúdo, Lembretes, Nota',
     tits.join(' | ') === 'Fila de hoje | Rotina do dia | Conteúdo de hoje | Lembretes | Nota do dia', tits.join(' | '));

  // ---- Fila embutida no Hoje (Peca A): preview read-only, so acao Sugerir ----
  var filaLins = document.querySelectorAll('#lista .fila-lin');
  ok('Fila no Hoje renderiza linhas de lead', filaLins.length > 0, 'n=' + filaLins.length);
  ok('Fila mostra no maximo 5 linhas', filaLins.length <= 5, 'n=' + filaLins.length);
  ok('linha da Fila tem a acao Sugerir (invariante 13)',
     !!document.querySelector('#lista .fila-lin [data-acao="hoje-sugerir"]'));
  ok('Fila NAO tem toque nem desfecho (so leitura)',
     !document.querySelector('#lista .fila-lin [data-acao="tocar"]') &&
     !document.querySelector('#lista .fila-lin [data-acao="fechou"]'));
  ok('Fila tem botao "ver todos"', !!document.querySelector('#lista [data-acao="hoje-verfila"]'));

  // ---- Fatia 2: botao Enviar na linha da Fila (texto sugerido, LGPD-gated) ----
  var envs = document.querySelectorAll('#lista .fila-lin a.fila-wa');
  ok('Fila tem botao Enviar (wa.me) nas linhas com consentimento', envs.length > 0, 'n=' + envs.length);
  ok('Enviar aponta pra wa.me com o texto sugerido (variante 1)',
     envs.length > 0
       && envs[0].getAttribute('href').indexOf('wa.me/') >= 0
       && envs[0].getAttribute('href').indexOf('Texto%20sugerido') >= 0,
     envs.length ? envs[0].getAttribute('href') : '(nenhum)');
  ok('prefetch chamou sugerir_mensagem pros leads da previa (invariante 13)',
     window.__rpcChamadas.some(function (c) { return c.nome === 'sugerir_mensagem'; }));
  var semConsent = document.querySelector('#lista .fila-lin[data-lead="LEAD-9001"]');
  ok('linha do lead sem consentimento renderizou na Fila', !!semConsent);
  ok('trava LGPD: lead sem consentimento NAO tem Enviar (invariante 16)',
     !!semConsent && !semConsent.querySelector('a.fila-wa'));


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

  // ---- MOLDE DE CONTEUDO: a grade oficial, lida do Notion (Fatia 1) --------
  // A regra de ouro do dono: o app NUNCA declara grade. Le, e sem cache nao
  // desenha nada. Todas as assercoes consultam o DOM RENDERIZADO (#lista),
  // nunca document.body.textContent, que enxerga o proprio app.js colado.
  window.__erroMolde = [];
  window.addEventListener('error', function (ev) { window.__erroMolde.push(String(ev.message)); });

  async function reabrirConteudo() {
    document.getElementById('abaHoje').click();
    await espera(160);
    document.getElementById('abaConteudo').click();
    await espera(280);
  }
  function molDias() { return [].slice.call(document.querySelectorAll('#lista .mol-grade .mol-dia')); }
  function molPecas() {
    return molDias().map(function (d) {
      var p = d.querySelector('.mol-peca'); return p ? p.textContent.trim() : '';
    });
  }

  ok('a secao do molde existe acima do kanban', !!document.querySelector('#lista .mol'));
  ok('o molde desenha 7 dias', molDias().length === 7, 'n=' + molDias().length);
  // A grade tem que ser o v3 do Notion, dia a dia. Se alguem chumbar uma grade
  // no JS, ela vai divergir daqui na primeira vez que o dono editar o Notion.
  ok('a grade e a do molde v3, dia a dia',
     molPecas().join('|') === 'reel topo|carrossel|reel|—|reel|—|—', molPecas().join('|'));
  ok('a version do molde esta declarada na tela',
     document.querySelector('#lista .mol-ver').textContent.indexOf('v3') >= 0,
     document.querySelector('#lista .mol-ver').textContent);
  ok('a semana esta DECLARADA (tela que omite recorte mente)',
     document.querySelector('#lista .mol-janela').textContent.trim() ===
       _ddmm(_segISO(0, 0)) + ' a ' + _ddmm(_segISO(6, 0)),
     document.querySelector('#lista .mol-janela').textContent);
  ok('as metas do molde aparecem, e vem do molde',
     /3 reels/.test(document.querySelector('#lista .mol-metas').textContent) &&
     /49 stories/.test(document.querySelector('#lista .mol-metas').textContent),
     document.querySelector('#lista .mol-metas').textContent);
  ok('dia sem peca de feed le como folga, nao como falha',
     document.querySelectorAll('#lista .mol-dia.folga').length === 3,
     'n=' + document.querySelectorAll('#lista .mol-dia.folga').length);
  ok('molde fresco NAO mostra aviso de staleness',
     document.querySelectorAll('#lista .mol-aviso.stale').length === 0);

  // ---- Fatia 2 (14/08/2026): a grade COBRA -------------------------------
  // O que se prova aqui e ESTRUTURA, que nao depende de que dia da semana o
  // teste roda. O comportamento que depende de hoje (FALTA, atrasado) tem cena
  // propria mais abaixo, com a semana inteira no passado e no futuro.
  function molSel(s) { return [].slice.call(document.querySelectorAll('#lista ' + s)); }
  // Planejamento (a peca foi criada) e execucao (ela foi ao ar) sao dois
  // elementos SEPARADOS. Um chip so respondendo as duas perguntas diria
  // "Reels 3 de 3" numa semana em que zero Reel foi ao ar: e o colapso que os
  // invariantes 2 e 3 proibem em toque x respondido.
  ok('so dia com peca prevista ganha leitura de planejamento',
     molSel('.mol-plan').length === 4, 'n=' + molSel('.mol-plan').length);
  ok('planejamento e execucao sao elementos DISTINTOS, nunca um chip so',
     molSel('.mol-plan').length > 0 && molSel('.mol-exec').length > 0 &&
     molSel('.mol-plan.mol-exec').length === 0,
     'plan=' + molSel('.mol-plan').length + ' exec=' + molSel('.mol-exec').length +
     ' fundidos=' + molSel('.mol-plan.mol-exec').length);
  ok('dia de folga NAO ganha chip de cobranca (folga e pausa, nao falha)',
     molSel('.mol-dia.folga .mol-plan').length === 0 &&
     molSel('.mol-dia.folga .mol-exec').length === 0);
  // O icone carrega a distincao, nao e enfeite: as colisoes de luminancia entre
  // os tokens semanticos ficam entre 1.14 e 1.44, entao matiz sozinho nao
  // separa. Mesma regra que prova_trilho.py cobra dos 7 trilhos.
  var chips = molSel('.mol-plan').concat(molSel('.mol-exec'), molSel('.mol-fora'), molSel('.mol-cob'));
  ok('todo chip de cobranca carrega ICONE (matiz sozinho nao distingue)',
     chips.length > 0 && chips.every(function (x) { return !!x.querySelector('svg.mol-ico'); }),
     'chips=' + chips.length + ' sem icone=' +
     chips.filter(function (x) { return !x.querySelector('svg.mol-ico'); }).length);
  // Peca a mais nao e falha, e divergencia: ela nao pode usar a cor de
  // urgencia, senao dois significados disputam o mesmo canal.
  var fora = document.querySelector('#lista .mol-fora');
  ok('a peca que o molde nao pede aparece como fora do molde',
     molSel('.mol-fora').length === 1 && /carrossel/.test(fora.textContent),
     fora ? fora.textContent.trim() : 'sem fora do molde');
  ok('e ela e NEUTRA, nao laranja (divergencia nao e urgencia)',
     !!fora && getComputedStyle(fora).color === 'rgb(92, 102, 117)',
     fora ? getComputedStyle(fora).color : 'sem fora do molde');
  // O rodape le a MESMA lista de dias que a grade desenha: duas contagens
  // seriam duas verdades. E planejado x no ar aparecem lado a lado, nunca
  // somados num numero so.
  var res = document.querySelector('#lista .mol-resumo');
  ok('o rodape declara planejado e no ar SEPARADOS, e os stories',
     !!res && /planejado 3 de 4/.test(res.textContent) &&
     /no ar 1 de 4/.test(res.textContent) && /stories 8 de 49/.test(res.textContent),
     res ? res.textContent.trim() : 'sem resumo');
  ok('meta declarada e semana medida sao duas linhas, nao uma',
     !!document.querySelector('#lista .mol-metas') && !!res &&
     document.querySelector('#lista .mol-metas') !== res);

  // ---- Fatia 3 (14/08/2026): as regras, que sao CONSULTA e nao cobranca ----
  // O Pit Wall nao confere nenhuma das cinco. O risco desta fatia nao e visual,
  // e semantico: oito proibicoes em vermelho leriam como oito violacoes, e a
  // tela estaria acusando o dono de algo que ela nunca mediu.
  var reg = document.querySelector('#lista .mol-regras');
  ok('o bloco de regras existe', !!reg);
  // A propriedade `open` NAO prova que a gaveta esta fechada: regra de autor
  // vence a folha do agente, e um display:grid solto no corpo deixava o bloco
  // permanentemente aberto por cima do kanban com `open === false`. Quem pegou
  // foi o diag_mobile, com 30 sobreposicoes em 360px. Aqui se mede o display
  // COMPUTADO, que e o que a tela realmente faz.
  // Sem o !! aqui, apagar a nota fazia o getComputedStyle estourar e derrubar
  // as 458 assercoes seguintes: o guard-rail reprovava por ACIDENTE, com uma
  // mensagem que nao explicava nada. Prova que morde tem que morder no lugar
  // certo, senao ela so faz barulho.
  var regCorpo = document.querySelector('#lista .mol-regras-corpo');
  ok('e vem FECHADO DE VERDADE (display computado, nao a propriedade open)',
     !!reg && reg.open === false && !!regCorpo &&
     getComputedStyle(regCorpo).display === 'none',
     reg ? 'open=' + reg.open + ' corpo=' +
       (regCorpo ? getComputedStyle(regCorpo).display : 'sem corpo') : 'sem bloco');
  ok('as regras vem DEPOIS da cobranca, nunca antes',
     !!reg && !!res && (res.compareDocumentPosition(reg) & 4) === 4);
  // A ressalva nao pode viver so no comentario do codigo: tela que omite
  // recorte mente, e esta e a unica frase que impede o bloco de parecer aferido.
  var regNota = document.querySelector('#lista .mol-regras-nota');
  ok('a tela DECLARA que nao confere nenhuma delas',
     !!regNota && /não confere/.test(regNota.textContent),
     regNota ? regNota.textContent.slice(0, 60) : 'sem nota');
  ok('e a ressalva tambem nasce escondida, junto com o resto da gaveta',
     !!regNota && getComputedStyle(regNota).display === 'none',
     regNota ? getComputedStyle(regNota).display : 'sem nota');

  reg.open = true;
  await espera(60);
  ok('abrindo, os 5 blocos aparecem E SAO VISIVEIS', molSel('.mol-reg').length === 5 &&
     getComputedStyle(regCorpo).display === 'grid',
     'n=' + molSel('.mol-reg').length + ' display=' + getComputedStyle(regCorpo).display);
  ok('a rotina de stories mostra os 7 slots com janela e funcao',
     molSel('.mol-slot').length === 7 &&
     /07h-08h/.test(molSel('.mol-slot')[0].textContent) &&
     /bom dia/.test(molSel('.mol-slot')[0].textContent),
     'n=' + molSel('.mol-slot').length);
  ok('o slot com oferta permitida diz em qual dia',
     molSel('.mol-slot-obs').length === 1 &&
     /quinta/.test(molSel('.mol-slot-obs')[0].textContent),
     'n=' + molSel('.mol-slot-obs').length);
  // sabado_slot5 e CODIGO. Ele vira frase legivel, e nada aparece cru aqui.
  ok('a caixinha traduz o codigo do slot em frase',
     /sáb, slot 5/.test(reg.textContent) && /qui, slots 2 a 5/.test(reg.textContent) &&
     molSel('.mol-reg-cru').length === 0,
     'crus=' + molSel('.mol-reg-cru').length);
  ok('as 8 proibicoes aparecem, e sem underline de codigo',
     molSel('.mol-proib li').length === 8 &&
     reg.textContent.indexOf('preco_em_feed') === -1 &&
     /preco em feed/.test(reg.textContent),
     'n=' + molSel('.mol-proib li').length);
  // A assercao que segura o significado: proibicao NAO e violacao.
  ok('e elas NAO usam cor de urgencia (regra nao e acusacao)',
     getComputedStyle(molSel('.mol-proib li')[0]).color !== 'rgb(188, 71, 21)',
     getComputedStyle(molSel('.mol-proib li')[0]).color);
  ok('o teto carrega a ressalva colada, nao solta no rodape',
     molSel('.mol-reg-nota').length === 1 &&
     /código de humor/.test(molSel('.mol-reg-nota')[0].textContent),
     molSel('.mol-reg-nota').length ? molSel('.mol-reg-nota')[0].textContent.slice(0, 50) : 'sem ressalva');
  ok('a garantia do seminovo aparece com o prazo',
     /seminovo/.test(reg.textContent) && /3 meses/.test(reg.textContent));

  // Codigo de slot que a leitura nao entende aparece CRU e marcado, nunca some.
  window.__MOLDE = _molde(0);
  window.__MOLDE.regras.caixinha.abre = 'lua_cheia_slot_zero';
  await reabrirConteudo();
  document.querySelector('#lista .mol-regras').open = true;
  await espera(60);
  ok('codigo de slot desconhecido aparece CRU e marcado, nao vira vazio',
     molSel('.mol-reg-cru').length === 1 &&
     /lua_cheia_slot_zero/.test(molSel('.mol-reg-cru')[0].textContent),
     'n=' + molSel('.mol-reg-cru').length);

  // Chave nova vinda do Notion nao pode sumir por eu nao conhecer o nome dela.
  window.__MOLDE = _molde(0);
  window.__MOLDE.regras.garantia.airpods = '6 meses';
  await reabrirConteudo();
  document.querySelector('#lista .mol-regras').open = true;
  await espera(60);
  ok('chave nova do Notion aparece sozinha, sem eu mapear nome por nome',
     /airpods/.test(document.querySelector('#lista .mol-regras').textContent) &&
     /6 meses/.test(document.querySelector('#lista .mol-regras').textContent));

  window.__MOLDE = JSON.parse(JSON.stringify(MOLDE_V3));
  await reabrirConteudo();

  // ---- ATMOSFERA da aba Conteudo (13/08/2026) ------------------------------
  // Por que estas existem: prova_atmosfera.py le o TEXTO do app.css e prova os
  // numeros de contraste. Ela nao prova que a regra CASA com o elemento. Foi
  // exatamente esse buraco que deixou 16 regras da Fila penduradas num seletor
  // morto entre 06 e 08/08, com a suite verde. Aqui a cor e a COMPUTADA, no
  // Chrome, lida do DOM renderizado (#lista).
  //
  // A gramatica e a mesma ja provada no Hoje (linha 480) e na Fila (514): chao
  // tingido, cartao branco que flutua. Ate 13/08 a aba Conteudo fazia o
  // CONTRARIO do molde na mesma tela (coluna branca, cartao tingido).
  var AZUL = 'rgb(0, 37, 204)';       // --accent  #0025cc
  var CHAO = 'rgb(246, 247, 250)';    // --surface #F6F7FA
  var BRANCO = 'rgb(255, 255, 255)';  // --panel   #FFFFFF
  var SOMBRA = 'rgba(15, 21, 35, 0.06)';

  var molSec = document.querySelector('#lista .mol');
  ok('a bandeja do molde esta tingida (o cartao do dia flutua)',
     getComputedStyle(molSec).backgroundColor === CHAO,
     getComputedStyle(molSec).backgroundColor);
  // Dia normal: nem hoje (que e ESTADO, e leva tint) nem folga (que perde a
  // sombra de proposito). Sem os :not, a assercao mediria outra coisa.
  var diaN = document.querySelector('#lista .mol-dia:not(.hoje):not(.folga)');
  ok('o cartao do dia e BRANCO', !!diaN && getComputedStyle(diaN).backgroundColor === BRANCO,
     diaN ? getComputedStyle(diaN).backgroundColor : 'sem dia normal');
  ok('e tem sombra (cartao x bandeja mede 1.07: a cor sozinha nao separa)',
     !!diaN && getComputedStyle(diaN).boxShadow.indexOf(SOMBRA) >= 0,
     diaN ? getComputedStyle(diaN).boxShadow : 'sem dia normal');
  // Folga le como pausa: fica no chao, sem flutuar. Peca de verdade flutua.
  var diaF = document.querySelector('#lista .mol-dia.folga');
  ok('folga NAO tem sombra (peca de verdade flutua, folga fica no chao)',
     !!diaF && getComputedStyle(diaF).boxShadow.indexOf(SOMBRA) < 0,
     diaF ? getComputedStyle(diaF).boxShadow : 'sem folga');

  // ---- o azul e ROTULO DE GRUPO, e so isso (pedido do dono, 13/08/2026) ----
  // O papel esta nomeado na regra 11.1 da validar.py. Aqui se prova o alcance:
  // o azul nomeia o CONJUNTO e nunca pinta o DADO. Se ele vazar para .mol-peca
  // ou para o cartao, o --frio (peca vencida) passa a disputar canal com a
  // identidade da marca, que e o defeito que a regra existe para barrar.
  var rotD = document.querySelector('#lista .mol-dia-rot');
  ok('o dia da semana e azul', !!rotD && getComputedStyle(rotD).color === AZUL,
     rotD ? getComputedStyle(rotD).color : 'sem rotulo de dia');
  var peca = document.querySelector('#lista .mol-peca');
  ok('e o azul NAO vazou para a peca do dia (rotulo nomeia, nao pinta o dado)',
     !!peca && getComputedStyle(peca).color !== AZUL,
     peca ? getComputedStyle(peca).color : 'sem peca');

  var col0 = document.querySelector('#lista .cont-col');
  ok('a coluna do kanban tambem e bandeja (uma gramatica so na aba)',
     getComputedStyle(col0).backgroundColor === CHAO,
     getComputedStyle(col0).backgroundColor);
  var rotC = document.querySelector('#lista .cont-col-rot');
  ok('o cabecalho da coluna e azul', !!rotC && getComputedStyle(rotC).color === AZUL,
     rotC ? getComputedStyle(rotC).color : 'sem rotulo de coluna');

  // O cartao branco do kanban NAO e estetica: medido em 13/08, com ele em
  // --surface a barra de nivel dava 2.83 (quente), 2.85 (morno) e 2.85 (frio)
  // contra o proprio cartao, as TRES abaixo do alvo de 3:1. Elas foram
  // calibradas contra BRANCO em 16/07 (3.03/3.06/3.05) e o chao tingido comia a
  // margem. Por isso as duas assercoes abaixo andam juntas: o cartao branco E a
  // barra que ele carrega. Numeros em prova_atmosfera.py.
  // O :not(.nivel-vencido) nao e conveniencia para a assercao passar: peca
  // vencida tem tint de --quente-bg desde antes (app.css:1277), e ela e o
  // SINAL, nao o cartao normal. Sem o :not, esta assercao mediria o chao
  // errado e falaria de outra coisa. O tint do vencido ganha assercao propria
  // logo abaixo, para os dois nao se confundirem.
  var card0 = document.querySelector('#lista .cont-card:not(.nivel-vencido)');
  ok('o cartao do kanban e BRANCO (a barra de nivel foi calibrada contra branco)',
     !!card0 && getComputedStyle(card0).backgroundColor === BRANCO,
     card0 ? getComputedStyle(card0).backgroundColor : 'sem cartao');
  var cardV = document.querySelector('#lista .cont-card.nivel-vencido');
  ok('e a peca VENCIDA continua tingida (sinal, nao cartao normal)',
     !!cardV && getComputedStyle(cardV).backgroundColor === 'rgb(253, 240, 233)',
     cardV ? getComputedStyle(cardV).backgroundColor : 'sem peca vencida');
  // A barra do cartao do kanban diz o TIPO, nunca a urgencia (app.css:1269).
  // Dois canais, duas perguntas, no mesmo espirito dos invariantes 2 e 3: a
  // urgencia vive na data (.cont-data-chip). Esta assercao existe porque a
  // regra do tipo sobrescreve as seis regras de nivel escritas ANTES dela
  // (app.css:1152-1156); sem prova, uma reordenacao devolveria a urgencia para
  // a barra em silencio e os dois canais voltariam a disputar o mesmo pixel.
  var TP = ['rgb(46, 125, 91)', 'rgb(47, 125, 168)', 'rgb(91, 75, 168)', 'rgb(168, 73, 126)'];
  var NIVEL = ['rgb(242, 107, 49)', 'rgb(196, 136, 8)', 'rgb(131, 149, 175)'];
  var barra = card0 ? getComputedStyle(card0, '::before').backgroundColor : '';
  ok('e a barra dele diz o TIPO, nao a urgencia (urgencia mora na data)',
     TP.indexOf(barra) >= 0 && NIVEL.indexOf(barra) < 0, barra || 'sem cartao');

  // ---- A prova central: cache vazio nao pode virar grade -------------------
  window.__MOLDE = { ok: true, tem_molde: false, semana_ini: '2026-08-10',
                     semana_fim: '2026-08-16', msg: 'Nunca consegui ler o molde do Notion.' };
  await reabrirConteudo();
  ok('SEM CACHE o app nao desenha grade nenhuma',
     document.querySelectorAll('#lista .mol-grade').length === 0 &&
     document.querySelectorAll('#lista .mol-dia').length === 0,
     'grades=' + document.querySelectorAll('#lista .mol-grade').length +
     ' dias=' + document.querySelectorAll('#lista .mol-dia').length);
  ok('SEM CACHE a tela DIZ que nao sabe',
     telaTxt().indexOf('Nunca consegui ler o molde do Notion') >= 0);
  ok('SEM CACHE nenhum nome de peca vazou para a tela',
     telaTxt().indexOf('reel topo') === -1 && telaTxt().indexOf('carrossel') === -1,
     'reel topo=' + (telaTxt().indexOf('reel topo') >= 0) +
     ' carrossel=' + (telaTxt().indexOf('carrossel') >= 0));
  ok('SEM CACHE nao ha bloco de regras (nem consulta o app inventa)',
     document.querySelectorAll('#lista .mol-regras').length === 0);
  ok('SEM CACHE o kanban continua vivo (molde nao derruba a aba)',
     document.querySelectorAll('#lista .cont-col').length === 4,
     'n=' + document.querySelectorAll('#lista .cont-col').length);

  // ---- Stale: a grade FICA, e a idade vai declarada junto ------------------
  window.__MOLDE = JSON.parse(JSON.stringify(MOLDE_V3));
  window.__MOLDE.idade_horas = 96; window.__MOLDE.stale = true;
  await reabrirConteudo();
  ok('STALE mantem a grade na tela (sumir seria pior que declarar)',
     molDias().length === 7, 'n=' + molDias().length);
  ok('STALE mostra o aviso com a IDADE medida',
     document.querySelectorAll('#lista .mol-aviso.stale').length === 1 &&
     /4 dias/.test(document.querySelector('#lista .mol-aviso.stale').textContent),
     document.querySelector('#lista .mol-aviso.stale')
       ? document.querySelector('#lista .mol-aviso.stale').textContent.slice(0, 80) : 'sem aviso');
  ok('STALE marca o cabecalho tambem',
     document.querySelector('#lista .mol-lido').className.indexOf('alerta') >= 0,
     document.querySelector('#lista .mol-lido').className);

  // ---- Tipo desconhecido: aparece CRU e marcado, nunca some ---------------
  window.__MOLDE = JSON.parse(JSON.stringify(MOLDE_V3));
  window.__MOLDE.dias[0].feed_previsto = 'carrossel_duplo';
  window.__MOLDE.avisos = ['Tipo de peca nao reconhecido no molde: carrossel_duplo.'];
  await reabrirConteudo();
  ok('tipo desconhecido aparece CRU na tela, nao vira vazio',
     molPecas()[0] === 'carrossel_duplo', molPecas()[0]);
  ok('tipo desconhecido vem MARCADO',
     document.querySelectorAll('#lista .mol-peca.desconhecida').length === 1,
     'n=' + document.querySelectorAll('#lista .mol-peca.desconhecida').length);
  ok('o aviso do servidor chega na tela',
     telaTxt().indexOf('carrossel_duplo') >= 0 &&
     document.querySelectorAll('#lista .mol-aviso').length >= 1);
  ok('o dia desconhecido NAO some da grade', molDias().length === 7, 'n=' + molDias().length);

  // ---- Fatia 2, cena PASSADO: a semana inteira ja aconteceu ---------------
  // Quatro semanas atras, entao nenhum dia depende de qual dia da semana o
  // teste roda. Aqui a cobranca tem que morder: terca sem carrossel e FALTA,
  // segunda e quarta existem e nao foram ao ar, sexta foi.
  window.__MOLDE = _molde(-4);
  await reabrirConteudo();
  ok('PASSADO: o dia sem a peca do molde marca FALTA',
     molSel('.mol-plan.n-quente').length === 1 &&
     /FALTA/.test(document.querySelector('#lista .mol-plan.n-quente').textContent),
     'n=' + molSel('.mol-plan.n-quente').length);
  ok('PASSADO: peca criada que nao foi ao ar marca ATRASADO',
     molSel('.mol-exec.n-quente').length === 2, 'n=' + molSel('.mol-exec.n-quente').length);
  ok('PASSADO: a peca publicada marca NO AR, e nao atrasado',
     molSel('.mol-exec.n-ok').length === 1 &&
     /no ar/.test(document.querySelector('#lista .mol-exec.n-ok').textContent),
     'n=' + molSel('.mol-exec.n-ok').length);
  // FALTA e atraso sao coisas diferentes: quem nao existe nao pode estar
  // atrasado, senao a mesma ausencia seria cobrada duas vezes.
  ok('PASSADO: o dia que marca FALTA nao marca atrasado tambem',
     molSel('.mol-dia').filter(function (d) {
       return d.querySelector('.mol-plan.n-quente') && d.querySelector('.mol-exec');
     }).length === 0);
  var cob = document.querySelector('#lista .mol-cobranca');
  ok('PASSADO: o rodape NOMEIA o que falta e o que atrasou',
     !!cob && /falta: carrossel de ter/.test(cob.textContent) &&
     /atrasado: reel topo seg, reel qua/.test(cob.textContent),
     cob ? cob.textContent.trim() : 'sem cobranca');

  // ---- Fatia 2, cena FUTURO: a semana ainda nao aconteceu -----------------
  // A regra que impede a tela de mentir: sexta que ainda nao chegou nao esta
  // em falta nem atrasada. Sem esta cena, tirar a comparacao com hoje passaria
  // batido e o app cobraria o dono por dias que nem existiram.
  window.__MOLDE = _molde(4);
  await reabrirConteudo();
  ok('FUTURO: dia que ainda nao chegou NAO marca FALTA nem atrasado',
     molSel('.mol-plan.n-quente').length === 0 &&
     molSel('.mol-exec.n-quente').length === 0,
     'plan=' + molSel('.mol-plan.n-quente').length +
     ' exec=' + molSel('.mol-exec.n-quente').length);
  ok('FUTURO: a palavra FALTA nao aparece em lugar nenhum da grade',
     document.querySelector('#lista .mol-grade').textContent.indexOf('FALTA') === -1);
  ok('FUTURO: o rodape nao cobra falta nem atraso',
     !document.querySelector('#lista .mol-cobranca') ||
     (document.querySelector('#lista .mol-cobranca').textContent.indexOf('falta:') === -1 &&
      document.querySelector('#lista .mol-cobranca').textContent.indexOf('atrasado:') === -1),
     document.querySelector('#lista .mol-cobranca')
       ? document.querySelector('#lista .mol-cobranca').textContent.trim() : '(sem cobranca)');
  // Fora do molde nao e urgencia: ele independe de o dia ter passado.
  ok('FUTURO: fora do molde continua nomeado (divergencia nao e urgencia)',
     molSel('.mol-fora').length === 1);

  window.__MOLDE = JSON.parse(JSON.stringify(MOLDE_V3));
  await reabrirConteudo();

  // ---- RPC que falha nao pode derrubar a aba ------------------------------
  window.__MOLDE = { ok: false, msg: 'Sem tenant no contexto.' };
  await reabrirConteudo();
  ok('molde com ok:false mostra o erro, e o kanban sobrevive',
     telaTxt().indexOf('Falha ao ler o molde') >= 0 &&
     document.querySelectorAll('#lista .cont-col').length === 4,
     'colunas=' + document.querySelectorAll('#lista .cont-col').length);

  window.__MOLDE = JSON.parse(JSON.stringify(MOLDE_V3));
  await reabrirConteudo();
  ok('nenhum TypeError em nenhuma das cenas do molde',
     window.__erroMolde.length === 0, window.__erroMolde.join(' | '));

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
  // 6 -> 8 em 05/08/2026: Notas fiscais (v40+) e Escopo (Fatia 1) entraram e
  // ninguem atualizou o numero. As duas maquinas corrigiram esta linha ao mesmo
  // tempo, uma para 7 (antes de o Escopo existir) e outra para 8. Fica o 8, que
  // e o estado real, e o valor medido vai junto na mensagem: assercao que so diz
  // "falhou" obriga a rodar de novo para saber quanto deu.
  ok('8 abas raras', document.querySelectorAll('.aba-rara').length === 8,
     String(document.querySelectorAll('.aba-rara').length));
  ok('rara começa escondida no mobile', getComputedStyle(document.getElementById('abaDash')).display === 'none');
  document.getElementById('abaMais').click();
  await espera(80);
  ok('Mais abre as raras', getComputedStyle(document.getElementById('abaDash')).display === 'flex');
  ok('aria-expanded acompanha', document.getElementById('abaMais').getAttribute('aria-expanded') === 'true');
  document.getElementById('abaMais').click();
  await espera(80);
  ok('Mais fecha de novo', getComputedStyle(document.getElementById('abaDash')).display === 'none');

  // ================= Task 5c: aba Escopo (a aba nao abria no clique) =================
  // Das 12 abas do app, 11 tinham Y("abaX","click",...) no init(). abaEscopo
  // nao tinha: clicar nao fazia nada, sem erro, sem toast, sem tela. Esta e a
  // assercao 1, a UNICA que teria pego o defeito de verdade (navegacao real).
  var abaEsc = document.getElementById('abaEscopo');
  abaEsc.click();
  await espera(260);
  ok('aba Escopo fica selecionada ao clicar (era o defeito: a aba nao abria)',
     abaEsc.getAttribute('aria-selected') === 'true', 'aria-selected=' + abaEsc.getAttribute('aria-selected'));
  ok('título virou Escopo', document.getElementById('topoTit').textContent === 'Escopo',
     document.getElementById('topoTit').textContent);
  // Ate a Fatia B esta assercao exigia .esc-placar no topo. O placar de texto
  // SAIU por decisao do dono (12/08/2026) e o grafico ocupou o lugar: a
  // assercao foi reescrita para o desenho novo, nao silenciada.
  ok('o escopo renderizou o gráfico e ao menos uma ação',
     !!document.querySelector('#lista .esc-graf') && document.querySelectorAll('#lista .esc-acao').length > 0,
     document.querySelectorAll('#lista .esc-acao').length + ' ações');
  ok('o placar de texto do topo nao existe mais (virou o gráfico)',
     !document.querySelector('#lista .esc-placar') && !document.querySelector('#lista .esc-linha'));
  ok('a nota 65 aparece e a frente sem_dado mostra "nenhuma ação registrada"',
     telaTxt().indexOf('65') >= 0 && telaTxt().indexOf('nenhuma ação registrada') >= 0, telaTxt().slice(0, 200));
  ok('o motivo da trava aparece na tela', telaTxt().indexOf('capability Update content') >= 0, telaTxt().slice(0, 200));
  ok('existe o controle de travar/destravar no DOM renderizado', !!document.querySelector('#lista [data-acao="esc-travar"]'));

  // ---- o placar de LEAD nao pode aparecer em cima do placar de FRENTES
  ok('o pitboard de lead fica escondido na aba Escopo',
     document.getElementById('pitboard').className.indexOf('oculto') >= 0,
     document.getElementById('pitboard').className);

  // ---- CLICAR, nao so existir. Este bloco nasce porque a Fatia 1 subiu com
  // TODO o caminho de escrita morto (a.getAttribute num Event) e as tres
  // revisoes passaram, porque toda prova de escrita era string-matching sobre
  // a fonte, que casa igual com o codigo quebrado.
  window.__erros = [];
  window.addEventListener('error', function (ev) { window.__erros.push(String(ev.message)); });

  function rpcs(nome){ return window.__rpcChamadas.filter(function(r){ return r.nome === nome; }); }

  var nMudar = rpcs('mudar_status_acao_escopo').length;
  document.querySelector('#lista [data-acao="esc-status"]').click();
  await espera(160);
  ok('tocar no chip CHAMA mudar_status_acao_escopo (era TypeError silencioso)',
     rpcs('mudar_status_acao_escopo').length === nMudar + 1,
     'chamadas: ' + (rpcs('mudar_status_acao_escopo').length - nMudar));

  var travarBtn = document.querySelector('#lista [data-acao="esc-travar"]');
  var stAlvo = travarBtn.getAttribute('data-st');
  window.prompt = function () { return 'motivo de teste'; };
  var nT = rpcs('mudar_status_acao_escopo').length;
  travarBtn.click();
  await espera(160);
  var ult = rpcs('mudar_status_acao_escopo').pop();
  ok('tocar em travar/destravar CHAMA a RPC com o status certo',
     rpcs('mudar_status_acao_escopo').length === nT + 1 &&
     ult.args.p_status === ('travado' === stAlvo ? 'fazendo' : 'travado'),
     'p_status=' + (ult && ult.args && ult.args.p_status));

  // prompt cancelado nao pode escrever nada
  window.prompt = function () { return null; };
  var nCancel = rpcs('mudar_status_acao_escopo').length;
  var travar2 = document.querySelector('#lista [data-acao="esc-travar"]');
  if (travar2 && travar2.getAttribute('data-st') !== 'travado') {
    travar2.click();
    await espera(140);
    ok('prompt cancelado NAO chama a RPC',
       rpcs('mudar_status_acao_escopo').length === nCancel);
  } else {
    ok('prompt cancelado NAO chama a RPC', true, 'alvo ja travado, caminho coberto acima');
  }
  window.prompt = function () { return 'motivo de teste'; };

  var nCriar = rpcs('criar_acao_escopo').length;
  var campo = document.querySelector('#lista .esc-form input');
  campo.value = 'acao criada pelo harness';
  document.querySelector('#lista [data-acao="esc-criar"]').click();
  await espera(160);
  var uc = rpcs('criar_acao_escopo').pop();
  ok('tocar em Adicionar CHAMA criar_acao_escopo com o titulo digitado',
     rpcs('criar_acao_escopo').length === nCriar + 1 && uc.args.p_titulo === 'acao criada pelo harness',
     'p_titulo=' + (uc && uc.args && uc.args.p_titulo));

  var nDesc = rpcs('descartar_acao_escopo').length;
  document.querySelector('#lista [data-acao="esc-desc"]').click();
  await espera(160);
  ok('tocar em descartar CHAMA descartar_acao_escopo com o id da acao',
     rpcs('descartar_acao_escopo').length === nDesc + 1 &&
     !!(rpcs('descartar_acao_escopo').pop().args || {}).p_id);

  ok('nenhum TypeError foi lancado ao tocar nos controles do Escopo',
     window.__erros.length === 0, window.__erros.join(' | '));

  // ============ Fatia B: o grafico de abandono e a urgencia ============
  // Assercoes 1 a 11 da secao 7 da spec de 12/08/2026. Regra dura herdada do
  // v46: nenhuma prova de caminho de escrita por SRC.indexOf. Todo caminho de
  // escrita daqui CLICA (ou dispara change) no controle de verdade.
  document.getElementById('abaRotina').click();
  await espera(140);
  document.getElementById('abaEscopo').click();
  await espera(240);

  function colDe(cod){ return document.querySelector('#lista .esc-col[data-frente="' + cod + '"]'); }

  var colunas = document.querySelectorAll('#lista .esc-col');
  // 1. coluna e das frentes COM acao. assistencia (sem acao) e pendencias
  //    (outro grupo) ficam de fora; a primeira aparece nomeada no rodape.
  ok('1. o gráfico desenha uma coluna por frente COM ação (3 de 5 do fixture)',
     colunas.length === 3, colunas.length + ' colunas');
  ok('1b. frente sem ação nenhuma não vira coluna, e sai nomeada no rodapé',
     !colDe('assistencia') && !colDe('pendencias') &&
     telaTxt().indexOf('sem ação nenhuma: Assistência técnica') >= 0);
  // ordem: do mais parado para o menos. O crime fica no canto que se le primeiro.
  ok('1c. as colunas vêm ordenadas do mais parado para o menos',
     [].map.call(colunas, function (b) { return b.getAttribute('data-dias'); }).join(',') === '35,9,3',
     [].map.call(colunas, function (b) { return b.getAttribute('data-dias'); }).join(','));

  // 2. altura = dias_parada na escala fixa 0-30, medida no PIXEL renderizado,
  //    nao na string do style: propriedade computada ja mentiu antes (v52).
  function alturaRel(cod){
    var b = colDe(cod).querySelector('.esc-barra'), t = colDe(cod).querySelector('.esc-tubo');
    var hb = b.getBoundingClientRect().height, ht = t.getBoundingClientRect().height - 2; // 2 = as duas bordas
    return hb / ht;
  }
  ok('2. a coluna de 9 dias ocupa 9/30 da altura útil',
     Math.abs(alturaRel('calculadoras') - 9 / 30) < 0.02, alturaRel('calculadoras').toFixed(3));
  ok('2b. a coluna de 3 dias ocupa 3/30',
     Math.abs(alturaRel('pitscare') - 3 / 30) < 0.02, alturaRel('pitscare').toFixed(3));

  // 3. acima de 30 satura E DIZ que saturou. Saturar calado e mentir por omissao.
  ok('3. a frente de 35 dias satura em 100% da altura',
     Math.abs(alturaRel('colaboradores') - 1) < 0.02, alturaRel('colaboradores').toFixed(3));
  ok('3b. a coluna saturada leva a marca 30+',
     colDe('colaboradores').querySelector('.esc-col-sat').textContent.trim() === '30+' &&
     colDe('calculadoras').querySelector('.esc-col-sat').textContent.trim() === '');

  // 4. em andamento e o SEGUNDO CANAL, nunca a cor.
  var barFaz = colDe('colaboradores').querySelector('.esc-barra');
  var barPar = colDe('calculadoras').querySelector('.esc-barra');
  ok('4. frente com ação em andamento desenha a coluna SÓLIDA',
     barFaz.className.indexOf('fazendo') >= 0 &&
     getComputedStyle(barFaz).backgroundImage === 'none', getComputedStyle(barFaz).backgroundImage);
  ok('4b. frente sem ação em andamento vem HACHURADA (segundo canal, não enfeite)',
     getComputedStyle(barPar).backgroundImage.indexOf('repeating-linear-gradient') >= 0,
     getComputedStyle(barPar).backgroundImage.slice(0, 60));
  ok('4c. só a frente em andamento ganha o ponto',
     !!colDe('colaboradores').querySelector('.esc-ponto') &&
     !colDe('calculadoras').querySelector('.esc-ponto'));
  // a cor carrega SO abandono: os tres degraus, tres cores distintas
  var cores = ['colaboradores', 'calculadoras', 'pitscare'].map(function (k) {
    return getComputedStyle(colDe(k).querySelector('.esc-barra')).backgroundColor; });
  ok('4d. os três degraus de abandono pintam com três cores distintas',
     cores[0] !== cores[1] && cores[1] !== cores[2] && cores[0] !== cores[2], cores.join(' | '));

  // a linha de corte de 7d tem que cair no ponto GEOMETRICO de 23/30 do tubo.
  // Numero solto no CSS ja desalinhou grafico neste projeto; aqui se mede.
  var pistaTubo = colDe('colaboradores').querySelector('.esc-tubo').getBoundingClientRect();
  var corte = document.querySelector('#lista .esc-corte.c-ok').getBoundingClientRect();
  var esperado = pistaTubo.top + 1 + (pistaTubo.height - 2) * (1 - 7 / 30);
  ok('4e. a linha de corte de 7d cai no ponto geométrico da escala',
     Math.abs(corte.top - esperado) < 1.5, 'corte=' + corte.top.toFixed(1) + ' esperado=' + esperado.toFixed(1));

  // 11. urgencia: !! para alta, nada para baixa. Marca em tudo e marca em nada.
  ok('11. urgência alta mostra a marca !!',
     !!colDe('colaboradores').querySelector('.esc-urg.u-alta') &&
     colDe('colaboradores').querySelector('.esc-urg').textContent === '!!');
  ok('11b. urgência baixa NÃO mostra marca nenhuma',
     !colDe('calculadoras').querySelector('.esc-urg'));
  ok('11c. o rodapé cobra as frentes sem urgência declarada',
     telaTxt().indexOf('sem urgência declarada: 2 de 4 frentes') >= 0);
  ok('o cabeçalho declara o recorte (frentes, ações vivas e a data)',
     /5 ações vivas/.test(telaTxt()) && /4 frentes ·/.test(telaTxt()));

  // 10. a nota nao sumiu com o placar: migrou para o cabecalho da frente.
  var cabCol = document.querySelector('#lista #escFrente_colaboradores .esc-frente-cab');
  ok('10. nota, faixa e as três parcelas continuam legíveis no cabeçalho da frente',
     cabCol.querySelector('.esc-nota').textContent === '40' &&
     cabCol.querySelector('.esc-faixa').textContent === 'em baixa' &&
     cabCol.querySelector('.esc-parcelas').textContent === '0/2 feitas · 0 travadas · 35d',
     cabCol.textContent);
  ok('10b. a frente sem dado mostra "--" e a faixa sem dado, sem inventar nota',
     document.querySelector('#lista #escFrente_assistencia .esc-nota').textContent === '--' &&
     document.querySelector('#lista #escFrente_assistencia .esc-parcelas').textContent === 'nenhuma ação registrada');

  // tocar a coluna leva ao bloco da frente: grafico que nao leva a lugar nenhum
  // e so desenho.
  var alvoRolagem = null;
  document.getElementById('escFrente_calculadoras').scrollIntoView = function () { alvoRolagem = 'calculadoras'; };
  colDe('calculadoras').click();
  await espera(120);
  ok('tocar na coluna rola até o bloco daquela frente', alvoRolagem === 'calculadoras', String(alvoRolagem));

  // ---- 5 a 8: o caminho de ESCRITA da urgencia, sempre pelo controle real
  function prioDe(id){ return document.querySelector('#lista .esc-prio[data-id="' + id + '"]'); }
  var nPrio = rpcs('definir_prioridade_acao').length;
  var selPrio = prioDe('ea4');
  selPrio.value = 'media';
  selPrio.dispatchEvent(new Event('change', { bubbles: true }));
  await espera(200);
  var ultP = rpcs('definir_prioridade_acao').pop();
  ok('5. escolher a urgência CHAMA definir_prioridade_acao com id e valor',
     rpcs('definir_prioridade_acao').length === nPrio + 1 &&
     ultP.args.p_id === 'ea4' && ultP.args.p_prioridade === 'media',
     JSON.stringify(ultP && ultP.args));

  // 6. "cancelar": escolher o valor que ja estava (e o que o seletor nativo do
  //    celular entrega ao cancelar) nao pode escrever nada.
  var nCanc = rpcs('definir_prioridade_acao').length;
  var selJa = prioDe('ea3');
  selJa.value = 'alta';
  selJa.dispatchEvent(new Event('change', { bubbles: true }));
  await espera(160);
  ok('6. escolher o mesmo valor (cancelar) NÃO chama a RPC',
     rpcs('definir_prioridade_acao').length === nCanc, 'atual=' + selJa.getAttribute('data-atual'));

  // 17 (do lado do banco, espelhado aqui): limpar manda "" e vira null na RPC
  var nLimpa = rpcs('definir_prioridade_acao').length;
  selJa.value = '';
  selJa.dispatchEvent(new Event('change', { bubbles: true }));
  await espera(200);
  var ultL = rpcs('definir_prioridade_acao').pop();
  ok('limpar a urgência manda p_prioridade null (o vazio LIMPA, não vira texto)',
     rpcs('definir_prioridade_acao').length === nLimpa + 1 && ultL.args.p_prioridade === null,
     JSON.stringify(ultL && ultL.args));

  // 7. erro de transporte tem que APARECER. Falha calada foi o defeito da v46.
  window.__PRIO_ERRO = true;
  var selErro = prioDe('ea5');
  selErro.value = 'alta';
  selErro.dispatchEvent(new Event('change', { bubbles: true }));
  await espera(240);
  var toast = document.getElementById('toast');
  ok('7. erro da RPC de urgência aparece na tela, não em silêncio',
     toast.className.indexOf('visivel') >= 0 && toast.className.indexOf('erro') >= 0 &&
     toast.textContent.indexOf('permissao negada (prova)') >= 0,
     toast.className + ' | ' + toast.textContent);
  window.__PRIO_ERRO = false;

  // 8. quem nao pode editar nao recebe controle nenhum: controle que existe e
  //    nao escreve e pior que controle ausente.
  window.__ESC_LEITURA = true;
  document.getElementById('abaRotina').click();
  await espera(140);
  document.getElementById('abaEscopo').click();
  await espera(240);
  ok('8. com pode_editar=false o seletor de urgência não existe no DOM',
     document.querySelectorAll('#lista .esc-prio').length === 0 &&
     document.querySelectorAll('#lista .esc-acao').length > 0,
     document.querySelectorAll('#lista .esc-prio').length + ' seletores');
  ok('8b. em leitura a urgência declarada continua visível como texto',
     !!document.querySelector('#lista .esc-prio-txt.u-alta'));
  ok('8c. em leitura o gráfico continua desenhado (ele é leitura, não escrita)',
     document.querySelectorAll('#lista .esc-col').length === 3);
  window.__ESC_LEITURA = false;
  document.getElementById('abaRotina').click();
  await espera(140);
  document.getElementById('abaEscopo').click();
  await espera(240);

  // 9. nenhum TypeError em nenhum dos caminhos acima.
  ok('9. nenhum TypeError foi lançado nos caminhos da Fatia B',
     window.__erros.length === 0, window.__erros.join(' | '));

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
  document.getElementById('fvModelo').value = 'iPhone 13 Pro';
  // Cliente obrigatorio desde a v42: sem dono, a venda nao vira NF nem recompra.
  // Este teste foi escrito antes da regra e salvava sem comprador, entao
  // salvarVenda() saia no guard e a RPC nunca era chamada. A assercao acusava
  // "salvar nao chamou registrar_venda" quando o certo era exatamente esse.
  // Antes de preencher, prova o guard: e a regra de produto, nao detalhe do form.
  document.getElementById('btnSalvarVenda').click();
  await espera(120);
  ok('venda sem cliente e recusada antes da RPC',
     window.__rpcChamadas.filter(function (x) { return x.nome === 'registrar_venda'; }).length === 0 &&
     document.getElementById('fvErro').textContent.indexOf('cliente') >= 0,
     document.getElementById('fvErro').textContent);
  document.getElementById('fvNome').value = 'Diego Souza';
  document.getElementById('btnSalvarVenda').click();
  await espera(180);
  var chVenda = window.__rpcChamadas.filter(function (x) { return x.nome === 'registrar_venda'; })[0];
  ok('salvar chamou registrar_venda', !!chVenda);
  ok('o payload levou valor e modelo (texto livre)',
     !!(chVenda && chVenda.args && chVenda.args.payload && chVenda.args.payload.valor_venda && chVenda.args.payload.modelo_texto));
  ok('o painel fechou apos salvar', document.getElementById('painelVenda').className.indexOf('oculto') >= 0);

  // ============ relatorio de entrega + cadastro de motoboy (08/08/2026) ========
  // A licao mais cara da v46: prova de escrita por string-matching sobre a fonte
  // casa IGUAL com o codigo quebrado (69 assercoes verdes conviveram com quatro
  // botoes que so lancavam TypeError). Tudo daqui pra baixo CLICA no controle e
  // confere a chamada de RPC que saiu dele.
  window.__erroJs = [];
  window.addEventListener('error', function (ev) { window.__erroJs.push(String(ev.message || '')); });
  window.__aberturas = [];
  window.open = function (u) {
    var o = { location: { href: u }, fechada: false, close: function () { this.fechada = true; } };
    window.__aberturas.push(o); return o;
  };
  window.__copiado = null;
  var clipOk = false;
  try {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: function (txt) { window.__copiado = txt; return Promise.resolve(); } } });
    clipOk = !!(navigator.clipboard && navigator.clipboard.writeText);
  } catch (e) { clipOk = false; }
  window.confirm = function () { return true; };

  document.getElementById('abaVendas').click();
  await espera(220);
  ok('as cinco vendas do fixture renderizaram',
     document.querySelectorAll('#lista .card').length === 5,
     'n=' + document.querySelectorAll('#lista .card').length);
  // A cancelada CONTINUA na lista: ela sai do faturamento, nao da tela. Quem
  // some da lista e a arquivada, que e outra coisa.
  ok('a venda cancelada aparece na lista mesmo fora do faturamento',
     telaTxt().indexOf('VENDA-0003') >= 0, telaTxt().slice(0, 120));
  // a linha existe em TODO card: campo vazio que nao aparece esconde
  // exatamente a venda que precisa de acao
  ok('a linha de entrega existe em todo card',
     document.querySelectorAll('#lista .venda-ent').length === 5,
     'n=' + document.querySelectorAll('#lista .venda-ent').length);
  ok('a venda sem endereco declara a falta na linha',
     telaTxt().indexOf('sem endereço de entrega') >= 0, telaTxt().slice(0, 90));
  // ============ painel de vendas: o dinheiro somado no topo (v52) ============
  // A janela e fixada em "Tudo" antes dos numeros literais de proposito.
  // "Trimestre" e o padrao, mas depende da data em que a suite roda: assercao
  // com numero exato amarrada ao calendario comeca a reprovar sozinha em
  // janeiro, e guard-rail que reprova por conta propria e ruido, nao guarda.
  ok('o painel de vendas existe', !!document.querySelector('#lista .vg'));
  ok('o painel vem ANTES do primeiro card (dinheiro no topo, nao no rodape)',
     !!document.querySelector('#lista .vg') && !!document.querySelector('#lista .card') &&
     (document.querySelector('#lista .vg').compareDocumentPosition(document.querySelector('#lista .card'))
      & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
  ok('a janela padrao e Trimestre',
     !!document.querySelector('#lista [data-acao="vg-janela"][data-id="trimestre"][aria-pressed="true"]'));

  // ---- layout de tres colunas (3a passada) ----
  var vgGraf = document.querySelector('#lista .vg-graf.g-meses');
  var vgGrafV = document.querySelector('#lista .vg-graf.g-vaza');
  var vgVals = document.querySelector('#lista .vg-valores');
  ok('o painel tem os dois graficos separados e a coluna de valores',
     !!vgGraf && !!vgGrafV && !!vgVals);
  // O headless roda a 800px, que e ABAIXO do corte de 900: aqui o certo e a
  // coluna unica com os valores em cima. As duas colunas lado a lado sao
  // provadas em diag_mobile.py, que monta o app num iframe da largura pedida e
  // mede a geometria real. Assertar gridColumnStart aqui daria o valor do
  // layout empilhado e passaria pelo motivo errado.
  ok('a 800px o painel esta empilhado, e os VALORES ficam em cima',
     !!vgGraf && !!vgVals &&
     vgVals.getBoundingClientRect().top < vgGraf.getBoundingClientRect().top,
     'valores=' + (vgVals ? Math.round(vgVals.getBoundingClientRect().top) : '?') +
     ' graficos=' + (vgGraf ? Math.round(vgGraf.getBoundingClientRect().top) : '?'));
  // Esta e a que sustenta o celular SEM nenhuma regra de `order`: com os valores
  // primeiro no DOM, a coluna unica ja nasce na ordem certa. Se alguem inverter
  // o DOM e "consertar" com order, o pixel fica igual e a leitura quebra.
  ok('no DOM os VALORES vem antes dos graficos (e o que da a ordem do celular)',
     !!vgGraf && !!vgVals &&
     (vgVals.compareDocumentPosition(vgGraf) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
  ok('e ninguem usa `order` para posicionar as colunas',
     !!vgGraf && !!vgVals &&
     getComputedStyle(vgGraf).order === '0' && getComputedStyle(vgVals).order === '0',
     (vgGraf ? getComputedStyle(vgGraf).order : '?') + ' / ' + (vgVals ? getComputedStyle(vgVals).order : '?'));
  // A REGRA QUE O DONO REPROVOU. Barra de dado tem no maximo 24px e a sobra da
  // faixa e ar; antes a coluna era 1fr e com 2 meses cada barra ficava com
  // ~289px. Assertar so "existe coluna" nunca teria pego isso.
  var vgTubo1 = document.querySelector('#lista .vg-mes .vg-tubo');
  ok('a barra do grafico mede 24px, nao preenche o slot',
     !!vgTubo1 && Math.round(vgTubo1.getBoundingClientRect().width) === 24,
     vgTubo1 ? Math.round(vgTubo1.getBoundingClientRect().width) + 'px' : '(sem tubo)');
  // Leitor de estilo tolerante a ausencia. Sem ele, uma assercao nova estoura em
  // getComputedStyle(null) e leva junto o resto da rodada, que e o defeito que a
  // secao 6 do v51 ja tinha nomeado uma vez.
  var vgEstilo = function (sel, prop) {
    var el = document.querySelector(sel);
    return el ? getComputedStyle(el)[prop] : '(sem ' + sel + ')';
  };
  ok('e as colunas ficam ancoradas a esquerda, sem espalhar',
     vgEstilo('#lista .vg-meses', 'justifyContent') === 'start',
     vgEstilo('#lista .vg-meses', 'justifyContent'));

  // Leitores TOLERANTES a ausencia, e o clique tambem. Rodando contra um app.js
  // que ainda nao tem o painel, o bloco inteiro tem que REPROVAR 31 vezes; a
  // primeira versao destas assercoes estourava num null.click() e levava junto
  // 115 assercoes que nunca chegaram a ser avaliadas. Falha reprova, nao derruba
  // a rodada (mesma licao da secao 6 do v51).
  // O bloco de valor deixou de ser .pb-celula na 2a passada (o grid do pitboard
  // e repeat(4,1fr) e nao cabe na coluna estreita), mas a CHAVE continua sendo
  // data-cel, por codigo: e por isso que a troca de markup custou um seletor, e
  // nao a reescrita de toda assercao de numero.
  var vgCel = function (cod) {
    var el = document.querySelector('#lista .vg-valores [data-cel="' + cod + '"]');
    return el ? el.textContent : '(sem celula ' + cod + ')';
  };
  var vgLeg = function (k) {
    var el = document.querySelector('#lista .vg-vaza-item[data-vaza="' + k + '"]');
    return el ? el.textContent : '(sem legenda ' + k + ')';
  };
  var vgClica = function (id) {
    var b = document.querySelector('#lista [data-acao="vg-janela"][data-id="' + id + '"]');
    if (b) b.click();
    return !!b;
  };
  var vgSub = function (col, cls) { return col ? col.querySelector(cls) : null; };
  var vgAlt = function (col, cls) { var el = vgSub(col, cls); return el ? el.style.height : '(sem ' + cls + ')'; };
  var vgCor = function (col, cls) { var el = vgSub(col, cls); return el ? getComputedStyle(el).backgroundColor : '(sem ' + cls + ')'; };
  var vgCls = function (col, cls) { var el = vgSub(col, cls); return el ? el.className : '(sem ' + cls + ')'; };
  // aria-label da coluna: e por onde teclado e leitor de tela leem o que saiu de
  // baixo da barra, entao varias assercoes dependem dele. Fica aqui em cima com
  // os outros leitores: definido depois do primeiro uso, `var` iça a declaracao
  // mas nao a atribuicao, e a rodada morre num "not a function".
  var vgAria = function (el) { return el ? (el.getAttribute('aria-label') || '') : '(sem coluna)'; };

  vgClica('tudo');
  await espera(90);
  // Fixture: 3200 + 5000 + 2000 + 1000 = 11200. A cancelada de 9999 fica FORA.
  ok('faturamento soma so as nao canceladas', vgCel('vg-fat').indexOf('R$ 11.200,00') >= 0, vgCel('vg-fat'));
  // Assercao NEGATIVA exige a celula existir: sem isso ela e vacuamente
  // verdadeira num app que nem tem painel, e guard-rail que nao morde e enfeite.
  ok('a cancelada nao entrou no faturamento',
     !!document.querySelector('#lista .vg-valores [data-cel="vg-fat"]') &&
     vgCel('vg-fat').indexOf('9.999') < 0, vgCel('vg-fat'));
  // A arquivada de 8400 vem da tabela venda, nunca da v_venda: se um dia ela
  // vazar para o faturamento, o total salta para 19.600 e e aqui que aparece.
  ok('venda arquivada tambem fica fora do faturamento',
     !!document.querySelector('#lista .vg-valores [data-cel="vg-fat"]') &&
     vgCel('vg-fat').indexOf('19.600') < 0 && vgCel('vg-fat').indexOf('R$ 11.200,00') >= 0,
     vgCel('vg-fat'));
  ok('o contador do placar diz 4 vendas, nao 5', vgCel('vg-fat').indexOf('4 vendas') >= 0, vgCel('vg-fat'));
  // 540 + 800 + 300 - 500 = 1140
  ok('lucro soma a coluna lucro da view, inclusive o negativo',
     vgCel('vg-luc').indexOf('R$ 1.140,00') >= 0, vgCel('vg-luc'));
  // Margem saiu do PE do lucro e virou numero proprio. Era o menor texto do
  // bloco e e ela que diz se a operacao vale a pena.
  ok('margem e numero proprio, com chave propria (1140/11200)',
     vgCel('vg-margem').indexOf('10,2%') >= 0, vgCel('vg-margem'));
  ok('e nao e mais rodape do lucro', vgCel('vg-luc').indexOf('margem') < 0, vgCel('vg-luc'));
  ok('ticket medio = faturamento / vendas (11200/4)',
     vgCel('vg-ticket').indexOf('R$ 2.800,00') >= 0, vgCel('vg-ticket'));
  ok('e o pe do ticket traz o lucro medio (1140/4)',
     vgCel('vg-ticket').indexOf('R$ 285,00') >= 0, vgCel('vg-ticket'));
  // frete 30+90+50+100 = 270; taxas 30+10+0+0 = 40
  ok('vazamento = frete + taxas (270 + 40)', vgCel('vg-vazamento').indexOf('R$ 310,00') >= 0, vgCel('vg-vazamento'));
  ok('e diz quanto isso pesa no lucro (310/1140)',
     vgCel('vg-vazamento').indexOf('27,2% do lucro') >= 0, vgCel('vg-vazamento'));
  // A legenda passou a falar so em % (a coluna de valores fala em R$), entao a
  // conta e conferida do jeito que importa mais: o GRAFICO e o NUMERO tem que
  // dizer a mesma coisa. Se um dia alguem recalcular lucro no cliente em vez de
  // somar a coluna da view, os dois lados divergem e e aqui que aparece.
  // TRES partes, nao quatro. Frete e taxas viraram uma so porque o par de cores
  // possivel para elas media ΔE 13.0 na visao normal, abaixo do piso de 15.
  // 9750/11200 = 87,1% · 310/11200 = 2,8% · 1140/11200 = 10,2%
  ok('a barra de vazamento fecha 100% do faturamento em 3 partes',
     vgLeg('custo').indexOf('87,1%') >= 0 && vgLeg('vaza').indexOf('2,8%') >= 0 &&
     vgLeg('luc').indexOf('10,2%') >= 0,
     vgLeg('custo') + ' | ' + vgLeg('vaza') + ' | ' + vgLeg('luc'));
  ok('e a fatia de lucro do grafico bate com a margem do numero (10,2% nos dois)',
     vgLeg('luc').indexOf('10,2%') >= 0 && vgCel('vg-margem').indexOf('10,2%') >= 0,
     'grafico=' + vgLeg('luc') + ' numero=' + vgCel('vg-margem'));
  ok('nao ha mais fatia separada de frete nem de taxas',
     !document.querySelector('#lista [data-vaza="frete"]') &&
     !document.querySelector('#lista [data-vaza="taxas"]'));
  // A quebra frete/taxas nao se perdeu: ela vive em R$ no bloco de vazamento.
  ok('a quebra frete/taxas continua legivel, em R$, no bloco de valores',
     vgCel('vg-vazamento').indexOf('R$ 270,00') >= 0 && vgCel('vg-vazamento').indexOf('R$ 40,00') >= 0,
     vgCel('vg-vazamento'));
  // A legenda e a chave de cor dos DOIS graficos, entao cada item precisa do
  // quadradinho: sem ele o nome nao amarra em fatia nenhuma.
  ok('cada item da legenda tem o quadradinho que amarra cor e nome',
     document.querySelectorAll('#lista .vg-vaza-item i').length === 3,
     'n=' + document.querySelectorAll('#lista .vg-vaza-item i').length);
  // O recorte e parte do dado: sem ele a tela mente por omissao. O fim varia com
  // a data de hoje, entao a assercao cobre o inicio e a contagem, nunca o fim.
  var vgRec = document.querySelector('#lista .vg-recorte');
  ok('o painel DECLARA a janela (de X a ...)',
     !!vgRec && vgRec.textContent.indexOf('de 18/07/2026 a ') === 0, vgRec && vgRec.textContent);
  ok('e declara a pre-venda que esta somada dentro',
     !!vgRec && vgRec.textContent.indexOf('4 vendas · inclui 1 pré-venda') >= 0, vgRec && vgRec.textContent);

  // ---- as barras por mes ----
  var vgJul = document.querySelector('#lista .vg-mes[data-mes="2026-07"]');
  var vgAgo = document.querySelector('#lista .vg-mes[data-mes="2026-08"]');
  ok('ha uma coluna por mes com venda na janela',
     document.querySelectorAll('#lista .vg-mes').length === 2 && !!vgJul && !!vgAgo,
     'n=' + document.querySelectorAll('#lista .vg-mes').length);
  // A cancelada de julho nao virou coluna propria NEM engordou a de julho: sao
  // 2 vendas no mes, nao 3. A contagem saiu do texto sob a barra e vive no
  // aria-label, que e por onde teclado e leitor de tela leem.
  ok('a cancelada nao virou coluna propria nem somou em julho',
     vgAria(vgJul).indexOf('2 vendas') >= 0, vgAria(vgJul));
  // julho 8200 e o maior mes -> 100%; agosto 3000 -> 37%
  ok('a fita do maior mes ocupa o tubo inteiro',
     vgAlt(vgJul, '.vg-fat') === '100%', vgAlt(vgJul, '.vg-fat'));
  ok('e o mes menor e proporcional ao maior (3000/8200)',
     vgAlt(vgAgo, '.vg-fat') === '37%', vgAlt(vgAgo, '.vg-fat'));
  // A coluna e EMPILHADA: bater o olho tem que dizer de uma vez qual mes foi
  // maior E qual mes guardou mais. A versao anterior, com uma lasca de lucro
  // dentro de um tubo cheio, so respondia a primeira pergunta.
  // Julho: fat 8200, custo 6700, frete 120, taxas 40, lucro 1340.
  ok('a coluna do mes e empilhada nas 3 partes, nao uma fatia so',
     (vgJul ? vgJul.querySelectorAll('.vg-seg').length : 0) === 3,
     'n=' + (vgJul ? vgJul.querySelectorAll('.vg-seg').length : 0));
  // custo 6700 + vazamento 160 + lucro 1340 = 8200, o faturamento do mes
  ok('a fatia de custo e 6700/8200 do mes', vgAlt(vgJul, '.s-custo') === '81.71%', vgAlt(vgJul, '.s-custo'));
  ok('a fatia de vazamento e 160/8200 do mes', vgAlt(vgJul, '.s-vaza') === '1.95%', vgAlt(vgJul, '.s-vaza'));
  ok('a fatia de lucro e 1340/8200 do mes', vgAlt(vgJul, '.s-luc') === '16.34%', vgAlt(vgJul, '.s-luc'));
  ok('as fatias usam as MESMAS cores da legenda (uma chave serve os dois graficos)',
     vgCor(vgJul, '.s-luc') === 'rgb(15, 122, 82)' && vgCor(vgJul, '.s-vaza') === 'rgb(196, 136, 8)' &&
     vgCor(vgJul, '.s-custo') === 'rgb(92, 102, 117)',
     vgCor(vgJul, '.s-luc') + ' | ' + vgCor(vgJul, '.s-vaza') + ' | ' + vgCor(vgJul, '.s-custo'));
  // --dim e --morno CHEIOS: a 28% e 45% de opacidade as fatias liam como papel,
  // fora da banda de luminosidade do validador.
  ok('as fatias sao opacas, nao lavadas',
     (vgSub(vgJul, '.s-custo') ? getComputedStyle(vgSub(vgJul, '.s-custo')).opacity : '?') === '1',
     vgSub(vgJul, '.s-custo') ? getComputedStyle(vgSub(vgJul, '.s-custo')).opacity : '(sem fatia)');
  // Vao de 2px na cor da superficie, nunca borda em volta da marca.
  ok('as fatias vizinhas separam por VAO de 2px, nao por borda',
     (vgSub(vgJul, '.s-vaza') ? getComputedStyle(vgSub(vgJul, '.s-vaza')).marginTop : '?') === '2px' &&
     (vgSub(vgJul, '.s-vaza') ? getComputedStyle(vgSub(vgJul, '.s-vaza')).borderTopWidth : '?') === '0px',
     'margin=' + (vgSub(vgJul, '.s-vaza') ? getComputedStyle(vgSub(vgJul, '.s-vaza')).marginTop : '?') +
     ' border=' + (vgSub(vgJul, '.s-vaza') ? getComputedStyle(vgSub(vgJul, '.s-vaza')).borderTopWidth : '?'));
  // Ponta de dado: 4px em cima, quadrada na base. A coluna cresce de UMA linha
  // de base, e o canto marca onde o dado termina.
  ok('a fatia do topo tem canto de 4px',
     (vgSub(vgJul, '.s-custo') ? getComputedStyle(vgSub(vgJul, '.s-custo')).borderTopLeftRadius : '?') === '4px',
     vgSub(vgJul, '.s-custo') ? getComputedStyle(vgSub(vgJul, '.s-custo')).borderTopLeftRadius : '?');
  ok('e a fatia da base e quadrada',
     (vgSub(vgJul, '.s-luc') ? getComputedStyle(vgSub(vgJul, '.s-luc')).borderBottomLeftRadius : '?') === '0px',
     vgSub(vgJul, '.s-luc') ? getComputedStyle(vgSub(vgJul, '.s-luc')).borderBottomLeftRadius : '?');
  // agosto: 300 - 500 = -200. Prejuizo nao tem fatia de lucro para empilhar.
  ok('mes no prejuizo nao tem fatia de lucro', !vgSub(vgAgo, '.s-luc'));
  ok('e ganha a faixa negativa, dimensionada pelo rombo (200/3000)',
     vgAlt(vgAgo, '.s-neg') === '7%', vgAlt(vgAgo, '.s-neg'));
  ok('a faixa negativa usa a cor de erro',
     vgCor(vgAgo, '.s-neg') === 'rgb(176, 18, 53)', vgCor(vgAgo, '.s-neg'));
  // Verde x vermelho no mesmo tom separam 1.32 (prova_grafico.py): matiz sozinho
  // deixa lucro e prejuizo iguais para quem tem daltonismo vermelho-verde. A
  // hachura e o segundo canal, e aqui ela e conferida no DOM RENDERIZADO, nao
  // so na folha de estilo.
  ok('o mes de prejuizo tem hachura, nao so cor (matiz nao pode ser o unico canal)',
     (vgSub(vgAgo, '.s-neg') ? getComputedStyle(vgSub(vgAgo, '.s-neg')).backgroundImage : 'none')
       .indexOf('repeating-linear-gradient') >= 0,
     vgSub(vgAgo, '.s-neg') ? getComputedStyle(vgSub(vgAgo, '.s-neg')).backgroundImage : '(sem faixa)');
  ok('e o mes de lucro NAO tem hachura (senao o segundo canal nao distingue nada)',
     (vgSub(vgJul, '.s-luc') ? getComputedStyle(vgSub(vgJul, '.s-luc')).backgroundImage : 'x') === 'none',
     vgSub(vgJul, '.s-luc') ? getComputedStyle(vgSub(vgJul, '.s-luc')).backgroundImage : '(sem fatia)');
  // SOB A BARRA FICA SO O MES. Quatro rotulos por coluna (valor, mes, margem,
  // n de vendas) e a definicao de inundar um grafico, e o que se le nesse caso e
  // nada. Estas duas assercoes travam o retorno.
  ok('sob a coluna fica so o rotulo do mes, mais nada',
     !!vgJul && vgJul.textContent.replace(/\s+/g, '') === 'jul',
     vgJul ? JSON.stringify(vgJul.textContent) : '(sem coluna)');
  ok('nenhuma coluna imprime valor nem margem',
     document.querySelectorAll('#lista .vg-mes-num, #lista .vg-mes-mg, #lista .vg-mes-pe').length === 0,
     'n=' + document.querySelectorAll('#lista .vg-mes-num, #lista .vg-mes-mg, #lista .vg-mes-pe').length);
  // Nada fica represado atras do hover: quem usa teclado ou leitor de tela le a
  // mesma frase no aria-label do botao.
  ok('a coluna carrega o resumo do mes no aria-label',
     vgAria(vgJul).indexOf('margem 16,3%') >= 0 && vgAria(vgJul).indexOf('R$ 8.200,00') >= 0,
     vgAria(vgJul));
  ok('o grafico explica a propria leitura no titulo',
     (document.querySelector('#lista .vg-tit') || {}).textContent &&
     document.querySelector('#lista .vg-tit').textContent.indexOf('altura = faturamento') >= 0,
     (document.querySelector('#lista .vg-tit') || {}).textContent);
  // tabular-nums da largura de zero a todo digito e deixa numero grande frouxo.
  ok('o numero grande usa figuras proporcionais, nao tabular-nums',
     vgEstilo('#lista .vg-val[data-cel="vg-fat"] .vg-num', 'fontVariantNumeric').indexOf('tabular-nums') < 0,
     vgEstilo('#lista .vg-val[data-cel="vg-fat"] .vg-num', 'fontVariantNumeric'));

  // ---- o balao: hover no desktop, TOQUE no celular ----
  // A cartilha e clara que tooltip enriquece mas nunca e o unico caminho para um
  // valor. No celular nao existe hover, entao sem o toque a composicao do mes
  // ficaria represada atras de um gesto que o aparelho nao tem.
  var vgTip = document.getElementById('vgTip');
  ok('o balao existe e comeca escondido', !!vgTip && vgTip.hidden);
  if (vgJul) vgJul.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await espera(60);
  ok('passar o mouse na coluna abre o balao', !!vgTip && !vgTip.hidden);
  ok('e ele traz as TRES partes em R$ (custo 6700, vazamento 160, lucro 1340)',
     !!vgTip && vgTip.textContent.indexOf('R$ 6.700,00') >= 0 &&
     vgTip.textContent.indexOf('R$ 160,00') >= 0 && vgTip.textContent.indexOf('R$ 1.340,00') >= 0,
     vgTip ? vgTip.textContent : '(sem balao)');
  ok('e nomeia o mes por extenso, com a margem',
     !!vgTip && vgTip.textContent.indexOf('julho') >= 0 && vgTip.textContent.indexOf('16,3%') >= 0,
     vgTip ? vgTip.textContent : '(sem balao)');
  if (vgJul) vgJul.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
  await espera(60);
  ok('tirar o mouse fecha', !!vgTip && vgTip.hidden);
  if (vgJul) vgJul.click();
  await espera(60);
  ok('e o TOQUE tambem abre (celular nao tem hover)', !!vgTip && !vgTip.hidden);
  if (vgJul) vgJul.click();
  await espera(60);
  ok('tocar de novo fecha', !!vgTip && vgTip.hidden);

  // ---- trocar a janela nao pode custar rede ----
  // A tela ja tem as linhas na memoria; refazer as 3 leituras para reagrupar o
  // que ja esta aqui e o defeito que o v51 tirou do resto do app.
  var vgFromAntes = (window.__fromChamadas || []).length;
  var vgRpcAntes = (window.__rpcChamadas || []).length;
  var vgCardsAntes = document.querySelectorAll('#lista .card').length;
  // vgTrocou guarda as tres assercoes abaixo: sem ele, "nao leu rede" e verdade
  // trivial num app onde o botao nem existe para ser clicado.
  var vgTrocou = vgClica('mes');
  await espera(90);
  ok('trocar a janela do painel NAO le nenhuma tabela',
     vgTrocou && (window.__fromChamadas || []).length === vgFromAntes,
     'clicou=' + vgTrocou + ' antes=' + vgFromAntes + ' depois=' + (window.__fromChamadas || []).length);
  ok('trocar a janela do painel NAO chama nenhuma RPC',
     vgTrocou && (window.__rpcChamadas || []).length === vgRpcAntes,
     'clicou=' + vgTrocou + ' antes=' + vgRpcAntes + ' depois=' + (window.__rpcChamadas || []).length);
  ok('e a lista de cards nao pisca nem encolhe',
     vgTrocou && document.querySelectorAll('#lista .card').length === vgCardsAntes &&
     !document.querySelector('#lista .estado.carregando'),
     'clicou=' + vgTrocou + ' n=' + document.querySelectorAll('#lista .card').length);
  ok('o botao clicado ficou marcado, e so ele',
     document.querySelectorAll('#lista [data-acao="vg-janela"][aria-pressed="true"]').length === 1 &&
     document.querySelector('#lista [data-acao="vg-janela"][data-id="mes"]').getAttribute('aria-pressed') === 'true');
  // Vazio NAO derruba o painel: os quatro rotulos ficam, com travessao no lugar
  // do numero. So renderizar campo que tem dado e o que faz a tela sumir na base
  // zerada. O mes corrente pode ou nao ter venda conforme o dia em que a suite
  // roda, entao os DOIS ramos afirmam alguma coisa.
  ok('todo rotulo da coluna de valores continua na tela em qualquer janela',
     ['vg-fat', 'vg-luc', 'vg-margem', 'vg-ticket', 'vg-vazamento'].every(function (k) {
       return !!document.querySelector('#lista .vg-valores [data-cel="' + k + '"] .pb-rot'); }));
  var vgMesVazio = !document.querySelector('#lista .vg-mes');
  if (vgMesVazio) {
    ok('janela vazia mantem o painel e mostra o travessao, nao some',
       vgCel('vg-fat').indexOf('—') >= 0 && !!document.querySelector('#lista .vg-vazio'), vgCel('vg-fat'));
    ok('e o vazio oferece o caminho de saida (abrir para tudo)',
       !!document.querySelector('#lista .vg-abrir[data-id="tudo"]'));
    // Na 1a passada o vazio engolia o painel inteiro. Agora ele ocupa so o lugar
    // dos graficos: o numero continua na tela, com travessao.
    ok('e o aviso fica DENTRO da coluna de graficos, sem derrubar os valores',
       !!document.querySelector('#lista .vg-graficos .vg-vazio') &&
       !!document.querySelector('#lista .vg-valores [data-cel="vg-fat"]'));
  } else {
    ok('janela do mes corrente tem venda: o painel mostra as barras',
       !!document.querySelector('#lista .vg-meses') && !document.querySelector('#lista .vg-vazio'));
    ok('e o faturamento do mes nao e o da base inteira',
       vgCel('vg-fat').indexOf('R$ 11.200,00') < 0, vgCel('vg-fat'));
  }

  // ---- abrir as arquivadas tambem parou de reler a base ----
  vgClica('tudo');
  await espera(90);
  // Sem `if`: ate agora esta assercao nao rodava em rodada NENHUMA, porque o
  // fixture nao tinha venda arquivada e o botao nunca existia. Assercao que nao
  // roda parece cobertura e nao e.
  var vgArqBt = document.querySelector('#lista [data-acao="venda-arq-alternar"]');
  ok('a gaveta das arquivadas aparece quando ha arquivada', !!vgArqBt);
  var arqFrom = (window.__fromChamadas || []).length;
  if (vgArqBt) vgArqBt.click();
  await espera(90);
  ok('abrir as arquivadas NAO le a base de novo (ate a v51 relia as 3)',
     !!vgArqBt && (window.__fromChamadas || []).length === arqFrom,
     'botao=' + !!vgArqBt + ' antes=' + arqFrom + ' depois=' + (window.__fromChamadas || []).length);
  ok('e a arquivada aparece na gaveta, fora do faturamento',
     telaTxt().indexOf('VENDA-0009') >= 0 && telaTxt().indexOf('fora do faturamento') >= 0,
     telaTxt().slice(-140));
  if (vgArqBt) vgArqBt.click();
  await espera(90);

  var btEnt1 = document.querySelector('[data-acao="venda-entrega"][data-id="v1"]');
  var btEnt2 = document.querySelector('[data-acao="venda-entrega"][data-id="v2"]');
  ok('as duas vendas tem o botao Relatorio', !!btEnt1 && !!btEnt2);
  ok('o botao da venda SEM endereco pede acao (ent-pede, semantica de morno)',
     !!btEnt2 && btEnt2.className.indexOf('ent-pede') >= 0, btEnt2 && btEnt2.className);
  ok('o botao da venda COM endereco nao pede nada',
     !!btEnt1 && btEnt1.className.indexOf('ent-pede') < 0, btEnt1 && btEnt1.className);
  ok('o botao que pede acao usa a cor de morno, nao a de erro',
     getComputedStyle(btEnt2).color === 'rgb(148, 101, 0)', getComputedStyle(btEnt2).color);

  btEnt1.click();
  await espera(260);
  var pnEnt = document.getElementById('painelEntrega');
  ok('o painel de entrega ABRIU no clique (a porta abre)',
     pnEnt.className.indexOf('oculto') < 0, pnEnt.className);
  ok('nome do cliente veio do cadastro e e somente leitura',
     document.getElementById('peNome').value === 'Diego Souza' && document.getElementById('peNome').readOnly,
     document.getElementById('peNome').value);
  ok('WhatsApp do cliente veio formatado e e somente leitura',
     document.getElementById('peWhats').value.indexOf('99000-0000') >= 0 && document.getElementById('peWhats').readOnly,
     document.getElementById('peWhats').value);
  ok('o local de retirada veio da venda',
     document.getElementById('peRetirada').value === 'Campo Grande', document.getElementById('peRetirada').value);
  ok('o endereco de entrega veio da venda',
     document.getElementById('peEntrega').value.indexOf('Laranjeiras 100') >= 0, document.getElementById('peEntrega').value);
  ok('o valor a cobrar veio da venda', String(document.getElementById('peValor').value) === '90',
     document.getElementById('peValor').value);
  ok('a forma de pagamento veio da venda', document.getElementById('pePgto').value === 'pix',
     document.getElementById('pePgto').value);
  ok('o motoboy da venda veio preenchido', document.getElementById('peMotoboy').value === 'Hiago',
     document.getElementById('peMotoboy').value);

  var prevE = document.getElementById('pePrevia').textContent;
  ok('a previa nomeia a venda', prevE.indexOf('VENDA-0001') >= 0, prevE.slice(0, 40));
  ok('a previa leva os seis campos pedidos (nome, numero, retirada, entrega, valor, pagamento)',
     ['Cliente: Diego Souza', 'Contato:', 'Retirar em: Campo Grande',
      'Entregar em: Rua das Laranjeiras', 'Cobrar: R$ 90,00', 'Pix'].every(function (p) {
        return prevE.indexOf(p) >= 0; }), prevE.replace(/\\n/g, ' | '));
  // dinheiro NUNCA some do texto: sem valor, a linha diz que nao ha o que cobrar
  document.getElementById('peValor').value = '';
  document.getElementById('peValor').dispatchEvent(new Event('input'));
  ok('sem valor, a previa DIZ nada a cobrar em vez de omitir a linha',
     document.getElementById('pePrevia').textContent.indexOf('nada a cobrar') >= 0,
     document.getElementById('pePrevia').textContent.replace(/\\n/g, ' | '));
  document.getElementById('peValor').value = '90';
  document.getElementById('peValor').dispatchEvent(new Event('input'));

  ok('a lista de motoboys carregou do banco',
     document.querySelectorAll('#peMotoLista .moto-chip').length === 2,
     'n=' + document.querySelectorAll('#peMotoLista .moto-chip').length);
  ok('o motoboy sem numero aparece dizendo o que falta',
     document.getElementById('peMotoLista').textContent.indexOf('sem WhatsApp') >= 0,
     document.getElementById('peMotoLista').textContent);

  // ---- os dois guards do enviar, provados ANTES do caminho feliz -------------
  var nEd = function () { return window.__rpcChamadas.filter(function (x) { return x.nome === 'editar_venda'; }).length; };
  var edAntes = nEd();
  document.getElementById('peEntrega').value = '';
  document.getElementById('btnEnviarEntrega').click();
  await espera(180);
  ok('sem endereco, enviar nao chama RPC nenhuma e explica por que',
     nEd() === edAntes && document.getElementById('peErro').textContent.indexOf('endereço') >= 0,
     document.getElementById('peErro').textContent);
  document.getElementById('peEntrega').value = 'Rua das Laranjeiras 100, apto 501';
  document.getElementById('peMotoWhats').value = '';
  document.getElementById('btnEnviarEntrega').click();
  await espera(180);
  ok('sem WhatsApp do motoboy, enviar tambem para antes da RPC',
     nEd() === edAntes && document.getElementById('peErro').textContent.indexOf('motoboy') >= 0,
     document.getElementById('peErro').textContent);

  // ---- caminho feliz: salva primeiro, abre a conversa depois -----------------
  document.getElementById('peMotoWhats').value = '(21) 98765-4321';
  document.getElementById('peRecado').value = 'interfone quebrado';
  document.getElementById('peRecado').dispatchEvent(new Event('input'));
  document.getElementById('btnEnviarEntrega').click();
  await espera(320);
  var chEd = window.__rpcChamadas.filter(function (x) { return x.nome === 'editar_venda'; });
  ok('enviar chamou editar_venda uma vez', chEd.length === edAntes + 1, 'n=' + chEd.length);
  var plEd = (chEd[chEd.length - 1] || {}).args ? chEd[chEd.length - 1].args.payload : {};
  ok('o payload leva os campos da entrega',
     !!(plEd.endereco_entrega && plEd.fornecedor_local_retirada && plEd.valor_a_cobrar
        && plEd.forma_pagamento && plEd.motoboy && plEd.motoboy_whatsapp), JSON.stringify(plEd));
  // identidade mora no lead: a entrega nao pode criar uma segunda versao do cliente
  ok('o payload NAO mexe no nome nem no telefone do cliente',
     !('comprador_nome' in plEd) && !('comprador_whatsapp' in plEd), JSON.stringify(plEd));
  var urlWa = (window.__aberturas[window.__aberturas.length - 1] || { location: {} }).location.href || '';
  ok('abriu a conversa do motoboy no WhatsApp',
     urlWa.indexOf('https://wa.me/5521987654321?text=') === 0, urlWa.slice(0, 60));
  var txtWa = decodeURIComponent(urlWa.split('?text=')[1] || '');
  ok('o texto enviado carrega destino, dinheiro e recado',
     txtWa.indexOf('Entregar em') >= 0 && txtWa.indexOf('Cobrar: R$ 90,00') >= 0
     && txtWa.indexOf('interfone quebrado') >= 0, txtWa.replace(/\\n/g, ' | '));
  ok('o painel fechou depois de despachar',
     document.getElementById('painelEntrega').className.indexOf('oculto') >= 0);

  // ---- o botao do motoboy cadastrado: um toque despacha ----------------------
  await espera(200);
  document.querySelector('[data-acao="venda-entrega"][data-id="v1"]').click();
  await espera(280);
  var edAntes2 = nEd();
  var chips = document.querySelectorAll('#peMotoLista .moto-chip');
  ok('a lista de motoboys reaparece no painel reaberto', chips.length === 2, 'n=' + chips.length);
  chips[0].click();
  await espera(320);
  ok('o botao do motoboy despachou sozinho (chamou editar_venda)', nEd() === edAntes2 + 1,
     'antes=' + edAntes2 + ' depois=' + nEd());
  var chEd2 = window.__rpcChamadas.filter(function (x) { return x.nome === 'editar_venda'; });
  var plEd2 = chEd2[chEd2.length - 1].args.payload;
  ok('o motoboy escolhido no botao foi para a venda',
     plEd2.motoboy === 'Hiago' && String(plEd2.motoboy_whatsapp).replace(/\D/g, '') === '5521987654321',
     JSON.stringify(plEd2));
  var urlWa2 = (window.__aberturas[window.__aberturas.length - 1] || { location: {} }).location.href || '';
  ok('abriu a conversa DELE, nao a do campo digitado',
     urlWa2.indexOf('wa.me/5521987654321') > 0, urlWa2.slice(0, 60));

  // motoboy sem numero nao pode montar um wa.me vazio
  await espera(200);
  document.querySelector('[data-acao="venda-entrega"][data-id="v1"]').click();
  await espera(280);
  var edAntes3 = nEd(), abertAntes = window.__aberturas.length;
  document.querySelectorAll('#peMotoLista .moto-chip')[1].click();
  await espera(240);
  ok('motoboy sem WhatsApp nao despacha nem abre janela',
     nEd() === edAntes3 && window.__aberturas.length === abertAntes,
     'rpc=' + (nEd() - edAntes3) + ' janelas=' + (window.__aberturas.length - abertAntes));

  // ---- cadastrar motoboy pela propria tela -----------------------------------
  document.getElementById('peMotoboy').value = 'Novo Boy';
  document.getElementById('peMotoWhats').value = '21911112222';
  document.querySelector('[data-acao="ent-moto-salvar"]').click();
  await espera(300);
  var chMb = window.__rpcChamadas.filter(function (x) { return x.nome === 'salvar_motoboy'; });
  ok('salvar na lista chamou salvar_motoboy', chMb.length === 1, 'n=' + chMb.length);
  ok('o cadastro levou nome e WhatsApp',
     !!(chMb[0] && chMb[0].args.payload.nome === 'Novo Boy' && chMb[0].args.payload.whatsapp),
     JSON.stringify(chMb[0] && chMb[0].args.payload));
  ok('a lista repintou com o motoboy novo',
     document.querySelectorAll('#peMotoLista .moto-chip').length === 3,
     'n=' + document.querySelectorAll('#peMotoLista .moto-chip').length);
  // tirar da lista
  document.querySelectorAll('#peMotoLista .moto-rm')[2].click();
  await espera(300);
  ok('tirar da lista chamou desligar_motoboy',
     window.__rpcChamadas.filter(function (x) { return x.nome === 'desligar_motoboy'; }).length === 1);
  ok('e a lista voltou a dois',
     document.querySelectorAll('#peMotoLista .moto-chip').length === 2,
     'n=' + document.querySelectorAll('#peMotoLista .moto-chip').length);

  // ---- copiar: copia primeiro (dentro do gesto), salva depois ----------------
  var edAntes4 = nEd();
  document.getElementById('btnCopiarEntrega').click();
  await espera(300);
  if (clipOk) ok('copiar levou o texto do relatorio para a area de transferencia',
     !!window.__copiado && window.__copiado.indexOf('ENTREGA · VENDA-0001') === 0,
     String(window.__copiado).slice(0, 40));
  ok('copiar tambem grava a correcao na venda', nEd() === edAntes4 + 1,
     'antes=' + edAntes4 + ' depois=' + nEd());

  ok('nenhum TypeError em todo o caminho de escrita da entrega',
     window.__erroJs.length === 0, window.__erroJs.join(' | '));

  // trocar de aba fecha o painel de entrega tambem
  document.querySelector('[data-acao="venda-entrega"][data-id="v2"]').click();
  await espera(260);
  ok('o painel reabre pela venda sem endereco',
     document.getElementById('painelEntrega').className.indexOf('oculto') < 0);
  document.getElementById('abaFila').click();
  await espera(220);
  ok('trocar de aba fecha o painel de entrega (sem sobreposicao)',
     document.getElementById('painelEntrega').className.indexOf('oculto') >= 0,
     document.getElementById('painelEntrega').className);
  document.getElementById('abaVendas').click();
  await espera(220);

  // ---- fluidez: painel aberto NAO pode sobreviver a troca de aba (sem sobreposicao)
  document.querySelector('[data-acao="nova-venda"]').click();
  await espera(140);
  ok('painel de venda reaberto para o teste de troca', document.getElementById('painelVenda').className.indexOf('oculto') < 0);
  document.getElementById('abaTodos').click();
  await espera(160);
  ok('trocar de aba fecha o painel aberto (sem sobreposicao)',
     document.getElementById('painelVenda').className.indexOf('oculto') >= 0);

  // ---- o estilo da Fila NAO pode vazar para a Todos ------------------------
  // Fila e Todos renderizam o MESMO .card no MESMO #lista. Escopar por
  // [data-aba] so vale se o contrario tambem for verdade: sem esta assercao,
  // trocar #lista[data-aba="fila"] .card por .card passaria despercebido.
  var lstT = document.getElementById('lista');
  ok('#lista trocou de aba', lstT.getAttribute('data-aba') === 'todos',
     'data-aba=' + lstT.getAttribute('data-aba'));
  ok('a bandeja tingida NAO vazou para a Todos',
     getComputedStyle(lstT).backgroundColor !== 'rgb(246, 247, 250)',
     getComputedStyle(lstT).backgroundColor);
  var cT = document.querySelector('#lista .card');
  if (cT) ok('o card da Todos NAO pegou o raio da Fila',
     getComputedStyle(cT).borderTopLeftRadius === '8px',
     getComputedStyle(cT).borderTopLeftRadius);

  // ---- voltar para a Fila não pode deixar resíduo
  document.getElementById('abaFila').click();
  await espera(200);
  ok('pitboard de lead volta na Fila', getComputedStyle(document.getElementById('pitboard')).display !== 'none');
  ok('a Fila volta a mostrar cards', document.querySelectorAll('#lista .card').length > 0);

  // ---- kanban: mover card escreve no Notion (Notion-first, via mover-conteudo) ----
  document.getElementById('abaConteudo').click();
  await espera(260);
  var cardC1 = [].filter.call(
    document.querySelectorAll('#lista .cont-col[data-col="a_produzir"] .cont-card'),
    function (el) { return el.getAttribute('data-id') === 'c1'; })[0];
  ok('c1 nasce na coluna A produzir e e arrastavel', !!cardC1 && cardC1.getAttribute('draggable') === 'true');
  // drop na coluna inteira (sem mirar em card, sem rolar pra cima): no desktop as
  // colunas ficam da mesma altura via align-items:stretch. O harness roda em
  // viewport estreito (kanban empilha), entao a prova viewport-independente e que
  // a regra stretch esta aplicada; a igualdade de altura vem dela no desktop.
  ok('o kanban usa align-items:stretch (coluna inteira vira area de drop)',
     getComputedStyle(document.querySelector('#lista .cont-kanban')).alignItems === 'stretch',
     getComputedStyle(document.querySelector('#lista .cont-kanban')).alignItems);
  var btMover = cardC1 && cardC1.querySelector('[data-acao="cont-mover"]');
  ok('todo card do kanban tem o botao Mover (fallback do celular)', !!btMover);
  btMover.click();
  await espera(60);
  var opPronto = cardC1.querySelector('[data-acao="cont-mover-para"][data-col="pronto"]');
  ok('o menu Mover oferece a coluna Pronto e nao a coluna atual',
     !!opPronto && !cardC1.querySelector('[data-acao="cont-mover-para"][data-col="a_produzir"]'));
  opPronto.click();
  await espera(280);
  var chMover = window.__invocacoes.filter(function (x) { return x.nome === 'mover-conteudo'; })[0];
  ok('mover chamou a Edge Function mover-conteudo', !!chMover);
  ok('mover levou o id do card e a coluna destino',
     !!chMover && chMover.opts && chMover.opts.body && chMover.opts.body.id === 'c1' && chMover.opts.body.para === 'pronto',
     chMover ? JSON.stringify(chMover.opts.body) : 'sem chamada');
  ok('apos mover, c1 aparece na coluna Pronto',
     !![].filter.call(document.querySelectorAll('#lista .cont-col[data-col="pronto"] .cont-card'),
       function (el) { return el.getAttribute('data-id') === 'c1'; })[0]);
  ok('e some da coluna A produzir',
     ![].filter.call(document.querySelectorAll('#lista .cont-col[data-col="a_produzir"] .cont-card'),
       function (el) { return el.getAttribute('data-id') === 'c1'; })[0]);

  // ================= v51: clique de acao nao recarrega a tela =================
  // Ate 11/08/2026 todo clique de acao chamava B(), a carga completa. Medido
  // nesta maquina com fila de 25 leads: 20 chamadas de rede por clique, a lista
  // piscando com 'Lendo a base…', e 0 de 24 cards sobrevivendo. Estas assercoes
  // sao sobre CONTAGEM DE REDE e IDENTIDADE DE NO DO DOM, que e o unico jeito de
  // provar que uma tela NAO foi remontada: comparar HTML nao distingue "igual"
  // de "recriado igual".
  document.getElementById('abaFila').click();
  await espera(320);
  var cds = document.querySelectorAll('#lista .card');
  ok('a Fila tem 2+ cards para a prova cirurgica', cds.length >= 2, 'cards=' + cds.length);
  [].forEach.call(cds, function (el, ix) { el.setAttribute('data-prova', 'p' + ix); });
  var noP0 = cds[0];

  document.querySelector('#lista .card[data-prova="p0"] [data-acao="historico"]').click();
  await espera(240);
  ok('o Historico do card 1 abriu (estado que a acao no card 2 nao pode derrubar)',
     !!noP0.querySelector('[data-hist]'));

  var filaAntes = parseInt(document.getElementById('pbFila').textContent, 10);
  var alvo = document.querySelector('#lista .card[data-prova="p1"]');
  var codAlvo = alvo.getAttribute('data-lead');
  window.__rpcChamadas.length = 0;
  window.__fromChamadas.length = 0;
  // Poll nao serve: o stub resolve na hora e o spinner pode viver menos que um
  // tick, o que leria 'nao piscou' num app que pisca na producao (rede real de
  // 200-400ms). O observer pega a troca mesmo com duracao zero.
  var piscou = false;
  var obsL = new MutationObserver(function () {
    if (document.querySelector('#lista .estado.carregando')) piscou = true; });
  obsL.observe(document.getElementById('lista'), { childList: true, subtree: true });
  alvo.querySelector('[data-acao="toque"]').click();
  await espera(520);
  obsL.disconnect();

  var froms = window.__fromChamadas, rpcs = window.__rpcChamadas;
  ok('o clique NAO pisca a lista (nenhum estado.carregando entrou no DOM)', !piscou);
  ok('o clique NAO rele dicionario_rotulos (config, nao dado vivo)',
     froms.filter(function (x) { return x === 'dicionario_rotulos'; }).length === 0, froms.join(','));
  ok('o clique le v_lead uma vez so (UMA linha por .eq, nao a base)',
     froms.filter(function (x) { return x === 'v_lead'; }).length === 1, froms.join(','));
  ok('o clique NAO dispara a rajada de sugerir_mensagem',
     rpcs.filter(function (r) { return r.nome === 'sugerir_mensagem'; }).length === 0,
     rpcs.length + ' rpcs');
  ok('custo total do clique <= 2 chamadas de rede',
     rpcs.length + froms.length <= 2, 'rpc=' + rpcs.length + ' from=' + froms.length);

  var pos = document.querySelectorAll('#lista .card');
  ok('o card tocado sai da Fila (registrar_toque grava ultimo_toque_em = hoje)',
     ![].filter.call(pos, function (el) { return el.getAttribute('data-lead') === codAlvo; })[0], codAlvo);
  ok('os demais cards NAO foram recriados (a marca sobreviveu)',
     pos.length > 0 && [].filter.call(pos, function (el) { return el.getAttribute('data-prova'); }).length === pos.length,
     [].filter.call(pos, function (el) { return el.getAttribute('data-prova'); }).length + ' de ' + pos.length);
  ok('o card 1 e o MESMO no do DOM (identidade, nao HTML igual)',
     document.querySelector('#lista .card[data-prova="p0"]') === noP0);
  ok('o Historico aberto sobreviveu a acao no outro card',
     !!document.querySelector('#lista .card[data-prova="p0"] [data-hist]'));
  ok('o pitboard acompanhou sem tocar na rede',
     parseInt(document.getElementById('pbFila').textContent, 10) === filaAntes - 1,
     'antes=' + filaAntes + ' depois=' + document.getElementById('pbFila').textContent);

  // ---- Respondeu: o outro caminho. NAO tira da fila (registrar_resposta nao
  // mexe em status, proximo_contato nem ultimo_toque_em), entao o card fica e e
  // trocado no lugar. E a sugestao daquele lead e REBUSCADA, porque cache de
  // sugestao velha mentiria sobre o passo da cadencia (invariante 13).
  // O card do lead COM consentimento e o que tem link de WhatsApp: e a mesma
  // condicao que o prefetch exige, entao nao se escolhe por posicao (a fila
  // ordena por proximo_contato e o 1o do fixture e justamente um SEM consent).
  var vivo = [].filter.call(document.querySelectorAll('#lista .card[data-prova]'),
    function (el) { return !!el.querySelector('[data-wa-lead]'); })[0];
  // O `if` nao e frescura: quando estas assercoes rodaram contra o app ANTIGO
  // (para provar que elas mordem), a lista era recriada, `data-prova` sumia,
  // `vivo` vinha undefined e a suite ESTOURAVA aqui, levando junto os blocos de
  // Escopo e Hoje, que nunca chegaram a ser avaliados. Falha tem que reprovar,
  // nao derrubar a rodada.
  ok('ha um card com consentimento na fila para esta prova', !!vivo);
  if (vivo) {
  var codVivo = vivo.getAttribute('data-lead');
  vivo.querySelector('[data-acao="leque"]').click();
  await espera(120);
  window.__rpcChamadas.length = 0; window.__fromChamadas.length = 0;
  vivo.querySelector('[data-acao="respondeu"]').click();
  await espera(520);
  var aindaLa = [].filter.call(document.querySelectorAll('#lista .card'),
    function (el) { return el.getAttribute('data-lead') === codVivo; })[0];
  ok('Respondeu NAO tira o lead da fila: o card continua la', !!aindaLa);
  ok('e o card foi TROCADO no lugar (perdeu a marca; os vizinhos nao)',
     !!aindaLa && !aindaLa.getAttribute('data-prova'));
  ok('a sugestao daquele lead foi rebuscada, nao reaproveitada do cache',
     window.__rpcChamadas.filter(function (r) { return r.nome === 'sugerir_mensagem'; }).length === 1,
     window.__rpcChamadas.map(function (r) { return r.nome; }).join(','));
  }

  // ---- LGPD no caminho novo (invariante 16). O repintar cirurgico usa o mesmo
  // x() da lista, mas isso precisa ser PROVADO no caminho novo, nao deduzido:
  // lead sem consentimento nao ganha link nem sugestao ao ser repintado.
  var semC = [].filter.call(document.querySelectorAll('#lista .card[data-prova]'),
    function (el) { return !el.querySelector('[data-wa-lead]'); })[0];
  ok('ha um card SEM consentimento na fila para a prova de LGPD', !!semC);
  if (semC) {
  semC.querySelector('[data-acao="leque"]').click();
  await espera(120);
  window.__rpcChamadas.length = 0;
  semC.querySelector('[data-acao="respondeu"]').click();
  await espera(520);
  var semCodigo = semC.getAttribute('data-lead');
  var repintado = [].filter.call(document.querySelectorAll('#lista .card'),
    function (el) { return el.getAttribute('data-lead') === semCodigo; })[0];
  ok('o card sem consentimento foi repintado', !!repintado && !repintado.getAttribute('data-prova'));
  ok('e continua SEM link de WhatsApp depois da troca cirurgica (invariante 16)',
     !!repintado && !repintado.querySelector('[data-wa-lead]')
     && repintado.textContent.indexOf('Sem consentimento') >= 0);
  ok('e nenhuma sugestao foi pedida para lead sem consentimento',
     window.__rpcChamadas.filter(function (r) { return r.nome === 'sugerir_mensagem'; }).length === 0,
     window.__rpcChamadas.map(function (r) { return r.nome; }).join(','));
  }

  // ---- aba que nao e de lead nao pode baixar a base de leads ----
  document.getElementById('abaEscopo').click();
  await espera(300);
  window.__fromChamadas.length = 0; window.__rpcChamadas.length = 0;
  var piscou2 = false;
  var obsE = new MutationObserver(function () {
    if (document.querySelector('#lista .estado.carregando')) piscou2 = true; });
  obsE.observe(document.getElementById('lista'), { childList: true, subtree: true });
  document.querySelector('#lista [data-acao="esc-status"]').click();
  await espera(420);
  obsE.disconnect();
  ok('acao no Escopo NAO baixa a base de leads (antes baixava v_lead inteira)',
     window.__fromChamadas.filter(function (x) { return x === 'v_lead'; }).length === 0,
     window.__fromChamadas.join(','));
  ok('acao no Escopo NAO pisca a lista (antes eram DOIS apagoes por clique)', !piscou2);

  // ---- Hoje: marcar tarefa mexe na linha, nao no dia inteiro ----
  document.getElementById('abaHoje').click();
  await espera(320);
  var celRot = document.querySelector('#lista .pb-celula[data-cel="rotina"]');
  ok('a celula do placar tem chave por CODIGO (data-cel), nao pelo rotulo exibido',
     !!celRot);
  var tf = document.querySelector('#lista [data-acao="dia-marcar"]');
  if (celRot && tf) {
  // Um bloco anterior desta mesma suite ja marcou esta tarefa, entao aqui o
  // clique DESMARCA. A assercao e sobre VIRAR, nao sobre virar para 'true':
  // fixar o valor esperado faria a prova depender da ordem dos blocos.
  var checkAntes = tf.getAttribute('aria-checked');
  var peAntes = celRot.querySelector('.pb-pe').textContent;
  window.__rpcChamadas.length = 0; window.__fromChamadas.length = 0;
  tf.click();
  await espera(400);
  ok('marcar tarefa NAO rele painel_do_dia (o dia inteiro era remontado)',
     window.__rpcChamadas.filter(function (r) { return r.nome === 'painel_do_dia'; }).length === 0,
     window.__rpcChamadas.map(function (r) { return r.nome; }).join(','));
  ok('marcar tarefa custa 1 chamada: a propria RPC',
     window.__rpcChamadas.length + window.__fromChamadas.length === 1,
     'rpc=' + window.__rpcChamadas.length + ' from=' + window.__fromChamadas.length);
  ok('o checkbox daquela linha virou', tf.getAttribute('aria-checked') !== checkAntes,
     checkAntes + ' -> ' + tf.getAttribute('aria-checked'));
  ok('e a linha e o MESMO no do DOM (a linha nao foi remontada)',
     document.querySelector('#lista [data-acao="dia-marcar"]') === tf);
  ok('o placar do dia acompanhou',
     celRot.querySelector('.pb-pe').textContent !== peAntes,
     peAntes + ' -> ' + celRot.querySelector('.pb-pe').textContent);
  ok('e o placar e o MESMO no do DOM: nao houve remontagem',
     document.querySelector('#lista .pb-celula[data-cel="rotina"]') === celRot);
  }

  // ---- Insights com memoria de tempo (12/08/2026) ---------------------------
  // O card de Insights subiu no v53 SEM prova nenhuma: a suite inteira nao
  // mencionava .ins, e as 352 assercoes passaram sem encostar nele. Regra de
  // negocio sem guard-rail e regra que ninguem percebe quando quebra.
  //
  // Tudo aqui sai do PROPRIO fixture, nunca de numero cravado: a janela do
  // dashboard depende de l(), e assercao com "agosto" dentro fica vermelha
  // sozinha em setembro sem nada ter quebrado. A conta por fora e a SEGUNDA
  // conta: se ela e a do app divergirem, uma das duas esta errada.
  document.getElementById('abaDash').click();
  await espera(220);

  function mesMais(ym, n) {
    var an = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10) - 1 + n;
    an += Math.floor(m / 12); m = (m % 12 + 12) % 12;
    var mm = String(m + 1);
    return an + '-' + (mm.length < 2 ? '0' + mm : mm);
  }
  function diasNoMes(ym) {
    return new Date(parseInt(ym.slice(0, 4), 10), parseInt(ym.slice(5, 7), 10), 0).getDate();
  }
  function agregEntre(ini, fim) {
    var r = { n: 0, fat: 0, luc: 0 };
    VENDAS_STUB.forEach(function (v) {
      if (v.status === 'cancelada') return;
      var d = String(v.data_venda || '').slice(0, 10);
      if (!d || d < ini || d > fim) return;
      r.n++; r.fat += Number(v.valor_venda) || 0; r.luc += Number(v.lucro) || 0;
    });
    return r;
  }
  function insLista() {
    return [].map.call(document.querySelectorAll('#lista .c-ins .ins li'), function (li) {
      return { tom: li.getAttribute('data-ins'), tit: li.querySelector('b').textContent,
               txt: li.querySelector('em').textContent };
    });
  }
  function insCom(pref) {
    var t = insLista(), j;
    for (j = 0; j < t.length; j++) if (t[j].tit.indexOf(pref) === 0) return t[j];
    return null;
  }
  function insCard() { return document.querySelector('#lista .c-ins'); }

  var hojeH = window.PitWall.hojeLocalISO(), ymH = hojeH.slice(0, 7);
  ok('o Dashboard renderizou UM card de Insights',
     document.querySelectorAll('#lista .c-ins').length === 1,
     'n=' + document.querySelectorAll('#lista .c-ins').length);
  ok('Insights nunca sai vazio', insLista().length > 0, 'n=' + insLista().length);

  // Trimestre e a janela padrao; o anterior dela vai de mes-5 ao fim de mes-3.
  var mAnt3 = mesMais(ymH, -3);
  var triAnt = agregEntre(mesMais(ymH, -5) + '-01', mAnt3 + '-' + diasNoMes(mAnt3));
  ok('sem venda no periodo anterior o card DIZ que nao ha base, em vez de calar',
     triAnt.n > 0 || insCard().textContent.indexOf('base para comparar') >= 0,
     'vendas no trimestre anterior=' + triAnt.n);

  var btnMes = document.querySelector('#lista [data-acao="dv-janela"][data-id="mes"]');
  ok('a janela Mes existe no cabecalho do dashboard', !!btnMes);
  btnMes.click();
  await espera(220);

  var ymAnt = mesMais(ymH, -1);
  var atu = agregEntre(ymH + '-01', ymH + '-' + diasNoMes(ymH));
  var pre = agregEntre(ymAnt + '-01', ymAnt + '-' + diasNoMes(ymAnt));
  var dec = parseInt(hojeH.slice(8, 10), 10), tot = diasNoMes(ymH), parcial = dec < tot;

  if (pre.n && pre.fat > 0 && atu.fat > 0) {
    var dm = (100 * atu.luc / atu.fat) - (100 * pre.luc / pre.fat);
    var mIns = insCom('Margem ');
    ok('a regra de margem concorda com a conta feita por fora',
       (Math.abs(dm) >= 3) === !!mIns,
       'diferenca=' + dm.toFixed(1) + ' p.p., card ' + (mIns ? 'mostrou' : 'nao mostrou'));
    if (mIns) ok('a margem aponta para o lado certo',
       mIns.tom === (dm < 0 ? 'ruim' : 'bom'), 'tom=' + mIns.tom + ' d=' + dm.toFixed(1));
  }

  // O nucleo da fatia: janela em curso NAO se compara pelo total bruto. Sem
  // isto, todo dia 2 do mes o card grita "faturamento despencou 90%", que e o
  // calendario falando, nao o negocio.
  if (pre.fat > 0 && pre.n && parcial) {
    var bruto = 100 * (atu.fat - pre.fat) / pre.fat;
    var base = pre.fat / diasNoMes(ymAnt), ritmo = 100 * ((atu.fat / dec) - base) / base;
    var fIns = insCom('Faturamento ');
    ok('janela pela metade NAO e comparada pelo total bruto',
       !fIns || fIns.txt.indexOf('ritmo por dia') >= 0,
       fIns ? fIns.txt.slice(0, 90) : 'sem insight de faturamento');
    ok('o alarme falso do calendario nao dispara: bruto passa do corte, ritmo nao',
       !(Math.abs(bruto) >= 25 && Math.abs(ritmo) < 25) || !fIns,
       'bruto=' + bruto.toFixed(1) + '% ritmo=' + ritmo.toFixed(1) + '%');
    ok('e quando o RITMO passa do corte, o insight aparece',
       Math.abs(ritmo) < 25 || !!fIns, 'ritmo=' + ritmo.toFixed(1) + '%');
    // A faixa de KPI do topo compara total contra total e marca a queda bruta.
    // Se o card apenas silenciasse, a tela teria duas contas do mesmo numero
    // sem explicacao. Quando ele silencia o alarme, tem que dizer por que.
    if (Math.abs(bruto) >= 25 && Math.abs(ritmo) < 25) {
      var cIns = insCom('A queda de ') || insCom('A alta de ');
      ok('quando o card discorda da faixa do topo, ele EXPLICA a divergencia',
         !!cIns && cIns.txt.indexOf('ritmo por dia') >= 0,
         cIns ? cIns.tit + ' | ' + cIns.txt.slice(0, 70) : 'nao explicou');
    }
  }

  var ldA = 0, ldB = 0;
  LEADS.forEach(function (x) {
    if (x.arquivado_em) return;
    var d = window.PitWall.dataLocalDe(x.criado_em);
    if (!d) return;
    if (d.slice(0, 7) === ymH && d <= hojeH) ldA++;
    if (d.slice(0, 7) === ymAnt) ldB++;
  });
  if (ldB > 0 && pre.n) {
    var lA = parcial ? ldA / dec : ldA, lB = parcial ? ldB / diasNoMes(ymAnt) : ldB;
    var vl = 100 * (lA - lB) / lB, lIns = insCom('Entrada de leads ');
    ok('a regra de entrada de leads concorda com a contagem por fora',
       (Math.abs(vl) >= 30) === !!lIns,
       'variacao=' + vl.toFixed(1) + '%, card ' + (lIns ? 'mostrou' : 'nao mostrou'));
  }

  var lst = insLista(), viuBom = false, ordOk = true, j4;
  for (j4 = 0; j4 < lst.length; j4++) {
    if (lst[j4].tom === 'bom') viuBom = true;
    else if (viuBom) ordOk = false;
  }
  ok('o que exige acao vem antes do elogio', ordOk,
     lst.map(function (x) { return x.tom; }).join(','));
  ok('a lista de insights tem teto de 6', lst.length <= 6, 'n=' + lst.length);
  ok('todo insight tem titulo e corpo, nunca bolinha solta',
     lst.length > 0 && lst.every(function (x) { return x.tit.length > 0 && x.txt.length > 0; }));

  fim();

}
function fim() {
  var d = document.getElementById('RESULTADO');
  if (!d) { d = document.createElement('pre'); d.id = 'RESULTADO'; document.body.appendChild(d); }
  d.textContent = window.__log.join('\\n');
}
// Watchdog. Sem ele, um await que nunca resolve nao vira falha: vira DOM sem
// <pre id=RESULTADO>, e o lado Python so sabe dizer "nao chegou ao fim", sem a
// linha onde parou. Suite que trava calada custa mais que suite vermelha.
setTimeout(function () {
  if (document.getElementById('RESULTADO')) return;
  window.__log.push('FALHOU  a suite TRAVOU: rodar() nao terminou nem estourou. '
    + 'A ultima linha acima e o ultimo ponto que executou.');
  fim();
}, 30000);
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
                      # 25000 acabou em 08/08/2026: as ~25 esperas do bloco de
                      # entrega estouraram o orcamento e o DOM saia ANTES do
                      # <pre id=RESULTADO>, o que o lado Python le como "nao
                      # chegou ao fim" (nao como falha de assercao). Orcamento e
                      # tempo VIRTUAL: subir nao deixa a suite mais lenta.
                      f'--user-data-dir={perfil}', '--virtual-time-budget=60000',
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
