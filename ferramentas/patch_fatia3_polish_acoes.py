from pathlib import Path

alvo = Path(__file__).resolve().parents[1] / "public" / "app.css"
src = alvo.read_text(encoding="utf-8")

ancora = ".dia-sec-cab+.fila-lin{border-top:none}\n"
bloco = """.dia-sec-cab+.fila-lin{border-top:none}\n/* Fatia 3 — polish visual: as acoes de fechamento da fila embutida no Hoje\n   ficam compactas e proporcionais ao restante da linha, sem alterar contratos. */\n.fila-lin>.card-acoes{\n  margin-top:8px;padding-top:8px;border-top:1px solid var(--line);\n}\n.fila-lin>.card-acoes .acoes-escrita{\n  display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);\n  gap:6px;width:min(100%,300px);\n}\n.fila-lin>.card-acoes .acoes-escrita .btn-acao{\n  min-width:0;padding:7px 10px;font-size:12px;line-height:1.2;white-space:nowrap;\n}\n"""

if ".fila-lin>.card-acoes .acoes-escrita" in src:
    print("PATCH_FATIA3_POLISH_ACOES_JA_APLICADO")
    raise SystemExit(0)

if src.count(ancora) != 1:
    raise RuntimeError(f"ancora esperada 1 vez, encontrada {src.count(ancora)}")

src = src.replace(ancora, bloco, 1)
alvo.write_text(src, encoding="utf-8")
print("PATCH_FATIA3_POLISH_ACOES_OK")
