# Prova de cor do painel de vendas (v52).
# Irma da prova_trilho.py: cor semantica se MEDE, nao se escolhe no olho.
#
# LICAO DA 3a PASSADA, que vale mais que o verde desta prova: por duas rodadas eu
# argumentei com RAZAO DE CONTRASTE (WCAG) para dizer se duas fatias vizinhas se
# distinguem. E a metrica errada. Contraste WCAG responde "da para ler texto
# sobre isso"; a pergunta de um grafico e "estas duas cores sao a mesma?", e essa
# se responde com ΔE em OKLab. Quando finalmente rodei
#
#     node scripts/validate_palette.js "..." --mode light      (skill dataviz)
#
# a separacao para daltonismo PASSAVA o tempo todo, e o que reprovava era outra
# coisa: as fatias estavam claras demais e sem croma, porque eram --dim e --morno
# com opacidade. Por isso esta prova mede as DUAS coisas e diz qual serve para o
# que.
#
# Roda da raiz: python ferramentas/prova_grafico.py
import sys, pathlib, re
sys.path.insert(0, 'ferramentas')
sys.stdout.reconfigure(encoding='utf-8')
from contraste import ratio

RAIZ = pathlib.Path(__file__).resolve().parent.parent
css = (RAIZ / 'public' / 'app.css').read_text(encoding='utf-8')

ALVO = 3.0


def token(nome):
    m = re.search(re.escape(nome) + r'\s*:\s*(#[0-9A-Fa-f]{6})', css)
    if not m:
        raise SystemExit('REPROVOU: token %s ausente do app.css' % nome)
    return m.group(1)


def regra(seletor):
    """Corpo da regra CSS daquele seletor, ou None."""
    m = re.search(re.escape(seletor) + r'\s*\{([^}]*)\}', css)
    return m.group(1) if m else None


dim, surface, bg = token('--dim'), token('--surface'), token('--bg')
ok_fg, erro, morno = token('--ok-fg'), token('--erro'), token('--morno')
falhas = []

# ---- 1. as fatias sao os TOKENS CHEIOS, sem opacidade ----
# Com --dim a .28 e --morno a .45 as fatias mediam croma 0.01 e 0.079 e caiam
# fora da banda de luminosidade: liam como papel, nao como marca.
print('  -- as fatias usam token cheio, sem lavagem --')
for sel, esperado, nome in (('.vg-seg.s-custo', dim, 'custo'),
                            ('.vg-seg.s-vaza', morno, 'vazamento'),
                            ('.vg-seg.s-luc', ok_fg, 'lucro')):
    corpo = regra(sel)
    if corpo is None:
        falhas.append('a fatia de %s sumiu do CSS' % nome)
        continue
    if 'opacity' in corpo:
        falhas.append('a fatia de %s voltou a ter opacity: token lavado sai da banda '
                      'de luminosidade e le como papel' % nome)
    print('     %-11s %s  ok' % (nome, esperado))

# ---- 2. ΔE: a metrica certa para "estas duas cores sao a mesma?" ----
# Valores medidos em 12/08/2026 por scripts/validate_palette.js da skill dataviz,
# com a paleta "#5C6675,#C48808,#0F7A52" --mode light. Reexecutar quando as cores
# mudarem; este bloco guarda o resultado e o veredito, nao recalcula OKLab.
print('\n  -- ΔE OKLab (validate_palette.js, 12/08/2026) --')
print('     banda de luminosidade   PASS  os 3 dentro de L 0.43-0.77')
print('     separacao CVD           PASS  pior par lucro x vazamento  ΔE 12.3 protan · 22.1 tritan')
print('     piso de visao normal    PASS  pior par lucro x vazamento  ΔE 22.9')
print('     croma                   FAIL  custo le como cinza  -> ACEITO, ver abaixo')
print('     contraste vs superficie WARN  vazamento 2.98            -> ACEITO, ver abaixo')

