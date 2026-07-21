import re, sys, esprima
from html.parser import HTMLParser
sys.stdout.reconfigure(encoding='utf-8')

# BASELINE REPONTADA (16/07/2026, Fase 4).
# Ate a v25 a suite comparava o repo (velho) contra scratchpad/build (novo).
# O build da v25 foi empurrado: o repo JA e o novo. Agora o "velho" e o snapshot
# tirado antes do patch, e o "novo" e o proprio repo, editado no lugar.
# Rodar da raiz: python ferramentas/validar.py
import pathlib
RAIZ = pathlib.Path(__file__).resolve().parent.parent
velho_js = (RAIZ / 'ferramentas' / 'app.js.antes').read_text(encoding='utf-8')
novo_js  = (RAIZ / 'public' / 'app.js').read_text(encoding='utf-8')
novo_html= (RAIZ / 'public' / 'index.html').read_text(encoding='utf-8')
# baseline de verdade, nao o proprio arquivo (defeito corrigido na Fase 6:
# antes velho_html lia public/index.html e o check de IDs perdidos era vacuo)
velho_html=(RAIZ / 'ferramentas' / 'index.html.antes').read_text(encoding='utf-8')
novo_css = (RAIZ / 'public' / 'app.css').read_text(encoding='utf-8')
falhas=[]
def ck(c,m):
    if not c: falhas.append(m)

# ---------- 1. SINTAXE (acorn nao roda sem node; esprima e o equivalente) ----------
try:
    ast_v = esprima.parseScript(velho_js)
    print(f'  [1] app.js ORIGINAL parseia            {len(ast_v.body)} statements de topo')
except Exception as e:
    falhas.append(f'app.js original nao parseia: {e}')
try:
    ast_n = esprima.parseScript(novo_js)
    print(f'  [1] app.js PATCHADO parseia            {len(ast_n.body)} statements de topo')
    ck(len(ast_n.body)==len(ast_v.body), 'o patch mudou a contagem de statements de topo (era pra ser cirurgico)')
except Exception as e:
    falhas.append(f'app.js patchado NAO PARSEIA: {e}')

# ---------- 2. CONTRATO DE IDs: o JS busca, o HTML tem que ter ----------
ids_js = set(re.findall(r'E\("([A-Za-z0-9_]+)"\)', novo_js))
ids_js |= set(re.findall(r'getElementById\("([A-Za-z0-9_]+)"\)', novo_js))
ids_html = set(re.findall(r'id="([A-Za-z0-9_]+)"', novo_html))
# A Fase 5 trouxe elementos que o proprio JS cria (o form da captacao e uma view
# singleton montada em runtime). A regra honesta nao e "todo ID esta no HTML", e sim
# "todo ID que o JS busca existe em ALGUM lugar": no HTML ou na saida do proprio JS.
# Sem isso o check daria falso positivo; com whitelist, deixaria de pegar erro de verdade.
ids_emitidos_js = set(re.findall(r'id="([A-Za-z0-9_]+)"', novo_js))
faltando = sorted(ids_js - ids_html - ids_emitidos_js)
print(f'  [2] IDs que o JS busca: {len(ids_js)} | no index: {len(ids_html)} | criados pelo JS: {len(ids_emitidos_js)}')
ck(not faltando, f'ID buscado pelo JS e nao existe nem no index nem na saida do JS: {faltando}')

# nenhum ID do index antigo pode ter sumido sem querer
ids_old = set(re.findall(r'id="([A-Za-z0-9_]+)"', velho_html))
perdidos = sorted(ids_old - ids_html)
print(f'  [2] IDs perdidos do index antigo: {perdidos if perdidos else "nenhum"}')
ck(not perdidos, f'IDs sumiram do index: {perdidos}')
novos = sorted(ids_html - ids_old)
print(f'  [2] IDs novos: {novos}')

