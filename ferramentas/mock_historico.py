# Mock da Fase 4 (historico) na linguagem da referencia v3.
# Regra: nao inventa estetica. Le o app.css REAL e as fontes REAIS do projeto.
# O unico CSS novo e o do painel [data-hist], que e o que esta em julgamento.
# Dado: real, lido do banco em 16/07/2026 (LEAD-0005). Nada de texto de cabeca.
import sys, pathlib
sys.stdout.reconfigure(encoding='utf-8')

RAIZ = pathlib.Path(__file__).resolve().parent.parent
css_app = (RAIZ / 'nucleo' / 'public' / 'app.css').read_text(encoding='utf-8')
fontes  = (RAIZ / 'ferramentas' / 'fontes.css').read_text(encoding='utf-8')

# ---------------------------------------------------------------- CSS NOVO
# Segue o padrao que ja existe em .scripts (mesmo margin-top, mesma borda, mesmo toggle).
CSS_HIST = """
/* ---- Fase 4: painel de historico. Irmao de .scripts, mesmo mecanismo ---- */
.hist{margin-top:11px;border-top:1px solid var(--line);padding-top:10px;display:none}
.hist.aberto{display:block}

.hist-topo{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.hist-tit{font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}
.btn-nota{
  background:var(--bg);border:1px solid var(--line-forte);color:var(--text);
  border-radius:var(--radius-p);padding:4px 10px;font-size:12px;font-weight:500;min-height:28px;
}
.btn-nota:hover{background:var(--surface)}

.hist-lista{list-style:none;display:flex;flex-direction:column}
.hist-ev{display:grid;grid-template-columns:66px 11px 1fr;gap:0 10px;position:relative;padding-bottom:12px}
.hist-ev:last-child{padding-bottom:0}
/* trilho: liga os pontos, para o ultimo nao pingar no vazio */
.hist-ev:not(:last-child) .hist-marca::after{
  content:"";position:absolute;left:50%;transform:translateX(-50%);
  top:12px;bottom:-4px;width:1px;background:var(--line);
}
.hist-quando{
  font-family:var(--mono);font-size:10.5px;color:var(--dim);
  font-variant-numeric:tabular-nums;padding-top:2px;white-space:nowrap;
}
.hist-marca{position:relative;padding-top:5px}
.hist-ponto{
  display:block;width:7px;height:7px;border-radius:50%;margin:0 auto;
  background:var(--dim);position:relative;z-index:1;
}
/* a cor do ponto diz QUEM agiu: operador, regua, ou desfecho */
.hist-ev.ator-operador .hist-ponto{background:var(--accent)}
.hist-ev.ator-regua    .hist-ponto{background:var(--bg);box-shadow:inset 0 0 0 1.5px var(--frio)}
.hist-ev.ator-ok       .hist-ponto{background:var(--ok)}
.hist-ev.ator-fim      .hist-ponto{background:var(--frio)}

.hist-rot{font-size:13px;font-weight:500;color:var(--text);line-height:1.35}
.hist-autor{font-size:11.5px;font-weight:400;color:var(--dim)}
.hist-det{font-family:var(--mono);font-size:11px;color:var(--dim);margin-top:2px;line-height:1.45}
.hist-nota-txt{
  font-size:12.5px;color:var(--text);margin-top:3px;line-height:1.45;
  background:var(--accent-tint);border-left:2px solid var(--accent-linha);
  border-radius:0 var(--radius-p) var(--radius-p) 0;padding:5px 8px;
}
.hist-vazio{font-size:12.5px;color:var(--dim);padding:2px 0 4px}

/* ---- form de nota ---- */
.hist-form{display:none;gap:7px;flex-direction:column;margin-bottom:11px}
.hist-form.aberto{display:flex}
.hist-form textarea{
  font-family:var(--body);font-size:13px;color:var(--text);background:var(--bg);
  border:1px solid var(--line-forte);border-radius:var(--radius-p);padding:8px 9px;
  resize:vertical;min-height:58px;line-height:1.45;
}
.hist-form textarea:focus-visible,.hist-form input:focus-visible{
  outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent);
}
.hist-form-pe{display:flex;gap:7px;align-items:center}
.hist-form-pe input[type=date]{
  font-family:var(--mono);font-size:12px;color:var(--text);background:var(--bg);
  border:1px solid var(--line-forte);border-radius:var(--radius-p);padding:6px 8px;min-height:32px;
}
.hist-form-pe .btn-nota{margin-left:auto}
.hist-form-pe .btn-nota.ok{background:var(--accent-tint);border-color:var(--accent-linha);color:var(--accent)}
.hist-erro{
  font-size:12px;color:var(--erro-fg);background:var(--erro-bg);
  border:1px solid var(--erro-linha);border-radius:var(--radius-p);padding:6px 8px;
}
"""

