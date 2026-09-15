from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
app = raiz / 'public' / 'app.js'
css = raiz / 'public' / 'app.css'

s = app.read_text(encoding='utf-8')
c = css.read_text(encoding='utf-8')

ancora = 'function hojePendencias(d){'
if s.count(ancora) != 1:
    raise RuntimeError(f'ancora hojePendencias esperado 1 vez, encontrado {s.count(ancora)}')

novo = r'''function diaSaoPaulo(ts){
  if(!ts)return"";var dt=new Date(ts);if(isNaN(dt.getTime()))return"";
  try{var ps=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(dt),m={};ps.forEach(function(x){if("literal"!==x.type)m[x.type]=x.value});return(m.year||"")+"-"+(m.month||"")+"-"+(m.day||"")}catch(e){return dt.toISOString().slice(0,10)}
}
function backlogDiario(hist){var vistos={},serie=[];(hist||[]).forEach(function(x){var d=diaSaoPaulo(x&&x.criado_em),n=Number(x&&x.resultado&&x.resultado.atrasados);if(!d||!isFinite(n)||vistos[d])return;vistos[d]=1;serie.push({dia:d,n:n})});return serie}
function backlogCrescendo(hist){var s=backlogDiario(hist);return s.length>=3&&s[0].n>s[1].n&&s[1].n>s[2].n?{dias:3,atrasados:s[0].n,serie:s.slice(0,3)}:null}
async function carregarHistoricoBacklog(){var r=await t.from("regua_execucao").select("criado_em,resultado").eq("ok",!0).order("criado_em",{ascending:!1}).limit(10);if(r.error){if(await pwSemSessao())return{sessao:!1};return{ok:!1,historico:[]}}return{ok:!0,historico:r.data||[]}}
function medirDegradacaoFila(regua,hist,hj,metricas){
  var ativos=(i||[]).filter(function(x){return!x.arquivado_em}),fila=vOperacional(ativos,hj),alertas=[],k,x,dias,max;
  var pri=[];for(k=0;k<fila.length;k++){x=fila[k];dias=p(x.cadencia_vence_em||x.proximo_contato,hj);if("prioridade"===x.veredito&&dias>1)pri.push(dias)}
  if(pri.length){max=Math.max.apply(Math,pri);alertas.push({cod:"prioridade",n:pri.length,rot:"prioridade vencida",det:"mais antiga "+max+"d · limite 1d",aba:"abaFila",nivel:"urg"})}
  var esp=[];for(k=0;k<ativos.length;k++){x=ativos[k];if("pendente"!==x.status||x.primeiro_toque_em||null==x.horas_esperando_1o_toque)continue;dias=Number(x.horas_esperando_1o_toque);if(dias>=24)esp.push(dias)}
  if(esp.length){max=Math.max.apply(Math,esp);alertas.push({cod:"primeiro-toque",n:esp.length,rot:"sem 1º toque",det:"mais antigo há "+hjEspera(max)+" · limite 24h",aba:"abaFila",nivel:"urg"})}
  var pos=vPos(ativos,hj).filter(function(x){return p(x.proximo_contato,hj)>0});if(pos.length)alertas.push({cod:"pos-venda",n:pos.length,rot:"pós-venda vencido",det:"passo anterior a hoje",aba:"abaPitscare",nivel:"urg"});
  var semCanal=Number(metricas&&metricas.sem_canal)||0;if(semCanal)alertas.push({cod:"sem-canal",n:semCanal,rot:"sem canal",det:"corrigir WhatsApp para executar",aba:"abaTodos",nivel:"crit"});
  var bg=backlogCrescendo(hist);if(bg)alertas.push({cod:"backlog",n:bg.atrasados,rot:"backlog subindo",det:"cresceu por "+bg.dias+" dias seguidos",aba:"abaFila",nivel:"urg"});
  if(!regua||null==regua.ok)alertas.push({cod:"regua",n:"!",rot:"régua sem execução",det:"nenhuma execução registrada",aba:"",nivel:"crit"});
  else if(!1===regua.ok)alertas.push({cod:"regua",n:"!",rot:"régua falhou",det:"última execução retornou erro",aba:"",nivel:"crit"});
  else if(Number(regua.horas)>=26)alertas.push({cod:"regua",n:"!",rot:"régua atrasada",det:"sem rodar há "+Number(regua.horas)+"h · limite 26h",aba:"",nivel:"crit"});
  return alertas
}
function filaAlertaLin(a){return'<div class="fila-alerta '+(a.nivel==="crit"?"crit":"urg")+'"><span class="fila-alerta-num">'+c(a.n)+'</span><span class="fila-alerta-corpo"><strong>'+c(a.rot)+'</strong><span>'+c(a.det)+'</span></span>'+(a.aba?'<button class="pend-ir" data-acao="pend-ir" data-aba="'+c(a.aba)+'">abrir</button>':"")+'</div>'}
function filaAlertasHTML(alertas){if(!alertas||!alertas.length)return"";return'<div class="fila-alertas" aria-label="Alertas operacionais"><div class="fila-alertas-cab"><span class="fila-alertas-tit">Atenção operacional</span><span class="fila-alertas-cont">'+alertas.length+' sinal'+(1===alertas.length?"":"is")+'</span></div><div class="fila-alertas-grade">'+alertas.map(filaAlertaLin).join("")+'</div></div>'}
'''
s = s.replace(ancora, novo + ancora, 1)

