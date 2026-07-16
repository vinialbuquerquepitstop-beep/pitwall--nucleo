import re
from html.parser import HTMLParser

src = open('mockup.src.html', encoding='utf-8').read()
fontes = open('fontes.css', encoding='utf-8').read()
assert '/*__FONTES__*/' in src, 'placeholder de fonte sumiu'
out = src.replace('/*__FONTES__*/', fontes)
open('mockup.html','w',encoding='utf-8').write(out)

erros=[]
def check(cond, msg):
    if not cond: erros.append(msg)

# 1 — fontes embutidas, nenhuma externa
check(out.count('@font-face')==5, f"esperava 5 @font-face, achei {out.count('@font-face')}")
check('gstatic' not in out and 'googleapis' not in out, 'sobrou CDN de fonte (o CSP bloqueia)')
check(not re.findall(r'(?:src|href)\s*=\s*"(https?://[^"]+)"', out), 'URL externa encontrada')
for f in ('Instrument Sans','Geist Mono'):
    check(f"font-family:'{f}'" in out, f'fonte nao embutida: {f}')
check(not re.search(r"font-family:[^;}]*IBM Plex", out), 'IBM Plex ainda declarada como font-family')
check(not re.search(r"font-family:[^;}]*Instrument Serif", out), 'Instrument Serif ainda declarada (o dono reprovou o serif)')
check("@font-face{font-family:'Instrument Serif'" not in out, 'Instrument Serif ainda embutida, peso morto')

# 2 — correcao pedida pelo dono: Indicacoes existe, Pos-venda inventada nao
check(out.count('>\n              Indicacoes\n            </a>')>=1 or 'Indicacoes' in out, 'aba Indicacoes ausente')
nav_txt=' '.join(re.findall(r'<a class="nav-item".*?</a>', out, re.S)) + ' '.join(re.findall(r'<button class="tab".*?</button>', out, re.S))
check('Pos-venda' not in nav_txt, 'aba Pos-venda (inventada) ainda na navegacao')
check('Pos-venda' not in re.sub(r'<code>Pos-venda</code>','',nav_txt), 'Pos-venda na navegacao')
check('Ind. por' in out, 'chip "Ind. por" ausente')
check('Nenhuma indicacao ainda.' in out, 'estado vazio real da aba Indicacoes ausente')

# 3 — abas do mock batem com as do app real
abas_reais = {'Fila do dia','Todos','Indicacoes'}
for a in abas_reais:
    check(a in out, f'aba real ausente do mock: {a}')

# 4 — barra inferior: 4 tabs, cada icone com seu rotulo certo
tabbar = re.search(r'<nav class="tabbar">(.*?)</nav>', out, re.S)
check(tabbar is not None, 'tabbar nao encontrada')
if tabbar:
    tabs = re.findall(r'<button class="tab"[^>]*>(.*?)</button>', tabbar.group(1), re.S)
    check(len(tabs)==4, f'esperava 4 tabs no mobile, achei {len(tabs)}')
    # o icone de grade pertence a "Todos"; o de pessoa+ pertence a "Indicacoes"
    for t in tabs:
        rot = re.search(r'<span>([^<]+)</span>', t)
        rot = rot.group(1) if rot else '?'
        tem_grade = '<rect' in t
        tem_pessoa = '<circle cx="9" cy="8"' in t
        if rot=='Todos':      check(tem_grade and not tem_pessoa, 'tab Todos com icone errado')
        if rot=='Indicacoes': check(tem_pessoa and not tem_grade, 'tab Indicacoes com icone errado')

# 5 — HTML bem formado
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
c=C(); c.feed(out)
for t,pos in c.p: c.e.append(f'<{t}> linha {pos[0]} nunca fechou')
erros += c.e

# 6 — sem esqueleto (o artifact injeta) e temas presentes
for p in ('<!doctype','<html','<head>','<body'):
    check(p not in out.lower(), f'tag de esqueleto presente: {p}')
for sel in ('@media (prefers-color-scheme:dark)',':root[data-theme="dark"]',':root[data-theme="light"]'):
    check(sel in out, f'faltou bloco de tema: {sel}')

if erros:
    print('REPROVOU:'); [print('  -',e) for e in erros]; raise SystemExit(1)
print(f'OK  mockup.html  {len(out)/1024:.0f} KB')
print('OK  5 fontes embutidas (Instrument Sans + Geist Mono), serif removida, zero requisicao externa')
print('OK  Indicacoes presente com chip "Ind. por" e estado vazio real; Pos-venda inventada removida')
print('OK  barra inferior com 4 tabs e cada icone no rotulo certo')
print('OK  HTML bem formado, 3 blocos de tema')
