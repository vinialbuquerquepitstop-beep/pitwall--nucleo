# Mock da Fase 5 (aba Captação), v2. A v1 foi reprovada: "amadora, falta organizacao
# e intuitividade". O diagnostico honesto, contra a referencia v3:
#
#  1. A referencia DIZ: "O azul da marca aparece em quatro lugares e mais nenhum:
#     item ativo, contador da fila, acao primaria e o chip de indicacao."
#     A v1 punha uma barra de progresso azul: um QUINTO uso, e grande. Regra escrita,
#     quebrada. Esta versao nao adiciona nenhum uso novo de --accent.
#  2. O pitboard JA resolve "X de Y" ("Base ativa | 10 | de 15 na base"): a terceira
#     linha e CONTEXTO do numero. A v1 inventou uma barra para dizer "3 de 10" e ainda
#     gastou uma celula com "faltam 7", que e a mesma informacao dita de novo.
#     Agora sao 4 quantidades DIFERENTES, como na referencia.
#  3. Captacao e atividade de RITMO: senta e dispara N abordagens seguidas. A v1 tratou
#     como formulario de cadastro + relatorio. Agora o registro e UMA linha, o loop e
#     digitar / Enter / proximo.
#  4. "Pediu para parar" ocupava um bloco em TODO card: espaco permanente para acao
#     rara. Virou acao discreta no fim da linha.
#  5. Card gordo virou linha densa e alinhada, que e a tese da referencia
#     ("timing screen, nao cockpit": numero alinhado, densidade).
#
# HONESTIDADE DO DADO: meta (10/dia) e frente (Instagram · DM) sao REAIS, do banco.
# Nao existe captacao nenhuma ainda, entao o estado 02 e o vazio REAL (o que voce ve
# amanha de manha). Os demais sao exemplo, e a pagina diz isso.
import sys, pathlib
sys.stdout.reconfigure(encoding='utf-8')

RAIZ = pathlib.Path(__file__).resolve().parent.parent
css_app = (RAIZ / 'public' / 'app.css').read_text(encoding='utf-8')
fontes  = (RAIZ / 'ferramentas' / 'fontes.css').read_text(encoding='utf-8')

