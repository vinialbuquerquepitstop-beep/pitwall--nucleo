# -*- coding: utf-8 -*-
"""
Mock do Dashboard de Performance de Vendas, no formato da referencia que o dono
trouxe em 12/08/2026 (imagem gerada, 13 paineis, cards com icone colorido,
roscas, P&L, ranking, tabela de canal e insights).

DUAS DECISOES DO DONO, CONTRA A RECOMENDACAO, REGISTRADAS:
 1. A paleta da referencia entra AO PE DA LETRA (chips azul/verde/roxo/laranja,
    roscas coloridas). Isso quebra a lei da referencia-visual-v3, que autoriza o
    azul da marca em quatro lugares e mais nenhum, e que ja reprovou barra
    colorida por categoria duas vezes. Os hexes novos vivem em --d-*, com este
    prefixo justamente para ficar OBVIO o que e paleta importada e o que e token
    medido do projeto.
 2. Mora nas DUAS telas: dashboard completo na aba Dashboard (ANALISE) e a faixa
    de 5 KPIs no topo da aba Vendas.

O QUE NAO EXISTE E POR ISSO NAO FOI DESENHADO:
 - "Origens de trafego / sessoes": o sistema nao tem analytics nenhum. O slot
   recebeu MARGEM POR CONDICAO, que e real e responde uma pergunta de compra.
 - "Itens vendidos": 1 aparelho por venda, seria o mesmo numero de Vendas.
 - "Devolucoes" e "Impostos" no P&L: nao existem colunas para isso.
 - Foto do produto no ranking: o catalogo nao guarda imagem.
 - A linha diaria virou COLUNA POR MES: 3 vendas em 73 dias sao 3 pontos, e o
   v52 ja reprovou serie temporal sobre 3 pontos como decoracao. A regra de
   degradacao esta escrita no proprio card.

HONESTIDADE DO DADO: tudo real, lido em 12/08/2026 da v_venda e da lead.
"""
import sys, pathlib, math

sys.stdout.reconfigure(encoding='utf-8')

RAIZ = pathlib.Path(__file__).resolve().parent.parent
css_app = (RAIZ / 'public' / 'app.css').read_text(encoding='utf-8')
fontes = (RAIZ / 'ferramentas' / 'fontes.css').read_text(encoding='utf-8')

# =========================================================== dado real
MESES = {
    '2026-07': dict(rot='jul/2026', n=2, fat=13950, custo=13100, vaza=180, luc=670, leads=19),
    '2026-08': dict(rot='ago/2026', n=1, fat=2400, custo=1850, vaza=124, luc=426, leads=2),
}
TRI = dict(rot='trimestre', n=3, fat=16350, custo=14950, vaza=304, luc=1096, leads=21,
           frete=180, taxas=124)

VENDAS = [
    ('VENDA-0002', 'iPhone 17 Pro Max', 'lacrado', 'concluida', 8400, 7950, 90, 360, 'indicacao'),
    ('VENDA-0001', '15 Pro Max', 'lacrado', 'concluida', 5550, 5150, 90, 310, None),
    ('VENDA-0004', 'iPhone 13', 'seminovo', 'pre_venda', 2400, 1850, 124, 426, None),
]
# leads por origem (21 ativos) e vendas por origem
CANAIS = [
    ('Indicação',          'indicacao',          4, 1, 8400, 360),
    ('WhatsApp direto',    'whatsapp_direto',    9, 0, 0, 0),
    ('WhatsApp Status',    'whatsapp_status',    3, 0, 0, 0),
    ('Instagram',          'instagram',          2, 0, 0, 0),
    ('Parceria PAG local', 'parceria_pag_local', 1, 0, 0, 0),
    ('sem origem',         None,                 2, 2, 7950, 736),
]
STATUS_VENDA = [('Concluída', 'concl', 2), ('Pré-venda', 'pre', 1),
                ('Arquivada', 'arq', 1), ('Cancelada', 'canc', 0)]
CONDICOES = [('Lacrado', 2, 13950, 670), ('Seminovo', 1, 2400, 426)]


def brl(v, cent=True):
    s = f'{abs(v):,.2f}'.replace(',', '#').replace('.', ',').replace('#', '.')
    if not cent:
        s = s.split(',')[0]
    return ('−' if v < 0 else '') + 'R$ ' + s


def pct(parte, todo, casas=1):
    if not todo:
        return '—'
    v = 100 * parte / todo
    return f'{v:.{casas}f}'.replace('.', ',') + '%'


def num(v, casas=1):
    return f'{v:.{casas}f}'.replace('.', ',')