# ---------- 3. CONTRATO DE CLASSES: o que o JS emite, o CSS tem que estilizar ----------
classes_js = set()
for m in re.findall(r'class="([^"\'<>+]+)"', novo_js):
    for c in m.split(): classes_js.add(c)
for m in re.findall(r"class=\?'([a-z0-9 _-]+)", novo_js):
    for c in m.split(): classes_js.add(c)
sem_estilo = sorted(c for c in classes_js if c and not re.search(r'[.\[]'+re.escape(c)+r'\b', novo_css))
print(f'  [3] classes emitidas pelo JS: {len(classes_js)} | sem regra no CSS: {sem_estilo if sem_estilo else "nenhuma"}')
ck(not sem_estilo, f'classe emitida pelo JS sem estilo no CSS: {sem_estilo}')

# ---------- 4. OS PATCHES ESTAO LA ----------
esperado = {
  'emoji fora da semente': lambda s: not re.search(r'[\U0001F300-\U0001FAFF☀-➿❄⏰]', s),
  'chip Ind. por com classe': lambda s: '<span class="chip ind">Ind. por ' in s,
  'chip de status com classe': lambda s: '<span class="chip st-' in s,
  'titulo segue a aba': lambda s: 'E("topoTit")&&(E("topoTit").textContent=' in s,
  'acento em origem': lambda s: 'Indicação' in s and 'Loja física' in s,
}
for nome,fn in esperado.items():
    ok=fn(novo_js); print(f'  [4] {nome:<28} {"ok" if ok else "FALHOU"}')
    ck(ok, f'patch ausente: {nome}')

# ---------- 5. INVARIANTES QUE NAO PODEM QUEBRAR ----------
ck('sugerir_mensagem' in novo_js, 'a RPC sugerir_mensagem sumiu do JS')
ck(novo_js.count('rpc("sugerir_mensagem"')==velho_js.count('rpc("sugerir_mensagem"'), 'mudou o numero de chamadas a sugerir_mensagem')
# LGPD: o link da Fila so sai com consentimento
ck('!0!==a.consentimento' in novo_js, 'a trava de consentimento (LGPD) do waHrefFila sumiu')
# as 3 variantes continuam
ck('var-chip' in novo_js, 'os chips das 3 variantes sumiram')
print('  [5] sugerir_mensagem, trava de consentimento (LGPD) e 3 variantes: intactos')

# ---------- 6. HTML BEM FORMADO + fontes/tema ----------
VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
class C(HTMLParser):
    def __init__(s): super().__init__(convert_charrefs=True); s.p=[]; s.e=[]
    def handle_starttag(s,t,a):
        if t not in VOID: s.p.append((t,s.getpos()))
    def handle_endtag(s,t):
        if t in VOID: return
        if not s.p: s.e.append(f'</{t}> sem abertura linha {s.getpos()[0]}'); return
        o,pos=s.p.pop()
        if o!=t: s.e.append(f'esperava </{o}> (linha {pos[0]}), veio </{t}> linha {s.getpos()[0]}')
c=C(); c.feed(novo_html)
for t,pos in c.p: c.e.append(f'<{t}> linha {pos[0]} nunca fechou')
falhas += c.e
ck('color-scheme" content="light"' in novo_html, 'meta color-scheme continua dark')
ck('Chakra' not in novo_html, 'Chakra Petch ainda referenciada')
ck('Instrument+Sans' in novo_html and 'Geist+Mono' in novo_html, 'fontes novas nao linkadas')
ck('supabase-js@2' in novo_html, 'o script do Supabase sumiu')
ck(novo_html.count('id="abaIndicacoes"')==1, 'aba Indicacoes ausente ou duplicada')
# --- fidelidade a referencia visual v3 (o erro da rodada anterior) ---
ck(novo_html.count('id="abaDash"')==1, 'aba Dashboard ausente')
ck(novo_html.count('<svg')>=7, f'poucos icones: a referencia tem icone em cada aba e nos botoes (achei {novo_html.count("<svg")})')
ck('id="badgeFila"' in novo_html, 'contador da aba Fila ausente')
ck('class="avatar"' in novo_html, 'avatar ausente')
ck(novo_html.count('class="nav-rot')>=2, 'rotulos de grupo Operacao/Analise ausentes')
ck(novo_html.count('class="pb-pe"')==4, 'terceira linha do pitboard ausente')
ck('id="topoSub"' in novo_html, 'subtitulo com data ausente')
ck('"dashboard"===n' in novo_js, 'o JS nao sabe renderizar a aba Dashboard')
ck('badgeFila' in novo_js, 'o JS nao alimenta o contador da aba')
ck(novo_js.count('E("pbFila").textContent')==1, 'o contador virou uma segunda contagem em vez de reusar a do pbFila')
print('  [6] HTML bem formado, tema claro, fontes novas, Supabase e aba Indicacoes presentes')