CSS_CAP = """
/* ---- Fase 5: aba Captação. Zero uso novo de --accent: a acao primaria ja e um
       dos quatro lugares que a referencia autoriza. ---- */

/* barra de registro: UMA linha. O loop e digitar, Enter, proximo. */
.cap-reg{
  background:var(--bg);border:1px solid var(--line-forte);border-radius:var(--radius);
  padding:9px;display:flex;flex-direction:column;gap:8px;
}
.cap-reg-lin{display:flex;gap:8px;align-items:center}
.cap-reg select{
  flex:0 0 auto;font-family:var(--body);font-size:13px;color:var(--text);background:var(--bg);
  border:1px solid var(--line);border-radius:var(--radius-p);padding:0 8px;height:40px;
}
.cap-reg .ident{
  flex:1;min-width:0;font-family:var(--mono);font-size:14px;color:var(--text);background:var(--bg);
  border:1px solid var(--line);border-radius:var(--radius-p);padding:0 10px;height:40px;
}
.cap-reg .ident::placeholder{color:var(--dim)}
.cap-reg select:focus-visible,.cap-reg input:focus-visible,.cap-det textarea:focus-visible,.cap-det input:focus-visible{
  outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent);
}
.btn-cap{
  flex:0 0 auto;background:var(--accent-tint);border:1px solid var(--accent-linha);color:var(--accent);
  border-radius:var(--radius-p);padding:0 15px;height:40px;
  font-family:var(--body);font-weight:500;font-size:13px;white-space:nowrap;
}
.btn-cap:hover{background:rgba(0,37,204,.09)}
.btn-cap:disabled{opacity:.45;cursor:default}

/* nome e observacao ficam guardados: quanto menos dado de quem nao pediu contato, melhor */
.cap-mais{
  align-self:flex-start;background:none;border:none;color:var(--dim);
  font-family:var(--body);font-size:12px;padding:2px 0;text-decoration:underline;
  text-underline-offset:2px;
}
.cap-mais:hover{color:var(--text)}
.cap-det{display:none;gap:8px}
.cap-det.aberto{display:flex}
.cap-det input,.cap-det textarea{
  flex:1;min-width:0;font-family:var(--body);font-size:13px;color:var(--text);background:var(--bg);
  border:1px solid var(--line);border-radius:var(--radius-p);padding:8px 10px;
}
.cap-det textarea{resize:vertical;min-height:38px;line-height:1.4}

.cap-msg{font-size:12px;border-radius:var(--radius-p);padding:7px 9px}
.cap-msg.erro{color:var(--erro-fg);background:var(--erro-bg);border:1px solid var(--erro-linha)}
.cap-msg.parada{color:var(--morno-fg);background:var(--morno-bg);border:1px solid var(--morno-linha)}

/* o log do dia: linha densa e alinhada, nao card gordo */
.cap-log{
  background:var(--bg);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;
}
.cap-log-cab{
  display:grid;grid-template-columns:50px 1fr 118px 74px;gap:10px;align-items:center;
  padding:7px 12px;border-bottom:1px solid var(--line);background:var(--panel-2);
}
.cap-log-cab span{font-size:9px;color:var(--dim);letter-spacing:.06em;text-transform:uppercase}
.cap-lin{
  display:grid;grid-template-columns:50px 1fr 118px 74px;gap:10px;align-items:center;
  padding:9px 12px;border-bottom:1px solid var(--line);
}
.cap-lin:last-child{border-bottom:none}
.cap-lin:hover{background:var(--surface)}
.cap-hora{font-family:var(--mono);font-size:11px;color:var(--dim);font-variant-numeric:tabular-nums}
.cap-quem{min-width:0}
.cap-ident{font-family:var(--mono);font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cap-nome{font-size:11.5px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cap-frente{font-size:11.5px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cap-fim{display:flex;justify-content:flex-end}
.btn-parar{
  background:none;border:1px solid transparent;color:var(--dim);
  border-radius:var(--radius-p);padding:3px 8px;font-size:11.5px;white-space:nowrap;
}
.cap-lin:hover .btn-parar{border-color:var(--line-forte)}
.btn-parar:hover{color:var(--erro-fg);border-color:var(--erro-linha);background:var(--erro-bg)}
/* quem pediu para parar sai do jogo: linha apagada, sem acao, e um selo que nao grita */
.cap-lin.parou{background:var(--panel-2)}
.cap-lin.parou .cap-ident{color:var(--dim);text-decoration:line-through}
.cap-selo{
  font-family:var(--mono);font-size:9px;color:var(--dim);letter-spacing:.07em;
  text-transform:uppercase;white-space:nowrap;
}
.cap-lin.virou .cap-ident{color:var(--ok-fg)}
.cap-virou{
  font-size:10.5px;color:var(--ok-fg);background:var(--ok-bg);border:1px solid var(--ok-linha);
  border-radius:4px;padding:1px 6px;white-space:nowrap;
}
.cap-vazio{padding:22px 14px;text-align:center}
.cap-vazio-t{font-size:13px;color:var(--text)}
.cap-vazio-s{font-size:12px;color:var(--dim);margin-top:3px}

@media (max-width:560px){
  .cap-log-cab{display:none}
  .cap-lin{grid-template-columns:46px 1fr auto;row-gap:2px}
  .cap-frente{grid-column:2;font-size:11px}
  .cap-reg-lin{flex-wrap:wrap}
  .cap-reg .ident{flex:1 1 100%;order:-1}
}
"""

CSS_MOCK = """
.mk-wrap{max-width:660px;margin:0 auto;padding:34px 20px 72px}
.mk-topo{border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:16px}
.mk-topo h1{font-size:23px;font-weight:600;letter-spacing:-.02em;line-height:1.2}
.mk-topo .mk-sub{font-family:var(--mono);font-size:11.5px;color:var(--dim);margin-top:7px}
.mk-alerta{
  font-size:12.5px;line-height:1.55;color:var(--morno-fg);background:var(--morno-bg);
  border:1px solid var(--morno-linha);border-radius:var(--radius-p);padding:9px 11px;margin-bottom:14px;
}
.mk-alerta strong{font-weight:600}
.mk-mudou{
  font-size:12.5px;line-height:1.6;color:var(--dim);background:var(--panel-2);
  border:1px solid var(--line);border-radius:var(--radius-p);padding:11px 13px;margin-bottom:30px;
}
.mk-mudou b{color:var(--text);font-weight:600;display:block;margin-bottom:5px;font-size:12px;
  letter-spacing:.06em;text-transform:uppercase}
.mk-mudou ul{margin:0;padding-left:17px}
.mk-mudou li{margin-bottom:3px}
.mk-sec{margin-bottom:32px}
.mk-cab{display:flex;gap:11px;align-items:baseline;margin-bottom:11px}
.mk-n{font-family:var(--mono);font-size:11px;color:var(--dim);font-variant-numeric:tabular-nums;padding-top:2px}
.mk-cab h2{font-size:14.5px;font-weight:600;letter-spacing:-.01em}
.mk-cab p{font-size:12.5px;color:var(--dim);margin-top:2px;max-width:64ch;line-height:1.5}
.mk-palco{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px}
.mk-nota{font-size:12.5px;color:var(--dim);line-height:1.55;max-width:68ch;margin-top:9px}
.mk-nota strong{color:var(--text);font-weight:500}
.mk-nav{background:var(--bg);border:1px solid var(--line);border-radius:var(--radius);padding:10px;max-width:250px}
.mk-tela{display:flex;flex-direction:column;gap:12px}
"""

