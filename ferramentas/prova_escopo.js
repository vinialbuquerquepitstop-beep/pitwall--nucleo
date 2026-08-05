// Prova da aba Escopo, Fatia 1. Recortada do public/app.js REAL, nao de copia.
//   node ferramentas/prova_escopo.js
const fs = require('fs');
const SRC = fs.readFileSync(process.argv[2] || 'public/app.js', 'utf8');
const CSS = fs.readFileSync(process.argv[3] || 'public/app.css', 'utf8');
const HTML = fs.readFileSync(process.argv[4] || 'public/index.html', 'utf8');

let ok = 0, falhas = 0;
function t(nome, cond) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { falhas++; console.log('  FALHOU  ' + nome); }
}
function eq(nome, a, b) {
  if (a === b) { ok++; console.log('  ok  ' + nome); }
  else { falhas++; console.log(`  FALHOU  ${nome}\n    esperava: ${JSON.stringify(b)}\n    veio:     ${JSON.stringify(a)}`); }
}
function conta(agulha) { return SRC.split(agulha).length - 1; }
function recorte(de, ate) {
  const i = SRC.indexOf(de), j = SRC.indexOf(ate, i);
  if (i < 0 || j < 0) throw new Error('nao achei o bloco: ' + de);
  return SRC.slice(i, j);
}

const escReal = recorte('function c(a){return String(null==a?', 'function d(a){');
// A recorte comeca em 'var ESC_ICONES=', nao em 'function escFaixaRot(f){':
// o patch declara ESC_ICONES e ESC_STATUS ANTES desse ponto (mesmo escopo
// top-level do app.js real, onde funcionam normalmente), e escIcone/escFrente
// dependem delas. Recortar so a partir de escFaixaRot deixava as duas vars de
// fora do eval isolado e a prova quebrava com ReferenceError, mesmo com o
// app.js real correto.
const bloco = recorte('var ESC_ICONES=', 'async function renderEscopo(');
const api = new Function(escReal + bloco +
  'return {escFaixaRot:escFaixaRot,escIcone:escIcone,escPlacar:escPlacar,escFrente:escFrente};')();

console.log('\n--- faixa: a palavra nunca some ---');
eq('a_frente', api.escFaixaRot('a_frente'), 'a frente');
eq('normal',   api.escFaixaRot('normal'),   'normal');
eq('em_baixa', api.escFaixaRot('em_baixa'), 'em baixa');
eq('sem_dado', api.escFaixaRot('sem_dado'), 'sem dado');
eq('faixa desconhecida nao quebra a tela', api.escFaixaRot('marte'), 'sem dado');

console.log('\n--- placar: a nota nunca aparece sozinha ---');
const fs1 = [
  {codigo:'comercial',rotulo:'Comercial',grupo:'frente',icone:'etiqueta',
   nota:72,faixa:'a_frente',feitas:4,total:7,travadas:0,dias_parada:3,acoes:[]},
  {codigo:'whatsapp',rotulo:'Status do WhatsApp',grupo:'frente',icone:'balao',
   nota:31,faixa:'em_baixa',feitas:1,total:9,travadas:3,dias_parada:21,acoes:[]},
  {codigo:'assistencia',rotulo:'Assistência técnica',grupo:'frente',icone:'chave',
   nota:null,faixa:'sem_dado',feitas:0,total:0,travadas:0,dias_parada:null,acoes:[]}
];
const pl = api.escPlacar(fs1);
t('mostra a nota', pl.indexOf('>72<') >= 0);
t('mostra a palavra da faixa', pl.indexOf('a frente') >= 0);
t('mostra as feitas sobre o total', pl.indexOf('4/7 feitas') >= 0);
t('mostra quantas travadas', pl.indexOf('3 travadas') >= 0);
t('mostra ha quantos dias parou', pl.indexOf('21d') >= 0);
t('em baixa recebe a classe de alerta', pl.indexOf('f-em_baixa') >= 0);
t('sem dado recebe classe propria', pl.indexOf('f-sem_dado') >= 0);
t('sem dado NAO inventa nota', pl.indexOf('>0<') < 0 && pl.indexOf('>100<') < 0);
t('sem dado diz por escrito que nao ha acao', pl.indexOf('nenhuma ação registrada') >= 0);
t('a frente sem parcela nao vira linha muda',
  api.escPlacar([{codigo:'x',rotulo:'X',grupo:'frente',icone:'alvo',nota:null,
                  faixa:'sem_dado',feitas:0,total:0,travadas:0,dias_parada:null,acoes:[]}])
     .indexOf('nenhuma ação registrada') >= 0);

