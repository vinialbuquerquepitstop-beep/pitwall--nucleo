// A aba Escopo nao abria no clique: era a unica das 12 sem Y(...,"click",...).
// Rodar da raiz do repo: node ferramentas/patch_escopo_binding.js
'use strict';
const fs = require('fs');
const path = require('path');

const ALVO = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(ALVO, 'utf8');
const antes = src.length;

const COSTURAS = [
  {
    nome: '1. abaEscopo ganha o binding de clique, junto de abaRotina',
    de: 'Y("abaRotina","click",function(){G("rotina")}),',
    para: 'Y("abaRotina","click",function(){G("rotina")}),Y("abaEscopo","click",function(){G("escopo")}),'
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
console.log(`APROVOU: ${COSTURAS.length} costuras aplicadas.`);