def celula(rot, num, pe):
    return f'<div class="pb-celula"><div class="pb-rot">{rot}</div><div class="pb-num">{num}</div><div class="pb-pe">{pe}</div></div>'

def placar(hoje, alvo, total, leads, parar):
    # 4 quantidades DIFERENTES, como a referencia. A terceira linha e contexto,
    # nunca o mesmo numero dito de novo.
    return ('<div class="pitboard">'
      + celula('hoje', hoje, f'de {alvo} na meta')
      + celula('abordadas', total, 'desde o início')
      + celula('viraram lead', leads, f'de {total} abordadas')
      + celula('não abordar', parar, 'pediram para parar')
      + '</div>')

def registro(msg_cls=None, msg=None, ident='', det=False):
    m = f'<div class="cap-msg {msg_cls}">{msg}</div>' if msg else ''
    d = ('<div class="cap-det aberto"><input placeholder="Nome (opcional)" aria-label="Nome">'
         '<textarea placeholder="Observação (opcional)"></textarea></div>') if det else ''
    return ('<div class="cap-reg">'
      '<div class="cap-reg-lin">'
        '<select aria-label="Frente"><option>Instagram · DM</option></select>'
        f'<input class="ident" value="{ident}" placeholder="@perfil" aria-label="Perfil abordado">'
        '<button class="btn-cap">Registrar</button>'
      '</div>'
      f'{m}'
      '<button class="cap-mais">+ nome e observação</button>'
      f'{d}'
      '</div>')

CAB = ('<div class="cap-log-cab"><span>hora</span><span>quem</span><span>frente</span><span></span></div>')

def linha(hora, ident, nome=None, estado=None):
    n = f'<div class="cap-nome">{nome}</div>' if nome else ''
    if estado == 'parou':
        fim = '<div class="cap-fim"><span class="cap-selo">não abordar</span></div>'; cls = ' parou'
    elif estado == 'virou':
        fim = '<div class="cap-fim"><span class="cap-virou">virou lead</span></div>'; cls = ' virou'
    else:
        fim = '<div class="cap-fim"><button class="btn-parar">parar</button></div>'; cls = ''
    return (f'<div class="cap-lin{cls}"><div class="cap-hora">{hora}</div>'
      f'<div class="cap-quem"><div class="cap-ident">{ident}</div>{n}</div>'
      f'<div class="cap-frente">Instagram · DM</div>{fim}</div>')

LOG = ('<div class="cap-log">' + CAB
  + linha('14:32', '@ana.ferraz', 'Ana Ferraz')
  + linha('13:04', '@rlima')
  + linha('11:20', '@bia.souza', 'Bia', estado='virou')
  + linha('09:58', '@marcos.dev', 'Marcos', estado='parou')
  + '</div>')

VAZIO = ('<div class="cap-log"><div class="cap-vazio">'
  '<div class="cap-vazio-t">Nenhuma abordagem hoje.</div>'
  '<div class="cap-vazio-s">A meta são 10. Comece pelo campo acima.</div>'
  '</div></div>')

TOPO = ('<div class="topo"><div class="topo-esq">'
  '<div class="topo-tit">Captação</div>'
  '<div class="topo-sub">quinta-feira, 16 de jul. de 2026 · 3 de 10 hoje</div>'
  '</div></div>')

NAV = ('<div class="mk-nav"><div class="abas" role="tablist">'
  '<p class="nav-rot">Operação</p>'
  '<button class="aba" role="tab" aria-selected="false">'
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M4 12h16M4 17h7" stroke-linecap="round"/></svg>'
  '<span class="aba-txt">Fila do dia</span><span class="nav-badge">6</span></button>'
  '<button class="aba" role="tab" aria-selected="true">'
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/>'
  '<path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-linecap="round"/></svg>'
  '<span class="aba-txt">Captação</span><span class="nav-badge">3</span></button>'
  '</div></div>')