# ---------- 7. o hex proibido nao pode voltar ----------
# olhar DECLARACAO, nao o arquivo cru: o hex antigo aparece de proposito no
# comentario que documenta por que ele saiu.
css_sem_comentario = re.sub(r'/\*.*?\*/', '', novo_css, flags=re.S)
ck('#f2a71b' not in css_sem_comentario.lower(), '--morno voltou para #f2a71b como VALOR, e ele reprova em branco (2.04)')
ck('#f2a71b' in novo_css.lower(), 'o comentario que documenta a troca do --morno sumiu')
ck('#0025cc' in novo_css.lower(), 'o azul da marca sumiu do CSS')
print('  [7] paleta: --morno recalibrado, azul da marca preservado')

# ---------- 8. FASE 4: historico ----------
# O ponto cego do check [3]: ele so ve class="literal". As classes montadas por
# concatenacao (ator-*) escapam da regex, entao vao conferidas na mao.
for cls in ['hist-ev', 'ator-operador', 'ator-regua', 'ator-ok', 'ator-fim', 'hist-corpo', 'hist-ponto']:
    ck(re.search(r'[.\[]'+re.escape(cls)+r'\b', novo_css) is not None,
       f'classe {cls} emitida pelo JS e sem regra no CSS')
ck('rpc("historico_lead"' in novo_js, 'o front nao chama historico_lead')
ck('rpc("registrar_nota"' in novo_js, 'o front nao chama registrar_nota')
ck(novo_js.count('data-acao="historico"')==1, 'o botao que abre o historico sumiu ou duplicou')
ck('data-hist' in novo_js and 'data-hist' in novo_css or '[data-hist]' in novo_js,
   'o painel [data-hist] sumiu do JS')
# fechado por padrao: o painel nasce vazio e so o clique busca no banco (pedido do dono)
ck("'<div class=\"hist\" data-hist></div>'" in novo_js,
   'o painel de historico nao nasce mais vazio/fechado: ele nao pode aparecer sem clique')
ck('.hist{' in novo_css and 'display:none' in novo_css.split('.hist{')[1].split('}')[0],
   '.hist perdeu o display:none: o historico apareceria sem clique e poluiria o card')
ck('.hist.aberto{display:block}' in novo_css, '.hist.aberto sumiu: o painel nunca abriria')
# a regra de data futura mora no banco, nao no JS
ck('Use Adiar/Retomar' not in novo_js,
   'a regra de data futura foi duplicada no JS: ela mora em registrar_nota(), num lugar so')
# invariante 2: toque enviado e respondido sao eventos distintos
ck('"fechou"===tipo||"respondeu"===tipo' in novo_js.replace(' ',''),
   'o mapa de ator perdeu a distincao de respondeu')
print('  [8] Fase 4: historico_lead e registrar_nota ligadas, painel fechado por padrao, classes com estilo')

