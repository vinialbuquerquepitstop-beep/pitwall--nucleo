# Prova da atmosfera azul da aba Conteudo (13/08/2026, ampliada em 14/08).
#
# Por que ela existe: trocar o chao de branco para o neutro azulado muda TODO
# contraste da aba, e isso se mede, nao se presume. Foi exatamente o erro da
# secao 4 do handoff v55: tres tokens escolhidos no olho, dois indistinguiveis.
#
# Ate 14/08/2026 esta linha dizia "Secao 5 do plano". AQUELE PLANO NUNCA EXISTIU
# EM DISCO: ele so vivia no contexto da sessao que escreveu este arquivo, e quem
# viesse procurar nao acharia nada. O registro de verdade sao:
#   docs/handoffs/handoff_migracao_pitwall_v56.md   secao 2 (a atmosfera, e a
#                                                   justificativa que apontava
#                                                   para o elemento errado)
#   docs/superpowers/plans/2026-08-14-molde-fatia2.md  secao 4 (o terceiro chao)
# Referencia que aponta para lugar nenhum e pior que referencia nenhuma: ela
# promete um documento e faz o leitor duvidar do que esta lendo.
#
# Roda da raiz: python ferramentas/prova_atmosfera.py
# O que vale e o EXIT CODE, nunca o texto verde.
import sys, pathlib, re
sys.path.insert(0, 'ferramentas')
sys.stdout.reconfigure(encoding='utf-8')
from contraste import ratio

RAIZ = pathlib.Path(__file__).resolve().parent.parent
css = (RAIZ / 'public' / 'app.css').read_text(encoding='utf-8')

# Os valores vem do CSS, nunca copiados para ca: prova que copia o valor
# que deveria vigiar nao vigia nada.
def token(nome):
    m = re.search(re.escape(nome) + r'\s*:\s*(#[0-9A-Fa-f]{6})', css)
    if not m:
        print('REPROVOU:\n  - token %s sumiu do app.css' % nome); sys.exit(1)
    return m.group(1)

PANEL   = token('--panel')        # cartao que flutua
SURFACE = token('--surface')      # chao azulado da bandeja
TEXT    = token('--text')
DIM     = token('--dim')
LINE    = token('--line')

falhas = []

# ---- 1. TEXTO: alvo 4.5:1 nos DOIS chaos -------------------------------------
# O cartao branco e a bandeja tingida convivem na mesma tela, entao todo texto
# tem que passar nos dois. Passar so no branco e como a tela mentir no lugar
# onde ela mais aparece.
print('== texto, alvo 4.5:1 ==')
for nome, cor in (('--text', TEXT), ('--dim', DIM)):
    for chao_n, chao in (('--panel  ' + PANEL, PANEL), ('--surface ' + SURFACE, SURFACE)):
        r = ratio(cor, chao)
        marca = 'OK' if r >= 4.5 else 'REPROVA'
        print('  %-8s %s sobre %-18s %5.2f  [%s]' % (nome, cor, chao_n, r, marca))
        if r < 4.5:
            falhas.append('%s sobre %s tem %.2f, alvo 4.5' % (nome, chao_n.split()[0], r))

# ---- 2. SINAL e IDENTIDADE, medidos contra o chao ONDE ELES VIVEM -----------
# A razao de existir desta prova. Mas o par tem que ser o certo: sinal e
# identidade ficam DENTRO do cartao, entao o chao deles e --panel.
#
# CORRECAO de 13/08/2026, do texto que estava aqui: a versao anterior deste
# comentario usava estes numeros como a justificativa medida para pintar
# .cont-card de branco, dizendo que a barra de nivel do kanban subia de
# 2.83/2.85/2.85 para 3.03/3.06/3.05. Media o elemento ERRADO. Na aba Conteudo
# a barra do cartao e sempre --tp (app.css, bloco "a barra diz o TIPO",
# sobrescreve as seis regras de nivel escritas antes), e --tp mede 4.24 a 6.50
# sobre a bandeja: passaria com o cartao tingido tambem. Provado no Chrome pelo
# harness: aquela barra computa rgb(91, 75, 168), que e --tp-reels.
#
# O que estes numeros REALMENTE guardam continua valendo, e por isso a checagem
# fica: os tres tokens de nivel como barra vivem em .card, na Fila
# (app.css:346-348), sobre --panel, e la a margem e de uma casa decimal
# (3.03/3.06/3.05 contra o alvo de 3.0). Se alguem tingir AQUELE cartao, os
# tres caem para 2.8 e a prova morde. O cartao branco do kanban se justifica
# por gramatica (chao tingido, cartao que flutua, igual Hoje e Fila), nao por
# resgatar um sinal que nao esta ali.
SINAIS = ('--quente', '--morno', '--frio', '--ok', '--erro',
          '--tp-story', '--tp-reels', '--tp-feed', '--tp-carrossel')
print('\n== sinal e identidade sobre o CARTAO (onde eles vivem), alvo 3:1 ==')
for nome in SINAIS:
    cor = token(nome)
    r = ratio(cor, PANEL)
    marca = 'OK' if r >= 3.0 else 'REPROVA'
    print('  %-15s %s sobre o cartao %5.2f  [%s]' % (nome, cor, r, marca))
    if r < 3.0:
        falhas.append('%s tem %.2f sobre o cartao, alvo 3.0: o azul custou um sinal' % (nome, r))