console.log('\n--- placar: nome de frente nao escapa como HTML cru ---');
t('rotulo com < e > sai escapado',
  api.escPlacar([{codigo:'x',rotulo:'<img src=x>',grupo:'frente',icone:'alvo',nota:50,
                  faixa:'normal',feitas:1,total:2,travadas:0,dias_parada:1,acoes:[]}])
     .indexOf('<img src=x>') < 0);

console.log('\n--- frente: trilho SEM icone e regressao ---');
const fr = api.escFrente({codigo:'pitscare',rotulo:'Pitscare',grupo:'frente',icone:'escudo',
  nota:60,faixa:'normal',feitas:1,total:3,travadas:1,dias_parada:2,
  acoes:[
    {id:'a1',titulo:'Aplicar os 19 scripts',status:'travado',motivo_trava:'capability Update content'},
    {id:'a2',titulo:'Fundir a branch',status:'a_fazer',motivo_trava:null}
  ]}, true);
t('a frente carrega icone (o icone carrega a distincao, nao e enfeite)', fr.indexOf('<svg') >= 0);
t('mostra o contador da frente', fr.indexOf('1/3') >= 0);
t('a travada aparece com o chip de travado', fr.indexOf('s-travado') >= 0);
t('e o motivo da trava aparece por escrito', fr.indexOf('capability Update content') >= 0);
// Quem ORDENA e o banco (array_position na escopo_completo). Aqui so se prova
// que a tela nao reembaralha o que recebeu.
t('a tela preserva a ordem que o banco mandou',
  fr.indexOf('Aplicar os 19 scripts') < fr.indexOf('Fundir a branch'));
t('quem pode editar ve o botao de mudar status', fr.indexOf('data-acao="esc-status"') >= 0);
t('quem pode editar ve o botao de descartar', fr.indexOf('data-acao="esc-desc"') >= 0);

const frLeitor = api.escFrente({codigo:'pitscare',rotulo:'Pitscare',grupo:'frente',icone:'escudo',
  nota:60,faixa:'normal',feitas:1,total:3,travadas:1,dias_parada:2,
  acoes:[{id:'a1',titulo:'x',status:'a_fazer',motivo_trava:null}]}, false);
t('quem NAO pode editar nao ve botao de escrita',
  frLeitor.indexOf('data-acao="esc-status"') < 0 && frLeitor.indexOf('data-acao="esc-desc"') < 0);
t('mas continua LENDO a acao', frLeitor.indexOf('esc-acao') >= 0);

console.log('\n--- travar: o requisito numero um nao pode ser inalcancavel ---');
t('quem pode editar ve o controle de travar', fr.indexOf('data-acao="esc-travar"') >= 0);
t('a acao travada oferece DESTRAVAR, nao travar de novo',
  api.escFrente({codigo:'x',rotulo:'X',grupo:'frente',icone:'alvo',nota:50,faixa:'normal',
    feitas:0,total:1,travadas:1,dias_parada:1,
    acoes:[{id:'a9',titulo:'t',status:'travado',motivo_trava:'algo'}]}, true)
    .indexOf('>destravar<') >= 0);
t('a acao NAO travada oferece TRAVAR',
  api.escFrente({codigo:'x',rotulo:'X',grupo:'frente',icone:'alvo',nota:50,faixa:'normal',
    feitas:0,total:1,travadas:0,dias_parada:1,
    acoes:[{id:'a9',titulo:'t',status:'fazendo',motivo_trava:null}]}, true)
    .indexOf('>travar<') >= 0);
t('quem NAO pode editar nao ve o controle de travar',
  frLeitor.indexOf('data-acao="esc-travar"') < 0);
t('o controle de travar carrega o status atual, para saber o que fazer',
  fr.indexOf('data-acao="esc-travar"') >= 0 &&
  /data-acao="esc-travar" data-id="[^"]*" data-st="/.test(fr));

