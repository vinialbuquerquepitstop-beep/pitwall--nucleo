# prova_alimentar.py — assere a tela ALIMENTAR (public/calc/alimentar/index.html).
#
#   python ferramentas/prova_alimentar.py
#
# Confere o EXIT CODE, nunca o texto.
#
# Criada em 12/09/2026 junto com a tela (Bloco 2.3 do plano). Abre o ARQUIVO REAL
# no Chrome headless, com o supabase-js trocado por um STUB, e CLICA: le o DOM
# renderizado depois de cada acao. Nao escreve em producao, e nao pode: o stub
# nao tem rede. Prova que copia a logica prova a si mesma; esta executa a tela.
#
# O stub nao usa valor real (PROCESSO 5.1): fornecedores `Loja Alfa`, `Loja Beta`,
# precos inventados. Ele filtra linha por `eq`/`neq` de verdade e PROJETA as
# colunas do `select`, entao a tela ve so o que a consulta dela pede: coluna
# esquecida no select vira funcionalidade ausente na prova, como no banco.
#
# 13/09/2026, RESPONDER EM LOTE: a resposta passou a ser ANOTADA
# (`calc_pendencia_anotar`) e o lote aplicado numa releitura so
# (`calc_carga_reler`). O stub segue o contrato: `ignorar` sobre pergunta aberta
# vale na hora; o reler recusa o `apontar` do p3 (a pergunta continua na leitura),
# e com `window.__RELER_LENTA` devolve 57014. E o card mostra o CONTEXTO da
# pendencia no bruto (a linha que abre a mensagem e a linha alvo).
#
# O que ela cobra, e cada grupo e uma trava do plano ou uma obrigacao dos
# handoffs v12, v13 e v14:
#   - os textos obrigatorios (cobertura `casaram X de Y linhas (Z%)`, linhas que
#     nao entraram, descarte contado, custo velho acima de 7 dias);
#   - os verbos por tipo de pendencia, iguais ao que as RPCs aceitam;
#   - D16 por extenso e a grafia; D14 com a sugestao pre-selecionada;
#   - a guarda de quase-igual (2.4a ter) virando pergunta, e nao erro cru;
#   - a decisao GRAVADA manda (ignorada segue respondivel, apontada nao);
#   - resposta anotada nao aplica, trava o aprovar, e o reler e tudo ou nada;
#   - o contexto da pendencia, escapado;
#   - D19: aprendido pelo MOTIVO, nunca pelo padrao; duas visoes; vazio com frase;
#   - o aprovar so acende com as travas conferidas;
#   - nada de tenant_id no cliente, nada de escrita fora de RPC, texto escapado;
#   - geometria em 360px: sem estouro horizontal.
import json
import pathlib
import re
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding='utf-8')
RAIZ = pathlib.Path(__file__).resolve().parent.parent

fonte = (RAIZ / 'ferramentas' / 'harness.py').read_text(encoding='utf-8')
corte = fonte.index('# ---- o teste:')
ns = {'__file__': str(RAIZ / 'ferramentas' / 'harness.py')}
exec(compile(fonte[:corte], 'harness.py[preambulo]', 'exec'), ns)
CHROME = ns['CHROME']
if not CHROME:
    print('SEM CHROME: INCONCLUSIVO.')
    sys.exit(2)

# PROVA_ALIMENTAR_ALVO existe so para o teste de mutacao (estragar uma COPIA e
# ver a prova reprovar). A suite roda sem ela, contra o arquivo real.
import os
ALVO = pathlib.Path(os.environ.get('PROVA_ALIMENTAR_ALVO') or (RAIZ / 'public' / 'calc' / 'alimentar' / 'index.html'))
html = ALVO.read_text(encoding='utf-8')

falhas, total = [], 0
def ok(nome, cond):
    global total
    total += 1
    print(('  ok    ' if cond else '  FALHA ') + nome)
    if not cond:
        falhas.append(nome)

# ── estatico: o que a tela NUNCA pode ter ───────────────────────────────────
print('— estatico —')
script = html[html.index("<script>\n'use strict'"):]
ok('nenhuma escrita direta em tabela (.insert/.update/.upsert/.delete)',
   not re.search(r'\.(insert|update|upsert|delete)\(', script))
ok('nenhum tenant_id no cliente', 'tenant_id' not in script)
RPCS = {'calc_carga_abrir', 'calc_pendencia_anotar', 'calc_carga_reler', 'calc_carga_aprovar', 'calc_carga_descartar'}
ok('as cinco RPCs sao as unicas escritas (anotar e reler; resolver e criar sairam da tela)  %s'
   % sorted(set(re.findall(r"sb\.rpc\('([a-z_]+)'", script))),
   set(re.findall(r"sb\.rpc\('([a-z_]+)'", script)) == RPCS)
ok('usa a MESMA sessao da calc (storageKey sb-calc-auth)', "storageKey:'sb-calc-auth'" in script)
ok('nao chama alert/confirm/prompt (bloqueiam a tela)',
   not re.search(r'\b(alert|confirm|prompt)\(', script))
ok('a regra aprendida nao le a coluna padrao', 'padrao' not in
   re.search(r"\['regra','calc_regra','([^']*)'\]", script).group(1))
ok('o arquivo da tela nao tem caractere nulo nem U+FFFD literal', '\x00' not in html and '�' not in html)
ok('o input aceita .zip (o export do WhatsApp vem zipado)', '.zip' in re.search(r'id="aArq" accept="([^"]*)"', html).group(1))
ok('a calc do dono tem o link para a tela',
   'href="/calc/alimentar/"' in (RAIZ / 'public' / 'calc' / 'index.html').read_text(encoding='utf-8'))