# E a contraprova, que e o que torna a regra estrutural em vez de gosto: os
# mesmos sinais sobre a BANDEJA reprovariam. Por isso o cartao e branco. Se um
# dia alguem devolver .cont-card para --surface, esta assercao explica o preco.
print('\n== contraprova: os mesmos sinais sobre a BANDEJA ==')
perdem = [n for n in SINAIS if ratio(token(n), SURFACE) < 3.0]
print('  reprovariam sobre o chao: %s' % (', '.join(perdem) if perdem else '(nenhum)'))
if not perdem:
    falhas.append('a contraprova parou de morder: se nenhum sinal reprova sobre a '
                  'bandeja, a regra "cartao e branco" perdeu a razao medida')

# ---- 2a. O trilho de TIPO, que e a barra que o kanban realmente desenha -----
# Fica aqui para a correcao acima ser reexecutavel em vez de virar um comentario
# que ninguem confere: se um dia --tp reprovar sobre a bandeja, o cartao branco
# passa a ter justificativa de contraste de verdade, e este texto tem que mudar
# junto. Enquanto os quatro passarem nos DOIS chaos, a razao do cartao branco e
# gramatica, nao contraste.
print('\n== trilho de TIPO nos DOIS chaos (a barra do cartao do kanban) ==')
TIPOS = ('--tp-story', '--tp-reels', '--tp-feed', '--tp-carrossel')
for nome in TIPOS:
    cor = token(nome)
    rp, rs = ratio(cor, PANEL), ratio(cor, SURFACE)
    print('  %-15s cartao %5.2f · bandeja %5.2f' % (nome, rp, rs))
    if rs < 3.0:
        falhas.append('%s tem %.2f sobre a bandeja: o cartao branco deixou de ser '
                      'escolha de gramatica e virou exigencia de contraste' % (nome, rs))

# ---- 2b. O azul dos rotulos de grupo ----------------------------------------
# Pedido do dono em 13/08/2026: dia da semana e cabecalho de coluna em azul.
# O rotulo de coluna fica sobre a BANDEJA, o do dia fica sobre o CARTAO: os
# dois chaos precisam passar, senao o azul le bem num lugar e mal no outro.
print('\n== azul dos rotulos de grupo, alvo 4.5:1 (e texto) ==')
ACCENT = token('--accent')
for chao_n, chao in (('cartao  ' + PANEL, PANEL), ('bandeja ' + SURFACE, SURFACE)):
    r = ratio(ACCENT, chao)
    marca = 'OK' if r >= 4.5 else 'REPROVA'
    print('  --accent %s sobre %-16s %5.2f  [%s]' % (ACCENT, chao_n, r, marca))
    if r < 4.5:
        falhas.append('--accent sobre %s tem %.2f, alvo 4.5' % (chao_n.split()[0], r))

# ---- 3. Por que a sombra e OBRIGATORIA, medido ------------------------------
# O harness ja dizia "a bandeja sozinha nao separa: mede 1.07", mas o numero
# vivia num comentario. Aqui ele vira assercao: se cartao e bandeja separassem
# sozinhos, a sombra seria enfeite; como NAO separam, ela e estrutural.
sep = ratio(PANEL, SURFACE)
print('\n== cartao x bandeja ==')
print('  %s sobre %s = %.2f (1.00 = indistinguivel)' % (PANEL, SURFACE, sep))
if sep >= 1.2:
    falhas.append('cartao e bandeja separam sozinhos (%.2f): a sombra virou enfeite, '
                  'reveja a regra antes de mante-la' % sep)
else:
    print('  -> separacao insuficiente por cor: a SOMBRA e estrutural, nao enfeite.')
    # E entao ela tem que existir de fato nos dois cartoes da aba.
    for sel in ('.mol-dia', '.cont-card'):
        corpo = re.search(re.escape(sel) + r'\s*\{([^}]*)\}', css)
        if not corpo or 'box-shadow' not in corpo.group(1):
            falhas.append('%s esta sobre bandeja sem box-shadow: sem ela o cartao '
                          'nao separa do chao (mede %.2f)' % (sel, sep))
        else:
            print('  -> %-11s tem box-shadow  [OK]' % sel)

# ---- 4. O filete continua visivel sobre o chao ------------------------------
# Filete nao e faixa semantica: nao se cobra 3:1 dele. Mas se ele sumir no chao
# a bandeja perde a borda e o agrupamento evapora, que e o defeito que este
# trabalho veio consertar.
rl = ratio(LINE, SURFACE)
print('\n== filete ==')
print('  --line %s sobre o chao %.2f' % (LINE, rl))
if rl <= 1.02:
    falhas.append('--line sumiu no chao novo (%.2f): a bandeja fica sem borda' % rl)