# =========================================================== o anel
def rosca(fatias, tam=150, grossura=22, centro_num='', centro_rot=''):
    """fatias: (classe, valor). Vao de 2px na cor da superficie, arco minimo."""
    r, vao, arco_min = 42.0, 2.4, 3.0
    circ = 2 * math.pi * r
    total = sum(f[1] for f in fatias) or 1
    brutos = [max(circ * v / total, arco_min) if v > 0 else 0.0 for _, v in fatias]
    excesso = sum(brutos) - circ
    grandes = [i for i, b in enumerate(brutos) if b > arco_min * 2]
    if excesso > 0 and grandes:
        soma = sum(brutos[i] for i in grandes)
        for i in grandes:
            brutos[i] -= excesso * brutos[i] / soma
    partes, giro = [], 0.0
    for (cls, val), bruto in zip(fatias, brutos):
        if bruto <= 0:
            continue
        traco = max(bruto - vao, 0.6)
        partes.append(
            f'<circle class="ro-seg f-{cls}" cx="50" cy="50" r="{r}" fill="none" '
            f'stroke-width="{grossura / tam * 100:.2f}" '
            f'stroke-dasharray="{traco:.2f} {circ - traco:.2f}" '
            f'stroke-dashoffset="{-giro:.2f}"/>')
        giro += bruto
    centro = ''
    if centro_num:
        centro = (f'<span class="ro-centro"><b>{centro_num}</b>'
                  f'<em>{centro_rot}</em></span>')
    return (f'<div class="ro-caixa" style="width:{tam}px;height:{tam}px">'
            f'<svg class="ro-svg" viewBox="0 0 100 100" aria-hidden="true">'
            f'<circle class="ro-trilho" cx="50" cy="50" r="{r}" fill="none" '
            f'stroke-width="{grossura / tam * 100:.2f}"/>{"".join(partes)}</svg>{centro}</div>')


# =========================================================== icones
ICO = {
    'dinheiro': '<path d="M12 2v20M17 5.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.9 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3"/>',
    'lucro': '<path d="M3 17l6-6 4 4 8-8M21 7v6h-6"/>',
    'margem': '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9h-9z"/>',
    'ticket': '<path d="M20 12a2 2 0 0 1 2-2V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a2 2 0 0 1-2-2z"/><path d="M9 7v10"/>',
    'alvo': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
}


def icone(nome, tom):
    return (f'<span class="kp-ico t-{tom}"><svg viewBox="0 0 24 24" fill="none" '
            f'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" '
            f'stroke-linejoin="round" aria-hidden="true">{ICO[nome]}</svg></span>')


# =========================================================== KPI
def delta(atual, anterior, pp=False, inverte=False):
    """Devolve a linha de variacao. pp=True compara pontos percentuais."""
    if anterior is None:
        return '<span class="kp-var kp-sem">sem período anterior na base</span>'
    if pp:
        d = atual - anterior
        txt = ('+' if d >= 0 else '−') + num(abs(d)) + ' p.p.'
    else:
        if not anterior:
            return '<span class="kp-var kp-sem">sem base de comparação</span>'
        d = 100 * (atual - anterior) / abs(anterior)
        txt = ('+' if d >= 0 else '−') + num(abs(d)) + '%'
    sobe = d >= 0
    bom = sobe if not inverte else not sobe
    seta = '↑' if sobe else '↓'
    return (f'<span class="kp-var {"v-bom" if bom else "v-ruim"}">{seta} {txt}</span>'
            f'<span class="kp-vs">vs jul/2026</span>')


def kpi(rot, valor, ico, tom, var):
    return (f'<article class="kp"><div class="kp-topo"><div>'
            f'<p class="kp-rot">{rot}</p><p class="kp-num">{valor}</p></div>'
            f'{icone(ico, tom)}</div><p class="kp-pe">{var}</p></article>')


def faixa_kpi(janela='tri'):
    if janela == 'tri':
        a = TRI
        # Sem periodo anterior na base, o rodape NAO repete a mesma frase cinco
        # vezes: cada card cai para um contexto REAL e diferente. A ausencia de
        # comparacao e dita UMA vez, no cabecalho, ao lado do "Comparar com".
        def ctx(t):
            return f'<span class="kp-var kp-sem">{t}</span>'
        cards = [
            kpi('Faturamento', brl(a['fat']), 'dinheiro', 'azul',
                ctx(f'{a["n"]} vendas · 2 meses')),
            kpi('Lucro', brl(a['luc']), 'lucro', 'verde',
                ctx(f'{brl(a["luc"] / a["n"])} por venda')),
            kpi('Margem', pct(a['luc'], a['fat'], 2), 'margem', 'laranja',
                ctx(f'{brl(a["vaza"])} de despesa comeu {pct(a["vaza"], a["luc"] + a["vaza"])}')),
            kpi('Ticket médio', brl(a['fat'] / a['n']), 'ticket', 'roxo',
                ctx(f'maior {brl(8400, False)} · menor {brl(2400, False)}')),
            kpi('Conversão', pct(a['n'], a['leads'], 1), 'alvo', 'vermelho',
                ctx(f'{a["n"]} de {a["leads"]} leads')),
        ]
    else:
        a, b = MESES['2026-08'], MESES['2026-07']
        cards = [
            kpi('Faturamento', brl(a['fat']), 'dinheiro', 'azul', delta(a['fat'], b['fat'])),
            kpi('Lucro', brl(a['luc']), 'lucro', 'verde', delta(a['luc'], b['luc'])),
            kpi('Margem', pct(a['luc'], a['fat'], 2), 'margem', 'laranja',
                delta(100 * a['luc'] / a['fat'], 100 * b['luc'] / b['fat'], pp=True)),
            kpi('Ticket médio', brl(a['fat'] / a['n']), 'ticket', 'roxo',
                delta(a['fat'] / a['n'], b['fat'] / b['n'])),
            kpi('Conversão', pct(a['n'], a['leads'], 1), 'alvo', 'vermelho',
                delta(100 * a['n'] / a['leads'], 100 * b['n'] / b['leads'], pp=True)),
        ]
    return f'<div class="kp-faixa">{"".join(cards)}</div>'


