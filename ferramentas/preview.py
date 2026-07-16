import re, sys
sys.stdout.reconfigure(encoding='utf-8')

html = open('build/index', encoding='utf-8').read()
css  = open('build/app.css', encoding='utf-8').read()
fontes = open('fontes.css', encoding='utf-8').read()   # Instrument Sans + Geist Mono, base64

# ---- so o corpo: o artifact injeta o esqueleto, e o CSP bloqueia CDN de fonte ----
corpo = html.split('<body>',1)[1].split('</body>',1)[0]
corpo = re.sub(r'<script[^>]*>.*?</script>', '', corpo, flags=re.S)   # sem supabase, sem app.js
corpo = corpo.replace('<div id="telaLogin" class="login">', '<div id="telaLogin" class="login oculto">')
corpo = corpo.replace('<div id="telaApp" class="app oculto">', '<div id="telaApp" class="app">')

# ---- pitboard com os numeros reais do banco ----
corpo = corpo.replace('<span class="nav-badge" id="badgeFila"></span>', '<span class="nav-badge" id="badgeFila">6</span>')
corpo = corpo.replace('<span class="topo-sub" id="topoSub"></span>', '<span class="topo-sub" id="topoSub">quinta-feira, 16 de jul. de 2026</span>')
for pid, val, alerta in [('pbFila','6',False), ('pbAtraso','6',True), ('pbAtivos','10',False), ('pbTotal','15',False)]:
    cls = 'pb-num alerta' if alerta else 'pb-num'
    corpo = corpo.replace(f'<div class="pb-num" id="{pid}">0</div>', f'<div class="{cls}" id="{pid}">{val}</div>')

WA = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z" '
      'stroke-linecap="round" stroke-linejoin="round"></path></svg>')

def card(nivel, nome, code, produto, condicao, perfil, chips_extra, silencio, scripts=''):
    chips = ''.join(chips_extra)
    sil = f'<div class="silencio{" alerta" if silencio>=3 else ""}">{silencio}d sem resposta</div>'
    return (f'<article class="card t-{nivel}" data-lead="{code}">'
      f'<div class="card-topo"><div class="card-nome">{nome}</div>'
      f'<div class="card-topo-dir"><div class="card-code">{code}</div>'
      f'<button class="btn-editar" data-acao="editar">Editar</button></div></div>'
      f'<div class="card-prod">{produto} <span class="cond">· {condicao}</span></div>'
      f'<div class="chips">{chips}</div>{sil}'
      f'<div class="card-acoes"><button class="btn-acao sugerir" data-acao="sugerir">Sugerir mensagem</button></div>'
      f'<div class="card-acoes escrita"><button class="btn-acao toque" data-acao="toque">Toque enviado</button>'
      f'<button class="btn-acao" data-acao="leque">Respondeu</button></div>{scripts}</article>')

def chip(txt, cls=''): return f'<span class="chip{" "+cls if cls else ""}">{txt}</span>'

# painel de scripts: texto REAL vindo de dicionario_scripts (consulta, passo 2)
scripts_abertos = (
  '<div class="scripts aberto" data-scripts>'
  '<div class="script-meta">Abordagem sugerida · R2 · D2</div>'
  '<div class="scripts-vars">'
  '<button class="var-chip" aria-selected="false">Direto</button>'
  '<button class="var-chip" aria-selected="true">Consultivo</button>'
  '<button class="var-chip" aria-selected="false">Leve</button></div>'
  '<div class="script-texto" data-preview>Oi Diego, o valor do 17 Pro 256GB fez sentido ou ficou acima do que você planejou? '
  'Sendo sincero comigo, eu te mostro um caminho melhor.</div>'
  '<div class="script-acoes" data-scriptacoes><button class="btn-copiar">Copiar</button>'
  '<a class="btn-wa" href="#">' + WA + 'Abrir no WhatsApp</a></div></div>'
)

cards = [
  card('frio','Marcos A.','LEAD-0013','17 Pro Max 256GB','Lacrado','Lead — Consulta',
       [chip('9d de atraso','atraso'), chip('Lead — Consulta'), chip('Frio','nivel-frio')], 9),
  card('morno','Diego F.','LEAD-0005','17 Pro 256GB','Lacrado','Lead — Consulta',
       [chip('4d de atraso','atraso'), chip('Lead — Consulta'), chip('Morno','nivel-morno')], 4, scripts_abertos),
  card('quente','Camila M.','LEAD-0015','16 plus 128','Lacrado','Lead — Consulta',
       [chip('1d de atraso','atraso'), chip('Lead — Consulta')], 1),   # quente nao ganha chip: so a faixa
  card('morno','Bruno T.','LEAD-0004','14 Pro Max 256','Vitrine','Lead — Repescagem',
       [chip('Lead — Repescagem'), chip('Morno','nivel-morno'), chip('Pendente','st-pendente'),
        chip('Ind. por Camila M.','ind')], 5),
]
corpo = corpo.replace('<div class="lista" id="lista" aria-live="polite"></div>',
                      '<div class="lista" id="lista" aria-live="polite">'+''.join(cards)+'</div>')
corpo = corpo.replace('<div class="rodape" id="rodape"></div>',
                      '<div class="rodape" id="rodape">preview estatico · app.css real sobre o DOM real</div>')

out = ('<title>Pit Wall 2.0 · preview do build real</title>\n<style>\n'
       + fontes + '\n'
       + css.replace("'Instrument Sans',system-ui,-apple-system,sans-serif", "'Instrument Sans',system-ui,sans-serif")
       + '\n</style>\n' + corpo)
open('preview.html','w',encoding='utf-8').write(out)

# a fonte tem que vir embutida, senao o preview mente sobre a tipografia
assert out.count('@font-face')==5, 'fontes nao embutidas'
assert 'fonts.googleapis' not in out, 'sobrou link de CDN (o CSP bloqueia e a fonte cai pro fallback)'
assert '<!doctype' not in out.lower() and '<body' not in out.lower(), 'sobrou esqueleto'
print(f'preview.html  {len(out)/1024:.0f} KB  ·  {len(cards)} cards  ·  fontes embutidas')