console.log('\n--- o ciclo do chip nao passa por travado (travar e interrupcao, nao etapa) ---');
const ciclo = SRC.slice(SRC.indexOf('if("esc-status"===o)'), SRC.indexOf('if("esc-status"===o)') + 300);
t('o ciclo do chip NAO tem travado como destino', /[?:]"travado"/.test(ciclo) === false);
t('o ciclo do chip nao carrega mais o prompt morto', ciclo.indexOf('prompt(') < 0);
eq('o delegado trata esc-travar', conta('if("esc-travar"===o)'), 1);
t('travar de verdade manda p_status travado',
  SRC.indexOf('p_status:"travado"') >= 0);
t('destravar volta para fazendo, nao para a_fazer (o trabalho ja tinha comecado)',
  SRC.indexOf('p_status:"fazendo",p_motivo:null') >= 0);
t('o prompt do motivo passou a viver no caminho alcancavel',
  SRC.slice(SRC.indexOf('if("esc-travar"===o)'), SRC.indexOf('if("esc-travar"===o)') + 400).indexOf('prompt(') >= 0);
t('a classe esc-travar tem estilo no CSS', CSS.indexOf('.esc-travar') >= 0);

console.log('\n--- icone: frente nova (Fatia 3) nao pode virar buraco ---');
t('icone conhecido devolve svg', api.escIcone('escudo').indexOf('<svg') >= 0);
t('icone desconhecido cai num svg padrao, nao em vazio', api.escIcone('zzz').indexOf('<svg') >= 0);

console.log('\n--- costuras no app.js ---');
eq('o dispatcher trata a aba escopo', conta('"escopo"===n)renderEscopo()'), 1);
eq('renderEscopo definida uma vez so', conta('async function renderEscopo('), 1);
t('a leitura passa pela RPC escopo_completo', SRC.indexOf('"escopo_completo"') >= 0);
t('criar acao passa pela RPC', SRC.indexOf('"criar_acao_escopo"') >= 0);
t('mudar status passa pela RPC', SRC.indexOf('"mudar_status_acao_escopo"') >= 0);
t('arquivar passa pela RPC', SRC.indexOf('"descartar_acao_escopo"') >= 0);
t('nenhuma nota e calculada no JS (a conta e do banco)',
  SRC.indexOf('function escNota') < 0);
eq('o delegado trata esc-status', conta('if("esc-status"===o)'), 1);
eq('o delegado trata esc-desc', conta('if("esc-desc"===o)'), 1);
eq('o delegado trata esc-criar', conta('if("esc-criar"===o)'), 1);
t('a aba entra no aria-selected junto das outras', SRC.indexOf('E("abaEscopo")') >= 0);
t('o titulo do topo conhece a aba escopo', SRC.indexOf('"escopo"===n?"Escopo"') >= 0);

console.log('\n--- index.html e app.css ---');
t('o botao da aba existe', HTML.indexOf('id="abaEscopo"') >= 0);
t('e ele e .aba-rara (senao a barra do celular volta a cobrir o conteudo)',
  /class="aba aba-rara" id="abaEscopo"/.test(HTML));
t('o CSS tem o bloco do placar', CSS.indexOf('.esc-placar{') >= 0);
t('o CSS tem a classe de alerta de em baixa', CSS.indexOf('.esc-linha.f-em_baixa') >= 0);
t('o alerta reusa o --erro ja medido, sem token novo', CSS.indexOf('--escopo-baixa') < 0);
t('o alerta NAO reusa a paleta de temperatura',
  /\.esc-linha\.f-em_baixa \.esc-faixa\{color:var\(--quente/.test(CSS) === false);

console.log('\n--- a aba precisa ABRIR: 11 abas tinham binding, a 12a nao tinha ---');
['abaHoje','abaFila','abaTodos','abaVendas','abaNfs','abaClientes','abaIndicacoes',
 'abaCaptacao','abaConteudo','abaRotina','abaDash','abaEscopo'].forEach(function(id){
  t('a aba ' + id + ' tem binding de clique', SRC.indexOf('Y("' + id + '","click"') >= 0);
});

console.log(`\n=== ${ok + falhas} assercoes, ${falhas} falhas ===`);
process.exit(falhas ? 1 : 0);
