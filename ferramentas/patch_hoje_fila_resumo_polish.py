from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
app = raiz / "public" / "app.js"
css = raiz / "public" / "app.css"

src = app.read_text(encoding="utf-8")
style = css.read_text(encoding="utf-8")

if "fila-recorte-resumo" in src or ".fila-recorte-resumo" in style:
    print("PATCH_HOJE_FILA_RESUMO_JA_APLICADO")
    raise SystemExit(0)

# app.js: substitui somente as duas funcoes de composicao visual da fila na Hoje.
ini = src.index("function filaRecorte(a,e){")
fim = src.index("function g(a,e){", ini)
novo_recorte = '''function filaRecorte(a,e){var ps=(a||[]).filter(function(x){return"convertido"===x.status}).length,cs=(a||[]).length-ps,tt=(a||[]).length,d=String(e).slice(8,10)+"/"+String(e).slice(5,7),fora=filaForaTexto(i,e);return'<div class="fila-recorte" role="note"><div class="fila-recorte-resumo"><span class="fila-recorte-tit">Fila unificada</span><span class="fila-recorte-total">'+tt+' item'+(1===tt?"":"s")+'</span><span class="fila-recorte-com">'+cs+(1===cs?" comercial":" comerciais")+'</span><span class="fila-recorte-cont">'+ps+' de pós-venda</span><span class="fila-recorte-fora">'+c(fora)+'</span></div><div class="fila-recorte-jan">pós-venda com passo vencendo até '+c(d)+"</div></div>"}'''
src = src[:ini] + novo_recorte + src[fim:]

ini = src.index("function hojeFila(d){")
fim = src.index("function hojeLembretes(d){", ini)
novo_hoje = '''function hojeFila(d){var ativos=(i||[]).filter(function(x){return!x.arquivado_em}),fila=vOperacional(ativos,l()),recorte=filaRecorte(fila,l());if(!fila.length)return'<div class="dia-sec"><div class="dia-sec-cab fila-hoje-cab"><div class="dia-sec-tit">Fila de hoje</div></div>'+recorte+'<div class="dia-vazio">Fila zerada hoje. Nada vencendo.</div></div>';var top=fila.slice(0,5).map(hojeFilaLin).join("");return'<div class="dia-sec"><div class="dia-sec-cab fila-hoje-cab"><div class="dia-sec-tit">Fila de hoje</div><button class="fila-vertodos" data-acao="hoje-verfila" aria-label="Ver todos os '+fila.length+' itens da fila">ver todos</button></div>'+recorte+top+"</div>"}'''
src = src[:ini] + novo_hoje + src[fim:]

# app.css: troca apenas o bloco de estilo do resumo da fila unificada.
css_ini = style.index(".fila-recorte{")
css_fim = style.index(".pos-cab{", css_ini)
novo_css = '''.fila-hoje-cab{margin-bottom:8px;align-items:center}\n.fila-hoje-cab .fila-vertodos{margin-left:auto}\n.fila-recorte{\n  display:flex;flex-direction:column;align-items:stretch;gap:6px;\n  padding:0 0 10px;border-bottom:1px solid var(--line);color:var(--dim)\n}\n.fila-recorte-resumo{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}\n.fila-recorte-tit{\n  font-family:var(--display);font-size:11.5px;font-weight:600;color:var(--dim);margin-right:2px\n}\n.fila-recorte-total,.fila-recorte-com,.fila-recorte-cont{\n  font-family:var(--mono);font-size:10.5px;padding:2px 7px;border-radius:999px;\n  color:var(--text);background:var(--surface);border:1px solid var(--line-forte);white-space:nowrap\n}\n.fila-recorte-total{font-weight:600}\n.fila-recorte-fora{\n  font-family:var(--mono);font-size:10.5px;padding:2px 7px;border-radius:999px;\n  color:var(--dim);background:var(--bg);border:1px dashed var(--line-forte);white-space:nowrap\n}\n.fila-recorte-jan{font-size:11.5px;min-width:0;color:var(--dim)}\n'''
style = style[:css_ini] + novo_css + style[css_fim:]

app.write_text(src, encoding="utf-8")
css.write_text(style, encoding="utf-8")
print("PATCH_HOJE_FILA_RESUMO_OK")
