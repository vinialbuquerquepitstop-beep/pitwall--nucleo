window.PitWall=function(){"use strict";var a="https://unjzpyexgtbcmjfgcqrx.supabase.co",e="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuanpweWV4Z3RiY21qZmdjcXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMTgyOTQsImV4cCI6MjA5ODY5NDI5NH0.SDH7Wa7z4jS6M4unhZcKRJJbrrTvi9jXkbs9JqdM-ZU",o=JSON.parse(JSON.stringify({condicao:{lacrado:"Lacrado",vitrine:"Vitrine",seminovo:"Seminovo"},status:{pendente:"Pendente",feito:"Feito",convertido:"Convertido",lista_fria:"Lista fria",cancelado:"Cancelado"},perfil:{compra_imediata:"Lead — Compra imediata",avaliando:"Lead — Avaliando",em_espera:"Lead — Em espera",repescagem:"Lead — Repescagem",comprou:"Lead — Comprou",consulta:"Lead — Consulta"},origem:{indicacao:"Indicação",instagram:"Instagram",whatsapp_direto:"WhatsApp direto",loja_fisica:"Loja física",prospeccao_ativa:"Prospecção ativa",parceria_influencer:"Parceria influencer",parceria_pag_local:"Parceria PAG local",whatsapp_status:"WhatsApp Status"},nivel:{quente:"Quente",morno:"Morno",frio:"Frio"}})),t=null,i=[],n="hoje",r=null;function c(a){return String(null==a?"":a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function d(a){(a||[]).forEach(function(a){a&&a.dominio&&a.codigo&&(o[a.dominio]||(o[a.dominio]={}),o[a.dominio][a.codigo]=a.rotulo)})}function s(a,e){return e?o[a]&&o[a][e]||e:""}function l(a){var e=a||new Date,o=String(e.getMonth()+1),t=String(e.getDate());return e.getFullYear()+"-"+(o.length<2?"0"+o:o)+"-"+(t.length<2?"0"+t:t)}function u(a){if(!a)return null;var e=new Date(a);return isNaN(e.getTime())?null:l(e)}function p(a,e){if(!a)return 0;var o=new Date(a+"T12:00:00"),t=new Date(e+"T12:00:00");return Math.round((t-o)/864e5)}function m(a,e){return!(!a||"pendente"!==a.status)&&(!(!a.proximo_contato||a.proximo_contato>e)&&u(a.ultimo_toque_em)!==e)}function v(a,e){return(a||[]).filter(function(a){return m(a,e)}).sort(function(a,e){return a.proximo_contato!==e.proximo_contato?a.proximo_contato<e.proximo_contato?-1:1:String(a.nome||"").localeCompare(String(e.nome||""))})}function g(a,e){var o=String(e||"").trim().toLowerCase();return o?(a||[]).filter(function(a){return String(a.nome||"").toLowerCase().indexOf(o)>=0||String(a.whatsapp_digitos||"").indexOf(o.replace(/\D/g,"")||"\0")>=0||String(a.produto||"").toLowerCase().indexOf(o)>=0}):(a||[]).slice()}function f(a){var e=String(a||"").replace(/\D/g,"");if(!e)return"";var o="",t=e;return t.length>11&&"55"===t.slice(0,2)&&(o="+55 ",t=t.slice(2)),11===t.length?o+"("+t.slice(0,2)+") "+t.slice(2,7)+"-"+t.slice(7):10===t.length?o+"("+t.slice(0,2)+") "+t.slice(2,6)+"-"+t.slice(6):o+t}function filtClientes(a){return(a||[]).filter(function(le){return le&&"comprou"===le.perfil})}function fxSinal(a,i){var r=a.respondido_em,t=a.ultimo_toque_em;if(r&&(!t||new Date(r)>=new Date(t)))return['sn-andamento',"Em andamento"];if(!a.proximo_contato)return['sn-fila',"Sem data"];if(i>0)return['sn-urgente',"Urgente \u00b7 "+i+"d"];if(0===i)return['sn-pendente',"Pendente"];return['sn-fila',"Na fila"]}function fxCol(rot,val,vazio){return'<div class="card-col"><div class="col-rot">'+rot+'</div><div class="col-val'+(val?'">'+val:' vazio">'+vazio)+"</div></div>"}function fxFila(a,i){var sn=fxSinal(a,i),tel=f(a.whatsapp_digitos),ini=String(a.nome||"?").trim().charAt(0).toUpperCase()||"?",prod=c(a.produto||"")+(a.condicao?' <span class="cond">\u00b7 '+c(s("condicao",a.condicao))+"</span>":"");return'<div class="card-linha">'+'<div class="card-av" aria-hidden="true">'+c(ini)+"</div>"+'<div class="card-id"><div class="card-nome">'+c(a.nome||"")+'</div>'+'<div class="card-code">'+c(a.lead_code||"")+(tel?' <span class="card-tel-in">\u00b7 '+c(tel)+"</span>":"")+"</div></div>"+fxCol("produto",prod,"sem produto")+fxCol("origem",c(s("origem",a.origem)),"sem origem")+'<div class="card-dir"><span class="chip est '+sn[0]+'">'+c(sn[1])+"</span>"+(a.id?'<button class="btn-editar" data-acao="editar" data-id="'+c(a.id)+'">Editar</button>':"")+"</div></div>"}function fxCli(a){var p=[];if(a.qtd_compras>0)p.push('<span class="cli-seg">'+a.qtd_compras+(a.qtd_compras>1?" compras":" compra")+"</span>");if(a.valor_total>0)p.push('<span class="cli-seg">R$ '+Number(a.valor_total).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+"</span>");if(a.data_nascimento){var d=String(a.data_nascimento).split("-");3===d.length&&p.push('<span class="cli-seg">aniv. '+d[2]+"/"+d[1]+"</span>")}return p.length?'<div class="card-cliente">'+p.join("")+"</div>":""}function _(a){return(a||[]).filter(function(a){return a&&"indicacao"===a.origem})}function b(a){if(!a||!0!==a.consentimento)return null;var e=String(a.whatsapp_digitos||"").replace(/\D/g,"");if(!e)return null;var o="Oi "+(a.nome||"")+"! Vi seu interesse no "+(a.produto||"aparelho")+", posso te passar as condicoes?";return"https://wa.me/"+e+"?text="+encodeURIComponent(o)}function h(a){var e=String(a&&a.whatsapp_digitos||"").replace(/\D/g,"");return e?"https://wa.me/"+e:null}function C(a,e){var o=new Date(a+"T12:00:00");return o.setDate(o.getDate()+(e||0)),l(o)}function w(a){return a&&String(a.nome||"").trim()?String(a.whatsapp||"").replace(/\D/g,"")?String(a.produto||"").trim()?String(a.condicao||"").trim()?String(a.perfil||"").trim()?String(a.origem||"").trim()?"indicacao"!==a.origem||String(a.indicado_por||"").trim()?{ok:!0,msg:""}:{ok:!1,msg:"Indicado por e obrigatorio quando a origem e Indicacao"}:{ok:!1,msg:"Origem obrigatoria"}:{ok:!1,msg:"Perfil obrigatorio"}:{ok:!1,msg:"Condicao obrigatoria"}:{ok:!1,msg:"Produto obrigatorio"}:{ok:!1,msg:"WhatsApp obrigatorio"}:{ok:!1,msg:"Nome obrigatorio"}}function S(a){return a&&String(a.nome||"").trim()?String(a.produto||"").trim()?String(a.condicao||"").trim()?String(a.perfil||"").trim()?String(a.origem||"").trim()?"indicacao"!==a.origem||String(a.indicado_por||"").trim()?{ok:!0,msg:""}:{ok:!1,msg:"Indicado por e obrigatorio quando a origem e Indicacao"}:{ok:!1,msg:"Origem obrigatoria"}:{ok:!1,msg:"Perfil obrigatorio"}:{ok:!1,msg:"Condicao obrigatoria"}:{ok:!1,msg:"Produto obrigatorio"}:{ok:!1,msg:"Nome obrigatorio"}}function x(a,e,o){var t=a.nivel||"quente",i="fila"===e?p(a.proximo_contato,o):0,n=[];a.perfil&&n.push('<span class="chip">'+c(s("perfil",a.perfil))+"</span>"),"morno"!==t&&"frio"!==t&&"sem_contato"!==t||n.push('<span class="chip nivel-'+t+'">'+c(s("nivel",t))+"</span>"),"fila"!==e&&a.status&&n.push('<span class="chip st-'+a.status+'">'+c(s("status",a.status))+"</span>"),"indicacao"===a.origem&&a.indicado_por&&n.push('<span class="chip ind">Ind. por '+c(a.indicado_por)+"</span>");var r,d="";"number"==typeof a.dias_silencio&&(d='<div class="silencio'+(a.dias_silencio>=3?" alerta":"")+'">'+a.dias_silencio+"d sem resposta</div>");var l="fila"===e?b(a):h(a);if(l){var u="fila"===e?"Chamar no WhatsApp":"Abrir conversa";r='<a class="btn-wa" target="_blank" rel="noopener" href="'+c(l)+'"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path></svg>'+u+"</a>"}else r=String(a.whatsapp_digitos||"").trim()?'<div class="sem-tel">Sem consentimento</div>':'<div class="sem-tel">Sem telefone na base</div>';if("fila"===e&&a.id){r='<button class="btn-acao sugerir" data-acao="sugerir" data-id="'+c(a.id)+'">Sugerir mensagem</button>'+filaWaCard(a)}var m=a.observacoes?'<div class="obs">'+c(a.observacoes)+"</div>":"",v="",ve="";if("fila"===e&&a.id){var g=c(a.id);ve='<span class="acoes-escrita"><button class="btn-acao toque" data-acao="toque" data-id="'+g+'">Toque enviado</button><button class="btn-acao" data-acao="leque" data-id="'+g+'">Desfecho</button></span>',v='<div class="desfechos"><button class="btn-desf respondeu" data-acao="respondeu" data-id="'+g+'">Respondeu</button><button class="btn-desf" data-acao="conversando" data-id="'+g+'">Conversando</button><button class="btn-desf" data-acao="retomar" data-id="'+g+'">Retomar</button><button class="btn-desf ok" data-acao="fechou" data-id="'+g+'">Fechou</button><button class="btn-desf frio" data-acao="sem-interesse" data-id="'+g+'">Sem interesse</button></div><div class="retomar"><input type="date" value="'+c(C(o,1))+'" aria-label="Retomar em"><button class="btn-desf" data-acao="retomar-ok" data-id="'+g+'">Confirmar</button></div>'}var _=f(a.whatsapp_digitos),w=_?'<div class="card-tel">'+c(_)+"</div>":"";return'<article class="card t-'+c(t)+'" data-lead="'+c(a.lead_code||"")+'">'+("fila"===e?fxFila(a,i):'<div class="card-topo"><div class="card-nome">'+c(a.nome||"")+'</div><div class="card-topo-dir"><div class="card-code">'+c(a.lead_code||"")+"</div>"+(a.id?'<button class="btn-editar" data-acao="editar" data-id="'+c(a.id)+'">Editar</button>':"")+'</div></div><div class="card-prod">'+c(a.produto||"")+(a.condicao?' <span class="cond">· '+c(s("condicao",a.condicao))+"</span>":"")+"</div>")+("fila"===e?"":w)+("clientes"===e?fxCli(a):"")+'<div class="chips">'+n.join("")+"</div>"+d+m+'<div class="card-acoes">'+r+(a.id?'<button class="btn-acao" data-acao="historico" data-id="'+c(a.id)+'">Histórico</button>':"")+ve+"</div>"+("fila"===e&&a.id?'<div class="scripts" data-scripts></div>':"")+(a.id?'<div class="hist" data-hist></div>':"")+v+"</article>"}function N(a,e,o,t,i){e.length?a.innerHTML=e.map(function(a){return x(a,o,t)}).join(""):a.innerHTML=i}function k(){var a=l(),e=E("lista"),o=i.filter(function(a){return!a.arquivado_em});if(E("abaFila").setAttribute("aria-selected","fila"===n?"true":"false"),E("abaTodos").setAttribute("aria-selected","todos"===n?"true":"false"),E("abaVendas")&&E("abaVendas").setAttribute("aria-selected","vendas"===n?"true":"false"),E("abaNfs")&&E("abaNfs").setAttribute("aria-selected","nfs"===n?"true":"false"),E("abaClientes")&&E("abaClientes").setAttribute("aria-selected","clientes"===n?"true":"false"),E("abaIndicacoes").setAttribute("aria-selected","indicacoes"===n?"true":"false"),E("abaDash")&&E("abaDash").setAttribute("aria-selected","dashboard"===n?"true":"false"),E("abaCaptacao")&&E("abaCaptacao").setAttribute("aria-selected","captacao"===n?"true":"false"),E("abaHoje")&&E("abaHoje").setAttribute("aria-selected","hoje"===n?"true":"false"),E("abaConteudo")&&E("abaConteudo").setAttribute("aria-selected","conteudo"===n?"true":"false"),E("abaRotina")&&E("abaRotina").setAttribute("aria-selected","rotina"===n?"true":"false"),E("abaEscopo")&&E("abaEscopo").setAttribute("aria-selected","escopo"===n?"true":"false"),E("abaMais")&&(E("abaMais").setAttribute("aria-selected",["indicacoes","captacao","dashboard","rotina","nfs","escopo"].indexOf(n)>=0?"true":"false"),E("abaMais").setAttribute("aria-expanded","false")),E("abas")&&(E("abas").className="abas"),E("topoTit")&&(E("topoTit").textContent="fila"===n?"Fila do dia":"vendas"===n?"Vendas":"nfs"===n?"Notas fiscais":"todos"===n?"Todos":"clientes"===n?"Clientes":"indicacoes"===n?"Indicações":"captacao"===n?"Captação":"hoje"===n?"Hoje":"conteudo"===n?"Conteúdo":"escopo"===n?"Escopo":"rotina"===n?"Rotina":"Dashboard"),E("topoSub")&&(E("topoSub").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"short",year:"numeric"})),E("blocoBusca").className="busca"+("todos"===n||"clientes"===n||"vendas"===n||"nfs"===n?" visivel":""),E("lista")&&E("lista").setAttribute("data-aba",n),E("pitboard")&&(E("pitboard").className="pitboard"+(["captacao","hoje","conteudo","rotina","dashboard","nfs","vendas","clientes","indicacoes","escopo"].indexOf(n)>=0?" oculto":"")),"fila"===n){N(e,v(o,a),"fila",a,'<div class="estado"><strong>Fila limpa.</strong><br>Nenhum lead vence hoje. O proximo entra sozinho na data marcada.</div>');prefetchFilaSug(24).then(filaWaAtualizar)}else if("hoje"===n)renderHoje();else if("conteudo"===n)renderConteudo();else if("rotina"===n)renderRotina();else if("escopo"===n)renderEscopo();else if("captacao"===n)renderCaptacao();else if("dashboard"===n)renderDash();else if("indicacoes"===n)N(e,_(o),"indicacoes",a,'<div class="estado"><strong>Nenhuma indicacao ainda.</strong><br>Leads com origem Indicacao aparecem aqui, com quem indicou.</div>');else if("vendas"===n)renderVendas(e);else if("nfs"===n)renderNfs(e);else if("clientes"===n)renderClientes(e);else{N(e,g(o,E("inputBusca").value),"todos",a,'<div class="estado">Nenhum lead corresponde a busca. Ajuste o termo ou limpe o campo.</div>')}E("rodape").textContent=r?"v_lead · leitura "+r+" · Fase 2 · escrita ativa":""}function E(a){return document.getElementById(a)}var L=null;function I(a,e){var o=E("toast");o&&(o.textContent=a,o.className="toast visivel"+(e?" erro":""),L&&clearTimeout(L),L=setTimeout(function(){o.className="toast"},3200))}async function O(a,e,o){o&&(o.disabled=!0);var i=await t.rpc(a,e);if(o&&(o.disabled=!1),i.error){if(await pwSemSessao())return pwSessaoCaiu(),null;return I("Falha: "+i.error.message,!0),null}return i.data||null}async function q(a,e,o,t,op){var i=await O(a,e,o);i&&(!1!==i.ok?(I(t||i.msg||"Feito"),aposAcao(op)):I(i.msg||"Operacao recusada",!0))}function abaDeLead(){return"fila"===n||"todos"===n||"indicacoes"===n}function reRenderAba(sil){var e=E("lista");if("hoje"===n)return renderHoje(sil);if("conteudo"===n)return renderConteudo(sil);if("rotina"===n)return renderRotina(sil);if("escopo"===n)return renderEscopo(sil);if("captacao"===n)return renderCaptacao(sil);if("dashboard"===n)return renderDash(sil);if("vendas"===n)return renderVendas(e,sil);if("nfs"===n)return renderNfs(e,sil);if("clientes"===n)return renderClientes(e,sil);return B(!0)}function aposAcao(op){if(op&&op.amplo)return B(!0);if(op&&op.lead&&op.card&&abaDeLead())return trocarCard(op.lead,op.card);if(abaDeLead())return B(!0);return reRenderAba(!0)}async function trocarCard(id,card){if(filaSug)delete filaSug[id];var r=await t.from("v_lead").select("*").eq("id",id);if(r.error){if(await pwSemSessao())return pwSessaoCaiu();return void I("Falha ao reler o lead: "+r.error.message,!0)}var novo=r.data&&r.data[0]||null,hj=l(),j;for(j=0;j<i.length;j++)if(i[j].id===id){novo?i[j]=novo:i.splice(j,1);break}pb(hj);if(!novo||novo.arquivado_em||("fila"===n&&!m(novo,hj))){var pai=card.parentNode;if(pai)pai.removeChild(card);if(pai&&!pai.querySelector(".card"))k();return}card.outerHTML=x(novo,n,hj);if("fila"===n)prefetchFilaSug(24).then(filaWaAtualizar)}function histAtor(tipo){if("fechou"===tipo||"respondeu"===tipo)return"ok";if("sem_interesse"===tipo||"arquivado"===tipo)return"fim";if("cadencia_iniciada"===tipo||"cadencia_avancou"===tipo||"cadencia_encerrada"===tipo||"perfil_transicionado"===tipo||"esfriado_por_silencio"===tipo)return"regua";return"operador"}function histLinha(ev){var autor=ev.autor||"Régua";var q=String(ev.quando||"").replace(/^(\d{2}\/\d{2})\/\d{4} /,"$1 ");var det=ev.detalhe?'<div class="hist-'+("nota"===ev.tipo?"nota-txt":"det")+'">'+c(ev.detalhe)+"</div>":"";return'<li class="hist-ev ator-'+histAtor(ev.tipo)+'"><div class="hist-quando">'+c(q)+'</div><div class="hist-marca"><span class="hist-ponto"></span></div><div class="hist-corpo"><div class="hist-rot">'+c(ev.rotulo||ev.tipo||"")+' <span class="hist-autor">· '+c(autor)+'</span></div>'+det+"</div></li>"}function histTopo(id){return'<div class="hist-topo"><div class="hist-tit">Histórico</div><button class="btn-nota" data-acao="nota" data-id="'+c(id)+'">+ Nota</button></div>'}function histForm(id){return'<div class="hist-form"><textarea placeholder="O que aconteceu? A nota entra no histórico e não pode ser apagada."></textarea><div class="hist-form-pe"><input type="date" value="'+c(l())+'" aria-label="Data da nota"><button class="btn-nota ok" data-acao="nota-ok" data-id="'+c(id)+'">Registrar</button></div></div>'}function pintarHist(cont,id,evs){var lista=evs&&evs.length?'<ol class="hist-lista">'+evs.map(histLinha).join("")+"</ol>":'<div class="hist-vazio">Nenhum evento ainda.</div>';cont.innerHTML=histTopo(id)+histForm(id)+lista}function histErro(f,msg){var v=f.querySelector(".hist-erro");v&&v.parentNode.removeChild(v);var d=document.createElement("div");d.className="hist-erro";d.textContent=msg;var pe=f.querySelector(".hist-form-pe");pe?f.insertBefore(d,pe):f.appendChild(d)}function alternarNota(card){var f=card.querySelector(".hist-form");if(!f)return;var ab=f.className.indexOf("aberto")>=0;f.className="hist-form"+(ab?"":" aberto");if(!ab){var ta=f.querySelector("textarea");ta&&ta.focus()}}async function abrirHistorico(id,btn,card){var cont=card.querySelector("[data-hist]");if(!cont)return;if(cont.className.indexOf("aberto")>=0){cont.className="hist";cont.innerHTML="";if(btn)btn.className="btn-acao";return}cont.className="hist aberto";cont.innerHTML=histTopo(id)+'<div class="hist-vazio">Buscando histórico...</div>';if(btn){btn.disabled=!0;btn.className="btn-acao ligado"}var res=await t.rpc("historico_lead",{p_lead_id:id});if(btn)btn.disabled=!1;if(res.error){cont.innerHTML=histTopo(id)+'<div class="hist-vazio">Falha: '+c(res.error.message)+"</div>";return}var d=res.data;if(!d||!1===d.ok){cont.innerHTML=histTopo(id)+'<div class="hist-vazio">'+c(d&&d.msg||"Sem histórico")+"</div>";return}pintarHist(cont,id,d.eventos||[])}async function registrarNota(id,btn,card){var f=card.querySelector(".hist-form");if(!f)return;var ta=f.querySelector("textarea"),dt=f.querySelector('input[type=date]');var txt=ta?String(ta.value):"";if(!txt.trim()){histErro(f,"Escreva a nota antes de registrar.");return}var args={p_lead_id:id,p_texto:txt};if(dt&&dt.value)args.p_data=dt.value;if(btn)btn.disabled=!0;var res=await t.rpc("registrar_nota",args);if(btn)btn.disabled=!1;if(res.error){histErro(f,"Falha: "+res.error.message);return}var d=res.data;if(!d||!1===d.ok){histErro(f,d&&d.msg||"Nota recusada");return}I(d.msg||"Nota registrada");var cont=card.querySelector("[data-hist]");var r2=await t.rpc("historico_lead",{p_lead_id:id});cont&&r2&&!r2.error&&r2.data&&pintarHist(cont,id,r2.data.eventos||[])}function viraCheck(b){b.setAttribute("aria-checked","true"===b.getAttribute("aria-checked")?"false":"true")}function tiraLinha(b){var p=b.parentNode;if(p&&p.parentNode)p.parentNode.removeChild(p)}function pbCel(cod){var l=E("lista");return l?l.querySelector('.pb-celula[data-cel="'+cod+'"]'):null}function pbTexto(cel,cls,txt){if(!cel)return;var el=cel.querySelector(cls);if(el)el.textContent=txt}function hojePlacarAtualiza(){var l=E("lista");if(!l)return;var j,ts=l.querySelectorAll('[data-acao="dia-marcar"]'),f=0,ls=l.querySelectorAll('[data-acao="lemb-marcar"]'),ab=0;for(j=0;j<ts.length;j++)if("true"===ts[j].getAttribute("aria-checked"))f++;for(j=0;j<ls.length;j++)if("true"!==ls[j].getAttribute("aria-checked"))ab++;var cr=pbCel("rotina");pbTexto(cr,".pb-num",(ts.length?Math.round(100*f/ts.length):0)+"%");pbTexto(cr,".pb-pe",f+" de "+ts.length+" feitas");pbTexto(pbCel("lembretes"),".pb-num",String(ab))}function hojeQuieto(){renderHoje(!0)}function capCel(rot,num,pe,cod){return'<div class="pb-celula" data-cel="'+c(cod||rot)+'"><div class="pb-rot">'+c(rot)+'</div><div class="pb-num">'+c(String(num))+'</div><div class="pb-pe">'+c(pe)+'</div></div>'}function capPlacar(p){var tot=p.total||0;return'<div class="pitboard">'+capCel("hoje",p.feitas||0,"de "+(p.alvo||0)+" na meta")+capCel("abordadas",tot,"desde o início")+capCel("viraram lead",p.leads_gerados||0,"de "+tot+" abordadas")+capCel("não abordar",p.pararam||0,"pediram para parar")+"</div>"}function capRegistro(){var o=(capFrentes||[]).map(function(f){return'<option value="'+c(f.codigo)+'">'+c(f.rotulo)+"</option>"}).join("");return'<div class="cap-reg"><div class="cap-reg-lin"><select id="capFrente" aria-label="Frente">'+o+'</select>'+'<input class="ident" id="capIdent" placeholder="@perfil" aria-label="Perfil abordado" autocomplete="off">'+'<button class="btn-cap" data-acao="cap-registrar">Registrar</button></div>'+'<div id="capMsg"></div>'+'<button class="cap-mais" data-acao="cap-mais">+ nome e observação</button>'+'<div class="cap-det" id="capDet"><input id="capNome" placeholder="Nome (opcional)" aria-label="Nome">'+'<textarea id="capObs" placeholder="Observação (opcional)"></textarea></div></div>'}function capLinha(x){var nome=x.nome?'<div class="cap-nome">'+c(x.nome)+"</div>":"";var fim,cls="";if(x.parou){fim='<span class="cap-selo">não abordar</span>';cls=" parou"}else if(x.virou_lead){fim='<span class="cap-virou">virou lead</span>';cls=" virou"}else fim='<button class="btn-parar" data-acao="cap-parar" data-id="'+c(x.id)+'">parar</button>';return'<div class="cap-lin'+cls+'"><div class="cap-hora">'+c(x.hora||"")+'</div>'+'<div class="cap-quem"><div class="cap-ident">'+c(x.identificador||"")+"</div>"+nome+"</div>"+'<div class="cap-frente">'+c(x.frente_rotulo||x.frente||"")+"</div>"+'<div class="cap-fim">'+fim+"</div></div>"}function capLog(linhas){if(!linhas||!linhas.length)return'<div class="cap-log"><div class="cap-vazio"><div class="cap-vazio-t">Nenhuma abordagem hoje.</div><div class="cap-vazio-s">A meta '+(capAlvo?"são "+capAlvo:"do dia")+'. Comece pelo campo acima.</div></div></div>';return'<div class="cap-log"><div class="cap-log-cab"><span>hora</span><span>quem</span><span>frente</span><span></span></div>'+linhas.map(capLinha).join("")+"</div>"}var capFrentes=[],capAlvo=0;async function renderCaptacao(sil){var e=E("lista");if(!sil)e.innerHTML='<div class="estado carregando">Lendo a captação...</div>';if(!capFrentes.length){  var rf=await t.from("captacao_frente").select("codigo,rotulo,ordem,ativo").order("ordem",{ascending:!0});  if(!rf.error&&rf.data)capFrentes=rf.data.filter(function(f){return f.ativo});}var rp=await t.rpc("placar_captacao",{});var rl=await t.rpc("captacao_do_dia",{});if(rp.error||rl.error){  e.innerHTML='<div class="estado erro">Falha ao ler a captação: '+c((rp.error||rl.error).message)+". Toque em Atualizar para tentar de novo.</div>";return}var p=rp.data||{},lg=rl.data||{};capAlvo=p.alvo||0;if(E("topoSub"))E("topoSub").textContent=E("topoSub").textContent+" · "+(p.feitas||0)+" de "+(p.alvo||0)+" hoje";if(E("badgeCaptacao"))E("badgeCaptacao").textContent=p.feitas?String(p.feitas):"";e.innerHTML=capPlacar(p)+capRegistro()+capLog(lg.linhas||[]);}function capMsg(cls,msg){var d=E("capMsg");if(d)d.innerHTML=msg?'<div class="cap-msg '+cls+'">'+c(msg)+"</div>":""}function alternarCapDet(btn){var d=E("capDet");if(!d)return;var ab=d.className.indexOf("aberto")>=0;d.className="cap-det"+(ab?"":" aberto");if(btn)btn.textContent=ab?"+ nome e observação":"− nome e observação";if(!ab&&E("capNome"))E("capNome").focus()}async function registrarCaptacao(btn){var f=E("capFrente"),id=E("capIdent");if(!f||!id)return;var ident=String(id.value||"").trim();if(!ident){capMsg("erro","Digite o @perfil antes de registrar.");id.focus();return}var args={p_frente:f.value,p_identificador:ident};var nm=E("capNome"),ob=E("capObs");if(nm&&nm.value.trim())args.p_nome=nm.value;if(ob&&ob.value.trim())args.p_observacoes=ob.value;if(btn)btn.disabled=!0;var res=await t.rpc("registrar_captacao",args);if(btn)btn.disabled=!1;if(res.error){capMsg("erro","Falha: "+res.error.message);return}var d=res.data;if(!d||!1===d.ok){capMsg(d&&d.duplicado?"erro":"parada",d&&d.msg||"Abordagem recusada");return}I(d.msg||"Abordagem registrada");await renderCaptacao();var novo=E("capIdent");if(novo)novo.focus()}async function pararCaptacao(id,btn){if(!id)return;if(btn)btn.disabled=!0;var res=await t.rpc("registrar_opt_out",{p_captacao_id:id});if(btn)btn.disabled=!1;if(res.error){I("Falha: "+res.error.message,!0);return}var d=res.data;if(!d||!1===d.ok){I(d&&d.msg||"Nao foi possivel marcar",!0);return}I(d.msg||"Marcada como nao abordar");await renderCaptacao()}function capKeydown(a){if("Enter"!==a.key)return;var alvo=a.target;if(!alvo||!alvo.id)return;var mapa={capIdent:"cap-registrar",diaNovoTit:"dia-add",lembNovo:"lemb-add",rotNovoTit:"rot-add-tarefa",rotNovaCatRot:"rot-add-cat"},acao=mapa[alvo.id];if(!acao)return;a.preventDefault();var b=E("lista").querySelector('[data-acao="'+acao+'"]');b&&("cap-registrar"===acao?registrarCaptacao(b):b.click())}var DIAS_ISO=["","seg","ter","qua","qui","sex","sáb","dom"];function diasTxt(a){return a&&a.length?a.map(function(d){return DIAS_ISO[d]||"?"}).join(" · "):"todos os dias"}function svgCheck(){return'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'}function rotSlug(a){return String(a||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")}function fmtDia(a){if(!a)return"";var d=new Date(a+"T12:00:00");return isNaN(d.getTime())?String(a):d.toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"})}// A regua e o motor do CRM: se ela para, a fila mente em silencio.
// Esta linha e o unico lugar onde o operador ve que ela esta viva.
function reguaLinha(r){
if(!r||null==r.ok)return '<div class="sync-lin">régua nunca rodou</div>';
if(false===r.ok)return '<div class="sync-lin falha">régua falhou · '+c(r.erro||"erro desconhecido")+"</div>";
var velha=r.horas>=26,at=r.atrasados||0;
var txt=at?at+" lead"+(1===at?"":"s")+" atrasado"+(1===at?"":"s"):"nada atrasado";
return '<div class="sync-lin'+(velha?" velho":"")+'">régua rodou há '+c(String(r.horas))+"h · "+c(txt)+(velha?" · atrasada":"")+"</div>"}
function syncLinha(s){if(!s||null==s.ok)return'<div class="sync-lin">sync nunca rodou</div>';if(!1===s.ok)return'<div class="sync-lin falha">último sync falhou · '+c(s.msg||"")+"</div>";var v=s.horas>=24;return'<div class="sync-lin'+(v?" velho":"")+'">sincronizado há '+c(String(s.horas))+"h"+(v?" · atrasado":"")+"</div>"}async function qF(nome,args,btn,depois){var i=await O(nome,args,btn);i&&(!1!==i.ok?(I(i.msg||"Feito"),depois&&depois()):I(i.msg||"Operação recusada",!0))}function contItem(x){var sub=x.tipo_rotulo||x.semana?'<div class="cont-tipo">'+c(x.tipo_rotulo||"")+(x.semana?(x.tipo_rotulo?" · ":"")+c(x.semana):"")+"</div>":"";return'<div class="cont-lin"><div class="cont-tit">'+c(x.titulo||"")+sub+"</div>"+(x.status_rotulo?'<span class="chip">'+c(x.status_rotulo)+"</span>":"")+(x.url?'<a class="cont-link" target="_blank" rel="noopener" href="'+c(x.url)+'">Notion</a>':"")+"</div>"}function hojePlacar(d){var g=d.contagem||{},f=g.feitas||0,tt=g.total||0,pct=tt?Math.round(100*f/tt):0,ab=(d.lembretes||[]).filter(function(x){return!x.feito}).length,s=d.sync||{},sn,sp,sc="";null==s.ok?(sn="—",sp="sync nunca rodou"):!1===s.ok?(sn="—",sp="último sync falhou",sc=" falha"):(sn=s.horas+"h",sp="desde o último sync",s.horas>=24&&(sc=" velho"));return'<div class="pitboard">'+capCel("rotina",pct+"%",f+" de "+tt+" feitas","rotina")+capCel("conteúdo",(d.conteudo||[]).length,"peças hoje","conteudo")+capCel("lembretes",ab,"em aberto","lembretes")+'<div class="pb-celula"><div class="pb-rot">sync</div><div class="pb-num">'+c(sn)+'</div><div class="pb-pe'+sc+'">'+c(sp)+"</div></div></div>"}function hojeTarefas(d){var cats=d.categorias||[],corpo,ops="";cats.forEach(function(x){!1!==x.ativa&&(ops+='<option value="'+c(x.codigo)+'">'+c(x.rotulo)+"</option>")});corpo=cats.length?cats.map(function(ct){var ts=(ct.tarefas||[]).map(function(x){return'<div class="dia-lin"><button class="dia-tarefa" role="checkbox" aria-checked="'+(x.concluida?"true":"false")+'" data-acao="dia-marcar" data-id="'+c(x.id)+'"><span class="dia-check">'+svgCheck()+'</span><span class="dia-tit">'+c(x.titulo||"")+"</span></button><button class=\"dia-rm\" data-acao=\"dia-remover\" data-id=\""+c(x.id)+'">remover</button></div>'}).join("");return'<div class="dia-cat-rot" style="--tr:'+trilhoDe(ct.codigo)+'">'+iconeCat(ct.codigo)+c(ct.rotulo||ct.codigo)+"</div>"+(ts||'<div class="dia-vazio">Nada nesta categoria hoje.</div>')}).join(""):'<div class="dia-vazio">A rotina de hoje está vazia. O molde se digita na aba Rotina; o dia nasce dele de manhã, ou puxe agora.</div>';var add=ops?'<div class="dia-add"><input id="diaNovoTit" placeholder="Tarefa avulsa de hoje…" autocomplete="off"><select id="diaNovaCat" aria-label="Categoria">'+ops+'</select><button class="btn-acao" data-acao="dia-add">Adicionar</button></div>':"";return'<div class="dia-sec"><div class="dia-sec-cab"><div class="dia-sec-tit">Rotina do dia</div><button class="btn-nota" data-acao="dia-puxar">Puxar do molde</button></div>'+corpo+add+"</div>"}function hojeNota(d){return'<div class="dia-sec"><div class="dia-sec-tit">Nota do dia</div><div class="dia-nota"><textarea id="diaNota" placeholder="O que não pode se perder do dia…">'+c(d.nota||"")+'</textarea></div><div class="dia-nota-pe"><button class="btn-acao" data-acao="dia-nota-ok">Salvar nota</button></div></div>'}function nivelPonto(nv){return'<span class="fila-ponto n-'+c(nv||"quente")+'" aria-hidden="true"></span>'}var filaSug={};function filaEnviarHTML(a){var h=filaSug[a.id];return h?'<a class="btn-wa fila-wa" target="_blank" rel="noopener" href="'+h+'">Enviar</a>':""}function filaWaCard(a){var d=String(a.whatsapp_digitos||"").replace(/\D/g,"");if(!d)return'<div class="sem-tel card-wa-linha">Sem telefone na base</div>';if(!0!==a.consentimento)return'<div class="sem-tel card-wa-linha">Sem consentimento</div>';var h=(filaSug||{})[a.id]||"https://wa.me/"+d;return'<a class="btn-wa card-wa-linha" target="_blank" rel="noopener" data-wa-lead="'+c(a.id)+'" href="'+c(h)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z" stroke-linecap="round" stroke-linejoin="round"></path></svg>Chamar no WhatsApp</a>'}function filaWaAtualizar(){[].forEach.call(document.querySelectorAll("[data-wa-lead]"),function(el){var h=(filaSug||{})[el.getAttribute("data-wa-lead")];if(h)el.setAttribute("href",h)})}async function prefetchFilaSug(lim){if(!filaSug)filaSug={};var ativos=(i||[]).filter(function(x){return!x.arquivado_em}),top=v(ativos,l()).slice(0,lim||5);await Promise.all(top.map(async function(a){if(!a||!0!==a.consentimento)return;if(filaSug[a.id])return;var dig=String(a.whatsapp_digitos||"").replace(/\D/g,"");if(!dig)return;try{var res=await t.rpc("sugerir_mensagem",{p_lead_id:a.id});var dd=res&&res.data;if(!dd||!1===dd.ok)return;var ops=dd.opcoes||[];if(!ops.length||!ops[0]||!ops[0].texto)return;filaSug[a.id]="https://wa.me/"+dig+"?text="+encodeURIComponent(ops[0].texto)}catch(e){}}))}function hojeFilaLin(a){var nv=a.nivel||"quente",atr=p(a.proximo_contato,l()),tag=atr>0?'<span class="fila-atraso">'+atr+"d de atraso</span>":"";return'<div class="fila-lin" data-lead="'+c(a.lead_code||"")+'"><div class="fila-lin-topo"><div class="fila-ident">'+nivelPonto(nv)+'<span class="fila-nome">'+c(a.nome||"")+'</span><span class="fila-nivel n-'+c(nv)+'">'+c(s("nivel",nv))+'</span></div><span class="fila-cad">'+(a.perfil?c(s("perfil",a.perfil)):"")+"</span>"+tag+'<button class="btn-acao sugerir fila-sug" data-acao="hoje-sugerir" data-id="'+c(a.id)+'">Sugerir</button>'+filaEnviarHTML(a)+'</div><div class="scripts" data-scripts></div></div>'}function hojeFila(d){var ativos=(i||[]).filter(function(x){return!x.arquivado_em}),fila=v(ativos,l());if(!fila.length)return'<div class="dia-sec"><div class="dia-sec-tit">Fila de hoje</div><div class="dia-vazio">Fila zerada hoje. Nada vencendo.</div></div>';var top=fila.slice(0,5).map(hojeFilaLin).join("");return'<div class="dia-sec"><div class="dia-sec-cab"><div class="dia-sec-tit">Fila de hoje</div><button class="fila-vertodos" data-acao="hoje-verfila">ver todos ('+fila.length+')</button></div>'+top+"</div>"}function hojeLembretes(d){var ls=(d.lembretes||[]).map(function(x){var _lc="dia-lin"+(x.vencido?" lemb-vencido":x.agendado?" lemb-agendado":""),_lt=x.vencido?'<span class="lemb-tag venc">'+(p(x.data,l())<=1?"venceu ontem":"atrasado "+p(x.data,l())+" dias")+"</span>":x.agendado?'<span class="lemb-tag agnd">agendado pra hoje</span>':"";return'<div class="'+_lc+'"><button class="dia-tarefa" role="checkbox" aria-checked="'+(x.feito?"true":"false")+'" data-acao="lemb-marcar" data-id="'+c(x.id)+'"><span class="dia-check">'+svgCheck()+'</span><span class="dia-tit">'+c(x.texto||"")+"</span>"+_lt+"</button><button class=\"dia-rm\" data-acao=\"lemb-remover\" data-id=\""+c(x.id)+'">remover</button></div>'}).join("");return'<div class="dia-sec"><div class="dia-sec-tit">Lembretes</div>'+(ls||'<div class="dia-vazio">Nenhum lembrete para hoje.</div>')+'<div class="dia-add"><input id="lembNovo" placeholder="Novo lembrete…" autocomplete="off"><input type="date" id="lembData" value="'+c(l())+'" aria-label="Dia do lembrete"><button class="btn-acao" data-acao="lemb-add">Adicionar</button></div><div class="lemb-quando"><button class="lemb-q" data-acao="lemb-hoje">Hoje</button><button class="lemb-q" data-acao="lemb-amanha">Amanha</button></div></div>'}// Card RETANGULAR do dia. A aba Hoje e onde o dia se confere e se fecha, entao a
// peca ocupa a linha inteira: o que se precisa saber (tipo, semana, status) e o
// que se precisa fazer (marcar publicada, aferir) ficam no mesmo card, sem
// abrir outra aba. O card estreito do kanban (contCard) continua na aba
// Conteudo, onde a largura e a da coluna.
// Peca ainda nao marcada como publicada mostra "Publiquei" em vez de Aferir:
// aferir alcance de peca que o sistema acha que nem foi ao ar seria numero solto.
function hojeContCard(x){
var pub="publicado"===x.status_codigo,desc="descartado"===x.status_codigo;
var st=x.status_rotulo?'<span class="dia-cont-st'+(pub?" pub":"")+'">'+c(x.status_rotulo)+"</span>":"";
var sem=x.semana?'<span class="dia-cont-sem">'+c(x.semana)+"</span>":"";
var lk=x.url?'<a class="cont-link" target="_blank" rel="noopener" href="'+c(x.url)+'">Notion</a>':"";
var acao=pub?contMetrica(x):desc?"":
'<div class="cont-met"><div class="cont-met-vazio">ainda não marcada como publicada</div>'+
'<button class="cont-met-btn publiquei" data-acao="cont-publiquei" data-id="'+c(x.id)+'">Publiquei</button></div>';
return'<div class="dia-cont-card tipo-'+c(x.tipo_codigo||"outro")+'" style="--tp:'+tipoDe(x.tipo_codigo)+'">'+
'<div class="dia-cont-cab"><span class="dia-cont-tipo">'+iconeTipo(x.tipo_codigo)+c(x.tipo_rotulo||"Peça")+"</span>"+sem+st+lk+"</div>"+
'<div class="dia-cont-tit">'+c(x.titulo||"")+"</div>"+acao+"</div>"}
// Contagem no cabecalho pelo mesmo motivo da aba Conteudo: numero de afericao
// sem o total de publicadas nao diz se o dia foi conferido inteiro ou pela metade.
function hojeContPlacar(l){
var pub=0,afe=0,i;
for(i=0;i<l.length;i++){if("publicado"===l[i].status_codigo){pub++;if(l[i].metrica)afe++}}
return'<span class="dia-cont-placar">'+l.length+" peça"+(1===l.length?"":"s")+" · "+pub+" publicada"+(1===pub?"":"s")+" · "+afe+" aferida"+(1===afe?"":"s")+"</span>"}
function hojeConteudo(d){var l=d.conteudo||[],itens=l.map(hojeContCard).join("");return'<div class="dia-sec"><div class="dia-sec-cab"><div class="dia-sec-tit">Conteúdo de hoje</div>'+(l.length?hojeContPlacar(l):"")+syncLinha(d.sync)+"</div>"+(itens?'<div class="dia-cont-lista">'+itens+"</div>":'<div class="dia-vazio">Nada no calendário para hoje.</div>')+"</div>"}async function renderHoje(sil){var e=E("lista");if(!sil)e.innerHTML='<div class="estado carregando">Lendo o dia…</div>';var r=await t.rpc("painel_do_dia",{});if(r.error)return void(e.innerHTML='<div class="estado erro">Falha ao ler o dia: '+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");var d=r.data;if(!d||!1===d.ok)return void(e.innerHTML='<div class="estado erro">'+c(d&&d.msg||"Falha ao ler o dia.")+"</div>");await prefetchFilaSug();e.innerHTML=hojePlacar(d)+reguaLinha(d.regua)+hojeFila(d)+hojeTarefas(d)+hojeConteudo(d)+hojeLembretes(d)+hojeNota(d)}
var CONT_COLUNAS=[
{cod:"a_produzir",rot:"A produzir"},
{cod:"em_producao",rot:"Em produção"},
{cod:"pronto",rot:"Pronto"},
{cod:"publicado",rot:"Publicado"}];
// A janela vem de conteudo_fonte (janela_atras_dias / janela_frente_dias),
// nunca daqui: numero de janela chumbado no JS e reprovado por validar.py.
// Ela recorta o que a coluna Publicado consegue mostrar, e na base real isso
// e uma fracao do total. Por isso o cabecalho DECLARA a janela: sem isso a
// tela mente por omissao, e mentir sobre publicacao e exatamente o defeito
// que esta obra veio consertar.
function contUltimaPub(itens){
var ult=null,i=0;
for(;i<itens.length;i++)if("publicado"===itens[i].status_codigo&&(!ult||itens[i].data>ult))ult=itens[i].data;
if(!ult)return'<span class="cont-pub nenhuma">nenhuma publicação na janela</span>';
var dd=Math.round((new Date(l()+"T12:00:00")-new Date(ult+"T12:00:00"))/864e5);
return'<span class="cont-pub'+(dd>=3?" alerta":"")+'">última publicação há '+dd+(1===dd?" dia":" dias")+"</span>"}
// MESMA regra do trilho, aplicada ao tipo de peca: a barra da esquerda diz
// QUEM A PECA E (Story / Reels / Feed), e a urgencia fica na data, no selo
// "vencida" e no fundo tingido. Barra = identidade, chip = urgencia, sempre.
// Separacao por luminancia entre os tres e fraca (1.18 a 1.53), igual a dos
// trilhos: quem separa e o matiz mais o ICONE mais a palavra. Tipo sem icone
// e regressao.
// O Notion tem QUATRO tipos, nao tres: Reels, Story, Carrossel, Feed.
// Carrossel tem 0 cards hoje, entao nao aparecia em teste nenhum, mas
// cairia no fallback cinza no dia que o dono criasse um.
var TIPO_MAPA={story:"--tp-story",reels:"--tp-reels",feed:"--tp-feed",carrossel:"--tp-carrossel"};
function tipoDe(cod){
var k=String(cod||"");
return TIPO_MAPA[k]?"var("+TIPO_MAPA[k]+")":"var(--line-forte)"}
var ICONE_TIPO={
story:'<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.4"/>',
reels:'<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M10 9.5l5 2.5-5 2.5z" stroke-linejoin="round"/>',
feed:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
carrossel:'<rect x="7" y="4" width="13" height="16" rx="2"/><path d="M4 7v12a1.5 1.5 0 0 0 1.5 1.5H16" stroke-linecap="round"/>'};
function iconeTipo(cod){
return'<svg class="tp-ico" viewBox="0 0 24 24" aria-hidden="true">'+(ICONE_TIPO[String(cod||"")]||'<circle cx="12" cy="12" r="7"/>')+"</svg>"}
// ---- Afericao da peca publicada (25/07/2026) ----
// NAO se chama "toque": toque e acao sobre um LEAD e freia cadencia (invariante 2).
// Afericao e leitura sobre uma PECA e nao freia nada. Nomes separados de proposito,
// para as duas coisas nunca colapsarem numa so.
// So aparece em peca PUBLICADA e com data <= hoje (fuso do Brasil, invariante 10):
// medir alcance de coisa que ainda nao foi ao ar seria inventar dado, e a RPC
// registrar_metrica_conteudo recusa do mesmo jeito.
// O item vindo do painel_do_dia nao carrega data em versao antiga do backend:
// nesse caso vale o status, que ja e o filtro que importa.
function fmtNum(n){return Number(n||0).toLocaleString("pt-BR")}
function contAferivel(x){
return"publicado"===x.status_codigo&&(!x.data||String(x.data)<=l())}
// Numero sem idade nao se interpreta: o mesmo reels medido em D+0 e em D+7 sao
// dois numeros diferentes. Por isso a linha sempre diz quando foi lido.
function contMetricaNums(m){
var p=[];
if(null!=m.alcance)p.push('<span class="cont-met-par"><span class="cont-met-num">'+fmtNum(m.alcance)+"</span> alcance</span>");
if(null!=m.conversas)p.push('<span class="cont-met-par"><span class="cont-met-num">'+fmtNum(m.conversas)+"</span> conversa"+(1===m.conversas?"":"s")+"</span>");
var d=m.medido_dias,q=null==d?"":0===d?"medido hoje":1===d?"medido ontem":"medido há "+d+" dias";
return'<div class="cont-met-nums">'+p.join("")+"</div>"+(q?'<div class="cont-met-quando">'+q+"</div>":"")}
// Depois de "Publiquei", o formulario ja nasce aberto: quem acabou de dizer que
// postou esta com o numero na mao, e um clique a mais so faz perder a afericao.
var AFERIR_ABRIR=null;
function contMetrica(x){
if(!contAferivel(x))return"";
var id=c(x.id),m=x.metrica,ab=AFERIR_ABRIR===x.id?" aberto":"";
if(ab)AFERIR_ABRIR=null;
return'<div class="cont-met'+ab+'">'+(m?contMetricaNums(m):'<div class="cont-met-vazio">sem aferição</div>')+
'<button class="cont-met-btn" data-acao="cont-aferir" data-id="'+id+'">'+(m?"Aferir de novo":"Aferir")+"</button>"+
'<div class="cont-met-form"><label class="cont-met-campo"><span>alcance</span><input type="number" inputmode="numeric" min="0" step="1" data-af="alcance"></label>'+
'<label class="cont-met-campo"><span>conversas</span><input type="number" inputmode="numeric" min="0" step="1" data-af="conversas"></label>'+
'<div class="cont-met-acoes"><button class="cont-met-ok" data-acao="cont-aferir-ok" data-id="'+id+'">Salvar</button>'+
'<button class="cont-met-cancel" data-acao="cont-aferir-cancel">Cancelar</button></div></div></div>'}
// "Publiquei" reusa a MESMA escrita do botao Mover do kanban (Edge Function
// mover-conteudo -> PATCH no Notion). O Notion segue fonte unica: se o PATCH
// falhar, nada muda aqui e o toast diz. Ordem: Notion primeiro, tela depois.
async function marcarPublicado(id,btn){
if(btn){btn.disabled=!0;btn.textContent="Marcando…"}
var r=await t.functions.invoke("mover-conteudo",{body:{id:id,para:"publicado"}});
if(btn){btn.disabled=!1;btn.textContent="Publiquei"}
if(r.error)return void I("Falha ao marcar: "+(r.error.message||"erro de rede"),!0);
var d=r.data;
if(!d||!1===d.ok)return void I(d&&d.msg||"Nao consegui marcar como publicada",!0);
I(d.aviso||"Marcada como publicada");
AFERIR_ABRIR=id;
if("hoje"===n)await renderHoje();else if("conteudo"===n)await renderConteudo(!0);
var alvo=E("lista").querySelector('.cont-met.aberto input[data-af="alcance"]');
if(alvo)alvo.focus()}
// Correcao entra como nova linha (a tabela e append-only): a mais recente vale.
async function salvarAfericao(id,btn){
var box=btn&&btn.closest?btn.closest(".cont-met"):null;
if(!box)return;
var ea=box.querySelector('input[data-af="alcance"]'),ec=box.querySelector('input[data-af="conversas"]');
var sa=String(ea&&ea.value||"").trim(),sc=String(ec&&ec.value||"").trim();
if(""===sa&&""===sc)return void I("Digite alcance ou conversas",!0);
var args={p_conteudo_id:id},na,nc;
if(""!==sa){na=Math.round(Number(sa));if(isNaN(na)||na<0)return void I("Alcance inválido",!0);args.p_alcance=na}
if(""!==sc){nc=Math.round(Number(sc));if(isNaN(nc)||nc<0)return void I("Conversas inválidas",!0);args.p_conversas=nc}
var r=await O("registrar_metrica_conteudo",args,btn);
if(!r)return;
if(!1===r.ok)return void I(r.msg||"Aferição recusada",!0);
I("Aferido");
"conteudo"===n?renderConteudo(!0):"hoje"===n?renderHoje():"dashboard"===n&&renderDash()}
function contMoverCtl(x){var ops=CONT_COLUNAS.filter(function(col){return col.cod!==x.status_codigo}).map(function(col){return'<button class="cont-mover-op" data-acao="cont-mover-para" data-id="'+c(x.id)+'" data-col="'+c(col.cod)+'">'+c(col.rot)+"</button>"}).join("");return'<div class="cont-mover-wrap"><button class="cont-mover" data-acao="cont-mover" aria-expanded="false" aria-label="Mover para outra coluna">Mover</button><div class="cont-mover-menu">'+ops+"</div></div>"}function contCard(x,mover){
var nv=nivelPeca(x.data,x.status_codigo);
var sub=x.tipo_rotulo||x.semana?'<div class="cont-tipo">'+iconeTipo(x.tipo_codigo)+c(x.tipo_rotulo||"")+(x.semana?(x.tipo_rotulo?" · ":"")+c(x.semana):"")+"</div>":"";
var mvAtt=mover?' draggable="true" data-id="'+c(x.id)+'" data-col="'+c(x.status_codigo)+'"':"";var mvCtl=mover?contMoverCtl(x):"";return'<div class="cont-card nivel-'+nv+' tipo-'+c(x.tipo_codigo||"outro")+'"'+mvAtt+' style="--tp:'+tipoDe(x.tipo_codigo)+'"><div class="cont-data-chip">'+c(fmtDia(x.data))+("vencido"===nv?'<span class="cont-venc">vencida</span>':"")+'</div><div class="cont-tit">'+c(x.titulo||"")+"</div>"+sub+(x.url?'<a class="cont-link" target="_blank" rel="noopener" href="'+c(x.url)+'">Notion</a>':"")+contMetrica(x)+mvCtl+"</div>"}
function contColuna(col,itens){
var meus=itens.filter(function(x){return x.status_codigo===col.cod}).sort(function(a,b){return a.data<b.data?-1:a.data>b.data?1:0});
var venc=meus.filter(function(x){return"vencido"===nivelPeca(x.data,x.status_codigo)}).length;
return'<div class="cont-col" data-col="'+c(col.cod)+'"><div class="cont-col-cab"><span class="cont-col-rot">'+c(col.rot)+'</span><span class="cont-col-n">'+meus.length+"</span>"+(venc?'<span class="cont-col-venc">'+venc+" vencida"+(1===venc?"":"s")+"</span>":"")+"</div>"+(meus.length?meus.map(function(x){return contCard(x,true)}).join(""):'<div class="cont-col-vazio">vazia</div>')+"</div>"}
async function renderConteudo(silencioso){
var e=E("lista");
if(!silencioso)e.innerHTML='<div class="estado carregando">Lendo o calendário…</div>';
var r=await t.rpc("conteudo_periodo",{});
if(r.error)return void(e.innerHTML='<div class="estado erro">Falha ao ler o conteúdo: '+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");
var d=r.data;
if(!d||!1===d.ok)return void(e.innerHTML='<div class="estado erro">'+c(d&&d.msg||"Falha ao ler o conteúdo.")+"</div>");
var itens=d.itens||[];
var topo='<div class="cont-topo"><div class="cont-topo-esq"><span class="cont-janela">'+c(fmtDia(d.ini))+" a "+c(fmtDia(d.fim))+"</span>"+contUltimaPub(itens)+"</div>"+syncLinha(d.sync)+'<button class="btn-sync" data-acao="sync-agora">Sincronizar</button></div>';
if(!itens.length)return void(e.innerHTML=topo+'<div class="estado"><strong>Calendário vazio na janela.</strong>De '+c(fmtDia(d.ini))+" a "+c(fmtDia(d.fim))+", nenhuma peça com Data no Notion."+(null==(d.sync||{}).ok?" O sync nunca rodou: toque em Sincronizar.":"")+"</div>");
var desc=itens.filter(function(x){return"descartado"===x.status_codigo});
var kan='<div class="cont-kanban">'+CONT_COLUNAS.map(function(col){return contColuna(col,itens)}).join("")+"</div>";
var dsc=desc.length?'<div class="cont-desc"><button class="cont-desc-cab" data-acao="cont-descartado" aria-expanded="false">Descartado <span class="cont-col-n">'+desc.length+'</span></button><div class="cont-desc-corpo">'+desc.map(function(x){return contCard(x)}).join("")+"</div></div>":"";
e.innerHTML=topo+kan+dsc}async function sincronizarAgora(btn){btn&&(btn.disabled=!0,btn.textContent="Sincronizando…");var r=await t.functions.invoke("sincronizar-conteudo",{body:{origem:"manual"}});btn&&(btn.disabled=!1,btn.textContent="Sincronizar");if(r.error)I("Falha ao sincronizar: "+(r.error.message||"erro de rede"),!0);else{var d=r.data;d&&!1!==d.ok?I("Sincronizado"):I(d&&(d.msg||d.fontes&&d.fontes[0]&&d.fontes[0].msg)||"Sync falhou",!0)}"conteudo"===n?renderConteudo():"hoje"===n&&renderHoje()}

// ==========================================================================
// Aba Dashboard: de onde veio (origem) x o que rendeu (conteudo)
// ==========================================================================
// Ate 25/07/2026 esta aba era moldura vazia, com o recado "as metricas ainda nao
// foram definidas". Foram definidas: origem do lead cruzada com venda, e
// desempenho da peca publicada.
// Regras que a tela nao pode quebrar:
// - DECLARAR a janela e o criterio, senao o painel mente por omissao (o mesmo
//   defeito que a aba Conteudo consertou na v33).
// - Publicadas x aferidas aparecem SEMPRE juntas: "1.240 de alcance" sobre 2 de
//   9 pecas nao e o alcance da janela, e a tela tem que dizer isso.
// - R$ vendido (tabela venda, lastro linha a linha) e R$ historico (agregado
//   herdado do CRM, sem lastro) NUNCA se somam: sao numeros de confianca
//   diferente, e somar produziria um terceiro que ninguem pode auditar.
var METRICA_DIAS=90;
function metBarra(v,max){
var p=max>0?Math.round(100*v/max):0;
return'<div class="met-barra"><i style="width:'+(v>0&&p<3?3:p)+'%"></i></div>'}
function metLinOrigem(x,max){
return'<div class="met-lin"><div class="met-lin-topo"><span class="met-lin-rot">'+c(x.rotulo)+'</span><span class="met-lin-val">'+brlV(x.valor_venda)+"</span></div>"+
metBarra(x.leads,max)+
'<div class="met-lin-pe">'+fmtNum(x.leads)+" lead"+(1===x.leads?"":"s")+" · "+fmtNum(x.clientes)+" cliente"+(1===x.clientes?"":"s")+" · "+x.taxa+"%"+
(Number(x.valor_historico)>0?'<span class="met-lin-hist">histórico '+brlV(x.valor_historico)+"</span>":"")+"</div></div>"}
function metOrigem(d){
var it=(d.origem||{}).itens||[],tt=(d.origem||{}).total||{},max=0,i;
for(i=0;i<it.length;i++)if(it[i].leads>max)max=it[i].leads;
var corpo=it.length?it.map(function(x){return metLinOrigem(x,max)}).join(""):
'<div class="estado"><strong>Nenhum lead nesta janela.</strong>Amplie o período acima.</div>';
return'<section class="met-sec"><div class="met-sec-cab"><h2 class="met-sec-tit">De onde veio</h2>'+
'<span class="met-sec-tot">'+fmtNum(tt.leads||0)+" leads · "+fmtNum(tt.clientes||0)+" viraram cliente</span></div>"+
'<p class="met-nota">Conta o lead cujo <strong>primeiro contato</strong> caiu na janela, e o R$ que ele gerou mesmo que a venda tenha saído depois.</p>'+
corpo+
'<p class="met-rodape">R$ vendido soma a tabela <code>venda</code>, linha a linha. O “histórico” é o agregado herdado do CRM antigo, sem lastro por venda: os dois não se somam.</p></section>'}
function metTipoChip(x){
return'<span class="met-tipo" style="--tp:'+tipoDe(x.codigo)+'">'+iconeTipo(x.codigo)+
'<span class="met-tipo-rot">'+c(x.rotulo)+"</span>"+
'<span class="met-tipo-num">'+fmtNum(x.publicadas)+" pub · "+fmtNum(x.afericoes)+" afer</span>"+
(x.afericoes>0?'<span class="met-tipo-num forte">· '+fmtNum(x.conversas)+" conversas</span>":"")+"</span>"}
function metPeca(x){
var nums=null==x.medido_em?'<span class="met-peca-sem">sem aferição</span>':
'<span class="met-peca-nums">'+(null!=x.alcance?'<b>'+fmtNum(x.alcance)+"</b> alcance":"")+
(null!=x.alcance&&null!=x.conversas?" · ":"")+
(null!=x.conversas?"<b>"+fmtNum(x.conversas)+"</b> conversa"+(1===x.conversas?"":"s"):"")+"</span>";
return'<div class="met-peca" style="--tp:'+tipoDe(x.tipo_codigo)+'">'+iconeTipo(x.tipo_codigo)+
'<span class="met-peca-tit">'+c(x.titulo)+"</span>"+
'<span class="met-peca-data">'+c(fmtDia(x.data))+"</span>"+nums+"</div>"}
function metConteudo(d){
var bl=d.conteudo||{},tt=bl.total||{},pecas=bl.pecas||[],tipos=bl.por_tipo||[];
var aferidas=pecas.filter(function(x){return null!=x.medido_em}),
    cruas=pecas.length-aferidas.length;
var cab='<div class="met-sec-cab"><h2 class="met-sec-tit">O que rendeu</h2><span class="met-sec-tot'+
  (tt.afericoes<tt.publicadas?" alerta":"")+'">'+fmtNum(tt.publicadas||0)+" publicadas · "+fmtNum(tt.afericoes||0)+" aferidas</span></div>";
if(!pecas.length)return'<section class="met-sec">'+cab+
'<div class="estado"><strong>Nenhuma peça publicada na janela.</strong>Peça entra aqui quando o status no Notion vira Publicado.</div></section>';
var corpo=aferidas.length?aferidas.map(metPeca).join(""):
'<div class="estado"><strong>Nenhuma peça aferida ainda.</strong>Abra a aba Conteúdo, coluna Publicado, e toque em Aferir. São dois números: alcance e conversas.</div>';
var resto=cruas>0?'<p class="met-rodape">'+fmtNum(cruas)+" peça"+(1===cruas?"":"s")+" publicada"+(1===cruas?"":"s")+
  " ainda sem aferição. Enquanto isso, o total acima cobre só "+fmtNum(tt.afericoes||0)+" de "+fmtNum(tt.publicadas||0)+".</p>":"";
return'<section class="met-sec">'+cab+
'<div class="met-tipos">'+tipos.map(metTipoChip).join("")+"</div>"+
'<p class="met-nota">Ordenado por conversas: no topo fica o que mais puxou conversa, não o que teve mais alcance.</p>'+
corpo+resto+"</section>"}
function metTopo(d){
var op=[[30,"30 dias"],[90,"90 dias"],[365,"12 meses"]].map(function(x){
return'<button class="met-faixa" data-acao="met-janela" data-dias="'+x[0]+'" aria-pressed="'+(METRICA_DIAS===x[0]?"true":"false")+'">'+x[1]+"</button>"}).join("");
return'<div class="met-topo"><span class="met-janela">'+c(fmtDia(d.ini))+" a "+c(fmtDia(d.fim))+'</span><div class="met-faixas">'+op+"</div></div>"}
// O dashboard de vendas entra ACIMA das metricas de lead/conteudo que ja viviam
// aqui. Nao substitui: as duas respondem perguntas diferentes (o de cima e
// dinheiro fechado, o de baixo e captacao e conteudo) e tem janelas proprias,
// declaradas cada uma no seu cabecalho.
// A falha do painel_metricas NAO derruba mais a tela inteira: o dashboard de
// vendas sai do dado local e continua util mesmo se a RPC cair.
async function renderDash(sil){
var e=E("lista");
if(!sil)e.innerHTML='<div class="estado carregando">Somando…</div>';
var rv=await carregarVendas(),ra=await carregarVendasArq();
var fv=primeiraFalha(rv,ra);
if(fv&&!1===fv.sessao)return;
var topo=fv?estadoErro("as vendas",fv.erro):dvPainel();
var r=await t.rpc("painel_metricas",{p_ini:C(l(),-(METRICA_DIAS-1)),p_fim:l()});
if(r.error)return void(e.innerHTML=topo+'<div class="estado erro">Falha ao ler as métricas: '+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");
var d=r.data;
if(!d||!1===d.ok)return void(e.innerHTML=topo+'<div class="estado erro">'+c(d&&d.msg||"Falha ao ler as métricas.")+"</div>");
e.innerHTML=topo+metTopo(d)+metOrigem(d)+metConteudo(d)}
function rotCargaBarra(n){
var mx=Math.max.apply(null,n.slice(1,8))||1,i=1,out="";
for(;i<=7;i++){
var alt=Math.round(100*n[i]/mx);
out+='<div class="rot-carga-cel"><div class="rot-carga-num">'+n[i]+'</div><div class="rot-carga-tubo"><div class="rot-carga-fita" style="height:'+alt+'%"></div></div><div class="rot-carga-dia">'+DIAS_ISO[i]+"</div></div>"}
return'<div class="rot-carga" aria-label="Carga de tarefas por dia da semana">'+out+"</div>"}
// O botao remove a tarefa do MOLDE INTEIRO, nao daquele dia. Numa grade por dia
// o rotulo "remover" leria como "tirar da segunda", que seria mentira: a mesma
// tarefa aparece em varias colunas e some de todas. Por isso o rotulo e explicito.
function rotCelula(par,pode){
var t=par.tarefa,ct=par.cat;
return'<div class="rot-cel" style="--tr:'+trilhoDe(ct.codigo)+'">'+iconeCat(ct.codigo)+'<span class="rot-cel-cat">'+c(ct.rotulo||ct.codigo)+'</span>'+(pode?'<button class="rot-rm" data-acao="rot-rm-tarefa" data-id="'+c(t.id)+'" title="Remover do molde (some de todos os dias)" aria-label="Remover do molde">×</button>':"")+'<span class="rot-cel-tit">'+c(t.titulo||"")+"</span></div>"}
// A grade so mostra categoria que TEM tarefa. Sem esta legenda, criar uma
// categoria nova nao produz nenhum sinal na tela e parece que falhou. Ela
// tambem e onde o dono aprende o que cada cor de trilho significa.
function rotLegenda(cats){
var itens=(cats||[]).map(function(ct){
var n=(ct.tarefas||[]).length;
return'<span class="rot-leg-item" style="--tr:'+trilhoDe(ct.codigo)+'">'+iconeCat(ct.codigo)+c(ct.rotulo||ct.codigo)+'<span class="rot-leg-n">'+n+"</span></span>"}).join("");
return itens?'<div class="rot-leg">'+itens+"</div>":""}
function rotGrade(cats,pode){
var hj=new Date(l()+"T12:00:00").getDay();
hj=0===hj?7:hj;
var i=1,out="";
for(;i<=7;i++){
var itens=tarefasDoDia(cats,i);
out+='<div class="rot-col'+(i===hj?" hoje":"")+'" data-dia="'+i+'"><div class="rot-col-cab">'+DIAS_ISO[i]+'<span class="rot-col-n">'+itens.length+"</span></div>"+(itens.length?itens.map(function(p){return rotCelula(p,pode)}).join(""):'<div class="rot-col-vazio">livre</div>')+"</div>"}
return'<div class="rot-grade">'+out+"</div>"}
// Aba Escopo. A NOTA NAO E CALCULADA AQUI: ela vem pronta de
// escopo_completo(), derivada na leitura, no fuso do Brasil. Duplicar a
// conta no JS criaria duas verdades para o mesmo numero.
var ESC_ICONES={"pessoas":"<circle cx=\"9\" cy=\"8\" r=\"3.2\"/><path d=\"M3.5 19a5.5 5.5 0 0 1 11 0\" stroke-linecap=\"round\"/><path d=\"M16 6.2a3.2 3.2 0 0 1 0 6M17.5 19a5.5 5.5 0 0 0-1.6-3.9\" stroke-linecap=\"round\"/>","megafone":"<path d=\"M4 10v4h3l7 4V6l-7 4H4z\" stroke-linejoin=\"round\"/><path d=\"M17.5 9a4 4 0 0 1 0 6\" stroke-linecap=\"round\"/>","chave":"<circle cx=\"8\" cy=\"8\" r=\"3.4\"/><path d=\"M10.4 10.4L20 20M17 17l-2 2M14 14l-2 2\" stroke-linecap=\"round\"/>","alvo":"<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"3.2\"/><path d=\"M12 2v3M12 19v3M2 12h3M19 12h3\" stroke-linecap=\"round\"/>","balao":"<path d=\"M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V6z\" stroke-linejoin=\"round\"/>","escudo":"<path d=\"M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z\" stroke-linejoin=\"round\"/>","etiqueta":"<path d=\"M4 11V5a1 1 0 0 1 1-1h6l9 9-7 7-9-9z\" stroke-linejoin=\"round\"/><circle cx=\"8\" cy=\"8\" r=\"1.2\"/>","calculadora":"<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h4\" stroke-linecap=\"round\"/>","alerta":"<path d=\"M12 4l9 16H3l9-16z\" stroke-linejoin=\"round\"/><path d=\"M12 10v4M12 17h.01\" stroke-linecap=\"round\"/>"};
var ESC_STATUS={a_fazer:"a fazer",fazendo:"fazendo",travado:"travado",feito:"feito"};
function escFaixaRot(f){
return"a_frente"===f?"a frente":"normal"===f?"normal":"em_baixa"===f?"em baixa":"sem dado"}
// Frente nova criada pela tela (Fatia 3) pode nao ter icone conhecido: cai no
// alvo em vez de virar buraco. Trilho sem icone e regressao.
function escIcone(k){
var p=ESC_ICONES[k]||ESC_ICONES.alvo;
return'<svg viewBox="0 0 24 24" aria-hidden="true">'+p+"</svg>"}
// A nota nunca aparece sozinha: as tres parcelas vao do lado. Nota escondida
// vira fe, e ninguem discute com fe.
function escPlacar(fs){
if(!fs||!fs.length)return"";
var lin=fs.filter(function(f){return"pendencia"!==f.grupo}).map(function(f){
var sd="sem_dado"===f.faixa,
par=sd?"nenhuma ação registrada":f.feitas+"/"+f.total+" feitas · "+f.travadas+" travada"+(1===f.travadas?"":"s")+(null==f.dias_parada?"":" · "+f.dias_parada+"d");
return'<div class="esc-linha f-'+c(f.faixa)+'"><span class="esc-linha-nome">'+c(f.rotulo)+'</span><span class="esc-nota">'+(sd?"--":c(String(f.nota)))+'</span><span class="esc-faixa">'+c(escFaixaRot(f.faixa))+'</span><span class="esc-parcelas">'+c(par)+"</span></div>"}).join("");
return'<div class="esc-placar">'+lin+"</div>"}
function escFrente(fr,pode){
var ac=(fr.acoes||[]).map(function(a){
// O chip carrega a classe do status nos DOIS caminhos: quem pode editar ve
// botao, quem nao pode ve texto, e os dois pintam igual. Chip sem a classe
// deixaria o leitor sem a cor de travado.
var bt=pode?'<button class="esc-chip s-'+c(a.status)+'" data-acao="esc-status" data-id="'+c(a.id)+'" data-st="'+c(a.status)+'">'+c(ESC_STATUS[a.status]||a.status)+'</button><button class="link-acao esc-travar" data-acao="esc-travar" data-id="'+c(a.id)+'" data-st="'+c(a.status)+'">'+("travado"===a.status?"destravar":"travar")+'</button><button class="link-acao" data-acao="esc-desc" data-id="'+c(a.id)+'" aria-label="Descartar">×</button>':'<span class="esc-chip s-'+c(a.status)+'">'+c(ESC_STATUS[a.status]||a.status)+"</span>";
return'<div class="esc-acao"><span class="esc-acao-txt">'+c(a.titulo)+(a.motivo_trava?'<div class="esc-trava">trava: '+c(a.motivo_trava)+"</div>":"")+"</span>"+bt+"</div>"}).join("")||'<div class="esc-acao"><span class="esc-acao-txt">Nenhuma ação aqui ainda.</span></div>';
var form=pode?'<div class="esc-form"><input type="text" maxlength="160" id="escNovo_'+c(fr.codigo)+'" placeholder="Nova ação nesta frente" autocomplete="off"><button class="link-acao" data-acao="esc-criar" data-frente="'+c(fr.codigo)+'">Adicionar</button></div>':"";
return'<div class="esc-frente'+("pendencia"===fr.grupo?" esc-pend":"")+'"><div class="esc-frente-cab">'+escIcone(fr.icone)+'<span class="esc-frente-tit">'+c(fr.rotulo)+'</span><span class="esc-frente-cont">'+c(fr.feitas+"/"+fr.total)+"</span></div>"+ac+form+"</div>"}
async function renderEscopo(sil){
var e=E("lista");
if(!sil)e.innerHTML='<div class="estado carregando">Lendo o escopo…</div>';
var r=await t.rpc("escopo_completo",{});
if(r.error)return void(e.innerHTML='<div class="estado erro">Falha ao ler o escopo: '+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");
var d=r.data;
if(!d||!1===d.ok)return void(e.innerHTML='<div class="estado erro">'+c(d&&d.msg||"Falha ao ler o escopo.")+"</div>");
var fr=d.frentes||[],pode=!0===d.pode_editar;
e.innerHTML=fr.length?escPlacar(fr)+fr.map(function(x){return escFrente(x,pode)}).join(""):'<div class="estado"><strong>O escopo está vazio.</strong>Nenhuma frente cadastrada.</div>'}
async function renderRotina(sil){
var e=E("lista");
if(!sil)e.innerHTML='<div class="estado carregando">Lendo o molde…</div>';
var r=await t.rpc("rotina_completa",{});
if(r.error)return void(e.innerHTML='<div class="estado erro">Falha ao ler a rotina: '+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");
var d=r.data;
if(!d||!1===d.ok)return void(e.innerHTML='<div class="estado erro">'+c(d&&d.msg||"Falha ao ler a rotina.")+"</div>");
var pode=!0===d.pode_editar,cats=d.categorias||[],corpo,forms="";
corpo=cats.length?rotCargaBarra(cargaSemana(cats))+rotLegenda(cats)+rotGrade(cats,pode):'<div class="estado"><strong>O molde está vazio.</strong>'+(pode?"Crie a primeira categoria abaixo. As tarefas do molde viram o checklist da aba Hoje, todo dia.":"O dono ainda não digitou o molde da rotina.")+"</div>";
if(pode){
var ops=cats.map(function(x){return'<option value="'+c(x.codigo)+'">'+c(x.rotulo)+"</option>"}).join(""),
togs=[1,2,3,4,5,6,7].map(function(i){return'<button class="rot-dia-tog" data-acao="rot-dia" data-dia="'+i+'" aria-pressed="false">'+DIAS_ISO[i]+"</button>"}).join("");
forms='<div class="dia-sec">'+(cats.length?'<div class="dia-sec-tit">Nova tarefa no molde</div><div class="rot-form"><div class="rot-form-lin"><input id="rotNovoTit" placeholder="Título da tarefa…" autocomplete="off"><select id="rotNovaCat" aria-label="Categoria">'+ops+'</select></div><div class="rot-form-lin">'+togs+'<span class="rot-dica">nenhum dia marcado = todo dia</span></div><div class="rot-form-lin"><button class="btn-acao" data-acao="rot-add-tarefa">Adicionar tarefa</button></div></div>':"")+'<div class="rot-form"><div class="dia-sec-tit">Nova categoria</div><div class="rot-form-lin"><input id="rotNovaCatRot" placeholder="Nome da categoria (ex: Atendimento e Vendas)" autocomplete="off"><button class="btn-acao" data-acao="rot-add-cat">Criar categoria</button></div></div></div>'}
e.innerHTML=corpo+forms}
var TRILHO_MAPA={fila_follow_up:"--tr-fila-follow-up",captacao:"--tr-captacao",conteudo:"--tr-conteudo",loja_estoque:"--tr-loja-estoque",pos_venda:"--tr-pos-venda",analise:"--tr-analise",fechamento:"--tr-fechamento"};
var TRILHO_ANEL=["--tr-fila-follow-up","--tr-captacao","--tr-conteudo","--tr-loja-estoque","--tr-pos-venda","--tr-analise","--tr-fechamento"];
// Categoria nova entra pelo anel, por hash do CODIGO (invariante 12: nunca o rotulo).
// Deterministico: a mesma categoria recebe a mesma cor em toda sessao.
function trilhoDe(cod){
var k=String(cod||"");
if(TRILHO_MAPA[k])return"var("+TRILHO_MAPA[k]+")";
var h=0,i=0;for(;i<k.length;i++)h=(h*31+k.charCodeAt(i))>>>0;
return"var("+TRILHO_ANEL[h%7]+")"}
var ICONE_MAPA={
fila_follow_up:'<path d="M4 7h10M4 12h16M4 17h7" stroke-linecap="round"/>',
captacao:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/>',
conteudo:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16" stroke-linecap="round"/>',
loja_estoque:'<path d="M4 8h16l-1 12H5L4 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke-linecap="round"/>',
pos_venda:'<path d="M12 21s-7-4.5-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 3.5c0 5-7 9.5-7 9.5z" stroke-linejoin="round"/>',
analise:'<path d="M5 19V11M12 19V5M19 19v-6" stroke-linecap="round"/>',
fechamento:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2" stroke-linecap="round"/>'};
// O icone NAO e enfeite: as colisoes de luminancia entre trilho e cor semantica
// ficam entre 1.14 e 1.44, entao matiz sozinho nao distingue. Trilho sem icone
// e regressao.
function iconeCat(cod){
return'<svg class="tr-ico" viewBox="0 0 24 24" aria-hidden="true">'+(ICONE_MAPA[String(cod||"")]||'<circle cx="12" cy="12" r="7"/>')+"</svg>"}
// Nivel DERIVADO na leitura (invariante 4), nunca coluna no banco.
// Usa l() (hoje no fuso do Brasil), nunca new Date() cru (invariante 10).
function nivelPeca(dt,st){
if("publicado"===st)return"ok";
if("descartado"===st)return"nulo";
var h=new Date(l()+"T12:00:00"),d=new Date(String(dt||"")+"T12:00:00");
if(isNaN(d.getTime()))return"nulo";
var dd=Math.round((d-h)/864e5);
if(dd<0)return"vencido";
if(0===dd)return"quente";
if(dd<=6)return"morno";
return"frio"}
// dias_semana null ou vazio = TODOS os dias (o proprio formulario diz isso).
function cargaSemana(cats){
var n=[0,0,0,0,0,0,0,0];
(cats||[]).forEach(function(ct){(ct.tarefas||[]).forEach(function(t){
var ds=t.dias_semana&&t.dias_semana.length?t.dias_semana:[1,2,3,4,5,6,7];
ds.forEach(function(d){d>=1&&d<=7&&n[d]++})})});
return n}
function tarefasDoDia(cats,iso){
var out=[];
(cats||[]).forEach(function(ct){(ct.tarefas||[]).forEach(function(t){
var ds=t.dias_semana&&t.dias_semana.length?t.dias_semana:[1,2,3,4,5,6,7];
ds.indexOf(iso)>=0&&out.push({cat:ct,tarefa:t})})});
return out}

// ---- Aba Vendas (fatia 1). Le v_venda; escreve pela RPC registrar_venda. ----
// Desde 31/07/2026 tambem CORRIGE (RPC editar_venda) e ARQUIVA (arquivar_venda).
// A tela nao tem mais nenhum caminho de escrita direta na tabela venda: o
// authenticated perdeu o UPDATE, entao qualquer gravacao aqui passa por RPC.
var vendasData=[],vendasArq=[],vendasArqAberto=!1,VENDA_EDIT=null;
function brlV(n){return "R$ "+Number(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}
function rotStatusVenda(s){return "pre_venda"===s?"Pré-venda":"cancelada"===s?"Cancelada":"Concluída"}
function fxVenda(v){
var chips='<span class="cli-seg">'+c(rotStatusVenda(v.status))+"</span>";
if(v.tem_trade_in)chips+='<span class="cli-seg">troca</span>';
return '<div class="card-cliente">'+chips+'</div><div class="venda-vals"><span class="v-venda">'+brlV(v.valor_venda)+'</span><span class="v-lucro'+(Number(v.lucro)>=0?"":" neg")+'">lucro '+brlV(v.lucro)+"</span></div>"}
// Toda venda aponta pro cliente: o vinculo virou obrigatorio no banco em
// 27/07/2026 (venda.lead_id NOT NULL). A linha existe para o caminho de volta,
// da venda pro cadastro, e para dizer o que falta ali. Cadastro incompleto usa a
// semantica de MORNO (trabalho pendente), nunca a de erro: e o mesmo criterio da
// falta de NF, e sem CPF nem endereco nao sai nota fiscal.
// A linha existe SEMPRE, mesmo sem cliente, porque e ela que carrega o Editar:
// venda errada era permanente na tela ate 31/07/2026. Arquivar NAO entra aqui,
// so dentro do painel: tirar dinheiro do faturamento nao pode ser um toque solto
// no meio da lista.
function vendaCliLinha(v){
var falta=[],ident="",av="";
if(v.lead_id){
if(!1===v.cliente_tem_cpf)falta.push("CPF");
if(!1===v.cliente_tem_endereco)falta.push("endereço");
av=falta.length?'<span class="venda-cli-falta">sem '+c(falta.join(" nem "))+"</span>":"";
ident='<span class="venda-cli-code">'+c(v.cliente_code||"cliente")+"</span>"}
return '<div class="venda-cli">'+ident+av+
'<button class="btn-acao" data-acao="venda-editar" data-id="'+c(v.id)+'">Editar</button>'+
(v.lead_id?'<button class="btn-acao venda-cli-btn" data-acao="cli-ver" data-code="'+c(v.cliente_code||"")+'">Ver cliente</button>':"")+"</div>"}
// ---- Cadastro de motoboy (08/08/2026) ---------------------------------------
// Antes o motoboy era texto livre dentro de cada venda: o mesmo Hiago virava
// tres grafias e o telefone era redigitado a cada corrida. A lista abaixo passa
// a ser a fonte, e a venda continua guardando nome e telefone DO DIA, do mesmo
// jeito que venda.comprador_* e a fotografia do cliente no dia da compra.
var motoboysData=[];
async function carregarMotoboys(){
var r=await ler(t.from("motoboy").select("id,nome,whatsapp").is("desligado_em",null).order("nome"),"os motoboys");
if(r.ok)motoboysData=r.dados;
return r}
// O telefone fica VISIVEL na linha: escolher o motoboy errado custa uma corrida,
// e dois Hiagos sem numero a vista sao indistinguiveis.
function motoLinha(m){
return'<div class="moto-linha"><button type="button" class="moto-chip" data-acao="ent-moto-enviar" data-id="'+c(m.id)+'">'
+"<strong>"+c(m.nome||"sem nome")+"</strong><span>"+(m.whatsapp?c(f(m.whatsapp)):"sem WhatsApp")+"</span></button>"
+'<button type="button" class="moto-rm" data-acao="ent-moto-rm" data-id="'+c(m.id)+'" aria-label="Tirar da lista">tirar</button></div>'}
function pintarMotoboys(){
var cx=E("peMotoLista");
if(!cx)return;
cx.innerHTML=motoboysData.length?motoboysData.map(motoLinha).join("")
:'<div class="moto-vazio">Nenhum motoboy na lista. Preencha nome e WhatsApp abaixo e toque em Salvar na lista.</div>'}
// Um toque = despacha. Preenche o motoboy da venda com o da lista e segue pelo
// MESMO enviarEntrega: uma validacao so, um caminho so de escrita. Atalho com
// caminho proprio seria a segunda regra que envelhece sozinha.
async function enviarEntregaPara(mid,btn){
var m=(motoboysData||[]).filter(function(x){return String(x.id)===String(mid)})[0];
if(!m)return void I("Motoboy não encontrado",!0);
if(!m.whatsapp)return void I((m.nome||"Esse motoboy")+" está sem WhatsApp: edite a lista.",!0);
fvSet("peMotoboy",m.nome||"");
fvSet("peMotoWhats",f(m.whatsapp));
entPintar();
await enviarEntrega(btn)}
// Promove o avulso digitado a linha da lista. Nao inventa telefone: a RPC
// recusa cadastro sem numero, porque sem numero nao existe botao de enviar.
async function salvarMotoboyUI(btn){
var nome=entVal("peMotoboy"),tel=entVal("peMotoWhats");
if(!nome){if(E("peErro"))E("peErro").textContent="Digite o nome do motoboy antes de salvar na lista.";return}
if(btn)btn.disabled=!0;
var r=await t.rpc("salvar_motoboy",{payload:{nome:nome,whatsapp:tel}});
if(btn)btn.disabled=!1;
var d=r&&r.data;
if(d&&d.ok){
I(d.msg||"Motoboy salvo");
if(E("peErro"))E("peErro").textContent="";
await carregarMotoboys();pintarMotoboys()}
else{var er=(d&&d.erro)||(r&&r.error&&r.error.message)||"Falha ao salvar o motoboy";
if(E("peErro"))E("peErro").textContent=er;I(er,!0)}}
// Tirar da lista e soft delete no banco: a entrega de ontem continua legivel
// com o nome de quem levou. A confirmacao diz isso.
async function desligarMotoboyUI(mid,btn){
var m=(motoboysData||[]).filter(function(x){return String(x.id)===String(mid)})[0];
if(!window.confirm("Tirar "+((m&&m.nome)||"este motoboy")+" da lista? As entregas antigas continuam registradas com o nome dele."))return;
if(btn)btn.disabled=!0;
var r=await t.rpc("desligar_motoboy",{p_id:mid,p_desligar:!0});
if(btn)btn.disabled=!1;
var d=r&&r.data;
if(d&&d.ok){I(d.msg||"Motoboy removido");await carregarMotoboys();pintarMotoboys()}
else I((d&&d.erro)||(r&&r.error&&r.error.message)||"Falha ao remover",!0)}
// Roteador dos cliques do painel, no mesmo padrao do fvCliClick: o delegado A
// so escuta #lista, e este painel vive fora dela.
function entPainelClick(ev){
var el=ev.target&&ev.target.closest?ev.target.closest("[data-acao]"):null;
if(!el)return;
var o=el.getAttribute("data-acao");
if("ent-moto-enviar"===o){ev.preventDefault();enviarEntregaPara(el.getAttribute("data-id"),el);return}
if("ent-moto-rm"===o){ev.preventDefault();desligarMotoboyUI(el.getAttribute("data-id"),el);return}
if("ent-moto-salvar"===o){ev.preventDefault();salvarMotoboyUI(el);return}}
// ---- Relatorio de entrega: o que o motoboy precisa saber (08/08/2026) -------
// Nao existe tabela de entrega: os campos sao os DA VENDA (endereco_entrega,
// valor_a_cobrar, motoboy, forma_pagamento, fornecedor_local_retirada), e o
// que o dono corrigir aqui volta para a venda pela editar_venda. Painel que so
// montasse texto faria digitar o endereco duas vezes e guardar zero.
// Nome e telefone do cliente sao LEITURA: identidade mora no lead.
var ENT_EDIT=null;
var ENT_PGTO={pix:"Pix",dinheiro:"Dinheiro",cartao:"Cartão",misto:"Misto"};
function entVal(id){return E(id)?String(E(id).value||"").trim():""}
function entDig(x){return String(x||"").replace(/\D/g,"")}
// wa.me exige o pais na frente. 10 e 11 digitos e numero brasileiro sem o 55;
// acima disso ja veio com pais e nao se mexe. Mesma regra da RPC.
function entWa(x){var d=entDig(x);return d?(10===d.length||11===d.length?"55"+d:d):""}
// O que falta e dito ANTES do envio, nomeado. So o endereco e o numero do
// motoboy bloqueiam o enviar; o resto e aviso, porque a corrida pode sair
// mesmo sem local de retirada declarado.
function entFaltando(){
var f=[];
if(!entVal("peEntrega"))f.push("endereço de entrega");
if(!entVal("peRetirada"))f.push("local de retirada");
if(!entVal("peNome"))f.push("nome do cliente (no cadastro)");
if(!entDig(entVal("peWhats")))f.push("WhatsApp do cliente (no cadastro)");
if(!entVal("peMotoboy"))f.push("nome do motoboy");
if(!entDig(entVal("peMotoWhats")))f.push("WhatsApp do motoboy");
return f}
// O texto que sai. Campo em branco some da mensagem (o motoboy nao precisa
// ler buraco), MENOS a linha do dinheiro: sem valor ela diz "nada a cobrar".
// Omitir dinheiro e como nasce cobranca errada na porta do cliente.
function entTexto(){
var v=ENT_EDIT||{},L=[];
L.push("ENTREGA · "+(v.venda_code||"venda"));
var ap=[v.modelo_rotulo||v.modelo_texto||"",v.capacidade||"",v.cor||""].filter(Boolean).join(" ");
if(ap)L.push("Aparelho: "+ap);
if(entVal("peNome"))L.push("Cliente: "+entVal("peNome"));
var w=entDig(entVal("peWhats"));if(w)L.push("Contato: "+f(w));
if(entVal("peRetirada"))L.push("Retirar em: "+entVal("peRetirada"));
if(entVal("peEntrega"))L.push("Entregar em: "+entVal("peEntrega"));
var vl=parseFloat(String(entVal("peValor")).replace(",","."));
var pg=ENT_PGTO[entVal("pePgto")]||"";
L.push(vl>0?"Cobrar: "+brlV(vl)+(pg?" · "+pg:" · forma a combinar"):"Cobrar: nada a cobrar na entrega");
if(entVal("peRecado"))L.push("Recado: "+entVal("peRecado"));
return L.join("\n")}
// A previa mostra o texto EXATO que sai. Sem ela, o dono so descobre o que
// mandou depois de mandar, e ai o motoboy ja leu.
function entPintar(){
if(E("pePrevia"))E("pePrevia").textContent=entTexto();
var fl=entFaltando(),cx=E("peFalta");
if(cx)cx.innerHTML=fl.length?"Falta: "+c(fl.join(", "))+".":""}
// Endereco sugerido do cadastro do cliente quando a venda nao tem o proprio.
// Sugerir NAO e gravar: so vai para o banco se o dono salvar.
function entEndCliente(v){
var L=(i||[]).filter(function(x){return String(x.id)===String(v.lead_id)})[0];
return L?cliEndereco(L):""}
function abrirPainelEntrega(id){
var v=(vendasData||[]).filter(function(x){return String(x.id)===String(id)})[0];
if(!v)return void I("Venda não encontrada",!0);
ENT_EDIT=v;
fvSet("peNome",v.cliente_nome||v.comprador_nome||"");
var cw=v.cliente_whatsapp||v.comprador_whatsapp;
fvSet("peWhats",cw?f(cw):"");
fvSet("peRetirada",v.fornecedor_local_retirada||"");
fvSet("peEntrega",v.endereco_entrega||entEndCliente(v));
fvSet("peValor",null==v.valor_a_cobrar?"":v.valor_a_cobrar);
if(E("pePgto"))E("pePgto").value=v.forma_pagamento||"";
fvSet("peMotoboy",v.motoboy||"");
fvSet("peMotoWhats",v.motoboy_whatsapp?f(v.motoboy_whatsapp):"");
fvSet("peRecado","");
if(E("peAlvo"))E("peAlvo").textContent=(v.venda_code||"Venda")+" · o que você corrigir aqui grava na venda; o recado da corrida, não.";
if(E("peErro"))E("peErro").textContent="";
entPintar();
if(E("painelEntrega"))E("painelEntrega").className="painel-cadastro";
pintarMotoboys();carregarMotoboys().then(pintarMotoboys)}
function fecharPainelEntrega(){
ENT_EDIT=null;
if(E("painelEntrega"))E("painelEntrega").className="painel-cadastro oculto"}
// Grava so o que e da ENTREGA. comprador_nome e comprador_whatsapp ficam de
// fora de proposito: sao leitura aqui, e manda-los criaria uma segunda versao
// do cliente dentro da venda.
async function salvarEntrega(){
var v=ENT_EDIT;
if(!v)return{ok:!1,erro:"Sem venda aberta"};
var pe={id:v.id,fornecedor_local_retirada:entVal("peRetirada"),endereco_entrega:entVal("peEntrega"),
valor_a_cobrar:entVal("peValor"),forma_pagamento:entVal("pePgto"),
motoboy:entVal("peMotoboy"),motoboy_whatsapp:entVal("peMotoWhats")};
var r=await t.rpc("editar_venda",{payload:pe});
var d=r&&r.data;
if(d&&d.ok)return{ok:!0};
return{ok:!1,erro:(d&&d.erro)||(r&&r.error&&r.error.message)||"Falha ao salvar a entrega"}}
// A janela abre no CLIQUE (sincrona) e so depois recebe a URL: aberta depois
// do await, o navegador bloqueia como pop-up. Mesmo padrao do abrirArquivoNf.
// Ordem: salva primeiro, envia depois. Mensagem enviada com o dado nao salvo
// seria a tela e o motoboy discordando do banco.
async function enviarEntrega(btn){
if(!entVal("peEntrega")){
if(E("peErro"))E("peErro").textContent="Sem endereço de entrega não dá pra despachar: preencha o destino.";
return}
var wa=entWa(entVal("peMotoWhats"));
if(!wa){
if(E("peErro"))E("peErro").textContent="Sem o WhatsApp do motoboy dá pra copiar o texto, mas não abrir a conversa.";
return}
if(E("peErro"))E("peErro").textContent="";
var txt=entTexto(),w=window.open("about:blank","_blank");
if(btn)btn.disabled=!0;
var r=await salvarEntrega();
if(btn)btn.disabled=!1;
if(!r.ok){if(w)w.close();if(E("peErro"))E("peErro").textContent=r.erro;return void I(r.erro,!0)}
var u="https://wa.me/"+wa+"?text="+encodeURIComponent(txt);
if(w)w.location.href=u;else I("Libere o pop-up para abrir o WhatsApp",!0);
I("Entrega salva e enviada para "+(entVal("peMotoboy")||"o motoboy"));
fecharPainelEntrega();n="vendas";B(!0)}
// Copia PRIMEIRO, ainda dentro do gesto do clique: depois do await o
// navegador considera a ativacao gasta e o clipboard falha calado.
function copiarEntrega(btn){
var txt=entTexto();
if(navigator.clipboard&&navigator.clipboard.writeText)
navigator.clipboard.writeText(txt).then(function(){I("Relatório copiado")},function(){copiarFallback(txt,"Relatório copiado")});
else copiarFallback(txt,"Relatório copiado");
if(btn)btn.disabled=!0;
salvarEntrega().then(function(r){
if(btn)btn.disabled=!1;
if(r.ok){n="vendas";B(!0)}
else{if(E("peErro"))E("peErro").textContent=r.erro;I(r.erro,!0)}})}
// A linha existe SEMPRE, com endereco ou sem. Venda sem destino se esconderia
// justamente de quem tem que despachar, e o vazio vira o proprio convite.
function entLinhaVenda(v){
var dest=String(v.endereco_entrega||"").trim(),moto=String(v.motoboy||"").trim();
var rot=dest?'<span class="venda-ent-val">'+c(dest)+(moto?" · "+c(moto):"")+"</span>"
:'<span class="venda-ent-falta">sem endereço de entrega</span>';
return'<div class="venda-ent"><span class="venda-ent-rot">entrega</span>'+rot+
'<button class="btn-acao'+(dest?"":" ent-pede")+'" data-acao="venda-entrega" data-id="'+c(v.id)+'">Relatório</button></div>'}
function cardVenda(v){
return '<div class="card"><div class="card-top"><span class="card-code">'+c(v.venda_code||"")+'</span><span class="card-prod">'+c(v.modelo_rotulo||"")+(v.capacidade?" "+c(v.capacidade):"")+(v.cor?" "+c(v.cor):"")+'</span></div><div class="card-sub">'+c(v.cliente_nome||"sem cliente")+(v.data_venda?" · "+c(v.data_venda):"")+(v.imei?" · IMEI "+c(v.imei):"")+"</div>"+fxVenda(v)+vendaCliLinha(v)+entLinhaVenda(v)+nfLinhaVenda(v)+"</div>"}
function filtVendaBusca(lista,termo){
var q=String(termo||"").trim().toLowerCase();
if(!q)return lista;
return lista.filter(function(v){return [v.venda_code,v.modelo_rotulo,v.cliente_nome,v.imei].join(" ").toLowerCase().indexOf(q)>=0})}

// ---- Painel de Vendas (v52): o dinheiro da operacao somado no topo da aba ----
// Agrega o que a tela JA carregou (vendasData, vinda da v_venda), nunca um
// numero que so o servidor sabe: e a regra do v51 secao 4 (o que a tela ja sabe,
// a tela resolve). Zero RPC, zero migration, zero chamada de rede nova.
// O criterio de faturamento espelha painel_metricas de proposito, para nao
// nascer um SEGUNDO criterio de faturamento no sistema:
//   - arquivada nao conta (a v_venda ja filtra arquivado_em is null);
//   - status cancelada nao conta;
//   - status pre_venda CONTA e e declarado no cabecalho. Pre-venda entrando
//     calada e o jeito mais barato de este painel mentir.
// O lucro e SOMADO da coluna lucro da view, nunca recalculado aqui: duas
// definicoes de lucro divergem com o tempo, e a suite assere que as duas contas
// batem justamente para pegar isso.
var vgJanela="trimestre";
var VG_JANELAS=[["mes","Mês"],["trimestre","Trimestre"],["tudo","Tudo"]];
// data_venda e digitada a mao e pode faltar; criado_em sempre existe. Mesmo
// coalesce que painel_metricas usa para o lead. dataLocalDe resolve o fuso
// (invariante 10): nunca data crua do servidor virando dia de negocio.
function vgDataDe(v){return v.data_venda||u(v.criado_em)||""}
function vgMesMais(ym,n){
var ano=parseInt(ym.slice(0,4),10),m=parseInt(ym.slice(5,7),10)-1+n;
ano+=Math.floor(m/12);m=(m%12+12)%12;
var mm=String(m+1);
return ano+"-"+(mm.length<2?"0"+mm:mm)}
function vgDataBr(iso){
if(!iso)return"—";
return new Date(iso+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"})}
// O fim NAO e sempre hoje: data_venda aceita futuro, e esconder a venda que o
// proprio operador acabou de cadastrar seria a tela contradizendo o formulario.
// `jan` opcional: o Dashboard tem janela PROPRIA (dvJanela) e nao pode pegar
// carona na do painel de Vendas, senao trocar o recorte numa aba mexeria na
// outra em silencio. Sem argumento, segue valendo a global de sempre.
function vgLimites(linhas,jan){
jan=jan||vgJanela;
var hoje=l(),menor="",maior=hoje,i,d;
for(i=0;i<linhas.length;i++){
if("cancelada"===linhas[i].status)continue;
d=vgDataDe(linhas[i]);
if(!d)continue;
if(!menor||d<menor)menor=d;
if(d>maior)maior=d}
var ini;
if("mes"===jan)ini=hoje.slice(0,7)+"-01";
else if("trimestre"===jan)ini=vgMesMais(hoje.slice(0,7),-2)+"-01";
else ini=menor||hoje.slice(0,7)+"-01";
return{ini:ini,fim:maior}}
function vgAgregar(linhas,lim){
var r={n:0,pre:0,fat:0,luc:0,custo:0,frete:0,taxas:0,meses:[]},mapa={},i,v,d,ym,m,fat,luc;
for(i=0;i<linhas.length;i++){
v=linhas[i];
if("cancelada"===v.status)continue;
d=vgDataDe(v);
if(!d||d<lim.ini||d>lim.fim)continue;
fat=Number(v.valor_venda)||0;
luc=Number(v.lucro)||0;
r.n++;
if("pre_venda"===v.status)r.pre++;
r.fat+=fat;r.luc+=luc;
r.custo+=Number(v.custo_aparelho)||0;
r.frete+=Number(v.despesa_frete)||0;
r.taxas+=Number(v.despesa_taxas)||0;
// O mes carrega a COMPOSICAO, nao so o par faturamento/lucro: a coluna do
// grafico e empilhada, entao ela precisa saber quanto daquele mes foi custo,
// quanto vazou e quanto sobrou. Sem isso, bater o olho no grafico so diz qual
// mes foi maior.
// Frete e taxas entram somados em `vaza`, e nao separados, porque o validador de
// paleta reprovou o par: os dois so podiam sair da familia --morno (frete e taxa
// sao a mesma natureza de despesa), e --morno contra --morno-fg mede ΔE 13.0 na
// visao normal, abaixo do piso de 15 ("dificil distinguir mesmo com visao de
// cores completa"). A cartilha diz que isso NAO se resolve com codificacao
// secundaria: ou re-escalona, ou corta series. Cortar e a saida certa e nao
// custa nada, porque vazamento ja e um numero so no placar e a quebra
// frete/taxas continua em texto no bloco dele.
// Os hexes ficam de fora deste arquivo de proposito: cor vive no :root, e o
// validar.py reprova hex no app.js ate dentro de comentario.
ym=d.slice(0,7);
m=mapa[ym];
if(!m){m={ym:ym,n:0,fat:0,luc:0,custo:0,vaza:0};mapa[ym]=m;r.meses.push(m)}
m.n++;m.fat+=fat;m.luc+=luc;
m.custo+=Number(v.custo_aparelho)||0;
m.vaza+=(Number(v.despesa_frete)||0)+(Number(v.despesa_taxas)||0)}
r.meses.sort(function(a,b){return a.ym<b.ym?-1:a.ym>b.ym?1:0});
return r}
// Percentual com UMA casa e virgula. Sem base, devolve o travessao: 0% seria
// afirmar uma medida que nao existe.
function vgPct1(parte,todo){
if(!(todo>0))return"—";
return(Math.round(1e3*parte/todo)/10).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%"}
function vgMilhar(v){
if(Math.abs(v)>=1e3)return"R$ "+(Math.round(v/100)/10).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+" mil";
return brlV(v)}
function vgMesRot(ym){
return new Date(ym+"-01T12:00:00").toLocaleDateString("pt-BR",{month:"short"}).replace(".","")}
function vgMesLongo(ym){
return new Date(ym+"-01T12:00:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}
// Uma frase so com tudo que saiu de baixo da barra. Serve ao aria-label (quem
// navega por teclado ou leitor de tela nao tem hover) e ao tooltip, para os dois
// nunca divergirem.
function vgMesResumo(m){
return vgMesLongo(m.ym)+": "+brlV(m.fat)+", "+m.n+(1===m.n?" venda":" vendas")+
", margem "+vgPct1(m.luc,m.fat)+
". Custo "+brlV(m.custo)+", vazamento "+brlV(m.vaza)+", lucro "+brlV(m.luc)+"."}
// A coluna de valores. Nao da para reusar capCel/.pitboard aqui: aquele grid e
// repeat(4,1fr) e nao cabe numa coluna de 228px. O que CONTINUA reusado e o
// vocabulario de tipografia (.pb-rot, .pb-num, .pb-pe) dentro dos containers
// novos, para a escala de texto seguir identica ao resto do app. Reusa-se a
// escala, nao a grade.
// data-cel segue sendo a chave por CODIGO (invariante 12): a suite le por ele,
// nunca pelo rotulo exibido.
// `extra` entra DENTRO do bloco, depois do pe: a decomposicao do vazamento tem
// que ficar na mesma caixa destacada, senao o destaque para na borda e a linha
// que explica o numero cai fora dele.
// Os icones sao INLINE e monocromaticos (currentColor): o CSP do Worker nao
// deixa buscar nada de fora, e emoji saiu de rotulo em 16/07/2026 e nao volta.
// Cada chip carrega SO a cor de fundo do token --d-*, nunca desenho colorido.
var DV_ICO={
dinheiro:'<path d="M12 2v20M17 5.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.9 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3"/>',
lucro:'<path d="M3 17l6-6 4 4 8-8M21 7v6h-6"/>',
margem:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9h-9z"/>',
vaza:'<path d="M12 3s6 6.4 6 10a6 6 0 0 1-12 0c0-3.6 6-10 6-10z"/>',
ticket:'<path d="M20 12a2 2 0 0 1 2-2V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a2 2 0 0 1-2-2z"/><path d="M9 7v10"/>',
alvo:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
caixa:'<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8"/>'};
function dvIcone(nome,tom){
if(!DV_ICO[nome])return"";
return'<span class="kp-ico t-'+c(tom)+'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" '+
'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+
DV_ICO[nome]+"</svg></span>"}
// Card no formato da referencia aprovada em 12/08/2026: rotulo, numero grande,
// chip de icone no canto, rodape de contexto. O `data-cel` e o `.pb-rot` e o
// `.vg-num` continuam EXATAMENTE onde estavam: a suite le por eles, e trocar a
// aparencia nao pode mover a chave de leitura.
function vgVal(cod,rot,num,pe,cls,extra,ico,tom){
return'<div class="vg-val'+(cls?" "+cls:"")+'" data-cel="'+c(cod)+'">'+
'<div class="vg-val-topo"><div class="pb-rot">'+c(rot)+"</div>"+
(ico?dvIcone(ico,tom):"")+"</div>"+
'<div class="vg-num">'+c(num)+"</div>"+
(pe?'<div class="pb-pe">'+c(pe)+"</div>":"")+(extra||"")+"</div>"}
// Margem sai do PE do lucro e vira numero proprio. Ate a 1a passada ela era o
// menor texto do bloco, e e ela que diz se a operacao vale a pena: a operacao
// roda perto de 6,7%, e faturamento grande com margem fina foi exatamente o que
// a tela escondia.
// Lucro e margem SAIRAM do par lado a lado e viraram card proprio cada um. Ate a
// v52 os dois dividiam uma caixa porque a coluna tinha 228px; na faixa horizontal
// isso deixou de ser restricao, e um numero que divide caixa com outro le como
// rodape do vizinho, que foi exatamente o defeito que a v52 corrigiu na margem.
function vgValores(a){
var vaza=a.frete+a.taxas,tr="—";
var neg=a.n&&a.luc<0?" neg":"";
var pares=
'<div class="vg-val" data-cel="vg-luc"><div class="vg-val-topo">'+
'<div class="pb-rot">lucro</div>'+dvIcone("lucro","verde")+"</div>"+
'<div class="vg-num'+neg+'">'+c(a.n?brlV(a.luc):tr)+"</div>"+
'<div class="pb-pe">'+c(a.n?brlV(a.luc/a.n)+" por venda":"nada fechado ainda")+"</div></div>"+
'<div class="vg-val" data-cel="vg-margem"><div class="vg-val-topo">'+
'<div class="pb-rot">margem</div>'+dvIcone("margem","laranja")+"</div>"+
'<div class="vg-num'+neg+'">'+c(a.n?vgPct1(a.luc,a.fat):tr)+"</div>"+
'<div class="pb-pe">'+c(a.n?brlV(a.fat>0?100*a.luc/a.fat:0)+" a cada R$ 100 vendidos":"sem base")+"</div></div>";
// Destaque ESTRUTURAL (borda forte, numero maior, decomposicao visivel), nunca
// fundo tingido. No resto do app --morno quer dizer trabalho pendente e o
// alerta quer dizer "isso esta errado agora"; vazamento existe em toda venda,
// entao pintar de morno para sempre e gritar sem novidade, e em duas semanas o
// dono para de ver. So os VALORES de frete e taxas usam --morno-fg.
// Sem as classes s-* das fatias: estas duas linhas sao TEXTO do bloco de
// valores, nao marcas do grafico, e reusar o nome da fatia faria parecer que ha
// um segmento de frete no desenho, que desde a 3a passada nao existe mais.
var quebra=a.n?'<div class="vg-quebra">'+
"<span>frete <b>"+c(brlV(a.frete))+"</b></span>"+
"<span>taxas <b>"+c(brlV(a.taxas))+"</b></span></div>":"";
return'<div class="vg-valores">'+
vgVal("vg-fat","faturamento",a.n?brlV(a.fat):tr,a.n+(1===a.n?" venda":" vendas"),
      "","","dinheiro","azul")+
pares+
vgVal("vg-vazamento","vazamento",a.n?brlV(vaza):tr,
      a.luc>0?vgPct1(vaza,a.luc)+" do lucro":"frete + taxas","forte",quebra,"vaza","vermelho")+
vgVal("vg-ticket","ticket médio",a.n?brlV(a.fat/a.n):tr,
      a.n?"lucro médio "+brlV(a.luc/a.n):"por venda","","","ticket","roxo")+
"</div>"}
// Coluna EMPILHADA, nao barra simples. A altura do preenchimento continua sendo
// o faturamento do mes escalado pelo maior mes da janela, mas o preenchimento se
// divide em custo, frete, taxas e lucro, nas MESMAS cores da barra de vazamento
// (uma legenda serve os dois graficos). O motivo e o que o dono cobrou: bater o
// olho tem que dizer de uma vez qual mes foi maior E qual mes guardou mais. A
// versao anterior, com uma lasca de lucro dentro de um tubo cheio, so respondia
// a primeira pergunta.
// A margem de cada mes vai em TEXTO sob a coluna. Numa escala de faturamento ela
// e genuinamente pequena (a operacao roda perto de 6,7%), e dar a ela uma escala
// propria so para parecer maior seria o grafico mentindo.
// Faturamento em neutro de proposito: barra azul ja foi reprovada duas vezes
// (app.css, comentario da .met-barra).
function vgMesSeg(cls,val,fat,topo){
var p=fat>0?100*val/fat:0;
if(!(p>0))return"";
// fatia que existe nao pode sumir: vazamento de 0,3% vira uma linha fina, nunca
// nada. Some so o que e zero de verdade.
if(p<1.2)p=1.2;
p=Math.round(100*p)/100;
return'<span class="vg-seg s-'+cls+(topo?" topo":"")+'" style="height:'+p+'%"></span>'}
function vgMeses(a){
if(!a.meses.length)return"";
var mx=0,i,m,hFat,neg,pilha,out="";
for(i=0;i<a.meses.length;i++)if(a.meses[i].fat>mx)mx=a.meses[i].fat;
for(i=0;i<a.meses.length;i++){
m=a.meses[i];
hFat=mx>0?Math.round(100*m.fat/mx):0;
if(m.fat>0&&hFat<3)hFat=3;
neg=m.luc<0;
// Ordem no DOM = de cima para baixo. O lucro fica na BASE, como o que assentou
// depois que o custo saiu; a marca cresce de UMA linha de base so. No mes em
// prejuizo nao existe fatia de lucro para empilhar: entra a faixa hachurada,
// dimensionada pelo tamanho do rombo.
// `topo` marca a primeira fatia que aparece, que e a unica com canto
// arredondado: ponta de dado de 4px em cima, quadrada na base.
pilha=vgMesSeg("custo",m.custo,m.fat,!0)+vgMesSeg("vaza",m.vaza,m.fat,!(m.custo>0))+
(neg?'<span class="vg-seg s-neg" style="height:'+Math.min(100,Math.max(2,Math.round(100*Math.abs(m.luc)/m.fat)))+'%"></span>'
    :vgMesSeg("luc",m.luc,m.fat,!(m.custo>0||m.vaza>0)));
// Sob a barra fica SO o mes. Numero em cada ponto e o erro mais comum de
// grafico: valor, margem e n de vendas viviam aqui e inundavam a leitura.
// Eles vao para o tooltip, e os totais da janela seguem grandes na coluna de
// valores, entao nada fica represado.
out+='<button type="button" class="vg-mes" data-acao="vg-mes" data-id="'+c(m.ym)+'" data-mes="'+c(m.ym)+
'" aria-label="'+c(vgMesResumo(m))+'">'+
'<span class="vg-tubo"><span class="vg-fat" style="height:'+hFat+'%">'+pilha+"</span></span>"+
'<span class="vg-mes-rot">'+c(vgMesRot(m.ym))+"</span></button>"}
// Os graficos ficam lado a lado com a coluna de valores, entao cada um precisa
// dizer o proprio nome, e como se le o desenho.
return'<p class="vg-tit">por mês <span>altura = faturamento</span></p>'+
'<div class="vg-meses" role="img" aria-label="Composição do faturamento por mês na janela">'+out+"</div>"}
// Barra de 100% sobre o faturamento da janela: onde cada real entrou e o que
// sobrou. Frete e taxas usam --morno (trabalho pendente, a mesma familia da
// falta de CPF e de NF), nunca --erro: margem sendo comida nao e falha de
// sistema. Segmento com valor zero nao entra na barra, mas CONTINUA na legenda:
// "taxas 0,0%" e informacao, taxa sumida e omissao.
// Tres partes, as MESMAS da coluna por mes: uma paleta, uma legenda, dois
// graficos. Frete e taxas somam em vazamento pelo motivo medido em vgAgregar.
var VG_VAZA=[["custo","custo do aparelho"],["vaza","vazamento"],["luc","lucro"]];
function vgVazamento(a){
if(!a.n)return"";
var val={custo:a.custo,vaza:a.frete+a.taxas,luc:a.luc},barra="",leg="",i,k,p;
for(i=0;i<VG_VAZA.length;i++){
k=VG_VAZA[i][0];
p=a.fat>0?100*val[k]/a.fat:0;
if(p>0)barra+='<span class="vg-vaza-seg s-'+k+'" style="width:'+p+'%"></span>';
// A legenda fala em %, a coluna de valores fala em R$: e uma barra de
// PROPORCAO, entao porcentagem e a unidade nativa dela, e repetir o R$ aqui
// duplicaria o que ja esta na altura dos olhos, do lado direito.
leg+='<span class="vg-vaza-item s-'+k+'" data-vaza="'+k+'"><i></i><b>'+c(VG_VAZA[i][1])+"</b> "+
vgPct1(val[k],a.fat)+"</span>"}
return'<p class="vg-tit">onde o dinheiro foi</p><div class="vg-vaza-bloco"><div class="vg-vaza'+(a.luc<0?" neg":"")+
'" role="img" aria-label="Composição do faturamento da janela">'+barra+"</div>"+
'<div class="vg-vaza-leg">'+leg+"</div></div>"}
// A janela e parte do dado, nao legenda: tela que omite o recorte mente por
// omissao (reforco do v33). Por isso o "de X a Y" nao e opcional, e a pre-venda
// e contada em voz alta.
function vgCab(a,lim){
var op="",i;
for(i=0;i<VG_JANELAS.length;i++)
op+='<button class="met-faixa" data-acao="vg-janela" data-id="'+VG_JANELAS[i][0]+
'" aria-pressed="'+(vgJanela===VG_JANELAS[i][0]?"true":"false")+'">'+c(VG_JANELAS[i][1])+"</button>";
var rec="de "+vgDataBr(lim.ini)+" a "+vgDataBr(lim.fim)+" · "+a.n+(1===a.n?" venda":" vendas")+
(a.pre?" · inclui "+a.pre+" pré-venda"+(1===a.pre?"":"s"):"");
return'<div class="vg-cab"><span class="vg-recorte">'+c(rec)+'</span><div class="met-faixas">'+op+"</div></div>"}
// O placar continua na tela mesmo vazio, com os rotulos e o travessao: so
// renderizar campo que tem dado e o que faz a tela sumir na base zerada. O vazio
// vira o proprio caminho de saida, com o botao que abre a janela.
function vgVazio(){
return'<div class="vg-vazio"><strong>Nenhuma venda nesta janela.</strong> '+
("tudo"===vgJanela?"A base ainda não tem venda registrada."
:'<button class="vg-abrir" data-acao="vg-janela" data-id="tudo">Abrir para tudo</button>')+"</div>"}
// Duas colunas: graficos a esquerda, valores a direita.
// No DOM os VALORES vem primeiro, e isso e de proposito duas vezes: e a ordem
// do celular (uma coluna so, numero antes do desenho) e e a ordem de prioridade
// para leitor de tela. No desktop a posicao vem de grid-column NOMEADO, nunca de
// `order`: `order` move o pixel e deixa a leitura para tras.
// A coluna de valores renderiza SEMPRE, cheia ou vazia. Na janela sem venda so
// os graficos dao lugar ao aviso; antes o vazio engolia o painel inteiro.
// Tooltip do grafico por mes. Existe porque os rotulos sairam de baixo da barra
// (numero em cada ponto inunda a leitura), e a cartilha e clara que tooltip
// ENRIQUECE mas nunca e o unico caminho para um valor: por isso ele abre no
// hover E no toque, o aria-label do botao carrega a mesma frase, e os totais da
// janela seguem grandes na coluna de valores.
// Um div so, reusado, posicionado em relacao ao .vg-corpo.
function vgLinhaTip(rot,val,cls){
return'<span class="vg-tip-lin'+(cls?" "+cls:"")+'"><i></i><b>'+c(rot)+"</b><em>"+c(brlV(val))+"</em></span>"}
function vgTipMostrar(ym,alvo){
var tip=E("vgTip"),cx=alvo&&alvo.closest?alvo.closest(".vg-corpo"):null,m=null,i;
if(!tip||!cx)return;
for(i=0;i<VG_MESES_CACHE.length;i++)if(VG_MESES_CACHE[i].ym===ym)m=VG_MESES_CACHE[i];
if(!m)return;
tip.innerHTML='<span class="vg-tip-tit">'+c(vgMesLongo(m.ym))+"</span>"+
'<span class="vg-tip-sub">'+c(brlV(m.fat))+" · "+m.n+(1===m.n?" venda":" vendas")+
" · margem "+c(vgPct1(m.luc,m.fat))+"</span>"+
vgLinhaTip("custo",m.custo,"s-custo")+vgLinhaTip("vazamento",m.vaza,"s-vaza")+
vgLinhaTip("lucro",m.luc,m.luc<0?"s-neg":"s-luc");
tip.hidden=!1;
// posiciona pela geometria real, e prende dentro do container para o balao nao
// vazar da tela no celular
var rc=cx.getBoundingClientRect(),ra=alvo.getBoundingClientRect();
var x=ra.left-rc.left+ra.width/2-tip.offsetWidth/2;
if(x<0)x=0;
if(x+tip.offsetWidth>rc.width)x=rc.width-tip.offsetWidth;
tip.style.left=Math.round(x)+"px";
tip.style.top=Math.round(ra.top-rc.top-tip.offsetHeight-8)+"px"}
function vgTipEsconder(){var t=E("vgTip");if(t){t.hidden=!0}}
var VG_MESES_CACHE=[];
// Ligado UMA vez, a partir de pintarVendas: o init() vive na linha 1 minificada
// e esta obra nao a toca. Delegado no #lista, que sobrevive ao innerHTML; sem a
// guarda, cada repintura empilharia mais um listener.
// focusin/focusout junto do mouse porque quem navega por teclado tem que ver o
// mesmo que quem usa o mouse: a coluna e um <button> justamente para isso.
var vgHoverLigado=!1;
function vgAlvoMes(ev){
return ev.target&&ev.target.closest?ev.target.closest('[data-acao="vg-mes"]'):null}
function vgLigarHover(){
if(vgHoverLigado)return;
var lst=E("lista");
if(!lst)return;
vgHoverLigado=!0;
var abre=function(ev){var b=vgAlvoMes(ev);if(b)vgTipMostrar(b.getAttribute("data-id"),b)};
// so fecha o que o proprio ponteiro abriu: balao preso por toque fica ate o
// proximo toque
var fecha=function(ev){if(vgAlvoMes(ev)&&!VG_TIP_ABERTO)vgTipEsconder()};
lst.addEventListener("mouseover",abre);
lst.addEventListener("mouseout",fecha);
lst.addEventListener("focusin",abre);
lst.addEventListener("focusout",fecha)}
function vgPainel(){
var linhas=vendasData||[],lim=vgLimites(linhas),a=vgAgregar(linhas,lim);
VG_MESES_CACHE=a.meses;
return'<section class="vg" aria-label="Painel de vendas">'+vgCab(a,lim)+
'<div class="vg-corpo">'+vgValores(a)+
'<div class="vg-graf g-meses">'+(a.n?vgMeses(a):vgVazio())+"</div>"+
'<div class="vg-graf g-vaza">'+(a.n?vgVazamento(a):"")+"</div>"+
'<div class="vg-tip" id="vgTip" role="status" hidden></div>'+
"</div></section>"}
// ---- Dashboard de Performance de Vendas (aba Dashboard) ---------------------
// Formato aprovado pelo dono em 12/08/2026, a partir de uma referencia externa.
// DECISAO CONSCIENTE DELE, CONTRA A RECOMENDACAO: a paleta da referencia entra
// ao pe da letra (chips azul/verde/roxo/laranja, roscas coloridas), o que quebra
// a regra da referencia-visual-v3 de que o azul da marca aparece em quatro
// lugares e mais nenhum. Por isso os hexes novos vivem sob o prefixo --d- no
// :root: fica explicito, na leitura do CSS, o que e paleta importada e o que e
// token que passou pela medicao do projeto.
//
// Janela PROPRIA (dvJanela), independente da do painel da aba Vendas.
// Zero RPC nova: agrega vendasData (v_venda), vendasArq e a base de leads que o
// B() ja deixou em memoria. O criterio de faturamento e o MESMO de vgAgregar,
// de proposito: dois criterios de faturamento no mesmo sistema divergem.
var dvJanela="trimestre";
var DV_JANELAS=[["mes","Mês"],["trimestre","Trimestre"],["tudo","Tudo"]];
function dvFimMes(ym){
var an=parseInt(ym.slice(0,4),10),m=parseInt(ym.slice(5,7),10);
var d=new Date(an,m,0).getDate();
return ym+"-"+(d<10?"0"+d:d)}
// A janela ANTERIOR de mesmo tamanho. Sem ela nao existe a seta de variacao, que
// e metade do que a referencia entrega. Em "tudo" nao ha anterior, e o card DIZ
// isso em vez de inventar um zero: variacao contra base inexistente e mentira.
function dvAnterior(){
var hoje=l(),ym=hoje.slice(0,7);
if("mes"===dvJanela)return{ini:vgMesMais(ym,-1)+"-01",fim:dvFimMes(vgMesMais(ym,-1)),rot:vgMesRot(vgMesMais(ym,-1))+"/"+vgMesMais(ym,-1).slice(0,4)};
if("trimestre"===dvJanela)return{ini:vgMesMais(ym,-5)+"-01",fim:dvFimMes(vgMesMais(ym,-3)),rot:"trimestre anterior"};
return null}
// Lead conta pela ENTRADA na janela; venda conta pelo fechamento. Sao eventos
// distintos e a nota do card diz isso: um lead de junho que fecha em agosto
// entra na venda de agosto e no lead de junho, entao a taxa e "quanto o periodo
// fechou sobre quanto o periodo captou", nao o destino de uma coorte.
function dvLeadsNaJanela(lim){
var out=[],j,d;
for(j=0;j<(i||[]).length;j++){
if(i[j].arquivado_em)continue;
d=u(i[j].criado_em);
if(!d||d<lim.ini||d>lim.fim)continue;
out.push(i[j])}
return out}
function dvVendasNaJanela(lim){
var out=[],j,v,d;
for(j=0;j<(vendasData||[]).length;j++){
v=vendasData[j];
if("cancelada"===v.status)continue;
d=vgDataDe(v);
if(!d||d<lim.ini||d>lim.fim)continue;
out.push(v)}
return out}
// Origem da venda vem do LEAD, nao da venda: a v_venda nao carrega origem, e
// forcar uma coluna nova na view derrubaria o security_invoker em silencio
// (armadilha ja registrada). O vinculo e por lead_id, que e a chave estavel.
function dvOrigemDaVenda(v){
var j;
for(j=0;j<(i||[]).length;j++)if(String(i[j].id)===String(v.lead_id))return i[j].origem||"";
return""}
// `n`/`fat`/`luc` sao do que FECHOU na janela (dinheiro do periodo). `conv` e
// outra coisa: quantos leads que ENTRARAM na janela ja viraram venda. Os dois
// convivem na mesma linha da tabela porque respondem perguntas diferentes, e a
// nota do card diz qual e qual.
function dvCanais(lim){
var mapa={},ordem=[],j,k,v,org,m;
var toca=function(cod){
if(!mapa[cod]){mapa[cod]={cod:cod,rot:cod?s("origem",cod):"sem origem",leads:0,n:0,fat:0,luc:0,conv:0};ordem.push(mapa[cod])}
return mapa[cod]};
var lds=dvLeadsNaJanela(lim),dentro={};
for(j=0;j<lds.length;j++){toca(lds[j].origem||"").leads++;dentro[String(lds[j].id)]=lds[j].origem||""}
var vds=dvVendasNaJanela(lim),jaContou={};
for(k=0;k<vds.length;k++){
v=vds[k];org=dvOrigemDaVenda(v);m=toca(org);
m.n++;m.fat+=Number(v.valor_venda)||0;m.luc+=Number(v.lucro)||0;
var lk=String(v.lead_id);
if(null!=dentro[lk]&&!jaContou[lk]){jaContou[lk]=1;toca(dentro[lk]).conv++}}
ordem.sort(function(x,y){return y.fat-x.fat||y.leads-x.leads});
return ordem}
// ---- a rosca ----------------------------------------------------------------
// SVG, nao conic-gradient: o vao de 2px entre marcas sai de graca no
// stroke-dasharray, e o ARCO MINIMO fica explicito no codigo. Ele existe porque
// fatia que existe nao pode sumir, e tem o custo de o angulo daquela fatia
// deixar de ser proporcional: por isso o % na legenda e obrigatorio, e a
// prova_grafico reprova se ele sumir.
var DV_R=42,DV_CIRC=2*Math.PI*42,DV_VAO=2.4,DV_ARCO=3;
function dvRosca(fatias,tam,grossura,cnum,crot,rotulo){
var total=0,i2,brutos=[],exc,grandes=[],soma=0,giro=0,out="";
for(i2=0;i2<fatias.length;i2++)total+=fatias[i2][1];
if(!(total>0))total=1;
for(i2=0;i2<fatias.length;i2++)
brutos.push(fatias[i2][1]>0?Math.max(DV_CIRC*fatias[i2][1]/total,DV_ARCO):0);
exc=0;
for(i2=0;i2<brutos.length;i2++)exc+=brutos[i2];
exc-=DV_CIRC;
for(i2=0;i2<brutos.length;i2++)if(brutos[i2]>2*DV_ARCO){grandes.push(i2);soma+=brutos[i2]}
if(exc>0&&grandes.length)for(i2=0;i2<grandes.length;i2++)
brutos[grandes[i2]]-=exc*brutos[grandes[i2]]/soma;
for(i2=0;i2<fatias.length;i2++){
if(!(brutos[i2]>0))continue;
var tr=Math.max(brutos[i2]-DV_VAO,.6);
out+='<circle class="ro-seg f-'+c(fatias[i2][0])+'" cx="50" cy="50" r="'+DV_R+'" fill="none" '+
'stroke-width="'+(100*grossura/tam).toFixed(2)+'" stroke-dasharray="'+tr.toFixed(2)+" "+
(DV_CIRC-tr).toFixed(2)+'" stroke-dashoffset="'+(-giro).toFixed(2)+'"/>';
giro+=brutos[i2]}
return'<div class="ro-caixa" style="width:'+tam+"px;height:"+tam+'px">'+
'<svg class="ro-svg" viewBox="0 0 100 100" role="img" aria-label="'+c(rotulo||"")+'">'+
'<circle class="ro-trilho" cx="50" cy="50" r="'+DV_R+'" fill="none" stroke-width="'+
(100*grossura/tam).toFixed(2)+'"/>'+out+"</svg>"+
(cnum?'<span class="ro-centro"><b>'+c(cnum)+"</b><em>"+c(crot||"")+"</em></span>":"")+"</div>"}
function dvLeg(itens,total,unidade){
var out="",i2,x;
for(i2=0;i2<itens.length;i2++){
x=itens[i2];
out+='<li data-leg="'+c(x.cod||x.rot)+'"><i class="f-'+c(x.tom)+'"></i><span>'+c(x.rot)+"</span>"+
"<b>"+c("R$"===unidade?brlV(x.val):String(x.val))+"</b><em>"+c(vgPct1(x.val,total))+"</em></li>"}
return'<ul class="ro-leg">'+out+"</ul>"}
// ---- cards ------------------------------------------------------------------
function dvCard(tit,corpo,extra,cls){
return'<article class="cd'+(cls?" "+cls:"")+'">'+
(tit?'<div class="cd-top"><h3>'+c(tit)+"</h3>"+(extra||"")+"</div>":"")+corpo+"</article>"}
function dvKpi(cod,rot,valor,ico,tom,pe){
// O icone fica na linha do ROTULO, e o numero ocupa a largura inteira do card
// embaixo. Na primeira versao os tres dividiam a mesma linha, e medido na foto a
// 1440px (onde o dashboard vive numa coluna de ~1030px, nao na tela toda) o
// numero perdia 42px para o chip e saia truncado: "R$ 11.200..." e
// "R$ 2.800,...". Dinheiro cortado pela reticencia parece outro numero.
return'<article class="kp" data-kpi="'+c(cod)+'"><div class="kp-topo">'+
'<p class="kp-rot">'+c(rot)+"</p>"+dvIcone(ico,tom)+"</div>"+
'<p class="kp-num">'+c(valor)+'</p><p class="kp-pe">'+pe+"</p></article>"}
// Variacao contra o periodo anterior. `pp` compara pontos percentuais (margem e
// conversao sao taxas: variar "18%" numa taxa nao quer dizer nada util).
// `inverte` marca a metrica em que subir e RUIM: vazamento crescendo e verde
// seria a tela comemorando o prejuizo.
function dvVar(atual,ant,pp,inverte){
if(null==ant)return'<span class="kp-var kp-sem">sem período anterior</span>';
var d,txt;
if(pp){d=atual-ant;txt=(d>=0?"+":"−")+vgPct1(Math.abs(d),100).replace("%","")+" p.p."}
else{
if(!ant)return'<span class="kp-var kp-sem">sem base de comparação</span>';
d=100*(atual-ant)/Math.abs(ant);
txt=(d>=0?"+":"−")+vgPct1(Math.abs(d),100)}
var bom=inverte?d<0:d>=0;
return'<span class="kp-var '+(bom?"v-bom":"v-ruim")+'">'+(d>=0?"↑":"↓")+" "+c(txt)+"</span>"}
function dvFaixa(a,ant,rotAnt,lim){
var vaza=a.frete+a.taxas,tr="—",cv=dvConversao(lim),lds=cv.leads,conv=cv.n;
// Sem periodo anterior, cada card cai para um contexto REAL e DIFERENTE. A
// primeira versao repetia "sem periodo anterior" cinco vezes, o que faz a faixa
// inteira parecer quebrada, e a ausencia de comparacao ja e dita no cabecalho.
var vds=dvVendasNaJanela(lim),mai=0,men=0,j2,vv;
for(j2=0;j2<vds.length;j2++){
vv=Number(vds[j2].valor_venda)||0;
if(!j2||vv>mai)mai=vv;
if(!j2||vv<men)men=vv}
var vs=ant?'<span class="kp-vs">vs '+c(rotAnt)+"</span>":"";
var pe=function(cmp,ctx){return ant?cmp+vs:'<span class="kp-var kp-sem">'+c(ctx)+"</span>"};
var antVaza=ant?ant.frete+ant.taxas:0;
return'<div class="kp-faixa">'+
dvKpi("fat","Faturamento",a.n?brlV(a.fat):tr,"dinheiro","azul",
  pe(dvVar(a.fat,ant?ant.fat:null),a.n+(1===a.n?" venda":" vendas")+" na janela"))+
dvKpi("luc","Lucro",a.n?brlV(a.luc):tr,"lucro","verde",
  pe(dvVar(a.luc,ant?ant.luc:null),a.n?brlV(a.luc/a.n)+" por venda":"nada fechado"))+
dvKpi("margem","Margem",a.n?vgPct1(a.luc,a.fat):tr,"margem","laranja",
  pe(dvVar(a.fat>0?100*a.luc/a.fat:0,ant&&ant.fat>0?100*ant.luc/ant.fat:null,!0),
     a.n?brlV(vaza)+" de despesa":"sem base"))+
dvKpi("ticket","Ticket médio",a.n?brlV(a.fat/a.n):tr,"ticket","roxo",
  pe(dvVar(a.n?a.fat/a.n:0,ant&&ant.n?ant.fat/ant.n:null),
     a.n>1?"maior "+brlV(mai)+" · menor "+brlV(men):a.n?"venda única":"sem venda"))+
dvKpi("conv","Conversão",lds?vgPct1(conv,lds):tr,"alvo","vermelho",
  '<span class="kp-var kp-sem">'+conv+" de "+lds+" lead"+(1===lds?"":"s")+" da janela</span>")+
"</div>"}
// Conversao e COORTE: quantos dos leads que ENTRARAM na janela ja fecharam.
// A primeira versao dividia venda da janela por lead da janela, e na foto de
// 12/08/2026 deu "133,3%" (4 vendas sobre 3 leads), porque venda de lead antigo
// entrava no numerador sem estar no denominador. Taxa acima de 100% nao e
// numero apertado, e a tela dizendo que a conta esta errada.
function dvConversao(lim){
var lds=dvLeadsNaJanela(lim),dentro={},j,n=0,vds=dvVendasNaJanela(lim);
for(j=0;j<lds.length;j++)dentro[String(lds[j].id)]=1;
var jaContou={};
for(j=0;j<vds.length;j++){
var k=String(vds[j].lead_id);
if(dentro[k]&&!jaContou[k]){jaContou[k]=1;n++}}
return{n:n,leads:lds.length}}
var DV_TONS=["azul","verde","laranja","roxo","vermelho"];
function dvCardCanal(canais){
// "sem origem" NUNCA pega cor de canal: verde ali leria como um canal indo bem,
// quando na verdade e dado FALTANDO. Cinza e a cor de ausencia.
var itens=[],tot=0,j,k=0;
for(j=0;j<canais.length;j++){
if(!(canais[j].fat>0))continue;
itens.push({cod:canais[j].cod||"sem_origem",rot:canais[j].rot,val:canais[j].fat,
  tom:canais[j].cod?DV_TONS[k++%DV_TONS.length]:"cinza"});
tot+=canais[j].fat}
if(!itens.length)return dvCard("Faturamento por canal",
  '<div class="estado"><strong>Nenhuma venda na janela.</strong></div>',"","c-canal");
var fat=[],j2;
for(j2=0;j2<itens.length;j2++)fat.push([itens[j2].tom,itens[j2].val]);
return dvCard("Faturamento por canal",
  '<div class="ro-linha">'+dvRosca(fat,150,22,vgMilhar(tot),"Total",
    "Faturamento por canal de origem")+"</div>"+dvLeg(itens,tot,"R$"),"","c-canal")}
function dvCardTempo(a){
if(!a.meses.length)return dvCard("Faturamento ao longo do tempo",
  '<div class="estado"><strong>Nenhum mês com venda.</strong></div>',"","c-tempo");
var mx=0,j,m,out="",eixo="",p;
for(j=0;j<a.meses.length;j++)if(a.meses[j].fat>mx)mx=a.meses[j].fat;
for(j=0;j<a.meses.length;j++){
m=a.meses[j];
// Mes em prejuizo: a barra cresce para cima em qualquer caso, entao sem marca
// propria um rombo de R$ 200 desenharia igual a um ganho de R$ 200. A hachura +
// o vermelho carregam a diferenca, pela mesma razao do v52: lucro x prejuizo
// medem 1.32 de luminancia, e matiz sozinho nao separa.
out+='<div class="tp-col" data-mes="'+c(m.ym)+'"><div class="tp-par">'+
'<span class="tp-b b-fat" style="height:'+Math.max(2,Math.round(100*m.fat/mx))+'%">'+
'<i>'+c(vgMilhar(m.fat))+"</i></span>"+
'<span class="tp-b b-luc'+(m.luc<0?" b-neg":"")+'" style="height:'+
Math.max(2,Math.round(100*Math.abs(m.luc)/mx))+'%">'+
'<i>'+c(vgMilhar(m.luc))+"</i></span></div>"+
'<span class="tp-rot">'+c(vgMesRot(m.ym))+"</span></div>"}
for(p=0;p<4;p++)eixo+="<span>"+c(vgMilhar(mx*(3-p)/3))+"</span>";
// A linha diaria da referencia NAO entrou: 3 vendas em 73 dias sao 3 bolinhas
// numa reta, e o v52 ja reprovou serie temporal sobre 3 pontos como decoracao.
// A regra de volta esta escrita no proprio card para a proxima sessao nao achar
// que foi esquecimento.
return dvCard("Faturamento ao longo do tempo",
  '<div class="tp-leg"><span><i class="f-azul"></i>faturamento</span>'+
  '<span><i class="f-verde"></i>lucro</span></div>'+
  '<div class="tp-graf" role="img" aria-label="Faturamento e lucro por mês na janela">'+
  '<div class="tp-eixo">'+eixo+'</div><div class="tp-cols">'+out+"</div></div>"+
  '<p class="cd-pe">'+a.meses.length+(1===a.meses.length?" mês":" meses")+
  ' na janela. A linha diária volta a partir de <b>8 pontos</b>.</p>',"","c-tempo")}
function dvCardFinanceiro(a){
var bruta=a.fat-a.custo;
var lin=function(rot,val,cls,cor){
return'<li class="'+(cls||"")+'"><span>'+c(rot)+'</span><b class="'+(cor||"")+'">'+c(val)+"</b></li>"};
return dvCard("Resumo financeiro",
  '<ul class="fn">'+
  lin("Faturamento",brlV(a.fat),"l-forte")+
  lin("(−) Custo dos aparelhos","− "+brlV(a.custo))+
  lin("(=) Margem bruta",brlV(bruta),"l-sub")+
  lin("(−) Frete","− "+brlV(a.frete))+
  lin("(−) Taxas","− "+brlV(a.taxas))+
  lin("(=) Lucro líquido",brlV(a.luc),"l-total")+
  "</ul><p class=\"cd-pe\">Não existem <b>devoluções</b> nem <b>impostos</b> no cadastro de "+
  "venda: as duas linhas da referência ficaram de fora em vez de nascerem zeradas.</p>",
  "","c-fin")}
function dvCardProdutos(vds){
if(!vds.length)return dvCard("Aparelhos mais vendidos",
  '<div class="estado"><strong>Nenhuma venda na janela.</strong></div>',"","c-prod");
var lst=vds.slice(0).sort(function(x,y){return(Number(y.valor_venda)||0)-(Number(x.valor_venda)||0)});
var out="",j,v,val,luc;
for(j=0;j<lst.length&&j<6;j++){
v=lst[j];val=Number(v.valor_venda)||0;luc=Number(v.lucro)||0;
out+='<li><span class="pr-i">'+(j+1)+'</span><span class="pr-nome">'+
c(v.modelo_texto||v.modelo_rotulo||"sem modelo")+"<em>"+
c((v.condicao?s("condicao",v.condicao):"sem condição")+" · margem "+vgPct1(luc,val))+
"</em></span><span class=\"pr-un\">1 un.</span><b>"+c(brlV(val))+"</b></li>"}
return dvCard("Aparelhos mais vendidos",'<ul class="pr">'+out+"</ul>","","c-prod")}
// A conversao aqui e a MESMA coorte do KPI (lead que entrou na janela e ja
// fechou), nao venda/lead solto. Na foto de 12/08/2026 o rodape dizia 133,3%
// (4 vendas sobre 3 leads) enquanto o card de cima dizia 0,0%: duas contas com o
// mesmo nome na mesma tela, e a tabela contradizendo o placar.
function dvCardDesempenho(canais){
var out="",j,x,tl=0,tv=0,tf=0,tc=0;
for(j=0;j<canais.length;j++){
x=canais[j];tl+=x.leads;tv+=x.n;tf+=x.fat;tc+=x.conv;
out+="<tr><td>"+c(x.rot)+'</td><td class="n">'+x.leads+'</td><td class="n">'+x.n+
'</td><td class="n">'+c(x.fat?brlV(x.fat):"—")+'</td><td class="n">'+
c(x.n?brlV(x.fat/x.n):"—")+'</td><td class="n"><span class="conv">'+
c(x.leads?vgPct1(x.conv,x.leads):"—")+'<span class="cv-tubo"><span class="cv-b" style="width:'+
(x.leads?Math.min(100,Math.round(100*x.conv/x.leads)):0)+'%"></span></span></span></td></tr>'}
return dvCard("Desempenho por canal",
  '<div class="tb-rolo"><table class="tb"><thead><tr><th>Canal</th><th class="n">Leads</th>'+
  '<th class="n">Vendas</th><th class="n">Faturamento</th><th class="n">Ticket</th>'+
  '<th class="n">Conversão</th></tr></thead><tbody>'+out+"</tbody><tfoot><tr><td>Total</td>"+
  '<td class="n">'+tl+'</td><td class="n">'+tv+'</td><td class="n">'+c(brlV(tf))+
  '</td><td class="n">'+c(tv?brlV(tf/tv):"—")+'</td><td class="n">'+
  c(tl?vgPct1(tc,tl):"—")+"</td></tr></tfoot></table></div>"+
  '<p class="cd-pe">Lead conta pela <b>entrada</b> na janela, venda pelo <b>fechamento</b>: '+
  'um lead antigo que fecha hoje entra na venda de hoje, não no lead de hoje.</p>',
  "","c-desemp")}
function dvCardStatus(lim){
var cont={concluida:0,pre_venda:0,cancelada:0,arquivada:0},j,v,d;
for(j=0;j<(vendasData||[]).length;j++){
v=vendasData[j];d=vgDataDe(v);
if(!d||d<lim.ini||d>lim.fim)continue;
if(null!=cont[v.status])cont[v.status]++}
// A arquivada vem da OUTRA lista: a v_venda filtra arquivado_em is null, entao
// sem isto a rosca diria que nao existe venda arquivada, que e falso.
for(j=0;j<(vendasArq||[]).length;j++){
d=vendasArq[j].data_venda||u(vendasArq[j].arquivado_em)||"";
if(!d||d<lim.ini||d>lim.fim)continue;
cont.arquivada++}
var defs=[["Concluída","concluida","verde"],["Pré-venda","pre_venda","azul"],
["Arquivada","arquivada","cinza"],["Cancelada","cancelada","vermelho"]];
var itens=[],fat=[],tot=0,k;
for(k=0;k<defs.length;k++){
itens.push({cod:defs[k][1],rot:defs[k][0],val:cont[defs[k][1]],tom:defs[k][2]});
fat.push([defs[k][2],cont[defs[k][1]]]);
tot+=cont[defs[k][1]]}
if(!tot)return dvCard("Status das vendas",
  '<div class="estado"><strong>Nenhuma venda na janela.</strong></div>',"","c-status");
// Status com zero CONTINUA na legenda: "Cancelada 0" e informacao, cancelada
// sumida e omissao. Na rosca ele nao vira fatia, porque zero nao tem angulo.
return dvCard("Status das vendas",
  '<div class="ro-linha">'+dvRosca(fat,140,20,String(tot),"Total","Status das vendas na janela")+
  "</div>"+dvLeg(itens,tot,""),"","c-status")}
function dvCardCondicao(vds){
var mapa={},ordem=[],j,v,cod,m,mx=0;
for(j=0;j<vds.length;j++){
v=vds[j];cod=v.condicao||"";
m=mapa[cod];
if(!m){m={cod:cod,rot:cod?s("condicao",cod):"sem condição",n:0,fat:0,luc:0};mapa[cod]=m;ordem.push(m)}
m.n++;m.fat+=Number(v.valor_venda)||0;m.luc+=Number(v.lucro)||0}
if(!ordem.length)return dvCard("Margem por condição",
  '<div class="estado"><strong>Nenhuma venda na janela.</strong></div>',"","c-cond");
for(j=0;j<ordem.length;j++)if(ordem[j].fat>0&&100*ordem[j].luc/ordem[j].fat>mx)mx=100*ordem[j].luc/ordem[j].fat;
if(!(mx>0))mx=1;
ordem.sort(function(x,y){return(y.fat>0?y.luc/y.fat:0)-(x.fat>0?x.luc/x.fat:0)});
var out="";
for(j=0;j<ordem.length;j++){
m=ordem[j];
var mg=m.fat>0?100*m.luc/m.fat:0;
out+='<li data-cond="'+c(m.cod||"sem")+'"><span class="cn-rot">'+c(m.rot)+"</span>"+
'<span class="cn-tubo"><span class="cn-b'+(mg<0?" neg":"")+'" style="width:'+
Math.max(2,Math.min(100,Math.round(100*Math.abs(mg)/mx)))+'%"></span></span>'+
"<b>"+c(vgPct1(m.luc,m.fat))+"</b><em>"+m.n+" un.</em></li>"}
// Ocupa o slot de "origens de trafego" da referencia. O sistema nao tem
// analytics nenhum, e sessao inventada nao e dado.
return dvCard("Margem por condição",'<ul class="cn">'+out+"</ul>"+
  '<p class="cd-pe">A última coluna é o nº de vendas: <b>uma venda não é tendência</b>.</p>',
  "","c-cond")}
// Insights sao REGRA, nao IA: condicoes deterministicas sobre o dado que ja esta
// na memoria. Sao auditaveis (da para conferir o numero na propria tela), de
// graca e estaveis entre dois cliques. E limitados de proposito: so enxergam o
// que esta escrito aqui.
function dvInsights(a,canais,vds){
var out=[],j,x,pior=null,melhor=null,semOrig=0,cond={},k,mx=null,mn=null;
for(j=0;j<canais.length;j++){
x=canais[j];
if(!x.cod)continue;
if(x.leads>=5&&0===x.n&&(!pior||x.leads>pior.leads))pior=x;
if(x.leads>=3&&x.n>0){
var tx=x.n/x.leads;
if(!melhor||tx>melhor.tx)melhor={rot:x.rot,tx:tx,leads:x.leads,n:x.n}}}
for(j=0;j<canais.length;j++)if(!canais[j].cod)semOrig=canais[j].fat;
if(pior)out.push(["ruim",pior.rot+" não converte",
  pior.leads+" leads, nenhuma venda. É entrada sem saída."]);
if(melhor&&a.n&&melhor.tx>a.n/Math.max(1,dvLeadsTot))out.push(["bom",melhor.rot+" é o melhor canal",
  melhor.leads+" leads, "+melhor.n+(1===melhor.n?" venda":" vendas")+": "+
  vgPct1(melhor.n,melhor.leads)+" de conversão."]);
for(j=0;j<vds.length;j++){
k=vds[j].condicao||"";
if(!cond[k])cond[k]={rot:k?s("condicao",k):"sem condição",n:0,fat:0,luc:0};
cond[k].n++;cond[k].fat+=Number(vds[j].valor_venda)||0;cond[k].luc+=Number(vds[j].lucro)||0}
for(k in cond)if(Object.prototype.hasOwnProperty.call(cond,k)&&cond[k].fat>0){
var mg=100*cond[k].luc/cond[k].fat;
if(!mx||mg>mx.mg)mx={rot:cond[k].rot,mg:mg,n:cond[k].n};
if(!mn||mg<mn.mg)mn={rot:cond[k].rot,mg:mg,n:cond[k].n}}
if(mx&&mn&&mx.rot!==mn.rot&&mx.mg-mn.mg>=5)
out.push(["atencao",mx.rot+" rende mais margem",
  mx.rot+" "+vgPct1(mx.mg,100)+" contra "+vgPct1(mn.mg,100)+" de "+mn.rot+
  ". Apoiado em "+mx.n+(1===mx.n?" venda":" vendas")+
  (mx.n<3?": confirmar antes de virar regra.":".")]);
if(a.fat>0&&semOrig/a.fat>=.2)
out.push(["atencao",vgPct1(semOrig,a.fat)+" do faturamento sem canal",
  brlV(semOrig)+" vieram de lead sem origem preenchida. O painel de canal fica cego assim."]);
if(!out.length)out.push(["bom","Nada fora da curva",
  "Nenhuma das regras de alerta disparou nesta janela."]);
var li="",j2;
for(j2=0;j2<out.length;j2++)
li+='<li class="in-'+out[j2][0]+'" data-ins="'+out[j2][0]+'"><span class="in-p"></span><div><b>'+
c(out[j2][1])+"</b><em>"+c(out[j2][2])+"</em></div></li>";
return dvCard("Insights",'<ul class="ins">'+li+"</ul>"+
  '<button class="cd-cta" data-acao="dv-ver-vendas">Ver todas as vendas →</button>',
  "","c-ins")}
var dvLeadsTot=1;
function dvCab(a,lim,ant){
var op="",j;
for(j=0;j<DV_JANELAS.length;j++)
op+='<button class="dh-seg-b" data-acao="dv-janela" data-id="'+DV_JANELAS[j][0]+
'" aria-pressed="'+(dvJanela===DV_JANELAS[j][0]?"true":"false")+'">'+c(DV_JANELAS[j][1])+"</button>";
// O recorte e o seletor tem que CONCORDAR: um cabecalho que discorda do proprio
// dado e a maneira mais barata de a tela mentir.
return'<header class="dh"><div class="dh-tit"><span class="dh-ico" aria-hidden="true">'+
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '+
'stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span>'+
'<div><h1>Performance de Vendas</h1><p>Visão geral do seu negócio</p></div></div>'+
'<div class="dh-per"><span class="dh-cx">'+c(vgDataBr(lim.ini))+" – "+c(vgDataBr(lim.fim))+"</span>"+
'<span class="dh-cx'+(ant?"":" dh-vazio")+'">'+
(ant?"Comparar com: "+c(ant.rot):"Comparar: sem período anterior")+"</span></div>"+
'<div class="dh-seg">'+op+"</div></header>"}
function dvPainel(){
var linhas=vendasData||[],lim=vgLimites(linhas,dvJanela),a=vgAgregar(linhas,lim);
var ant=dvAnterior(),aAnt=ant?vgAgregar(linhas,ant):null;
var vds=dvVendasNaJanela(lim),canais=dvCanais(lim);
dvLeadsTot=Math.max(1,dvLeadsNaJanela(lim).length);
// TRES linhas de QUATRO unidades, e nao duas de quatro cards: os dois cards com
// mais conteudo horizontal (a serie no tempo, que precisa de eixo, e a tabela de
// canal, que tem 6 colunas) ocupam DUAS unidades cada. Medido na foto: com todos
// do mesmo tamanho numa coluna de ~1030px, a tabela cortava Ticket e Conversao.
// O agrupamento tambem ficou por assunto: dinheiro, canais, produto e leitura.
return'<section class="dash" aria-label="Dashboard de performance de vendas">'+
dvCab(a,lim,ant)+dvFaixa(a,aAnt,ant?ant.rot:"",lim)+
'<div class="dash-l">'+dvCardCanal(canais)+dvCardTempo(a)+dvCardFinanceiro(a)+"</div>"+
'<div class="dash-l">'+dvCardDesempenho(canais)+dvCardStatus(lim)+dvCardCondicao(vds)+"</div>"+
'<div class="dash-l">'+dvCardProdutos(vds)+dvInsights(a,canais,vds)+"</div></section>"}

// Portao unico de leitura por tabela/view. Antes, os quatro carregadores faziam
// `(r&&r.data)||[]` e nunca liam `r.error`: rede caida ou JWT expirado viravam
// lista vazia, e a tela pintava o estado VAZIO, convidando o dono a recadastrar o
// que ja existe. Espelha o guarda que B() ja fazia sozinho.
// Em falha NAO zera o global: o ultimo dado bom vale mais que uma lista vazia.
async function ler(promessa,oQue){
var r;
try{r=await promessa}catch(e){return{ok:!1,dados:[],erro:String((e&&e.message)||e)}}
if(r&&r.error){
if(await pwSemSessao()){pwSessaoCaiu();return{ok:!1,dados:[],erro:"",sessao:!1}}
return{ok:!1,dados:[],erro:r.error.message||("Falha ao ler "+oQue)}}
return{ok:!0,dados:(r&&r.data)||[],erro:""}}
function estadoErro(oQue,erro){
return'<div class="estado erro"><strong>Falha ao ler '+c(oQue)+".</strong><br>"+(erro?c(erro)+" ":"")+"Toque em Atualizar para tentar de novo.</div>"}
// Primeira leitura que falhou, ou null se todas passaram. sessao===!1 quer dizer
// que pwSessaoCaiu() ja repintou o login, entao o render sai sem escrever nada.
// Argumento vazio e IGNORADO de proposito: quem nao devolve resultado nao
// reportou falha, e derrubar o render por isso seria pior que o bug original.
function primeiraFalha(){
for(var i=0;i<arguments.length;i++){var r=arguments[i];if(r&&!r.ok)return r}
return null}
async function carregarVendas(){
var r=await ler(t.from("v_venda").select("*").order("criado_em",{ascending:!1}),"as vendas");
if(r.ok)vendasData=r.dados;return r}
// As arquivadas vem da TABELA, nao da v_venda: a view filtra arquivado_em is
// null, e mexer nela para caber um contador derrubaria o security_invoker em
// silencio. A tabela ja e isolada por RLS, entao o tenant continua garantido.
async function carregarVendasArq(){
var r=await ler(t.from("venda").select("id,venda_code,modelo_texto,comprador_nome,valor_venda,data_venda,arquivado_em")
.not("arquivado_em","is",null).order("arquivado_em",{ascending:!1}),"as vendas arquivadas");
if(r.ok)vendasArq=r.dados;return r}
function cardVendaArq(v){
return '<div class="card arquivada"><div class="card-top"><span class="card-code">'+c(v.venda_code||"")+'</span><span class="card-prod">'+c(v.modelo_texto||"")+'</span></div><div class="card-sub">'+
c(v.comprador_nome||"sem cliente")+(v.data_venda?" · "+c(fmtDia(v.data_venda)):"")+" · "+brlV(v.valor_venda)+"</div>"+
'<div class="venda-cli"><span class="venda-cli-code">fora do faturamento</span><button class="btn-acao" data-acao="venda-desarquivar" data-id="'+c(v.id)+'">Desarquivar</button></div></div>'}
// Separado de renderVendas porque trocar a janela do painel (ou abrir as
// arquivadas) e filtro sobre dado que JA esta na memoria. Refazer as tres
// leituras de rede para isso e exatamente o defeito que o v51 tirou do resto do
// app; nao vale reintroduzi-lo aqui.
function pintarVendas(e){
e=e||E("lista");
if(!e)return;
var lista=filtVendaBusca(vendasData,E("inputBusca")?E("inputBusca").value:"");
var arq=vendasArq.length?' · <button class="venda-arq-btn" data-acao="venda-arq-alternar" aria-expanded="'+(vendasArqAberto?"true":"false")+'">'+vendasArq.length+" arquivada"+(1===vendasArq.length?"":"s")+"</button>":"";
var topo='<div class="venda-topo"><button class="btn-cad" data-acao="nova-venda">+ Nova venda</button><span class="venda-cont">'+vendasData.length+(1===vendasData.length?" venda":" vendas")+arq+"</span></div>";
e.innerHTML=vgPainel()+topo+(lista.length?lista.map(cardVenda).join(""):'<div class="estado"><strong>Nenhuma venda ainda.</strong><br>Toque em Nova venda pra registrar a primeira.</div>')+
(vendasArqAberto&&vendasArq.length?'<p class="venda-arq-tit">Arquivadas · não contam no faturamento</p>'+vendasArq.map(cardVendaArq).join(""):"");
// o balao morreu junto com o innerHTML antigo, entao o estado preso morre junto
VG_TIP_ABERTO="";
vgLigarHover()}
async function renderVendas(e,sil){
if(!sil)e.innerHTML='<div class="estado carregando">Lendo vendas…</div>';
var rv=await carregarVendas(),rn=await carregarNfs(),ra=await carregarVendasArq();
var falha=primeiraFalha(rv,rn,ra);
if(falha){if(!1!==falha.sessao)e.innerHTML=estadoErro("as vendas",falha.erro);return}
pintarVendas(e)}
function calcLucroVenda(){
var num=function(id){var x=parseFloat(String((E(id)?E(id).value:"")||"").replace(",","."));return isNaN(x)?0:x};
var lu=num("fvValor")-num("fvCusto")-num("fvFrete")-num("fvTaxas");
if(E("fvLucro"))E("fvLucro").textContent="lucro "+brlV(lu)}
// leadId opcional: quem chega pelo botao "Fechou" da Fila ou pelo card do
// cliente ja entra com o comprador vinculado, sem redigitar (e sem digitar
// diferente, que e como nasce cliente duplicado).
// Campo do painel -> coluna da venda. Uma lista SO, usada nos dois sentidos
// (preencher na correcao, limpar no cadastro novo): em duas listas, o campo
// novo entraria num lado e sumiria no outro. Nao estao aqui, de proposito:
// data_venda e o cliente, que a correcao nao mexe (ancora do pos-venda), e o
// upload de NF, que tem caminho proprio no card.
var FV_CAMPOS=[["fvModelo","modelo_texto"],["fvCapacidade","capacidade"],["fvCor","cor"],
["fvCondicao","condicao"],["fvImei","imei"],["fvValor","valor_venda"],["fvCusto","custo_aparelho"],
["fvFrete","despesa_frete"],["fvTaxas","despesa_taxas"],["fvNome","comprador_nome"],
["fvInsta","comprador_instagram"],["fvNasc","comprador_nascimento"],["fvFornNome","fornecedor_nome"],
["fvFornContato","fornecedor_contato"],["fvFornLocal","fornecedor_local_retirada"],
["fvEntModelo","entrada_modelo"],["fvEntImei","entrada_imei"],["fvEntValor","entrada_valor"],
["fvStatus","status"],["fvEndereco","endereco_entrega"],["fvCobrar","valor_a_cobrar"],
["fvMotoboy","motoboy"],["fvPgto","forma_pagamento"],["fvNfNum","nf_numero"],["fvObs","observacoes"]];
function fvSet(id,val){if(E(id))E(id).value=null==val?"":String(val)}
// O painel nao se limpava sozinho: so fvModelo e fvNfArq eram zerados, e o
// resto ficava do cadastro anterior. Com correcao no mesmo formulario isso
// deixaria de ser incomodo e viraria dado errado, entao a limpeza e completa.
function limparPainelVenda(){
FV_CAMPOS.forEach(function(p){fvSet(p[0],"")});
fvSet("fvWhats","");fvSet("fvCpf","");fvSet("fvData","");fvSet("fvTradeIn","");fvSet("fvMotoboyWhats","");
if(E("fvStatus"))E("fvStatus").value="concluida";
if(E("fvNfArq"))E("fvNfArq").value=""}
function preencherPainelVenda(v){
FV_CAMPOS.forEach(function(p){fvSet(p[0],v[p[1]])});
if(!v.modelo_texto)fvSet("fvModelo",v.modelo_rotulo||"");
fvSet("fvWhats",v.comprador_whatsapp?f(v.comprador_whatsapp):"");fvSet("fvMotoboyWhats",v.motoboy_whatsapp?f(v.motoboy_whatsapp):"");
fvSet("fvCpf",v.comprador_cpf?cliFmtCpf(v.comprador_cpf):"");
fvSet("fvData",v.data_venda||"");
fvSet("fvTradeIn",v.tem_trade_in?"sim":"");
if(E("fvLeadStatus"))E("fvLeadStatus").innerHTML=v.lead_id
?'Venda de '+c(v.cliente_nome||"cliente")+(v.cliente_code?' · '+c(v.cliente_code):"")+' <span class="fv-cli-falta">para mover de cliente, é outro caminho</span>'
:'<span class="fv-cli-falta">venda sem cliente vinculado</span>'}
// leadId opcional (ver acima); venda opcional = MODO CORRECAO. Os dois nunca
// vem juntos: ou se cadastra para alguem, ou se corrige o que ja existe.
async function abrirPainelVenda(leadId,venda){
var r=await t.from("catalogo_iphone").select("id,rotulo").eq("ativo",!0).order("ordem");
var mopts=(((r&&r.data)||[]).map(function(m){return'<option value="'+c(m.rotulo)+'"></option>'}).join(""));
if(E("fvModeloLista"))E("fvModeloLista").innerHTML=mopts;
if(E("fvCapacidadeLista"))E("fvCapacidadeLista").innerHTML=["64GB","128GB","256GB","512GB","1TB"].map(function(x){return'<option value="'+x+'"></option>'}).join("");
VENDA_EDIT=venda||null;
limparPainelVenda();
limparClienteVenda();
if(venda)preencherPainelVenda(venda);
else if(leadId)preencherClienteVenda(leadId);
if(E("pvTitulo"))E("pvTitulo").textContent=venda?"Editar "+(venda.venda_code||"venda"):"Nova venda";
if(E("btnSalvarVenda"))E("btnSalvarVenda").textContent=venda?"Salvar correção":"Salvar venda";
// a data ancora o pos-venda desde a v43: na correcao ela e leitura, e a nota
// ao lado do campo diz por que
if(E("fvData"))E("fvData").disabled=!!venda;
if(E("fvErro"))E("fvErro").textContent="";
calcLucroVenda();
if(E("painelVenda"))E("painelVenda").className="painel-cadastro"+(venda?" modo-edicao":"")}
function fecharPainelVenda(){
VENDA_EDIT=null;
if(E("fvData"))E("fvData").disabled=!1;
if(E("painelVenda"))E("painelVenda").className="painel-cadastro oculto"}
var fvLeadSel=null;function fvCliHit(a){return'<button type="button" class="fv-cli-hit" data-acao="fv-cli-pick" data-id="'+c(a.id)+'"><strong>'+c(a.nome||"(sem nome)")+'</strong><span>'+(a.whatsapp_digitos?c(f(a.whatsapp_digitos)):"sem telefone")+(a.produto?" · "+c(a.produto):"")+'</span></button>'}function buscaClienteVenda(){var cx=E("fvClienteResultados");if(!cx)return;var termo=E("fvClienteBusca")?E("fvClienteBusca").value:"";if(!String(termo).trim()){cx.innerHTML="";return}var ativos=(i||[]).filter(function(x){return!x.arquivado_em}),hits=g(ativos,termo).slice(0,6);cx.innerHTML=hits.length?hits.map(fvCliHit).join(""):'<div class="fv-cli-vazio">Nenhum cliente na base com esse termo.</div>'}function preencherClienteVenda(id){var L=(i||[]).filter(function(x){return String(x.id)===String(id)})[0];if(!L)return;fvLeadSel=L;if(E("fvNome"))E("fvNome").value=L.nome||"";if(E("fvWhats"))E("fvWhats").value=L.whatsapp_digitos?f(L.whatsapp_digitos):"";
// o cadastro do cliente manda no que ja existe; campo digitado a mao nao e
// sobrescrito. Endereco do cadastro entra como destino padrao da entrega.
if(E("fvCpf")&&!E("fvCpf").value&&L.cpf)E("fvCpf").value=cliFmtCpf(L.cpf);
if(E("fvNasc")&&!E("fvNasc").value&&L.data_nascimento)E("fvNasc").value=L.data_nascimento;
if(E("fvEndereco")&&!E("fvEndereco").value)E("fvEndereco").value=cliEndereco(L);
if(E("fvClienteResultados"))E("fvClienteResultados").innerHTML="";if(E("fvClienteBusca"))E("fvClienteBusca").value="";var st=E("fvLeadStatus");if(st)st.innerHTML='Vinculado a '+c(L.nome||L.lead_code||"lead")+(L.lead_code?' · '+c(L.lead_code):"")+(L.cpf?"":' <span class="fv-cli-falta">sem CPF no cadastro</span>')+' <button type="button" class="fv-cli-desfazer" data-acao="fv-cli-limpar">desfazer</button>'}function limparClienteVenda(){fvLeadSel=null;if(E("fvClienteBusca"))E("fvClienteBusca").value="";if(E("fvClienteResultados"))E("fvClienteResultados").innerHTML="";if(E("fvLeadStatus"))E("fvLeadStatus").innerHTML=""}function fvCliClick(ev){var el=ev.target&&ev.target.closest?ev.target.closest("[data-acao]"):null;if(!el)return;var o=el.getAttribute("data-acao");if("fv-cli-pick"===o)preencherClienteVenda(el.getAttribute("data-id"));else if("fv-cli-limpar"===o)limparClienteVenda();else if("venda-arquivar"===o)arquivarVendaUI()}async function salvarVenda(){
var val=function(id){return E(id)?E(id).value:""};
var payload={valor_venda:val("fvValor"),modelo_texto:val("fvModelo"),lead_id:(fvLeadSel?fvLeadSel.id:""),capacidade:val("fvCapacidade"),cor:val("fvCor"),condicao:val("fvCondicao"),imei:val("fvImei"),comprador_nome:val("fvNome"),comprador_whatsapp:val("fvWhats"),comprador_cpf:val("fvCpf"),comprador_nascimento:val("fvNasc"),comprador_instagram:val("fvInsta"),fornecedor_nome:val("fvFornNome"),fornecedor_contato:val("fvFornContato"),fornecedor_local_retirada:val("fvFornLocal"),custo_aparelho:val("fvCusto"),despesa_frete:val("fvFrete"),despesa_taxas:val("fvTaxas"),tem_trade_in:"sim"===val("fvTradeIn"),entrada_modelo:val("fvEntModelo"),entrada_imei:val("fvEntImei"),entrada_valor:val("fvEntValor"),status:val("fvStatus"),endereco_entrega:val("fvEndereco"),valor_a_cobrar:val("fvCobrar"),motoboy:val("fvMotoboy"),motoboy_whatsapp:val("fvMotoboyWhats"),forma_pagamento:val("fvPgto"),data_venda:val("fvData"),nf_numero:val("fvNfNum"),observacoes:val("fvObs")};
if(!(parseFloat(payload.valor_venda)>0)){if(E("fvErro"))E("fvErro").textContent="Informe o valor da venda.";return}
if(!String(payload.modelo_texto||"").trim()){if(E("fvErro"))E("fvErro").textContent="Informe o modelo.";return}
// Cliente obrigatorio. A RPC recusa do mesmo jeito, mas errar aqui poupa a ida
// ao servidor e diz onde consertar. Sem dono, a venda nao vira NF nem recompra.
if(!VENDA_EDIT&&!fvLeadSel&&!String(payload.comprador_nome||"").trim()){
if(E("fvErro"))E("fvErro").textContent="Toda venda precisa de cliente: busque na base ou digite o nome do comprador.";
if(E("fvClienteBusca"))E("fvClienteBusca").focus();
return}
if(E("fvErro"))E("fvErro").textContent="";
// Correcao: mesmo formulario, outra RPC. lead_id e data_venda saem do payload
// antes de sair daqui. A whitelist da RPC ja os ignora, mas mandar campo que
// nao vale mente para quem ler este codigo depois.
if(VENDA_EDIT){
var pe={id:VENDA_EDIT.id};
for(var kk in payload)if("lead_id"!==kk&&"data_venda"!==kk)pe[kk]=payload[kk];
var re=await t.rpc("editar_venda",{payload:pe});
var de=re&&re.data;
if(de&&de.ok){I("Venda "+de.venda_code+" corrigida");fecharPainelVenda();n="vendas";B(!0)}
else I((de&&de.erro)||(re&&re.error&&re.error.message)||"Falha ao corrigir",!0);
return}
var r=await t.rpc("registrar_venda",{payload:payload});
var d=r&&r.data;
if(d&&d.ok){
// a NF so sobe depois que a venda existe: o caminho no bucket carrega o id dela.
var fa=E("fvNfArq"),f1=fa&&fa.files&&fa.files[0];
// o toast nomeia o cliente porque a venda acabou de mexer no cadastro dele:
// lead novo criado, ou lead antigo promovido a comprou pela RPC.
var quem=d.cliente_novo?" · cliente "+(d.lead_code||"")+" criado":d.cliente_nome?" · "+d.cliente_nome:"";
if(f1){var res=await subirNf(f1,d.id,val("fvNfNum"));
I(res.ok?"Venda "+d.venda_code+" registrada com NF"+quem:"Venda "+d.venda_code+" registrada, mas a NF não subiu: "+res.erro,!res.ok);
fa.value=""}
else I("Venda "+d.venda_code+" registrada"+quem);
fecharPainelVenda();n="vendas";
// B() releitura o v_lead: o cliente novo (ou promovido) precisa entrar na base
// em memoria, senao ele so aparece no proximo refresh manual.
B()}
else I(d&&d.erro||r&&r.error&&r.error.message||"Falha ao salvar",!0)}

// Arquivar e o soft delete da venda: ela sai da lista, do faturamento e do
// total do cliente (v_venda, v_cliente, v_venda_nf e painel_metricas filtram
// arquivado_em), mas a linha e a auditoria ficam. E diferente de status
// Cancelada, que e "a venda existiu e caiu": arquivada e "isso nunca foi uma
// venda" (o caso da duplicata de clique duplo). A confirmacao diz isso.
async function arquivarVendaUI(){
var v=VENDA_EDIT;
if(!v)return;
// mesma regra da v_cliente: nao arquivada e nao cancelada. Aviso ANTES do
// clique, senao o operador descobre que zerou o cliente depois do fato.
var ativas=(vendasData||[]).filter(function(x){return String(x.lead_id)===String(v.lead_id)&&"cancelada"!==x.status}).length;
var msg="Arquivar "+(v.venda_code||"esta venda")+"?\n\nEla sai da lista, do faturamento e do total do cliente. O registro e a auditoria ficam, e dá pra desarquivar depois.";
if(v.lead_id&&ativas<=1)msg+="\n\nEsta é a única venda de "+(v.cliente_nome||"este cliente")+". Ele continua como cliente e o pós-venda dele segue rodando.";
if(!window.confirm(msg))return;
var r=await t.rpc("arquivar_venda",{p_id:v.id,p_arquivar:!0});
var d=r&&r.data;
if(d&&d.ok){
I("Venda "+d.venda_code+" arquivada"+(d.cliente_ficou_sem_venda?" · o cliente ficou sem venda ativa":""));
fecharPainelVenda();n="vendas";B(!0)}
else I((d&&d.erro)||(r&&r.error&&r.error.message)||"Falha ao arquivar",!0)}
async function desarquivarVenda(id){
if(!window.confirm("Desarquivar esta venda? Ela volta para a lista e volta a contar no faturamento."))return;
var r=await t.rpc("arquivar_venda",{p_id:id,p_arquivar:!1});
var d=r&&r.data;
if(d&&d.ok){I("Venda "+d.venda_code+" desarquivada");n="vendas";B(!0)}
else I((d&&d.erro)||(r&&r.error&&r.error.message)||"Falha ao desarquivar",!0)}
// Roteador dos cliques da aba Vendas, no mesmo padrao do cliAcao.
function vendaAcao(o,id,el){
if("venda-editar"===o){
var v=(vendasData||[]).filter(function(x){return String(x.id)===String(id)})[0];
if(v)abrirPainelVenda(null,v);
return!0}
if("venda-entrega"===o){abrirPainelEntrega(id);return!0}if("venda-desarquivar"===o){desarquivarVenda(id);return!0}
// Os dois so repintam: nao ha nada de novo no servidor para buscar, e ate a v51
// este alternar refazia as 3 leituras e apagava a lista a cada toque.
if("venda-arq-alternar"===o){vendasArqAberto=!vendasArqAberto;pintarVendas();return!0}
if("vg-janela"===o){vgJanela=id||"trimestre";vgTipEsconder();pintarVendas();return!0}
// O dashboard entra por AQUI, e nao no despachante A(), porque o A() vive na
// linha 1 minificada e esta obra nao a toca. vendaAcao ja e chamado antes das
// acoes de venda e devolve true quando trata, entao e o gancho barato.
// Trocar a janela do dashboard NAO relê a rede: o dado ja esta em memoria, e
// refazer as leituras a cada toque e o defeito que o v51 tirou do resto do app.
if("dv-janela"===o){
dvJanela=id||"trimestre";
var dvSec=E("lista")?E("lista").querySelector(".dash"):null;
if(dvSec&&dvSec.parentNode){
var novo=document.createElement("div");
novo.innerHTML=dvPainel();
dvSec.parentNode.replaceChild(novo.firstChild,dvSec)}
return!0}
if("dv-ver-vendas"===o){if(E("abaVendas"))E("abaVendas").click();return!0}
// Toque na coluna do mes: o celular nao tem hover, e sem este caminho a
// composicao daquele mes ficaria represada atras de um gesto que nao existe.
// Tocar de novo na mesma coluna fecha.
if("vg-mes"===o){
if(VG_TIP_ABERTO===id){VG_TIP_ABERTO="";vgTipEsconder()}
else{VG_TIP_ABERTO=id;vgTipMostrar(id,el)}
return!0}
return!1}
var VG_TIP_ABERTO="";

// ---- Aba Clientes: cliente = lead que comprou --------------------------------
// A identidade (CPF, RG, endereco) mora no LEAD, nunca na venda: a pessoa e uma
// so e as vendas sao varias. venda.comprador_* continua existindo, mas como
// FOTOGRAFIA do dia da venda; o cadastro de record e o do cliente.
// Desde 27/07/2026 venda.lead_id e NOT NULL e registrar_venda promove o lead a
// perfil comprou no mesmo ato, entao esta aba e a lista inteira de quem comprou.
// Antes disso o LEAD-0018 tinha DUAS vendas no nome e perfil de consulta: nao
// aparecia aqui.
// O que a tela NAO pode fazer: somar vendas_total (lastro, linha a linha na
// tabela venda) com valor_total (agregado herdado do CRM antigo, sem lastro).
// Mesma regra do Dashboard: numeros de confianca diferente nunca viram um
// terceiro numero que ninguem audita. Por isso aparecem em chips separados.
var clientesData=[],cliSeg="todos",CLI_EDIT=null;
function cliDig(x){return String(x||"").replace(/\D/g,"")}
function cliFmtCpf(x){var d=cliDig(x);return 11===d.length?d.slice(0,3)+"."+d.slice(3,6)+"."+d.slice(6,9)+"-"+d.slice(9):String(x||"")}
function cliFmtCep(x){var d=cliDig(x);return 8===d.length?d.slice(0,5)+"-"+d.slice(5):String(x||"")}
// Uma linha so, na ordem em que se escreve num envelope. Parte ausente some.
function cliEndereco(x){
if(!x)return"";
var p=[];
if(x.endereco)p.push(x.endereco+(x.complemento?" "+x.complemento:""));
if(x.bairro)p.push(x.bairro);
if(x.cidade)p.push(x.cidade+(x.uf?"/"+x.uf:""));
else if(x.uf)p.push(x.uf);
if(x.cep)p.push("CEP "+cliFmtCep(x.cep));
return p.join(" · ")}
// As TRES linhas aparecem sempre, mesmo vazias: a aba Clientes tem que CONTER
// CPF, RG e endereco para que se veja o que falta sem abrir nada. Linha vazia
// vira um "adicionar" que abre o painel ja naquele cliente, entao o campo em
// branco e o proprio caminho de preenchimento, nao so uma acusacao.
// Falta de dado e trabalho pendente (morno), nunca falha de sistema (--erro):
// mesmo criterio do "SEM NOTA FISCAL".
function cliDocLinha(rot,val,id){
return '<div class="cli-doc"><span class="cli-doc-rot">'+rot+"</span>"+
(val?'<span class="cli-doc-val">'+c(val)+"</span>"
:'<button class="cli-doc-add" data-acao="cli-dados" data-id="'+c(id)+'">adicionar</button>')+"</div>"}
function cliIdent(x){
var en=cliEndereco(x),falta=[];
// o RG nao entra na cobranca: quem trava a nota fiscal e o CPF e o endereco
if(!x.cpf)falta.push("CPF");
if(!en)falta.push("endereço");
return '<div class="cli-ident">'+
cliDocLinha("CPF",x.cpf?cliFmtCpf(x.cpf):"",x.id)+
cliDocLinha("RG",x.rg||"",x.id)+
cliDocLinha("endereço",en,x.id)+
(falta.length?'<div class="cli-falta">Falta '+c(falta.join(" e "))+" para emitir nota fiscal</div>":"")+
"</div>"}
// Cliente nao deixa de ser lead: perfil, status e quem indicou continuam valendo
// depois da compra (e o que diz se cabe recompra, indicacao, pos-venda).
function cliChips(x){
var p=[];
if(x.perfil)p.push('<span class="chip">'+c(s("perfil",x.perfil))+"</span>");
if(x.status)p.push('<span class="chip st-'+c(x.status)+'">'+c(s("status",x.status))+"</span>");
if("indicacao"===x.origem&&x.indicado_por)p.push('<span class="chip ind">Ind. por '+c(x.indicado_por)+"</span>");
return p.length?'<div class="chips">'+p.join("")+"</div>":""}
// Gaveta Detalhes: o resto do que a pessoa ja tinha como lead. Aprovada pelo
// dono em 21/07/2026 (commit e6d797b) e perdida num rebase; volta aqui igual,
// com Situacao vinda do v_cliente. So mostra linha que tem dado.
function detCli(x){
var r=[];
function row(k,v){r.push('<div class="cli-det-row"><span class="cli-det-k">'+k+'</span><span class="cli-det-v">'+v+"</span></div>")}
function dt(v){var d=String(v).split("-");return 3===d.length?d[2]+"/"+d[1]+"/"+d[0]:c(v)}
if(x.aparelho_entrada)row("Troca",c(x.aparelho_entrada)+(x.upgrade_entrada?" (upgrade)":""));
if(x.valor_oferta>0)row("Avaliação",brlV(x.valor_oferta));
if(x.origem)row("Origem",c(s("origem",x.origem)));
if(x.situacao)row("Situação",c(x.situacao));
if(x.produto)row("Interesse",c(x.produto)+(x.condicao?" · "+c(s("condicao",x.condicao)):""));
if(x.data_contato)row("Primeiro contato",dt(x.data_contato));
if(x.ultima_resposta)row("Última resposta",dt(x.ultima_resposta));
return r.length?'<button class="btn-clidet" data-acao="cli-detalhe" data-id="'+c(x.id||"")+'" aria-expanded="false">Detalhes</button><div class="cli-det" data-clidet>'+r.join("")+"</div>":""}
function alternarDetalhe(card){
var d=card&&card.querySelector?card.querySelector("[data-clidet]"):null;
if(!d)return;
var ab=d.className.indexOf("aberto")>=0;
d.className="cli-det"+(ab?"":" aberto");
var b=card.querySelector(".btn-clidet");
if(b){b.setAttribute("aria-expanded",ab?"false":"true");b.textContent=ab?"Detalhes":"Ocultar"}}
function cliFaixa(x){
var p=[],nv=Number(x.vendas_qtd||0);
p.push('<span class="cli-seg'+(nv?"":" pede")+'">'+(nv?nv+(nv>1?" vendas":" venda")+" · "+brlV(x.vendas_total):"sem venda registrada")+"</span>");
// O agregado do CRM antigo aparece rotulado e separado, nunca somado ao lastro.
if(Number(x.qtd_compras||0)>0||Number(x.valor_total||0)>0)
p.push('<span class="cli-seg herdado">CRM antigo: '+c(String(x.qtd_compras||0))+" · "+brlV(x.valor_total)+"</span>");
if(x.data_nascimento){var dn=String(x.data_nascimento).split("-");3===dn.length&&p.push('<span class="cli-seg">aniv. '+c(dn[2])+"/"+c(dn[1])+"</span>")}
return '<div class="card-cliente">'+p.join("")+"</div>"}
// A ligacao venda <-> cliente aparece dos DOIS lados: aqui, a lista de vendas
// daquela pessoa; no card da venda, o codigo do cliente e o botao de ida.
function cliVendas(id){
var meus=(vendasData||[]).filter(function(v){return String(v.lead_id)===String(id)});
if(!meus.length)return"";
meus=meus.slice().sort(function(a,b){return String(b.data_venda||"")<String(a.data_venda||"")?-1:1});
return '<div class="cli-vendas">'+meus.map(function(v){
return '<div class="cli-venda-lin"><span class="cli-venda-code">'+c(v.venda_code||"")+'</span><span class="cli-venda-mod">'+c(v.modelo_rotulo||"")+(v.capacidade?" "+c(v.capacidade):"")+'</span><span class="cli-venda-val">'+brlV(v.valor_venda)+"</span>"+(v.data_venda?'<span class="cli-venda-dt">'+c(fmtDia(v.data_venda))+"</span>":"")+"</div>"}).join("")+"</div>"}
// Dois botoes no topo, e eles editam coisas diferentes: "Editar" e o cadastro de
// LEAD (nome, telefone, produto, perfil), "Dados" e a identidade do CLIENTE
// (CPF, RG, endereco). Juntar os dois num painel so misturaria o funil com a
// nota fiscal.
function cardCliente(x){
var id=c(x.id),tel=f(x.whatsapp_digitos);
var wa=x.whatsapp_digitos?'<a class="btn-wa" target="_blank" rel="noopener" href="https://wa.me/'+c(cliDig(x.whatsapp_digitos))+'">Abrir conversa</a>':'<div class="sem-tel">Sem telefone na base</div>';
return '<article class="card cliente" data-lead="'+c(x.lead_code||"")+'">'+
'<div class="card-topo"><div class="card-nome">'+c(x.nome||"")+'</div><div class="card-topo-dir"><div class="card-code">'+c(x.lead_code||"")+'</div><div class="card-topo-btns"><button class="btn-editar" data-acao="editar" data-id="'+id+'">Editar</button><button class="btn-editar" data-acao="cli-dados" data-id="'+id+'">Dados</button></div></div></div>'+
(x.produto?'<div class="card-prod">'+c(x.produto)+"</div>":"")+
(tel?'<div class="card-tel">'+c(tel)+"</div>":"")+
cliFaixa(x)+cliIdent(x)+cliChips(x)+
(x.observacoes?'<div class="obs">'+c(x.observacoes)+"</div>":"")+
cliVendas(x.id)+detCli(x)+
'<div class="card-acoes">'+wa+'<button class="btn-acao" data-acao="cli-venda" data-id="'+id+'">Registrar venda</button><button class="btn-acao" data-acao="historico" data-id="'+id+'">Histórico</button></div>'+
'<div class="hist" data-hist></div></article>'}
function cliDoSeg(lista,seg){
if("semvenda"===seg)return (lista||[]).filter(function(x){return!Number(x.vendas_qtd)});
if("semdados"===seg)return (lista||[]).filter(function(x){return!x.tem_cpf||!x.tem_endereco});
return (lista||[]).slice()}
// Busca tambem por codigo e por CPF: e assim que se acha alguem com o documento
// na mao (cliente ligando, NF pra emitir).
function filtCliBusca(lista,termo){
var q=String(termo||"").trim().toLowerCase();
if(!q)return lista;
var d=q.replace(/\D/g,"");
return lista.filter(function(x){
return String(x.nome||"").toLowerCase().indexOf(q)>=0||
String(x.lead_code||"").toLowerCase().indexOf(q)>=0||
String(x.vendas_aparelhos||"").toLowerCase().indexOf(q)>=0||
(!!d&&(String(x.whatsapp_digitos||"").indexOf(d)>=0||String(x.cpf||"").indexOf(d)>=0))})}
async function carregarClientes(){
var r=await ler(t.from("v_cliente").select("*").order("nome",{ascending:!0}),"os clientes");
if(r.ok)clientesData=r.dados;return r}
async function renderClientes(e,sil){
if(!sil)e.innerHTML='<div class="estado carregando">Lendo clientes…</div>';
var rc=await carregarClientes(),rv=await carregarVendas();
var falha=primeiraFalha(rc,rv);
if(falha){if(!1!==falha.sessao)e.innerHTML=estadoErro("os clientes",falha.erro);return}
var semv=cliDoSeg(clientesData,"semvenda"),semd=cliDoSeg(clientesData,"semdados");
var topo='<div class="nf-topo"><div class="nf-segs">'+
'<button class="nf-seg'+("todos"===cliSeg?" on":"")+'" data-acao="cli-seg" data-seg="todos">Clientes <span>'+clientesData.length+"</span></button>"+
'<button class="nf-seg'+("semvenda"===cliSeg?" on":"")+'" data-acao="cli-seg" data-seg="semvenda">Falta venda <span>'+semv.length+"</span></button>"+
'<button class="nf-seg'+("semdados"===cliSeg?" on":"")+'" data-acao="cli-seg" data-seg="semdados">Falta cadastro <span>'+semd.length+"</span></button>"+
"</div></div>";
var lista=filtCliBusca(cliDoSeg(clientesData,cliSeg),E("inputBusca")?E("inputBusca").value:"");
var vazio="semvenda"===cliSeg?'<div class="estado"><strong>Nenhum cliente sem venda.</strong><br>Todo cliente tem pelo menos uma venda com lastro linha a linha.</div>':
"semdados"===cliSeg?'<div class="estado"><strong>Cadastro completo.</strong><br>Todo cliente tem CPF e endereço para a nota fiscal.</div>':
'<div class="estado"><strong>Nenhum cliente ainda.</strong><br>Registre uma venda na aba Vendas: o comprador vira cliente no mesmo ato.</div>';
e.innerHTML=topo+(lista.length?lista.map(cardCliente).join(""):vazio)}
// ---- Painel Dados do cliente -------------------------------------------------
// Vive fora de #lista, entao nao pega o delegado A: os botoes sao ligados por id
// no init, igual ao painel de NF.
function cliDoBanco(id){
var x=(clientesData||[]).filter(function(y){return String(y.id)===String(id)})[0];
if(x)return x;
return (i||[]).filter(function(y){return String(y.id)===String(id)})[0]||null}
function abrirPainelCliente(id){
var x=cliDoBanco(id);
if(!x)return void I("Cliente não encontrado na base carregada",!0);
CLI_EDIT=x.id;
if(E("pcTitulo"))E("pcTitulo").textContent="Dados de "+(x.nome||"cliente");
var campos={pcCpf:x.cpf?cliFmtCpf(x.cpf):"",pcRg:x.rg||"",pcCep:x.cep?cliFmtCep(x.cep):"",
pcEndereco:x.endereco||"",pcComplemento:x.complemento||"",pcBairro:x.bairro||"",
pcCidade:x.cidade||"",pcUf:x.uf||""};
for(var k2 in campos)if(E(k2))E(k2).value=campos[k2];
if(E("pcErro"))E("pcErro").textContent="";
if(E("painelCliente"))E("painelCliente").className="painel-cadastro"}
function fecharPainelCliente(){CLI_EDIT=null;if(E("painelCliente"))E("painelCliente").className="painel-cadastro oculto"}
async function salvarCliente(){
if(!CLI_EDIT)return;
var btn=E("btnSalvarCliente"),err=E("pcErro"),v=function(id){return E(id)?E(id).value:""};
var payload={cpf:v("pcCpf"),rg:v("pcRg"),cep:v("pcCep"),endereco:v("pcEndereco"),
complemento:v("pcComplemento"),bairro:v("pcBairro"),cidade:v("pcCidade"),uf:v("pcUf")};
if(err)err.textContent="";
if(btn)btn.disabled=!0;
var r=await t.rpc("salvar_identidade",{p_lead_id:CLI_EDIT,payload:payload});
if(btn)btn.disabled=!1;
if(r&&r.error){if(err)err.textContent="Falha: "+r.error.message;return}
var d=r&&r.data;
if(!d||!1===d.ok){if(err)err.textContent=(d&&d.msg)||"Dados recusados";return}
I(d.msg||"Dados do cliente salvos");
fecharPainelCliente();
// B() releitura v_lead (que agora carrega a identidade) e repinta a aba atual.
B()}
// Caminho de volta: do card da venda pro cadastro do cliente, pela busca no
// codigo do lead, que e a chave estavel (invariante 5).
function cliVerCliente(el){
var cod=el&&el.getAttribute?el.getAttribute("data-code"):"";
cliSeg="todos";
if(E("inputBusca"))E("inputBusca").value=cod||"";
G("clientes")}
// "Fechou" na Fila deixou de ser so troca de status. Quem fecha REGISTRA A
// VENDA, e o registro da venda e que promove o lead a cliente: era por aqui que
// vazava (status convertido sem venda nenhuma, funil e caixa nunca batendo).
function fecharComVenda(id){
var L=(i||[]).filter(function(x){return String(x.id)===String(id)})[0];
I(L&&L.nome?"Registre a venda de "+L.nome+" para fechar":"Registre a venda para fechar");
abrirPainelVenda(id)}
// Roteador dos cliques da aba Clientes, chamado pelo delegado A antes do resto.
function cliAcao(o,id,el){
if("cli-seg"===o){cliSeg=el.getAttribute("data-seg")||"todos";renderClientes(E("lista"));return!0}
if("cli-detalhe"===o){alternarDetalhe(el.closest?el.closest(".card"):null);return!0}
if("cli-dados"===o){abrirPainelCliente(id);return!0}
if("cli-venda"===o){abrirPainelVenda(id);return!0}
if("cli-ver"===o){cliVerCliente(el);return!0}
return!1}

// ---- NF (nota fiscal) da venda ----------------------------------------------
// O ARQUIVO vive no bucket privado 'nf' do Storage; aqui so trafega o caminho.
// Nunca ha URL publica: a NF tem CPF, nome e valor. Abrir = pedir uma signed URL
// de 60s na hora do clique. O caminho e obrigatoriamente {tenant}/{venda}/{id}.{ext}
// e a policy do Storage recusa gravacao fora da pasta do tenant, entao um caminho
// forjado no cliente nao passa.
var nfsData=[],NF_TENANT=null,NF_VENDA=null,nfSeg="com";
var NF_MIME={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",heic:"image/heic",heif:"image/heif",webp:"image/webp",xml:"application/xml"};
async function nfTenant(){
if(NF_TENANT)return NF_TENANT;
var r=await t.from("app_usuario").select("tenant_id").limit(1);
NF_TENANT=r&&r.data&&r.data[0]?r.data[0].tenant_id:null;
return NF_TENANT}
function nfExt(nome){var p=String(nome||"").split(".");return p.length>1?(p.pop().toLowerCase().replace(/[^a-z0-9]/g,"")||"bin"):"bin"}
function nfTam(b){var n=Number(b||0);return n>=1048576?(n/1048576).toFixed(1)+" MB":Math.max(1,Math.round(n/1024))+" KB"}
function nfQuando(iso){var d=iso?new Date(iso):null;return d&&!isNaN(d)?d.toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"}):""}
function nfNovoId(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2)}
// Sobe primeiro, registra depois: o ponteiro so existe se o arquivo existir.
// Se a RPC recusar, o objeto fica orfao no bucket privado (invisivel na tela) e
// o operador ve o erro; o contrario deixaria linha apontando para o nada.
async function subirNf(file,vendaId,numero){
var tn=await nfTenant();
if(!tn)return{ok:!1,erro:"Sessão sem tenant: saia e entre de novo."};
var ext=nfExt(file.name),mime=file.type||NF_MIME[ext]||"application/octet-stream";
var caminho=tn+"/"+vendaId+"/"+nfNovoId()+"."+ext;
var up=await t.storage.from("nf").upload(caminho,file,{contentType:mime,upsert:!1});
if(up&&up.error)return{ok:!1,erro:up.error.message||"Falha ao subir o arquivo"};
var r=await t.rpc("anexar_nf",{payload:{venda_id:vendaId,arquivo:caminho,numero:numero||"",nome_original:file.name,mime:mime,tamanho:String(file.size)}});
var d=r&&r.data;
return d&&d.ok?{ok:!0}:{ok:!1,erro:(d&&d.erro)||(r&&r.error&&r.error.message)||"Falha ao registrar a NF"}}
async function carregarNfs(){
var r=await ler(t.from("v_venda_nf").select("*").order("enviado_em",{ascending:!1}),"as notas fiscais");
if(r.ok)nfsData=r.dados;return r}
function nfsDaVenda(id){return nfsData.filter(function(x){return String(x.venda_id)===String(id)})}
// Venda sem nota e trabalho pendente, nao detalhe: por isso toda venda declara o
// estado da NF no proprio card, e nao so as que tem.
function nfLinhaVenda(v){
var l=nfsDaVenda(v.id);
var rot=l.length?'<span class="nf-tem">'+l.length+" nota"+(1===l.length?"":"s")+(v.nf_numero?" · nº "+c(v.nf_numero):"")+"</span>":'<span class="nf-falta">sem nota fiscal</span>';
return'<div class="nf-linha">'+rot+'<button class="btn-acao'+(l.length?"":" nf-pede")+'" data-acao="nf-anexar" data-id="'+c(v.id)+'">'+(l.length?"Ver NF":"Anexar NF")+"</button></div>"}
function nfItem(x,curto){
return'<div class="nf-item"><div class="nf-item-txt"><strong>'+c(x.nome_original||"arquivo")+"</strong><span>"+
(x.numero?"nº "+c(x.numero)+" · ":"")+(curto?"":c(x.venda_code||"")+" · ")+nfTam(x.tamanho)+" · "+nfQuando(x.enviado_em)+"</span></div>"+
'<div class="nf-item-acoes"><button class="btn-acao" data-acao="nf-abrir" data-id="'+c(x.id)+'">Abrir</button>'+
'<button class="btn-acao" data-acao="nf-remover" data-id="'+c(x.id)+'">Remover</button></div></div>'}
// A janela do pop-up abre no clique (sincrona) e so depois recebe a URL: aberta
// depois do await, o navegador bloqueia.
async function abrirArquivoNf(id){
var x=nfsData.filter(function(y){return String(y.id)===String(id)})[0];
if(!x)return void I("NF não encontrada",!0);
var w=window.open("about:blank","_blank");
var r=await t.storage.from("nf").createSignedUrl(x.arquivo,60);
var u=r&&r.data&&r.data.signedUrl;
if(!u){if(w)w.close();return void I((r&&r.error&&r.error.message)||"Não foi possível abrir a NF",!0)}
if(w)w.location.href=u;else I("Libere o pop-up para abrir a NF",!0)}
// Remover e marca, nao apagamento: a linha some da tela, a auditoria guarda
// antes e depois, e o arquivo continua no bucket privado.
async function removerNf(id){
if(!window.confirm("Remover esta NF da venda? O arquivo sai da tela; o registro fica na auditoria."))return;
var r=await t.rpc("remover_nf",{p_id:id}),d=r&&r.data;
if(d&&d.ok){I("NF removida");await carregarNfs();if("nfs"===n)renderNfs(E("lista"));else if("vendas"===n)renderVendas(E("lista"));if(NF_VENDA)pintarPainelNf()}
else I((d&&d.erro)||(r&&r.error&&r.error.message)||"Falha ao remover",!0)}
async function abrirPainelNf(vendaId){
NF_VENDA=vendaId;
if(E("nfErro"))E("nfErro").textContent="";
if(E("nfArq"))E("nfArq").value="";
if(E("nfNum"))E("nfNum").value="";
if(E("painelNf"))E("painelNf").className="painel-cadastro";
await carregarNfs();
pintarPainelNf()}
function pintarPainelNf(){
var v=vendasData.filter(function(x){return String(x.id)===String(NF_VENDA)})[0]||{};
if(E("nfAlvo"))E("nfAlvo").innerHTML=c(v.venda_code||"venda")+" · "+c(v.modelo_rotulo||"")+" · "+c(v.cliente_nome||"sem cliente");
if(E("nfNum")&&!E("nfNum").value&&v.nf_numero)E("nfNum").value=v.nf_numero;
var l=nfsDaVenda(NF_VENDA);
if(E("nfLista"))E("nfLista").innerHTML=l.length?l.map(function(x){return nfItem(x,!0)}).join(""):'<div class="nf-vazio">Nenhuma nota anexada nesta venda.</div>'}
function fecharPainelNf(){NF_VENDA=null;if(E("painelNf"))E("painelNf").className="painel-cadastro oculto"}
// O painel vive fora de #lista, entao nao pega o delegado A: tem o seu.
function nfListaClick(ev){
var el=ev.target&&ev.target.closest?ev.target.closest("[data-acao]"):null;
if(!el)return;
var o=el.getAttribute("data-acao"),id=el.getAttribute("data-id");
if("nf-abrir"===o)abrirArquivoNf(id);
else if("nf-remover"===o)removerNf(id)}
async function salvarNfPainel(){
var arq=E("nfArq"),f0=arq&&arq.files&&arq.files[0],err=E("nfErro"),btn=E("btnSalvarNf");
if(!f0){if(err)err.textContent="Escolha o arquivo da NF (PDF ou foto).";return}
if(err)err.textContent="";
if(btn){btn.disabled=!0;btn.textContent="Enviando…"}
var res=await subirNf(f0,NF_VENDA,E("nfNum")?E("nfNum").value:"");
if(btn){btn.disabled=!1;btn.textContent="Anexar NF"}
if(!res.ok){if(err)err.textContent=res.erro;return}
I("NF anexada");
if(arq)arq.value="";
await carregarVendas();await carregarNfs();
pintarPainelNf();
if("nfs"===n)renderNfs(E("lista"));else if("vendas"===n)renderVendas(E("lista"))}
// ---- Aba Notas fiscais ------------------------------------------------------
// Duas faces do mesmo fato: o que ja tem nota e o que AINDA NAO TEM. Listar so
// as notas anexadas esconde exatamente o trabalho que falta.
function nfSemNota(){
return vendasData.filter(function(v){return "cancelada"!==v.status&&!nfsDaVenda(v.id).length})}
function filtNfBusca(lista,termo){
var q=String(termo||"").trim().toLowerCase();
if(!q)return lista;
return lista.filter(function(x){return [x.venda_code,x.numero,x.cliente_nome,x.modelo_rotulo,x.nome_original].join(" ").toLowerCase().indexOf(q)>=0})}
function cardNf(x){
return'<div class="card"><div class="card-top"><span class="card-code">'+c(x.venda_code||"")+'</span><span class="card-prod">'+c(x.modelo_rotulo||"")+(x.capacidade?" "+c(x.capacidade):"")+"</span></div>"+
'<div class="card-sub">'+c(x.cliente_nome||"sem cliente")+(x.numero?" · NF nº "+c(x.numero):" · sem número")+(x.data_venda?" · "+c(x.data_venda):"")+"</div>"+
nfItem(x)+"</div>"}
async function renderNfs(e,sil){
if(!sil)e.innerHTML='<div class="estado carregando">Lendo notas fiscais…</div>';
var rv=await carregarVendas(),rn=await carregarNfs();
var falha=primeiraFalha(rv,rn);
if(falha){if(!1!==falha.sessao)e.innerHTML=estadoErro("as notas fiscais",falha.erro);return}
var falta=nfSemNota(),termo=E("inputBusca")?E("inputBusca").value:"";
var topo='<div class="venda-topo"><div class="nf-segs" role="tablist">'+
'<button class="nf-seg'+("com"===nfSeg?" on":"")+'" data-acao="nf-seg" data-seg="com">Com nota <span>'+nfsData.length+"</span></button>"+
'<button class="nf-seg'+("falta"===nfSeg?" on":"")+'" data-acao="nf-seg" data-seg="falta">Falta nota <span>'+falta.length+"</span></button>"+
"</div></div>";
var corpo;
if("falta"===nfSeg){
var lf=filtVendaBusca(falta,termo);
corpo=lf.length?lf.map(cardVenda).join(""):'<div class="estado"><strong>Nenhuma venda sem nota.</strong><br>Toda venda ativa tem pelo menos uma NF anexada.</div>'}
else{
var lc=filtNfBusca(nfsData,termo);
corpo=lc.length?lc.map(cardNf).join(""):'<div class="estado"><strong>Nenhuma NF anexada ainda.</strong><br>Na aba Vendas, toque em <strong>Anexar NF</strong> no card da venda.</div>'}
e.innerHTML=topo+corpo}
function G(x){M();R();fecharPainelVenda();fecharPainelEntrega();fecharPainelNf();fecharPainelCliente();if(window.scrollTo)window.scrollTo(0,0);n=x;k(),("fila"===x||"todos"===x||"indicacoes"===x)&&B(!0)}var CONT_DRAG=null,CONT_DRAG_COL=null;async function moverConteudo(id,para){var card=E("lista").querySelector('.cont-card[data-id="'+id+'"]'),col=E("lista").querySelector('.cont-col[data-col="'+para+'"]');if(card&&col){card.classList.add("movendo");var vz=col.querySelector(".cont-col-vazio");if(vz)vz.parentNode.removeChild(vz);col.appendChild(card)}var r=await t.functions.invoke("mover-conteudo",{body:{id:id,para:para}});if(r.error){I("Falha ao mover: "+(r.error.message||"erro de rede"),!0);if("conteudo"===n)renderConteudo(!0);return}var d=r.data;if(d&&!1!==d.ok){if(d.aviso)I(d.aviso);if("conteudo"===n)renderConteudo(!0)}else{I(d&&d.msg||"Nao consegui mover",!0);if("conteudo"===n)renderConteudo(!0)}}function contLimparAlvo(){[].forEach.call(E("lista").querySelectorAll(".cont-col.alvo"),function(c){c.classList.remove("alvo")})}function contDragStart(e){var card=e.target&&e.target.closest?e.target.closest(".cont-card[draggable]"):null;if(!card)return;CONT_DRAG=card.getAttribute("data-id");CONT_DRAG_COL=card.getAttribute("data-col");card.classList.add("arrastando");if(e.dataTransfer){e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain",CONT_DRAG)}catch(x){}}}function contDragOver(e){if(!CONT_DRAG)return;var col=e.target&&e.target.closest?e.target.closest(".cont-col"):null;if(!col)return;e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect="move";if(!col.classList.contains("alvo")){contLimparAlvo();col.classList.add("alvo")}}function contDrop(e){if(!CONT_DRAG)return;var col=e.target&&e.target.closest?e.target.closest(".cont-col"):null;if(!col)return;e.preventDefault();var id=CONT_DRAG,para=col.getAttribute("data-col"),origem=CONT_DRAG_COL;CONT_DRAG=null;CONT_DRAG_COL=null;contLimparAlvo();if(para&&para!==origem)moverConteudo(id,para)}function contDragEnd(){CONT_DRAG=null;CONT_DRAG_COL=null;contLimparAlvo();[].forEach.call(E("lista").querySelectorAll(".cont-card.arrastando"),function(c){c.classList.remove("arrastando")})}var scriptsData={};async function sugerirMensagem(id,btn,card){var cont=card.querySelector("[data-scripts]");if(!cont)return;if(cont.className.indexOf("aberto")>=0){cont.className="scripts";cont.innerHTML="";return}cont.className="scripts aberto";cont.innerHTML='<div class="script-meta">Buscando script...</div>';if(btn)btn.disabled=!0;var res=await t.rpc("sugerir_mensagem",{p_lead_id:id});if(btn)btn.disabled=!1;if(res.error){cont.innerHTML='<div class="script-meta">Falha: '+c(res.error.message)+"</div>";return}var d=res.data;if(!d||!1===d.ok){cont.innerHTML='<div class="script-meta">'+c(d&&d.msg||"Sem script disponivel")+"</div>";return}var ops=d.opcoes||[];if(!ops.length){cont.innerHTML='<div class="script-meta">Sem opcoes para este passo.</div>';return}var lead=null,j;for(j=0;j<i.length;j++)if(i[j].id===id){lead=i[j];break}scriptsData[id]={whatsapp:d.whatsapp,consent:!(!lead||!0!==lead.consentimento),opcoes:ops};var chips=ops.map(function(o,idx){return'<button class="var-chip" data-acao="variante" data-id="'+c(id)+'" data-idx="'+idx+'" aria-selected="'+(0===idx?"true":"false")+'">'+c(o.rotulo_variante||"Opcao "+(idx+1))+"</button>"}).join("");var rot=d.passo_rotulo?'<div class="script-meta">'+c(d.passo_rotulo)+"</div>":"";cont.innerHTML=rot+'<div class="scripts-vars">'+chips+'</div><div class="script-texto" data-preview></div><div class="script-acoes" data-scriptacoes></div>';pintarVariante(id,card,0)}function pintarVariante(id,card,idx){var data=scriptsData[id];if(!data)return;var op=data.opcoes[idx];if(!op)return;var cont=card.querySelector("[data-scripts]");if(!cont)return;var chips=cont.querySelectorAll(".var-chip"),j;for(j=0;j<chips.length;j++)chips[j].setAttribute("aria-selected",chips[j].getAttribute("data-idx")===String(idx)?"true":"false");var prev=cont.querySelector("[data-preview]");if(prev)prev.textContent=op.texto||"";var acoes=cont.querySelector("[data-scriptacoes]");if(!acoes)return;var dig=String(data.whatsapp||"").replace(/\D/g,"");var wa=dig&&data.consent?'<a class="btn-wa" target="_blank" rel="noopener" href="https://wa.me/'+c(dig)+"?text="+encodeURIComponent(op.texto||"")+'">Enviar no WhatsApp</a>':dig?'<div class="sem-tel">Sem consentimento</div>':'<div class="sem-tel">Sem telefone</div>';acoes.innerHTML=wa+'<button class="btn-copiar" data-acao="copiar-script" data-id="'+c(id)+'">Copiar</button>'}function copiarScript(id,btn){var card=btn&&btn.closest?btn.closest(".card"):null;if(!card)return;var cont=card.querySelector("[data-scripts]");if(!cont)return;var prev=cont.querySelector("[data-preview]"),txt=prev?prev.textContent:"";if(!txt){I("Nada para copiar",!0);return}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(function(){I("Script copiado")},function(){copiarFallback(txt)});else copiarFallback(txt)}function copiarFallback(txt,rot){try{var ta=document.createElement("textarea");ta.value=txt;ta.setAttribute("readonly","");ta.style.position="absolute";ta.style.left="-9999px";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);I(rot||"Script copiado")}catch(e){I("Nao consegui copiar",!0)}}function A(a){var e=a.target&&a.target.closest?a.target.closest("[data-acao]"):null;if(e){var o=e.getAttribute("data-acao"),t=e.getAttribute("data-id"),n=e.closest(".card");if("cap-registrar"===o)return void registrarCaptacao(e);if("cap-mais"===o)return void alternarCapDet(e);if("cap-parar"===o)return void pararCaptacao(t,e);if("dia-marcar"===o)return void qF("marcar_tarefa",{p_tarefa_id:t,p_concluida:"true"!==e.getAttribute("aria-checked")},e,function(){viraCheck(e),hojePlacarAtualiza()});if("dia-remover"===o)return void(window.confirm("Remover esta tarefa do dia? Ela não volta ao puxar o molde de novo.")&&qF("remover_tarefa",{p_tarefa_id:t},e,function(){tiraLinha(e),hojePlacarAtualiza()}));if("dia-add"===o){var dv=E("diaNovoTit"),dc=E("diaNovaCat");return dv&&String(dv.value).trim()?void qF("adicionar_tarefa",{p_titulo:dv.value,p_categoria:dc?dc.value:""},e,hojeQuieto):void I("Digite o título da tarefa",!0)}if("dia-nota-ok"===o){var dn=E("diaNota");return void qF("salvar_nota",{p_texto:dn?dn.value:""},e,null)}if("dia-puxar"===o)return void qF("puxar_rotina",{},e,hojeQuieto);if("lemb-marcar"===o)return void qF("marcar_lembrete",{p_lembrete_id:t,p_feito:"true"!==e.getAttribute("aria-checked")},e,function(){viraCheck(e),hojePlacarAtualiza()});if("lemb-remover"===o)return void(window.confirm("Remover este lembrete?")&&qF("remover_lembrete",{p_lembrete_id:t},e,function(){tiraLinha(e),hojePlacarAtualiza()}));if("lemb-add"===o){var lv=E("lembNovo"),ld=E("lembData");return lv&&String(lv.value).trim()?void qF("salvar_lembrete",{p_texto:lv.value,p_data:ld&&ld.value?ld.value:null},e,hojeQuieto):void I("Digite o lembrete",!0)}if("lemb-hoje"===o){if(E("lembData"))E("lembData").value=l();return}if("lemb-amanha"===o){if(E("lembData"))E("lembData").value=C(l(),1);return}if("hoje-verfila"===o){if(E("abaFila"))E("abaFila").click();return}if("hoje-sugerir"===o)return void sugerirMensagem(t,e,e.closest(".fila-lin"));if("cont-mover"===o){var mw=e.parentNode,mab="true"===e.getAttribute("aria-expanded");mw.className="cont-mover-wrap"+(mab?"":" aberto");e.setAttribute("aria-expanded",mab?"false":"true");return}if("cont-mover-para"===o)return void moverConteudo(t,e.getAttribute("data-col"));if("cont-aferir"===o){var mb=e.closest(".cont-met");if(mb){var maf=mb.className.indexOf("aberto")>=0;mb.className="cont-met"+(maf?"":" aberto");if(!maf){var mi=mb.querySelector('input[data-af="alcance"]');if(mi)mi.focus()}}return}if("cont-aferir-cancel"===o){var mcx=e.closest(".cont-met");if(mcx)mcx.className="cont-met";return}if("cont-aferir-ok"===o)return void salvarAfericao(t,e);if("cont-publiquei"===o)return void marcarPublicado(t,e);if("met-janela"===o){METRICA_DIAS=parseInt(e.getAttribute("data-dias"),10)||90;renderDash();return}if("cont-descartado"===o){var cd=e.parentNode,ab="true"===e.getAttribute("aria-expanded");cd.className="cont-desc"+(ab?"":" aberto");e.setAttribute("aria-expanded",ab?"false":"true");return}if("respondeu"===o)return void q("registrar_resposta",{p_lead_id:t},e,"Resposta registrada",{lead:t,card:n});if(cliAcao(o,t,e))return;if(vendaAcao(o,t,e))return;if("nova-venda"===o)return void abrirPainelVenda();if("nf-anexar"===o)return void abrirPainelNf(t);if("nf-abrir"===o)return void abrirArquivoNf(t);if("nf-remover"===o)return void removerNf(t);if("nf-seg"===o){nfSeg=e.getAttribute("data-seg")||"com";return void renderNfs(E("lista"),!0)}if("sync-agora"===o)return void sincronizarAgora(e);if("esc-criar"===o){var fcod=e.getAttribute("data-frente"),cx=E("escNovo_"+fcod);if(!cx||!cx.value.trim())return void I("Escreva a ação primeiro.",!0);return void q("criar_acao_escopo",{p_frente:fcod,p_titulo:cx.value},e)}if("esc-status"===o){var st=e.getAttribute("data-st"),prox="a_fazer"===st?"fazendo":"fazendo"===st?"feito":"feito"===st?"a_fazer":"a_fazer";return void q("mudar_status_acao_escopo",{p_id:e.getAttribute("data-id"),p_status:prox,p_motivo:null},e)}if("esc-travar"===o){var sa=e.getAttribute("data-st"),mt=null;if("travado"===sa)return void q("mudar_status_acao_escopo",{p_id:e.getAttribute("data-id"),p_status:"fazendo",p_motivo:null},e);if(!(mt=prompt("O que está travando?")))return;return void q("mudar_status_acao_escopo",{p_id:e.getAttribute("data-id"),p_status:"travado",p_motivo:mt},e)}if("esc-desc"===o)return void q("descartar_acao_escopo",{p_id:e.getAttribute("data-id")},e);if("rot-dia"===o)return void e.setAttribute("aria-pressed","true"===e.getAttribute("aria-pressed")?"false":"true");if("rot-add-tarefa"===o){var rv=E("rotNovoTit"),rc=E("rotNovaCat");if(!rv||!String(rv.value).trim())return void I("Digite o título da tarefa",!0);var ds=[].map.call(E("lista").querySelectorAll('[data-acao="rot-dia"][aria-pressed="true"]'),function(x){return parseInt(x.getAttribute("data-dia"),10)});return void qF("salvar_rotina_tarefa",{p_titulo:rv.value,p_categoria:rc?rc.value:"",p_dias_semana:ds.length&&ds.length<7?ds:null},e,renderRotina)}if("rot-rm-tarefa"===o)return void(window.confirm("Remover esta tarefa do molde? O que já virou dia fica como está.")&&qF("remover_rotina_tarefa",{p_id:t},e,renderRotina));if("rot-add-cat"===o){var cv=E("rotNovaCatRot");if(!cv||!String(cv.value).trim())return void I("Digite o nome da categoria",!0);var cod=rotSlug(cv.value);return cod?void qF("salvar_rotina_categoria",{p_codigo:cod,p_rotulo:cv.value.trim()},e,renderRotina):void I("Nome inválido",!0)}if(t&&n){if("sugerir"===o)return void sugerirMensagem(t,e,n);if("historico"===o)return void abrirHistorico(t,e,n);if("nota"===o)return void alternarNota(n);if("nota-ok"===o)return void registrarNota(t,e,n);if("variante"===o)return void pintarVariante(t,n,parseInt(e.getAttribute("data-idx"),10)||0);if("copiar-script"===o)return void copiarScript(t,e)}if(t&&n)if("editar"!==o)if("leque"!==o)if("retomar"!==o)if("toque"!==o)if("conversando"!==o)if("fechou"!==o)if("sem-interesse"!==o){if("retomar-ok"===o){var r=n.querySelector(".retomar input"),c=r?r.value:"";return c?void q("reagendar_proximo_contato",{p_lead_id:t,p_data:c},e,"Reagendado",{lead:t,card:n}):void I("Escolha a data de retomada",!0)}}else q("registrar_desfecho",{p_lead_id:t,p_tipo:"sem_interesse"},e,"Marcado sem interesse",{lead:t,card:n});else fecharComVenda(t);else q("registrar_conversando",{p_lead_id:t},e,"Conversa registrada",{lead:t,card:n});else q("registrar_toque",{p_lead_id:t},e,"Toque registrado",{lead:t,card:n});else{var d=n.querySelector(".retomar");d&&(d.className="retomar"+(d.className.indexOf("aberto")>=0?"":" aberto"))}else{var s=n.querySelector(".desfechos");s&&(s.className="desfechos"+(s.className.indexOf("aberto")>=0?"":" aberto"))}else!function(a){for(var e=null,o=0;o<i.length;o++)if(i[o].id===a){e=i[o];break}if(!e)return void I("Lead nao encontrado na base carregada",!0);H=a,E("edCondicao").innerHTML=T("condicao","Escolha a condicao"),E("edPerfil").innerHTML=T("perfil","Escolha o perfil"),E("edOrigem").innerHTML=T("origem","Escolha a origem"),E("edTitulo").textContent="Editar "+(e.lead_code||"lead"),E("edNome").value=e.nome||"",E("edWhats").value=e.whatsapp_digitos||"",E("edProduto").value=e.produto||"",E("edCondicao").value=e.condicao||"",E("edPerfil").value=e.perfil||"",E("edOrigem").value=e.origem||"",E("edIndicado").value=e.indicado_por||"",E("edNasc").value=e.data_nascimento||"",E("edProx").value=e.proximo_contato||"",E("edValor").value=function(a){if(null==a||""===a)return"";var e=Number(a);return isNaN(e)?"":String(e)}(e.valor_oferta),E("edObs").value=e.observacoes||"",E("edUpgrade").value=!0===e.upgrade_entrada?"sim":!1===e.upgrade_entrada?"nao":"",E("edAparelho").value=e.aparelho_entrada||"",E("edErro").textContent="",J(),M(),E("painelEdicao").className="painel-cadastro",E("painelEdicao").scrollIntoView({behavior:"smooth",block:"start"}),E("edNome").focus()}(t)}}function T(a,e){var t=o[a]||{},i='<option value="">'+c(e)+"</option>";return Object.keys(t).forEach(function(a){i+='<option value="'+c(a)+'">'+c(t[a])+"</option>"}),i}function P(){E("cadCondicao").innerHTML=T("condicao","Escolha a condicao"),E("cadPerfil").innerHTML=T("perfil","Escolha o perfil"),E("cadOrigem").innerHTML=T("origem","Escolha a origem"),["cadNome","cadWhats","cadProduto","cadIndicado","cadObs","cadAparelho"].forEach(function(a){E(a).value=""}),["cadCondicao","cadPerfil","cadOrigem","cadUpgrade"].forEach(function(a){E(a).value=""}),E("cadConsent").value="sim",E("campoIndicado").className="campo oculto",E("cadErro").textContent="",E("cadDup").className="cad-dup",D=null,E("painelCadastro").className="painel-cadastro",E("cadNome").focus()}function M(){E("painelCadastro").className="painel-cadastro oculto"}function y(){var a=E("cadUpgrade").value;return{nome:E("cadNome").value,whatsapp:E("cadWhats").value,produto:E("cadProduto").value,condicao:E("cadCondicao").value,perfil:E("cadPerfil").value,origem:E("cadOrigem").value,indicado_por:E("cadIndicado").value,observacoes:E("cadObs").value,upgrade_entrada:"sim"===a||"nao"!==a&&null,aparelho_entrada:E("cadAparelho").value,consentimento:"nao"!==E("cadConsent").value}}var D=null;async function F(){var a=E("cadErro");a.textContent="",E("cadDup").className="cad-dup",D=null;var e=y(),o=w(e);if(o.ok){var t=E("btnCadastrar"),i=await O("cadastrar_lead",{p_nome:e.nome,p_whatsapp:e.whatsapp,p_produto:e.produto,p_condicao:e.condicao,p_perfil:e.perfil,p_origem:e.origem,p_indicado_por:e.indicado_por||null,p_observacoes:e.observacoes||null,p_upgrade_entrada:e.upgrade_entrada,p_aparelho_entrada:e.aparelho_entrada||null,p_consentimento:e.consentimento},t);if(i)return!1===i.ok&&i.duplicado?(D=i.existente||null,E("cadDupMsg").textContent=i.msg||"Ja existe um lead com esse WhatsApp.",void(E("cadDup").className="cad-dup visivel")):void(!1!==i.ok?(I(i.msg||"Lead cadastrado"),M(),B(!0)):a.textContent=i.msg||"Cadastro recusado")}else a.textContent=o.msg}function W(){M(),n="todos",E("inputBusca").value=D&&D.nome||E("cadWhats").value,k()}function j(){var a="indicacao"===E("cadOrigem").value;E("campoIndicado").className="campo"+(a?"":" oculto")}var H=null;function J(){var a="indicacao"===E("edOrigem").value;E("campoEdIndicado").className="campo"+(a?"":" oculto")}function R(){E("painelEdicao").className="painel-cadastro oculto",H=null}async function z(){var a=E("edErro");if(a.textContent="",H){var e,o,t=(e=E("edUpgrade").value,o=String(E("edValor").value||"").trim(),{nome:E("edNome").value,whatsapp:E("edWhats").value,produto:E("edProduto").value,condicao:E("edCondicao").value,perfil:E("edPerfil").value,origem:E("edOrigem").value,indicado_por:E("edIndicado").value,data_nascimento:E("edNasc").value||null,proximo_contato:E("edProx").value||null,valor_oferta:""===o?null:Number(o),observacoes:E("edObs").value,upgrade_entrada:"sim"===e||"nao"!==e&&null,aparelho_entrada:E("edAparelho").value}),i=S(t);if(i.ok){var n=E("btnSalvarEdicao"),r=await O("editar_lead",{p_lead_id:H,p_nome:t.nome,p_whatsapp:t.whatsapp||null,p_produto:t.produto,p_condicao:t.condicao,p_perfil:t.perfil,p_origem:t.origem,p_indicado_por:t.indicado_por||null,p_observacoes:t.observacoes||null,p_aparelho_entrada:t.aparelho_entrada||null,p_upgrade_entrada:t.upgrade_entrada,p_valor_oferta:t.valor_oferta,p_proximo_contato:t.proximo_contato,p_data_nascimento:t.data_nascimento},n);r&&(!1!==r.ok?(I(r.msg||"Lead atualizado"),R(),B(!0)):a.textContent=r.msg||"Edicao recusada")}else a.textContent=i.msg}else a.textContent="Sem lead selecionado"}async function V(){if(H&&window.confirm("Arquivar este lead? Ele sai da operacao mas o historico fica no banco.")){var a=E("btnArquivar"),e=await O("arquivar_lead",{p_lead_id:H,p_motivo:null},a);e&&(!1!==e.ok?(I(e.msg||"Lead arquivado"),R(),B(!0)):E("edErro").textContent=e.msg||"Arquivamento recusado")}}var dicOk=!1;async function B(sil){if(!sil)E("lista").innerHTML='<div class="estado carregando">Lendo a base…</div>';if(!dicOk){var a=await t.from("dicionario_rotulos").select("dominio,codigo,rotulo");!a.error&&a.data&&(d(a.data),dicOk=!0)}var e=await t.from("v_lead").select("*").order("proximo_contato",{ascending:!0,nullsFirst:!1});if(e.error){if(await pwSemSessao())return pwSessaoCaiu();E("lista").innerHTML='<div class="estado erro">Falha ao ler a base: '+c(e.error.message)+". Toque em Atualizar para tentar de novo.</div>"}else{i=e.data||[];var o=new Date;r=("0"+o.getHours()).slice(-2)+":"+("0"+o.getMinutes()).slice(-2),pb(l()),k()}}function pb(a){a=a||l();var e=i.filter(function(a){return!a.arquivado_em}),o=v(e,a),t=o.filter(function(e){return p(e.proximo_contato,a)>0}),n=e.filter(function(a){return"pendente"===a.status});E("pbFila").textContent=String(o.length),E("badgeFila")&&(E("badgeFila").textContent=o.length?String(o.length):"");var r=E("pbAtraso");r.textContent=String(t.length),r.className="pb-num"+(t.length?" alerta":""),E("pbAtivos").textContent=String(n.length),E("pbTotal").textContent=String(e.length)}function U(a){E("telaLogin").className="login"+(a?" oculto":""),E("telaApp").className="app"+(a?"":" oculto")}var pwSaindo=!1;function pwSessaoCaiu(){i=[],U(!1);var a=E("loginErro");a&&(a.textContent="Sua sessao expirou. Entre de novo.")}async function pwSemSessao(){try{var a=await t.auth.getSession();return!(a&&a.data&&a.data.session)}catch(a){return!1}}async function Z(){var a=E("btnEntrar"),e=E("loginErro");e.textContent="",a.disabled=!0,a.textContent="Entrando…";var o=await t.auth.signInWithPassword({email:E("email").value.trim(),password:E("senha").value});a.disabled=!1,a.textContent="Entrar",o.error?e.textContent="Nao entrou: confira email e senha.":(pwSaindo=!1,U(!0),B())}async function X(){pwSaindo=!0,await t.auth.signOut(),i=[],U(!1)}function Y(a,e,o){var t=E(a);t?t.addEventListener(e,o):window.console&&console.warn("PitWall: elemento #"+a+" ausente; listener ignorado")}return{esc:c,setRotulos:d,rotulo:s,hojeLocalISO:l,dataLocalDe:u,diasAtraso:p,entraNaFila:m,montarFila:v,filtrarBusca:g,filtrarIndicacoes:_,fmtTel:f,waHrefFila:b,waHrefLimpo:h,cardHTML:x,renderLista:N,diaMaisISO:C,validarCadastro:w,validarEdicao:S,coletarCadastro:y,abrirCadastro:P,init:function(){t=window.supabase.createClient(a,e),t.auth.onAuthStateChange(function(evt,ses){"SIGNED_IN"===evt&&ses?pwSaindo=!1:"SIGNED_OUT"===evt&&(pwSaindo?pwSaindo=!1:pwSessaoCaiu())}),window.addEventListener("error",function(a){try{I("Erro: "+(a&&a.message?a.message:"falha inesperada"),!0)}catch(a){}}),window.addEventListener("unhandledrejection",function(a){var e=a&&a.reason?a.reason.message||String(a.reason):"promessa rejeitada";try{I("Erro: "+e,!0)}catch(a){}}),Y("btnEntrar","click",Z),Y("senha","keydown",function(a){"Enter"===a.key&&Z()}),Y("btnSair","click",X),Y("btnAtualizar","click",function(){dicOk=!1,B()}),Y("abaFila","click",function(){G("fila")}),Y("abaTodos","click",function(){G("todos")}),Y("abaVendas","click",function(){G("vendas")}),Y("abaNfs","click",function(){G("nfs")}),Y("btnSalvarNf","click",salvarNfPainel),Y("btnFecharNf","click",fecharPainelNf),Y("btnSalvarCliente","click",salvarCliente),Y("btnCancelarCliente","click",fecharPainelCliente),Y("nfLista","click",nfListaClick),Y("btnEnviarEntrega","click",function(){enviarEntrega(E("btnEnviarEntrega"))}),Y("btnCopiarEntrega","click",function(){copiarEntrega(E("btnCopiarEntrega"))}),Y("btnFecharEntrega","click",fecharPainelEntrega),["peRetirada","peEntrega","peValor","pePgto","peMotoboy","peMotoWhats","peRecado"].forEach(function(id){Y(id,"input",entPintar)}),Y("btnSalvarVenda","click",salvarVenda),Y("btnCancelarVenda","click",fecharPainelVenda),Y("fvValor","input",calcLucroVenda),Y("fvCusto","input",calcLucroVenda),Y("fvFrete","input",calcLucroVenda),Y("fvTaxas","input",calcLucroVenda),Y("fvClienteBusca","input",buscaClienteVenda),Y("painelVenda","click",fvCliClick),Y("painelEntrega","click",entPainelClick),Y("abaClientes","click",function(){G("clientes")}),Y("abaIndicacoes","click",function(){G("indicacoes")}),Y("abaDash","click",function(){G("dashboard")}),Y("abaCaptacao","click",function(){G("captacao")}),Y("abaHoje","click",function(){G("hoje")}),Y("abaConteudo","click",function(){G("conteudo")}),Y("abaRotina","click",function(){G("rotina")}),Y("abaEscopo","click",function(){G("escopo")}),Y("abaMais","click",function(){var a=E("abas");if(a){var b=a.className.indexOf("mais-aberto")>=0;a.className="abas"+(b?"":" mais-aberto"),E("abaMais").setAttribute("aria-expanded",b?"false":"true")}}),Y("lista","keydown",capKeydown),Y("inputBusca","input",k),Y("lista","click",A),Y("lista","dragstart",contDragStart),Y("lista","dragover",contDragOver),Y("lista","drop",contDrop),Y("lista","dragend",contDragEnd),Y("btnNovoLead","click",P),Y("btnCancelarCadastro","click",M),Y("btnCadastrar","click",F),Y("btnAbrirExistente","click",W),Y("cadOrigem","change",j),Y("btnSalvarEdicao","click",z),Y("btnCancelarEdicao","click",R),Y("btnArquivar","click",V),Y("edOrigem","change",J),t.auth.getSession().then(function(a){var e=!(!a.data||!a.data.session);U(e),e&&B()})},_setLeads:function(a){i=a}}}(),window.__PITWALL_SEM_INIT||("loading"===document.readyState?document.addEventListener("DOMContentLoaded",function(){window.PitWall.init()}):window.PitWall.init())
