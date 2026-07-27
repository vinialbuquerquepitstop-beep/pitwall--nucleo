// Prova do guarda de sessao: quando o refresh token morre, o app tem que voltar
// para a tela de login em vez de mostrar erro cru de banco ("permission denied
// for view v_lead"). Recorta as funcoes do public/app.js real, nao de uma copia.
//   node ferramentas/prova_sessao.js
//
// Origem: 27/07/2026, 20:00:34 UTC. O POST /token voltou 400
// refresh_token_not_found e, dos 10 segundos seguintes em diante, TODA leitura
// virou "permission denied" (v_lead, v_venda, v_venda_nf, dicionario_rotulos,
// painel_do_dia, sugerir_mensagem) porque as chamadas passaram a sair como anon.
// A tela continuou na Fila, acusando o banco.
const fs = require('fs');
const SRC = fs.readFileSync(process.argv[2] || 'public/app.js', 'utf8');

function recorte(de, ate) {
  const i = SRC.indexOf(de), j = SRC.indexOf(ate, i);
  if (i < 0 || j < 0) throw new Error('nao achei o bloco: ' + de);
  return SRC.slice(i, j);
}

// U + pwSaindo/pwSessaoCaiu/pwSemSessao + Z (entrar) + X (sair)
const blocoTela = recorte('function U(a){E("telaLogin")', 'function Y(a,e,o){');
// a linha real de registro do listener, tirada de dentro do init
const linhaListener = recorte(
  't.auth.onAuthStateChange(function(evt,ses){',
  '}),window.addEventListener("error"') + '})';

const preludio = `
  var DOM={
    telaLogin:{className:''},telaApp:{className:''},loginErro:{textContent:''},
    btnEntrar:{disabled:!1,textContent:'Entrar'},
    email:{value:'dono@pitstop'},senha:{value:'secreta'}
  };
  function E(id){return DOM[id]||null}
  var i=[{lead:1},{lead:2}];
  var LISTENER=null,SIGNOUTS=0,CARREGOU=0,SESSAO={user:'dono'},LOGIN_ERRO=null,EXPLODE=!1;
  function B(){CARREGOU++}
  var t={auth:{
    onAuthStateChange:function(f){LISTENER=f},
    signOut:function(){SIGNOUTS++;return Promise.resolve({})},
    signInWithPassword:function(){return Promise.resolve(LOGIN_ERRO?{error:{message:LOGIN_ERRO}}:{data:{session:{}}})},
    getSession:function(){if(EXPLODE)throw new Error('rede caiu');return Promise.resolve({data:{session:SESSAO}})}
  }};
`;

const api = new Function(preludio + blocoTela + linhaListener + `
  return {U:U,X:X,Z:Z,pwSessaoCaiu:pwSessaoCaiu,pwSemSessao:pwSemSessao,
    disparar:function(evt,ses){return LISTENER(evt,ses)},
    registrou:function(){return 'function'===typeof LISTENER},
    dom:function(){return DOM},
    leads:function(){return i},
    espiar:function(){return{SIGNOUTS:SIGNOUTS,CARREGOU:CARREGOU}},
    setSessao:function(s){SESSAO=s},
    setExplode:function(v){EXPLODE=v},
    setLoginErro:function(e){LOGIN_ERRO=e},
    resetar:function(){DOM.telaLogin.className='';DOM.telaApp.className='';
      DOM.loginErro.textContent='';i=[{lead:1},{lead:2}]}};
`)();

let ok = 0; const falhas = [];
function ass(nome, cond, extra) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { falhas.push(nome + (extra ? ' | ' + extra : '')); console.log('FALHOU ' + nome + (extra ? ' | ' + extra : '')); }
}
const noLogin = () => api.dom().telaLogin.className.indexOf('oculto') < 0
                    && api.dom().telaApp.className.indexOf('oculto') >= 0;
const noApp = () => api.dom().telaApp.className.indexOf('oculto') < 0
                 && api.dom().telaLogin.className.indexOf('oculto') >= 0;

(async function () {
  console.log('\n--- o listener existe (se sumir do init, a prova nao compila) ---');
  ass('onAuthStateChange registrado no init', api.registrou());

  console.log('\n--- sessao morre sozinha: e o caso do bug ---');
  api.resetar(); api.U(!0);
  ass('antes: operador esta no app', noApp());
  api.disparar('SIGNED_OUT', null);
  ass('volta para a tela de login', noLogin(), api.dom().telaLogin.className + ' / ' + api.dom().telaApp.className);
  ass('avisa que a sessao expirou', /expirou/.test(api.dom().loginErro.textContent), api.dom().loginErro.textContent);
  ass('nao culpa o banco', !/permission|view|base/i.test(api.dom().loginErro.textContent));
  ass('leads em memoria sao descartados', api.leads().length === 0);

  console.log('\n--- clicou em Sair: nao pode dizer que expirou ---');
  api.resetar(); api.U(!0);
  await api.X();
  const saidas = api.espiar().SIGNOUTS;
  api.disparar('SIGNED_OUT', null);
  ass('signOut foi chamado uma vez', saidas === 1, 'saidas=' + saidas);
  ass('volta para a tela de login', noLogin());
  ass('sem mensagem de expirou na saida voluntaria', api.dom().loginErro.textContent === '',
      JSON.stringify(api.dom().loginErro.textContent));

  console.log('\n--- a flag de saida voluntaria nao fica presa ---');
  api.resetar();
  api.disparar('SIGNED_IN', { user: 'dono' });
  api.U(!0);
  api.disparar('SIGNED_OUT', null);
  ass('queda seguinte volta a avisar', /expirou/.test(api.dom().loginErro.textContent),
      api.dom().loginErro.textContent);

  console.log('\n--- entrar de novo limpa a flag e recarrega a base ---');
  api.resetar();
  await api.X();
  const antes = api.espiar().CARREGOU;
  await api.Z();
  ass('entrou: mostra o app', noApp(), api.dom().telaApp.className);
  ass('recarregou a base', api.espiar().CARREGOU === antes + 1);
  api.U(!0); api.disparar('SIGNED_OUT', null);
  ass('depois de reentrar, queda avisa de novo', /expirou/.test(api.dom().loginErro.textContent));

  console.log('\n--- senha errada nao derruba nem limpa a tela ---');
  api.resetar(); api.U(!1); api.setLoginErro('Invalid login credentials');
  await api.Z();
  ass('segue na tela de login', noLogin());
  ass('mensagem e de credencial, nao de sessao', /confira email e senha/.test(api.dom().loginErro.textContent),
      api.dom().loginErro.textContent);
  api.setLoginErro(null);

  console.log('\n--- pwSemSessao: o segundo filtro, na hora do erro ---');
  api.setSessao(null);
  ass('sem sessao devolve true', (await api.pwSemSessao()) === true);
  api.setSessao({ user: 'dono' });
  ass('com sessao devolve false', (await api.pwSemSessao()) === false);
  api.setExplode(!0);
  ass('getSession quebrando NAO derruba o operador', (await api.pwSemSessao()) === false);
  api.setExplode(!1);

  console.log('\n' + (falhas.length ? 'REPROVOU: ' + falhas.length + ' de ' + (ok + falhas.length)
                                    : 'PASSOU: ' + ok + ' assercoes, 0 falhas'));
  falhas.forEach(f => console.log('  - ' + f));
  process.exit(falhas.length ? 1 : 0);
})();
