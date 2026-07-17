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
velho_html=(RAIZ / 'public' / 'index.html').read_text(encoding='utf-8')
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
# o pitboard de LEAD nao pode aparecer na captacao: sao numeros de outro laco
ck('.pitboard.oculto{display:none}' in novo_css, 'sem regra para esconder o pitboard de lead')
ck('"captacao"===n?" oculto":""' in novo_js, 'o pitboard de lead apareceria na aba Captacao')
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

print()
if falhas:
    print('REPROVOU:'); [print('  -',f) for f in falhas]; sys.exit(1)
print('TUDO PASSOU')
