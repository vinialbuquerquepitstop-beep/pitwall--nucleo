# Enxuga um arquivo SQL para caber numa chamada de `execute_sql` do MCP.
#
# Tira comentario (linha inteira e fim de linha) e indentacao, inclusive DENTRO
# do corpo de funcao e de bloco `do`, que e codigo e nao dado. NUNCA toca em nada
# dentro de '...'. Neste repo todo dollar-quote (`$fn$`, `$function$`, `$prova$`)
# e CODIGO, entao a tag so abre e fecha escopo.
#
# Por que existe: o transporte do MCP fica instavel por volta de 78 KB de payload
# (passou, travou por 926s e passou de novo com a MESMA chamada, 11 e 12/09/2026).
# E prova de banco desta familia e UM bloco que termina em `raise exception`:
# quebrar em duas chamadas aplica a primeira metade DE VERDADE e mata o rollback.
# Ver a memoria `limite-payload-execute-sql` e a secao 7.2 do
# `docs/handoffs/handoff_calculadora_pitwall_v13.md`.
#
# O que executa fica igual; o md5 impresso serve para conferir, DENTRO do banco,
# que o texto chegou inteiro. Para corpo de funcao o md5 do `prosrc` MUDA (os
# comentarios fazem parte dele), entao migration de verdade se aplica com o
# arquivo ORIGINAL: enxugar e para pre-teste e prova, nunca para `apply_migration`.
#
# Medido em 12/09/2026: na `prova_calc_parse.sql` o resultado e byte a byte igual
# ao do enxugador antigo, que so existia no scratchpad de uma sessao
# (md5 `ad4f9b6d7b171dfd4b8007508f31a453`, 136889 -> 78356 bytes).
#
# Uso:  python ferramentas/enxuga_sql.py <entrada.sql> <saida.sql>
import hashlib, re, sys

LIMITE_SEGURO = 65 * 1024   # sempre passou; 78 KB e instavel, 109 KB nunca passou

src = open(sys.argv[1], encoding="utf-8", newline="").read()
tag_re = re.compile(r"\$[A-Za-z_]*\$")

pilha = []          # tags de dollar-quote abertas
aspas = False
saida, tiradas = [], 0

for ln in src.split("\n"):
    livre = not aspas
    tira = livre and (ln.lstrip().startswith("--") or ln.strip() == "")
    corte = None
    i, n = 0, len(ln)
    while i < n:
        c = ln[i]
        if aspas:
            if c == "'" and i + 1 < n and ln[i + 1] == "'":
                i += 2; continue
            if c == "\\" and i + 1 < n:
                i += 2; continue
            if c == "'":
                aspas = False
            i += 1; continue
        if ln.startswith("--", i):
            corte = i
            break
        m = tag_re.match(ln, i)
        if m:
            t = m.group(0)
            if pilha and pilha[-1] == t:
                pilha.pop()
            else:
                pilha.append(t)
            i += len(t); continue
        if c == "'":
            aspas = True
        i += 1
    if tira:
        tiradas += 1
        continue
    if corte is not None:
        ln = ln[:corte].rstrip()
        if ln == "":
            tiradas += 1
            continue
    if livre:
        ln = ln.lstrip()
    saida.append(ln)

# Um `\` dentro de '...' e lido como escape, o que e certo para E'...' e errado
# para '...' comum com standard_conforming_strings. Se sobrar string aberta, o
# arquivo tem um `'\'` literal: troque por `chr(92)`, que e mais claro de todo jeito.
if aspas or pilha:
    sys.exit(f"ESTADO FINAL INCONSISTENTE: aspas={aspas} pilha={pilha}. "
             "Procure um '\\' literal e troque por chr(92).")

out = "\n".join(saida)
b = out.encode("utf-8")
open(sys.argv[2], "w", encoding="utf-8", newline="").write(out)
print("linhas tiradas:", tiradas)
print("bytes:", len(src.encode("utf-8")), "->", len(b))
print("md5:", hashlib.md5(b).hexdigest())
print("assercoes (v_total := v_total + 1):", out.count("v_total := v_total + 1;"))
if len(b) > LIMITE_SEGURO:
    print(f"AVISO: {len(b)} bytes passa do limite seguro de {LIMITE_SEGURO}. "
          "O transporte do MCP pode travar. Partir o arquivo, nunca a chamada.")
    sys.exit(2)
