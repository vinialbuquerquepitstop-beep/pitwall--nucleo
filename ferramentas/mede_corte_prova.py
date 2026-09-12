# Mede ONDE uma prova de banco monolitica pode ser cortada: o tamanho enxuto de
# cada secao e as dependencias de variavel ENTRE secoes (variavel lida numa secao
# e atribuida pela primeira vez em outra). Sao as dependencias que decidem o corte;
# o tamanho so diz quantos pedacos.
#
# Criado em 12/09/2026 para preparar a fatia "partir a prova" (secao 10 do
# docs/handoffs/handoff_calculadora_pitwall_v13.md). Acha as secoes pelos
# MARCADORES do arquivo, nao por numero de linha: a prova cresce a cada fatia.
#
#   python ferramentas/mede_corte_prova.py [ferramentas/prova_calc_parse.sql]
#
# Limite conhecido, declarado: a deteccao de variavel e por regex (`:=`, `into`,
# `for ... in`), nao um parser de plpgsql. Serve para planejar o corte. A guarda
# de verdade e rodar os arquivos gerados e somar as assercoes.
import os, re, subprocess, sys, tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
ARQ = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, "prova_calc_parse.sql")
L = open(ARQ, encoding="utf-8", newline="").read().split("\n")

marc_secao = re.compile(r"^  -- (?:══|==) ([A-Z])\. ")
marc_fixture = re.compile(r"^  -- (?:══|==) FIXTURE ")

cortes = [("declare", 1)]
fixt = next((i for i, l in enumerate(L, 1) if marc_fixture.match(l)), None)
if fixt:
    cortes.append(("fixtures", fixt))
pre = next((i for i, l in enumerate(L, 1) if "v_b  := privado.calc_parse_v2" in l), None)
if pre:
    cortes.append(("preambulo", pre))
for i, l in enumerate(L, 1):
    m = marc_secao.match(l)
    if m:
        cortes.append((m.group(1), i))
rel = next(i for i, l in enumerate(L, 1) if l.startswith("  raise exception E'%',"))
cortes.append(("relatorio", rel))
cortes.sort(key=lambda c: c[1])

var_re = re.compile(r"\bv_[a-z0-9_]+\b")


def atribuidas(txt):
    s = set(re.findall(r"\b(v_[a-z0-9_]+)\s*:=", txt))
    for m in re.finditer(r"\binto\s+((?:v_[a-z0-9_]+\s*,\s*)*v_[a-z0-9_]+)", txt):
        s |= {x.strip() for x in m.group(1).split(",")}
    s |= set(re.findall(r"\b(?:for|foreach)\s+(v_[a-z0-9_]+)\s+in", txt))
    return s


def enxuto(txt):
    # O `do $prova$` abre no primeiro pedaco e fecha no ultimo: medido sozinho,
    # cada um fica com dollar-quote desbalanceado e o enxugador recusa (certo).
    # Para MEDIR tamanho a tag nao importa, entao sai do pedaco.
    txt = txt.replace("$prova$", "")
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.sql"), os.path.join(d, "b.sql")
        open(a, "w", encoding="utf-8", newline="").write(txt)
        r = subprocess.run([sys.executable, os.path.join(AQUI, "enxuga_sql.py"), a, b],
                           capture_output=True, text=True)
        if not os.path.exists(b):
            return None
        return len(open(b, encoding="utf-8", newline="").read().encode("utf-8"))


secoes = []
for k, (nome, ini) in enumerate(cortes):
    fim = cortes[k + 1][1] - 1 if k + 1 < len(cortes) else len(L)
    secoes.append((nome, ini, fim, "\n".join(L[ini - 1:fim])))

primeira = {}
for nome, _, _, txt in secoes:
    for v in atribuidas(txt):
        primeira.setdefault(v, nome)

total = 0
print(f"{'secao':12s} {'linhas':>11s} {'enxuto':>7s}")
for nome, ini, fim, txt in secoes:
    e = enxuto(txt)
    total += e or 0
    print(f"{nome:12s} {ini:5d}-{fim:<5d} {str(e):>7s}")
print(f"{'TOTAL':12s} {'':11s} {total:7d}   (limite seguro por arquivo: 66560)")

globais = {"v_total", "v_falhas", "v_log", "v_msg", "v_ok", "v_tenant", "v_dono"}
estrutura = {"declare", "fixtures"}
print("\nDEPENDENCIAS ENTRE SECOES (lida aqui <- atribuida primeiro em):")
for nome, _, _, txt in secoes:
    if nome in estrutura:
        continue
    fora = sorted(v for v in set(var_re.findall(txt)) - atribuidas(txt)
                  if v not in globais and primeira.get(v) not in (None, nome)
                  and primeira.get(v) not in estrutura)
    if fora:
        print(f"  {nome:10s} <- " + ", ".join(f"{v} ({primeira[v]})" for v in fora))