# ---- 5. Os chips da cobranca (Fatia 2) e o TERCEIRO chao --------------------
# Achado de 14/08/2026: o cartao de HOJE nao e --panel, e --accent-tint
# (app.css, .mol-dia.hoje). Ele existe desde a Fatia 1 e NENHUMA prova o media,
# porque ate entao so havia texto neutro ali dentro. A Fatia 2 poe chip colorido
# dentro dele, entao o terceiro chao passa a valer tanto quanto os outros dois.
#
# token() so casa hex, e --accent-tint e rgba: ele e COMPOSTO sobre o cartao,
# que e o que o navegador realmente pinta.
def compor(nome, base):
    m = re.search(re.escape(nome) + r'\s*:\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)', css)
    if not m:
        print('REPROVOU:\n  - token %s sumiu ou deixou de ser rgba' % nome); sys.exit(1)
    r, g, b, a = int(m.group(1)), int(m.group(2)), int(m.group(3)), float(m.group(4))
    bs = [int(base[i:i + 2], 16) for i in (1, 3, 5)]
    return '#%02X%02X%02X' % tuple(round(bs[i] * (1 - a) + (r, g, b)[i] * a) for i in range(3))

HOJE = compor('--accent-tint', PANEL)
CHIPS = ('--ok-fg', '--quente-fg', '--morno-fg', '--frio-fg', '--dim')
print('\n== chips da cobranca nos TRES chaos, alvo 4.5:1 (sao texto) ==')
print('  o cartao de hoje e --accent-tint sobre o cartao = %s' % HOJE)
for nome in CHIPS:
    cor = token(nome)
    medidas = [('cartao', PANEL), ('bandeja', SURFACE), ('hoje', HOJE)]
    linha = '  %-12s %s' % (nome, cor)
    for rot, chao in medidas:
        r = ratio(cor, chao)
        linha += '  %s %5.2f' % (rot, r)
        if r < 4.5:
            falhas.append('%s tem %.2f sobre o chao "%s", alvo 4.5: a cobranca fica '
                          'ilegivel justamente no dia que mais importa' % (nome, r, rot))
    print(linha)

# E a contraprova do canal, na mesma forma da secao 3: a medida nao serve para
# aprovar a cor, serve para dizer se o ICONE e enfeite ou estrutura.
#
# Corrigido em 14/08/2026, do limiar que estava aqui primeiro: a versao anterior
# reprovava quando --quente-fg e --dim mediam menos de 1.5, como se contraste
# baixo entre eles fosse defeito. Contraste mede LUMINANCIA, nao matiz: laranja
# queimado e cinza azulado sao obviamente diferentes aos olhos e quase iguais em
# brilho. O 1.12 medido nao condena a cor, ele repete a licao dos 7 trilhos
# (colisoes de 1.14 a 1.44): matiz sozinho nao separa, entao o icone carrega a
# distincao. A checagem certa nao e no numero, e na existencia do icone.
sep = ratio(token('--quente-fg'), token('--dim'))
print('\n== urgencia x divergencia: o icone e enfeite ou estrutura? ==')
print('  --quente-fg contra --dim = %.2f (1.00 = indistinguivel em brilho)' % sep)
if sep >= 3.0:
    falhas.append('urgencia e divergencia ja separam sozinhas (%.2f): o icone deixou '
                  'de ser estrutural, reveja a regra antes de mante-la' % sep)
else:
    print('  -> matiz sozinho nao separa: o ICONE e estrutural, nao enfeite.')
    js = (RAIZ / 'public' / 'app.js').read_text(encoding='utf-8')
    # SO o bloco MOL_ICONE. Varrer o arquivo inteiro pegava o ICONE_MAPA das 7
    # categorias junto e imprimia 20 onde existem 6: numero inflado numa prova e
    # pior do que numero nenhum, porque ele parece medido.
    blk = re.search(r'var MOL_ICONE\s*=\s*\{(.*?)\};', js, re.S)
    if not blk:
        print('REPROVOU:\n  - MOL_ICONE sumiu do app.js'); sys.exit(1)
    icones = dict(re.findall(r"[\"']?([a-z-]+)[\"']?:('<(?:path|circle)[^']*')", blk.group(1)))
    for cod in ('existe', 'no-ar', 'falta', 'atrasado', 'espera', 'fora'):
        if cod not in icones:
            falhas.append('o chip "%s" perdeu o desenho em MOL_ICONE: sem icone a '
                          'palavra fica sozinha carregando o significado' % cod)
    if 'atrasado' in icones and 'fora' in icones and icones['atrasado'] == icones['fora']:
        falhas.append('atrasado e fora do molde desenham o MESMO icone: com %.2f de '
                      'separacao em brilho, os dois passam a ser a mesma coisa' % sep)
    if not re.search(r'\.mol-ico\s*\{', css):
        falhas.append('.mol-ico ficou sem regra no CSS: o svg entra na tela sem '
                      'tamanho nem stroke, ou seja, invisivel')
    else:
        print('  -> %d icones nomeados, todos com regra em .mol-ico  [OK]' % len(icones))

print()
if falhas:
    print('REPROVOU:'); [print('  - ' + f) for f in falhas]; sys.exit(1)
print('ATMOSFERA OK. O chao ficou azul e nenhum sinal foi cobrado por isso.')