# ── o stub ───────────────────────────────────────────────────────────────────
STUB = r"""
(function(){
  var CEN = window.name || 'S2';
  var LOG = window.__LOG = [];
  var CARGA = 'c-0001', OUTRA = 'c-0000';
  function P(f,n,t,v){ return {n:n,c:'iPhone',t:t,f:f,l:'x',v:v}; }
  var velho = [P('Loja Alfa','iPhone 16 128GB','Lacrado',4000), P('Loja Alfa','iPhone 15 128GB','Lacrado',3000),
               P('Loja Alfa','iPhone 14 128GB','Seminovo',2000), P('Loja Gama','iPhone 13 128GB','Seminovo',1500)];
  // iPhone 14 128GB Seminovo cai de 2000 para 95: e a bateria da primeira lista
  // real lida como preco, e tem que cair no card de QUEDA FORTE, nao nas variacoes.
  var novo  = [P('Loja Alfa','iPhone 16 128GB','Lacrado',4100), P('Loja Alfa','iPhone 15 128GB','Lacrado',3600),
               P('Loja Alfa','iPhone 17 256GB','Lacrado',7000), P('Loja Gama','iPhone 13 128GB','Seminovo',1500),
               P('Loja Alfa','iPhone 14 128GB','Seminovo',95)];
  // 20 dias antes de HOJE em Sao Paulo, o mesmo fuso que a tela usa: com a data
  // em UTC a prova daria 19 dias entre 21h e meia-noite.
  var hp = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date()).split('-');
  var d20 = new Date(Date.UTC(+hp[0],+hp[1]-1,+hp[2]) - 20*86400000);
  var dStr = ('0'+d20.getUTCDate()).slice(-2)+'/'+('0'+(d20.getUTCMonth()+1)).slice(-2)+'/'+d20.getUTCFullYear();
  // A lista bruta, com CRLF (o leitor quebra por \r?\n, e a tela tem que quebrar igual).
  // Linha 7 e hostil de proposito: o contexto tem que sair escapado.
  var BRUTO = [
    '['+dStr+', 09:00:00] Vini: Loja Alfa',                   // 1
    'TABELA DE HOJE',                                          // 2
    'iPhone 16 128GB Preto Lacrado - 4.100',                   // 3
    'iPhone 15 128GB Lacrado - 3.600',                         // 4
    'iPhone 14 128GB Seminovo 95% - 95',                       // 5
    'verde menta 128GB - 1.700',                               // 6
    'poco f8 pro <img src=x onerror="window.__XSS2=1"> - 1.900', // 7
    'iPhone 13 128 gb - 1.500',                                // 8
    'linha nove','linha dez','linha onze','linha doze','linha treze','linha catorze', // 9-14
    'iPhone 16 128GB Preto Lacrado - 300',                     // 15
    '',                                                        // 16
    '['+dStr+', 10:00:00] Vini: TABELA XPTO IMPORTS',          // 17
    '12x no cartao sem juros',                                 // 18
    'iPhone 17 256GB Lacrado - 7.000'                          // 19
  ].join('\r\n');
  var cargaRow = {id:CARGA,status:'rascunho',criado_em:'2026-09-12T12:00:00Z',
    texto_bruto:BRUTO,
    // n_pendencia 3 contra 5 sem resposta na tabela: e o descompasso que a tela declara.
    n_lidas:16,n_casou:11,n_duvidoso:4,n_descarte:2,n_pendencia:3,
    blob_proposto:{config:{},bateria:[],tela:[],produtos:novo},
    resumo:{produtos_novos:3,produtos_mantidos:1,fornecedores_lidos:['Loja Alfa'],
      descartes:[{motivo:'caixa aberta, decisao do dono',n_linhas:2,exemplo:'iPhone 16 Pro caixa aberta - 6.100'}],
      cabecalhos:[{papel:'forn',texto:'LOJA ALFA',fornecedor:'loja_alfa',n_linhas:9}],
      fornecedor_conferir:[{cabecalho:'LOJA ALFA',fornecedor:'Loja Alfa',n_linhas:9,suspeita_alta:true,ignoradas:['TABELA XPTO IMPORTS']}],
      n_cond_respondida:0,n_do_cabecalho:2,n_cor_vizinha:0,n_cond_conflito:0}};
  function pend(id,tipo,texto,dec,aponta,n,x){
    return Object.assign({id:id,carga_id:CARGA,tipo:tipo,texto:texto,causa:'causa de '+tipo,exemplo:'exemplo '+texto,n_linhas:n||1,
      decisao:dec||null,aponta:aponta||null,decidido_em:dec?'2026-09-12T12:30:00Z':null,criado_em:'2026-09-12T12:00:0'+id.slice(-1)+'Z',
      linha:null,rascunho:null,rascunho_erro:null}, x||{});
  }
  var T = {
    app_usuario: [{id:'u1', papel: CEN==='S3' ? 'vendedor' : 'dono'}],
    calc_modelo: [{codigo:'iphone_13_128gb',nome:'iPhone 13 128GB',categoria:'iPhone',origem:'semente',carga_id:null,criado_em:'2026-09-01T00:00:00Z'},
                  {codigo:'jbl_flip_7',nome:'JBL Flip 7',categoria:'JBL',origem:'aprendizado',carga_id:OUTRA,criado_em:'2026-09-10T10:00:00Z'}],
    calc_cor: [{codigo:'verde',nome:'Verde',origem:'semente',carga_id:null,criado_em:'2026-09-01T00:00:00Z'}],
    calc_fornecedor: [{codigo:'loja_alfa',nome:'Loja Alfa',praca:'Centro — RJ',origem:'semente',carga_id:null,criado_em:'2026-09-01T00:00:00Z'},
                      {codigo:'loja_beta',nome:'Loja Beta',praca:'Norte — RJ',origem:'aprendizado',carga_id:OUTRA,criado_em:'2026-09-11T10:00:00Z'}],
    calc_regra: [{tipo:'condicao',valor:'Lacrado',ativo:true,origem:'semente'},{tipo:'condicao',valor:'Seminovo',ativo:true,origem:'semente'},
                 {tipo:'condicao',valor:'CPO',ativo:true,origem:'semente'},{tipo:'condicao',valor:'Novo',ativo:false,origem:'semente'},
                 {tipo:'descarte',padrao:'^fabrica zeta$',motivo:'fornecedor descartado pelo dono em 12/09/2026: Fábrica Zeta',escopo:'fornecedor',ativo:true,origem:'aprendizado',carga_id:CARGA,criado_em:'2026-09-12T12:20:00Z'}],
    calc_alias: [{tipo:'modelo',texto:'iphone 13 128 gb',aponta:'iphone_13_128gb',origem:'aprendizado',carga_id:CARGA,criado_em:'2026-09-12T12:10:00Z'}],
    calc_dados: [{dados:{produtos:velho},atualizado_em:'2026-08-17T23:20:02Z'}],
    calc_carga: (CEN==='S1') ? [] : [cargaRow],
    calc_pendencia: [
      pend('p1','fornecedor','TABELA XPTO IMPORTS',null,null,1,{linha:17}),
      // sem `linha` e com um exemplo que nao esta no bruto: fica o <code class="ex">
      pend('p2','condicao','loja_alfa'),
      // sem `linha` (carga antiga): o contexto sai pela 1a linha que contem o exemplo
      pend('p3','modelo','poco f8 pro <img src=x onerror="window.__XSS=1">',null,null,1,{exemplo:'  poco f8 pro <img src=x onerror="window.__XSS2=1"> - 1.900 '}),
      pend('p4','cor','verde menta','ignorar',null,2,{linha:6}),
      pend('p5','preco','preco com condicao pendurada: a calc nao tem onde guardar condicao',null,null,1,{linha:18}),
      pend('p7','preco','abaixo da tabela: Loja Alfa · iPhone 16 128GB · Lacrado · Preto · R$ 300,00',null,null,1,{linha:15}),
      pend('p6','modelo','iphone 13 128 gb','apontar','iphone_13_128gb',3,{linha:8}),
      {id:'p9',carga_id:OUTRA,tipo:'condicao',texto:'loja_alfa',causa:'x',exemplo:'x',n_linhas:1,decisao:'definir',aponta:'Lacrado',decidido_em:'2026-09-05T10:00:00Z',criado_em:'2026-09-05T09:00:00Z',linha:null,rascunho:null,rascunho_erro:null}
    ]
  };
  if (CEN==='S1') { T.calc_carga=[]; T.calc_regra = T.calc_regra.filter(function(r){return r.tipo==='condicao';}); T.calc_alias=[]; T.calc_modelo.pop(); T.calc_fornecedor.pop(); T.calc_pendencia=[]; }
  function filtra(q){
    var rows = (T[q.table]||[]).filter(function(r){
      return q.f.every(function(f){ return f[0]==='eq' ? r[f[1]]===f[2] : r[f[1]]!==f[2]; });
    });
    if (q.ord) { var c=q.ord[0], asc=!(q.ord[1]&&q.ord[1].ascending===false);
      rows = rows.slice().sort(function(a,b){ var x=String(a[c]), y=String(b[c]); return asc ? x.localeCompare(y) : y.localeCompare(x); }); }
    if (q.lim) rows = rows.slice(0,q.lim);
    // PROJECAO pelo select, como o PostgREST: a tela recebe so as colunas que pediu.
    // E copia: a tela apaga texto_bruto da carga que recebe, e o stub nao pode perder a fonte.
    var cols = (q.sel && q.sel!=='*') ? q.sel.split(',').map(function(s){return s.trim();}) : null;
    rows = rows.map(function(r){
      if (!cols) return Object.assign({}, r);
      var o={}; cols.forEach(function(k){ if (k in r) o[k]=r[k]; }); return o;
    });
    return q.single ? {data: rows[0]||null, error:null} : {data: rows, error:null};
  }
  function from(table){
    var q={table:table,f:[],ord:null,lim:null,single:false,sel:null};
    var api={
      select:function(s){q.sel=s;return api;}, eq:function(c,v){q.f.push(['eq',c,v]);return api;},
      neq:function(c,v){q.f.push(['neq',c,v]);return api;}, order:function(c,o){q.ord=[c,o];return api;},
      limit:function(n){q.lim=n;return api;}, maybeSingle:function(){q.single=true;return api;},
      then:function(a,b){ LOG.push({t:'from',table:table,sel:q.sel,f:q.f}); return Promise.resolve(filtra(q)).then(a,b); }
    };
    return api;
  }
  function daPend(id){ return T.calc_pendencia.filter(function(x){return x.id===id;})[0]; }
  function rpc(nome,args){
    LOG.push({t:'rpc',nome:nome,args:JSON.parse(JSON.stringify(args))});
    var r = {data:null,error:null};
    if (nome==='calc_carga_abrir') {
      // o que o banco devolveu na primeira lista completa (375 KB, 12/09/2026)
      if (String(args.p_texto).indexOf('LENTA')>=0) r.error={code:'57014',message:'canceling statement due to statement timeout'};
      else { T.calc_carga=[cargaRow]; r.data=CARGA; }
    }
    if (nome==='calc_pendencia_anotar') {
      var p = daPend(args.p_pendencia);
      if (!p) r.error={message:'calc_pendencia_anotar: pendencia nao encontrada neste tenant'};
      else if (args.p_decisao==null) { p.rascunho=null; p.rascunho_erro=null; r.data={anotada:false,aplicada:false}; }
      // as recusas do ENSAIO chegam na hora, com o prefixo da RPC que recusou
      else if (args.p_decisao==='descartar' && p.id==='p3') r.error={message:'calc_pendencia_resolver: "poco" nao aparece em nenhuma linha desta lista, entao a regra de descarte nunca casaria nada. Nada foi gravado.'};
      else if (args.p_decisao==='criar' && p.tipo==='fornecedor' && !(args.p_extra&&args.p_extra.confirmar_novo))
        r.error={message:'calc_catalogo_criar: voce ja tem Loja Alfa (codigo loja_alfa) e a lista traz "Loja Alfa Distribuidora". Se for a mesma pessoa, use apontar para o codigo dela. Se for outro fornecedor mesmo, repita com {"confirmar_novo":"sim"}. Nada foi gravado.'};
      else if (args.p_decisao==='ignorar' && (p.decisao==null || p.decisao==='ignorar')) {
        p.decisao='ignorar'; p.aponta=null; p.decidido_em='2026-09-13T12:50:00Z'; p.rascunho=null; p.rascunho_erro=null;
        r.data={anotada:false,aplicada:true};
      } else {
        p.rascunho={decisao:args.p_decisao,aponta:args.p_aponta,extra:args.p_extra||{},em:'2026-09-13T12:55:00Z'}; p.rascunho_erro=null;
        r.data={anotada:true,aplicada:false};
      }
    }
    if (nome==='calc_carga_reler') {
      if (window.__RELER_LENTA) r.error={code:'57014',message:'canceling statement due to statement timeout'};
      else {
        var an = T.calc_pendencia.filter(function(x){ return x.carga_id===args.p_carga && x.rascunho!=null; })
                  .sort(function(a,b){ return String(a.criado_em).localeCompare(String(b.criado_em)); });
        // G3: apontar "poco f8 pro" para um iPhone nao tira a pergunta da leitura.
        var fal = an.filter(function(x){ return x.id==='p3' && x.rascunho.decisao==='apontar'; }).map(function(x){
          return {id:x.id, erro:'esta resposta nao ensina nada ao leitor: "'+x.texto+'" continua pendente depois de reler a lista. Deixe fora desta lista, ou tire a resposta.'}; });
        an.forEach(function(x){ x.rascunho_erro=null; });
        if (fal.length) {
          fal.forEach(function(f){ daPend(f.id).rascunho_erro=f.erro; });
          r.data={ok:false,aplicadas:0,falhas:fal};
        } else {
          var antes = cargaRow.n_casou;
          an.forEach(function(x){
            var d=x.rascunho; x.decisao=d.decisao; x.decidido_em='2026-09-13T13:05:00Z';
            if (d.decisao==='criar') {
              var cod=String(d.aponta).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
              x.aponta=cod;
              if (x.tipo==='fornecedor') T.calc_fornecedor.push({codigo:cod,nome:d.aponta,praca:(d.extra||{}).praca||'',origem:'aprendizado',carga_id:CARGA,criado_em:'2026-09-13T13:05:00Z'});
              else T.calc_modelo.push({codigo:cod,nome:d.aponta,categoria:(d.extra||{}).categoria||'',origem:'aprendizado',carga_id:CARGA,criado_em:'2026-09-13T13:05:00Z'});
            } else x.aponta=d.aponta;
            x.rascunho=null;
            if (d.decisao!=='ignorar') cargaRow.n_casou++;
          });
          r.data={ok:true,aplicadas:an.length,n_casou_antes:antes,n_casou:cargaRow.n_casou,n_lidas:cargaRow.n_lidas,reprocessou:true};
        }
      }
    }
    if (nome==='calc_carga_aprovar') { cargaRow.status='aprovada'; T.calc_carga=[]; r.data={carga:CARGA,produtos:4,precos:4,soma:16200,pendencias_abertas:3}; }
    if (nome==='calc_carga_descartar') { T.calc_carga=[]; }
    return Promise.resolve(r);
  }
  var sessao = CEN==='S4' ? null : {user:{id:'u1'}};
  window.supabase = { createClient: function(){ return {
    auth:{ getSession:function(){return Promise.resolve({data:{session:sessao}});},
           getUser:function(){return Promise.resolve({data:{user:sessao&&sessao.user}});},
           signInWithPassword:function(){return Promise.resolve({error:{message:'stub'}});} },
    from: from, rpc: rpc }; } };
})();
"""