# ------------------------------------------------- DADO REAL (banco, 16/07/2026)
# LEAD-0005, lido de lead_evento. Ordem newest-first, como historico_lead() devolve.
EVENTOS_0005 = [
    dict(ator='regua',    rot='Cadência avançou',  autor=None,           quando='11/07 15:12',
         det='R2 · D2 vence em 12/07/2026'),
    dict(ator='regua',    rot='Cadência iniciada', autor=None,           quando='11/07 15:12',
         det='R1 · D0 vence em 06/07/2026'),
    dict(ator='operador', rot='Toque enviado',     autor='Albuquerque',  quando='10/07 09:38',
         det='Toque enviado (app)'),
]

def linha(e):
    autor = e['autor'] or 'Régua'
    det = f'<div class="hist-det">{e["det"]}</div>' if e.get('det') else ''
    nota = f'<div class="hist-nota-txt">{e["nota"]}</div>' if e.get('nota') else ''
    return (f'<li class="hist-ev ator-{e["ator"]}">'
            f'<div class="hist-quando">{e["quando"]}</div>'
            f'<div class="hist-marca"><span class="hist-ponto"></span></div>'
            f'<div class="hist-corpo">'
            f'<div class="hist-rot">{e["rot"]} <span class="hist-autor">· {autor}</span></div>'
            f'{det}{nota}</div></li>')

def painel(eventos, aberto=True, form='', vazio=False):
    cls = 'hist aberto' if aberto else 'hist'
    corpo = ('<div class="hist-vazio">Nenhum evento ainda.</div>' if vazio
             else '<ol class="hist-lista">' + ''.join(linha(e) for e in eventos) + '</ol>')
    return (f'<div class="{cls}" data-hist>'
            f'<div class="hist-topo"><div class="hist-tit">Histórico</div>'
            f'<button class="btn-nota" data-acao="nota">+ Nota</button></div>'
            f'{form}{corpo}</div>')

WA = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z" '
      'stroke-linecap="round" stroke-linejoin="round"></path></svg>')

def card(nivel, nome, code, produto, condicao, chips, silencio, hist, hist_btn_on=True):
    ch = ''.join(chips)
    sil = (f'<div class="silencio{" alerta" if silencio>=3 else ""}">{silencio}d sem resposta</div>'
           if silencio is not None else '')
    btn_hist = ('<button class="btn-acao' + (' ligado' if hist_btn_on else '') +
                '" data-acao="historico">Histórico</button>')
    return (f'<article class="card t-{nivel}" data-lead="{code}">'
      f'<div class="card-topo"><div class="card-nome">{nome}</div>'
      f'<div class="card-topo-dir"><div class="card-code">{code}</div>'
      f'<button class="btn-editar" data-acao="editar">Editar</button></div></div>'
      f'<div class="card-prod">{produto} <span class="cond">· {condicao}</span></div>'
      f'<div class="chips">{ch}</div>{sil}'
      f'<div class="card-acoes"><button class="btn-acao sugerir">Sugerir mensagem</button>{btn_hist}</div>'
      f'{hist}'
      f'</article>')

CHIPS_0005 = ['<span class="chip atraso">4d de atraso</span>',
              '<span class="chip">Lead — Consulta</span>',
              '<span class="chip nivel-morno">Morno</span>']

# --- 1. fechado
c1 = card('morno','Duda nanda','LEAD-0005','17 Pro 256GB','Lacrado',CHIPS_0005,6,
          painel(EVENTOS_0005, aberto=False), hist_btn_on=False)
# --- 2. aberto
c2 = card('morno','Duda nanda','LEAD-0005','17 Pro 256GB','Lacrado',CHIPS_0005,6,
          painel(EVENTOS_0005))
# --- 3. form de nota aberto
FORM = ('<div class="hist-form aberto">'
        '<textarea placeholder="O que aconteceu? A nota entra no histórico e não pode ser apagada."></textarea>'
        '<div class="hist-form-pe"><input type="date" value="2026-07-16" aria-label="Data da nota">'
        '<button class="btn-nota ok">Registrar</button></div></div>')
c3 = card('morno','Duda nanda','LEAD-0005','17 Pro 256GB','Lacrado',CHIPS_0005,6,
          painel(EVENTOS_0005, form=FORM))
# --- 4. recusa do banco (data futura). Texto vem de registrar_nota(), nao do JS.
FORM_ERR = ('<div class="hist-form aberto">'
        '<textarea>Cliente pediu para chamar depois do dia 20.</textarea>'
        '<div class="hist-erro">Data no futuro. Use Adiar/Retomar para agendar.</div>'
        '<div class="hist-form-pe"><input type="date" value="2026-07-22" aria-label="Data da nota">'
        '<button class="btn-nota ok">Registrar</button></div></div>')
