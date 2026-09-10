// prova_catalogo.js — assere o painel Catalogo da calc do dono (Bloco 1.3 do
// plano docs/superpowers/plans/2026-09-05-calculadora-produto.md).
//
// Roda da raiz do repo:  node ferramentas/prova_catalogo.js
// Confere o EXIT CODE, nunca o texto da saida.
//
// Le o ARQUIVO REAL (nao copia a logica da tela), senao a prova passa a provar
// a si mesma em vez de provar o painel. Mesmo padrao de prova_cpo.js.

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DONO = path.join(RAIZ, 'public', 'calc', 'index.html');

let falhas = 0, total = 0;
function ok(nome, cond) {
  total++;
  if (cond) { console.log('  ok   ' + nome); }
  else { falhas++; console.log('  FALHA ' + nome); }
}

const html = fs.readFileSync(DONO, 'utf8');

// Extrai o corpo de uma funcao do arquivo real, contando chaves.
function extrai(assinatura) {
  const i = html.indexOf(assinatura);
  if (i < 0) throw new Error('nao achei: ' + assinatura);
  let profundidade = 0, j = html.indexOf('{', i);
  const inicio = j;
  for (; j < html.length; j++) {
    if (html[j] === '{') profundidade++;
    else if (html[j] === '}') { profundidade--; if (profundidade === 0) break; }
  }
  return html.slice(inicio, j + 1);
}

console.log('— a sexta aba existe —');
ok("botao CATALOGO chama swTab('k')", /onclick="swTab\('k'\)"/.test(html));
ok('o botao tem id tbk', /id="tbk"/.test(html));
ok('o painel pg-k existe', /id="pg-k"/.test(html));
ok('as outras cinco abas seguem existindo',
   ["swTab('v')", "swTab('u')", "swTab('r')", "swTab('o')", "swTab('c')"]
     .every(s => html.includes(s)));

