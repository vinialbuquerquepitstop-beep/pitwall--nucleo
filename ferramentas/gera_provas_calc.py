# Gera as TRES provas de banco da calculadora a partir da fonte unica
# `ferramentas/prova_calc_parse.sql`.
#
# Criado em 12/09/2026, fatia "partir a prova" (secao 10 do
# docs/handoffs/handoff_calculadora_pitwall_v13.md). Por que existe: enxuta, a
# fonte tem ~78 KB, e esse payload passou uma vez e travou outra no transporte do
# MCP. A prova e UM bloco `do` que termina em `raise exception`, entao quebrar a
# CHAMADA em duas aplicaria a primeira metade de verdade. Parte-se o ARQUIVO.
#
# Por que gerado e nao copiado: as fixtures A a D servem a dois arquivos, e duas
# copias de fixture ja divergiram neste projeto (a prova reprovou por defeito
# dela, nao do motor). Uma fonte, tres saidas, regeradas toda vez que a fonte muda.
#
#   python ferramentas/gera_provas_calc.py
#
# A fonte e partida pelos marcadores de comentario `-- @@<nome>`:
#   @@declare             do `do $prova$` ate o `begin` (vai inteiro para os tres)
#   @@fixture X           uma fixture; vai para quem le a variavel dela
#   @@preambulo           `v_x := ...`, linha a linha, so para quem le `v_x`
#   @@comum rpc           a identidade do dono; vai para quem troca de papel
#   @@secao X             uma secao de assercoes; o mapa ARQUIVOS abaixo decide
#   @@relatorio           a cabeca do `raise` final
#   @@relatorio <arquivo> as linhas de sumario daquele arquivo
#   @@relatorio fim       o `else REPROVOU` e o fecho do bloco
#
# RECUSA (EXIT 1, nada escrito) quando:
#   - um arquivo gerado LE variavel que ele nao atribui (a medida da tabela 10.2
#     do v13, agora como guarda). O default do `declare` NAO conta como
#     atribuicao, fora os globais: `v_cargas` nasce `'{}'`, e contar isso deixaria
#     a L19 lendo cargas que no arquivo dela nao existem, verde por construcao;
#   - uma secao, fixture ou linha de relatorio da fonte fica sem arquivo, ou em
#     dois (assercao perdida ou duplicada no corte);
#   - a soma das assercoes dos tres difere da fonte;
#   - o `enxuga_sql.py` de qualquer um nao sai com EXIT 0 (limite seguro).
#
# Limite declarado, o mesmo do `mede_corte_prova.py`: a leitura de variavel e por
# regex, nao um parser de plpgsql. A guarda de verdade e rodar os tres e somar.
import hashlib, os, re, subprocess, sys, tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
FONTE = os.path.join(AQUI, "prova_calc_parse.sql")

# arquivo -> (secoes, rotulo do relatorio)
ARQUIVOS = [
    ("prova_calc_leitor.sql",   ["H", "A", "B", "E", "F", "P"], "leitor"),
    ("prova_calc_laco.sql",     ["G", "Z", "R"],           "laco"),
    ("prova_calc_catalogo.sql", ["K", "L", "Q"],           "catalogo"),
]

# Lidos em toda parte e so inicializados no `declare`, de proposito.
GLOBAIS = {"v_tenant", "v_dono", "v_total", "v_falhas", "v_log"}

ASSERCAO = "v_total := v_total + 1;"
MARCADOR = re.compile(r"^\s*-- @@(\S+(?: \S+)?)\s*$")


def recusa(msg):
    sys.exit("RECUSADO: " + msg)


def sem_comentario_nem_string(txt):
    """Tira comentario e o CONTEUDO de '...' (fica a casca ''), para a leitura de
    variavel nao ver `v_x` dentro de mensagem nem de regex. Mesma regra de aspas
    do enxuga_sql.py."""
    out, aspas = [], False
    for ln in txt.split("\n"):
        i, n, buf = 0, len(ln), []
        while i < n:
            c = ln[i]
            if aspas:
                if c == "'" and i + 1 < n and ln[i + 1] == "'":
                    i += 2; continue
                if c == "\\" and i + 1 < n:
                    i += 2; continue
                if c == "'":
                    aspas = False
                    buf.append("'")
                i += 1; continue
            if ln.startswith("--", i):
                break
            if c == "'":
                aspas = True
            buf.append(c)
            i += 1
        out.append("".join(buf))
    return "\n".join(out)


