window.PitWall=function(){"use strict";var a="https://unjzpyexgtbcmjfgcqrx.supabase.co",e="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuanpweWV4Z3RiY21qZmdjcXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMTgyOTQsImV4cCI6MjA5ODY5NDI5NH0.SDH7Wa7z4jS6M4unhZcKRJJbrrTvi9jXkbs9JqdM-ZU",o=JSON.parse(JSON.stringify({condicao:{lacrado:"Lacrado",vitrine:"Vitrine",seminovo:"Seminovo"},status:{pendente:"Pendente",feito:"Feito",convertido:"Convertido",lista_fria:"Lista fria",cancelado:"Cancelado"},perfil:{compra_imediata:"Lead — Compra imediata",avaliando:"Lead — Avaliando",em_espera:"Lead — Em espera",repescagem:"Lead — Repescagem",comprou:"Lead — Comprou",consulta:"Lead — Consulta"},origem:{indicacao:"Indicação",instagram:"Instagram",whatsapp_direto:"WhatsApp direto",loja_fisica:"Loja física",prospeccao_ativa:"Prospecção ativa",parceria_influencer:"Parceria influencer",parceria_pag_local:"Parceria PAG local",whatsapp_status:"WhatsApp Status"},nivel:{quente:"Quente",morno:"Morno",frio:"Frio"}})),t=null,i=[],n="hoje",r=null;function c(a){return String(null==a?"":a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function d(a){(a||[]).forEach(function(a){a&&a.dominio&&a.codigo&&(o[a.dominio]||(o[a.dominio]={}),o[a.dominio][a.codigo]=a.rotulo)})}function s(a,e){return e?o[a]&&o[a][e]||e:""}function l(a){var e=a||new Date,o=String(e.getMonth()+1),t=String(e.getDate());return e.getFullYear()+"-"+(o.length<2?"0"+o:o)+"-"+(t.length<2?"0"+t:t)}function u(a){if(!a)return null;var e=new Date(a);return isNaN(e.getTime())?null:l(e)}function p(a,e){if(!a)return 0;var o=new Date(a+"T12:00:00"),t=new Date(e+"T12:00:00");return Math.round((t-o)/864e5)}function m(a,e){return!(!a||"pendente"!==a.status)&&(!(!a.proximo_contato||a.proximo_contato>e)&&u(a.ultimo_toque_em)!==e)}function v(a,e){return(a||[]).filter(function(a){return m(a,e)}).sort(function(a,e){return a.proximo_contato!==e.proximo_contato?a.proximo_contato<e.proximo_contato?-1:1:String(a.nome||"").localeCompare(String(e.nome||""))})}function g(a,e){var o=String(e||"").trim().toLowerCase();return o?(a||[]).filter(function(a){return String(a.nome||"").toLowerCase().indexOf(o)>=0||String(a.whatsapp_digitos||"").indexOf(o.replace(/\D/g,"")||"\0")>=0||String(a.produto||"").toLowerCase().indexOf(o)>=0}):(a||[]).slice()}function f(a){var e=String(a||"").replace(/\D/g,"");if(!e)return"";var o="",t=e;return t.length>11&&"55"===t.slice(0,2)&&(o="+55 ",t=t.slice(2)),11===t.length?o+"("+t.slice(0,2)+") "+t.slice(2,7)+"-"+t.slice(7):10===t.length?o+"("+t.slice(0,2)+") "+t.slice(2,6)+"-"+t.slice(6):o+t}function filtClientes(a){return(a||[]).filter(function(le){return le&&"comprou"===le.perfil})}function fxCli(a){var p=[];if(a.qtd_compras>0)p.push('<span class="cli-seg">'+a.qtd_compras+(a.qtd_compras>1?" compras":" compra")+"</span>");if(a.valor_total>0)p.push('<span class="cli-seg">R$ '+Number(a.valor_total).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+"</span>");if(a.data_nascimento){var d=String(a.data_nascimento).split("-");3===d.length&&p.push('<span class="cli-seg">aniv. '+d[2]+"/"+d[1]+"</span>")}return p.length?'<div class="card-cliente">'+p.join("")+"</div>":""}function _(a){return(a||[]).filter(function(a){return a&&"indicacao"===a.origem})}function b(a){if(!a||!0!==a.consentimento)return null;var e=String(a.whatsapp_digitos||"").replace(/\D/g,"");if(!e)return null;var o="Oi "+(a.nome||"")+"! Vi seu interesse no "+(a.produto||"aparelho")+", posso te passar as condicoes?";return"https://wa.me/"+e+"?text="+encodeURIComponent(o)}function h(a){var e=String(a&&a.whatsapp_digitos||"").replace(/\D/g,"");return e?"https://wa.me/"+e:null}function C(a,e){var o=new Date(a+"T12:00:00");return o.setDate(o.getDate()+(e||0)),l(o)}function w(a){return a&&String(a.nome||"").trim()?String(a.whatsapp||"").replace(/\D/g,"")?String(a.produto||"").trim()?String(a.condicao||"").trim()?String(a.perfil||"").trim()?String(a.origem||"").trim()?"indicacao"!==a.origem||String(a.indicado_por||"").trim()?{ok:!0,msg:""}:{ok:!1,msg:"Indicado por e obrigatorio quando a origem e Indicacao"}:{ok:!1,msg:"Origem obrigatoria"}:{ok:!1,msg:"Perfil obrigatorio"}:{ok:!1,msg:"Condicao obrigatoria"}:{ok:!1,msg:"Produto obrigatorio"}:{ok:!1,msg:"WhatsApp obrigatorio"}:{ok:!1,msg:"Nome obrigatorio"}}function S(a){return a&&String(a.nome||"").trim()?String(a.produto||"").trim()?String(a.condicao||"").trim()?String(a.perfil||"").trim()?String(a.origem||"").trim()?"indicacao"!==a.origem||String(a.indicado_por||"").trim()?{ok:!0,msg:""}:{ok:!1,msg:"Indicado por e obrigatorio quando a origem e Indicacao"}:{ok:!1,msg:"Origem obrigatoria"}:{ok:!1,msg:"Perfil obrigatorio"}:{ok:!1,msg:"Condicao obrigatoria"}:{ok:!1,msg:"Produto obrigatorio"}:{ok:!1,msg:"Nome obrigatorio"}}function x(a,e,o){var t=a.nivel||"quente",i="fila"===e?p(a.proximo_contato,o):0,n=[];"fila"===e&&i>0&&n.push('<span class="chip atraso">'+i+"d de atraso</span>"),a.perfil&&n.push('<span class="chip">'+c(s("perfil",a.perfil))+"</span>"),"morno"!==t&&"frio"!==t&&"sem_contato"!==t||n.push('<span class="chip nivel-'+t+'">'+c(s("nivel",t))+"</span>"),"fila"!==e&&a.status&&n.push('<span class="chip st-'+a.status+'">'+c(s("status",a.status))+"</span>"),"indicacao"===a.origem&&a.indicado_por&&n.push('<span class="chip ind">Ind. por '+c(a.indicado_por)+"</span>");var r,d="";"number"==typeof a.dias_silencio&&(d='<div class="silencio'+(a.dias_silencio>=3?" alerta":"")+'">'+a.dias_silencio+"d sem resposta</div>");var l="fila"===e?b(a):h(a);if(l){var u="fila"===e?"Chamar no WhatsApp":"Abrir conversa";r='<a class="btn-wa" target="_blank" rel="noopener" href="'+c(l)+'"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path></svg>'+u+"</a>"}else r=String(a.whatsapp_digitos||"").trim()?'<div class="sem-tel">Sem consentimento</div>':'<div class="sem-tel">Sem telefone na base</div>';if("fila"===e&&a.id){r='<button class="btn-acao sugerir" data-acao="sugerir" data-id="'+c(a.id)+'">Sugerir mensagem</button>'+filaWaCard(a)}var m=a.observacoes?'<div class="obs">'+c(a.observacoes)+"</div>":"",v="";if("fila"===e&&a.id){var g=c(a.id);v='<div class="card-acoes escrita"><button class="btn-acao toque" data-acao="toque" data-id="'+g+'">Toque enviado</button><button class="btn-acao respondeu" data-acao="respondeu" data-id="'+g+'">Respondeu</button><button class="btn-acao" data-acao="leque" data-id="'+g+'">Desfecho</button></div><div class="desfechos"><button class="btn-desf" data-acao="conversando" data-id="'+g+'">Conversando</button><button class="btn-desf" data-acao="retomar" data-id="'+g+'">Retomar</button><button class="btn-desf ok" data-acao="fechou" data-id="'+g+'">Fechou</button><button class="btn-desf frio" data-acao="sem-interesse" data-id="'+g+'">Sem interesse</button></div><div class="retomar"><input type="date" value="'+c(C(o,1))+'" aria-label="Retomar em"><button class="btn-desf" data-acao="retomar-ok" data-id="'+g+'">Confirmar</button></div>'}var _=f(a.whatsapp_digitos),w=_?'<div class="card-tel">'+c(_)+"</div>":"";return'<article class="card t-'+c(t)+'" data-lead="'+c(a.lead_code||"")+'"><div class="card-topo"><div class="card-nome">'+c(a.nome||"")+'</div><div class="card-topo-dir"><div class="card-code">'+c(a.lead_code||"")+"</div>"+(a.id?'<button class="btn-editar" data-acao="editar" data-id="'+c(a.id)+'">Editar</button>':"")+'</div></div><div class="card-prod">'+c(a.produto||"")+(a.condicao?' <span class="cond">· '+c(s("condicao",a.condicao))+"</span>":"")+"</div>"+w+("clientes"===e?fxCli(a):"")+'<div class="chips">'+n.join("")+"</div>"+d+m+'<div class="card-acoes">'+r+(a.id?'<button class="btn-acao" data-acao="historico" data-id="'+c(a.id)+'">Histórico</button>':"")+"</div>"+("fila"===e&&a.id?'<div class="scripts" data-scripts></div>':"")+(a.id?'<div class="hist" data-hist></div>':"")+v+"</article>"}function N(a,e,o,t,i){e.length?a.innerHTML=e.map(function(a){return x(a,o,t)}).join(""):a.innerHTML=i}function k(){var a=l(),e=E("lista"),o=i.filter(function(a){return!a.arquivado_em});if(E("abaFila").setAttribute("aria-selected","fila"===n?"true":"false"),E("abaTodos").setAttribute("aria-selected","todos"===n?"true":"false"),E("abaVendas")&&E("abaVendas").setAttribute("aria-selected","vendas"===n?"true":"false"),E("abaNfs")&&E("abaNfs").setAttribute("aria-selected","nfs"===n?"true":"false"),E("abaClientes")&&E("abaClientes").setAttribute("aria-selected","clientes"===n?"true":"false"),E("abaIndicacoes").setAttribute("aria-selected","indicacoes"===n?"true":"false"),E("abaDash")&&E("abaDash").setAttribute("aria-selected","dashboard"===n?"true":"false"),E("abaCaptacao")&&E("abaCaptacao").setAttribute("aria-selected","captacao"===n?"true":"false"),E("abaHoje")&&E("abaHoje").setAttribute("aria-selected","hoje"===n?"true":"false"),E("abaConteudo")&&E("abaConteudo").setAttribute("aria-selected","conteudo"===n?"true":"false"),E("abaRotina")&&E("abaRotina").setAttribute("aria-selected","rotina"===n?"true":"false"),E("abaEscopo")&&E("abaEscopo").setAttribute("aria-selected","escopo"===n?"true":"false"),E("abaMais")&&(E("abaMais").setAttribute("aria-selected",["indicacoes","captacao","dashboard","rotina","nfs","escopo"].indexOf(n)>=0?"true":"false"),E("abaMais").setAttribute("aria-expanded","false")),E("abas")&&(E("abas").className="abas"),E("topoTit")&&(E("topoTit").textContent="fila"===n?"Fila do dia":"vendas"===n?"Vendas":"nfs"===n?"Notas fiscais":"todos"===n?"Todos":"clientes"===n?"Clientes":"indicacoes"===n?"Indicações":"captacao"===n?"Captação":"hoje"===n?"Hoje":"conteudo"===n?"Conteúdo":"escopo"===n?"Escopo":"rotina"===n?"Rotina":"Dashboard"),E("topoSub")&&(E("topoSub").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"short",year:"numeric"})),E("blocoBusca").className="busca"+("todos"===n||"clientes"===n||"vendas"===n||"nfs"===n?" visivel":""),E("pitboard")&&(E("pitboard").className="pitboard"+(["captacao","hoje","conteudo","rotina","dashboard","nfs","vendas","clientes","indicacoes"].indexOf(n)>=0?" oculto":"")),"fila"===n){N(e,v(o,a),"fila",a,'<div class="estado"><strong>Fila limpa.</strong><br>Nenhum lead vence hoje. O proximo entra sozinho na data marcada.</div>');prefetchFilaSug(24).then(filaWaAtualizar)}else if("hoje"===n)renderHoje();else if("conteudo"===n)renderConteudo();else if("rotina"===n)renderRotina();else if("escopo"===n)renderEscopo();else if("captacao"===n)renderCaptacao();else if("dashboard"===n)renderDash();else if("indicacoes"===n)N(e,_(o),"indicacoes",a,'<div class="estado"><strong>Nenhuma indicacao ainda.</strong><br>Leads com origem Indicacao aparecem aqui, com quem indicou.</div>');else if("vendas"===n)renderVendas(e);else if("nfs"===n)renderNfs(e);else if("clientes"===n)renderClientes(e);else{N(e,g(o,E("inputBusca").value),"todos",a,'<div class="estado">Nenhum lead corresponde a busca. Ajuste o termo ou limpe o campo.</div>')}E("rodape").textContent=r?"v_lead · leitura "+r+" · Fase 2 · escrita ativa":""}function E(a){return document.getElementById(a)}var L=null;function I(a,e){var o=E("toast");o&&(o.textContent=a,o.className="toast visivel"+(e?" erro":""),L&&clearTimeout(L),L=setTimeout(function(){o.className="toast"},3200))}async function O(a,e,o){o&&(o.disabled=!0);var i=await t.rpc(a,e);if(o&&(o.disabled=!1),i.error){if(await pwSemSessao())return pwSessaoCaiu(),null;return I("Falha: "+i.error.message,!0),null}return i.data||null}async function q(a,e,o,t){var i=await O(a,e,o);i&&(!1!==i.ok?(I(t||i.msg||"Feito"),B()):I(i.msg||"Operacao recusada",!0))}function histAtor(tipo){if("fechou"===tipo||"respondeu"===tipo)return"ok";if("sem_interesse"===tipo||"arquivado"===tipo)return"fim";if("cadencia_iniciada"===tipo||"cadencia_avancou"===tipo||"cadencia_encerrada"===tipo||"perfil_transicionado"===tipo||"esfriado_por_silencio"===tipo)return"regua";return"operador"}function histLinha(ev){var autor=ev.autor||"Régua";var q=String(ev.quando||"").replace(/^(\d{2}\/\d{2})\/\d{4} /,"$1 ");var det=ev.detalhe?'<div class="hist-'+("nota"===ev.tipo?"nota-txt":"det")+'">'+c(ev.detalhe)+"</div>":"";return'<li class="hist-ev ator-'+histAtor(ev.tipo)+'"><div class="hist-quando">'+c(q)+'</div><div class="hist-marca"><span class="hist-ponto"></span></div><div class="hist-corpo"><div class="hist-rot">'+c(ev.rotulo||ev.tipo||"")+' <span class="hist-autor">· '+c(autor)+'</span></div>'+det+"</div></li>"}function histTopo(id){return'<div class="hist-topo"><div class="hist-tit">Histórico</div><button class="btn-nota" data-acao="nota" data-id="'+c(id)+'">+ Nota</button></div>'}function histForm(id){return'<div class="hist-form"><textarea placeholder="O que aconteceu? A nota entra no histórico e não pode ser apagada."></textarea><div class="hist-form-pe"><input type="date" value="'+c(l())+'" aria-label="Data da nota"><button class="btn-nota ok" data-acao="nota-ok" data-id="'+c(id)+'">Registrar</button></div></div>'}function pintarHist(cont,id,evs){var lista=evs&&evs.length?'<ol class="hist-lista">'+evs.map(histLinha).join("")+"</ol>":'<div class="hist-vazio">Nenhum evento ainda.</div>';cont.innerHTML=histTopo(id)+histForm(id)+lista}function histErro(f,msg){var v=f.querySelector(".hist-erro");v&&v.parentNode.removeChild(v);var d=document.createElement("div");d.className="hist-erro";d.textContent=msg;var pe=f.querySelector(".hist-form-pe");pe?f.insertBefore(d,pe):f.appendChild(d)}function alternarNota(card){var f=card.querySelector(".hist-form");if(!f)return;var ab=f.className.indexOf("aberto")>=0;f.className="hist-form"+(ab?"":" aberto");if(!ab){var ta=f.querySelector("textarea");ta&&ta.focus()}}async function abrirHistorico(id,btn,card){var cont=card.querySelector("[data-hist]");if(!cont)return;if(cont.className.indexOf("aberto")>=0){cont.className="hist";cont.innerHTML="";if(btn)btn.className="btn-acao";return}cont.className="hist aberto";cont.innerHTML=histTopo(id)+'<div class="hist-vazio">Buscando histórico...</div>';if(btn){btn.disabled=!0;btn.className="btn-acao ligado"}var res=await t.rpc("historico_lead",{p_lead_id:id});if(btn)btn.disabled=!1;if(res.error){cont.innerHTML=histTopo(id)+'<div class="hist-vazio">Falha: '+c(res.error.message)+"</div>";return}var d=res.data;if(!d||!1===d.ok){cont.innerHTML=histTopo(id)+'<div class="hist-vazio">'+c(d&&d.msg||"Sem histórico")+"</div>";return}pintarHist(cont,id,d.eventos||[])}async function registrarNota(id,btn,card){var f=card.querySelector(".hist-form");if(!f)return;var ta=f.querySelector("textarea"),dt=f.querySelector('input[type=date]');var txt=ta?String(ta.value):"";if(!txt.trim()){histErro(f,"Escreva a nota antes de registrar.");return}var args={p_lead_id:id,p_texto:txt};if(dt&&dt.value)args.p_data=dt.value;if(btn)btn.disabled=!0;var res=await t.rpc("registrar_nota",args);if(btn)btn.disabled=!1;if(res.error){histErro(f,"Falha: "+res.error.message);return}var d=res.data;if(!d||!1===d.ok){histErro(f,d&&d.msg||"Nota recusada");return}I(d.msg||"Nota registrada");var cont=card.querySelector("[data-hist]");var r2=await t.rpc("historico_lead",{p_lead_id:id});cont&&r2&&!r2.error&&r2.data&&pintarHist(cont,id,r2.data.eventos||[])}function capCel(rot,num,pe){return'<div class="pb-celula"><div class="pb-rot">'+c(rot)+'</div><div class="pb-num">'+c(String(num))+'</div><div class="pb-pe">'+c(pe)+'</div></div>'}function capPlacar(p){var tot=p.total||0;return'<div class="pitboard">'+capCel("hoje",p.feitas||0,"de "+(p.alvo||0)+" na meta")+capCel("abordadas",tot,"desde o início")+capCel("viraram lead",p.leads_gerados||0,"de "+tot+" abordadas")+capCel("não abordar",p.pararam||0,"pediram para parar")+"</div>"}function capRegistro(){var o=(capFrentes||[]).map(function(f){return'<option value="'+c(f.codigo)+'">'+c(f.rotulo)+"</option>"}).join("");return'<div class="cap-reg"><div class="cap-reg-lin"><select id="capFrente" aria-label="Frente">'+o+'</select>'+'<input class="ident" id="capIdent" placeholder="@perfil" aria-label="Perfil abordado" autocomplete="off">'+'<button class="btn-cap" data-acao="cap-registrar">Registrar</button></div>'+'<div id="capMsg"></div>'+'<button class="cap-mais" data-acao="cap-mais">+ nome e observação</button>'+'<div class="cap-det" id="capDet"><input id="capNome" placeholder="Nome (opcional)" aria-label="Nome">'+'<textarea id="capObs" placeholder="Observação (opcional)"></textarea></div></div>'}function capLinha(x){var nome=x.nome?'<div class="cap-nome">'+c(x.nome)+"</div>":"";var fim,cls="";if(x.parou){fim='<span class="cap-selo">não abordar</span>';cls=" parou"}else if(x.virou_lead){fim='<span class="cap-virou">virou lead</span>';cls=" virou"}else fim='<button class="btn-parar" data-acao="cap-parar" data-id="'+c(x.id)+'">parar</button>';return'<div class="cap-lin'+cls+'"><div class="cap-hora">'+c(x.hora||"")+'</div>'+'<div class="cap-quem"><div class="cap-ident">'+c(x.identificador||"")+"</div>"+nome+"</div>"+'<div class="cap-frente">'+c(x.frente_rotulo||x.frente||"")+"</div>"+'<div class="cap-fim">'+fim+"</div></div>"}function capLog(linhas){if(!linhas||!linhas.length)return'<div class="cap-log"><div class="cap-vazio"><div class="cap-vazio-t">Nenhuma abordagem hoje.</div><div class="cap-vazio-s">A meta '+(capAlvo?"são "+capAlvo:"do dia")+'. Comece pelo campo acima.</div></div></div>';return'<div class="cap-log"><div class="cap-log-cab"><span>hora</span><span>quem</span><span>frente</span><span></span></div>'+linhas.map(capLinha).join("")+"</div>"}var capFrentes=[],capAlvo=0;async function renderCaptacao(){var e=E("lista");e.innerHTML='<div class="estado carregando">Lendo a captação...</div>';if(!capFrentes.length){  var rf=await t.from("captacao_frente").select("codigo,rotulo,ordem,ativo").order("ordem",{ascending:!0});  if(!rf.error&&rf.data)capFrentes=rf.data.filter(function(f){return f.ativo});}var rp=await t.rpc("placar_captacao",{});var rl=await t.rpc("captacao_do_dia",{});if(rp.error||rl.error){  e.innerHTML='<div class="estado erro">Falha ao ler a captação: '+c((rp.error||rl.error).message)+". Toque em Atualizar para tentar de novo.</div>";return}var p=rp.data||{},lg=rl.data||{};capAlvo=p.alvo||0;if(E("topoSub"))E("topoSub").textContent=E("topoSub").textContent+" · "+(p.feitas||0)+" de "+(p.alvo||0)+" hoje";if(E("badgeCaptacao"))E("badgeCaptacao").textContent=p.feitas?String(p.feitas):"";e.innerHTML=capPlacar(p)+capRegistro()+capLog(lg.linhas||[]);}function capMsg(cls,msg){var d=E("capMsg");if(d)d.innerHTML=msg?'<div class="cap-msg '+cls+'">'+c(msg)+"</div>":""}function alternarCapDet(btn){var d=E("capDet");if(!d)return;var ab=d.className.indexOf("aberto")>=0;d.className="cap-det"+(ab?"":" aberto");if(btn)btn.textContent=ab?"+ nome e observação":"− nome e observação";if(!ab&&E("capNome"))E("capNome").focus()}async function registrarCaptacao(btn){var f=E("capFrente"),id=E("capIdent");if(!f||!id)return;var ident=String(id.value||"").trim();if(!ident){capMsg("erro","Digite o @perfil antes de registrar.");id.focus();return}var args={p_frente:f.value,p_identificador:ident};var nm=E("capNome"),ob=E("capObs");if(nm&&nm.value.trim())args.p_nome=nm.value;if(ob&&ob.value.trim())args.p_observacoes=ob.value;if(btn)btn.disabled=!0;var res=await t.rpc("registrar_captacao",args);if(btn)btn.disabled=!1;if(res.error){capMsg("erro","Falha: "+res.error.message);return}var d=res.data;if(!d||!1===d.ok){capMsg(d&&d.duplicado?"erro":"parada",d&&d.msg||"Abordagem recusada");return}I(d.msg||"Abordagem registrada");await renderCaptacao();var novo=E("capIdent");if(novo)novo.focus()}async function pararCaptacao(id,btn){if(!id)return;if(btn)btn.disabled=!0;var res=await t.rpc("registrar_opt_out",{p_captacao_id:id});if(btn)btn.disabled=!1;if(res.error){I("Falha: "+res.error.message,!0);return}var d=res.data;if(!d||!1===d.ok){I(d&&d.msg||"Nao foi possivel marcar",!0);return}I(d.msg||"Marcada como nao abordar");await renderCaptacao()}function capKeydown(a){if("Enter"!==a.key)return;var alvo=a.target;if(!alvo||!alvo.id)return;var mapa={capIdent:"cap-registrar",diaNovoTit:"dia-add",lembNovo:"lemb-add",rotNovoTit:"rot-add-tarefa",rotNovaCatRot:"rot-add-cat"},acao=mapa[alvo.id];if(!acao)return;a.preventDefault();var b=E("lista").querySelector('[data-acao="'+acao+'"]');b&&("cap-registrar"===acao?registrarCaptacao(b):b.click())}var DIAS_ISO=["","seg","ter","qua","qui","sex","sáb","dom"];function diasTxt(a){return a&&a.length?a.map(function(d){return DIAS_ISO[d]||"?"}).join(" · "):"todos os dias"}function svgCheck(){return'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'}function rotSlug(a){return String(a||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")}function fmtDia(a){if(!a)return"";var d=new Date(a+"T12:00:00");return isNaN(d.getTime())?String(a):d.toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"})}// A regua e o motor do CRM: se ela para, a fila mente em silencio.
// Esta linha e o unico lugar onde o operador ve que ela esta viva.
function reguaLinha(r){
if(!r||null==r.ok)return '<div class="sync-lin">régua nunca rodou</div>';
if(false===r.ok)return '<div class="sync-lin falha">régua falhou · '+c(r.erro||"erro desconhecido")+"</div>";
var velha=r.horas>=26,at=r.atrasados||0;
var txt=at?at+" lead"+(1===at?"":"s")+" atrasado"+(1===at?"":"s"):"nada atrasado";
return '<div class="sync-lin'+(velha?" velho":"")+'">régua rodou há '+c(String(r.horas))+"h · "+c(txt)+(velha?" · atrasada":"")+"</div>"}
function syncLinha(s){if(!s||null==s.ok)return'<div class="sync-lin">sync nunca rodou</div>';if(!1===s.ok)return'<div class="sync-lin falha">último sync falhou · '+c(s.msg||"")+"</div>";var v=s.horas>=24;return'<div class="sync-lin'+(v?" velho":"")+'">sincronizado há '+c(String(s.horas))+"h"+(v?" · atrasado":"")+"</div>"}async function qF(nome,args,btn,depois){var i=await O(nome,args,btn);i&&(!1!==i.ok?(I(i.msg||"Feito"),depois&&depois()):I(i.msg||"Operação recusada",!0))}function contItem(x){var sub=x.tipo_rotulo||x.semana?'<div class="cont-tipo">'+c(x.tipo_rotulo||"")+(x.semana?(x.tipo_rotulo?" · ":"")+c(x.semana):"")+"</div>":"";return'<div class="cont-lin"><div class="cont-tit">'+c(x.titulo||"")+sub+"</div>"+(x.status_rotulo?'<span class="chip">'+c(x.status_rotulo)+"</span>":"")+(x.url?'<a class="cont-link" target="_blank" rel="noopener" href="'+c(x.url)+'">Notion</a>':"")+"</div>"}function hojePlacar(d){var g=d.contagem||{},f=g.feitas||0,tt=g.total||0,pct=tt?Math.round(100*f/tt):0,ab=(d.lembretes||[]).filter(function(x){return!x.feito}).length,s=d.sync||{},sn,sp,sc="";null==s.ok?(sn="—",sp="sync nunca rodou"):!1===s.ok?(sn="—",sp="último sync falhou",sc=" falha"):(sn=s.horas+"h",sp="desde o último sync",s.horas>=24&&(sc=" velho"));return'<div class="pitboard">'+capCel("rotina",pct+"%",f+" de "+tt+" feitas")+capCel("conteúdo",(d.conteudo||[]).length,"peças hoje")+capCel("lembretes",ab,"em aberto")+'<div class="pb-celula"><div class="pb-rot">sync</div><div class="pb-num">'+c(sn)+'</div><div class="pb-pe'+sc+'">'+c(sp)+"</div></div></div>"}function hojeTarefas(d){var cats=d.categorias||[],corpo,ops="";cats.forEach(function(x){!1!==x.ativa&&(ops+='<option value="'+c(x.codigo)+'">'+c(x.rotulo)+"</option>")});corpo=cats.length?cats.map(function(ct){var ts=(ct.tarefas||[]).map(function(x){return'<div class="dia-lin"><button class="dia-tarefa" role="checkbox" aria-checked="'+(x.concluida?"true":"false")+'" data-acao="dia-marcar" data-id="'+c(x.id)+'"><span class="dia-check">'+svgCheck()+'</span><span class="dia-tit">'+c(x.titulo||"")+"</span></button><button class=\"dia-rm\" data-acao=\"dia-remover\" data-id=\""+c(x.id)+'">remover</button></div>'}).join("");return'<div class="dia-cat-rot" style="--tr:'+trilhoDe(ct.codigo)+'">'+iconeCat(ct.codigo)+c(ct.rotulo||ct.codigo)+"</div>"+(ts||'<div class="dia-vazio">Nada nesta categoria hoje.</div>')}).join(""):'<div class="dia-vazio">A rotina de hoje está vazia. O molde se digita na aba Rotina; o dia nasce dele de manhã, ou puxe agora.</div>';var add=ops?'<div class="dia-add"><input id="diaNovoTit" placeholder="Tarefa avulsa de hoje…" autocomplete="off"><select id="diaNovaCat" aria-label="Categoria">'+ops+'</select><button class="btn-acao" data-acao="dia-add">Adicionar</button></div>':"";return'<div class="dia-sec"><div class="dia-sec-cab"><div class="dia-sec-tit">Rotina do dia</div><button class="btn-nota" data-acao="dia-puxar">Puxar do molde</button></div>'+corpo+add+"</div>"}function hojeNota(d){return'<div class="dia-sec"><div class="dia-sec-tit">Nota do dia</div><div class="dia-nota"><textarea id="diaNota" placeholder="O que não pode se perder do dia…">'+c(d.nota||"")+'</textarea></div><div class="dia-nota-pe"><button class="btn-acao" data-acao="dia-nota-ok">Salvar nota</button></div></div>'}function nivelPonto(nv){return'<span class="fila-ponto n-'+c(nv||"quente")+'" aria-hidden="true"></span>'}var filaSug={};function filaEnviarHTML(a){var h=filaSug[a.id];return h?'<a class="btn-wa fila-wa" target="_blank" rel="noopener" href="'+h+'">Enviar</a>':""}function filaWaCard(a){var d=String(a.whatsapp_digitos||"").replace(/\D/g,"");if(!d)return'<div class="sem-tel card-wa-linha">Sem telefone na base</div>';if(!0!==a.consentimento)return'<div class="sem-tel card-wa-linha">Sem consentimento</div>';var h=(filaSug||{})[a.id]||"https://wa.me/"+d;return'<a class="btn-wa card-wa-linha" target="_blank" rel="noopener" data-wa-lead="'+c(a.id)+'" href="'+c(h)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z" stroke-linecap="round" stroke-linejoin="round"></path></svg>Chamar no WhatsApp</a>'}function filaWaAtualizar(){[].forEach.call(document.querySelectorAll("[data-wa-lead]"),function(el){var h=(filaSug||{})[el.getAttribute("data-wa-lead")];if(h)el.setAttribute("href",h)})}async function prefetchFilaSug(lim){filaSug={};var ativos=(i||[]).filter(function(x){return!x.arquivado_em}),top=v(ativos,l()).slice(0,lim||5);await Promise.all(top.map(async function(a){if(!a||!0!==a.consentimento)return;var dig=String(a.whatsapp_digitos||"").replace(/\D/g,"");if(!dig)return;try{var res=await t.rpc("sugerir_mensagem",{p_lead_id:a.id});var dd=res&&res.data;if(!dd||!1===dd.ok)return;var ops=dd.opcoes||[];if(!ops.length||!ops[0]||!ops[0].texto)return;filaSug[a.id]="https://wa.me/"+dig+"?text="+encodeURIComponent(ops[0].texto)}catch(e){}}))}function hojeFilaLin(a){var nv=a.nivel||"quente",atr=p(a.proximo_contato,l()),tag=atr>0?'<span class="fila-atraso">'+atr+"d de atraso</span>":"";return'<div class="fila-lin" data-lead="'+c(a.lead_code||"")+'"><div class="fila-lin-topo"><div class="fila-ident">'+nivelPonto(nv)+'<span class="fila-nome">'+c(a.nome||"")+'</span><span class="fila-nivel n-'+c(nv)+'">'+c(s("nivel",nv))+'</span></div><span class="fila-cad">'+(a.perfil?c(s("perfil",a.perfil)):"")+"</span>"+tag+'<button class="btn-acao sugerir fila-sug" data-acao="hoje-sugerir" data-id="'+c(a.id)+'">Sugerir</button>'+filaEnviarHTML(a)+'</div><div class="scripts" data-scripts></div></div>'}function hojeFila(d){var ativos=(i||[]).filter(function(x){return!x.arquivado_em}),fila=v(ativos,l());if(!fila.length)return'<div class="dia-sec"><div class="dia-sec-tit">Fila de hoje</div><div class="dia-vazio">Fila zerada hoje. Nada vencendo.</div></div>';var top=fila.slice(0,5).map(hojeFilaLin).join("");return'<div class="dia-sec"><div class="dia-sec-cab"><div class="dia-sec-tit">Fila de hoje</div><button class="fila-vertodos" data-acao="hoje-verfila">ver todos ('+fila.length+')</button></div>'+top+"</div>"}function hojeLembretes(d){var ls=(d.lembretes||[]).map(function(x){var _lc="dia-lin"+(x.vencido?" lemb-vencido":x.agendado?" lemb-agendado":""),_lt=x.vencido?'<span class="lemb-tag venc">'+(p(x.data,l())<=1?"venceu ontem":"atrasado "+p(x.data,l())+" dias")+"</span>":x.agendado?'<span class="lemb-tag agnd">agendado pra hoje</span>':"";return'<div class="'+_lc+'"><button class="dia-tarefa" role="checkbox" aria-checked="'+(x.feito?"true":"false")+'" data-acao="lemb-marcar" data-id="'+c(x.id)+'"><span class="dia-check">'+svgCheck()+'</span><span class="dia-tit">'+c(x.texto||"")+"</span>"+_lt+"</button><button class=\"dia-rm\" data-acao=\"lemb-remover\" data-id=\""+c(x.id)+'">remover</button></div>'}).join("");return'<div class="dia-sec"><div class="dia-sec-tit">Lembretes</div>'+(ls||'<div class="dia-vazio">Nenhum lembrete para hoje.</div>')+'<div class="dia-add"><input id="lembNovo" placeholder="Novo lembrete…" autocomplete="off"><input type="date" id="lembData" value="'+c(l())+'" aria-label="Dia do lembrete"><button class="btn-acao" data-acao="lemb-add">Adicionar</button></div><div class="lemb-quando"><button class="lemb-q" data-acao="lemb-hoje">Hoje</button><button class="lemb-q" data-acao="lemb-amanha">Amanha</button></div></div>'}// Card RETANGULAR do dia. A aba Hoje e onde o dia se confere e se fecha, entao a
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
function hojeConteudo(d){var l=d.conteudo||[],itens=l.map(hojeContCard).join("");return'<div class="dia-sec"><div class="dia-sec-cab"><div class="dia-sec-tit">Conteúdo de hoje</div>'+(l.length?hojeContPlacar(l):"")+syncLinha(d.sync)+"</div>"+(itens?'<div class="dia-cont-lista">'+itens+"</div>":'<div class="dia-vazio">Nada no calendário para hoje.</div>')+"</div>"}async function renderHoje(){var e=E("lista");e.innerHTML='<div class="estado carregando">Lendo o dia…</div>';var r=await t.rpc("painel_do_dia",{});if(r.error)return void(e.innerHTML='<div class="estado erro">Falha ao ler o dia: '+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");var d=r.data;if(!d||!1===d.ok)return void(e.innerHTML='<div class="estado erro">'+c(d&&d.msg||"Falha ao ler o dia.")+"</div>");await prefetchFilaSug();e.innerHTML=hojePlacar(d)+reguaLinha(d.regua)+hojeFila(d)+hojeTarefas(d)+hojeConteudo(d)+hojeLembretes(d)+hojeNota(d)}
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
async function renderDash(){
var e=E("lista");
e.innerHTML='<div class="estado carregando">Somando…</div>';
var r=await t.rpc("painel_metricas",{p_ini:C(l(),-(METRICA_DIAS-1)),p_fim:l()});
if(r.error)return void(e.innerHTML='<div class="estado erro">Falha ao ler as métricas: '+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");
var d=r.data;
if(!d||!1===d.ok)return void(e.innerHTML='<div class="estado erro">'+c(d&&d.msg||"Falha ao ler as métricas.")+"</div>");
e.innerHTML=metTopo(d)+metOrigem(d)+metConteudo(d)}
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
async function renderEscopo(){
var e=E("lista");
e.innerHTML='<div class="estado carregando">Lendo o escopo…</div>';
var r=await t.rpc("escopo_completo",{});
if(r.error)return void(e.innerHTML='<div class="estado erro">Falha ao ler o escopo: '+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");
var d=r.data;
if(!d||!1===d.ok)return void(e.innerHTML='<div class="estado erro">'+c(d&&d.msg||"Falha ao ler o escopo.")+"</div>");
var fr=d.frentes||[],pode=!0===d.pode_editar;
e.innerHTML=fr.length?escPlacar(fr)+fr.map(function(x){return escFrente(x,pode)}).join(""):'<div class="estado"><strong>O escopo está vazio.</strong>Nenhuma frente cadastrada.</div>'}
async function renderRotina(){
var e=E("lista");
e.innerHTML='<div class="estado carregando">Lendo o molde…</div>';
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
function cardVenda(v){
return '<div class="card"><div class="card-top"><span class="card-code">'+c(v.venda_code||"")+'</span><span class="card-prod">'+c(v.modelo_rotulo||"")+(v.capacidade?" "+c(v.capacidade):"")+(v.cor?" "+c(v.cor):"")+'</span></div><div class="card-sub">'+c(v.cliente_nome||"sem cliente")+(v.data_venda?" · "+c(v.data_venda):"")+(v.imei?" · IMEI "+c(v.imei):"")+"</div>"+fxVenda(v)+vendaCliLinha(v)+nfLinhaVenda(v)+"</div>"}
function filtVendaBusca(lista,termo){
var q=String(termo||"").trim().toLowerCase();
if(!q)return lista;
return lista.filter(function(v){return [v.venda_code,v.modelo_rotulo,v.cliente_nome,v.imei].join(" ").toLowerCase().indexOf(q)>=0})}
async function carregarVendas(){
var r=await t.from("v_venda").select("*").order("criado_em",{ascending:!1});
vendasData=(r&&r.data)||[]}
// As arquivadas vem da TABELA, nao da v_venda: a view filtra arquivado_em is
// null, e mexer nela para caber um contador derrubaria o security_invoker em
// silencio. A tabela ja e isolada por RLS, entao o tenant continua garantido.
async function carregarVendasArq(){
var r=await t.from("venda").select("id,venda_code,modelo_texto,comprador_nome,valor_venda,data_venda,arquivado_em")
.not("arquivado_em","is",null).order("arquivado_em",{ascending:!1});
vendasArq=(r&&r.data)||[]}
function cardVendaArq(v){
return '<div class="card arquivada"><div class="card-top"><span class="card-code">'+c(v.venda_code||"")+'</span><span class="card-prod">'+c(v.modelo_texto||"")+'</span></div><div class="card-sub">'+
c(v.comprador_nome||"sem cliente")+(v.data_venda?" · "+c(fmtDia(v.data_venda)):"")+" · "+brlV(v.valor_venda)+"</div>"+
'<div class="venda-cli"><span class="venda-cli-code">fora do faturamento</span><button class="btn-acao" data-acao="venda-desarquivar" data-id="'+c(v.id)+'">Desarquivar</button></div></div>'}
async function renderVendas(e){
e.innerHTML='<div class="estado carregando">Lendo vendas…</div>';
await carregarVendas();await carregarNfs();await carregarVendasArq();
var lista=filtVendaBusca(vendasData,E("inputBusca")?E("inputBusca").value:"");
var arq=vendasArq.length?' · <button class="venda-arq-btn" data-acao="venda-arq-alternar" aria-expanded="'+(vendasArqAberto?"true":"false")+'">'+vendasArq.length+" arquivada"+(1===vendasArq.length?"":"s")+"</button>":"";
var topo='<div class="venda-topo"><button class="btn-cad" data-acao="nova-venda">+ Nova venda</button><span class="venda-cont">'+vendasData.length+(1===vendasData.length?" venda":" vendas")+arq+"</span></div>";
e.innerHTML=topo+(lista.length?lista.map(cardVenda).join(""):'<div class="estado"><strong>Nenhuma venda ainda.</strong><br>Toque em Nova venda pra registrar a primeira.</div>')+
(vendasArqAberto&&vendasArq.length?'<p class="venda-arq-tit">Arquivadas · não contam no faturamento</p>'+vendasArq.map(cardVendaArq).join(""):"")}
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
fvSet("fvWhats","");fvSet("fvCpf","");fvSet("fvData","");fvSet("fvTradeIn","");
if(E("fvStatus"))E("fvStatus").value="concluida";
if(E("fvNfArq"))E("fvNfArq").value=""}
function preencherPainelVenda(v){
FV_CAMPOS.forEach(function(p){fvSet(p[0],v[p[1]])});
if(!v.modelo_texto)fvSet("fvModelo",v.modelo_rotulo||"");
fvSet("fvWhats",v.comprador_whatsapp?f(v.comprador_whatsapp):"");
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
var payload={valor_venda:val("fvValor"),modelo_texto:val("fvModelo"),lead_id:(fvLeadSel?fvLeadSel.id:""),capacidade:val("fvCapacidade"),cor:val("fvCor"),condicao:val("fvCondicao"),imei:val("fvImei"),comprador_nome:val("fvNome"),comprador_whatsapp:val("fvWhats"),comprador_cpf:val("fvCpf"),comprador_nascimento:val("fvNasc"),comprador_instagram:val("fvInsta"),fornecedor_nome:val("fvFornNome"),fornecedor_contato:val("fvFornContato"),fornecedor_local_retirada:val("fvFornLocal"),custo_aparelho:val("fvCusto"),despesa_frete:val("fvFrete"),despesa_taxas:val("fvTaxas"),tem_trade_in:"sim"===val("fvTradeIn"),entrada_modelo:val("fvEntModelo"),entrada_imei:val("fvEntImei"),entrada_valor:val("fvEntValor"),status:val("fvStatus"),endereco_entrega:val("fvEndereco"),valor_a_cobrar:val("fvCobrar"),motoboy:val("fvMotoboy"),forma_pagamento:val("fvPgto"),data_venda:val("fvData"),nf_numero:val("fvNfNum"),observacoes:val("fvObs")};
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
if(de&&de.ok){I("Venda "+de.venda_code+" corrigida");fecharPainelVenda();n="vendas";B()}
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
fecharPainelVenda();n="vendas";B()}
else I((d&&d.erro)||(r&&r.error&&r.error.message)||"Falha ao arquivar",!0)}
async function desarquivarVenda(id){
if(!window.confirm("Desarquivar esta venda? Ela volta para a lista e volta a contar no faturamento."))return;
var r=await t.rpc("arquivar_venda",{p_id:id,p_arquivar:!1});
var d=r&&r.data;
if(d&&d.ok){I("Venda "+d.venda_code+" desarquivada");n="vendas";B()}
else I((d&&d.erro)||(r&&r.error&&r.error.message)||"Falha ao desarquivar",!0)}
// Roteador dos cliques da aba Vendas, no mesmo padrao do cliAcao.
function vendaAcao(o,id,el){
if("venda-editar"===o){
var v=(vendasData||[]).filter(function(x){return String(x.id)===String(id)})[0];
if(v)abrirPainelVenda(null,v);
return!0}
if("venda-desarquivar"===o){desarquivarVenda(id);return!0}
if("venda-arq-alternar"===o){vendasArqAberto=!vendasArqAberto;renderVendas(E("lista"));return!0}
return!1}

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
var r=await t.from("v_cliente").select("*").order("nome",{ascending:!0});
clientesData=(r&&r.data)||[]}
async function renderClientes(e){
e.innerHTML='<div class="estado carregando">Lendo clientes…</div>';
await carregarClientes();await carregarVendas();
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
var r=await t.from("v_venda_nf").select("*").order("enviado_em",{ascending:!1});
nfsData=(r&&r.data)||[]}
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
async function renderNfs(e){
e.innerHTML='<div class="estado carregando">Lendo notas fiscais…</div>';
await carregarVendas();await carregarNfs();
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
function G(x){M();R();fecharPainelVenda();fecharPainelNf();fecharPainelCliente();if(window.scrollTo)window.scrollTo(0,0);n=x;k()}var CONT_DRAG=null,CONT_DRAG_COL=null;async function moverConteudo(id,para){var card=E("lista").querySelector('.cont-card[data-id="'+id+'"]'),col=E("lista").querySelector('.cont-col[data-col="'+para+'"]');if(card&&col){card.classList.add("movendo");var vz=col.querySelector(".cont-col-vazio");if(vz)vz.parentNode.removeChild(vz);col.appendChild(card)}var r=await t.functions.invoke("mover-conteudo",{body:{id:id,para:para}});if(r.error){I("Falha ao mover: "+(r.error.message||"erro de rede"),!0);if("conteudo"===n)renderConteudo(!0);return}var d=r.data;if(d&&!1!==d.ok){if(d.aviso)I(d.aviso);if("conteudo"===n)renderConteudo(!0)}else{I(d&&d.msg||"Nao consegui mover",!0);if("conteudo"===n)renderConteudo(!0)}}function contLimparAlvo(){[].forEach.call(E("lista").querySelectorAll(".cont-col.alvo"),function(c){c.classList.remove("alvo")})}function contDragStart(e){var card=e.target&&e.target.closest?e.target.closest(".cont-card[draggable]"):null;if(!card)return;CONT_DRAG=card.getAttribute("data-id");CONT_DRAG_COL=card.getAttribute("data-col");card.classList.add("arrastando");if(e.dataTransfer){e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain",CONT_DRAG)}catch(x){}}}function contDragOver(e){if(!CONT_DRAG)return;var col=e.target&&e.target.closest?e.target.closest(".cont-col"):null;if(!col)return;e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect="move";if(!col.classList.contains("alvo")){contLimparAlvo();col.classList.add("alvo")}}function contDrop(e){if(!CONT_DRAG)return;var col=e.target&&e.target.closest?e.target.closest(".cont-col"):null;if(!col)return;e.preventDefault();var id=CONT_DRAG,para=col.getAttribute("data-col"),origem=CONT_DRAG_COL;CONT_DRAG=null;CONT_DRAG_COL=null;contLimparAlvo();if(para&&para!==origem)moverConteudo(id,para)}function contDragEnd(){CONT_DRAG=null;CONT_DRAG_COL=null;contLimparAlvo();[].forEach.call(E("lista").querySelectorAll(".cont-card.arrastando"),function(c){c.classList.remove("arrastando")})}var scriptsData={};async function sugerirMensagem(id,btn,card){var cont=card.querySelector("[data-scripts]");if(!cont)return;if(cont.className.indexOf("aberto")>=0){cont.className="scripts";cont.innerHTML="";return}cont.className="scripts aberto";cont.innerHTML='<div class="script-meta">Buscando script...</div>';if(btn)btn.disabled=!0;var res=await t.rpc("sugerir_mensagem",{p_lead_id:id});if(btn)btn.disabled=!1;if(res.error){cont.innerHTML='<div class="script-meta">Falha: '+c(res.error.message)+"</div>";return}var d=res.data;if(!d||!1===d.ok){cont.innerHTML='<div class="script-meta">'+c(d&&d.msg||"Sem script disponivel")+"</div>";return}var ops=d.opcoes||[];if(!ops.length){cont.innerHTML='<div class="script-meta">Sem opcoes para este passo.</div>';return}var lead=null,j;for(j=0;j<i.length;j++)if(i[j].id===id){lead=i[j];break}scriptsData[id]={whatsapp:d.whatsapp,consent:!(!lead||!0!==lead.consentimento),opcoes:ops};var chips=ops.map(function(o,idx){return'<button class="var-chip" data-acao="variante" data-id="'+c(id)+'" data-idx="'+idx+'" aria-selected="'+(0===idx?"true":"false")+'">'+c(o.rotulo_variante||"Opcao "+(idx+1))+"</button>"}).join("");var rot=d.passo_rotulo?'<div class="script-meta">'+c(d.passo_rotulo)+"</div>":"";cont.innerHTML=rot+'<div class="scripts-vars">'+chips+'</div><div class="script-texto" data-preview></div><div class="script-acoes" data-scriptacoes></div>';pintarVariante(id,card,0)}function pintarVariante(id,card,idx){var data=scriptsData[id];if(!data)return;var op=data.opcoes[idx];if(!op)return;var cont=card.querySelector("[data-scripts]");if(!cont)return;var chips=cont.querySelectorAll(".var-chip"),j;for(j=0;j<chips.length;j++)chips[j].setAttribute("aria-selected",chips[j].getAttribute("data-idx")===String(idx)?"true":"false");var prev=cont.querySelector("[data-preview]");if(prev)prev.textContent=op.texto||"";var acoes=cont.querySelector("[data-scriptacoes]");if(!acoes)return;var dig=String(data.whatsapp||"").replace(/\D/g,"");var wa=dig&&data.consent?'<a class="btn-wa" target="_blank" rel="noopener" href="https://wa.me/'+c(dig)+"?text="+encodeURIComponent(op.texto||"")+'">Enviar no WhatsApp</a>':dig?'<div class="sem-tel">Sem consentimento</div>':'<div class="sem-tel">Sem telefone</div>';acoes.innerHTML=wa+'<button class="btn-copiar" data-acao="copiar-script" data-id="'+c(id)+'">Copiar</button>'}function copiarScript(id,btn){var card=btn&&btn.closest?btn.closest(".card"):null;if(!card)return;var cont=card.querySelector("[data-scripts]");if(!cont)return;var prev=cont.querySelector("[data-preview]"),txt=prev?prev.textContent:"";if(!txt){I("Nada para copiar",!0);return}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(function(){I("Script copiado")},function(){copiarFallback(txt)});else copiarFallback(txt)}function copiarFallback(txt){try{var ta=document.createElement("textarea");ta.value=txt;ta.setAttribute("readonly","");ta.style.position="absolute";ta.style.left="-9999px";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);I("Script copiado")}catch(e){I("Nao consegui copiar",!0)}}function A(a){var e=a.target&&a.target.closest?a.target.closest("[data-acao]"):null;if(e){var o=e.getAttribute("data-acao"),t=e.getAttribute("data-id"),n=e.closest(".card");if("cap-registrar"===o)return void registrarCaptacao(e);if("cap-mais"===o)return void alternarCapDet(e);if("cap-parar"===o)return void pararCaptacao(t,e);if("dia-marcar"===o)return void qF("marcar_tarefa",{p_tarefa_id:t,p_concluida:"true"!==e.getAttribute("aria-checked")},e,renderHoje);if("dia-remover"===o)return void(window.confirm("Remover esta tarefa do dia? Ela não volta ao puxar o molde de novo.")&&qF("remover_tarefa",{p_tarefa_id:t},e,renderHoje));if("dia-add"===o){var dv=E("diaNovoTit"),dc=E("diaNovaCat");return dv&&String(dv.value).trim()?void qF("adicionar_tarefa",{p_titulo:dv.value,p_categoria:dc?dc.value:""},e,renderHoje):void I("Digite o título da tarefa",!0)}if("dia-nota-ok"===o){var dn=E("diaNota");return void qF("salvar_nota",{p_texto:dn?dn.value:""},e,null)}if("dia-puxar"===o)return void qF("puxar_rotina",{},e,renderHoje);if("lemb-marcar"===o)return void qF("marcar_lembrete",{p_lembrete_id:t,p_feito:"true"!==e.getAttribute("aria-checked")},e,renderHoje);if("lemb-remover"===o)return void(window.confirm("Remover este lembrete?")&&qF("remover_lembrete",{p_lembrete_id:t},e,renderHoje));if("lemb-add"===o){var lv=E("lembNovo"),ld=E("lembData");return lv&&String(lv.value).trim()?void qF("salvar_lembrete",{p_texto:lv.value,p_data:ld&&ld.value?ld.value:null},e,renderHoje):void I("Digite o lembrete",!0)}if("lemb-hoje"===o){if(E("lembData"))E("lembData").value=l();return}if("lemb-amanha"===o){if(E("lembData"))E("lembData").value=C(l(),1);return}if("hoje-verfila"===o){if(E("abaFila"))E("abaFila").click();return}if("hoje-sugerir"===o)return void sugerirMensagem(t,e,e.closest(".fila-lin"));if("cont-mover"===o){var mw=e.parentNode,mab="true"===e.getAttribute("aria-expanded");mw.className="cont-mover-wrap"+(mab?"":" aberto");e.setAttribute("aria-expanded",mab?"false":"true");return}if("cont-mover-para"===o)return void moverConteudo(t,e.getAttribute("data-col"));if("cont-aferir"===o){var mb=e.closest(".cont-met");if(mb){var maf=mb.className.indexOf("aberto")>=0;mb.className="cont-met"+(maf?"":" aberto");if(!maf){var mi=mb.querySelector('input[data-af="alcance"]');if(mi)mi.focus()}}return}if("cont-aferir-cancel"===o){var mcx=e.closest(".cont-met");if(mcx)mcx.className="cont-met";return}if("cont-aferir-ok"===o)return void salvarAfericao(t,e);if("cont-publiquei"===o)return void marcarPublicado(t,e);if("met-janela"===o){METRICA_DIAS=parseInt(e.getAttribute("data-dias"),10)||90;renderDash();return}if("cont-descartado"===o){var cd=e.parentNode,ab="true"===e.getAttribute("aria-expanded");cd.className="cont-desc"+(ab?"":" aberto");e.setAttribute("aria-expanded",ab?"false":"true");return}if("respondeu"===o)return void q("registrar_resposta",{p_lead_id:t},e,"Resposta registrada");if(cliAcao(o,t,e))return;if(vendaAcao(o,t,e))return;if("nova-venda"===o)return void abrirPainelVenda();if("nf-anexar"===o)return void abrirPainelNf(t);if("nf-abrir"===o)return void abrirArquivoNf(t);if("nf-remover"===o)return void removerNf(t);if("nf-seg"===o){nfSeg=e.getAttribute("data-seg")||"com";return void renderNfs(E("lista"))}if("sync-agora"===o)return void sincronizarAgora(e);if("esc-criar"===o){var fcod=a.getAttribute("data-frente"),cx=E("escNovo_"+fcod);if(!cx||!cx.value.trim())return void I("Escreva a ação primeiro.",!0);return void q("criar_acao_escopo",{p_frente:fcod,p_titulo:cx.value},a)}if("esc-status"===o){var st=a.getAttribute("data-st"),prox="a_fazer"===st?"fazendo":"fazendo"===st?"feito":"feito"===st?"a_fazer":"a_fazer";return void q("mudar_status_acao_escopo",{p_id:a.getAttribute("data-id"),p_status:prox,p_motivo:null},a)}if("esc-travar"===o){var sa=a.getAttribute("data-st"),mt=null;if("travado"===sa)return void q("mudar_status_acao_escopo",{p_id:a.getAttribute("data-id"),p_status:"fazendo",p_motivo:null},a);if(!(mt=prompt("O que está travando?")))return;return void q("mudar_status_acao_escopo",{p_id:a.getAttribute("data-id"),p_status:"travado",p_motivo:mt},a)}if("esc-desc"===o)return void q("descartar_acao_escopo",{p_id:a.getAttribute("data-id")},a);if("rot-dia"===o)return void e.setAttribute("aria-pressed","true"===e.getAttribute("aria-pressed")?"false":"true");if("rot-add-tarefa"===o){var rv=E("rotNovoTit"),rc=E("rotNovaCat");if(!rv||!String(rv.value).trim())return void I("Digite o título da tarefa",!0);var ds=[].map.call(E("lista").querySelectorAll('[data-acao="rot-dia"][aria-pressed="true"]'),function(x){return parseInt(x.getAttribute("data-dia"),10)});return void qF("salvar_rotina_tarefa",{p_titulo:rv.value,p_categoria:rc?rc.value:"",p_dias_semana:ds.length&&ds.length<7?ds:null},e,renderRotina)}if("rot-rm-tarefa"===o)return void(window.confirm("Remover esta tarefa do molde? O que já virou dia fica como está.")&&qF("remover_rotina_tarefa",{p_id:t},e,renderRotina));if("rot-add-cat"===o){var cv=E("rotNovaCatRot");if(!cv||!String(cv.value).trim())return void I("Digite o nome da categoria",!0);var cod=rotSlug(cv.value);return cod?void qF("salvar_rotina_categoria",{p_codigo:cod,p_rotulo:cv.value.trim()},e,renderRotina):void I("Nome inválido",!0)}if(t&&n){if("sugerir"===o)return void sugerirMensagem(t,e,n);if("historico"===o)return void abrirHistorico(t,e,n);if("nota"===o)return void alternarNota(n);if("nota-ok"===o)return void registrarNota(t,e,n);if("variante"===o)return void pintarVariante(t,n,parseInt(e.getAttribute("data-idx"),10)||0);if("copiar-script"===o)return void copiarScript(t,e)}if(t&&n)if("editar"!==o)if("leque"!==o)if("retomar"!==o)if("toque"!==o)if("conversando"!==o)if("fechou"!==o)if("sem-interesse"!==o){if("retomar-ok"===o){var r=n.querySelector(".retomar input"),c=r?r.value:"";return c?void q("reagendar_proximo_contato",{p_lead_id:t,p_data:c},e,"Reagendado"):void I("Escolha a data de retomada",!0)}}else q("registrar_desfecho",{p_lead_id:t,p_tipo:"sem_interesse"},e,"Marcado sem interesse");else fecharComVenda(t);else q("registrar_conversando",{p_lead_id:t},e,"Conversa registrada");else q("registrar_toque",{p_lead_id:t},e,"Toque registrado");else{var d=n.querySelector(".retomar");d&&(d.className="retomar"+(d.className.indexOf("aberto")>=0?"":" aberto"))}else{var s=n.querySelector(".desfechos");s&&(s.className="desfechos"+(s.className.indexOf("aberto")>=0?"":" aberto"))}else!function(a){for(var e=null,o=0;o<i.length;o++)if(i[o].id===a){e=i[o];break}if(!e)return void I("Lead nao encontrado na base carregada",!0);H=a,E("edCondicao").innerHTML=T("condicao","Escolha a condicao"),E("edPerfil").innerHTML=T("perfil","Escolha o perfil"),E("edOrigem").innerHTML=T("origem","Escolha a origem"),E("edTitulo").textContent="Editar "+(e.lead_code||"lead"),E("edNome").value=e.nome||"",E("edWhats").value=e.whatsapp_digitos||"",E("edProduto").value=e.produto||"",E("edCondicao").value=e.condicao||"",E("edPerfil").value=e.perfil||"",E("edOrigem").value=e.origem||"",E("edIndicado").value=e.indicado_por||"",E("edNasc").value=e.data_nascimento||"",E("edProx").value=e.proximo_contato||"",E("edValor").value=function(a){if(null==a||""===a)return"";var e=Number(a);return isNaN(e)?"":String(e)}(e.valor_oferta),E("edObs").value=e.observacoes||"",E("edUpgrade").value=!0===e.upgrade_entrada?"sim":!1===e.upgrade_entrada?"nao":"",E("edAparelho").value=e.aparelho_entrada||"",E("edErro").textContent="",J(),M(),E("painelEdicao").className="painel-cadastro",E("painelEdicao").scrollIntoView({behavior:"smooth",block:"start"}),E("edNome").focus()}(t)}}function T(a,e){var t=o[a]||{},i='<option value="">'+c(e)+"</option>";return Object.keys(t).forEach(function(a){i+='<option value="'+c(a)+'">'+c(t[a])+"</option>"}),i}function P(){E("cadCondicao").innerHTML=T("condicao","Escolha a condicao"),E("cadPerfil").innerHTML=T("perfil","Escolha o perfil"),E("cadOrigem").innerHTML=T("origem","Escolha a origem"),["cadNome","cadWhats","cadProduto","cadIndicado","cadObs","cadAparelho"].forEach(function(a){E(a).value=""}),["cadCondicao","cadPerfil","cadOrigem","cadUpgrade"].forEach(function(a){E(a).value=""}),E("cadConsent").value="sim",E("campoIndicado").className="campo oculto",E("cadErro").textContent="",E("cadDup").className="cad-dup",D=null,E("painelCadastro").className="painel-cadastro",E("cadNome").focus()}function M(){E("painelCadastro").className="painel-cadastro oculto"}function y(){var a=E("cadUpgrade").value;return{nome:E("cadNome").value,whatsapp:E("cadWhats").value,produto:E("cadProduto").value,condicao:E("cadCondicao").value,perfil:E("cadPerfil").value,origem:E("cadOrigem").value,indicado_por:E("cadIndicado").value,observacoes:E("cadObs").value,upgrade_entrada:"sim"===a||"nao"!==a&&null,aparelho_entrada:E("cadAparelho").value,consentimento:"nao"!==E("cadConsent").value}}var D=null;async function F(){var a=E("cadErro");a.textContent="",E("cadDup").className="cad-dup",D=null;var e=y(),o=w(e);if(o.ok){var t=E("btnCadastrar"),i=await O("cadastrar_lead",{p_nome:e.nome,p_whatsapp:e.whatsapp,p_produto:e.produto,p_condicao:e.condicao,p_perfil:e.perfil,p_origem:e.origem,p_indicado_por:e.indicado_por||null,p_observacoes:e.observacoes||null,p_upgrade_entrada:e.upgrade_entrada,p_aparelho_entrada:e.aparelho_entrada||null,p_consentimento:e.consentimento},t);if(i)return!1===i.ok&&i.duplicado?(D=i.existente||null,E("cadDupMsg").textContent=i.msg||"Ja existe um lead com esse WhatsApp.",void(E("cadDup").className="cad-dup visivel")):void(!1!==i.ok?(I(i.msg||"Lead cadastrado"),M(),B()):a.textContent=i.msg||"Cadastro recusado")}else a.textContent=o.msg}function W(){M(),n="todos",E("inputBusca").value=D&&D.nome||E("cadWhats").value,k()}function j(){var a="indicacao"===E("cadOrigem").value;E("campoIndicado").className="campo"+(a?"":" oculto")}var H=null;function J(){var a="indicacao"===E("edOrigem").value;E("campoEdIndicado").className="campo"+(a?"":" oculto")}function R(){E("painelEdicao").className="painel-cadastro oculto",H=null}async function z(){var a=E("edErro");if(a.textContent="",H){var e,o,t=(e=E("edUpgrade").value,o=String(E("edValor").value||"").trim(),{nome:E("edNome").value,whatsapp:E("edWhats").value,produto:E("edProduto").value,condicao:E("edCondicao").value,perfil:E("edPerfil").value,origem:E("edOrigem").value,indicado_por:E("edIndicado").value,data_nascimento:E("edNasc").value||null,proximo_contato:E("edProx").value||null,valor_oferta:""===o?null:Number(o),observacoes:E("edObs").value,upgrade_entrada:"sim"===e||"nao"!==e&&null,aparelho_entrada:E("edAparelho").value}),i=S(t);if(i.ok){var n=E("btnSalvarEdicao"),r=await O("editar_lead",{p_lead_id:H,p_nome:t.nome,p_whatsapp:t.whatsapp||null,p_produto:t.produto,p_condicao:t.condicao,p_perfil:t.perfil,p_origem:t.origem,p_indicado_por:t.indicado_por||null,p_observacoes:t.observacoes||null,p_aparelho_entrada:t.aparelho_entrada||null,p_upgrade_entrada:t.upgrade_entrada,p_valor_oferta:t.valor_oferta,p_proximo_contato:t.proximo_contato,p_data_nascimento:t.data_nascimento},n);r&&(!1!==r.ok?(I(r.msg||"Lead atualizado"),R(),B()):a.textContent=r.msg||"Edicao recusada")}else a.textContent=i.msg}else a.textContent="Sem lead selecionado"}async function V(){if(H&&window.confirm("Arquivar este lead? Ele sai da operacao mas o historico fica no banco.")){var a=E("btnArquivar"),e=await O("arquivar_lead",{p_lead_id:H,p_motivo:null},a);e&&(!1!==e.ok?(I(e.msg||"Lead arquivado"),R(),B()):E("edErro").textContent=e.msg||"Arquivamento recusado")}}async function B(){E("lista").innerHTML='<div class="estado carregando">Lendo a base…</div>';var a=await t.from("dicionario_rotulos").select("dominio,codigo,rotulo");!a.error&&a.data&&d(a.data);var e=await t.from("v_lead").select("*").order("proximo_contato",{ascending:!0,nullsFirst:!1});if(e.error){if(await pwSemSessao())return pwSessaoCaiu();E("lista").innerHTML='<div class="estado erro">Falha ao ler a base: '+c(e.error.message)+". Toque em Atualizar para tentar de novo.</div>"}else{i=e.data||[];var o=new Date;r=("0"+o.getHours()).slice(-2)+":"+("0"+o.getMinutes()).slice(-2),function(a){var e=i.filter(function(a){return!a.arquivado_em}),o=v(e,a),t=o.filter(function(e){return p(e.proximo_contato,a)>0}),n=e.filter(function(a){return"pendente"===a.status});E("pbFila").textContent=String(o.length),E("badgeFila")&&(E("badgeFila").textContent=o.length?String(o.length):"");var r=E("pbAtraso");r.textContent=String(t.length),r.className="pb-num"+(t.length?" alerta":""),E("pbAtivos").textContent=String(n.length),E("pbTotal").textContent=String(e.length)}(l()),k()}}function U(a){E("telaLogin").className="login"+(a?" oculto":""),E("telaApp").className="app"+(a?"":" oculto")}var pwSaindo=!1;function pwSessaoCaiu(){i=[],U(!1);var a=E("loginErro");a&&(a.textContent="Sua sessao expirou. Entre de novo.")}async function pwSemSessao(){try{var a=await t.auth.getSession();return!(a&&a.data&&a.data.session)}catch(a){return!1}}async function Z(){var a=E("btnEntrar"),e=E("loginErro");e.textContent="",a.disabled=!0,a.textContent="Entrando…";var o=await t.auth.signInWithPassword({email:E("email").value.trim(),password:E("senha").value});a.disabled=!1,a.textContent="Entrar",o.error?e.textContent="Nao entrou: confira email e senha.":(pwSaindo=!1,U(!0),B())}async function X(){pwSaindo=!0,await t.auth.signOut(),i=[],U(!1)}function Y(a,e,o){var t=E(a);t?t.addEventListener(e,o):window.console&&console.warn("PitWall: elemento #"+a+" ausente; listener ignorado")}return{esc:c,setRotulos:d,rotulo:s,hojeLocalISO:l,dataLocalDe:u,diasAtraso:p,entraNaFila:m,montarFila:v,filtrarBusca:g,filtrarIndicacoes:_,fmtTel:f,waHrefFila:b,waHrefLimpo:h,cardHTML:x,renderLista:N,diaMaisISO:C,validarCadastro:w,validarEdicao:S,coletarCadastro:y,abrirCadastro:P,init:function(){t=window.supabase.createClient(a,e),t.auth.onAuthStateChange(function(evt,ses){"SIGNED_IN"===evt&&ses?pwSaindo=!1:"SIGNED_OUT"===evt&&(pwSaindo?pwSaindo=!1:pwSessaoCaiu())}),window.addEventListener("error",function(a){try{I("Erro: "+(a&&a.message?a.message:"falha inesperada"),!0)}catch(a){}}),window.addEventListener("unhandledrejection",function(a){var e=a&&a.reason?a.reason.message||String(a.reason):"promessa rejeitada";try{I("Erro: "+e,!0)}catch(a){}}),Y("btnEntrar","click",Z),Y("senha","keydown",function(a){"Enter"===a.key&&Z()}),Y("btnSair","click",X),Y("btnAtualizar","click",B),Y("abaFila","click",function(){G("fila")}),Y("abaTodos","click",function(){G("todos")}),Y("abaVendas","click",function(){G("vendas")}),Y("abaNfs","click",function(){G("nfs")}),Y("btnSalvarNf","click",salvarNfPainel),Y("btnFecharNf","click",fecharPainelNf),Y("btnSalvarCliente","click",salvarCliente),Y("btnCancelarCliente","click",fecharPainelCliente),Y("nfLista","click",nfListaClick),Y("btnSalvarVenda","click",salvarVenda),Y("btnCancelarVenda","click",fecharPainelVenda),Y("fvValor","input",calcLucroVenda),Y("fvCusto","input",calcLucroVenda),Y("fvFrete","input",calcLucroVenda),Y("fvTaxas","input",calcLucroVenda),Y("fvClienteBusca","input",buscaClienteVenda),Y("painelVenda","click",fvCliClick),Y("abaClientes","click",function(){G("clientes")}),Y("abaIndicacoes","click",function(){G("indicacoes")}),Y("abaDash","click",function(){G("dashboard")}),Y("abaCaptacao","click",function(){G("captacao")}),Y("abaHoje","click",function(){G("hoje")}),Y("abaConteudo","click",function(){G("conteudo")}),Y("abaRotina","click",function(){G("rotina")}),Y("abaEscopo","click",function(){G("escopo")}),Y("abaMais","click",function(){var a=E("abas");if(a){var b=a.className.indexOf("mais-aberto")>=0;a.className="abas"+(b?"":" mais-aberto"),E("abaMais").setAttribute("aria-expanded",b?"false":"true")}}),Y("lista","keydown",capKeydown),Y("inputBusca","input",k),Y("lista","click",A),Y("lista","dragstart",contDragStart),Y("lista","dragover",contDragOver),Y("lista","drop",contDrop),Y("lista","dragend",contDragEnd),Y("btnNovoLead","click",P),Y("btnCancelarCadastro","click",M),Y("btnCadastrar","click",F),Y("btnAbrirExistente","click",W),Y("cadOrigem","change",j),Y("btnSalvarEdicao","click",z),Y("btnCancelarEdicao","click",R),Y("btnArquivar","click",V),Y("edOrigem","change",J),t.auth.getSession().then(function(a){var e=!(!a.data||!a.data.session);U(e),e&&B()})},_setLeads:function(a){i=a}}}(),window.__PITWALL_SEM_INIT||("loading"===document.readyState?document.addEventListener("DOMContentLoaded",function(){window.PitWall.init()}):window.PitWall.init())