def secao(n, tit, sub, corpo):
    return (f'<section class="mk-sec"><div class="mk-cab"><span class="mk-n">{n}</span>'
            f'<div><h2>{tit}</h2><p>{sub}</p></div></div>'
            f'<div class="mk-palco">{corpo}</div></section>')

TELA = f'<div class="mk-tela">{TOPO}{placar(3,10,47,4,2)}{registro()}{LOG}</div>'
TELA_VAZIA = ('<div class="mk-tela">'
  '<div class="topo"><div class="topo-esq"><div class="topo-tit">Captação</div>'
  '<div class="topo-sub">quinta-feira, 16 de jul. de 2026 · 0 de 10 hoje</div></div></div>'
  + placar(0,10,0,0,0) + registro() + VAZIO + '</div>')

corpo = f"""
<div class="mk-wrap">
  <div class="mk-topo">
    <h1>Fase 5 · Captação ativa</h1>
    <div class="mk-sub">mock v2 · reconstruído contra a referência v3 · 16/07/2026</div>
  </div>

  <div class="mk-mudou">
    <b>O que mudou da v1 (e por quê)</b>
    <ul>
      <li>A barra de progresso azul <strong>saiu</strong>. A referência diz que o azul aparece em
          quatro lugares e mais nenhum; a barra era um quinto. O pitboard já diz "3 de 10" sozinho.</li>
      <li>A célula "faltam 7" <strong>saiu</strong>: era "3 de 10" dito de novo. Agora são
          4 quantidades diferentes, como na referência.</li>
      <li>O formulário virou <strong>uma linha</strong>. Captação é ritmo: digitar, Enter, próximo.</li>
      <li>Card gordo virou <strong>linha alinhada</strong> — a tese da referência é timing screen.</li>
      <li>"Pediu para parar" saiu de bloco fixo em todo card e virou ação discreta no fim da linha.</li>
    </ul>
  </div>

  <div class="mk-alerta">
    <strong>Sobre o dado.</strong> A meta (10/dia) e a frente (Instagram · DM) são <strong>reais</strong>,
    lidas do banco. O estado 02 é o vazio <strong>real</strong>: é o que você vê amanhã de manhã.
    As linhas dos outros estados são exemplo, porque ainda não existe captação nenhuma.
  </div>

  {secao('01','A tela inteira','Topo, placar, registro, log. De cima para baixo: onde estou, o que faço, o que já fiz.', TELA)}
  <div class="mk-nota">O azul aparece em <strong>dois</strong> lugares aqui, e os dois já são autorizados pela referência: a aba ativa e a ação primária. O verde de "virou lead" é semântico, não é a marca.</div>

  {secao('02','Dia zerado (o estado REAL de hoje)','Sem captação no banco, é isto que a aba mostra. Zero é o número honesto, e o vazio diz o próximo passo em vez de ficar mudo.', TELA_VAZIA)}

  {secao('03','A aba','Sob <strong>Operação</strong>, ao lado da Fila: captação é ação, não análise. O contador mostra quantas você já fez hoje, no mesmo idioma do contador da Fila.', NAV)}

  {secao('04','Já abordou essa pessoa','O banco recusa e diz quando foi. Você não insiste sem saber.', f'<div class="mk-tela">{registro("erro","Você já abordou @duda.nanda nessa frente em 12/07/2026","@duda.nanda")}</div>')}

  {secao('05','A pessoa pediu para parar','Sua regra é "sim até que se diga o contrário". Aqui ela disse, e o banco bloqueia a reabordagem: não é só um aviso na tela.', f'<div class="mk-tela">{registro("parada","Essa pessoa pediu para não ser mais abordada. Não insistir.","@marcos.dev")}</div>')}

  {secao('06','Nome e observação, se quiser','Ficam guardados atrás de um link. Frente e @perfil bastam para registrar: quanto menos dado de quem não pediu contato, melhor.', f'<div class="mk-tela">{registro(det=True)}</div>')}
</div>
"""

html = (f'<title>Pit Wall · Fase 5 · Captação ativa</title>\n'
        f'<style>\n{fontes}\n{css_app}\n{CSS_CAP}\n{CSS_MOCK}\n</style>\n{corpo}')

saida = RAIZ / 'ferramentas' / 'mock_captacao.html'
saida.write_text(html, encoding='utf-8')
print(f'ok: {saida}  ({len(html):,} bytes)')
