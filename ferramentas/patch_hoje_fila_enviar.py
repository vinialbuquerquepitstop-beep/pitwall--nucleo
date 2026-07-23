# Fatia 2: botao Enviar na linha da previa "Fila de hoje" (aba Hoje).
# O Enviar e um <a> real (wa.me) com o texto da variante 1 do sugerir_mensagem
# JA no href, pre-carregado no renderHoje (o browser bloqueia abrir wa.me depois
# de uma chamada assincrona). Porta LGPD (invariante 16): so entra no cache com
# consentimento === true e telefone. Texto vem do sugerir_mensagem, nunca fixo
# no JS (invariante 13). Patch cirurgico no app.js minificado, molde de
# patch_hoje_fila_lembrete.py: cada troca ancorada em texto exato, falha alto se
# a ancora nao bater ou nao for unica. Roda da raiz:
#   python ferramentas/patch_hoje_fila_enviar.py
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

exige_ausente('prefetchFilaSug', 'idempotencia')

# ---- 1) cache + helpers da Fila, injetados antes de hojeFilaLin ----
# filaSug: lead.id -> href de wa.me ja pronto. prefetchFilaSug roda no renderHoje
# e monta o href a partir do texto da variante 1 do sugerir_mensagem, so pra
# leads com consentimento e telefone. Cada RPC em try/catch: falha de um lead
# nao derruba o Hoje.
INJ = (
    'var filaSug={};'
    'function filaEnviarHTML(a){var h=filaSug[a.id];'
    'return h?\'<a class="btn-wa fila-wa" target="_blank" rel="noopener" href="\'+h+\'">Enviar</a>\':""}'
    'async function prefetchFilaSug(){filaSug={};'
    'var ativos=(i||[]).filter(function(x){return!x.arquivado_em}),top=v(ativos,l()).slice(0,5);'
    'await Promise.all(top.map(async function(a){'
    'if(!a||!0!==a.consentimento)return;'
    'var dig=String(a.whatsapp_digitos||"").replace(/\\D/g,"");if(!dig)return;'
    'try{var res=await t.rpc("sugerir_mensagem",{p_lead_id:a.id});var dd=res&&res.data;'
    'if(!dd||!1===dd.ok)return;var ops=dd.opcoes||[];'
    'if(!ops.length||!ops[0]||!ops[0].texto)return;'
    'filaSug[a.id]="https://wa.me/"+dig+"?text="+encodeURIComponent(ops[0].texto)}catch(e){}}))}'
)
troca('function hojeFilaLin(a){', INJ + 'function hojeFilaLin(a){', 'cache + helpers da Fila')

# ---- 2) hojeFilaLin: Enviar ao lado do Sugerir (dentro do fila-lin-topo) ----
troca(
    '>Sugerir</button></div>',
    '>Sugerir</button>\'+filaEnviarHTML(a)+\'</div>',
    'Enviar na linha da Fila'
)

# ---- 3) renderHoje: pre-carrega o sugerir antes de montar o HTML ----
troca(
    'e.innerHTML=hojePlacar(d)+hojeFila(d)+hojeTarefas(d)',
    'await prefetchFilaSug();e.innerHTML=hojePlacar(d)+hojeFila(d)+hojeTarefas(d)',
    'prefetch no renderHoje'
)

if src == orig:
    print('  nada mudou (?)'); sys.exit(1)
ALVO.write_text(src, encoding='utf-8')
print('OK: app.js atualizado.')