# =========================================================== cards
def card(titulo, corpo, extra='', cls=''):
    top = (f'<div class="cd-top"><h3>{titulo}</h3>{extra}</div>' if titulo else '')
    return f'<article class="cd {cls}">{top}{corpo}</article>'


def card_canal():
    dados = [(rot, fat) for rot, _, _, nv, fat, _ in CANAIS if fat > 0]
    # "sem origem" NUNCA pega cor de canal: verde ali leria como um canal que vai
    # bem, quando e dado faltando. Cinza e a cor de ausencia no resto do painel.
    tons_bons = ['azul', 'verde', 'laranja', 'roxo', 'vermelho']
    tons, i = [], 0
    for rot, _ in dados:
        if rot == 'sem origem':
            tons.append('cinza')
        else:
            tons.append(tons_bons[i % len(tons_bons)])
            i += 1
    fatias = [(tons[j], f) for j, (_, f) in enumerate(dados)]
    tot = sum(f for _, f in dados)
    leg = ''.join(
        f'<li><i class="f-{tons[j]}"></i><span>{rot}</span>'
        f'<b>{brl(fat)}</b><em>{pct(fat, tot)}</em></li>'
        for j, (rot, fat) in enumerate(dados))
    return card('Faturamento por canal',
                f'<div class="ro-linha">{rosca(fatias, 150, 22, brl(tot, False), "Total")}</div>'
                f'<ul class="ro-leg">{leg}</ul>',
                cls='c-canal')


def card_tempo():
    mx = max(m['fat'] for m in MESES.values())
    cols = ''
    for k in sorted(MESES):
        m = MESES[k]
        h = round(100 * m['fat'] / mx)
        hl = round(100 * m['luc'] / mx) or 1
        cols += (
            f'<div class="tp-col"><div class="tp-par">'
            f'<span class="tp-b b-fat" style="height:{h}%"><i>{brl(m["fat"], False)}</i></span>'
            f'<span class="tp-b b-luc" style="height:{max(hl, 2)}%"><i>{brl(m["luc"], False)}</i></span>'
            f'</div><span class="tp-rot">{m["rot"]}</span></div>')
    eixo = ''.join(f'<span>{brl(mx * p / 100, False)}</span>' for p in (100, 66, 33, 0))
    return card('Faturamento ao longo do tempo',
                '<div class="tp-leg"><span><i class="f-azul"></i>faturamento</span>'
                '<span><i class="f-verde"></i>lucro</span></div>'
                f'<div class="tp-graf"><div class="tp-eixo">{eixo}</div>'
                f'<div class="tp-cols">{cols}</div></div>'
                '<p class="cd-pe">2 meses na janela. A linha diária volta sozinha a partir de '
                '<b>8 pontos</b>: 3 vendas em 73 dias seriam 3 bolinhas numa reta.</p>',
                cls='c-tempo')


def card_financeiro():
    a = TRI
    bruta = a['fat'] - a['custo']
    linhas = [
        ('Faturamento', brl(a['fat']), '', 'l-forte'),
        ('(−) Custo dos aparelhos', '− ' + brl(a['custo']), '', ''),
        ('(=) Margem bruta', brl(bruta), '', 'l-sub'),
        ('(−) Frete', '− ' + brl(a['frete']), '', ''),
        ('(−) Taxas', '− ' + brl(a['taxas']), '', ''),
        ('(=) Lucro líquido', brl(a['luc']), 'l-luc', 'l-total'),
    ]
    corpo = ''.join(
        f'<li class="{cls}"><span>{rot}</span><b class="{extra}">{val}</b></li>'
        for rot, val, extra, cls in linhas)
    return card('Resumo financeiro', f'<ul class="fn">{corpo}</ul>'
                f'<p class="cd-pe">Não existem <b>devoluções</b> nem <b>impostos</b> no '
                f'cadastro de venda: as duas linhas da referência ficaram de fora em vez de '
                f'nascerem zeradas.</p>', cls='c-fin')