# ---------- 9. FASE 5: captacao ----------
for cls in ['cap-reg', 'cap-lin', 'cap-log', 'cap-ident', 'cap-hora', 'cap-frente', 'cap-quem',
            'cap-fim', 'cap-selo', 'cap-virou', 'cap-vazio', 'cap-det', 'cap-msg', 'btn-cap',
            'btn-parar', 'cap-mais', 'pb-celula']:
    ck(re.search(r'[.\[]'+re.escape(cls)+r'\b', novo_css) is not None,
       f'classe {cls} emitida pelo JS e sem regra no CSS')
ck(novo_html.count('id="abaCaptacao"')==1, 'aba Captacao ausente ou duplicada no HTML')
ck(novo_html.count('id="badgeCaptacao"')==1, 'contador da aba Captacao ausente')
ck('"captacao"===n' in novo_js, 'o JS nao sabe renderizar a aba Captacao')
for rpc in ['registrar_captacao', 'registrar_opt_out', 'placar_captacao', 'captacao_do_dia']:
    ck(f'rpc("{rpc}"' in novo_js, f'o front nao chama {rpc}')
# o pitboard de LEAD nao pode aparecer na captacao NEM nas abas da Fase 6:
# sao numeros de outro laco (a forma mudou na Fase 6, de igualdade para lista)
ck('.pitboard.oculto{display:none}' in novo_css, 'sem regra para esconder o pitboard de lead')
ck('["captacao","hoje","conteudo","rotina"].indexOf(n)>=0?" oculto":""' in novo_js,
   'o pitboard de lead apareceria em Captacao/Hoje/Conteudo/Rotina')
# a meta e config, nunca chumbada (invariante 11)
ck(not re.search(r'\balvo\s*[:=]\s*\d+', novo_js), 'o alvo da meta foi chumbado no JS: ele vive em captacao_meta')
# a referencia v3: o azul aparece em 4 lugares e mais nenhum. A v1 do mock tinha
# uma barra de progresso azul; ela nao pode voltar disfarcada.
ck('cap-barra' not in novo_css and 'cap-barra' not in novo_js,
   'a barra de progresso azul voltou: e um quinto uso da marca, e o pitboard ja diz "X de Y"')
# a regra de opt-out mora no banco
ck('Nao insistir' not in novo_js and 'não insistir' not in novo_js.lower().replace('nao','não'),
   'a regra de reabordagem foi duplicada no JS: ela mora em registrar_captacao()')
print('  [9] Fase 5: aba Captacao ligada as 4 RPCs, pitboard de lead escondido, meta em config')

# ---------- 10. FASE 6: Hoje / Conteudo / Rotina ----------
velho_css = (RAIZ / 'ferramentas' / 'app.css.antes').read_text(encoding='utf-8')

# classes montadas fora do alcance da regex do [3], conferidas na mao
for cls in ['dia-sec', 'dia-sec-tit', 'dia-sec-cab', 'dia-cat-rot', 'dia-lin', 'dia-tarefa',
            'dia-check', 'dia-tit', 'dia-rm', 'dia-add', 'dia-nota', 'dia-nota-pe', 'dia-vazio',
            'rot-item', 'rot-dias', 'rot-form', 'rot-form-lin', 'rot-dia-tog', 'rot-dica',
            'cont-topo', 'cont-log', 'cont-data', 'hoje-tag', 'cont-lin', 'cont-tit', 'cont-tipo',
            'cont-link', 'cont-solto', 'sync-lin', 'btn-sync', 'aba-rara', 'aba-mais', 'mais-aberto']:
    ck(re.search(r'[.\[]'+re.escape(cls)+r'\b', novo_css) is not None,
       f'classe {cls} emitida pelo JS/HTML e sem regra no CSS')

# as 14 RPCs de leitura/escrita do dia estao ligadas
for rpc in ['painel_do_dia', 'conteudo_periodo', 'rotina_completa', 'puxar_rotina',
            'marcar_tarefa', 'adicionar_tarefa', 'remover_tarefa', 'salvar_nota',
            'salvar_lembrete', 'marcar_lembrete', 'remover_lembrete',
            'salvar_rotina_categoria', 'salvar_rotina_tarefa', 'remover_rotina_tarefa']:
    ck(f'"{rpc}"' in novo_js, f'o front nao chama {rpc}')
