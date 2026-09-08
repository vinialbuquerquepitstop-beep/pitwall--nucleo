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
ok('as 8 categorias estao declaradas na ordem do catalogo',
   /KCATS=\['iPhone','iPad','MacBook','Apple Watch','Acessório','1ª Linha','Garmin','Moto Elétrica'\]/.test(html));
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

console.log('');
console.log(falhas === 0
  ? 'PASSOU: ' + total + ' assercoes, 0 falhas'
  : 'REPROVOU: ' + falhas + ' de ' + total + ' assercoes falharam');
process.exit(falhas === 0 ? 0 : 1);