old = 'var hj=l(),ex=await carregarExecucaoFila(hj);if(ex&&!1===ex.sessao)return;if(!ex||!1===ex.ok)return void(e.innerHTML=\'<div class="estado erro">Falha ao atualizar a fila: \'+c(ex&&ex.erro||"erro desconhecido")+". Toque em Atualizar para tentar de novo.</div>");await prefetchFilaSug();var rv=await carregarVendas();'
new = 'var hj=l(),ex=await carregarExecucaoFila(hj);if(ex&&!1===ex.sessao)return;if(!ex||!1===ex.ok)return void(e.innerHTML=\'<div class="estado erro">Falha ao atualizar a fila: \'+c(ex&&ex.erro||"erro desconhecido")+". Toque em Atualizar para tentar de novo.</div>");var bh=await carregarHistoricoBacklog();if(bh&&!1===bh.sessao)return;var alertas=medirDegradacaoFila(d.regua,bh&&bh.ok?bh.historico:[],hj,ex.metricas);await prefetchFilaSug();var rv=await carregarVendas();'
if old not in s:
    raise RuntimeError('trecho renderHoje de carga nao encontrado')
s = s.replace(old, new, 1)

old2 = 'e.innerHTML=hojeLeitura(dinheiro)+hojePendencias(d)+hojeFila(d,ex.metricas)'
new2 = 'e.innerHTML=hojeLeitura(dinheiro)+filaAlertasHTML(alertas)+hojePendencias(d)+hojeFila(d,ex.metricas)'
if old2 not in s:
    raise RuntimeError('trecho renderHoje de composicao nao encontrado')
s = s.replace(old2, new2, 1)

exp = ',_medirExecucaoFila:medirExecucaoFila,_setLeads:function(a){i=a}}}()'
if s.count(exp) != 1:
    raise RuntimeError(f'ancora export Fatia6 esperado 1 vez, encontrado {s.count(exp)}')
s = s.replace(exp, ',_medirExecucaoFila:medirExecucaoFila,_medirDegradacaoFila:medirDegradacaoFila,_backlogCrescendo:backlogCrescendo,_setLeads:function(a){i=a}}}()', 1)

css_add = r'''

/* FILA OPERACIONAL v2 — Fatia 7: alertas e degradacao.
   So aparece quando um limiar objetivo foi rompido. Nao existe estado verde
   decorativo: se nao ha alerta, o bloco simplesmente nao ocupa a Hoje. */
.fila-alertas{
  border:1px solid var(--morno-linha);border-radius:var(--radius);background:var(--morno-bg);
  padding:9px 10px;margin-bottom:12px
}
.fila-alertas-cab{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}
.fila-alertas-tit{font-family:var(--display);font-size:12.5px;font-weight:600;color:var(--text)}
.fila-alertas-cont{font-family:var(--mono);font-size:9.5px;color:var(--morno-fg);white-space:nowrap}
.fila-alertas-grade{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
.fila-alerta{
  min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;
  border:1px solid var(--morno-linha);border-radius:var(--radius-p);padding:7px 8px;background:var(--bg)
}
.fila-alerta-num{
  min-width:25px;font-family:var(--display);font-size:18px;font-weight:600;line-height:1;
  font-variant-numeric:tabular-nums;color:var(--morno-fg);text-align:center
}
.fila-alerta-corpo{min-width:0;display:flex;flex-direction:column;line-height:1.25}
.fila-alerta-corpo strong{font-size:11.5px;font-weight:600;color:var(--text)}
.fila-alerta-corpo span{margin-top:2px;font-size:10.5px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fila-alerta.crit{border-color:var(--erro-linha)}
.fila-alerta.crit .fila-alerta-num{color:var(--erro-fg)}
@media(max-width:700px){
  .fila-alertas-grade{grid-template-columns:1fr}
  .fila-alerta-corpo span{white-space:normal}
}
'''
if '.fila-alertas{' in c:
    raise RuntimeError('CSS Fatia 7 ja existe')
c += css_add

app.write_text(s, encoding='utf-8')
css.write_text(c, encoding='utf-8')
print('PATCH_FATIA7_OK')
