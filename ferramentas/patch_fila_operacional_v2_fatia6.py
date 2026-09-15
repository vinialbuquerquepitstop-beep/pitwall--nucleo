from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
app = raiz / 'public' / 'app.js'
css = raiz / 'public' / 'app.css'

s = app.read_text(encoding='utf-8')
c = css.read_text(encoding='utf-8')

ini = s.find('function hojeFila(d){')
fim = s.find('function hojeLembretes(d){', ini)
if ini < 0 or fim < 0:
    raise RuntimeError('regiao hojeFila nao encontrada')

novo = r'''var FILA_EXEC_EVENTOS={toque_enviado:1,respondeu:1,conversando:1,reagendado:1,sem_interesse:1,fechou:1};
function medirExecucaoFila(eventos,hj,eventosOk){
  var base=i||[],ativos=base.filter(function(x){return!x.arquivado_em}),fila=vOperacional(ativos,hj),vis={},pend={},feitos={},carga={},j,x,id;
  for(j=0;j<base.length;j++)if(base[j]&&base[j].id)vis[base[j].id]=base[j];
  for(j=0;j<fila.length;j++){id=fila[j].id;if(id){pend[id]=1;carga[id]=1}}
  if(eventosOk)for(j=0;j<(eventos||[]).length;j++){
    x=eventos[j];id=x&&x.lead_id;
    if(id&&vis[id]&&FILA_EXEC_EVENTOS[x.tipo]&&!pend[id]){feitos[id]=1;carga[id]=1}
  }
  var atrasados=fila.filter(function(x){return p(x.proximo_contato,hj)>0}).length;
  var semCanal=ativos.filter(function(x){var dig=String(x.whatsapp_digitos||"").replace(/\D/g,"");return(devidoCom(x,hj)||devidoPos(x,hj))&&!dig}).length;
  var posPendentes=fila.filter(function(x){return"convertido"===x.status}).length;
  var concluidos=eventosOk?Object.keys(feitos).length:null,cargaN=eventosOk?Object.keys(carga).length:null;
  var taxa=eventosOk&&cargaN?Math.round(100*concluidos/cargaN):eventosOk?0:null;
  return{eventos_ok:!!eventosOk,pendentes:fila.length,atrasados:atrasados,concluidos:concluidos,carga:cargaN,taxa:taxa,sem_canal:semCanal,pos_pendentes:posPendentes}
}
async function carregarExecucaoFila(hj){
  var rl=await t.from("v_lead").select("*").order("proximo_contato",{ascending:!0,nullsFirst:!1});
  if(rl.error){if(await pwSemSessao())return{sessao:!1};return{ok:!1,erro:rl.error.message}}
  i=rl.data||[];
  var inicio=hj+"T00:00:00-03:00",fim=C(hj,1)+"T00:00:00-03:00";
  var re=await t.from("lead_evento").select("lead_id,tipo,criado_em").gte("criado_em",inicio).lt("criado_em",fim).in("tipo",Object.keys(FILA_EXEC_EVENTOS));
  if(re.error){if(await pwSemSessao())return{sessao:!1};return{ok:!0,metricas:medirExecucaoFila([],hj,!1),aviso:re.error.message}}
  return{ok:!0,metricas:medirExecucaoFila(re.data||[],hj,!0)}
}
function filaExecCel(rot,num,pe,titulo,classe){return'<div class="fila-exec-cel'+(classe?' '+classe:'')+'" title="'+c(titulo||"")+'"><div class="fila-exec-rot">'+c(rot)+'</div><div class="fila-exec-num">'+c(null==num?"—":String(num))+'</div><div class="fila-exec-pe">'+c(pe||"")+'</div></div>'}
function filaExecucaoHTML(m){
  if(!m)return"";
  var execNum=m.eventos_ok?m.taxa+"%":"—",execPe=m.eventos_ok?(m.concluidos+" concluído"+(1===m.concluidos?"":"s")+" de "+m.carga+" observados"):"eventos indisponíveis";
  var filaPe=m.atrasados?m.atrasados+" atrasado"+(1===m.atrasados?"":"s"):"nenhum atraso";
  return'<div class="fila-exec" aria-label="Indicadores de execução da fila">'+
    filaExecCel("execução",execNum,execPe,"Concluídos hoje dividido pela carga observada: concluídos hoje mais pendentes atuais.","")+
    filaExecCel("na fila",m.pendentes,filaPe,"Itens acionáveis que continuam devidos agora. Atrasado significa vencimento anterior a hoje.",m.atrasados?"fila-exec-alerta":"")+
    filaExecCel("pós-venda",m.pos_pendentes,"pendentes agora","Itens de pós-venda acionáveis que continuam devidos agora.","")+
    filaExecCel("sem canal",m.sem_canal,m.sem_canal?"corrigir cadastro":"nenhuma correção","Pendências devidas sem WhatsApp válido; ficam fora da fila acionável.",m.sem_canal?"fila-exec-canal":"")+
  "</div>"
}
function hojeFila(d,exec){var ativos=(i||[]).filter(function(x){return!x.arquivado_em}),fila=vOperacional(ativos,l()),recorte=filaRecorte(fila,l()),indic=filaExecucaoHTML(exec);if(!fila.length)return'<div class="dia-sec"><div class="dia-sec-cab fila-hoje-cab"><div class="dia-sec-tit">Fila de hoje</div></div>'+indic+recorte+'<div class="dia-vazio">Fila zerada hoje. Nada vencendo.</div></div>';var top=fila.slice(0,5).map(hojeFilaLin).join("");return'<div class="dia-sec"><div class="dia-sec-cab fila-hoje-cab"><div class="dia-sec-tit">Fila de hoje</div><button class="fila-vertodos" data-acao="hoje-verfila" aria-label="Ver todos os '+fila.length+' itens da fila">ver todos</button></div>'+indic+recorte+top+"</div>"}
'''
s = s[:ini] + novo + s[fim:]