def card_produtos():
    itens = sorted(VENDAS, key=lambda v: v[4], reverse=True)
    li = ''
    for i, (code, modelo, cond, st, valor, custo, vaza, luc, org) in enumerate(itens, 1):
        li += (f'<li><span class="pr-i">{i}</span>'
               f'<span class="pr-nome">{modelo}<em>{cond} · margem {pct(luc, valor)}</em></span>'
               f'<span class="pr-un">1 un.</span><b>{brl(valor)}</b></li>')
    return card('Aparelhos mais vendidos', f'<ul class="pr">{li}</ul>',
                '<button class="cd-link">Ver todos</button>', cls='c-prod')


def card_desempenho():
    tr = ''
    for rot, cod, leads, nv, fat, luc in CANAIS:
        conv = pct(nv, leads) if leads else '—'
        larg = min(100, 100 * nv / leads) if leads else 0
        tk = brl(fat / nv) if nv else '—'
        tr += (f'<tr><td>{rot}</td><td class="n">{leads}</td><td class="n">{nv}</td>'
               f'<td class="n">{brl(fat) if fat else "—"}</td><td class="n">{tk}</td>'
               f'<td class="n conv">{conv}'
               f'<span class="cv-tubo"><span class="cv-b" style="width:{larg:.0f}%"></span></span>'
               f'</td></tr>')
    tot_leads = sum(c[2] for c in CANAIS)
    tot_v = sum(c[3] for c in CANAIS)
    tot_f = sum(c[4] for c in CANAIS)
    return card('Desempenho por canal',
                '<div class="tb-rolo"><table class="tb"><thead><tr><th>Canal</th>'
                '<th class="n">Leads</th><th class="n">Vendas</th><th class="n">Faturamento</th>'
                '<th class="n">Ticket</th><th class="n">Conversão</th></tr></thead>'
                f'<tbody>{tr}</tbody><tfoot><tr><td>Total</td><td class="n">{tot_leads}</td>'
                f'<td class="n">{tot_v}</td><td class="n">{brl(tot_f)}</td>'
                f'<td class="n">{brl(tot_f / tot_v)}</td>'
                f'<td class="n">{pct(tot_v, tot_leads)}</td></tr></tfoot></table></div>',
                cls='c-desemp')


def card_status():
    tons = {'concl': 'verde', 'pre': 'azul', 'arq': 'cinza', 'canc': 'vermelho'}
    fatias = [(tons[cod], n) for _, cod, n in STATUS_VENDA]
    tot = sum(n for _, _, n in STATUS_VENDA)
    leg = ''.join(f'<li><i class="f-{tons[cod]}"></i><span>{rot}</span>'
                  f'<b>{n}</b><em>{pct(n, tot)}</em></li>' for rot, cod, n in STATUS_VENDA)
    return card('Status das vendas',
                f'<div class="ro-linha">{rosca(fatias, 140, 20, str(tot), "Total")}</div>'
                f'<ul class="ro-leg">{leg}</ul>', cls='c-status')


def card_condicao():
    mx = max(100 * l / f for _, _, f, l in CONDICOES)
    li = ''
    for rot, n, fat, luc in CONDICOES:
        mg = 100 * luc / fat
        li += (f'<li><span class="cn-rot">{rot}</span>'
               f'<span class="cn-tubo"><span class="cn-b" style="width:{100 * mg / mx:.0f}%"></span></span>'
               f'<b>{pct(luc, fat)}</b><em>{n} un.</em></li>')
    return card('Margem por condição',
                f'<ul class="cn">{li}</ul>'
                '<p class="cd-pe">Ocupa o slot de <b>origens de tráfego</b> da referência: '
                'o sistema não tem analytics, e sessão inventada não é dado. '
                'A última coluna é o nº de vendas: <b>uma venda não é tendência</b>.</p>',
                cls='c-cond')


def card_insights():
    ins = [
        ('ruim', 'WhatsApp direto não converte',
         '9 leads, nenhuma venda. É o seu maior canal de entrada e o pior de saída.'),
        ('bom', 'Indicação é o melhor canal',
         '4 leads, 1 venda: 25,0% de conversão, contra 14,3% da média.'),
        ('atencao', 'Seminovo rende 3,7x mais margem',
         'Seminovo 17,8% contra 4,8% do lacrado. Apoiado em 1 venda: confirmar antes de virar regra.'),
        ('atencao', '2 de 3 vendas sem origem',
         'R$ 7.950 de faturamento sem canal registrado. Metade do dashboard fica cega assim.'),
    ]
    li = ''.join(f'<li class="in-{t}"><span class="in-p"></span><div><b>{tit}</b>'
                 f'<em>{txt}</em></div></li>' for t, tit, txt in ins)
    return card('Insights', f'<ul class="ins">{li}</ul>'
                '<button class="cd-cta">Ver todas as vendas →</button>', cls='c-ins')