# o botao manual de sync: capacidade nova, exatamente uma chamada
ck(novo_js.count('functions.invoke("sincronizar-conteudo"') == 1,
   'functions.invoke(sincronizar-conteudo) ausente ou duplicado')

# HTML: abas novas presentes, e as 4 raras marcadas para a barra mobile
for aba in ['abaHoje', 'abaConteudo', 'abaRotina', 'abaMais']:
    ck(novo_html.count(f'id="{aba}"') == 1, f'aba {aba} ausente ou duplicada')
ck(novo_html.count('class="aba aba-rara"') == 4,
   f'esperava 4 abas raras (Indicações, Captação, Dashboard, Rotina), achei {novo_html.count("class=\"aba aba-rara\"")}')
ck('Conteúdo' in novo_html and 'Rotina' in novo_html, 'acento na UI: Conteúdo/Rotina (a referencia decidiu "corrige")')

# ISODOW na tela: 1=segunda..7=domingo. Off-by-one aqui poe a rotina no dia
# errado em silencio; o array de rotulo e a metade visivel da regra.
ck('["","seg","ter","qua","qui","sex","sáb","dom"]' in novo_js,
   'o array DIAS_ISO mudou: 1=seg..7=dom e contrato com extract(isodow) no banco')

print('  [10] Fase 6: 14 RPCs + invoke ligados, abas novas no HTML, classes com estilo, ISODOW travado')

# ---------- 11. REGRAS DA SECAO 13 DO HANDOFF v29 ----------
# 11.1 contador do azul: nenhum SELETOR novo pode usar var(--accent) fora da
# lista aprovada. E a regra que teria pego a barra de progresso da Fase 5.
def seletores_com_accent(css):
    sels = set()
    for m in re.finditer(r'([^{}]+)\{([^}]*)\}', re.sub(r'/\*.*?\*/', '', css, flags=re.S)):
        corpo = m.group(2)
        if re.search(r'var\(--accent\)', corpo):
            sels.add(' '.join(m.group(1).split()))
    return sels
novos_sel = seletores_com_accent(novo_css) - seletores_com_accent(velho_css)
APROVADOS_F6 = [
    'btn-sync',            # acao primaria da aba Conteudo (mesmo papel do .btn-cap)
    'cont-link:hover',     # hover de link, precedente do .btn-editar:hover
    'mais-aberto .aba-mais',  # estado ativo de navegacao (Mais aberto)
    'focus-visible',       # anel de foco, aprovado desde a referencia
]
fora = sorted(s for s in novos_sel if not any(a in s for a in APROVADOS_F6))
ck(not fora, f'uso NOVO de var(--accent) fora da lista aprovada: {fora}')

# 11.2 zero token novo: o :root e o da baseline, MAIS a excecao nomeada abaixo.
# Excecao aberta em 20/07/2026, decisao consciente do dono: o sistema de trilho
# de categoria precisa de 7 tokens, e a regra 11.3 (zero hex no app.js) impede
# que essa cor viva no JS. Os 7 valores sao MEDIDOS, nao escolhidos no olho:
# 3.80 a 5.21 contra branco, alvo 3:1.
# Prova reexecutavel: python ferramentas/prova_trilho.py
# A guarda segue valendo para todo o resto: qualquer OUTRA adicao reprova, e
# remocao de token reprova sempre, inclusive de trilho.
TOKENS_TRILHO = {
    '--tr-fila-follow-up:#5B6BA8', '--tr-captacao:#3E8C8C',
    '--tr-conteudo:#7A5FA8', '--tr-loja-estoque:#A87155',
    '--tr-pos-venda:#6B8C5B', '--tr-analise:#5F7386',
    '--tr-fechamento:#8C5F7A',
    # tipo de peca de conteudo, mesma decisao e mesma disciplina:
    # medidos (5.36 / 6.96 / 4.55 contra branco) e sempre com icone.
    '--tp-story:#A8497E', '--tp-reels:#5B4BA8', '--tp-feed:#2F7DA8',
    '--tp-carrossel:#2E7D5B',
}
root_novo = novo_css.split(':root{',1)[1].split('}',1)[0]
root_velho = velho_css.split(':root{',1)[1].split('}',1)[0]
def _decls(bloco):
    # comentario CSS tem que sair ANTES de separar por ';', senao ele gruda
    # na declaracao seguinte e o token vira 'comentario+--tp-story:#A8497E'.
    bloco = re.sub(r'/\*.*?\*/', '', bloco, flags=re.S)
    return set(d.strip().replace(' ', '') for d in bloco.split(';') if d.strip())
