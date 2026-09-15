from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
app = raiz / "public" / "app.js"
css = raiz / "public" / "app.css"
src = app.read_text(encoding="utf-8")
css_src = css.read_text(encoding="utf-8")

src2 = src.replace('class="desfechos fila-desfechos"', 'class="desfechos"')
if src2 == src and 'class="desfechos fila-desfechos"' in src:
    raise RuntimeError("nao consegui remover classe fila-desfechos")
src = src2

antigo = '''.fila-registro .fila-reg-btn[aria-expanded="true"]{
  background:var(--accent-tint);border-color:var(--accent-linha);color:var(--accent);
}'''
novo = '''.fila-registro .fila-reg-btn[aria-expanded="true"]{
  background:var(--accent-tint);border-color:var(--accent-linha);color:var(--text);
}'''
if antigo not in css_src:
    raise RuntimeError("estado expandido de Registrar resultado nao encontrado")
css_src = css_src.replace(antigo, novo, 1)

app.write_text(src, encoding="utf-8")
css.write_text(css_src, encoding="utf-8")
print("PATCH_HOJE_FILA_FIX_OK")
