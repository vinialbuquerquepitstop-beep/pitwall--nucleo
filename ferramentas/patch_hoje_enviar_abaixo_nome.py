from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
app = raiz/'public'/'app.js'
css = raiz/'public'/'app.css'
prova = raiz/'ferramentas'/'prova_hoje_fila_harmonia.js'

s = app.read_text(encoding='utf-8')
c = css.read_text(encoding='utf-8')
p = prova.read_text(encoding='utf-8')

old = '''<div class="fila-lin-topo"><button class="btn-acao sugerir fila-sug fila-msg" data-acao="hoje-sugerir" data-id="'+c(a.id)+'">Enviar mensagem</button><div class="fila-ident">'+nivelPonto(nv)+'<span class="fila-nome">'+c(a.nome||"")+'</span><span class="fila-nivel n-'+c(nv)+'">'+c(s("nivel",nv))+'</span></div>'+fxVerChip(a,atr,!0)+''' 
new = '''<div class="fila-lin-topo"><div class="fila-ident"><span class="fila-ident-main">'+nivelPonto(nv)+'<span class="fila-nome">'+c(a.nome||"")+'</span><span class="fila-nivel n-'+c(nv)+'">'+c(s("nivel",nv))+'</span></span><button class="btn-acao sugerir fila-sug fila-msg" data-acao="hoje-sugerir" data-id="'+c(a.id)+'">Enviar mensagem</button></div>'+fxVerChip(a,atr,!0)+'''
if s.count(old) != 1:
    raise RuntimeError(f'estrutura topo esperada 1 vez, encontrada {s.count(old)}')
s = s.replace(old, new, 1)

c = c.replace('#lista[data-aba="hoje"] .fila-lin-topo>.fila-msg{flex:0 0 auto;order:-1;min-width:142px;padding:7px 12px;font-size:12px;font-weight:600}\n', '')
old_ident = '.fila-ident{display:flex;align-items:center;gap:7px;min-width:0;flex:1 1 170px;overflow:hidden}'
new_ident = '.fila-ident{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0;flex:1 1 170px;overflow:hidden}\n.fila-ident-main{display:flex;align-items:center;gap:7px;min-width:0;max-width:100%}\n#lista[data-aba="hoje"] .fila-ident>.fila-msg{flex:0 0 auto;min-width:142px;padding:7px 12px;font-size:12px;font-weight:600}'
if c.count(old_ident) != 1:
    raise RuntimeError('regra .fila-ident nao encontrada')
c = c.replace(old_ident, new_ident, 1)
c = c.replace('  #lista[data-aba="hoje"] .fila-lin-topo>.fila-msg{width:auto;min-width:0}\n', '  #lista[data-aba="hoje"] .fila-ident>.fila-msg{width:auto;min-width:0}\n')

p = p.replace("linha Hoje ancora Enviar mensagem no canto esquerdo do topo", "linha Hoje posiciona Enviar mensagem logo abaixo do nome")
p = p.replace("app.indexOf('<div class=\"fila-lin-topo\"><button class=\"btn-acao sugerir fila-sug fila-msg\"') >= 0", "app.indexOf('class=\"fila-ident-main\"') >= 0 &&\n  app.indexOf('</span><button class=\"btn-acao sugerir fila-sug fila-msg\"') >= 0")
p = p.replace("mobile preserva Enviar mensagem no topo esquerdo e desfechos legiveis", "mobile preserva Enviar mensagem abaixo do nome e desfechos legiveis")
p = p.replace("css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-lin-topo>.fila-msg{width:auto;min-width:0}') >= 0", "css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-ident>.fila-msg{width:auto;min-width:0}') >= 0")

app.write_text(s, encoding='utf-8')
css.write_text(c, encoding='utf-8')
prova.write_text(p, encoding='utf-8')
print('PATCH_HOJE_ENVIAR_ABAIXO_NOME_OK')