# funcao, e nao string, na troca: string de reposicao interpreta o `\n` do stub.
pagina_real = re.sub(r'<script src="https?://[^"]*"></script>', lambda m: '<script>' + STUB + '</script>', html, count=1)
assert '<script>' + STUB in pagina_real, 'o stub nao entrou'

def frame(nome, larg):
    src = pagina_real.replace('&', '&amp;').replace('"', '&quot;')
    return '<iframe id="%s" name="%s" width="%d" height="900" srcdoc="%s"></iframe>' % (nome, nome, larg, src)

TESTE = r"""
(async function(){
  var R = {};
  function sl(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  async function ate(W, cond, ms){ for (var i=0;i<(ms||60);i++){ try{ if(cond()) return true; }catch(e){} await sl(50); } return false; }
  function F(id){ var f=document.getElementById(id); return {W:f.contentWindow, D:f.contentDocument}; }
  // Junta os nos de texto com espaco: `textContent` cola `<span>Loja Gama</span><span>1</span>`
  // em "Loja Gama1", e a assercao passaria a depender de markup, nao do que se le.
  function txt(el){
    if(!el) return '';
    var w=el.ownerDocument.createTreeWalker(el, 4), p=[], n;
    while((n=w.nextNode())) p.push(n.nodeValue);
    return p.join(' ').replace(/\s+/g,' ').replace(/\s+([.,;:)])/g,'$1').trim();
  }
  function vis(el){ return !!el && !el.closest('[hidden]'); }
  function clica(D, sel){ var e=D.querySelector(sel); if(e) e.click(); return !!e; }
  function rpcs(W, nome){ return W.__LOG.filter(function(x){return x.t==='rpc' && (!nome||x.nome===nome);}); }
  function anot(W, pred){ return (rpcs(W,'calc_pendencia_anotar').filter(function(x){return pred(x.args);})[0]||{}).args; }

  if (SO !== 'arquivo') {
  // ── S2: carga aberta ──────────────────────────────────────────────────────
  try {
  var s = F('S2'), W=s.W, D=s.D, o={};
  o.carregou = await ate(W, function(){ return vis(D.getElementById('s3')) && D.querySelectorAll('[data-pend]').length>=6; });
  o.cobertura = txt(D.getElementById('aCobertura'));
  o.s2 = txt(D.getElementById('s2Corpo'));
  o.velho = txt(D.getElementById('aVelho'));
  o.s1novaVisivel = vis(D.getElementById('s1Nova'));
  o.suspeita = !!D.querySelector('[data-suspeita] input[type=checkbox]');
  o.sub = txt(D.getElementById('s3Sub'));
  o.descompasso = txt(D.getElementById('aDescompasso'));
  o.loteOculto0 = !vis(D.getElementById('aLote'));
  function botoes(id){ return Array.prototype.map.call(D.querySelectorAll('[data-pend="'+id+'"] .bts .bt'), txt); }
  function card(id){ return txt(D.querySelector('[data-pend="'+id+'"]')); }
  function cab(id){ return txt(D.querySelector('[data-pend="'+id+'"] .cab')); }
  o.b = {p1:botoes('p1'),p2:botoes('p2'),p3:botoes('p3'),p4:botoes('p4'),p5:botoes('p5'),p6:botoes('p6'),p7:botoes('p7')};
  o.p7aviso = txt(D.getElementById('aAbaixo-p7'));
  o.p5temAviso = !!D.getElementById('aAbaixo-p5');

  // O CONTEXTO: linha a linha (textContent cru, para ver o CR que sobraria)
  function linhasCtx(id){ return Array.prototype.map.call(D.querySelectorAll('[data-pend="'+id+'"] .ctx .cl'), function(e){ return e.textContent.trim(); }); }
  function alvosCtx(id){ return Array.prototype.map.call(D.querySelectorAll('[data-pend="'+id+'"] .ctx .alvo'), function(e){ return e.textContent.trim(); }); }
  var alvo7 = D.querySelector('[data-pend="p7"] .ctx .alvo');
  o.ctx = {p1:linhasCtx('p1'), p3:linhasCtx('p3'), p7:linhasCtx('p7'),
    p1alvo:alvosCtx('p1'), p3alvo:alvosCtx('p3'), p7alvo:alvosCtx('p7'),
    p1ab: !!D.querySelector('[data-pend="p1"] .ctx .ab.alvo'),
    p7ab: (D.querySelector('[data-pend="p7"] .ctx .ab')||{}).textContent||'',
    p7h: txt(D.querySelector('[data-pend="p7"] .ctxh')),
    p3h: txt(D.querySelector('[data-pend="p3"] .ctxh')),
    p2temCtx: !!D.querySelector('[data-pend="p2"] .ctx'), p2ex: txt(D.querySelector('[data-pend="p2"] code.ex')),
    p3temEx: !!D.querySelector('[data-pend="p3"] code.ex'), p7temEx: !!D.querySelector('[data-pend="p7"] code.ex'),
    cr: Array.prototype.some.call(D.querySelectorAll('.ctx'), function(e){ return e.textContent.indexOf('\r')>=0; }),
    peso: alvo7 ? W.getComputedStyle(alvo7).fontWeight : '',
    fundoAlvo: alvo7 ? W.getComputedStyle(alvo7).backgroundColor : '',
    ws: alvo7 ? W.getComputedStyle(alvo7.parentNode).whiteSpace : ''};

  // D20: confirmar o preco abaixo da tabela ANOTA o verbo certo, sem destino, e nao rele
  clica(D, '[data-pend="p7"] [data-verbo=confirmar]'); await sl(50);
  o.p7form = txt(D.querySelector('[data-pend="p7"] .form'));
  clica(D, '[data-pend="p7"] [data-acao=confirmar][data-verbo=confirmar]');
  await ate(W, function(){ return card('p7').indexOf('anotada:')>=0; });
  o.p7rpc = anot(W, function(a){ return a.p_pendencia==='p7'; });
  o.p7toast = txt(D.getElementById('toast'));
  o.p7anotado = card('p7');
  o.p7cab = cab('p7');
  o.p7botoesAnotado = botoes('p7');
  o.relerAposResponder = rpcs(W,'calc_carga_reler').length;
  o.resolverOuCriar = rpcs(W).some(function(x){ return x.nome==='calc_pendencia_resolver' || x.nome==='calc_catalogo_criar'; });
  o.loteUm = txt(D.getElementById('aLote'));
  o.subUm = txt(D.getElementById('s3Sub'));

  o.p6 = card('p6');
  o.p4 = card('p4');
  o.xssImg = D.querySelectorAll('#s3Corpo img').length;
  o.xssTexto = txt(D.querySelector('[data-pend="p3"] .tx'));
  o.ordem = Array.prototype.map.call(D.querySelectorAll('[data-pend]'), function(e){return e.getAttribute('data-pend');});

  // aprendido: visao desta lista, e depois tudo
  o.aprLista = txt(D.getElementById('aAprendido'));
  clica(D, '[data-acao=visao][data-valor=tudo]'); await sl(50);
  o.aprTudo = txt(D.getElementById('aAprendido'));
  o.aprHtml = D.getElementById('aAprendido').innerHTML;

  // passo 4 antes das travas
  o.s4 = txt(D.getElementById('s4Corpo'));
  o.grandesLinhas = D.querySelectorAll('#aGrandes tbody tr').length;
  o.quedasLinhas = D.querySelectorAll('#aQuedas tbody tr').length;
  o.quedasTxt = txt(D.getElementById('aQuedas'));
  o.aprovarDesligado0 = D.getElementById('aAprovar').disabled;

  // D16: descartar fornecedor por extenso, com a grafia
  clica(D, '[data-pend="p1"] [data-verbo=descartar]'); await sl(50);
  o.d16 = txt(D.querySelector('[data-pend="p1"] .form'));

  // apontar sem escolher: erro na tela, e nenhuma RPC
  clica(D, '[data-pend="p3"] [data-verbo=apontar]'); await sl(50);
  var n0 = rpcs(W).length;
  clica(D, '[data-pend="p3"] [data-acao=confirmar]'); await sl(80);
  o.apontarVazioErro = txt(D.querySelector('[data-pend="p3"] .erro'));
  o.apontarVazioSemRpc = rpcs(W).length === n0;
  o.optgroup = D.querySelectorAll('[data-pend="p3"] optgroup').length;

  // recusa do ENSAIO aparece no card na hora, sem o prefixo da funcao
  clica(D, '[data-pend="p3"] [data-verbo=descartar]'); await sl(50);
  clica(D, '[data-pend="p3"] [data-acao=confirmar]');
  await ate(W, function(){ return txt(D.querySelector('[data-pend="p3"] .erro')).indexOf('nao aparece')>=0; });
  o.recusa = txt(D.querySelector('[data-pend="p3"] .erro'));
  o.recusaSemAnotada = card('p3').indexOf('anotada:')<0;

  // 2.4a ter: quase-igual vira pergunta, e "criar mesmo assim" manda confirmar_novo
  clica(D, '[data-pend="p1"] [data-verbo=criar]'); await sl(50);
  D.getElementById('fn-p1').value='Loja Alfa Distribuidora'; D.getElementById('fp-p1').value='Oeste — RJ';
  clica(D, '[data-pend="p1"] [data-acao=confirmar][data-verbo=criar]');
  await ate(W, function(){ return !!D.querySelector('[data-pend="p1"] [data-verbo=criarNovo]'); });
  o.quase = txt(D.querySelector('[data-pend="p1"] .form'));
  o.quaseNomeMantido = D.getElementById('fn-p1').value;
  clica(D, '[data-pend="p1"] [data-verbo=criarNovo]');
  await ate(W, function(){ return card('p1').indexOf('anotada:')>=0; });
  var cr = rpcs(W,'calc_pendencia_anotar').filter(function(x){ return x.args.p_decisao==='criar'; });
  o.criar1 = cr[0] && cr[0].args; o.criar2 = cr[1] && cr[1].args;
  o.p1anotado = card('p1');

  // D14: sugestao pre-selecionada, e o confirmar anota definir com ela
  clica(D, '[data-pend="p2"] [data-verbo=definir]'); await sl(60);
  o.condOn = txt(D.querySelector('[data-pend="p2"] .bt.on[data-acao=cond]'));
  o.condBotoes = Array.prototype.map.call(D.querySelectorAll('[data-pend="p2"] [data-acao=cond]'), txt);
  o.condSug = txt(D.querySelector('[data-pend="p2"] .form'));
  clica(D, '[data-pend="p2"] [data-acao=confirmar]');
  await ate(W, function(){ return card('p2').indexOf('anotada:')>=0; });
  o.definir = anot(W, function(a){ return a.p_decisao==='definir'; });
  o.p2anotado = card('p2');
  o.p2cab = cab('p2');

  // apontar de verdade: o codigo escolhido vai em p_aponta
  clica(D, '[data-pend="p3"] [data-verbo=apontar]'); await sl(50);
  D.getElementById('fa-p3').value = 'iphone_13_128gb';
  clica(D, '[data-pend="p3"] [data-acao=confirmar][data-verbo=apontar]');
  await ate(W, function(){ return card('p3').indexOf('anotada:')>=0; });
  o.apontar = anot(W, function(a){ return a.p_decisao==='apontar'; });
  o.p3anotado = card('p3');

  // ignorar sobre pergunta ABERTA vale na hora, sem reler
  var nR = rpcs(W,'calc_carga_reler').length;
  clica(D, '[data-pend="p5"] [data-verbo=ignorar]'); await sl(50);
  clica(D, '[data-pend="p5"] [data-acao=confirmar][data-verbo=ignorar]');
  await ate(W, function(){ return cab('p5').indexOf('fora desta lista')>=0; });
  o.ignorar = anot(W, function(a){ return a.p_decisao==='ignorar'; });
  o.p5cab = cab('p5');
  o.p5anotada = card('p5').indexOf('anotada:')>=0;
  o.ignorarToast = txt(D.getElementById('toast'));
  o.ignorarSemReler = rpcs(W,'calc_carga_reler').length === nR;

  // a barra do lote, com 4 anotadas (p7, p1, p2, p3)
  o.sub4 = txt(D.getElementById('s3Sub'));
  o.lote4 = txt(D.getElementById('aLote'));
  o.loteVisivel = vis(D.getElementById('aLote'));
  o.relerBotao = txt(D.getElementById('aReler'));
  o.lotePos = W.getComputedStyle(D.getElementById('aLote')).position;
  o.relerNenhum = rpcs(W,'calc_carga_reler').length;
  o.chipsAnotada = Array.prototype.map.call(D.querySelectorAll('#s3Corpo .chip.anot'), txt);
  var dd = D.documentElement; o.estouroAnotadas = dd.scrollWidth - dd.clientWidth;

  // as travas do aprovar, com as anotadas ainda la
  var cxs = function(){ return D.querySelectorAll('input[data-conf]'); };
  o.nConf = cxs().length;
  var marca = function(k){ var e=D.querySelector('input[data-conf="'+k+'"]'); if(e){ e.checked=true; e.dispatchEvent(new W.Event('change',{bubbles:true})); } return !!e; };
  marca('grandes'); await sl(30); marca('abertas'); await sl(30);
  o.aprovarDesligadoSemQueda = D.getElementById('aAprovar').disabled;
  o.faltaQueda = txt(D.getElementById('aTravas'));
  marca('quedas'); await sl(30);
  o.aprovarDesligadoSemSuspeita = D.getElementById('aAprovar').disabled;
  o.faltaSuspeita = txt(D.getElementById('aTravas'));
  marca('forn|LOJA ALFA|Loja Alfa'); await sl(30);
  o.aprovarDesligadoComAnotadas = D.getElementById('aAprovar').disabled;
  o.faltaAnotadas = txt(D.getElementById('aTravas'));

  // reler com o tempo esgotado: nada gravado, as anotadas ficam
  W.__RELER_LENTA = true;
  clica(D, '#aReler');
  await ate(W, function(){ return txt(D.getElementById('aErroLote')).length>0; });
  W.__RELER_LENTA = false;
  o.lentaLote = txt(D.getElementById('aErroLote'));
  o.lentaBarra = txt(D.getElementById('aLote'));
  o.lentaP7 = card('p7');

  // reler recusado: o p3 nao ensina nada, e NENHUMA grava
  clica(D, '#aReler');
  await ate(W, function(){ return txt(D.querySelector('[data-pend="p3"] [data-rascunho-erro]')).length>0; });
  o.recLote = txt(D.getElementById('aErroLote'));
  o.recCard = txt(D.querySelector('[data-pend="p3"] [data-rascunho-erro]'));
  o.recOutros = D.querySelectorAll('[data-rascunho-erro]').length;
  o.recP7 = card('p7'); o.recP7cab = cab('p7');
  o.recP2 = card('p2');
  o.recSub = txt(D.getElementById('s3Sub'));
  o.recAprovarDesligado = D.getElementById('aAprovar').disabled;

  // tirar a resposta culpada
  clica(D, '[data-pend="p3"] [data-acao=desanotar]');
  await ate(W, function(){ return card('p3').indexOf('anotada:')<0; });
  o.desanotar = anot(W, function(a){ return a.p_pendencia==='p3' && a.p_decisao===null; });
  o.tiradaBarra = txt(D.getElementById('aLote'));
  o.tiradaSemErro = !D.querySelector('[data-pend="p3"] [data-rascunho-erro]');

  // reler de novo: aplica as tres
  var catAntes = W.__LOG.filter(function(x){ return x.t==='from' && x.table==='calc_fornecedor' && x.sel==='codigo,nome,praca'; }).length;
  clica(D, '#aReler');
  await ate(W, function(){ return card('p7').indexOf('preço confirmado')>=0; });
  o.okToast = txt(D.getElementById('toast'));
  o.okP7 = card('p7'); o.okP7botoes = botoes('p7');
  o.okP2 = card('p2'); o.okP1 = card('p1');
  o.okLoteOculto = !vis(D.getElementById('aLote'));
  o.okSub = txt(D.getElementById('s3Sub'));
  o.okCatalogo = W.__LOG.filter(function(x){ return x.t==='from' && x.table==='calc_fornecedor' && x.sel==='codigo,nome,praca'; }).length > catAntes;
  o.okAnotadas = D.querySelectorAll('#s3Corpo .chip.anot').length;
  o.nReler = rpcs(W,'calc_carga_reler').length;
  o.relerArgs = (rpcs(W,'calc_carga_reler')[0]||{}).args;
  await sl(30);
  o.aprovarLigado = !D.getElementById('aAprovar').disabled;
  clica(D, '#aAprovar'); await sl(50);
  o.confirmaTexto = txt(D.getElementById('aTravas'));
  o.semRpcAntesDoSim = rpcs(W,'calc_carga_aprovar').length === 0;
  clica(D, '[data-acao=aprovarSim]');
  await ate(W, function(){ return vis(D.getElementById('aOk')); });
  o.aprovar = (rpcs(W,'calc_carga_aprovar')[0]||{}).args;
  o.ok = txt(D.getElementById('aOk'));
  o.depoisS1 = vis(D.getElementById('s1Nova'));

  o.rpcNomes = rpcs(W).map(function(x){ return x.nome; }).filter(function(n,i,a){ return a.indexOf(n)===i; }).sort();
  o.tenantEmConsulta = W.__LOG.some(function(x){ return JSON.stringify(x).indexOf('tenant_id')>=0; });
  o.xss = !!W.__XSS; o.xss2 = !!W.__XSS2;
  var d = D.documentElement; o.estouro = d.scrollWidth - d.clientWidth;
  R.S2 = o;
  } catch(e) { R.S2 = {erro: String(e && e.stack || e)}; }

  // ── S1: sem carga, e ler a lista ──────────────────────────────────────────
  try {
  var s1=F('S1'), W1=s1.W, D1=s1.D, p={};
  p.carregou = await ate(W1, function(){ return vis(D1.getElementById('s1Nova')) && txt(D1.getElementById('aAprendido')).length>0; });
  p.s2oculto = !vis(D1.getElementById('s2')); p.s4oculto = !vis(D1.getElementById('s4'));
  p.apr = txt(D1.getElementById('aAprendido'));
  p.status = txt(D1.getElementById('aStatus'));
  p.semBotaoVisao = !D1.querySelector('[data-acao=visao]');
  clica(D1, '[data-acao=ler]'); await sl(60);
  p.vazioErro = txt(D1.getElementById('aErro1'));
  p.vazioSemRpc = rpcs(W1,'calc_carga_abrir').length===0;
  D1.getElementById('aTexto').value = 'Loja Alfa\u0000lixo';
  clica(D1, '[data-acao=ler]'); await sl(60);
  p.nuloErro = txt(D1.getElementById('aErro1'));
  p.nuloSemRpc = rpcs(W1,'calc_carga_abrir').length===0;
  // datas RELATIVAS a hoje em Sao Paulo: o corte de 7 dias depende do dia em que a prova roda
  function dRel(n){ var hp=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date()).split('-'); var d=new Date(Date.UTC(+hp[0],+hp[1]-1,+hp[2])-n*86400000); return ('0'+d.getUTCDate()).slice(-2)+'/'+('0'+(d.getUTCMonth()+1)).slice(-2)+'/'+d.getUTCFullYear(); }
  p.d20=dRel(20); p.d7=dRel(7); p.d2=dRel(2); p.d0=dRel(0);
  var LISTA = '['+p.d20+', 10:00:00] Vini: Loja Velha\niPhone 16 128GB - 3.000\n['+p.d2+', 10:00:00] Vini: Loja Alfa\niPhone 16 128GB - 4.000\n['+p.d0+', 11:00:00] Vini: x\n';
  var ta = D1.getElementById('aTexto');
  p.janelaPadrao = D1.getElementById('aJanela').value;
  // o tempo do banco esgotado: mensagem que diz o que fazer, e a lista fica na caixa
  ta.value = LISTA + 'LENTA\n';
  clica(D1, '[data-acao=ler]');
  await ate(W1, function(){ return txt(D1.getElementById('aErro1')).indexOf('grande demais')>=0; });
  p.lentaErro = txt(D1.getElementById('aErro1'));
  p.lentaFicou = ta.value.indexOf('LENTA')>=0;
  ta.value = LISTA;
  ta.dispatchEvent(new W1.Event('input',{bubbles:true})); await sl(30);
  p.datas = txt(D1.getElementById('aDatas'));
  var sel = D1.getElementById('aJanela');
  sel.value='0'; sel.dispatchEvent(new W1.Event('change',{bubbles:true})); await sl(30);
  p.datasTudo = txt(D1.getElementById('aDatas'));
  sel.value='7'; sel.dispatchEvent(new W1.Event('change',{bubbles:true})); await sl(30);
  clica(D1, '[data-acao=ler]');
  await ate(W1, function(){ return vis(D1.getElementById('s2')); });
  var abs = rpcs(W1,'calc_carga_abrir');
  p.nAbrir = abs.length;
  p.abrir = (abs[abs.length-1]||{}).args;
  p.lentaArgs = (abs[0]||{}).args;
  p.s2visivel = vis(D1.getElementById('s2'));
  p.textoLimpo = D1.getElementById('aTexto').value==='';
  R.S1 = p;
  } catch(e) { R.S1 = {erro: String(e && e.stack || e)}; }

  }
  if (SO !== 'arquivo') {
  // ── S3: papel que nao e dono ──────────────────────────────────────────────
  try {
  var s3=F('S3'), W3=s3.W, D3=s3.D, q={};
  q.carregou = await ate(W3, function(){ return vis(D3.getElementById('aNaoDono')); });
  q.appOculto = !vis(D3.getElementById('aApp'));
  q.naoLeuCarga = !W3.__LOG.some(function(x){ return x.table==='calc_carga' || x.table==='calc_pendencia'; });
  R.S3 = q;
  } catch(e) { R.S3 = {erro: String(e)}; }

  // ── S4: sem sessao ────────────────────────────────────────────────────────
  try {
  var s4=F('S4'), D4=s4.D, W4=s4.W, t={};
  t.login = await ate(W4, function(){ return vis(D4.getElementById('aLogin')); });
  t.appOculto = !vis(D4.getElementById('aApp'));
  t.senha = D4.getElementById('aSenha').type;
  R.S4 = t;
  } catch(e) { R.S4 = {erro: String(e)}; }

  }
  document.getElementById('saida').textContent = '@@' + JSON.stringify(R) + '@@';
})();
"""

