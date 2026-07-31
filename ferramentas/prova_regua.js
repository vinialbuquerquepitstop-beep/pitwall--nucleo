// Prova das mudancas da regua de CRM (auditoria de 31/07/2026), recortada do
// public/app.js REAL, nao de uma copia. Cobre a linha de status da regua na aba
// Hoje e as costuras que ligam o botao Respondeu, o nivel sem_contato e a acao
// no delegado.
//   node ferramentas/prova_regua.js
const fs = require('fs');
const SRC = fs.readFileSync(process.argv[2] || 'public/app.js', 'utf8');
const CSS = fs.readFileSync(process.argv[3] || 'public/app.css', 'utf8');

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
const fnRegua = recorte('function reguaLinha(r){', 'function syncLinha(s){');
const reguaLinha = new Function(escReal + fnRegua + 'return reguaLinha;')();

console.log('\n--- reguaLinha: a regua nunca mente sobre o proprio estado ---');
eq('sem dado nenhum diz que nunca rodou', reguaLinha(null),
   '<div class="sync-lin">régua nunca rodou</div>');
eq('ok nulo tambem conta como nunca rodou', reguaLinha({ ok: null }),
   '<div class="sync-lin">régua nunca rodou</div>');
t('falha aparece como falha, nao como silencio',
  reguaLinha({ ok: false, erro: 'deadlock detected' }).indexOf('sync-lin falha') >= 0);
t('a falha mostra o motivo',
  reguaLinha({ ok: false, erro: 'deadlock detected' }).indexOf('deadlock detected') >= 0);
t('erro sem texto ainda avisa',
  reguaLinha({ ok: false }).indexOf('erro desconhecido') >= 0);

const recente = reguaLinha({ ok: true, horas: 3, atrasados: 0 });
t('rodou ha pouco nao marca como velha', recente.indexOf('velho') < 0);
t('sem atrasado a tela DIZ que nao ha atrasado', recente.indexOf('nada atrasado') >= 0);
t('mostra ha quantas horas rodou', recente.indexOf('3h') >= 0);

const comAtraso = reguaLinha({ ok: true, horas: 5, atrasados: 9 });
t('declara quantos leads estao atrasados', comAtraso.indexOf('9 leads atrasados') >= 0);
const um = reguaLinha({ ok: true, horas: 5, atrasados: 1 });
t('singular nao vira "1 leads"', um.indexOf('1 lead atrasado') >= 0 && um.indexOf('leads') < 0);

const velha = reguaLinha({ ok: true, horas: 30, atrasados: 2 });
t('passou de 26h marca visualmente como atrasada', velha.indexOf('sync-lin velho') >= 0);
t('e diz por escrito que esta atrasada', velha.indexOf('· atrasada') >= 0);
t('o cron roda 1x/dia: 25h ainda e normal',
  reguaLinha({ ok: true, horas: 25, atrasados: 0 }).indexOf('velho') < 0);

console.log('\n--- costura: o botao Respondeu REGISTRA (era so abrir o leque) ---');
eq('existe exatamente um botao com data-acao="respondeu"',
   conta('data-acao="respondeu"'), 1);
eq('o delegado trata a acao "respondeu"', conta('if("respondeu"===o)'), 1);
t('a acao chama a RPC registrar_resposta',
  SRC.indexOf('q("registrar_resposta",{p_lead_id:t}') >= 0);
t('o rotulo "Respondeu" nao aponta mais para a acao leque',
  SRC.indexOf('data-acao="leque" data-id="\'+g+\'">Respondeu<') < 0);
eq('o leque continua existindo, com rotulo honesto', conta('">Desfecho</button>'), 1);
t('registrar_toque continua existindo (toque e resposta sao eventos distintos)',
  SRC.indexOf('registrar_toque') >= 0);

console.log('\n--- costura: nivel sem_contato deixa de se disfarcar de quente ---');
t('o chip de nivel inclui sem_contato',
  SRC.indexOf('"morno"!==t&&"frio"!==t&&"sem_contato"!==t') >= 0);
t('a barra do card tem cor para sem_contato',
  CSS.indexOf('.card.t-sem_contato::before') >= 0);
t('o chip sem_contato tem estilo proprio',
  CSS.indexOf('.chip.nivel-sem_contato{') >= 0);
t('sem_contato usa a paleta de urgencia ja medida (--quente)',
  /\.chip\.nivel-sem_contato\{color:var\(--quente-fg\)/.test(CSS));
t('sem_contato ganha o ponto colorido como os outros niveis',
  CSS.indexOf('.chip.nivel-sem_contato::before') >= 0);

console.log('\n--- costura: a aba Hoje mostra a regua ---');
eq('renderHoje pinta a linha da regua', conta('reguaLinha(d.regua)'), 1);
t('a linha entra depois do placar e antes da fila',
  SRC.indexOf('hojePlacar(d)+reguaLinha(d.regua)+hojeFila(d)') >= 0);
eq('reguaLinha esta definida uma vez so', conta('function reguaLinha(r){'), 1);

console.log(`\n=== ${ok + falhas} assercoes, ${falhas} falhas ===`);
process.exit(falhas ? 1 : 0);
