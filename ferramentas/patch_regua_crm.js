// Patch das costuras do CRM (regua v2) no nucleo minificado do app.js.
// Cada troca e conferida como ocorrencia UNICA: aborta se achar 0 ou 2.
// Rodar da raiz do repo: node ferramentas/patch_regua_crm.js
'use strict';
const fs = require('fs');
const path = require('path');

const ALVO = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(ALVO, 'utf8');
const antes = src.length;

const COSTURAS = [
  {
    nome: '1. delegado: acao "respondeu" chama registrar_resposta',
    de: 'if(cliAcao(o,t,e))return;',
    para: 'if("respondeu"===o)return void q("registrar_resposta",{p_lead_id:t},e,"Resposta registrada");'
        + 'if(cliAcao(o,t,e))return;'
  },
  {
    nome: '2. fila: o botao "Respondeu" passa a REGISTRAR (era so abrir o leque)',
    de: '<button class="btn-acao" data-acao="leque" data-id="\'+g+\'">Respondeu</button>',
    para: '<button class="btn-acao respondeu" data-acao="respondeu" data-id="\'+g+\'">Respondeu</button>'
        + '<button class="btn-acao" data-acao="leque" data-id="\'+g+\'">Desfecho</button>'
  },
  {
    nome: '3. chip de nivel: "sem_contato" precisa aparecer no card',
    de: '"morno"!==t&&"frio"!==t||n.push(\'<span class="chip nivel-\'+t+\'">\'+c(s("nivel",t))+"</span>")',
    para: '"morno"!==t&&"frio"!==t&&"sem_contato"!==t||n.push(\'<span class="chip nivel-\'+t+\'">\'+c(s("nivel",t))+"</span>")'
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
console.log('APROVOU: 3 costuras aplicadas.');
