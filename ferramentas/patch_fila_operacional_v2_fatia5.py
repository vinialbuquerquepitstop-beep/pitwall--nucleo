from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
app = raiz / "public" / "app.js"
css = raiz / "public" / "app.css"
src = app.read_text(encoding="utf-8")
css_src = css.read_text(encoding="utf-8")

if "function filaSelecionarProximo(focar)" in src and "Fatia 5 - Modo Proximo" in css_src:
    print("PATCH_FATIA5_JA_APLICADO")
    raise SystemExit(0)

antigo_apos = 'function aposAcao(op){if(op&&op.amplo)return B(!0);if(op&&op.lead&&op.card&&abaDeLead())return trocarCard(op.lead,op.card);if(abaDeLead())return B(!0);return reRenderAba(!0)}async function trocarCard'
novo_apos = '''function filaSelecionarProximo(focar){var lista=E("lista");if(!lista)return null;var cards=lista.querySelectorAll(".card.modo-proximo"),j;for(j=0;j<cards.length;j++)cards[j].classList.remove("modo-proximo");var prox=lista.querySelector(".card");if(!prox)return null;prox.classList.add("modo-proximo");prox.setAttribute("tabindex","-1");if(focar){if(prox.scrollIntoView)prox.scrollIntoView({behavior:"smooth",block:"start"});if(prox.focus)try{prox.focus({preventScroll:!0})}catch(e){prox.focus()}}return prox}async function modoProximo(id){if(filaSug)delete filaSug[id];await B(!0);if("fila"===n)filaSelecionarProximo(!0)}function aposAcao(op){if(op&&op.amplo)return B(!0);if(op&&op.lead&&op.card&&abaDeLead()){if("fila"===n)return modoProximo(op.lead);return trocarCard(op.lead,op.card)}if(abaDeLead())return B(!0);return reRenderAba(!0)}async function trocarCard'''
if src.count(antigo_apos) != 1:
    raise RuntimeError(f"aposAcao esperado 1 vez, encontrado {src.count(antigo_apos)}")
src = src.replace(antigo_apos, novo_apos, 1)

antigo_render = 'e.insertAdjacentHTML("afterbegin",filaRecorte(filaOp,a));prefetchFilaSug(24).then(filaWaAtualizar)'
novo_render = 'e.insertAdjacentHTML("afterbegin",filaRecorte(filaOp,a));filaSelecionarProximo(!1);prefetchFilaSug(24).then(filaWaAtualizar)'
if src.count(antigo_render) != 1:
    raise RuntimeError(f"render da fila esperado 1 vez, encontrado {src.count(antigo_render)}")
src = src.replace(antigo_render, novo_render, 1)

marcador = "/* Fatia 5 - Modo Proximo."
if marcador not in css_src:
    css_src += '''\n\n/* Fatia 5 - Modo Proximo. O primeiro card da ordem soberana da fila\n   recebe foco operacional; nenhuma regra de prioridade e duplicada aqui. */\n.card.modo-proximo{\n  border-color:var(--accent-linha);\n  box-shadow:0 0 0 3px var(--accent-tint);\n}\n.card.modo-proximo:focus{outline:2px solid var(--accent);outline-offset:2px}\n'''

app.write_text(src, encoding="utf-8")
css.write_text(css_src, encoding="utf-8")
print("PATCH_FATIA5_OK")
