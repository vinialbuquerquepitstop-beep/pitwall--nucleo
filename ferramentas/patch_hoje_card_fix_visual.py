from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
css = raiz / 'public' / 'app.css'
prova = raiz / 'ferramentas' / 'prova_hoje_fila_harmonia.js'

c = css.read_text(encoding='utf-8')
p = prova.read_text(encoding='utf-8')

old = '#lista[data-aba="hoje"] .fila-ident>.fila-msg{flex:0 0 auto;min-width:142px;padding:7px 12px;font-size:12px;font-weight:600}'
new = '#lista[data-aba="hoje"] .fila-ident>.fila-msg{margin-left:0;align-self:flex-start;flex:0 0 auto;min-width:142px;width:auto;padding:7px 12px;font-size:12px;font-weight:600}'
if c.count(old) != 1:
    raise RuntimeError(f'regra CTA esperada 1 vez, encontrada {c.count(old)}')
c = c.replace(old, new, 1)

old_mobile = '#lista[data-aba="hoje"] .fila-ident>.fila-msg{width:auto;min-width:0}'
new_mobile = '#lista[data-aba="hoje"] .fila-ident>.fila-msg{margin-left:0;align-self:flex-start;width:auto;min-width:0}'
if c.count(old_mobile) != 1:
    raise RuntimeError(f'regra mobile esperada 1 vez, encontrada {c.count(old_mobile)}')
c = c.replace(old_mobile, new_mobile, 1)

needle = "css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-ident>.fila-msg{width:auto;min-width:0}') >= 0"
repl = "css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-ident>.fila-msg{margin-left:0;align-self:flex-start;width:auto;min-width:0}') >= 0"
if needle not in p:
    raise RuntimeError('prova mobile do CTA nao encontrada')
p = p.replace(needle, repl, 1)

insert_after = "ok('acao de contato vira um unico CTA Enviar mensagem',\n  app.indexOf('class=\"btn-acao sugerir fila-sug fila-msg\"') >= 0 &&\n  app.indexOf('>Enviar mensagem</button>') >= 0);\n"
extra = "\nok('CTA da Hoje neutraliza o margin-left:auto global da fila-sug',\n  css.indexOf('#lista[data-aba=\\\"hoje\\\"] .fila-ident>.fila-msg{margin-left:0;align-self:flex-start;') >= 0);\n"
if extra.strip() not in p:
    if insert_after not in p:
        raise RuntimeError('ponto de insercao da prova nao encontrado')
    p = p.replace(insert_after, insert_after + extra, 1)

css.write_text(c, encoding='utf-8')
prova.write_text(p, encoding='utf-8')
print('PATCH_HOJE_CARD_FIX_VISUAL_OK')
