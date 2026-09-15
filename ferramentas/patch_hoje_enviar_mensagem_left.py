from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
app = raiz / 'public' / 'app.js'
css = raiz / 'public' / 'app.css'
prova = raiz / 'ferramentas' / 'prova_hoje_fila_harmonia.js'
harness = raiz / 'ferramentas' / 'harness.py'

app_s = app.read_text(encoding='utf-8')
css_s = css.read_text(encoding='utf-8')
prova_s = prova.read_text(encoding='utf-8')
harness_s = harness.read_text(encoding='utf-8')

old = '>Preparar mensagem</button>'
new = '>Enviar mensagem</button>'
if app_s.count(old) != 1:
    raise RuntimeError(f'app label esperado 1 vez, encontrado {app_s.count(old)}')
app_s = app_s.replace(old, new, 1)

old_css = '.fila-fluxo .fila-msg{width:100%}'
new_css = '.fila-fluxo .fila-msg{width:auto;align-self:flex-start}'
if css_s.count(old_css) != 1:
    raise RuntimeError(f'css mobile esperado 1 vez, encontrado {css_s.count(old_css)}')
css_s = css_s.replace(old_css, new_css, 1)

prova_s = prova_s.replace("acao de contato vira um unico CTA Preparar mensagem", "acao de contato vira um unico CTA Enviar mensagem")
prova_s = prova_s.replace(">Preparar mensagem</button>", ">Enviar mensagem</button>")
prova_s = prova_s.replace("mobile reduz a hierarquia sem comprimir os controles", "mobile mantem Enviar mensagem ancorado a esquerda e desfechos legiveis")
prova_s = prova_s.replace("css.indexOf('.fila-fluxo{align-items:stretch;flex-direction:column}') >= 0 &&", "css.indexOf('.fila-fluxo{align-items:stretch;flex-direction:column}') >= 0 &&\n  css.indexOf('.fila-fluxo .fila-msg{width:auto;align-self:flex-start}') >= 0 &&")

harness_s = harness_s.replace('WhatsApp so aparece depois de preparar a mensagem.', 'WhatsApp so aparece depois de acionar Enviar mensagem.')
harness_s = harness_s.replace("Fila oferece Preparar mensagem como CTA principal", "Fila oferece Enviar mensagem como CTA principal")

app.write_text(app_s, encoding='utf-8')
css.write_text(css_s, encoding='utf-8')
prova.write_text(prova_s, encoding='utf-8')
harness.write_text(harness_s, encoding='utf-8')
print('PATCH_HOJE_ENVIAR_MENSAGEM_LEFT_OK')