# Os arquivos do S5, montados aqui e nao guardados no repo. O .zip imita o export
# do WhatsApp: _chat.txt comprimido, uma foto junto e a pasta __MACOSX que o Mac
# acrescenta (e que tem um `._chat.txt` binario que NAO pode ser escolhido).
import base64, io, zipfile
CHAT = '[01/09/2026, 10:00:00] Vini: Loja Alfa\niPhone 16 128GB Preto Lacrado - 4.000\n[02/09/2026, 11:00:00] Vini: fim\n'
def zipa(entradas, metodo):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', metodo) as zf:
        for nome, dado in entradas:
            zf.writestr(nome, dado)
    return buf.getvalue()
PNG = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR' + bytes(range(256)) * 4
ARQ = {
    # `leia-me.txt` MAIOR que o _chat.txt: sem a preferencia pelo nome, a tela
    # escolheria o maior e leria o arquivo errado.
    'deflate.zip': zipa([('__MACOSX/._chat.txt', b'\x00\x05\x16\x07' + bytes(60)), ('IMG-0001.jpg', PNG),
                         ('leia-me.txt', ('nada de preco aqui\n' * 200).encode('utf-8')),
                         ('_chat.txt', CHAT.encode('utf-8'))], zipfile.ZIP_DEFLATED),
    # Sem _chat.txt, e com o AppleDouble do __MACOSX MAIOR que a conversa: sem o
    # filtro, a tela escolheria o binario.
    'mac.zip':     zipa([('Conversa.txt', CHAT.encode('utf-8')),
                         ('__MACOSX/._Conversa.txt', b'\x00\x05\x16\x07' + bytes(4000))], zipfile.ZIP_DEFLATED),
    'stored.zip':  zipa([('_chat.txt', CHAT.encode('utf-8'))], zipfile.ZIP_STORED),
    'semtxt.zip':  zipa([('IMG-0001.jpg', PNG)], zipfile.ZIP_DEFLATED),
    'utf16.txt':   '﻿'.encode('utf-16le') + CHAT.encode('utf-16le'),
    'foto.png':    PNG,
    'chat.txt':    b'\xef\xbb\xbf' + CHAT.encode('utf-8'),
}
ARQ_JS = ('var ARQ=' + json.dumps({k: base64.b64encode(v).decode() for k, v in ARQ.items()}) + ';'
          + 'var CHAT=' + json.dumps(CHAT) + ';')

