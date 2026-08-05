// Aba Escopo, Fatia 1. Costura renderEscopo e o dispatcher dentro do app.js
// minificado. Rodar da raiz do repo: node ferramentas/patch_escopo.js
'use strict';
const fs = require('fs');
const path = require('path');

const ALVO = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(ALVO, 'utf8');
const antes = src.length;

const ICONES = {
  pessoas:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke-linecap="round"/><path d="M16 6.2a3.2 3.2 0 0 1 0 6M17.5 19a5.5 5.5 0 0 0-1.6-3.9" stroke-linecap="round"/>',
  megafone:'<path d="M4 10v4h3l7 4V6l-7 4H4z" stroke-linejoin="round"/><path d="M17.5 9a4 4 0 0 1 0 6" stroke-linecap="round"/>',
  chave:'<circle cx="8" cy="8" r="3.4"/><path d="M10.4 10.4L20 20M17 17l-2 2M14 14l-2 2" stroke-linecap="round"/>',
  alvo:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-linecap="round"/>',
  balao:'<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V6z" stroke-linejoin="round"/>',
  escudo:'<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z" stroke-linejoin="round"/>',
  etiqueta:'<path d="M4 11V5a1 1 0 0 1 1-1h6l9 9-7 7-9-9z" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.2"/>',
  calculadora:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h4" stroke-linecap="round"/>',
  alerta:'<path d="M12 4l9 16H3l9-16z" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke-linecap="round"/>'
};

const BLOCO = [
  '// Aba Escopo. A NOTA NAO E CALCULADA AQUI: ela vem pronta de',
  '// escopo_completo(), derivada na leitura, no fuso do Brasil. Duplicar a',
  '// conta no JS criaria duas verdades para o mesmo numero.',
  'var ESC_ICONES=' + JSON.stringify(ICONES) + ';',
  'var ESC_STATUS={a_fazer:"a fazer",fazendo:"fazendo",travado:"travado",feito:"feito"};',
  'function escFaixaRot(f){',
  'return"a_frente"===f?"a frente":"normal"===f?"normal":"em_baixa"===f?"em baixa":"sem dado"}',
  '// Frente nova criada pela tela (Fatia 3) pode nao ter icone conhecido: cai no',
  '// alvo em vez de virar buraco. Trilho sem icone e regressao.',
  'function escIcone(k){',
  'var p=ESC_ICONES[k]||ESC_ICONES.alvo;',
  'return\'<svg viewBox="0 0 24 24" aria-hidden="true">\'+p+"</svg>"}',
  '// A nota nunca aparece sozinha: as tres parcelas vao do lado. Nota escondida',
  '// vira fe, e ninguem discute com fe.',
  'function escPlacar(fs){',
  'if(!fs||!fs.length)return"";',
  'var lin=fs.filter(function(f){return"pendencia"!==f.grupo}).map(function(f){',
  'var sd="sem_dado"===f.faixa,',
  'par=sd?"nenhuma ação registrada":f.feitas+"/"+f.total+" feitas · "+f.travadas+" travada"+(1===f.travadas?"":"s")+(null==f.dias_parada?"":" · "+f.dias_parada+"d");',
  'return\'<div class="esc-linha f-\'+c(f.faixa)+\'"><span class="esc-linha-nome">\'+c(f.rotulo)+\'</span><span class="esc-nota">\'+(sd?"--":c(String(f.nota)))+\'</span><span class="esc-faixa">\'+c(escFaixaRot(f.faixa))+\'</span><span class="esc-parcelas">\'+c(par)+"</span></div>"}).join("");',
  'return\'<div class="esc-placar">\'+lin+"</div>"}',
  'function escFrente(fr,pode){',
  'var ac=(fr.acoes||[]).map(function(a){',
  '// O chip carrega a classe do status nos DOIS caminhos: quem pode editar ve',
  '// botao, quem nao pode ve texto, e os dois pintam igual. Chip sem a classe',
  '// deixaria o leitor sem a cor de travado.',
  'var bt=pode?\'<button class="esc-chip s-\'+c(a.status)+\'" data-acao="esc-status" data-id="\'+c(a.id)+\'" data-st="\'+c(a.status)+\'">\'+c(ESC_STATUS[a.status]||a.status)+\'</button><button class="link-acao" data-acao="esc-desc" data-id="\'+c(a.id)+\'" aria-label="Descartar">×</button>\':\'<span class="esc-chip s-\'+c(a.status)+\'">\'+c(ESC_STATUS[a.status]||a.status)+"</span>";',
  'return\'<div class="esc-acao"><span class="esc-acao-txt">\'+c(a.titulo)+(a.motivo_trava?\'<div class="esc-trava">trava: \'+c(a.motivo_trava)+"</div>":"")+"</span>"+bt+"</div>"}).join("")||\'<div class="esc-acao"><span class="esc-acao-txt">Nenhuma ação aqui ainda.</span></div>\';',
  'var form=pode?\'<div class="esc-form"><input type="text" maxlength="160" id="escNovo_\'+c(fr.codigo)+\'" placeholder="Nova ação nesta frente" autocomplete="off"><button class="link-acao" data-acao="esc-criar" data-frente="\'+c(fr.codigo)+\'">Adicionar</button></div>\':"";',
  'return\'<div class="esc-frente\'+("pendencia"===fr.grupo?" esc-pend":"")+\'"><div class="esc-frente-cab">\'+escIcone(fr.icone)+\'<span class="esc-frente-tit">\'+c(fr.rotulo)+\'</span><span class="esc-frente-cont">\'+c(fr.feitas+"/"+fr.total)+"</span></div>"+ac+form+"</div>"}',
  'async function renderEscopo(){',
  'var e=E("lista");',
  'e.innerHTML=\'<div class="estado carregando">Lendo o escopo…</div>\';',
  'var r=await t.rpc("escopo_completo",{});',
  'if(r.error)return void(e.innerHTML=\'<div class="estado erro">Falha ao ler o escopo: \'+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");',
  'var d=r.data;',
  'if(!d||!1===d.ok)return void(e.innerHTML=\'<div class="estado erro">\'+c(d&&d.msg||"Falha ao ler o escopo.")+"</div>");',
  'var fr=d.frentes||[],pode=!0===d.pode_editar;',
  'e.innerHTML=fr.length?escPlacar(fr)+fr.map(function(x){return escFrente(x,pode)}).join(""):\'<div class="estado"><strong>O escopo está vazio.</strong>Nenhuma frente cadastrada.</div>\'}',
  ''
].join('\n');