def cabecalho(janela='tri'):
    # O seletor tem que CONCORDAR com a janela desenhada: a primeira versao
    # marcava "Mes" enquanto o recorte dizia 01/06 a 12/08, e um cabecalho que
    # discorda do proprio dado e a maneira mais barata de a tela mentir.
    segs = ['Dia', 'Semana', 'Mês', 'Trimestre', 'Ano']
    on = 'Trimestre' if janela == 'tri' else 'Mês'
    seg = ''.join(f'<button class="{"on" if s == on else ""}">{s}</button>' for s in segs)
    if janela == 'tri':
        rec, cmp_ = '01/06/2026 – 12/08/2026', 'Comparar: sem período anterior na base'
    else:
        rec, cmp_ = '01/08/2026 – 31/08/2026', 'Comparar com: jul/2026'
    return ('<header class="dh">'
            '<div class="dh-tit"><span class="dh-ico"><svg viewBox="0 0 24 24" fill="none" '
            'stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span>'
            '<div><h1>Performance de Vendas</h1><p>Visão geral do seu negócio</p></div></div>'
            f'<div class="dh-per"><button class="dh-cx">{rec}</button>'
            f'<button class="dh-cx{"" if janela != "tri" else " dh-vazio"}">{cmp_}</button></div>'
            f'<div class="dh-seg">{seg}</div>'
            '</header>')


def dashboard(janela='tri'):
    return (f'<div class="dash">{cabecalho(janela)}{faixa_kpi(janela)}'
            f'<div class="dash-l2">{card_canal()}{card_tempo()}{card_financeiro()}{card_produtos()}</div>'
            f'<div class="dash-l3">{card_desempenho()}{card_status()}{card_condicao()}{card_insights()}</div>'
            f'</div>')