def pagina(so, frames):
    return ('<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;display:block}</style>'
            + ''.join(frames)
            + '<pre id="saida"></pre><script>var SO=' + json.dumps(so) + ';' + ARQ_JS
            + 'window.addEventListener("load",function(){setTimeout(function(){' + TESTE + '},300);});</script>')

# DUAS rodadas de Chrome, e o motivo foi medido em 12/09/2026: com
# `--virtual-time-budget`, ler arquivo (`file.arrayBuffer()`, E/S real) nao
# resolvia a tempo, porque o relogio virtual corre na frente da leitura. Ate um
# .txt de 100 bytes "travava", em 4 de 4 rodadas, com a tela certa. Navegador de
# verdade nao tem tempo virtual: e artefato da ferramenta. Por isso o cenario de
# ARQUIVO roda em tempo real (`--timeout`), e os de tela seguem no tempo virtual,
# que e o que os deixa rapidos e deterministicos.
def rodar(so, frames, tempo):
    with tempfile.TemporaryDirectory() as td:
        pag = pathlib.Path(td) / 'p.html'
        pag.write_text(pagina(so, frames), encoding='utf-8')
        cmd = [CHROME, '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
               '--allow-file-access-from-files', '--window-size=900,1000',
               '--user-data-dir=' + str(pathlib.Path(td) / 'perfil')] + tempo + ['--dump-dom', pag.as_uri()]
        dom = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8',
                             errors='replace', timeout=180).stdout
    # So dentro do <pre>: o proprio codigo do roteiro, que tambem vai no dump, tem
    # `@@`, e contar arrobas no dump inteiro passava roteiro inacabado como medida.
    m = re.search(r'<pre id="saida">@@(.*?)@@</pre>', dom, re.S)
    if not m:
        print('REPROVOU: a rodada "%s" nao produziu medida (Chrome nao terminou o roteiro)' % so)
        sys.exit(1)
    import html as _h
    return json.loads(_h.unescape(m.group(1)))

R = rodar('base', [frame('S2', 360), frame('S1', 390), frame('S3', 390), frame('S4', 390)],
          ['--virtual-time-budget=90000'])

# O ARQUIVO roda no NODE, com as funcoes extraidas do HTML real e executadas (nao
# copiadas). Medido em 12/09/2026: no Chrome com `--virtual-time-budget`, ate um
# .txt de 100 bytes "travava" em `file.arrayBuffer()` (4 de 4 rodadas, com a tela
# certa), porque o relogio virtual corre na frente da E/S real; e `--timeout` nao
# segura o dump. Node 24 tem TextDecoder, Blob, Response e DecompressionStream.
ini_a = html.index('// ── O ARQUIVO')
fim_a = html.index('// ── LEITURA')
FUNCOES = html[ini_a:fim_a]
# as datas tambem: hojeBR e datasDaLista, do arquivo real
FUNCOES += html[html.index('function hojeBR()'):html.index('\n', html.index('function hojeBR()'))] + '\n'
FUNCOES += html[html.index('function datasDaLista(txt)'):html.index('function textoDatas(d)')]
FUNCOES += html[html.index('function recortarLista('):html.index('function janela()')]
NODE = FUNCOES + r'''
const ARQ = JSON.parse(require('fs').readFileSync(0, 'utf8'));
(async () => {
  const CHAT = ARQ.__CHAT; const out = {};
  for (const nome of Object.keys(ARQ)) {
    if (nome === '__CHAT') continue;
    const b = Buffer.from(ARQ[nome], 'base64');
    const f = { name: nome, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
    const r = await textoDoArquivo(f);
    out[nome] = { igual: r.texto === CHAT, temTexto: r.texto != null, origem: r.origem || null, erro: String(r.erro || '') };
  }
  out.__nuloDireto = problemaTexto('Loja Alfa\u0000lixo');
  out.__datas = {
    us:      datasDaLista('[9/12/26, 7:52:23 PM] Vini: x\n[9/12/26, 8:10:00 PM] Vini: y\n'),
    br:      datasDaLista('[12/09/2026, 19:52:23] Vini: x\n'),
    usDia13: datasDaLista('[9/13/25, 19:00] Vini: x\n'),
    android: datasDaLista('12/09/2025 09:12 - Vini: x\n'),
    futuro:  datasDaLista('[12/31/99, 1:00 PM] Vini: x\n'),
    ambiguoAmpm:  datasDaLista('[3/4/26, 1:00 PM] Vini: x\n'),
    ambiguo24h:   datasDaLista('[3/4/26, 13:00] Vini: x\n'),
    nada:    datasDaLista('iPhone 16 128GB - 4.299\n')
  };
  // o corte com HOJE fixo em 12/09/2026: a borda (05/09, hoje menos 7) entra
  const H = Date.UTC(2026, 8, 12);
  const BR = '[01/09/2026, 10:00:00] Vini: Velha\niPhone 16 - 3.000\n[05/09/2026, 08:00:00] Vini: Borda\niPhone 15 - 2.500\n[06/09/2026, 10:00:00] Vini: Alfa\niPhone 16 - 4.000\ncontinua\n[12/09/2026, 09:00:00] Vini: hoje\n';
  const rb = recortarLista(BR, 7, H);
  out.__recorte = {
    br: rb, desdeBr: diaUTC(rb.desde),
    us: recortarLista('[9/1/26, 7:00:00 PM] Vini: velha\nx - 1\n[9/10/26, 7:00:00 PM] Vini: nova\ny - 2\n', 7, H),
    tudoIgual: recortarLista(BR, 0, H).texto === BR,
    semDataIgual: recortarLista('iPhone 16 128GB - 4.299\n', 7, H).texto === 'iPhone 16 128GB - 4.299\n',
    antes: recortarLista('cabecalho solto\n[01/09/2026, 10:00:00] Vini: Velha\nz - 1\n', 7, H)
  };
  process.stdout.write(JSON.stringify(out));
})().catch(e => { process.stdout.write(JSON.stringify({__erro: String(e && e.stack || e)})); });
'''
entrada = dict({k: base64.b64encode(v).decode() for k, v in ARQ.items()}, __CHAT=CHAT)
with tempfile.TemporaryDirectory() as td:
    js = pathlib.Path(td) / 'arquivo.js'
    js.write_text(NODE, encoding='utf-8')
    rn = subprocess.run(['node', str(js)], input=json.dumps(entrada), capture_output=True, text=True,
                        encoding='utf-8', errors='replace', timeout=60)