console.log('— swTab itera as SEIS letras —');
// Esquecer o 'k' aqui nao some com a aba nova: quebra o ESCONDER dela ao trocar
// de aba, e o painel do Catalogo fica colado por cima do proximo.
const corpoSw = extrai('function swTab(id)');
const lista = corpoSw.match(/\[\s*'v'[^\]]*\]/);
ok('swTab tem a lista de abas', !!lista);
if (lista) {
  const letras = (lista[0].match(/'(\w)'/g) || []).map(s => s.replace(/'/g, ''));
  ok('a lista tem 6 letras  [obtido ' + letras.length + ']', letras.length === 6);
  ok("a lista inclui 'k'", letras.includes('k'));
  ['v', 'u', 'r', 'o', 'c'].forEach(x =>
    ok("a lista ainda inclui '" + x + "'", letras.includes(x)));
}
ok("swTab chama kRender() quando id==='k'", /id===['"]k['"]\s*\)\s*kRender\(\)/.test(corpoSw));

console.log('— cabecalho e CSS —');
ok('HDR tem a entrada k', /\bk:\s*\{\s*e:/.test(html.slice(html.indexOf('const HDR='),
                                                           html.indexOf('const HDR=') + 400)));
ok('a tab-bar esta em repeat(6,1fr)', /\.tab-bar\{[^}]*grid-template-columns:repeat\(6,1fr\)/.test(html));
ok('a tab-bar NAO ficou em repeat(5,1fr)', !/\.tab-bar\{[^}]*repeat\(5,1fr\)/.test(html));
// Sem borda, o Branco (#f5f5f0) some no fundo claro e a linha parece sem cor.
ok('o quadradinho de cor tem borda', /\.ksw\{[^}]*border:1px solid var\(--bd\)/.test(html));

console.log('— le as cinco tabelas do catalogo —');
const corpoCarga = extrai('async function carregarCatalogo()');
['calc_modelo', 'calc_cor', 'calc_fornecedor', 'calc_alias', 'calc_regra'].forEach(t =>
  ok('carregarCatalogo le ' + t, corpoCarga.includes("'" + t + "'")));
ok('carregarCatalogo e chamada apos carregar os precos',
   /carregarCatalogo\(\);/.test(extrai('async function carregarPrecos()')));
// tenant_id vem da sessao, nunca do payload: a RLS ja filtra sozinha.
ok('a carga NAO passa tenant_id no cliente', !/tenant_id/.test(corpoCarga));
// A falha de uma tabela nao pode derrubar as outras nem a calculadora.
ok('cada tabela guarda o proprio erro', /erro:\s*\(res&&res\.error/.test(corpoCarga));

console.log('— o que a tela mostra —');
const corpoRender = extrai('function kRender()');
ok('kRender existe', corpoRender.length > 200);
// JBL entrou no fim em 10/09/2026: e a nona categoria do CHECK de calc_modelo.
// A ordem e assertada, nao so o conjunto, porque a aba Config renderiza NESTA
// ordem para a tela ficar estavel entre sessoes.
ok('as 9 categorias estao declaradas na ordem do catalogo',
   /KCATS=\['iPhone','iPad','MacBook','Apple Watch','Acessório','1ª Linha','Garmin','Moto Elétrica','JBL'\]/.test(html));
ok('a cor e pintada com o hex do banco', /background:'\+kEsc\(c\.hex\)/.test(corpoRender));
ok('o fornecedor mostra a praca', /kEsc\(f\.praca\)/.test(corpoRender));
ok('o alias mostra texto e destino',
   /kEsc\(a\.texto\)/.test(corpoRender) && /kEsc\(a\.aponta\)/.test(corpoRender));

console.log('— o estado da regra e PALAVRA, nao so cor —');
// O dono escolheu regra a regra em 08/09/2026. Cor sozinha nao carrega a
// distincao: a palavra e que informa.
ok("a tela escreve 'ligada' e 'desligada'", /r\.ativo\?'ligada':'desligada'/.test(corpoRender));
ok('a regra desligada tambem recebe uma classe propria', /koff/.test(corpoRender));
ok('.koff existe no CSS', /\.koff\{/.test(html));
ok('o cabecalho conta ligadas e desligadas', /ligadas, '\+\(C\.regra\.linhas\.length-lig\)/.test(corpoRender));

console.log('— campo vazio APARECE, com estado vazio nomeado —');
// Tela que so renderiza o que tem dado some inteira na base zerada, e quem abre
// conclui que a funcionalidade nao existe (memoria campo-vazio-tem-que-aparecer).
const corpoVazio = extrai('function kVazio(el,hdr,erro,msgVazia,contagem)');
ok('kVazio existe', corpoVazio.length > 100);
ok('kVazio distingue ERRO de VAZIO', /if\(erro\)/.test(corpoVazio));
ok('o vazio usa a classe .es', /class="es"/.test(corpoVazio));
ok('erro de leitura aparece na tela, nao em silencio',
   /não foi possível ler/.test(corpoVazio));
ok('fornecedor vazio explica que so o dono enxerga',
   /só o papel <b>dono<\/b> enxerga/.test(corpoRender));
ok('as cinco secoes passam por kVazio',
   (corpoRender.match(/kVazio\(/g) || []).length === 5);

console.log('— a tela DECLARA o recorte —');
// Secao que nao diz a contagem mente por omissao.
ok('modelos declara a contagem', /linhas\.length\+' modelos/.test(corpoRender));
ok('cores declara a contagem', /linhas\.length\+' cores'/.test(corpoRender));
ok('fornecedores declara a contagem', /linhas\.length\+' fornecedores/.test(corpoRender));
ok('apelidos declara a contagem', /linhas\.length\+' apelidos/.test(corpoRender));
ok('regras declara a contagem', /linhas\.length\+' regras/.test(corpoRender));

console.log('— so leitura —');
// Quem escreve no catalogo e a tela Alimentar (Bloco 2), por RPC. Se um insert
// aparecer aqui, o caminho de escrita saiu do unico lugar auditavel.
ok('kRender nao escreve no banco',
   !/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(corpoRender));
ok('carregarCatalogo nao escreve no banco',
   !/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(corpoCarga));
// Recorta o painel de verdade: de `id="pg-k"` ate a TAB BAR. Sem esse limite o
// teste alcanca os botoes da propria barra de abas e acusa falso.
const painelK = html.slice(html.indexOf('id="pg-k"'), html.indexOf('<!-- TAB BAR -->'));
ok('o recorte do painel foi achado', painelK.length > 200 && painelK.length < 4000);
ok('o painel nao tem botao de acao', !/<button/.test(painelK));
ok('o painel nao tem campo de entrada', !/<input|<select|<textarea/.test(painelK));

// ══════════════════════════════════════════════════════════════════════════
// MARGEM POR CATEGORIA (Fatia 1 do Bloco 2, 10/09/2026)
//
// Aqui a prova deixa de casar texto e passa a EXECUTAR o codigo real extraido
// do arquivo. Regex prova que a linha esta escrita; executar prova que ela
// funciona. Mesmo padrao de prova_sem_margem.js.
// ══════════════════════════════════════════════════════════════════════════

function eq(nome, obtido, esperado) {
  ok(nome + '  [esperado ' + JSON.stringify(esperado) + ', obtido ' + JSON.stringify(obtido) + ']',
     JSON.stringify(obtido) === JSON.stringify(esperado));
}

// Pedacos carregados do arquivo real, nunca reescritos aqui.
const mSet   = html.match(/const SEMMARGEM=new Set\(\[[^\]]*\]\);/);
const mSemFn = html.match(/function semMargem\(c\)\{[^}]*\}/);
const mMg    = html.match(/function mg\(c\)\{.*?\}\r?\n/);
const mKcats = html.match(/const KCATS=\[[^\]]*\];/);

console.log('— mg() le a margem do banco, e null NAO e zero —');
ok('achei SEMMARGEM, mg e KCATS no arquivo', !!(mSet && mSemFn && mMg && mKcats));
ok('mg() le CFG.margens', /CFG\.margens/.test(mMg ? mMg[0] : ''));
// O fallback nao e enfeite: prova_sem_margem.js monta um CFG SEM `margens` e
// espera o comportamento anterior a 10/09/2026, byte a byte.
ok('mg() mantem o fallback sem CFG.margens',
   /CFG\.mav/.test(mMg ? mMg[0] : '') && /CFG\.iav/.test(mMg ? mMg[0] : ''));
ok('CFG declara margens antes do Object.assign',
   /let CFG=\{[^}]*margens:null/.test(html));
// JBL tem margem PROPRIA, so nao configurada ainda. Se alguem a jogar em
// SEMMARGEM, ela passa a vender no custo calada.
ok('JBL NAO entrou em SEMMARGEM', !/JBL/.test(mSet ? mSet[0] : 'JBL'));
ok('SEMMARGEM segue com as tres classes de custo puro',
   ['1ª Linha', 'Garmin', 'Moto Elétrica'].every(c => (mSet ? mSet[0] : '').includes(c)));

if (mSet && mSemFn && mMg) {
  const ctx = (CFG) => new Function('CFG',
    mSet[0] + mSemFn[0] + mMg[0] + 'return {SEMMARGEM, semMargem, mg};')(CFG);

  // As nove categorias como estao no banco em 10/09/2026: JBL e Acessório com
  // `null` = NAO CONFIGURADA; as tres de custo puro com zero de proposito.
  const MARG = {
    'iPhone':        { av: 550,  pc: 650 },
    'iPad':          { av: 550,  pc: 650 },
    'Apple Watch':   { av: 550,  pc: 650 },
    'MacBook':       { av: 1200, pc: 1300 },
    'Garmin':        { av: 0,    pc: 0 },
    '1ª Linha':      { av: 0,    pc: 0 },
    'Moto Elétrica': { av: 0,    pc: 0 },
    'JBL':           { av: null, pc: null },
    'Acessório':     { av: null, pc: null },
  };
  const comBanco = ctx({ d: 300, margens: MARG, iav: 550, ipc: 650, mav: 1200, mpc: 1300 });

  eq('mg("iPhone") vem do banco, nao do CFG fixo', comBanco.mg('iPhone'), { av: 550, pc: 650 });
  eq('mg("MacBook") vem do banco', comBanco.mg('MacBook'), { av: 1200, pc: 1300 });
  // O DEFEITO que esta fatia fecha: no else antigo toda categoria que nao era
  // MacBook levava margem de iPhone. Acessório caia ali (fonte de R$ 70 saindo
  // a R$ 620) e JBL cairia junto, numa caixa de som de R$ 2.200.
  ok('mg("Acessório") devolve null, nao margem de iPhone', comBanco.mg('Acessório') === null);
  ok('mg("JBL") devolve null, nao margem de iPhone', comBanco.mg('JBL') === null);
  ok('mg("JBL") NAO devolve zero (zero seria vender no custo)',
     JSON.stringify(comBanco.mg('JBL')) !== JSON.stringify({ av: 0, pc: 0 }));
  eq('mg("Garmin") segue zero, que e margem legitima', comBanco.mg('Garmin'), { av: 0, pc: 0 });
  ok('categoria fora de CFG.margens tambem vira null',
     comBanco.mg('Categoria Que Nao Existe') === null);
  // Meio par tambem e "nao configurada": preco com so um dos dois e preco pela metade.
  const meio = ctx({ margens: { 'JBL': { av: 300, pc: null } }, iav: 550, ipc: 650, mav: 1200, mpc: 1300 });
  ok('margem com so um dos dois lados tambem e null', meio.mg('JBL') === null);
  // Texto no lugar de numero nao pode virar preco.
  const txt = ctx({ margens: { 'JBL': { av: '300', pc: '400' } }, iav: 550, ipc: 650, mav: 1200, mpc: 1300 });
  ok('margem em texto nao vira preco', txt.mg('JBL') === null);

  const semMargens = ctx({ d: 300, iav: 550, ipc: 650, mav: 1200, mpc: 1300 });
  eq('sem CFG.margens, iPhone volta ao fallback', semMargens.mg('iPhone'), { av: 550, pc: 650 });
  eq('sem CFG.margens, MacBook volta ao fallback', semMargens.mg('MacBook'), { av: 1200, pc: 1300 });
  eq('sem CFG.margens, Acessório volta ao fallback (comportamento antigo)',
     semMargens.mg('Acessório'), { av: 550, pc: 650 });
}

console.log('— os SEIS chamadores de mg() tratam o null —');
// mg() passa a poder devolver null. Chamador que faz .av de null explode a tela;
// chamador que trata null como zero inventa preco. Os dois sao defeito.
const corpoVSel   = extrai('function vSel(idx)');
const corpoVCalc  = extrai('function vCalc()');
const corpoUnShow = extrai('function unShow(p)');
const corpoUnCC   = extrai('function unCC(btn,n,v)');
const corpoUnPre  = extrai('function unPreco(m)');
const corpoOR     = extrai('function oRender()');

ok('1/6 vSel escreve o rotulo de margem ausente', /mg2===null\?/.test(corpoVSel));
ok('1/6 vSel mantem o ramo de "só custo"', /semMargem\(p\.c\)\?/.test(corpoVSel));
ok('2/6 vCalc trata null no rotulo do !VS.cat', /mg2===null\?/.test(corpoVCalc));
ok('3/6 vCalc RETORNA antes de calcular preco', /if\(mg\(cat\)===null\)\{[^}]*return;\}/.test(corpoVCalc));
ok('3/6 vCalc esconde o bloco de resultado', /mg\(cat\)===null\)\{document\.getElementById\('vres'\)\.style\.display='none'/.test(corpoVCalc));
ok('3/6 a guarda de null vem ANTES do const m=mg(cat)',
   corpoVCalc.indexOf('mg(cat)===null') < corpoVCalc.indexOf('const m=mg(cat);'));
ok('4/6 unShow nao soma .av de null', /UN\.av=m\?c\+m\.av:0/.test(corpoUnShow));
ok('4/6 unShow delega as tres linhas de preco a unPreco', /unPreco\(m\)/.test(corpoUnShow));
ok('5/6 unCC nao soma .av de null', /UN\.av=m\?v\+m\.av:0/.test(corpoUnCC));
ok('5/6 unCC delega as tres linhas de preco a unPreco', /unPreco\(m\)/.test(corpoUnCC));
// Travessao, nao numero: zero aqui passaria por preco de verdade.
ok('4-5/6 unPreco escreve travessao nos tres campos, nao numero',
   /if\(!m\)\{av\.textContent='—';d12\.textContent='—';d18\.textContent='—'/.test(corpoUnPre));
ok('4-5/6 unPreco acende a linha que diz a palavra', /sm\.style\.display='flex'/.test(corpoUnPre));
ok('4-5/6 o card do novo tem a linha de aviso com a palavra',
   /id="unsm"[^>]*>[\s\S]{0,120}Sem margem configurada/.test(html));
ok('6/6 o scanner pula categoria sem margem configurada', /if\(mg\(p\.c\)===null\)return;/.test(corpoOR));
ok('6/6 o scanner tambem guarda na linha do calculo', /const m=mg\(p\.c\);if\(!m\)return;/.test(corpoOR));
ok('6/6 o scanner mantem a guarda de Acessório e custo puro',
   /if\(p\.c==='Acessório'\|\|semMargem\(p\.c\)\)return;/.test(corpoOR));

console.log('— a aba Config edita margem por CATEGORIA, nao por par fixo —');
ok('rCfgM existe', html.includes('function rCfgM()'));
ok('rCfgM e chamada em aplicarDados', /rCfgB\(\); rCfgT\(\); rCfgM\(\);/.test(extrai('function aplicarDados(D)')));
ok('o container cfml existe no HTML', /id="cfml"/.test(html));
ok('o botao de salvar existe', /id="cfmb"[^>]*onclick="cfSaveM\(\)"|onclick="cfSaveM\(\)"[^>]*id="cfmb"/.test(html));
// Os quatro campos do par fixo tinham que SAIR da tela, senao cfSv() le
// elemento que nao existe e o config quebra no primeiro toque.
['cfia', 'cfip', 'cfma', 'cfmp'].forEach(id =>
  ok('o campo fixo ' + id + ' saiu da tela', !new RegExp('id="' + id + '"').test(html)));
ok('cfSv nao le mais os campos que sairam',
   !/cfia|cfip|cfma|cfmp/.test(extrai('function cfSv()')));
ok('aplicarDados nao le mais os campos que sairam',
   !/cfia|cfip|cfma|cfmp/.test(extrai('function aplicarDados(D)')));
// Mas as PROPRIEDADES ficam: sao o fallback de mg(), e prova_sem_margem.js as usa.
ok('CFG mantem iav/ipc/mav/mpc como fallback',
   /let CFG=\{[^}]*iav:550[^}]*ipc:650[^}]*mav:1200[^}]*mpc:1300/.test(html));

const corpoRCfgM = extrai('function rCfgM()');
ok('rCfgM renderiza na ordem de KCATS, nao na ordem das chaves',
   /KCATS\.map\(/.test(corpoRCfgM) && !/Object\.keys\(M\)/.test(corpoRCfgM));
// Campo vazio tem que APARECER (memoria campo-vazio-tem-que-aparecer).
ok('o input vazio mostra placeholder de travessao', /placeholder="—"/.test(corpoRCfgM));
ok('a linha nao configurada diz a palavra, nao so cor',
   /sem margem definida/.test(extrai('function cfMTxt(av,pc)')));
ok('a linha de custo puro diz que o zero e proposital',
   /zero proposital/.test(corpoRCfgM));
ok('as classes de custo puro nao viram campo editavel',
   /if\(SEMMARGEM\.has\(c\)\)/.test(corpoRCfgM));

console.log('— o payload: vazio e null, e as duas chaves vao SEMPRE —');
// A assercao mais importante do lote. Se alguem "simplificar" o vazio para 0, o
// produto passa a vender no custo calado, e nada na tela denuncia.
if (mKcats && mSet) {
  const corpoLer = extrai('function cfMLer()');
  const montar = (vals) => new Function('KCATS', 'SEMMARGEM', 'CFG', 'document',
    'function cfMLer()' + corpoLer + 'return cfMLer();');
  const KCATS = new Function(mKcats[0] + 'return KCATS;')();
  const SEMMARGEM = new Function(mSet[0] + 'return SEMMARGEM;')();
  eq('KCATS tem 9 categorias', KCATS.length, 9);
  eq('JBL e a nona', KCATS[8], 'JBL');

  const CFGp = { margens: {
    'iPhone': { av: 550, pc: 650 }, 'iPad': { av: 550, pc: 650 },
    'Apple Watch': { av: 550, pc: 650 }, 'MacBook': { av: 1200, pc: 1300 },
    'Garmin': { av: 0, pc: 0 }, '1ª Linha': { av: 0, pc: 0 },
    'Moto Elétrica': { av: 0, pc: 0 }, 'JBL': { av: null, pc: null },
    'Acessório': { av: null, pc: null } } };
  // Tela: iPhone preenchido, JBL com um lado digitado, Acessório VAZIO.
  const campos = {
    cfm0a: '550', cfm0p: '650', cfm1a: '550', cfm1p: '650',
    cfm2a: '1200', cfm2p: '1300', cfm3a: '550', cfm3p: '650',
    cfm4a: '',    cfm4p: '',                       // Acessório, vazio
    cfm8a: '0',   cfm8p: '  ',                     // JBL, zero de um lado e vazio do outro
  };
  const doc = { getElementById: (id) => (id in campos) ? { value: campos[id] } : null };
  const pay = montar()(KCATS, SEMMARGEM, CFGp, doc);

  eq('o payload manda as NOVE categorias (a RPC substitui o objeto inteiro)',
     Object.keys(pay).length, 9);
  ok('toda categoria leva as DUAS chaves av e pc (a RPC exige)',
     Object.keys(pay).every(c => pay[c] && 'av' in pay[c] && 'pc' in pay[c]));
  eq('campo VAZIO vira null, jamais zero  (Acessório)', pay['Acessório'], { av: null, pc: null });
  ok('o vazio nao virou zero', JSON.stringify(pay['Acessório']) !== JSON.stringify({ av: 0, pc: 0 }));
  eq('zero digitado continua zero, e nao vira null  (JBL av)', pay['JBL'].av, 0);
  ok('espaco em branco tambem e null  (JBL pc)', pay['JBL'].pc === null);
  eq('numero digitado chega como numero, nao como texto', pay['iPhone'], { av: 550, pc: 650 });
  eq('classe de custo puro vai como zero explicito', pay['Garmin'], { av: 0, pc: 0 });
  ok('nenhum valor do payload e undefined',
     Object.keys(pay).every(c => pay[c].av !== undefined && pay[c].pc !== undefined));
}

console.log('— salvar de verdade, e o erro do banco aparece —');
const corpoSave = extrai('async function cfSaveM()');
ok('o botao chama a RPC calc_config_margem_salvar',
   /calc_config_margem_salvar/.test(html));
ok('a chamada da RPC passa p_margens', /\{p_margens:m\}/.test(html));
ok('a RPC e chamada de dentro do IIFE, onde o cliente sb vive',
   /window\.salvarMargens=async function\(m\)/.test(html));
ok('cfSaveM diz quando nao ha sessao, em vez de explodir',
   /typeof window\.salvarMargens!=='function'/.test(corpoSave));
ok('erro da RPC vai para o toast com a mensagem do banco',
   /res\.error/.test(corpoSave) && /toast\(/.test(corpoSave));
ok('o sucesso confirma quantas categorias foram gravadas',
   /categorias gravadas/.test(corpoSave));
ok('depois de salvar, a tela recalcula', /if\(VS\.av>0\)vCalc\(\);if\(UN\.av>0\)uCalc\(\);/.test(corpoSave));
ok('depois de salvar, CFG.margens acompanha o que foi gravado', /CFG\.margens=m;/.test(corpoSave));

console.log('');
console.log(falhas === 0
  ? 'PASSOU: ' + total + ' assercoes, 0 falhas'
  : 'REPROVOU: ' + falhas + ' de ' + total + ' assercoes falharam');
process.exit(falhas === 0 ? 0 : 1);
