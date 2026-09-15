from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
app = raiz / "public" / "app.js"
css = raiz / "public" / "app.css"
src = app.read_text(encoding="utf-8")
css_src = css.read_text(encoding="utf-8")

if "fila-fluxo" in src and "HOJE / FILA — hierarquia de acoes" in css_src:
    print("PATCH_HOJE_FILA_JA_APLICADO")
    raise SystemExit(0)

antigo_resultado = '''function filaResultadoHTML(a,hj){if(!a||!a.id||!podeAbordar(a))return"";var g=c(a.id);return'<div class="card-acoes"><span class="acoes-escrita"><button class="btn-acao toque" data-acao="toque" data-id="'+g+'">Toque enviado</button><button class="btn-acao" data-acao="leque" data-id="'+g+'">Desfecho</button></span></div><div class="desfechos"><button class="btn-desf respondeu" data-acao="respondeu" data-id="'+g+'">Respondeu</button><button class="btn-desf" data-acao="conversando" data-id="'+g+'">Conversando</button><button class="btn-desf" data-acao="retomar" data-id="'+g+'">Retomar</button><button class="btn-desf ok" data-acao="fechou" data-id="'+g+'">Fechou</button><button class="btn-desf frio" data-acao="sem-interesse" data-id="'+g+'">Sem interesse</button></div><div class="retomar"><input type="date" value="'+c(C(hj,1))+'" aria-label="Retomar em"><button class="btn-desf" data-acao="retomar-ok" data-id="'+g+'">Confirmar</button></div>'}'''
novo_resultado = '''function filaResultadoHTML(a,hj){if(!a||!a.id||!podeAbordar(a))return"";var g=c(a.id);return'<div class="fila-fluxo"><button class="btn-acao sugerir fila-sug fila-msg" data-acao="hoje-sugerir" data-id="'+g+'">Preparar mensagem</button><span class="fila-registro"><button class="btn-acao toque fila-toque" data-acao="toque" data-id="'+g+'">Toque enviado</button><button class="btn-acao fila-reg-btn" data-acao="leque" data-id="'+g+'" aria-expanded="false">Registrar resultado</button></span></div><div class="scripts" data-scripts></div><div class="desfechos fila-desfechos"><div class="fila-desfecho-tit">O que aconteceu?</div><button class="btn-desf respondeu" data-acao="respondeu" data-id="'+g+'">Respondeu</button><button class="btn-desf" data-acao="conversando" data-id="'+g+'">Conversando</button><button class="btn-desf" data-acao="retomar" data-id="'+g+'">Retomar</button><button class="btn-desf ok" data-acao="fechou" data-id="'+g+'">Fechou</button><button class="btn-desf frio" data-acao="sem-interesse" data-id="'+g+'">Sem interesse</button></div><div class="retomar"><input type="date" value="'+c(C(hj,1))+'" aria-label="Retomar em"><button class="btn-desf" data-acao="retomar-ok" data-id="'+g+'">Confirmar</button></div>'}'''
if src.count(antigo_resultado) != 1:
    raise RuntimeError(f"filaResultadoHTML esperado 1 vez, encontrado {src.count(antigo_resultado)}")
src = src.replace(antigo_resultado, novo_resultado, 1)

antigo_hoje = '''function hojeFilaLin(a){var nv=a.nivel||"quente",hj=l(),atr=p(a.proximo_contato,hj),prod=c(a.produto||"")+(a.condicao?" · "+c(s("condicao",a.condicao)):"sem produto");return'<div class="fila-lin" data-lead="'+c(a.lead_code||"")+'"><div class="fila-lin-topo"><div class="fila-ident">'+nivelPonto(nv)+'<span class="fila-nome">'+c(a.nome||"")+'</span><span class="fila-nivel n-'+c(nv)+'">'+c(s("nivel",nv))+'</span></div>'+fxVerChip(a,atr,!0)+'<button class="btn-acao sugerir fila-sug" data-acao="hoje-sugerir" data-id="'+c(a.id)+'">Sugerir</button>'+filaEnviarHTML(a)+'</div><div class="fila-contexto"><span>'+prod+'</span><span>'+(a.perfil?c(s("perfil",a.perfil)):"sem perfil")+"</span></div>"+fxOperacao(a,hj,atr)+fxMotivo(a,!0)+'<div class="scripts" data-scripts></div>'+filaResultadoHTML(a,hj)+'</div>'}'''
novo_hoje = '''function hojeFilaLin(a){var nv=a.nivel||"quente",hj=l(),atr=p(a.proximo_contato,hj),prod=c(a.produto||"")+(a.condicao?" · "+c(s("condicao",a.condicao)):"sem produto");return'<div class="fila-lin" data-lead="'+c(a.lead_code||"")+'"><div class="fila-lin-topo"><div class="fila-ident">'+nivelPonto(nv)+'<span class="fila-nome">'+c(a.nome||"")+'</span><span class="fila-nivel n-'+c(nv)+'">'+c(s("nivel",nv))+'</span></div>'+fxVerChip(a,atr,!0)+'</div><div class="fila-contexto"><span>'+prod+'</span><span>'+(a.perfil?c(s("perfil",a.perfil)):"sem perfil")+"</span></div>"+fxOperacao(a,hj,atr)+fxMotivo(a,!0)+filaResultadoHTML(a,hj)+'</div>'}'''
if src.count(antigo_hoje) != 1:
    raise RuntimeError(f"hojeFilaLin esperado 1 vez, encontrado {src.count(antigo_hoje)}")