# =========================================================== CSS
CSS = """
/* ============================================================
   PALETA IMPORTADA DA REFERENCIA. Prefixo --d- de proposito: e
   o que NAO passou pelo validador do projeto. Decisao consciente
   do dono em 12/08/2026, contra a recomendacao.
   ============================================================ */
.dash{
  --d-azul:#3B82F6;   --d-azul-bg:#EFF6FF;
  --d-verde:#22C55E;  --d-verde-bg:#ECFDF5;
  --d-laranja:#F97316;--d-laranja-bg:#FFF7ED;
  --d-roxo:#8B5CF6;   --d-roxo-bg:#F5F3FF;
  --d-verm:#EF4444;   --d-verm-bg:#FEF2F2;
  --d-cinza:#CBD5E1;  --d-cinza-bg:#F1F5F9;
  --d-up:#16A34A;     --d-down:#DC2626;
  --d-linha:#E5E7EB;  --d-fundo:#F8FAFC;  --d-card:#FFFFFF;
  --d-txt:#0F172A;    --d-dim:#64748B;
  --d-r:12px;
  background:var(--d-fundo);padding:18px;border-radius:var(--d-r);
  color:var(--d-txt);font-family:var(--body);
}
.f-azul{background:var(--d-azul)}   .ro-seg.f-azul{stroke:var(--d-azul)}
.f-verde{background:var(--d-verde)} .ro-seg.f-verde{stroke:var(--d-verde)}
.f-laranja{background:var(--d-laranja)}.ro-seg.f-laranja{stroke:var(--d-laranja)}
.f-roxo{background:var(--d-roxo)}   .ro-seg.f-roxo{stroke:var(--d-roxo)}
.f-vermelho{background:var(--d-verm)}.ro-seg.f-vermelho{stroke:var(--d-verm)}
.f-cinza{background:var(--d-cinza)} .ro-seg.f-cinza{stroke:var(--d-cinza)}

/* ---- cabecalho ---- */
.dh{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:16px}
.dh-tit{display:flex;align-items:center;gap:11px;margin-right:auto}
.dh-ico{width:36px;height:36px;border-radius:9px;background:var(--d-azul-bg);
  color:var(--d-azul);display:grid;place-items:center}
.dh-ico svg{width:19px;height:19px}
.dh h1{font-family:var(--display);font-size:19px;font-weight:600;margin:0;letter-spacing:-.01em}
.dh p{margin:1px 0 0;font-size:12px;color:var(--d-dim)}
.dh-per{display:flex;gap:8px}
.dh-cx{font-family:var(--body);font-size:12.5px;color:var(--d-txt);background:var(--d-card);
  border:1px solid var(--d-linha);border-radius:9px;padding:8px 13px;cursor:pointer}
.dh-seg{display:flex;background:var(--d-card);border:1px solid var(--d-linha);
  border-radius:9px;padding:3px;gap:2px}
.dh-seg button{font-family:var(--body);font-size:12.5px;color:var(--d-dim);background:none;
  border:0;border-radius:7px;padding:6px 12px;cursor:pointer}
.dh-seg button.on{background:var(--d-azul-bg);color:var(--d-azul);font-weight:500}

/* ---- faixa de KPI ---- */
.kp-faixa{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:12px}
.kp{background:var(--d-card);border:1px solid var(--d-linha);border-radius:var(--d-r);
  padding:15px 16px}
.kp-topo{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.kp-rot{margin:0;font-size:12.5px;color:var(--d-dim)}
.kp-num{margin:5px 0 0;font-family:var(--display);font-size:23px;font-weight:600;
  letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap}
.kp-ico{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex:0 0 auto}
.kp-ico svg{width:17px;height:17px}
.kp-ico.t-azul{background:var(--d-azul-bg);color:var(--d-azul)}
.kp-ico.t-verde{background:var(--d-verde-bg);color:var(--d-verde)}
.kp-ico.t-laranja{background:var(--d-laranja-bg);color:var(--d-laranja)}
.kp-ico.t-roxo{background:var(--d-roxo-bg);color:var(--d-roxo)}
.kp-ico.t-vermelho{background:var(--d-verm-bg);color:var(--d-verm)}
.kp-pe{margin:11px 0 0;font-size:11.5px;display:flex;align-items:baseline;gap:5px;flex-wrap:wrap}
.kp-var{font-weight:600;font-variant-numeric:tabular-nums}
.kp-var.v-bom{color:var(--d-up)} .kp-var.v-ruim{color:var(--d-down)}
.kp-var.kp-sem{color:var(--d-dim);font-weight:400}
.kp-vs{color:var(--d-dim)}

/* ---- grade dos cards ---- */
.dash-l2{display:grid;grid-template-columns:2.3fr 3.5fr 2.5fr 2.7fr;gap:12px;margin-bottom:12px}
/* a tabela de canal e o card com mais colunas do painel: com 3.2fr ela cortava
   Ticket e Conversao, e coluna cortada e coluna que nao existe. */
.dash-l3{display:grid;grid-template-columns:4.2fr 2fr 2fr 2.3fr;gap:12px}
.dh-cx.dh-vazio{color:var(--d-dim)}
.cd{background:var(--d-card);border:1px solid var(--d-linha);border-radius:var(--d-r);
  padding:15px 16px;min-width:0;display:flex;flex-direction:column}
.cd-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
.cd h3{font-family:var(--display);font-size:14px;font-weight:600;margin:0;letter-spacing:-.01em}
.cd-link{font-family:var(--body);font-size:12px;color:var(--d-azul);background:none;border:0;
  cursor:pointer}
.cd-pe{margin:11px 0 0;font-size:11px;color:var(--d-dim);line-height:1.5}
.cd-pe b{color:var(--d-txt);font-weight:500}

/* ---- rosca ---- */
.ro-linha{display:grid;place-items:center;padding:4px 0 12px}
.ro-caixa{position:relative}
.ro-svg{width:100%;height:100%;transform:rotate(-90deg)}
.ro-trilho{stroke:var(--d-fundo)}
.ro-seg{stroke-linecap:butt}
.ro-centro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:1px}
.ro-centro b{font-family:var(--display);font-size:16px;font-weight:600;letter-spacing:-.01em}
.ro-centro em{font-size:11px;font-style:normal;color:var(--d-dim)}
.ro-leg{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.ro-leg li{display:grid;grid-template-columns:9px 1fr auto auto;align-items:center;gap:8px;
  font-size:12.5px}
.ro-leg i{width:9px;height:9px;border-radius:50%}
.ro-leg span{color:var(--d-txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ro-leg b{font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}
.ro-leg em{font-style:normal;color:var(--d-dim);font-variant-numeric:tabular-nums;
  min-width:42px;text-align:right}

/* ---- tempo ---- */
.tp-leg{display:flex;gap:14px;font-size:12px;color:var(--d-dim);margin-bottom:10px}
.tp-leg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px}
.tp-graf{display:grid;grid-template-columns:auto 1fr;gap:10px;flex:1;min-height:190px}
.tp-eixo{display:flex;flex-direction:column;justify-content:space-between;font-size:10.5px;
  color:var(--d-dim);font-variant-numeric:tabular-nums;text-align:right;padding-bottom:20px}
.tp-cols{display:flex;align-items:flex-end;justify-content:space-around;gap:20px;
  border-left:1px solid var(--d-linha);border-bottom:1px solid var(--d-linha);padding:0 16px}
.tp-col{display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end}
.tp-par{display:flex;align-items:flex-end;gap:6px;height:100%;padding-top:14px}
.tp-b{position:relative;width:30px;border-radius:5px 5px 0 0;display:block}
.tp-b i{position:absolute;top:-15px;left:50%;transform:translateX(-50%);font-style:normal;
  font-size:10px;color:var(--d-dim);white-space:nowrap;font-variant-numeric:tabular-nums}
.tp-b.b-fat{background:var(--d-azul)} .tp-b.b-luc{background:var(--d-verde)}
.tp-rot{font-size:11.5px;color:var(--d-dim);padding-top:6px}

/* ---- financeiro ---- */
.fn{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;flex:1}
.fn li{display:flex;justify-content:space-between;align-items:baseline;gap:10px;
  font-size:12.5px;padding:7px 0}
.fn li b{font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}
.fn li span{color:var(--d-dim)}
.fn li.l-forte span,.fn li.l-sub span,.fn li.l-total span{color:var(--d-txt);font-weight:500}
.fn li.l-sub{border-top:1px solid var(--d-linha);margin-top:4px;padding-top:9px}
.fn li.l-sub b{color:var(--d-azul)}
.fn li.l-total{border-top:1px solid var(--d-linha);margin-top:4px;padding-top:9px}
.fn li.l-total b{color:var(--d-verde);font-size:14px;font-weight:600}

/* ---- produtos ---- */
.pr{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px}
.pr li{display:grid;grid-template-columns:20px 1fr auto auto;align-items:center;gap:10px;
  padding:8px 0;font-size:12.5px}
.pr li+li{border-top:1px solid var(--d-linha)}
.pr-i{color:var(--d-dim);font-size:11.5px;text-align:center}
.pr-nome{min-width:0;color:var(--d-txt)}
.pr-nome em{display:block;font-style:normal;font-size:11px;color:var(--d-dim)}
.pr-un{color:var(--d-dim);font-size:11.5px;white-space:nowrap}
.pr li b{font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}

/* ---- tabela ---- */
.tb-rolo{overflow-x:auto;flex:1}
.tb{width:100%;border-collapse:collapse;font-size:12.5px}
.tb th{font-size:11px;font-weight:500;color:var(--d-dim);text-align:left;padding:0 7px 8px;
  border-bottom:1px solid var(--d-linha);white-space:nowrap}
.tb td{padding:8px 7px;border-bottom:1px solid var(--d-linha);white-space:nowrap}
.tb .n{text-align:right;font-variant-numeric:tabular-nums}
.tb tfoot td{border-bottom:0;font-weight:600;color:var(--d-azul)}
.tb .conv{display:flex;align-items:center;justify-content:flex-end;gap:6px}
.cv-tubo{width:28px;height:5px;border-radius:3px;background:var(--d-linha);overflow:hidden;
  flex:0 0 auto}
.cv-b{display:block;height:100%;background:var(--d-verde);border-radius:3px}

/* ---- condicao ---- */
.cn{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.cn li{display:grid;grid-template-columns:62px 1fr auto auto;align-items:center;gap:9px;
  font-size:12.5px}
.cn-tubo{height:7px;border-radius:4px;background:var(--d-linha);overflow:hidden}
.cn-b{display:block;height:100%;background:var(--d-azul);border-radius:4px}
.cn li b{font-weight:500;font-variant-numeric:tabular-nums}
.cn li em{font-style:normal;font-size:11px;color:var(--d-dim);min-width:34px;text-align:right}

/* ---- insights ---- */
.ins{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:13px;flex:1}
.ins li{display:flex;gap:10px;align-items:flex-start}
.in-p{width:22px;height:22px;border-radius:7px;flex:0 0 auto;margin-top:1px}
.in-bom .in-p{background:var(--d-verde-bg);border:1.5px solid var(--d-verde)}
.in-ruim .in-p{background:var(--d-verm-bg);border:1.5px solid var(--d-verm)}
.in-atencao .in-p{background:var(--d-laranja-bg);border:1.5px solid var(--d-laranja)}
.ins b{display:block;font-size:12.5px;font-weight:600}
.ins em{display:block;font-style:normal;font-size:11.5px;color:var(--d-dim);line-height:1.5;
  margin-top:2px}
.cd-cta{margin-top:13px;width:100%;font-family:var(--body);font-size:12.5px;font-weight:500;
  color:var(--d-azul);background:var(--d-card);border:1px solid var(--d-linha);
  border-radius:9px;padding:10px;cursor:pointer}

@media (max-width:1150px){
  .kp-faixa{grid-template-columns:repeat(3,1fr)}
  .dash-l2,.dash-l3{grid-template-columns:1fr 1fr}
}
@media (max-width:720px){
  .kp-faixa{grid-template-columns:1fr 1fr}
  .dash-l2,.dash-l3{grid-template-columns:1fr}
  .dh-per,.dh-seg{width:100%}
}

/* ==== moldura do mock, nao entra no app ==== */
body{background:#EEF1F6;margin:0;font-family:var(--body);color:var(--text)}
.mk{max-width:1400px;margin:0 auto;padding:26px 18px 70px}
.mk h1.mk-h{font-family:var(--display);font-size:21px;margin:0 0 4px}
.mk-sub{color:var(--dim);font-size:13px;margin:0 0 22px}
.mk-sec{margin:30px 0 0}
.mk-tit{display:flex;align-items:baseline;gap:9px;margin:0 0 9px}
.mk-tit b{font-family:var(--mono);font-size:11px;color:var(--dim)}
.mk-tit h2{font-family:var(--display);font-size:15px;margin:0}
.mk-tit span{font-size:12px;color:var(--dim)}
.mk-nota{margin:9px 0 0;font-size:12px;color:var(--dim);line-height:1.55}
.mk-nota b{color:var(--text);font-weight:500}
.mk-alerta{margin:14px 0 0;padding:12px 14px;background:var(--morno-bg);
  border:1px solid var(--morno-linha);border-radius:8px;font-size:12.5px;line-height:1.6}
.mk-alerta.ok{background:var(--ok-bg);border-color:var(--ok-linha)}
"""


