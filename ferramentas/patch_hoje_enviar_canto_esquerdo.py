from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
app = raiz/'public'/'app.js'
css = raiz/'public'/'app.css'
prova = raiz/'ferramentas'/'prova_hoje_fila_harmonia.js'

s = app.read_text(encoding='utf-8')
c = css.read_text(encoding='utf-8')
p = prova.read_text(encoding='utf-8')

old_res = '''function filaResultadoHTML(a,hj){if(!a||!a.id||!podeAbordar(a))return"";var g=c(a.id);return'<div class="fila-fluxo"><button class="btn-acao sugerir fila-sug fila-msg" data-acao="hoje-sugerir" data-id="'+g+'">Enviar mensagem</button><span class="fila-registro"><button class="btn-acao toque fila-toque" data-acao="toque" data-id="'+g+'">Toque enviado</button><button class="btn-acao fila-reg-btn" data-acao="leque" data-id="'+g+'" aria-expanded="false">Registrar resultado</button></span></div><div class="scripts" data-scripts></div>'''
new_res = '''function filaResultadoHTML(a,hj){if(!a||!a.id||!podeAbordar(a))return"";var g=c(a.id);return'<div class="fila-fluxo"><span class="fila-registro"><button class="btn-acao toque fila-toque" data-acao="toque" data-id="'+g+'">Toque enviado</button><button class="btn-acao fila-reg-btn" data-acao="leque" data-id="'+g+'" aria-expanded="false">Registrar resultado</button></span></div><div class="scripts" data-scripts></div>'''
if s.count(old_res) != 1:
    raise RuntimeError('filaResultadoHTML atual nao encontrado exatamente uma vez')
s = s.replace(old_res,new_res,1)

old_lin = '''return'<div class="fila-lin" data-lead="'+c(a.lead_code||"")+'"><div class="fila-lin-topo"><div class="fila-ident">'+nivelPonto(nv)+'<span class="fila-nome">'+c(a.nome||"")+'</span><span class="fila-nivel n-'+c(nv)+'">'+c(s("nivel",nv))+'</span></div>'+fxVerChip(a,atr,!0)+'</div>'''
new_lin = '''return'<div class="fila-lin" data-lead="'+c(a.lead_code||"")+'"><div class="fila-lin-topo"><button class="btn-acao sugerir fila-sug fila-msg" data-acao="hoje-sugerir" data-id="'+c(a.id)+'">Enviar mensagem</button><div class="fila-ident">'+nivelPonto(nv)+'<span class="fila-nome">'+c(a.nome||"")+'</span><span class="fila-nivel n-'+c(nv)+'">'+c(s("nivel",nv))+'</span></div>'+fxVerChip(a,atr,!0)+'</div>'''
if s.count(old_lin) != 1:
    raise RuntimeError('hojeFilaLin atual nao encontrado exatamente uma vez')
s = s.replace(old_lin,new_lin,1)

css_old = '''#lista[data-aba="hoje"] .fila-lin-topo{min-height:24px}\n#lista[data-aba="hoje"] .fila-lin-topo>.chip{margin-left:auto}'''
css_new = '''#lista[data-aba="hoje"] .fila-lin-topo{min-height:24px}\n#lista[data-aba="hoje"] .fila-lin-topo>.fila-msg{flex:0 0 auto;order:-1;min-width:142px;padding:7px 12px;font-size:12px;font-weight:600}\n#lista[data-aba="hoje"] .fila-lin-topo>.chip{margin-left:auto}'''
if c.count(css_old) != 1:
    raise RuntimeError('ancora CSS do topo Hoje nao encontrada')
c = c.replace(css_old, css_new, 1)

# fluxo inferior agora e somente registro, alinhado a direita
c = c.replace(''' .fila-fluxo .fila-msg{\n  flex:0 0 auto;min-width:142px;padding:7px 12px;font-size:12px;font-weight:600;\n}\n'''.lstrip(), '', 1)
c = c.replace('.fila-registro{display:flex;align-items:center;gap:5px;margin-left:auto}', '.fila-registro{display:flex;align-items:center;gap:5px;margin-left:auto}')
c = c.replace('''  .fila-fluxo{align-items:stretch;flex-direction:column}\n  .fila-fluxo .fila-msg{width:auto;align-self:flex-start}\n  .fila-registro{width:100%;margin-left:0}''', '''  #lista[data-aba="hoje"] .fila-lin-topo>.fila-msg{width:auto;min-width:0}\n  .fila-fluxo{align-items:stretch;flex-direction:column}\n  .fila-registro{width:100%;margin-left:0}''')

p = p.replace("linha Hoje deixa o topo apenas para identidade e veredito", "linha Hoje ancora Enviar mensagem no canto esquerdo do topo")
p = p.replace("app.indexOf('fxVerChip(a,atr,!0)+\\'</div><div class=\"fila-contexto\"') >= 0 &&\n  app.indexOf('fxVerChip(a,atr,!0)+\\'<button class=\"btn-acao sugerir fila-sug\"') < 0", "app.indexOf('<div class=\"fila-lin-topo\"><button class=\"btn-acao sugerir fila-sug fila-msg\"') >= 0")
p = p.replace("mobile mantem Enviar mensagem ancorado a esquerda e desfechos legiveis", "mobile preserva Enviar mensagem no topo esquerdo e desfechos legiveis")
p = p.replace("css.indexOf('.fila-fluxo .fila-msg{width:auto;align-self:flex-start}') >= 0 &&\n", "css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-lin-topo>.fila-msg{width:auto;min-width:0}') >= 0 &&\n")

app.write_text(s,encoding='utf-8')
css.write_text(c,encoding='utf-8')
prova.write_text(p,encoding='utf-8')
print('PATCH_HOJE_ENVIAR_CANTO_ESQUERDO_OK')
