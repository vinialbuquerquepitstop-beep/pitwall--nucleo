from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
css = raiz / "public" / "app.css"
src = css.read_text(encoding="utf-8")

if "Fatia 4 — desfecho rapido" in src:
    print("PATCH_FATIA4_JA_APLICADO")
    raise SystemExit(0)

antigo = '''.desfechos{display:none;gap:7px;margin-top:7px;flex-wrap:wrap}\n.desfechos.aberto{display:flex}\n.btn-desf{\n  flex:1 1 45%;background:var(--bg);border:1px solid var(--line-forte);color:var(--text);\n  border-radius:var(--radius-p);padding:8px;font-size:12.5px;font-family:var(--body);font-weight:500;\n}\n.btn-desf:hover{background:var(--surface)}'''

novo = '''/* Fatia 4 — desfecho rapido. Os resultados deixam de ficar escondidos atras\n   de um clique intermediario: cada opcao continua chamando sua RPC existente. */\n.card-acoes [data-acao="leque"]{display:none}\n.desfechos{\n  display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-top:8px\n}\n.desfechos.aberto{display:grid}\n.btn-desf{\n  min-width:0;background:var(--bg);border:1px solid var(--line-forte);color:var(--text);\n  border-radius:var(--radius-p);padding:7px 9px;font-size:12px;line-height:1.2;\n  font-family:var(--body);font-weight:500;white-space:nowrap;\n}\n.btn-desf:hover{background:var(--surface)}'''

if src.count(antigo) != 1:
    raise RuntimeError(f"bloco .desfechos esperado 1 vez, encontrado {src.count(antigo)}")
src = src.replace(antigo, novo, 1)

antigo_fila = '''.fila-lin>.card-acoes .acoes-escrita{\n  display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);\n  gap:6px;width:min(100%,300px);\n}'''
novo_fila = '''.fila-lin>.card-acoes .acoes-escrita{\n  display:flex;gap:6px;width:auto;\n}'''
if src.count(antigo_fila) != 1:
    raise RuntimeError(f"bloco acoes-escrita da Hoje esperado 1 vez, encontrado {src.count(antigo_fila)}")
src = src.replace(antigo_fila, novo_fila, 1)

ancora = '''@media (max-width:560px){\n  .fila-contexto{display:grid;grid-template-columns:1fr;gap:2px}\n  .fila-contexto>span+span::before{display:none}\n}'''
novo_mobile = '''@media (max-width:560px){\n  .fila-contexto{display:grid;grid-template-columns:1fr;gap:2px}\n  .fila-contexto>span+span::before{display:none}\n  .desfechos{grid-template-columns:repeat(2,minmax(0,1fr))}\n  .desfechos .btn-desf:first-child{grid-column:1 / -1}\n}'''
if src.count(ancora) != 1:
    raise RuntimeError(f"media query da fila esperado 1 vez, encontrado {src.count(ancora)}")
src = src.replace(ancora, novo_mobile, 1)

css.write_text(src, encoding="utf-8")
print("PATCH_FATIA4_OK")
