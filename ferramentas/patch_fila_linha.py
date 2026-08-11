# -*- coding: utf-8 -*-
"""
A linha de atendimento da Fila: colunas rotuladas + chip de estado.

Pedido do dono em 09/08/2026, com uma imagem de referencia (um CRM com barra
lateral, cartoes-numero com icone, e a fila como linha densa com PRODUTO e
ORIGEM em colunas rotuladas, avatar, e um chip de estado a direita).

O que ENTRA da imagem:
  - avatar com a inicial do nome;
  - nome e LEAD-code empilhados na primeira coluna;
  - PRODUTO e ORIGEM como colunas com micro-rotulo em mono (ORIGEM nao aparecia
    em lugar nenhum da Fila ate hoje, e esta preenchida em 19 dos 21 leads);
  - um chip de estado a direita, que e o Sinal da linha.

O que NAO entra, e por que (o v48 ja tinha registrado a mesma recusa em 03/08):
  - a paleta da imagem e azul monocromatica: Urgente, Em Andamento e Pendente
    sao TRES TONS DO MESMO AZUL, medidos a 2.08 entre si. Colapsa o invariante 3
    e o sistema Trilho x Sinal. Aqui cada estado tem MATIZ propria, de token ja
    medido: --ok 5.35, --quente 4.65, --morno 4.61, --frio 4.61;
  - `NA FILA - 10MIN`, `AGUARDANDO BASE`, `FINALIZADO`, `LATENCY: 12ms`,
    `LIVE_SYNC: ACTIVE`, `Limpeza: 100% ok`: nada disso existe no banco;
  - o raio e o kebab, que escondiam Sugerir mensagem, WhatsApp, Historico,
    Toque enviado e Desfecho atras de cliques. Decisao do dono nesta sessao:
    a operacao fica ABERTA embaixo da linha.

O estado sai de coluna que a `v_lead` JA calcula, nunca de regra nova:
  Em andamento : respondido_em >= ultimo_toque_em (o cliente respondeu, a bola
                 e sua). Mesma condicao do primeiro ramo de `bola_com='voce'`.
  Urgente . Nd : proximo_contato passou da data.
  Pendente     : vence hoje.
  Na fila      : ainda no prazo.
  Sem data     : proximo_contato nulo. Sem este ramo `p()` devolve 0 e um lead
                 sem data se disfarcaria de "vence hoje".

O chip `Nd de atraso` SAI da fileira de chips na Fila: o chip de estado passou a
carregar o mesmo numero, e dizer duas vezes e ruido. Ele continua valendo em
qualquer outra aba (a condicao ja era `"fila"===e`, entao o que muda e so ela
sumir da Fila).

Idempotente: rodar duas vezes nao duplica.
"""
import sys, pathlib

APP = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'app.js'

MARCA = 'function fxFila('

# --------------------------------------------------------------------------
# 1) As duas funcoes novas, irmas de fxCli (mesmo escopo do IIFE, entao veem
#    os helpers c() de escape e s() do dicionario de rotulos).
# --------------------------------------------------------------------------
NOVAS = (
    'function fxSinal(a,i){'
    'var r=a.respondido_em,t=a.ultimo_toque_em;'
    'if(r&&(!t||new Date(r)>=new Date(t)))return[\'sn-andamento\',"Em andamento"];'
    'if(!a.proximo_contato)return[\'sn-fila\',"Sem data"];'
    'if(i>0)return[\'sn-urgente\',"Urgente \\u00b7 "+i+"d"];'
    'if(0===i)return[\'sn-pendente\',"Pendente"];'
    'return[\'sn-fila\',"Na fila"]}'

    'function fxCol(rot,val,vazio){'
    'return\'<div class="card-col"><div class="col-rot">\'+rot+\'</div><div class="col-val\'+'
    '(val?\'">\'+val:\' vazio">\'+vazio)+"</div></div>"}'

    'function fxFila(a,i){'
    'var sn=fxSinal(a,i),tel=f(a.whatsapp_digitos),'
    'ini=String(a.nome||"?").trim().charAt(0).toUpperCase()||"?",'
    'prod=c(a.produto||"")+(a.condicao?\' <span class="cond">\\u00b7 \'+c(s("condicao",a.condicao))+"</span>":"");'
    'return\'<div class="card-linha">\'+'
    '\'<div class="card-av" aria-hidden="true">\'+c(ini)+"</div>"+'
    '\'<div class="card-id"><div class="card-nome">\'+c(a.nome||"")+\'</div>\'+'
    '\'<div class="card-code">\'+c(a.lead_code||"")+'
    '(tel?\' <span class="card-tel-in">\\u00b7 \'+c(tel)+"</span>":"")+"</div></div>"+'
    'fxCol("produto",prod,"sem produto")+'
    'fxCol("origem",c(s("origem",a.origem)),"sem origem")+'
    '\'<div class="card-dir"><span class="chip est \'+sn[0]+\'">\'+c(sn[1])+"</span>"+'
    '(a.id?\'<button class="btn-editar" data-acao="editar" data-id="\'+c(a.id)+\'">Editar</button>\':"")+'
    '"</div></div>"}'
)