const COSTURAS = [
  {
    nome: '1. o bloco do Escopo entra antes de renderRotina (mesmo escopo)',
    de: 'async function renderRotina(){',
    para: BLOCO + 'async function renderRotina(){'
  },
  {
    nome: '2. o dispatcher passa a conhecer a aba escopo',
    de: 'else if("rotina"===n)renderRotina();',
    para: 'else if("rotina"===n)renderRotina();else if("escopo"===n)renderEscopo();'
  },
  {
    nome: '3. aria-selected da aba Escopo, junto das outras',
    de: 'E("abaMais")&&(E("abaMais").setAttribute(',
    para: 'E("abaEscopo")&&E("abaEscopo").setAttribute("aria-selected","escopo"===n?"true":"false"),E("abaMais")&&(E("abaMais").setAttribute('
  },
  {
    nome: '4. a aba Escopo conta como rara para o botao Mais',
    de: '["indicacoes","captacao","dashboard","rotina","nfs"].indexOf(n)>=0',
    para: '["indicacoes","captacao","dashboard","rotina","nfs","escopo"].indexOf(n)>=0'
  },
  {
    nome: '5. o titulo do topo conhece a aba',
    de: '"conteudo"===n?"Conteúdo":',
    para: '"conteudo"===n?"Conteúdo":"escopo"===n?"Escopo":'
  },
  {
    nome: '6. o delegado trata as tres acoes de escrita',
    de: 'if("rot-dia"===o)',
    para: [
      'if("esc-criar"===o){',
      'var fcod=a.getAttribute("data-frente"),cx=E("escNovo_"+fcod);',
      'if(!cx||!cx.value.trim())return void I("Escreva a ação primeiro.",!0);',
      'return void q("criar_acao_escopo",{p_frente:fcod,p_titulo:cx.value},a)}',
      'if("esc-status"===o){',
      'var st=a.getAttribute("data-st"),',
      'prox="a_fazer"===st?"fazendo":"fazendo"===st?"feito":"feito"===st?"a_fazer":"a_fazer",mot=null;',
      'if("travado"===prox&&!(mot=prompt("O que está travando?")))return;',
      'return void q("mudar_status_acao_escopo",{p_id:a.getAttribute("data-id"),p_status:prox,p_motivo:mot},a)}',
      'if("esc-desc"===o)return void q("descartar_acao_escopo",{p_id:a.getAttribute("data-id")},a);',
      'if("rot-dia"===o)'
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
