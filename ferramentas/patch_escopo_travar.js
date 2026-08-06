// Travar uma acao passa a ser alcancavel. O ciclo do chip nunca tinha travado
// como destino, entao o prompt do motivo era codigo morto e o requisito
// numero um da Fatia 1 nao existia na tela.
// Rodar da raiz do repo: node ferramentas/patch_escopo_travar.js
'use strict';
const fs = require('fs');
const path = require('path');

const ALVO = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(ALVO, 'utf8');
const antes = src.length;

const COSTURAS = [
  {
    nome: '1. o botao de travar entra ao lado do chip de status',
    de: '\'</button><button class="link-acao" data-acao="esc-desc" data-id="\'+c(a.id)+\'" aria-label="Descartar">×</button>\'',
    para: '\'</button><button class="link-acao esc-travar" data-acao="esc-travar" data-id="\'+c(a.id)+\'" data-st="\'+c(a.status)+\'">\'+("travado"===a.status?"destravar":"travar")+\'</button><button class="link-acao" data-acao="esc-desc" data-id="\'+c(a.id)+\'" aria-label="Descartar">×</button>\''
  },
  {
    nome: '2. o ciclo do chip perde o prompt morto',
    de: ',mot=null;if("travado"===prox&&!(mot=prompt("O que está travando?")))return;return void q("mudar_status_acao_escopo",{p_id:a.getAttribute("data-id"),p_status:prox,p_motivo:mot},a)}',
    para: ';return void q("mudar_status_acao_escopo",{p_id:a.getAttribute("data-id"),p_status:prox,p_motivo:null},a)}'
  },
  {
    nome: '3. o delegado ganha esc-travar, que e o caminho ALCANCAVEL do motivo',
    de: 'if("esc-desc"===o)return void q("descartar_acao_escopo"',
    para: [
      'if("esc-travar"===o){',
      'var sa=a.getAttribute("data-st"),mt=null;',
      // destravar volta para fazendo: o trabalho ja tinha comecado, mandar para
      // a_fazer apagaria essa informacao.
      'if("travado"===sa)return void q("mudar_status_acao_escopo",{p_id:a.getAttribute("data-id"),p_status:"fazendo",p_motivo:null},a);',
      'if(!(mt=prompt("O que está travando?")))return;',
      'return void q("mudar_status_acao_escopo",{p_id:a.getAttribute("data-id"),p_status:"travado",p_motivo:mt},a)}',
      'if("esc-desc"===o)return void q("descartar_acao_escopo"'
    ].join('')
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