ANCORA_NOVAS = 'function fxCli(a){'

# --------------------------------------------------------------------------
# 2) O cabecalho do card vira ternario. O ramo `else` e o cabecalho ANTIGO,
#    byte a byte: nenhuma outra aba muda de forma.
# --------------------------------------------------------------------------
ANTIGO = (
    '><div class="card-topo"><div class="card-nome">\'+c(a.nome||"")+\'</div>'
    '<div class="card-topo-dir"><div class="card-code">\'+c(a.lead_code||"")+"</div>"'
    '+(a.id?\'<button class="btn-editar" data-acao="editar" data-id="\'+c(a.id)+\'">Editar</button>\':"")'
    '+\'</div></div><div class="card-prod">\'+c(a.produto||"")'
    '+(a.condicao?\' <span class="cond">· \'+c(s("condicao",a.condicao))+"</span>":"")+"</div>"'
)
NOVO = '>\'+("fila"===e?fxFila(a,i):\'' + ANTIGO[1:] + ')'

# --------------------------------------------------------------------------
# 3) O chip de atraso sai da Fila (o chip de estado ja diz o numero).
# --------------------------------------------------------------------------
CHIP_ANTIGO = '"fila"===e&&i>0&&n.push(\'<span class="chip atraso">\'+i+"d de atraso</span>"),'
CHIP_NOVO = ''

# --------------------------------------------------------------------------
# 4) O telefone sai do bloco solto e entra na coluna de identidade, colado no
#    LEAD-code. Solto ele nascia embaixo do AVATAR, 42px a esquerda do nome, e
#    a linha inteira lia como se tivesse escorregado. Nas outras abas nada muda:
#    la nao existe .card-linha e o telefone continua onde sempre esteve.
# --------------------------------------------------------------------------
TEL_ANTIGO = '+w+("clientes"===e?fxCli(a):"")'
TEL_NOVO = '+("fila"===e?"":w)+("clientes"===e?fxCli(a):"")'

src = APP.read_text(encoding='utf-8')
antes = len(src.encode('utf-8'))

if MARCA in src:
    print('ja aplicado, nada a fazer')
    sys.exit(0)

for nome, agulha in (('ancora das funcoes novas', ANCORA_NOVAS),
                     ('cabecalho antigo do card', ANTIGO),
                     ('chip de atraso da fila', CHIP_ANTIGO),
                     ('telefone solto', TEL_ANTIGO)):
    n = src.count(agulha)
    if n != 1:
        print(f'ABORTA: {nome} aparece {n} vezes, esperava 1. '
              f'O app.js mudou de forma; conferir antes de forcar.')
        sys.exit(1)

src = src.replace(ANCORA_NOVAS, NOVAS + ANCORA_NOVAS, 1)
src = src.replace(ANTIGO, NOVO, 1)
src = src.replace(CHIP_ANTIGO, CHIP_NOVO, 1)
src = src.replace(TEL_ANTIGO, TEL_NOVO, 1)

APP.write_text(src, encoding='utf-8')
depois = len(src.encode('utf-8'))
print(f'aplicado. {antes} -> {depois} bytes (+{depois - antes})')
print('conferir agora: python ferramentas/validar.py && python ferramentas/harness.py')