try:
    A = json.loads(rn.stdout)
except Exception:
    print('REPROVOU: o teste de arquivo no node nao devolveu medida: ' + (rn.stderr or rn.stdout)[:400])
    sys.exit(1)
if A.get('__erro'):
    print('REPROVOU: erro no teste de arquivo: ' + A['__erro'][:400])
    sys.exit(1)

for cen in ('S1', 'S2', 'S3', 'S4'):
    if R.get(cen, {}).get('erro'):
        print('REPROVOU: erro no roteiro ' + cen + ': ' + R[cen]['erro'])
        sys.exit(1)

o = R['S2']
print('— S2: carga aberta, em 360px —')
ok('a tela carregou a carga e as 6 pendencias', o['carregou'])
ok('cobertura no formato do plano: "casaram 11 de 16 linhas (68,8%%)"  [%s]' % o['cobertura'],
   o['cobertura'] == 'casaram 11 de 16 linhas (68,8%)')
ok('"5 linhas não entraram" aparece', '5 linhas não entraram' in o['s2'])
ok('o descarte aparece contado, com o motivo', 'caixa aberta, decisao do dono' in o['s2'] and 'linhas descartadas 2' in o['s2'])
ok('lista de 20 dias acende o aviso de custo velho  [%s]' % o['velho'][:60], 'Custo velho' in o['velho'] and '20 dias' in o['velho'])
ok('com carga aberta, a caixa de colar some (uma lista por vez)', not o['s1novaVisivel'])
ok('suspeita_alta vira card com confirmacao', o['suspeita'])
ok('contagem das pendencias pela decisao GRAVADA, sem "anotadas" com zero  [%s]' % o['sub'],
   o['sub'] == '5 abertas · 1 fora desta lista · 1 respondidas')
ok('descompasso entre a tabela e a leitura viva e declarado  [%s]' % o['descompasso'][:60],
   'A leitura atual tem 3 pendências, mas 6 aparecem sem resposta' in o['descompasso'])
ok('sem resposta anotada, a barra do lote fica escondida', o['loteOculto0'])
B = o['b']
ok('fornecedor: apontar, criar, nunca ler, deixar fora  %s' % B['p1'],
   B['p1'] == ['É outro nome de…', 'Criar fornecedor novo', 'Nunca ler este fornecedor', 'Deixar fora desta lista'])
ok('condicao: so dizer e deixar fora (T1 e T4)  %s' % B['p2'], B['p2'] == ['Dizer a condição', 'Deixar fora desta lista'])
ok('modelo: apontar, criar, nunca e preco, deixar fora  %s' % B['p3'],
   B['p3'] == ['É outro nome de…', 'Criar modelo novo', 'Nunca é preço', 'Deixar fora desta lista'])
ok('cor ignorada segue respondivel, sem criar e sem repetir o ignorar  %s' % B['p4'], B['p4'] == ['É outro nome de…', 'Nunca é preço'])
ok('preco: so deixar fora (T5)  %s' % B['p5'], B['p5'] == ['Deixar fora desta lista'])
ok('D20: preco abaixo da tabela ganha "o preco esta certo" e deixar fora  %s' % B['p7'],
   B['p7'] == ['O preço está certo', 'Deixar fora desta lista'])
ok('D20: o card avisa que quase sempre e leitura errada, e so nele', 'muito abaixo do menor da tabela' in o['p7aviso'] and not o['p5temAviso'])
ok('D20: o form diz que vale so para esta lista e como desfazer', 'Vale só para esta lista' in o['p7form'] and 'desfaz' in o['p7form'])
ok('pendencia ja apontada nao tem botao (T2)  %s' % B['p6'], B['p6'] == [])
ok('a apontada mostra o destino pelo nome e pelo codigo', 'outro nome de iPhone 13 128GB (iphone_13_128gb)' in o['p6'])
ok('n_linhas e o da 1a leitura, e diz isso', '2 linhas na 1ª leitura' in o['p4'])
ok('ordem pela decisao GRAVADA (a anotada p7 segue aberta): abertas, fornecedor primeiro, respondidas no fim  %s' % o['ordem'],
   o['ordem'] == ['p1', 'p2', 'p3', 'p7', 'p5', 'p4', 'p6'])
ok('texto da lista e escapado: nenhum <img> injetado', o['xssImg'] == 0 and not o['xss'] and '<img' in o['xssTexto'])

print('— o contexto da pendencia (pedido do dono, 13/09/2026) —')
C = o['ctx']
ok('por `linha`: a linha que ABRE a mensagem vem no topo (o fornecedor)  [%s]' % C['p7ab'],
   re.match(r'^\[\d\d/\d\d/\d{4}, 09:00:00\] Vini: Loja Alfa$', C['p7ab'] or '') is not None
   and (C['p7'] or [''])[0] == C['p7ab'])
ok('por `linha`: salto marcado com … e as 6 linhas antes da alvo ate 2 depois  %s' % C['p7'][1:],
   C['p7'][1:] == ['…', 'linha nove', 'linha dez', 'linha onze', 'linha doze', 'linha treze', 'linha catorze',
                   'iPhone 16 128GB Preto Lacrado - 300', '', C['p7'][-1]]
   and C['p7'][-1].endswith('Vini: TABELA XPTO IMPORTS'))
ok('a linha alvo e UMA e e a do preco  %s' % C['p7alvo'], C['p7alvo'] == ['iPhone 16 128GB Preto Lacrado - 300'])
ok('a alvo se destaca por peso e fundo, nao so por cor de texto  [%s %s]' % (C['peso'], C['fundoAlvo']),
   C['peso'] in ('700', 'bold') and C['fundoAlvo'] not in ('', 'rgba(0, 0, 0, 0)', 'transparent'))
ok('o trecho diz de que linha e  [%s]' % C['p7h'], C['p7h'].startswith('linha 15 da lista'))
ok('o trecho quebra linha (pre-wrap): 360px nao estoura  [%s]' % C['ws'], C['ws'] == 'pre-wrap')
ok('a alvo que e o proprio carimbo aparece uma vez so, e segue ate 2 depois  %s' % C['p1'],
   len(C['p1']) == 3 and C['p1'][0].endswith('Vini: TABELA XPTO IMPORTS') and C['p1'][1:] == ['12x no cartao sem juros', 'iPhone 17 256GB Lacrado - 7.000']
   and C['p1alvo'] == [C['p1'][0]] and C['p1ab'])
ok('sem `linha` (carga antiga): cai na 1a linha que contem o exemplo, sem salto  %s' % C['p3alvo'],
   C['p3alvo'] == ['poco f8 pro <img src=x onerror="window.__XSS2=1"> - 1.900'] and len(C['p3']) == 9
   and '…' not in C['p3'] and C['p3'][0].endswith('Vini: Loja Alfa') and C['p3h'].startswith('linha 7 da lista'))
ok('com contexto, o <code class="ex"> sai', not C['p3temEx'] and not C['p7temEx'])
ok('sem `linha` e sem o exemplo no bruto: fica o <code class="ex"> de hoje  [%s]' % C['p2ex'],
   not C['p2temCtx'] and C['p2ex'] == 'exemplo loja_alfa')
ok('o bruto em CRLF quebra como o leitor (\\r?\\n): nenhum CR sobra no trecho', not C['cr'])
ok('texto hostil do bruto sai escapado: nenhum <img> e nenhum onerror disparado', o['xssImg'] == 0 and not o['xss2'])

print('— responder em lote: a resposta e ANOTADA —')
ok('D20: confirmar anota o verbo certo, sem destino  %s' % o['p7rpc'],
   o['p7rpc'] == {'p_pendencia': 'p7', 'p_decisao': 'confirmar', 'p_aponta': None, 'p_extra': None})
ok('responder NAO rele a lista', o['relerAposResponder'] == 0)
ok('responder nao chama resolver nem criar', not o['resolverOuCriar'])
ok('a decisao gravada nao muda: o card segue aberto  [%s]' % o['p7cab'][:40],
   'aberta' in o['p7cab'] and 'preço confirmado' not in o['p7anotado'])
ok('o card mostra a resposta anotada e "Tirar a resposta"  %s' % o['p7botoesAnotado'],
   'anotada: o preço está certo' in o['p7anotado'] and o['p7botoesAnotado'] == ['Tirar a resposta', 'O preço está certo', 'Deixar fora desta lista'])
ok('o toast diz que falta reler  [%s]' % o['p7toast'], o['p7toast'] == 'Resposta anotada. Falta reler a lista.')
ok('com 1 anotada, a barra aparece  [%s]' % o['loteUm'][:60], o['loteUm'].startswith('1 resposta anotada. Nada muda na tabela até reler.'))
ok('o subtitulo conta a anotada  [%s]' % o['subUm'], o['subUm'] == '5 abertas · 1 fora desta lista · 1 respondidas · 1 anotadas')