src = src.replace(antigo_hoje, novo_hoje, 1)

antigo_leque = '''else{var s=n.querySelector(".desfechos");s&&(s.className="desfechos"+(s.className.indexOf("aberto")>=0?"":" aberto"))}'''
novo_leque = '''else{var s=n.querySelector(".desfechos");if(s){var aberto=s.classList.contains("aberto");s.classList.toggle("aberto",!aberto),e.setAttribute("aria-expanded",aberto?"false":"true")}}'''
if src.count(antigo_leque) != 1:
    raise RuntimeError(f"toggle leque esperado 1 vez, encontrado {src.count(antigo_leque)}")
src = src.replace(antigo_leque, novo_leque, 1)

css_bloco = r'''

/* HOJE / FILA — hierarquia de acoes.
   A linha normal mostra uma acao de contato e dois registros compactos.
   Os cinco desfechos so aparecem quando o operador pede para registrar o resultado. */
#lista[data-aba="hoje"] .fila-lin{padding:11px 0}
#lista[data-aba="hoje"] .fila-lin-topo{min-height:24px}
#lista[data-aba="hoje"] .fila-lin-topo>.chip{margin-left:auto}
.fila-fluxo{
  display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:10px;
  border-top:1px solid var(--line);
}
.fila-fluxo .fila-msg{
  flex:0 0 auto;min-width:142px;padding:7px 12px;font-size:12px;font-weight:600;
}
.fila-registro{display:flex;align-items:center;gap:5px;margin-left:auto}
.fila-registro .btn-acao{
  flex:0 0 auto;width:auto;padding:6px 9px;font-size:11.5px;line-height:1.2;
}
.fila-registro .fila-toque{
  background:transparent;border-color:transparent;color:var(--dim);
}
.fila-registro .fila-toque:hover{background:var(--surface);color:var(--accent)}
.fila-registro .fila-reg-btn{background:var(--bg);color:var(--dim)}
.fila-registro .fila-reg-btn[aria-expanded="true"]{
  background:var(--accent-tint);border-color:var(--accent-linha);color:var(--accent);
}
.fila-lin>.scripts{margin-top:8px}
.fila-lin>.desfechos{
  display:none;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;
  margin-top:8px;padding:10px;background:var(--surface);border:1px solid var(--line);
  border-radius:var(--radius-p);
}
.fila-lin>.desfechos.aberto{display:grid}
.fila-lin>.desfechos .fila-desfecho-tit{
  grid-column:1 / -1;font-family:var(--mono);font-size:9px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--dim);margin-bottom:1px;
}
.fila-lin>.desfechos .btn-desf{background:var(--bg)}
.fila-lin>.retomar.aberto{margin-top:7px}

@media (max-width:560px){
  .fila-fluxo{align-items:stretch;flex-direction:column}
  .fila-fluxo .fila-msg{width:100%}
  .fila-registro{width:100%;margin-left:0}
  .fila-registro .btn-acao{flex:1 1 0}
  .fila-lin>.desfechos{grid-template-columns:repeat(2,minmax(0,1fr))}
  .fila-lin>.desfechos .btn-desf:last-child{grid-column:1 / -1}
}
'''
if "HOJE / FILA — hierarquia de acoes" not in css_src:
    css_src += css_bloco

app.write_text(src, encoding="utf-8")
css.write_text(css_src, encoding="utf-8")
print("PATCH_HOJE_FILA_OK")