def lidas(txt):
    return set(re.findall(r"\bv_[a-z0-9_]+\b", sem_comentario_nem_string(txt)))


def atribuidas(txt):
    t = sem_comentario_nem_string(txt)
    s = set(re.findall(r"\b(v_[a-z0-9_]+)\s*:=", t))
    for m in re.finditer(r"\binto\s+((?:v_[a-z0-9_]+\s*,\s*)*v_[a-z0-9_]+)", t):
        s |= {x.strip() for x in m.group(1).split(",")}
    s |= set(re.findall(r"\b(?:for|foreach)\s+(v_[a-z0-9_]+)\s+in", t))
    return s


def n_assercoes(txt):
    return sem_comentario_nem_string(txt).count(ASSERCAO)


# ── partir a fonte pelos marcadores ─────────────────────────────────────────────
bruto = open(FONTE, "rb").read()
md5_fonte = hashlib.md5(bruto).hexdigest()
linhas = bruto.decode("utf-8").split("\n")

segs, nome, buf = [], None, []
for ln in linhas:
    m = MARCADOR.match(ln)
    if m:
        segs.append((nome, buf))
        nome, buf = m.group(1), [ln]
    else:
        buf.append(ln)
segs.append((nome, buf))

cabecalho = segs[0]
if cabecalho[0] is not None:
    recusa("a fonte nao tem cabecalho antes do primeiro marcador")
segs = segs[1:]

nomes = [s[0] for s in segs]
if len(nomes) != len(set(nomes)):
    recusa("marcador repetido na fonte: " + ", ".join(sorted({x for x in nomes if nomes.count(x) > 1})))

seg = {n: "\n".join(b) for n, b in segs}
conhecidos = re.compile(r"^(declare|preambulo|comum rpc|relatorio|relatorio fim|"
                        r"fixture [A-Z]|secao [A-Z]|relatorio [a-z]+)$")
for n in nomes:
    if not conhecidos.match(n):
        recusa(f"marcador desconhecido `-- @@{n}`")
for n in ("declare", "preambulo", "comum rpc", "relatorio", "relatorio fim"):
    if n not in seg:
        recusa(f"a fonte perdeu o marcador `-- @@{n}`")
if nomes[-1] != "relatorio fim":
    recusa("`-- @@relatorio fim` tem que ser o ultimo marcador")

fixtures = [n for n in nomes if n.startswith("fixture ")]
secoes = [n[len("secao "):] for n in nomes if n.startswith("secao ")]
pedacos_rel = [n[len("relatorio "):] for n in nomes
               if n.startswith("relatorio ") and n != "relatorio fim"]

# cada secao e cada linha de relatorio em EXATAMENTE um arquivo
usadas = [s for _, ss, _ in ARQUIVOS for s in ss]
for s in secoes:
    if usadas.count(s) != 1:
        recusa(f"a secao {s} esta em {usadas.count(s)} arquivos (tem que ser 1)")
for s in usadas:
    if s not in secoes:
        recusa(f"o mapa pede a secao {s}, que a fonte nao tem")
rotulos = [r for _, _, r in ARQUIVOS]
if sorted(pedacos_rel) != sorted(rotulos):
    recusa(f"linhas de relatorio da fonte {sorted(pedacos_rel)} nao batem com os arquivos {sorted(rotulos)}")

# a variavel de cada fixture
var_fixture = {}
for f in fixtures:
    a = atribuidas(seg[f])
    if len(a) != 1:
        recusa(f"`{f}` tem que atribuir exatamente uma variavel, atribui {sorted(a)}")
    var_fixture[f] = a.pop()

# o preambulo, linha a linha
pre_linha = re.compile(r"^\s*(v_[a-z0-9_]+)\s*:=.*;\s*$")

# ── montar cada arquivo ─────────────────────────────────────────────────────────
total_fonte = n_assercoes("\n".join(seg[n] for n in nomes))
saidas, fixtures_usadas, soma = [], set(), 0