print('— D19: o que aprendeu —')
ok('visao "desta lista" so traz o que esta carga ensinou', 'Fábrica Zeta' in o['aprLista'] and 'Loja Beta' not in o['aprLista'] and 'JBL Flip 7' not in o['aprLista'])
ok('regra aparece pelo MOTIVO', 'fornecedor descartado pelo dono em 12/09/2026: Fábrica Zeta' in o['aprTudo'])
ok('o PADRAO nunca aparece', '^fabrica zeta$' not in o['aprHtml'] and 'fabrica zeta$' not in o['aprTudo'])
ok('visao "tudo" traz as outras cargas', 'Fornecedor novo: Loja Beta' in o['aprTudo'] and 'Modelo novo: JBL Flip 7' in o['aprTudo'])
ok('apelido mostra a grafia e o destino', '“iphone 13 128 gb” passou a ser lido como iPhone 13 128GB (iphone_13_128gb)' in o['aprTudo'])
ok('diz que desfazer ainda nao existe', 'Desfazer ainda não existe pela tela' in o['aprTudo'])

print('— verbos —')
ok('D16 por extenso: "Nunca mais ler preço deste fornecedor, em nenhuma lista."', 'Nunca mais ler preço deste fornecedor, em nenhuma lista.' in o['d16'])
ok('D16 amarra a GRAFIA do cabecalho', 'escrito exatamente TABELA XPTO IMPORTS' in o['d16'] and 'escrito de outro jeito, a pendência volta' in o['d16'])
ok('apontar sem destino: erro na tela  [%s]' % o['apontarVazioErro'], 'Escolha para quem' in o['apontarVazioErro'])
ok('apontar sem destino: nenhuma RPC', o['apontarVazioSemRpc'])
ok('destinos de modelo agrupados por categoria', o['optgroup'] >= 1)
ok('recusa do banco chega NA HORA no card, sem o prefixo da funcao  [%s]' % o['recusa'][:50],
   o['recusa'].startswith('"poco" nao aparece') and 'calc_pendencia_resolver' not in o['recusa'])
ok('a resposta recusada nao fica anotada', o['recusaSemAnotada'])
ok('2.4a ter: o quase-igual vira pergunta com as duas grafias', 'Loja Alfa (codigo loja_alfa)' in o['quase'] and 'criar mesmo assim' in o['quase'])
ok('2.4a ter: a mensagem nao manda o dono digitar JSON', 'confirmar_novo' not in o['quase'])
ok('2.4a ter: o nome digitado sobrevive a pergunta', o['quaseNomeMantido'] == 'Loja Alfa Distribuidora')
ok('criar anota nome em p_aponta e praca em p_extra, sem confirmar_novo na 1a vez  %s' % o['criar1'],
   o['criar1'] == {'p_pendencia': 'p1', 'p_decisao': 'criar', 'p_aponta': 'Loja Alfa Distribuidora', 'p_extra': {'praca': 'Oeste — RJ'}})
ok('"criar mesmo assim" anota com confirmar_novo sim  %s' % o['criar2'],
   o['criar2'] == {'p_pendencia': 'p1', 'p_decisao': 'criar', 'p_aponta': 'Loja Alfa Distribuidora', 'p_extra': {'praca': 'Oeste — RJ', 'confirmar_novo': 'sim'}})
ok('o criar anotado diz o nome  [%s]' % o['p1anotado'][:80], 'anotada: criar Loja Alfa Distribuidora' in o['p1anotado'])
ok('D14: a sugestao da lista anterior vem pre-selecionada  [%s]' % o['condOn'], o['condOn'] == 'Lacrado')
ok('D14: so condicoes ATIVAS viram botao  %s' % o['condBotoes'], o['condBotoes'] == ['CPO', 'Lacrado', 'Seminovo'])
ok('D14: diz que vale so para esta lista', 'Vale só para esta lista' in o['condSug'])
ok('definir anota a condicao escolhida  %s' % o['definir'],
   o['definir'] == {'p_pendencia': 'p2', 'p_decisao': 'definir', 'p_aponta': 'Lacrado', 'p_extra': None})
ok('o definir anotado aparece, e a decisao gravada segue aberta', 'anotada: condição Lacrado' in o['p2anotado'] and 'aberta' in o['p2cab'])
ok('apontar anota o codigo escolhido  %s' % o['apontar'],
   o['apontar'] == {'p_pendencia': 'p3', 'p_decisao': 'apontar', 'p_aponta': 'iphone_13_128gb', 'p_extra': None})
ok('o apontar anotado mostra o destino pelo nome e pelo codigo',
   'anotada: outro nome de iPhone 13 128GB (iphone_13_128gb)' in o['p3anotado'])
ok('ignorar em pergunta ABERTA anota o verbo sem destino  %s' % o['ignorar'],
   o['ignorar'] == {'p_pendencia': 'p5', 'p_decisao': 'ignorar', 'p_aponta': None, 'p_extra': None})
ok('e vale na hora: o card vira "fora desta lista", sem anotada  [%s]' % o['p5cab'][:40],
   'fora desta lista' in o['p5cab'] and not o['p5anotada'])
ok('e sem reler  [toast: %s]' % o['ignorarToast'], o['ignorarSemReler'] and o['ignorarToast'] == 'Fica fora desta lista.')

print('— a barra do lote e as travas —')
ok('o subtitulo conta as 4 anotadas  [%s]' % o['sub4'], o['sub4'] == '4 abertas · 2 fora desta lista · 1 respondidas · 4 anotadas')
ok('a barra conta as anotadas e diz que nada muda  [%s]' % o['lote4'][:70],
   o['loteVisivel'] and o['lote4'].startswith('4 respostas anotadas. Nada muda na tabela até reler.')
   and 'Leva até 1 minuto. Se uma resposta não ensinar nada, nenhuma é gravada e ela fica marcada.' in o['lote4'])
ok('o botao diz quantas vai reler  [%s]' % o['relerBotao'], o['relerBotao'] == 'Reler a lista com 4 respostas')
ok('a barra gruda no rodape (sticky)  [%s]' % o['lotePos'], o['lotePos'] == 'sticky')
ok('quatro respostas e nenhuma releitura', o['relerNenhum'] == 0)
ok('360px com as anotadas: sem estouro horizontal  [+%dpx]' % o['estouroAnotadas'], o['estouroAnotadas'] <= 0)
ok('o diff conta novos, subiram, cairam e iguais', 'novos 1' in o['s4'] and 'subiram 2' in o['s4'] and 'caíram 1' in o['s4'] and 'iguais 1' in o['s4'])
ok('variacao acima de 15%% listada item a item (so a de 20%%, sem a queda forte)  [%d linha]' % o['grandesLinhas'], o['grandesLinhas'] == 1)
ok('queda de mais da metade tem card proprio, com a linha dela  [%d]' % o['quedasLinhas'],
   o['quedasLinhas'] == 1 and '1 preço caiu mais da metade' in o['quedasTxt'] and 'iPhone 14 128GB' in o['quedasTxt'])
ok('com variacao e abertas conferidas, a queda forte ainda trava o aprovar', o['aprovarDesligadoSemQueda'])
ok('e a tela diz que falta a queda', 'conferir o preço que caiu mais da metade' in o['faltaQueda'])
ok('a trava das anotadas vem PRIMEIRO na lista do que falta  [%s]' % o['faltaQueda'][:80],
   'Antes de aprovar, falta: reler a lista com as 4 respostas anotadas;' in o['faltaQueda'])
ok('fornecedor sem lista nova aparece com o custo antigo', 'Loja Gama 1 produto' in o['s4'] and '1 produtos' not in o['s4'] and '17/08/2026' in o['s4'])
ok('o aprovar nasce desligado', o['aprovarDesligado0'])
ok('as quatro confirmacoes existem (suspeita, queda forte, abertas, variacao)  [%d]' % o['nConf'], o['nConf'] == 4)
ok('sem conferir o suspeito, o aprovar segue desligado', o['aprovarDesligadoSemSuspeita'])
ok('e a tela diz o que falta', 'conferir o bloco suspeito de Loja Alfa' in o['faltaSuspeita'])
ok('com as quatro conferidas e respostas anotadas, o aprovar SEGUE desligado', o['aprovarDesligadoComAnotadas'])
ok('e o que falta e so reler  [%s]' % o['faltaAnotadas'][:90],
   'Antes de aprovar, falta: reler a lista com as 4 respostas anotadas.' in o['faltaAnotadas'])

print('— reler: tempo esgotado, recusa e sucesso —')
ok('tempo esgotado: a frase de 1 minuto  [%s]' % o['lentaLote'],
   o['lentaLote'] == 'A releitura passou de 1 minuto e o banco parou. Nada foi gravado: as respostas continuam anotadas.')
ok('e as anotadas continuam', o['lentaBarra'].startswith('4 respostas anotadas') and 'anotada: o preço está certo' in o['lentaP7'])
ok('recusa: "Nenhuma resposta foi gravada", no singular  [%s]' % o['recLote'],
   o['recLote'] == 'Nenhuma resposta foi gravada: 1 não ensina nada ao leitor (marcada abaixo). Tire a resposta ou deixe fora desta lista.')
ok('recusa: a culpada mostra o porque, e so ela  [%s]' % o['recCard'][:60],
   o['recCard'].startswith('esta resposta nao ensina nada ao leitor') and o['recOutros'] == 1)
ok('recusa: nada aplicado (p7 e p2 seguem abertos e anotados)',
   'aberta' in o['recP7cab'] and 'preço confirmado' not in o['recP7'] and 'anotada: o preço está certo' in o['recP7']
   and 'condição: Lacrado (só esta lista)' not in o['recP2'] and 'anotada: condição Lacrado' in o['recP2'])
ok('recusa: as 4 seguem anotadas e o aprovar desligado  [%s]' % o['recSub'],
   o['recSub'].endswith('· 4 anotadas') and o['recAprovarDesligado'])
ok('tirar a resposta anota decisao nula  %s' % o['desanotar'],
   o['desanotar'] == {'p_pendencia': 'p3', 'p_decisao': None, 'p_aponta': None, 'p_extra': None})
ok('tirada: a barra cai para 3 e a marca de erro some  [%s]' % o['tiradaBarra'][:40],
   o['tiradaBarra'].startswith('3 respostas anotadas') and o['tiradaSemErro'])
ok('reler de novo aplica o resto: preço confirmado (só esta lista)', 'preço confirmado (só esta lista)' in o['okP7'])
ok('e condição: Lacrado (só esta lista)', 'condição: Lacrado (só esta lista)' in o['okP2'])
ok('o criar aplicado aparece pelo nome e codigo (o catalogo foi relido)  [%s]' % o['okP1'][:80],
   'criado: Loja Alfa Distribuidora (loja_alfa_distribuidora)' in o['okP1'] and o['okCatalogo'])