rini = s.find('async function renderHoje(sil){')
rfim = s.find('\nvar CONT_COLUNAS=[', rini)
if rini < 0 or rfim < 0:
    raise RuntimeError('renderHoje nao encontrado')
novo_render = r'''async function renderHoje(sil){var e=E("lista");if(!sil)e.innerHTML='<div class="estado carregando">Lendo o dia…</div>';var r=await t.rpc("painel_do_dia",{});if(r.error)return void(e.innerHTML='<div class="estado erro">Falha ao ler o dia: '+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");var d=r.data;if(!d||!1===d.ok)return void(e.innerHTML='<div class="estado erro">'+c(d&&d.msg||"Falha ao ler o dia.")+"</div>");var hj=l(),ex=await carregarExecucaoFila(hj);if(ex&&!1===ex.sessao)return;if(!ex||!1===ex.ok)return void(e.innerHTML='<div class="estado erro">Falha ao atualizar a fila: '+c(ex&&ex.erro||"erro desconhecido")+". Toque em Atualizar para tentar de novo.</div>");await prefetchFilaSug();var rv=await carregarVendas();if(rv&&!1===rv.sessao)return;var dinheiro=rv&&rv.ok?hojeDinheiro():estadoErro("as vendas",rv?rv.erro:"");e.innerHTML=hojeLeitura(dinheiro)+hojePendencias(d)+hojeFila(d,ex.metricas)+'<div class="hj-grid"><div class="hj-col">'+hojeTarefas(d)+'</div><div class="hj-col">'+hojeConteudo(d)+hojeLembretes(d)+hojeNota(d)+'</div></div>'+'<div class="hj-rodape">'+reguaLinha(d.regua)+'</div>'}'''
s = s[:rini] + novo_render + s[rfim:]

exp = ',_setLeads:function(a){i=a}}}()'
if s.count(exp) != 1:
    raise RuntimeError(f'ancora export esperado 1 vez, encontrado {s.count(exp)}')
s = s.replace(exp, ',_medirExecucaoFila:medirExecucaoFila,_setLeads:function(a){i=a}}}()', 1)

css_add = r'''

/* FILA OPERACIONAL v2 — Fatia 6: indicadores de execução.
   Faixa compacta: mede ritmo e bloqueio operacional sem virar dashboard. */
.fila-exec{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;
  margin:0 0 10px;border:1px solid var(--line);border-radius:var(--radius-p);
  overflow:hidden;background:var(--line)
}
.fila-exec-cel{min-width:0;padding:8px 10px;background:var(--bg)}
.fila-exec-rot{
  font-family:var(--mono);font-size:8.5px;letter-spacing:.11em;text-transform:uppercase;color:var(--dim)
}
.fila-exec-num{
  margin-top:1px;font-family:var(--display);font-size:18px;font-weight:600;line-height:1.1;
  font-variant-numeric:tabular-nums;color:var(--text)
}
.fila-exec-pe{margin-top:2px;font-size:10.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fila-exec-alerta .fila-exec-num{color:var(--quente-fg)}
.fila-exec-canal .fila-exec-num{color:var(--erro-fg)}
@media (max-width:560px){
  .fila-exec{grid-template-columns:repeat(2,minmax(0,1fr))}
  .fila-exec-pe{white-space:normal}
}
'''
if '.fila-exec{' in c:
    raise RuntimeError('CSS Fatia 6 ja existe')
c += css_add

app.write_text(s, encoding='utf-8')
css.write_text(c, encoding='utf-8')
print('PATCH_FATIA6_OK')