_novas   = _decls(root_novo) - _decls(root_velho)
_sumidas = _decls(root_velho) - _decls(root_novo)
_faltando = TOKENS_TRILHO - _decls(root_novo)
ck(not _sumidas,   f'token REMOVIDO do :root: {sorted(_sumidas)}')
ck(not _faltando,  f'token de trilho sumiu do :root: {sorted(_faltando)}')
ck(not (_novas - TOKENS_TRILHO),
   f'token novo no :root fora da excecao dos trilhos: {sorted(_novas - TOKENS_TRILHO)}')

# 11.3 zero hex no app.js: cor mora no CSS, sempre
hexes = re.findall(r'#[0-9a-fA-F]{3,8}\b', novo_js)
ck(not hexes, f'hex de cor dentro do app.js: {hexes}')

# 11.4 a janela nao vaza para o codigo. ARMADILHA JA PISADA: o grep ingenuo
# por 28 casa com '2022-06-28' (Notion-Version); ela e excluida ANTES.
ck(not re.search(r'janela\w*\s*[:=]\s*\d', novo_js), 'numero de janela chumbado no app.js')
ck(not re.search(r'(?<![\w.\-])28(?![\w])', novo_js), 'literal 28 no app.js: cheira a janela chumbada')
ts_path = RAIZ / 'supabase' / 'functions' / 'sincronizar-conteudo' / 'index.ts'
if ts_path.exists():
    ts = ts_path.read_text(encoding='utf-8')
    ts = re.sub(r'/\*.*?\*/', '', ts, flags=re.S)
    ts = '\n'.join(l for l in ts.splitlines() if 'NOTION_VERSION' not in l and not l.strip().startswith('//'))
    ck(not re.search(r'(?<![\w.\-])(?:7|28)(?![\w])', ts), 'numero de janela (7/28) chumbado no index.ts')

# 11.5 app.js sem escrita direta: toda escrita passa por RPC
for verbo in ['.insert(', '.upsert(', '.delete(']:
    ck(verbo not in novo_js, f'escrita direta no app.js: {verbo}')
ck(not re.search(r'\.update\(', novo_js), 'escrita direta no app.js: .update(')

# 11.6 check de tarefa concluida e NEUTRO: verde e "deu certo", nao "feito"
bloco_check = re.search(r'\.dia-tarefa\[aria-checked=true\] \.dia-check\{([^}]*)\}', novo_css)
ck(bloco_check is not None and '--ok' not in bloco_check.group(1) and '--accent' not in bloco_check.group(1),
   'o check de tarefa concluida usa --ok ou --accent: tem que ser neutro (--dim)')
ck('line-through' in novo_css.split('.dia-tarefa[aria-checked=true] .dia-tit{',1)[1].split('}',1)[0]
   if '.dia-tarefa[aria-checked=true] .dia-tit{' in novo_css else False,
   'tarefa concluida perdeu o line-through')

print('  [11] secao 13 do v29: azul contado, :root intacto, sem hex no JS, janela nao vazou, sem escrita direta, check neutro')

print()
if falhas:
    print('REPROVOU:'); [print('  -',f) for f in falhas]; sys.exit(1)
print('TUDO PASSOU')