ok('o toast conta as respostas e a cobertura antes e depois  [%s]' % o['okToast'],
   o['okToast'] == 'Lista relida com 3 respostas. Casaram 11 → 14.')
ok('depois de reler: nenhuma anotada, barra escondida  [%s]' % o['okSub'],
   o['okLoteOculto'] and o['okAnotadas'] == 0 and o['okSub'] == '1 abertas · 2 fora desta lista · 4 respondidas')
ok('D20 depois de aplicado: so o desfazer  %s' % o['okP7botoes'], o['okP7botoes'] == ['Deixar fora desta lista'])
ok('tres releituras (lenta, recusada, aceita), sempre da carga certa  [%d %s]' % (o['nReler'], o['relerArgs']),
   o['nReler'] == 3 and o['relerArgs'] == {'p_carga': 'c-0001'})
ok('com as travas conferidas e nada anotado, o aprovar acende', o['aprovarLigado'])
ok('o primeiro clique so pede confirmacao, sem RPC', o['semRpcAntesDoSim'] and 'Confirmar?' in o['confirmaTexto'])
ok('o "sim" aprova a carga certa  %s' % o['aprovar'], o['aprovar'] == {'p_carga': 'c-0001'})
ok('o resultado diz produtos, precos e pendencias que ficaram de fora', '4 produtos, 4 preços, com 3 pendências' in o['ok'])
ok('depois de aprovar, a caixa de colar volta', o['depoisS1'])
ok('as RPCs chamadas de fato estao entre as cinco  %s' % o['rpcNomes'], set(o['rpcNomes']) <= RPCS)
ok('nenhuma consulta nem RPC levou tenant_id', not o['tenantEmConsulta'])
ok('360px: sem estouro horizontal  [+%dpx]' % o['estouro'], o['estouro'] <= 0)

p = R['S1']
print('— S1: sem carga —')
ok('carregou com a caixa de colar', p['carregou'])
ok('passos 2 e 4 escondidos sem carga', p['s2oculto'] and p['s4oculto'])
ok('aprendido vazio aparece com frase, nao some  [%s]' % p['apr'][:40], 'Nada foi ensinado ainda' in p['apr'])
ok('sem carga, nao ha botao de visao "desta lista"', p['semBotaoVisao'])
ok('o status declara a data da tabela atual  [%s]' % p['status'], p['status'] == 'tabela atual de 17/08/2026')
ok('ler vazio: erro na tela e nenhuma RPC', 'Cole a lista' in p['vazioErro'] and p['vazioSemRpc'])
ok('colado com caractere nulo: recusado na tela  [%s]' % p['nuloErro'][:40], 'não é texto' in p['nuloErro'])
ok('e nao chega ao banco (nenhuma RPC)', p['nuloSemRpc'])
base_datas = 'Mensagens de %s a %s (3 mensagens com data).' % (p['d20'], p['d0'])
ok('as datas aparecem ao colar, com o corte declarado  [%s]' % p['datas'],
   p['datas'] == base_datas + ' Entram 2 mensagens de %s para cá; 1 mais antiga fica de fora.' % p['d7'])
ok('a janela nasce em 7 dias (decisao do dono, 12/09/2026)', p['janelaPadrao'] == '7')
ok('janela "todas": a frase do corte some  [%s]' % p['datasTudo'], p['datasTudo'] == base_datas)
enviado = (p['abrir'] or {}).get('p_texto', '')
ok('ler manda SO a janela: a mensagem de 20 dias nao chega ao banco  [%s]' % enviado[:40],
   enviado.startswith('[%s, 10:00:00] Vini: Loja Alfa' % p['d2']) and 'Loja Velha' not in enviado
   and 'iPhone 16 128GB - 4.000' in enviado)
ok('tempo do banco esgotado (57014): a tela diz o que fazer, com o limite de 1 minuto  [%s]' % p['lentaErro'][:60],
   'grande demais' in p['lentaErro'] and 'Diminua a janela' in p['lentaErro'] and 'Nada foi gravado' in p['lentaErro']
   and 'o banco para em 1 minuto' in p['lentaErro'] and '30 segundos' not in p['lentaErro']
   and 'statement timeout' not in p['lentaErro'])
ok('e a lista fica na caixa para tentar de novo', p['lentaFicou'] and p['nAbrir'] == 2)
ok('a leitura que estourou tambem foi mandada ja cortada', 'Loja Velha' not in (p['lentaArgs'] or {}).get('p_texto', 'Loja Velha'))
ok('depois de ler, o passo 2 aparece e a caixa esvazia', p['s2visivel'] and p['textoLimpo'])

print('— o arquivo (o defeito do primeiro uso real), no node —')
ok('.zip comprimido: extrai o _chat.txt, nao o leia-me.txt maior nem o ._chat.txt do __MACOSX  %s' % A['deflate.zip'],
   A['deflate.zip']['igual'] and A['deflate.zip']['origem'] == '_chat.txt')
ok('.zip sem compressao tambem abre', A['stored.zip']['igual'])
ok('sem _chat.txt, pega a conversa e nao o binario maior do __MACOSX  %s' % A['mac.zip'],
   A['mac.zip']['igual'] and A['mac.zip']['origem'] == 'Conversa.txt')
ok('.zip sem .txt: erro que diz o que fazer  [%s]' % A['semtxt.zip']['erro'][:50],
   'não tem nenhum .txt' in A['semtxt.zip']['erro'] and not A['semtxt.zip']['temTexto'])
ok('texto UTF-16 com BOM vira texto certo', A['utf16.txt']['igual'])
ok('texto UTF-8 com BOM perde o BOM', A['chat.txt']['igual'])
ok('imagem e recusada como nao texto  [%s]' % A['foto.png']['erro'][:40],
   'não é texto' in A['foto.png']['erro'] and not A['foto.png']['temTexto'])
ok('texto com caractere nulo e recusado pela funcao', 'não é texto' in (A['__nuloDireto'] or ''))
DT = A['__datas']
print('— as datas do export (12/09/2026: o celular em ingles escreve mes/dia) —')
ok('export em ingles [9/12/26, 7:52 PM] e 12 de setembro, nao 9 de dezembro  %s' % DT['us'],
   DT['us'].get('de') == '12/09/2026' and DT['us'].get('formato') == 'mes/dia' and DT['us'].get('n') == 2)
ok('export em portugues segue dia/mes  %s' % DT['br'], DT['br'].get('ate') == '12/09/2026' and DT['br'].get('formato') == 'dia/mes')
ok('mes/dia sem AM/PM, com dia 13: so uma leitura e valida  %s' % DT['usDia13'], DT['usDia13'].get('de') == '13/09/2025')
ok('formato Android (12/09/2025 09:12 - ) segue lido  %s' % DT['android'], DT['android'].get('de') == '12/09/2025')
ok('data no futuro nas duas leituras nao vira data  %s' % DT['futuro'], DT['futuro'].get('invalida') is True and not DT['futuro'].get('n'))
ok('as duas leituras validas e com AM/PM: vale o mes/dia  %s' % DT['ambiguoAmpm'],
   DT['ambiguoAmpm'].get('de') == '04/03/2026' and DT['ambiguoAmpm'].get('formato') == 'mes/dia')
ok('as duas leituras validas e sem AM/PM: vale o dia/mes brasileiro  %s' % DT['ambiguo24h'],
   DT['ambiguo24h'].get('de') == '03/04/2026' and DT['ambiguo24h'].get('formato') == 'dia/mes')
ok('lista sem carimbo nao inventa data', DT['nada'].get('n') == 0 and not DT['nada'].get('invalida'))
RC = A['__recorte']
print('— o corte por data (decisao do dono, 12/09/2026: so os ultimos 7 dias) —')
rb = RC['br']
ok('7 dias: a mensagem de 11 dias sai, e o preco dela junto  %s' % {k: rb[k] for k in ('entram', 'fora')},
   rb['entram'] == 3 and rb['fora'] == 1 and 'Velha' not in rb['texto'] and '3.000' not in rb['texto'])
ok('a borda (hoje menos 7 dias) entra  [%s]' % RC['desdeBr'],
   RC['desdeBr'] == '05/09/2026' and '[05/09/2026, 08:00:00] Vini: Borda' in rb['texto'])
ok('linha sem carimbo segue a mensagem de cima', 'continua' in rb['texto'])
ok('export em ingles tambem se corta, lido como mes/dia  %s' % {k: RC['us'][k] for k in ('entram', 'fora')},
   RC['us']['entram'] == 1 and RC['us']['fora'] == 1 and 'nova' in RC['us']['texto'] and 'velha' not in RC['us']['texto'])
ok('janela "todas": o texto vai inteiro', RC['tudoIgual'])
ok('lista sem data nao se corta', RC['semDataIgual'])
ok('o que vem antes do 1o carimbo fica, e a tela sabe que nenhuma mensagem entrou',
   RC['antes']['texto'] == 'cabecalho solto' and RC['antes']['entram'] == 0 and RC['antes']['fora'] == 1)
# o caminho do input nao roda aqui (DataTransfer so existe no navegador, e no
# Chrome da prova ler arquivo trava): cobra-se que ele USA a funcao provada acima
# e que o erro dela vai para a tela e esvazia a caixa.
chg = html[html.index("if(c.id==='aArq'"):html.index("document.addEventListener('input'")]
ok('o input de arquivo passa por textoDoArquivo', 'textoDoArquivo(c.files[0])' in chg)
ok('erro do arquivo: caixa vazia e mensagem na tela', "$('aTexto').value=''" in chg and 'er.textContent=r.erro' in chg)
ok('o input diz de onde leu dentro do .zip', 'dentro do .zip' in chg)

q = R['S3']
print('— S3: papel que nao e dono —')
ok('mostra que so o dono alimenta', q['carregou'])
ok('a tela de trabalho fica escondida', q['appOculto'])
ok('nem chega a consultar carga ou pendencia', q['naoLeuCarga'])

t = R['S4']
print('— S4: sem sessao —')
ok('pede login', t['login'] and t['appOculto'])
ok('senha em campo de senha', t['senha'] == 'password')

print('')
if falhas:
    print('REPROVOU: %d de %d assercoes falharam' % (len(falhas), total))
    sys.exit(1)
print('PASSOU: %d assercoes, 0 falhas' % total)
sys.exit(0)
