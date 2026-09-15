from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
app = raiz / 'public' / 'app.js'
css = raiz / 'public' / 'app.css'
prova = raiz / 'ferramentas' / 'prova_hoje_fila_harmonia.js'

s = app.read_text(encoding='utf-8')
c = css.read_text(encoding='utf-8')
p = prova.read_text(encoding='utf-8')

old_resultado = '''function filaResultadoHTML(a,hj){if(!a||!a.id||!podeAbordar(a))return"";var g=c(a.id);return'<div class="fila-fluxo"><span class="fila-registro"><button class="btn-acao toque fila-toque" data-acao="toque" data-id="'+g+'">Toque enviado</button><button class="btn-acao fila-reg-btn" data-acao="leque" data-id="'+g+'" aria-expanded="false">Registrar resultado</button></span></div><div class="scripts" data-scripts></div>'''
new_resultado = '''function filaResultadoHTML(a,hj){if(!a||!a.id||!podeAbordar(a))return"";var g=c(a.id);return'<div class="scripts" data-scripts></div>'''
if s.count(old_resultado) != 1:
    raise RuntimeError(f'filaResultadoHTML esperado 1 vez, encontrado {s.count(old_resultado)}')
s = s.replace(old_resultado, new_resultado, 1)

old_linha = '''<div class="fila-mensagem-linha"><button class="btn-acao sugerir fila-sug fila-msg" data-acao="hoje-sugerir" data-id="'+c(a.id)+'">Enviar mensagem</button></div>'+filaResultadoHTML(a,hj)'''
new_linha = '''<div class="fila-mensagem-linha"><button class="btn-acao sugerir fila-sug fila-msg" data-acao="hoje-sugerir" data-id="'+c(a.id)+'">Enviar mensagem</button><span class="fila-registro"><button class="btn-acao toque fila-toque" data-acao="toque" data-id="'+c(a.id)+'">Toque enviado</button><button class="btn-acao fila-reg-btn" data-acao="leque" data-id="'+c(a.id)+'" aria-expanded="false">Registrar resultado</button></span></div>'+filaResultadoHTML(a,hj)'''
if s.count(old_linha) != 1:
    raise RuntimeError(f'linha de mensagem esperada 1 vez, encontrada {s.count(old_linha)}')
s = s.replace(old_linha, new_linha, 1)

old_css = '#lista[data-aba="hoje"] .fila-mensagem-linha{display:flex;justify-content:flex-start;margin-top:8px}'
new_css = '#lista[data-aba="hoje"] .fila-mensagem-linha{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px}'
if c.count(old_css) != 1:
    raise RuntimeError(f'CSS fila-mensagem-linha esperado 1 vez, encontrado {c.count(old_css)}')
c = c.replace(old_css, new_css, 1)

old_mobile = '''@media (max-width:560px){\n  #lista[data-aba="hoje"] .fila-mensagem-linha>.fila-msg{margin-left:0;width:auto;min-width:0}\n  .fila-fluxo{align-items:stretch;flex-direction:column}\n  .fila-registro{width:100%;margin-left:0}'''
new_mobile = '''@media (max-width:560px){\n  #lista[data-aba="hoje"] .fila-mensagem-linha{align-items:stretch;flex-direction:column}\n  #lista[data-aba="hoje"] .fila-mensagem-linha>.fila-msg{margin-left:0;width:auto;min-width:0;align-self:flex-start}\n  .fila-fluxo{align-items:stretch;flex-direction:column}\n  .fila-registro{width:100%;margin-left:0}'''
if c.count(old_mobile) != 1:
    raise RuntimeError(f'bloco mobile esperado 1 vez, encontrado {c.count(old_mobile)}')
c = c.replace(old_mobile, new_mobile, 1)

p = p.replace("ok('linha Hoje posiciona Enviar mensagem logo abaixo de Por que agora',\n  app.indexOf('fxMotivo(a,!0)+\\'<div class=\"fila-mensagem-linha\">') >= 0 &&\n  app.indexOf('class=\"fila-ident-main\"') < 0);", "ok('linha Hoje agrupa as tres acoes logo abaixo de Por que agora',\n  app.indexOf('fxMotivo(a,!0)+\\'<div class=\"fila-mensagem-linha\"><button class=\"btn-acao sugerir fila-sug fila-msg\"') >= 0 &&\n  app.indexOf('>Enviar mensagem</button><span class=\"fila-registro\"><button class=\"btn-acao toque fila-toque\"') >= 0 &&\n  app.indexOf('>Toque enviado</button><button class=\"btn-acao fila-reg-btn\"') >= 0);")
p = p.replace("ok('CTA da Hoje fica em linha propria abaixo do motivo e alinhado a esquerda',\n  css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-mensagem-linha{display:flex;justify-content:flex-start;margin-top:8px}') >= 0 &&\n  css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-mensagem-linha>.fila-msg{margin-left:0;') >= 0);", "ok('acoes da Hoje usam uma unica linha no desktop',\n  css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-mensagem-linha{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px}') >= 0 &&\n  css.indexOf('.fila-registro{display:flex;align-items:center;gap:5px;margin-left:auto}') >= 0);")
p = p.replace("ok('registro normal fica reduzido a toque e registrar resultado',", "ok('registro normal permanece reduzido a toque e registrar resultado na mesma faixa',")
p = p.replace("ok('mobile preserva Enviar mensagem abaixo do motivo e desfechos legiveis',\n  css.indexOf('.fila-fluxo{align-items:stretch;flex-direction:column}') >= 0 &&\n  css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-mensagem-linha>.fila-msg{margin-left:0;width:auto;min-width:0}') >= 0 &&", "ok('mobile reorganiza a faixa sem comprimir os controles',\n  css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-mensagem-linha{align-items:stretch;flex-direction:column}') >= 0 &&\n  css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-mensagem-linha>.fila-msg{margin-left:0;width:auto;min-width:0;align-self:flex-start}') >= 0 &&")

app.write_text(s, encoding='utf-8')
css.write_text(c, encoding='utf-8')
prova.write_text(p, encoding='utf-8')
print('PATCH_HOJE_ACOES_MESMA_LINHA_OK')