for arq, ss, rot in ARQUIVOS:
    corpo_secoes = "\n".join(seg["secao " + s] for s in ss)
    rel = "\n".join([seg["relatorio"], seg["relatorio " + rot], seg["relatorio fim"]])
    nucleo = corpo_secoes + "\n" + rel
    precisa = lidas(nucleo)

    pre = []
    for ln in seg["preambulo"].split("\n"):
        m = pre_linha.match(ln)
        if m and m.group(1) not in precisa:
            continue
        pre.append(ln)
    pre = "\n".join(pre)

    precisa_fx = lidas(nucleo + "\n" + pre)
    fx = [f for f in fixtures if var_fixture[f] in precisa_fx]
    fixtures_usadas |= set(fx)

    comum = seg["comum rpc"] if "set local role authenticated" in corpo_secoes else None

    etiqueta = arq[:-len(".sql")]
    for velho in (" assercoes, 0 falhas'", " assercoes falharam'"):
        if rel.count(velho) != 1:
            recusa(f"o relatorio da fonte nao tem exatamente um `{velho}`")
        rel = rel.replace(velho, velho[:-1] + f" ({etiqueta})'")

    corpo = "\n".join([seg[f] for f in fx] + [pre] + ([comum] if comum else []) +
                      [corpo_secoes, rel])

    fora = sorted(lidas(corpo) - atribuidas(corpo) - GLOBAIS)
    if fora:
        recusa(f"{arq} le variavel que ele nao atribui: {', '.join(fora)}. "
               "Ela vem de outra secao: tire o acoplamento na fonte, nao no gerado.")

    n = n_assercoes(corpo)
    soma += n
    cab = "\n".join([
        f"-- {arq} — GERADO por ferramentas/gera_provas_calc.py. NAO EDITAR A MAO.",
        f"-- Fonte unica: ferramentas/prova_calc_parse.sql (md5 {md5_fonte}).",
        "-- Mudou a fonte, rode o gerador de novo: este arquivo e sobrescrito.",
        "--",
        f"-- Secoes: {', '.join(ss)}. Fixtures: {', '.join(f.split()[1] for f in fx) or 'nenhuma'}.",
        f"-- Assercoes escritas: {n} (um laco pode executar mais de uma vez; o numero",
        "-- que conta e o da mensagem, e a soma dos tres gerados e o total da fonte).",
        "--",
        "-- COMO RODAR por MCP: enxugar e colar a saida numa chamada SO de execute_sql.",
        f"--   python ferramentas/enxuga_sql.py ferramentas/{arq} <saida.sql>",
        "-- O bloco TERMINA EM `raise exception` de proposito: nada fica gravado.",
        "-- **O resultado e a MENSAGEM (PASSOU / REPROVOU), nunca o exit code.**",
        "-- Leia o cabecalho da fonte para o que cada secao cobre.",
        "",
    ])
    texto = cab + "\n" + seg["declare"] + "\n" + corpo
    if not texto.endswith("\n"):
        texto += "\n"
    saidas.append((arq, texto, n, ss, fx))

for f in fixtures:
    if f not in fixtures_usadas:
        recusa(f"a `{f}` nao vai para arquivo nenhum: as assercoes dela se perderam")
if soma != total_fonte:
    recusa(f"soma das assercoes dos gerados ({soma}) difere da fonte ({total_fonte})")

# ── o limite do transporte, medido pelo proprio enxugador ───────────────────────
medidas = []
with tempfile.TemporaryDirectory() as d:
    for arq, texto, n, ss, fx in saidas:
        a, b = os.path.join(d, arq), os.path.join(d, "enx_" + arq)
        open(a, "w", encoding="utf-8", newline="").write(texto)
        r = subprocess.run([sys.executable, os.path.join(AQUI, "enxuga_sql.py"), a, b],
                           capture_output=True, text=True, encoding="utf-8")
        if r.returncode != 0:
            recusa(f"{arq}: enxuga_sql.py saiu com EXIT {r.returncode}\n{r.stdout}{r.stderr}")
        medidas.append(len(open(b, "rb").read()))

# so escreve depois de TODAS as guardas passarem
print(f"fonte: ferramentas/prova_calc_parse.sql  md5 {md5_fonte}  assercoes escritas {total_fonte}")
for (arq, texto, n, ss, fx), enx in zip(saidas, medidas):
    dados = texto.encode("utf-8")
    open(os.path.join(AQUI, arq), "wb").write(dados)
    print(f"  {arq:26s} secoes {','.join(ss):10s} fixtures "
          f"{','.join(f.split()[1] for f in fx):8s} assercoes {n:3d}  "
          f"bytes {len(dados):6d}  enxuto {enx:6d}  md5 {hashlib.md5(dados).hexdigest()}")
print(f"soma das assercoes escritas: {soma} (= fonte)")