def secao(n, tit, desc, corpo, nota=''):
    return (f'<section class="mk-sec"><div class="mk-tit"><b>{n}</b><h2>{tit}</h2>'
            f'<span>{desc}</span></div>{corpo}'
            + (f'<p class="mk-nota">{nota}</p>' if nota else '') + '</section>')


corpo = f"""
<div class="mk">
  <h1 class="mk-h">Dashboard de Performance de Vendas</h1>
  <p class="mk-sub">Formato da referência que você trouxe. Todos os números são
  <b>reais</b>, lidos da <code>v_venda</code> e da <code>lead</code> em 12/08/2026.</p>

  <div class="mk-alerta">
    <strong>Duas decisões suas, contra a minha recomendação, registradas.</strong>
    (1) A paleta da referência entra ao pé da letra: chips azul/verde/roxo/laranja e roscas
    coloridas, o que quebra a regra dos quatro usos do azul da <code>referencia-visual-v3</code>.
    Os hexes novos vivem sob o prefixo <code>--d-</code> para ficar explícito o que é paleta
    importada e o que é token medido. (2) Mora nas duas telas: completo em
    <b>Dashboard</b>, e só a faixa de 5 KPIs no topo de <b>Vendas</b>.
  </div>

  {secao('01', 'O dashboard completo', 'aba Dashboard · janela Trimestre', dashboard('tri'))}

  <div class="mk-alerta ok">
    <strong>O que este dashboard te conta que nenhuma tela sua conta hoje:</strong>
    WhatsApp direto trouxe <b>9 leads e nenhuma venda</b>, enquanto Indicação converte
    <b>25%</b>. Sua conversão real é <b>14,3%</b>, não os 6,73% da imagem (aquilo era a
    sua margem com rótulo trocado). E <b>R$ 7.950 de faturamento estão sem canal</b>:
    dois leads sem origem preenchida cegam metade do painel de canal.
  </div>

  {secao('02', 'A faixa de KPI com comparação real', 'janela Mês · ago/2026 contra jul/2026',
         f'<div class="dash">{faixa_kpi("mes")}</div>',
         'É aqui que a comparação da referência ganha sentido: agosto faturou <b>82,8% menos</b> '
         'que julho, mas com margem <b>13 pontos melhor</b>. Faturamento caindo e margem subindo '
         'é uma leitura que nenhuma tela sua dá hoje. No Trimestre não existe período anterior '
         'na base, e o card <b>diz isso</b> em vez de inventar um zero.')}

  {secao('03', 'Onde cada painel da referência foi parar', 'o mapa honesto',
         '''<div class="mk-alerta" style="margin-top:0">
         <b>Entraram como estão:</b> Receita Total, Ticket Médio, Pedidos (virou Vendas),
         Taxa de Conversão, comparação com período anterior, Resumo Financeiro,
         Receita por canal, Desempenho por canal, Status dos pedidos, Produtos mais vendidos,
         Insights, Ver relatório completo.<br><br>
         <b>Mudaram, e o motivo está escrito no próprio card:</b>
         "Receita ao longo do tempo" virou coluna por mês (3 vendas em 73 dias seriam 3 pontos
         numa reta; a linha diária volta sozinha a partir de 8 pontos) ·
         "Origens de tráfego" virou <b>Margem por condição</b>, porque o sistema não tem
         analytics e sessão inventada não é dado ·
         "Itens vendidos" saiu, porque é 1 aparelho por venda e repetiria o número de Vendas ·
         "Devoluções" e "Impostos" saíram do P&L, porque não existem colunas para eles ·
         o ranking de produtos vem <b>sem foto</b>, porque o catálogo não guarda imagem.
         </div>''')}
</div>
"""

html = ('<title>Pit Wall · Dashboard de Performance de Vendas</title>\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
        f'<style>\n{fontes}\n{css_app}\n{CSS}\n</style>\n{corpo}')

saida = RAIZ / 'ferramentas' / 'mock_dashboard.html'
saida.write_text(html, encoding='utf-8')
print(f'ok: {saida}  ({len(html):,} bytes)')
print(f"trimestre: fat {brl(TRI['fat'])} · luc {brl(TRI['luc'])} · "
      f"margem {pct(TRI['luc'], TRI['fat'], 2)} · ticket {brl(TRI['fat'] / TRI['n'])} · "
      f"conversao {pct(TRI['n'], TRI['leads'])}")
