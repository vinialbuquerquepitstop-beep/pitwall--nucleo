# Aba Hoje mais pratica: Fila embutida (preview top-5, so acao Sugerir) +
# lembrete com data (futura some ate o dia; vencido carrega; agendado destaca).
# Patch cirurgico no app.js minificado, molde de patch_vendas.py: cada troca e
# ancorada em texto exato e falha alto se a ancora nao bater ou nao for unica.
# Roda da raiz: python ferramentas/patch_hoje_fila_lembrete.py
import sys, pathlib
sys.stdout.reconfigure(encoding='utf-8')

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ALVO = RAIZ / 'public' / 'app.js'
src = ALVO.read_text(encoding='utf-8')
orig = src

def troca(velho, novo, rotulo):
    global src
    n = src.count(velho)
    if n != 1:
        print('  FALHOU [%s]: ancora aparece %dx, esperava 1x' % (rotulo, n))
        sys.exit(1)
    src = src.replace(velho, novo, 1)
    print('  ok [%s]' % rotulo)

def exige_ausente(marca, rotulo):
    if marca in src:
        print('  FALHOU [%s]: patch ja aplicado (achei "%s")' % (rotulo, marca))
        sys.exit(1)

exige_ausente('function hojeFila', 'idempotencia')

# ---- Peca A: funcoes da Fila embutida no Hoje. Leitura pura do array de leads
# ja carregado (i), montado por v() = montarFila. Unica acao: Sugerir (read-only,
# invariante 13). "ver todos" troca pra aba Fila. ----
FILA = (
    'function nivelPonto(nv){return\'<span class="fila-ponto n-\'+c(nv||"quente")+\'" aria-hidden="true"></span>\'}'
    'function hojeFilaLin(a){var nv=a.nivel||"quente",atr=p(a.proximo_contato,l()),tag=atr>0?\'<span class="fila-atraso">\'+atr+"d de atraso</span>":"";'
    'return\'<div class="fila-lin" data-lead="\'+c(a.lead_code||"")+\'"><div class="fila-lin-topo"><div class="fila-ident">\'+nivelPonto(nv)+\'<span class="fila-nome">\'+c(a.nome||"")+\'</span><span class="fila-nivel n-\'+c(nv)+\'">\'+c(s("nivel",nv))+\'</span></div><span class="fila-cad">\'+(a.perfil?c(s("perfil",a.perfil)):"")+"</span>"+tag+\'<button class="btn-acao sugerir fila-sug" data-acao="hoje-sugerir" data-id="\'+c(a.id)+\'">Sugerir</button></div><div class="scripts" data-scripts></div></div>\'}'
    'function hojeFila(d){var ativos=(i||[]).filter(function(x){return!x.arquivado_em}),fila=v(ativos,l());'
    'if(!fila.length)return\'<div class="dia-sec"><div class="dia-sec-tit">Fila de hoje</div><div class="dia-vazio">Fila zerada hoje. Nada vencendo.</div></div>\';'
    'var top=fila.slice(0,5).map(hojeFilaLin).join("");'
    'return\'<div class="dia-sec"><div class="dia-sec-cab"><div class="dia-sec-tit">Fila de hoje</div><button class="fila-vertodos" data-acao="hoje-verfila">ver todos (\'+fila.length+\')</button></div>\'+top+"</div>"}'
)

# 1) injeta as funcoes da Fila logo antes de hojeLembretes (bloco legivel do Hoje)
troca('function hojeLembretes(d){', FILA + 'function hojeLembretes(d){', 'funcoes da Fila no Hoje')

# 2) renderHoje monta a Fila entre placar e tarefas
troca('hojePlacar(d)+hojeTarefas(d)', 'hojePlacar(d)+hojeFila(d)+hojeTarefas(d)', 'ordem renderHoje')

# ---- Peca B: estados do lembrete (vencido / agendado) no map ----
# 3a) classe da linha + tag calculadas antes do return
troca(
    'return\'<div class="dia-lin"><button class="dia-tarefa" role="checkbox" aria-checked="\'+(x.feito?"true":"false")+\'" data-acao="lemb-marcar"',
    'var _lc="dia-lin"+(x.vencido?" lemb-vencido":x.agendado?" lemb-agendado":""),_lt=x.vencido?\'<span class="lemb-tag venc">\'+(p(x.data,l())<=1?"venceu ontem":"atrasado "+p(x.data,l())+" dias")+"</span>":x.agendado?\'<span class="lemb-tag agnd">agendado pra hoje</span>\':"";'
    'return\'<div class="\'+_lc+\'"><button class="dia-tarefa" role="checkbox" aria-checked="\'+(x.feito?"true":"false")+\'" data-acao="lemb-marcar"',
    'classe+tag do lembrete'
)

# 3b) injeta a tag depois do texto, dentro do botao
troca(
    '+c(x.texto||"")+"</span></button>',
    '+c(x.texto||"")+"</span>"+_lt+"</button>',
    'tag no corpo do lembrete'
)

# 4) UI de data no "+ Lembrete": input date + atalhos Hoje/Amanha
troca(
    '<button class="btn-acao" data-acao="lemb-add">Adicionar</button></div></div>',
    '<input type="date" id="lembData" value="\'+c(l())+\'" aria-label="Dia do lembrete"><button class="btn-acao" data-acao="lemb-add">Adicionar</button></div><div class="lemb-quando"><button class="lemb-q" data-acao="lemb-hoje">Hoje</button><button class="lemb-q" data-acao="lemb-amanha">Amanha</button></div></div>',
    'UI de data do lembrete'
)

# 5) dispatcher: lemb-add manda p_data; atalhos e acoes da Fila
troca(
    'if("lemb-add"===o){var lv=E("lembNovo");return lv&&String(lv.value).trim()?void qF("salvar_lembrete",{p_texto:lv.value},e,renderHoje):void I("Digite o lembrete",!0)}',
    'if("lemb-add"===o){var lv=E("lembNovo"),ld=E("lembData");return lv&&String(lv.value).trim()?void qF("salvar_lembrete",{p_texto:lv.value,p_data:ld&&ld.value?ld.value:null},e,renderHoje):void I("Digite o lembrete",!0)}'
    'if("lemb-hoje"===o){if(E("lembData"))E("lembData").value=l();return}'
    'if("lemb-amanha"===o){if(E("lembData"))E("lembData").value=C(l(),1);return}'
    'if("hoje-verfila"===o){if(E("abaFila"))E("abaFila").click();return}'
    'if("hoje-sugerir"===o)return void sugerirMensagem(t,e,e.closest(".fila-lin"));',
    'dispatcher lembrete/fila'
)

if src == orig:
    print('  FALHOU: nada mudou'); sys.exit(1)
ALVO.write_text(src, encoding='utf-8')
print('patch_hoje_fila_lembrete: aplicado, %d -> %d bytes' % (len(orig), len(src)))
