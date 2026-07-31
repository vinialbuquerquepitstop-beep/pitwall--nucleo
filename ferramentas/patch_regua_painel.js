// Patch 2: a aba Hoje passa a mostrar se a regua rodou e quantos leads estao
// atrasados. Sem isso, uma parada de semanas volta a passar em branco.
// Rodar da raiz do repo: node ferramentas/patch_regua_painel.js
'use strict';
const fs = require('fs');
const path = require('path');

const ALVO = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(ALVO, 'utf8');
const antes = src.length;

const FN_REGUA = [
  '// A regua e o motor do CRM: se ela para, a fila mente em silencio.',
  '// Esta linha e o unico lugar onde o operador ve que ela esta viva.',
  'function reguaLinha(r){',
  'if(!r||null==r.ok)return \'<div class="sync-lin">régua nunca rodou</div>\';',
  'if(false===r.ok)return \'<div class="sync-lin falha">régua falhou · \'+c(r.erro||"erro desconhecido")+"</div>";',
  'var velha=r.horas>=26,at=r.atrasados||0;',
  'var txt=at?at+" lead"+(1===at?"":"s")+" atrasado"+(1===at?"":"s"):"nada atrasado";',
  'return \'<div class="sync-lin\'+(velha?" velho":"")+\'">régua rodou há \'+c(String(r.horas))+"h · "+c(txt)+(velha?" · atrasada":"")+"</div>"}',
  ''
].join('\n');

const COSTURAS = [
  {
    nome: '1. funcao reguaLinha entra antes de syncLinha (mesmo escopo)',
    de: 'function syncLinha(s){',
    para: FN_REGUA + 'function syncLinha(s){'
  },
  {
    nome: '2. renderHoje pinta a linha da regua logo abaixo do placar',
    de: 'e.innerHTML=hojePlacar(d)+hojeFila(d)',
    para: 'e.innerHTML=hojePlacar(d)+reguaLinha(d.regua)+hojeFila(d)'
  }
];

let erros = 0;
for (const cst of COSTURAS) {
  const n = src.split(cst.de).length - 1;
  if (n !== 1) {
    console.error(`REPROVOU: ${cst.nome}\n  esperava 1 ocorrencia, achou ${n}`);
    erros++;
    continue;
  }
  src = src.replace(cst.de, cst.para);
  console.log(`ok  ${cst.nome}`);
}

if (erros) {
  console.error(`\nREPROVOU: ${erros} costura(s) sem ocorrencia unica. Nada foi gravado.`);
  process.exit(1);
}

fs.writeFileSync(ALVO, src, 'utf8');
console.log(`\napp.js: ${antes} -> ${src.length} bytes (+${src.length - antes})`);
console.log('APROVOU: 2 costuras aplicadas.');