c4 = card('morno','Duda nanda','LEAD-0005','17 Pro 256GB','Lacrado',CHIPS_0005,6,
          painel(EVENTOS_0005, form=FORM_ERR))
# --- 5. lead novo, historico so com cadastro
c5 = card('quente','Clara mesquita','LEAD-0015','16 plus 128','Lacrado',
          ['<span class="chip atraso">1d de atraso</span>','<span class="chip">Lead — Consulta</span>'],2,
          painel([dict(ator='operador', rot='Cadastro', autor='Albuquerque',
                       quando='14/07 10:22', det='Cadastrado (app)')]))

def secao(n, tit, sub, corpo):
    return (f'<section class="mk-sec"><div class="mk-cab"><span class="mk-n">{n}</span>'
            f'<div><h2>{tit}</h2><p>{sub}</p></div></div>'
            f'<div class="mk-palco">{corpo}</div></section>')

CSS_MOCK = """
.mk-wrap{max-width:560px;margin:0 auto;padding:34px 20px 72px}
.mk-topo{border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:30px}
.mk-topo h1{font-size:23px;font-weight:600;letter-spacing:-.02em;line-height:1.2}
.mk-topo .mk-sub{font-family:var(--mono);font-size:11.5px;color:var(--dim);margin-top:7px}
.mk-sec{margin-bottom:34px}
.mk-cab{display:flex;gap:11px;align-items:baseline;margin-bottom:11px}
.mk-n{font-family:var(--mono);font-size:11px;color:var(--dim);font-variant-numeric:tabular-nums;padding-top:2px}
.mk-cab h2{font-size:14.5px;font-weight:600;letter-spacing:-.01em}
.mk-cab p{font-size:12.5px;color:var(--dim);margin-top:2px;max-width:62ch;line-height:1.5}
.mk-palco{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px}
.mk-nota{font-size:12.5px;color:var(--dim);line-height:1.55;max-width:66ch;margin-top:9px}
.mk-nota strong{color:var(--text);font-weight:500}
.btn-acao.ligado{background:var(--accent-tint);border-color:var(--accent-linha);color:var(--accent)}
.mk-leg{display:flex;flex-wrap:wrap;gap:14px;margin-top:11px}
.mk-leg-i{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dim)}
.mk-leg-i .hist-ponto{width:7px;height:7px}
"""

LEG = ('<div class="mk-leg">'
  '<span class="mk-leg-i"><span class="hist-ponto" style="background:var(--accent)"></span>Operador agiu</span>'
  '<span class="mk-leg-i"><span class="hist-ponto" style="background:var(--bg);box-shadow:inset 0 0 0 1.5px var(--frio)"></span>Régua decidiu</span>'
  '<span class="mk-leg-i"><span class="hist-ponto" style="background:var(--ok)"></span>Lead respondeu ou fechou</span>'
  '<span class="mk-leg-i"><span class="hist-ponto" style="background:var(--frio)"></span>Sem interesse ou arquivado</span>'
  '</div>')

corpo = f"""
<div class="mk-wrap">
  <div class="mk-topo">
    <h1>Fase 4 · Histórico do lead</h1>
    <div class="mk-sub">mock para aprovação · dado real do banco · 16/07/2026</div>
  </div>

  {secao('01','Fechado, como está hoje','O card ganha um botão. Nada mais muda. O histórico só é buscado quando você abre: não custa nada no carregamento da fila.', c1)}

  {secao('02','Aberto','Mesmo mecanismo do painel de scripts que já existe. Newest-first, como o banco entrega. Data e hora em Geist Mono, alinhadas em coluna.', c2)}
  <div class="mk-nota">O ponto diz <strong>quem agiu</strong>. Cheio azul: você. Vazado: a régua. Isso é o invariante 1 na tela: o sensor registra, a régua decide. Nos dois eventos de 11/07 15:12 a régua agiu no mesmo minuto, e o desempate entre eles é arbitrário: o banco ordena por <code>criado_em</code>, que só tem precisão de minuto aqui.{LEG}</div>

  {secao('03','Registrar nota','A nota entra no histórico append-only. Sem data, é agora; com data, é retroativa.', c3)}

  {secao('04','Data no futuro: o banco recusa','O texto do erro vem de <code>registrar_nota()</code>, não do JS. A regra mora num lugar só.', c4)}

  {secao('05','Lead recém-cadastrado','Histórico curto é histórico honesto. Sem enfeite, sem placeholder.', c5)}
</div>
"""

html = (f'<title>Pit Wall · Fase 4 · Histórico do lead</title>\n'
        f'<style>\n{fontes}\n{css_app}\n{CSS_HIST}\n{CSS_MOCK}\n</style>\n'
        f'{corpo}')

saida = RAIZ / 'ferramentas' / 'mock_historico.html'
saida.write_text(html, encoding='utf-8')
print(f'ok: {saida}  ({len(html):,} bytes)')
