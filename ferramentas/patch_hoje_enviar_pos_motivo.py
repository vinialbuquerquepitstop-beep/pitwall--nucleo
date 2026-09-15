from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
app = raiz / 'public' / 'app.js'
css = raiz / 'public' / 'app.css'
prova = raiz / 'ferramentas' / 'prova_hoje_fila_harmonia.js'

s = app.read_text(encoding='utf-8')
c = css.read_text(encoding='utf-8')
p = prova.read_text(encoding='utf-8')

old = '''function hojeFilaLin(a){var nv=a.nivel||"quente",hj=l(),atr=p(a.proximo_contato,hj),prod=c(a.produto||"")+(a.condicao?" · "+c(s("condicao",a.condicao)):"sem produto");return'<div class="fila-lin" data-lead="'+c(a.lead_code||"")+'"><div class="fila-lin-topo"><div class="fila-ident"><span class="fila-ident-main">'+nivelPonto(nv)+'<span class="fila-nome">'+c(a.nome||"")+'</span><span class="fila-nivel n-'+c(nv)+'">'+c(s("nivel",nv))+'</span></span><button class="btn-acao sugerir fila-sug fila-msg" data-acao="hoje-sugerir" data-id="'+c(a.id)+'">Enviar mensagem</button></div>'+fxVerChip(a,atr,!0)+'</div><div class="fila-contexto"><span>'+prod+'</span><span>'+(a.perfil?c(s("perfil",a.perfil)):"sem perfil")+"</span></div>"+fxOperacao(a,hj,atr)+fxMotivo(a,!0)+filaResultadoHTML(a,hj)+'</div>'}'''
new = '''function hojeFilaLin(a){var nv=a.nivel||"quente",hj=l(),atr=p(a.proximo_contato,hj),prod=c(a.produto||"")+(a.condicao?" · "+c(s("condicao",a.condicao)):"sem produto");return'<div class="fila-lin" data-lead="'+c(a.lead_code||"")+'"><div class="fila-lin-topo"><div class="fila-ident">'+nivelPonto(nv)+'<span class="fila-nome">'+c(a.nome||"")+'</span><span class="fila-nivel n-'+c(nv)+'">'+c(s("nivel",nv))+'</span></div>'+fxVerChip(a,atr,!0)+'</div><div class="fila-contexto"><span>'+prod+'</span><span>'+(a.perfil?c(s("perfil",a.perfil)):"sem perfil")+"</span></div>"+fxOperacao(a,hj,atr)+fxMotivo(a,!0)+'<div class="fila-mensagem-linha"><button class="btn-acao sugerir fila-sug fila-msg" data-acao="hoje-sugerir" data-id="'+c(a.id)+'">Enviar mensagem</button></div>'+filaResultadoHTML(a,hj)+'</div>'}'''
if s.count(old) != 1:
    raise RuntimeError(f'hojeFilaLin esperado 1 vez, encontrado {s.count(old)}')
s = s.replace(old, new, 1)

old_css = '''.fila-ident{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0;flex:1 1 170px;overflow:hidden}\n.fila-ident-main{display:flex;align-items:center;gap:7px;min-width:0;max-width:100%}\n#lista[data-aba="hoje"] .fila-ident>.fila-msg{margin-left:0;align-self:flex-start;flex:0 0 auto;min-width:142px;width:auto;padding:7px 12px;font-size:12px;font-weight:600}'''
new_css = '''.fila-ident{display:flex;align-items:center;gap:7px;min-width:0;flex:1 1 170px;overflow:hidden}\n#lista[data-aba="hoje"] .fila-mensagem-linha{display:flex;justify-content:flex-start;margin-top:8px}\n#lista[data-aba="hoje"] .fila-mensagem-linha>.fila-msg{margin-left:0;flex:0 0 auto;min-width:142px;width:auto;padding:7px 12px;font-size:12px;font-weight:600}'''
if c.count(old_css) != 1:
    raise RuntimeError(f'bloco CSS identidade esperado 1 vez, encontrado {c.count(old_css)}')
c = c.replace(old_css, new_css, 1)

old_mobile = '  #lista[data-aba="hoje"] .fila-ident>.fila-msg{margin-left:0;align-self:flex-start;width:auto;min-width:0}\n'
new_mobile = '  #lista[data-aba="hoje"] .fila-mensagem-linha>.fila-msg{margin-left:0;width:auto;min-width:0}\n'
if c.count(old_mobile) != 1:
    raise RuntimeError(f'regra mobile antiga esperada 1 vez, encontrada {c.count(old_mobile)}')
c = c.replace(old_mobile, new_mobile, 1)

p = p.replace("ok('linha Hoje posiciona Enviar mensagem logo abaixo do nome',\n  app.indexOf('class=\"fila-ident-main\"') >= 0 &&\n  app.indexOf('</span><button class=\"btn-acao sugerir fila-sug fila-msg\"') >= 0);", "ok('linha Hoje posiciona Enviar mensagem logo abaixo de Por que agora',\n  app.indexOf('fxMotivo(a,!0)+\\'<div class=\"fila-mensagem-linha\">') >= 0 &&\n  app.indexOf('class=\"fila-ident-main\"') < 0);")
p = p.replace("ok('CTA da Hoje neutraliza o margin-left:auto global da fila-sug',\n  css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-ident>.fila-msg{margin-left:0;align-self:flex-start;') >= 0);", "ok('CTA da Hoje fica em linha propria abaixo do motivo e alinhado a esquerda',\n  css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-mensagem-linha{display:flex;justify-content:flex-start;margin-top:8px}') >= 0 &&\n  css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-mensagem-linha>.fila-msg{margin-left:0;') >= 0);")
p = p.replace("ok('mobile preserva Enviar mensagem abaixo do nome e desfechos legiveis',\n  css.indexOf('.fila-fluxo{align-items:stretch;flex-direction:column}') >= 0 &&\n  css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-ident>.fila-msg{margin-left:0;align-self:flex-start;width:auto;min-width:0}') >= 0 &&", "ok('mobile preserva Enviar mensagem abaixo do motivo e desfechos legiveis',\n  css.indexOf('.fila-fluxo{align-items:stretch;flex-direction:column}') >= 0 &&\n  css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-mensagem-linha>.fila-msg{margin-left:0;width:auto;min-width:0}') >= 0 &&")

app.write_text(s, encoding='utf-8')
css.write_text(c, encoding='utf-8')
prova.write_text(p, encoding='utf-8')
print('PATCH_HOJE_ENVIAR_POS_MOTIVO_OK')