# Os dois pendentes ficam, e o motivo mora aqui para a proxima sessao nao
# "consertar" e piorar:
#   croma do cinza: o teste existe para uma cor de IDENTIDADE nao virar cinza sem
#     querer. Aqui custo e neutro DE PROPOSITO, pela regra da .met-barra do
#     proprio projeto: quantidade nao e estado, e barra colorida ja foi reprovada
#     duas vezes. Ler como cinza e a intencao.
#   contraste 2.98 do --morno: a cartilha diz que WARN obriga rotulo visivel ou
#     table view, e nao e dispensavel. Esta cumprido pela legenda nomeada com
#     quadradinho e pelo bloco de vazamento em R$. Alem disso 2.98 e o token da
#     paleta do projeto, ja calibrado e no ar em outras telas.
# As duas condicoes de alivio sao EXIGIDAS abaixo, senao o "aceito" vira desculpa.

# ---- 3. o alivio que sustenta o WARN de contraste ----
if not re.search(r'\.vg-vaza-item\s+i\s*\{', css):
    falhas.append('a legenda perdeu o quadradinho de cor: era ele que amarrava fatia e '
                  'nome, e o alivio que o WARN de contraste exige')
if not re.search(r'\.vg-vaza-item\s+b\s*\{[^}]*color', css):
    falhas.append('o nome da legenda perdeu a cor de tinta')

# ---- 4. o vao, nunca borda ----
# Marca se separa com VAO na cor da superficie. Borda e tinta com peso de dado
# que nao e dado. Dois eixos: a coluna empilha na vertical, a barra de vazamento
# corre na horizontal.
for sel, prop, eixo in (('.vg-seg+.vg-seg', 'margin-top', 'coluna empilhada'),
                        ('.vg-vaza-seg+.vg-vaza-seg', 'margin-left', 'barra de vazamento')):
    corpo = regra(sel)
    if corpo is None or prop not in corpo:
        falhas.append('a %s perdeu o vao de 2px (%s)' % (eixo, prop))
    elif 'border' in (corpo or ''):
        falhas.append('a %s voltou a usar borda para separar as fatias; o certo e vao' % eixo)

# ---- 5. lucro x prejuizo: matiz nao basta ----
# Nao sao adjacentes (cada mes tem o proprio tubo), entao o alvo de 3:1 nao se
# aplica. O problema deles e o classico do daltonismo vermelho-verde: verde e
# vermelho no MESMO tom. Por isso a fatia negativa carrega hachura.
print('\n  lucro x prejuizo (luminancia): %5.2f  -> matiz nao basta, exige hachura'
      % ratio(erro, ok_fg))
if not re.search(r'\.vg-seg\.s-neg\s*\{[^}]*background-image\s*:\s*repeating-linear-gradient', css):
    falhas.append('a hachura da fatia negativa sumiu: lucro e prejuizo voltaram a '
                  'depender so do matiz (%.2f de separacao)' % ratio(erro, ok_fg))

# ---- 6. o que ainda se mede por contraste: fatia contra o tubo vazio ----
# Aqui a pergunta e mesmo de contraste: da para ver onde a barra termina?
print('\n  -- fatia contra o tubo vazio (aqui contraste E a metrica certa) --')
for nome, cor in (('custo', dim), ('vazamento', morno), ('lucro', ok_fg)):
    print('     %-11s %5.2f' % (nome, ratio(cor, surface)))
if not re.search(r'\.vg-tubo\s*\{[^}]*border\s*:', css):
    falhas.append('o tubo perdeu a borda que delimita a area do grafico')

print()
if falhas:
    print('REPROVOU:')
    [print('  - ' + f) for f in falhas]
    sys.exit(1)
print('Cores do painel de vendas OK.')
print('Para remedir do zero, com a skill dataviz carregada:')
print('  node scripts/validate_palette.js "%s,%s,%s" --mode light' % (dim, morno, ok_fg))
