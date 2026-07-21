# Hierarquia do frontend Pit Wall: plano de implementacao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar as abas Conteúdo, Rotina e Hoje legiveis, com kanban de funil com data em vista, grade de 7 colunas na Rotina, e um sistema de cor onde trilho (categoria) e sinal (urgencia) nunca disputam o mesmo canal visual.

**Architecture:** Frontend puro, **sem uma linha de SQL**. As RPCs `conteudo_periodo(p_ini,p_fim)`, `rotina_completa()` e `painel_do_dia(p_data)` ja devolvem tudo. O `public/app.js` esta minificado numa linha so; a mudanca entra pelo padrao ja estabelecido neste repo em `ferramentas/patch_historico.py`: um script Python que **acrescenta funcoes legiveis** ao fim do arquivo e **troca call-sites por ancora de texto exato que falha alto** se a ancora nao aparecer exatamente 1x. O `public/app.css` e legivel (793 linhas) e se edita direto.

**Tech Stack:** JavaScript ES5 (o `app.js` e `sourceType: script`, sem modulo), CSS custom properties, Python 3 para patch e validacao, Chrome headless para o harness.

Spec de origem: `docs/superpowers/specs/2026-07-20-hierarquia-frontend-design.md`.

## Global Constraints

Valores copiados literalmente do CLAUDE.md e do spec. **Valem para toda tarefa.**

- **Nada de fragmento.** Toda mudanca em `app.js` entra por script de patch ancorado que falha alto. Fragmento colado a mao foi causa raiz de corrupcao no historico deste projeto.
- **`app.js` continua sendo `sourceType: script`.** Nada de `let`, `const`, arrow function, template literal, `class` ou `??`. O arquivo inteiro e ES5. `validar.py` roda `esprima.parseScript` e reprova o resto.
- **Invariante 3:** `frio` (nivel, leitura) nunca se confunde com `Lista fria` (status, decisao).
- **Invariante 4:** nivel e **derivado na leitura**, nunca armazenado. O nivel da peca de conteudo se calcula no cliente e nao vira coluna no banco.
- **Invariante 10:** proibido `CURRENT_DATE` e proibido `new Date()` cru para produzir data de negocio. Usar o helper `l()` que ja existe no `app.js` e devolve a data de hoje no fuso do Brasil no formato `YYYY-MM-DD`.
- **Invariante 12:** a chave de categoria e `codigo` (`fila_follow_up`, `captacao`...), **nunca** `rotulo`. Rotulo e editavel e nunca decide cor nem icone.
- **Invariantes 13 a 16 (Fila):** `sugerirMensagem`, `pintarVariante`, `copiarScript`, `copiarFallback` e `waHrefFila` **nao sao tocados por nenhuma tarefa deste plano**. Se um diff encostar neles, a tarefa esta errada.
- **Emoji nao entra em rotulo.** Ponto colorido + palavra, ou icone SVG + palavra.
- **Ponto do meio** em cadencia e listas: `·` (U+00B7).
- **Trilho nunca renderiza sem seu icone.** Medido no spec secao 3.2: as colisoes de luminancia entre trilho e cor semantica ficam entre 1.14 e 1.44, ou seja, matiz sozinho nao separa. O icone e o que carrega a distincao.
- **Trilho nunca vira preenchimento.** So barra de 3px na borda esquerda e cor de rotulo. Chip preenchido e faixa pertencem ao sinal de urgencia.
- Prosa em portugues do Brasil sem acento, sem cedilha, sem travessao. **Excecao obrigatoria:** strings de interface visiveis ao usuario carregam acentuacao correta (`Conteúdo`, `Pós-venda`, `Em produção`, `sáb`). Isso vale para todo texto dentro de aspas que vai para o DOM.
- Rodar tudo **da raiz do repo**, nunca de dentro de `ferramentas/`.

---

## Contratos das RPCs (lidos de `pg_get_functiondef` em 20/07/2026)

Nao inventar campo. Estes sao os campos que existem:

```
conteudo_periodo(p_ini date, p_fim date) ->
{ ok:true, ini:"YYYY-MM-DD", fim:"YYYY-MM-DD",
  itens:[ { id, titulo, data, tipo_rotulo, tipo_codigo,
            status_rotulo, status_codigo, semana, url, hoje } ],
  sync:{ ok, quando, msg, horas } }

rotina_completa() ->
{ ok:true, pode_editar:bool,
  categorias:[ { codigo, rotulo, ordem,
                 tarefas:[ { id, titulo, dias_semana, ordem } ] } ] }

painel_do_dia(p_data date) ->
{ ok:true, contagem:{feitas,total}, categorias:[...], conteudo:[...],
  lembretes:[...], nota, sync:{...} }
```

**`status_codigo` reais, os cinco que existem:** `a_produzir`, `em_producao`, `pronto`, `publicado`, `descartado`.

**`dias_semana`** e array ISODOW 1..7 (1=seg). **`null` ou vazio significa TODOS os dias** (o proprio formulario ja diz `nenhum dia marcado = todo dia`).

**Janela padrao do `conteudo_periodo`:** `conteudo_fonte` tem `janela_atras_dias=7`, `janela_frente_dias=28`. Chamada sem parametros cobre hoje-7 a hoje+28.

---

## Numeros de verdade, medidos no banco em 20/07/2026

Toda assercao de teste deste plano bate contra estes numeros. **Numero que nao bater reprova a tarefa.**

Carga da Rotina por dia (derivada de `dias_semana` sobre 17 tarefas ativas):

```
seg 10 | ter 8 | qua 8 | qui 9 | sex 10 | sáb 3 | dom 0
```

Conteudo, **dentro da janela padrao** (13/07 a 17/08):

| `status_codigo` | Na janela | Vencidas |
|---|---|---|
| `a_produzir` | 45 | 7 |
| `descartado` | 6 | 0 |
| `em_producao` | 4 | 3 |
| `pronto` | 3 | 2 |
| `publicado` | 3 | 0 |

**Armadilha a nao repetir:** o spec dizia `publicado` 8. Oito e o total da BASE (66 cards). Dentro da janela padrao sao **3**, porque as outras 5 sao de 10 a 12/07 e caem fora do `janela_atras_dias=7`. Por isso o cabecalho da coluna `Publicado` tem que dizer a janela, senao a tela mente. Ultima publicacao real: 14/07.

---

## File Structure

| Arquivo | Responsabilidade | Acao |
|---|---|---|
| `ferramentas/patch_hierarquia.py` | O patch ancorado. Registro de como a mudanca entrou. Espelha `patch_historico.py`. | **Criar** |
| `public/app.js` | Renderizadores. Alterado **somente** pelo patch, nunca a mao. | Modificar via patch |
| `public/app.css` | Tokens de trilho, grade da Rotina, kanban, refluxo. Legivel, editar direto. | Modificar |
| `ferramentas/harness.py` | Stub de dados + assercoes. Ganha dados de conteudo e rotina realistas. | Modificar |
| `ferramentas/app.js.antes` / `app.css.antes` / `index.html.antes` | Baselines de comparacao do `validar.py`. Hoje sao pre-Fase 4. | **Repontar (Task 1)** |
| `public/index.html` | Sem mudanca. Todo o corpo e renderizado em `#lista`. | Intocado |

Ancoras exatas ja localizadas no `app.js` (conferidas unicas):

| Ancora | Onde serve |
|---|---|
| `e.innerHTML=hojePlacar(d)+hojeTarefas(d)+hojeNota(d)+hojeLembretes(d)+hojeConteudo(d)}` | reordenar a aba Hoje |
| `else if("conteudo"===n)renderConteudo();else if("rotina"===n)renderRotina();` | despacho de aba |
| `await t.rpc("conteudo_periodo",{})` | janela do Conteudo |

---

## Task 1: Repontar baselines e travar o verde de partida

Sem isto, `validar.py` compara contra um `app.js.antes` pre-Fase 4 e responde "o que mudou desde a Fase 4?", nao "o que esta mudanca quebrou?". E a pendencia 12 do handoff v32, e e pre-requisito, nao nota de rodape.

**Files:**
- Modify: `ferramentas/app.js.antes`, `ferramentas/app.css.antes`, `ferramentas/index.html.antes`

**Interfaces:**
- Consumes: nada.
- Produces: baseline valida para todas as tarefas seguintes; `validar.py` e `harness.py` verdes no estado atual.

- [ ] **Step 1: Rodar a suite ANTES de tocar em nada, e registrar a saida**

```bash
python ferramentas/validar.py
python ferramentas/harness.py
```

Esperado: as duas terminam sem falha. **Se ja falharem agora, PARE e reporte.** Nao se comeca uma obra sobre suite vermelha, e uma falha aqui e um defeito pre-existente que nao pertence a este plano.

- [ ] **Step 2: Repontar as tres baselines para o estado atual do repo**

```bash
cp public/app.js      ferramentas/app.js.antes
cp public/app.css     ferramentas/app.css.antes
cp public/index.html  ferramentas/index.html.antes
```

- [ ] **Step 3: Confirmar que a suite continua verde e agora compara contra si mesma**

```bash
python ferramentas/validar.py
```

Esperado: verde, e zero diferencas reportadas entre velho e novo (baseline == repo neste instante).

- [ ] **Step 4: Commit**

```bash
git add ferramentas/app.js.antes ferramentas/app.css.antes ferramentas/index.html.antes
git commit -m "chore: reponta baselines de validar.py para o estado atual (pendencia 12 do v32)

As baselines eram pre-Fase 4, entao validar.py respondia 'o que mudou desde a
Fase 4', nao 'o que esta mudanca quebrou'. Repontadas antes de comecar a obra
de hierarquia do frontend.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Tokens de trilho no CSS, com contraste provado

**Files:**
- Modify: `public/app.css` (bloco `:root`, junto dos tokens semanticos existentes)
- Create: `ferramentas/prova_trilho.py`

**Interfaces:**
- Consumes: tokens existentes `--bg`, `--quente`, `--morno`, `--frio`, `--ok`, `--erro`.
- Produces: sete variaveis CSS `--tr-fila-follow-up`, `--tr-captacao`, `--tr-conteudo`, `--tr-loja-estoque`, `--tr-pos-venda`, `--tr-analise`, `--tr-fechamento`. As tarefas 4, 5 e 6 consomem estes nomes exatos.

- [ ] **Step 1: Escrever a prova de contraste que falha**

Criar `ferramentas/prova_trilho.py`:

```python
# Prova que os 7 trilhos de categoria passam o alvo de 3:1 contra o fundo branco.
# Cor semantica se MEDE, nao se escolhe no olho (CLAUDE.md).
# Roda da raiz: python ferramentas/prova_trilho.py
import sys, pathlib, re
sys.path.insert(0, 'ferramentas')
sys.stdout.reconfigure(encoding='utf-8')
from contraste import ratio

RAIZ = pathlib.Path(__file__).resolve().parent.parent
css = (RAIZ / 'public' / 'app.css').read_text(encoding='utf-8')

ESPERADO = {
    '--tr-fila-follow-up': '#5B6BA8',
    '--tr-captacao':       '#3E8C8C',
    '--tr-conteudo':       '#7A5FA8',
    '--tr-loja-estoque':   '#A87155',
    '--tr-pos-venda':      '#6B8C5B',
    '--tr-analise':        '#5F7386',
    '--tr-fechamento':     '#8C5F7A',
}
SEMANTICOS = {'quente': '#F26B31', 'morno': '#C48808', 'frio': '#8395AF',
              'ok': '#17A06B', 'erro': '#B01235', 'accent': '#0025cc'}
ALVO = 3.0

falhas = []
for var, hexo in ESPERADO.items():
    m = re.search(re.escape(var) + r'\s*:\s*(#[0-9A-Fa-f]{6})', css)
    if not m:
        falhas.append('%s ausente do app.css' % var); continue
    achado = m.group(1)
    if achado.upper() != hexo.upper():
        falhas.append('%s = %s, esperava %s' % (var, achado, hexo)); continue
    r = ratio(achado, '#FFFFFF')
    pior_k, pior_r = min(((k, ratio(achado, v)) for k, v in SEMANTICOS.items()),
                         key=lambda kv: kv[1])
    marca = 'OK' if r >= ALVO else 'REPROVA'
    print('  %-22s %s  vs branco %5.2f  [%s]   pior par: %s %.2f'
          % (var, achado, r, marca, pior_k, pior_r))
    if r < ALVO:
        falhas.append('%s tem %.2f contra branco, alvo %.1f' % (var, r, ALVO))

print()
if falhas:
    print('REPROVOU:'); [print('  - ' + f) for f in falhas]; sys.exit(1)
print('7 trilhos OK. Lembrete: as colisoes com semantico sao BAIXAS (1.1 a 1.5).')
print('Matiz sozinho nao separa. O icone e obrigatorio, nao e enfeite.')
```

- [ ] **Step 2: Rodar a prova para verificar que ela FALHA**

```bash
python ferramentas/prova_trilho.py
```

Esperado: `REPROVOU:` listando `--tr-fila-follow-up ausente do app.css` e os outros seis. Exit code 1.

- [ ] **Step 3: Acrescentar os tokens ao `:root` do `app.css`**

Inserir logo apos a linha `--erro-linha:#F2C2CE;`, mantendo o estilo compacto do arquivo:

```css
--tr-fila-follow-up:#5B6BA8;
--tr-captacao:#3E8C8C;
--tr-conteudo:#7A5FA8;
--tr-loja-estoque:#A87155;
--tr-pos-venda:#6B8C5B;
--tr-analise:#5F7386;
--tr-fechamento:#8C5F7A;
```

- [ ] **Step 3b: Abrir a excecao nomeada na guarda do `:root`**

**Conflito descoberto durante a execucao, resolvido por decisao consciente do dono em 20/07/2026.**

`ferramentas/validar.py` (por volta da linha 238) exige que o bloco `:root` seja byte a byte igual ao da baseline, com a mensagem `decisao 8: zero token novo`. Os 7 trilhos violam isso. A regra 11.3 logo abaixo (`zero hex no app.js`) impede a saida alternativa de por a cor no JS.

**O dono escolheu abrir excecao nomeada, nao derrubar a guarda.** A guarda continua valendo para todo o resto.

**Nao repontar `ferramentas/app.css.antes` para calar a guarda.** Foi o que uma tentativa anterior fez, e e derrotar um guard-rail em silencio: a baseline deixa de responder "o que esta obra mudou". Se a guarda reclamar, a resposta e esta excecao explicita, nunca mover a baseline.

Substituir o bloco `# 11.2 zero token novo` inteiro por:

```python
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
}
root_novo = novo_css.split(':root{',1)[1].split('}',1)[0]
root_velho = velho_css.split(':root{',1)[1].split('}',1)[0]
def _decls(bloco):
    return set(d.strip().replace(' ', '') for d in bloco.split(';') if d.strip())
_novas   = _decls(root_novo) - _decls(root_velho)
_sumidas = _decls(root_velho) - _decls(root_novo)
ck(not _sumidas, f'token REMOVIDO do :root: {sorted(_sumidas)}')
ck(not (_novas - TOKENS_TRILHO),
   f'token novo no :root fora da excecao dos trilhos: {sorted(_novas - TOKENS_TRILHO)}')
```

**Provar que a guarda continua mordendo**, e nao virou decoracao. Acrescentar um oitavo token falso ao `:root` do `public/app.css`, rodar `python ferramentas/validar.py`, confirmar que ele REPROVA nomeando o token falso, e entao remover o token falso. Registrar essa saida no relatorio: sem ela nao ha prova de que a excecao nao abriu um buraco geral.

- [ ] **Step 4: Rodar a prova e a suite**

```bash
python ferramentas/prova_trilho.py
python ferramentas/validar.py; echo "EXIT: $?"
```

**Conferir o EXIT, nao so o texto.** `validar.py` imprime `REPROVOU:` e sai com codigo 1. Uma tentativa anterior leu a saida por cima, chamou a reprova de "esperada" e commitou vermelho.

Esperado em `prova_trilho.py`: sete linhas `[OK]` com os valores 5.11, 3.94, 5.21, 4.07, 3.80, 4.90, 5.21, e a mensagem final. Exit 0.
Esperado em `validar.py`: verde.

- [ ] **Step 5: Commit**

```bash
git add public/app.css ferramentas/prova_trilho.py ferramentas/validar.py
git commit -m "feat(css): 7 tokens de trilho de categoria, com contraste provado

Medidos contra branco: 3.80 a 5.21, todos acima do alvo de 3:1.
As colisoes com as cores semanticas ficam entre 1.14 e 1.44, o que confirma
que matiz sozinho nao separa: por isso o trilho nunca renderiza sem icone.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Helpers de JS (trilho, icone, nivel da peca, carga da semana)

**Files:**
- Create: `ferramentas/patch_hierarquia.py`
- Modify: `public/app.js` (via patch)

**Interfaces:**
- Consumes: helper `l()` ja existente no `app.js`, que devolve a data de hoje no fuso do Brasil como `YYYY-MM-DD`. Helper `c()` ja existente, que escapa HTML.
- Produces, consumidos pelas tarefas 4, 5 e 6:
  - `trilhoDe(codigo) -> string` var CSS, ex: `"var(--tr-captacao)"`
  - `iconeCat(codigo) -> string` HTML de um `<svg class="tr-ico">`
  - `nivelPeca(dataISO, statusCodigo) -> string` um de `"vencido" | "quente" | "morno" | "frio" | "ok" | "nulo"`
  - `cargaSemana(categorias) -> array` de 8 posicoes, indices 1..7 = ISODOW, posicao 0 sempre 0
  - `DIAS_ISO` ja existe no `app.js` e continua sendo a fonte dos rotulos de dia

- [ ] **Step 1: Criar o esqueleto do patch com os helpers**

Criar `ferramentas/patch_hierarquia.py`:

```python
# Reorganizacao da hierarquia do frontend: Conteudo (kanban com data),
# Rotina (grade de 7 colunas) e Hoje (reordenado), mais o sistema trilho x sinal.
#
# Patch cirurgico no app.js (minificado, uma linha so). Espelha patch_historico.py:
# cada troca e ancorada em texto exato e falha alto se a ancora nao bater ou nao
# for unica. As funcoes novas entram LEGIVEIS no fim do arquivo.
# Roda da raiz: python ferramentas/patch_hierarquia.py
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

exige_ausente('function trilhoDe', 'idempotencia')

# ------------------------------------------------- helpers do sistema trilho x sinal
HELPERS = r'''
var TRILHO_MAPA={fila_follow_up:"--tr-fila-follow-up",captacao:"--tr-captacao",conteudo:"--tr-conteudo",loja_estoque:"--tr-loja-estoque",pos_venda:"--tr-pos-venda",analise:"--tr-analise",fechamento:"--tr-fechamento"};
var TRILHO_ANEL=["--tr-fila-follow-up","--tr-captacao","--tr-conteudo","--tr-loja-estoque","--tr-pos-venda","--tr-analise","--tr-fechamento"];
// Categoria nova entra pelo anel, por hash do CODIGO (invariante 12: nunca o rotulo).
// Deterministico: a mesma categoria recebe a mesma cor em toda sessao.
function trilhoDe(cod){
var k=String(cod||"");
if(TRILHO_MAPA[k])return"var("+TRILHO_MAPA[k]+")";
var h=0,i=0;for(;i<k.length;i++)h=(h*31+k.charCodeAt(i))>>>0;
return"var("+TRILHO_ANEL[h%7]+")"}
var ICONE_MAPA={
fila_follow_up:'<path d="M4 7h10M4 12h16M4 17h7" stroke-linecap="round"/>',
captacao:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/>',
conteudo:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16" stroke-linecap="round"/>',
loja_estoque:'<path d="M4 8h16l-1 12H5L4 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke-linecap="round"/>',
pos_venda:'<path d="M12 21s-7-4.5-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 3.5c0 5-7 9.5-7 9.5z" stroke-linejoin="round"/>',
analise:'<path d="M5 19V11M12 19V5M19 19v-6" stroke-linecap="round"/>',
fechamento:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2" stroke-linecap="round"/>'};
// O icone NAO e enfeite: as colisoes de luminancia entre trilho e cor semantica
// ficam entre 1.14 e 1.44, entao matiz sozinho nao distingue. Trilho sem icone
// e regressao.
function iconeCat(cod){
return'<svg class="tr-ico" viewBox="0 0 24 24" aria-hidden="true">'+(ICONE_MAPA[String(cod||"")]||'<circle cx="12" cy="12" r="7"/>')+"</svg>"}
// Nivel DERIVADO na leitura (invariante 4), nunca coluna no banco.
// Usa l() (hoje no fuso do Brasil), nunca new Date() cru (invariante 10).
function nivelPeca(dt,st){
if("publicado"===st)return"ok";
if("descartado"===st)return"nulo";
var h=new Date(l()+"T12:00:00"),d=new Date(String(dt||"")+"T12:00:00");
if(isNaN(d.getTime()))return"nulo";
var dd=Math.round((d-h)/864e5);
if(dd<0)return"vencido";
if(0===dd)return"quente";
if(dd<=6)return"morno";
return"frio"}
// dias_semana null ou vazio = TODOS os dias (o proprio formulario diz isso).
function cargaSemana(cats){
var n=[0,0,0,0,0,0,0,0];
(cats||[]).forEach(function(ct){(ct.tarefas||[]).forEach(function(t){
var ds=t.dias_semana&&t.dias_semana.length?t.dias_semana:[1,2,3,4,5,6,7];
ds.forEach(function(d){d>=1&&d<=7&&n[d]++})})});
return n}
function tarefasDoDia(cats,iso){
var out=[];
(cats||[]).forEach(function(ct){(ct.tarefas||[]).forEach(function(t){
var ds=t.dias_semana&&t.dias_semana.length?t.dias_semana:[1,2,3,4,5,6,7];
ds.indexOf(iso)>=0&&out.push({cat:ct,tarefa:t})})});
return out}
'''

# As funcoes entram ANTES do IIFE final que chama PitWall.init().
troca(
    'window.__PITWALL_SEM_INIT||',
    HELPERS + 'window.__PITWALL_SEM_INIT||',
    'helpers trilho x sinal'
)

# ------------------------------------------------------------------ gravar
if src == orig:
    print('  FALHOU: nada mudou'); sys.exit(1)
ALVO.write_text(src, encoding='utf-8')
print('patch_hierarquia: aplicado, %d -> %d bytes' % (len(orig), len(src)))
```

- [ ] **Step 2: Rodar o patch**

```bash
python ferramentas/patch_hierarquia.py
```

Esperado:
```
  ok [helpers trilho x sinal]
patch_hierarquia: aplicado, 44527 -> N bytes
```

Se aparecer `FALHOU [...]: ancora aparece 0x`, **pare**: o `app.js` mudou desde a leitura e a ancora precisa ser reconferida, nunca afrouxada.

- [ ] **Step 3: Provar sintaxe e os helpers contra o dado real**

```bash
python ferramentas/validar.py
```

Esperado: verde, incluindo `esprima.parseScript` (prova que os helpers sao ES5 valido).

Acrescentar ao fim de `ferramentas/harness.py`, no bloco de assercoes, uma prova de `cargaSemana` contra o molde real. No stub, `ROT_CATS`/`ROT_TAREFAS` precisam refletir as 17 tarefas reais (Task 4 Step 1 faz isso). Nesta tarefa, a prova minima e via console do Chrome:

```javascript
// dentro do harness, apos carregar o app:
cargaSemana([{tarefas:[{dias_semana:[1,2,3,4,5]},{dias_semana:null},{dias_semana:[5]}]}])
// esperado: [0,2,2,2,2,3,1,1]
//   dias_semana null conta em TODOS os 7 dias; [5] soma so na sexta.
```

- [ ] **Step 4: Commit**

```bash
git add ferramentas/patch_hierarquia.py public/app.js
git commit -m "feat(js): helpers do sistema trilho x sinal

trilhoDe, iconeCat, nivelPeca, cargaSemana, tarefasDoDia.
nivelPeca deriva na leitura via l() (fuso BR), nunca vira coluna no banco
(invariantes 4 e 10). trilhoDe chaveia por codigo, nunca por rotulo (12).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Rotina em grade de 7 colunas

**Files:**
- Modify: `ferramentas/patch_hierarquia.py` (nova secao), `public/app.js` (via patch), `public/app.css`, `ferramentas/harness.py`

**Interfaces:**
- Consumes: `cargaSemana`, `tarefasDoDia`, `trilhoDe`, `iconeCat`, `DIAS_ISO`, `l()`, `c()` da Task 3.
- Produces: `renderRotina` reescrita. Classes CSS novas: `.rot-carga`, `.rot-carga-cel`, `.rot-grade`, `.rot-col`, `.rot-col-cab`, `.rot-cel`. Os `data-acao` `rot-add-tarefa`, `rot-add-cat`, `rot-rm-tarefa`, `rot-dia` sao **preservados sem renomear**.

- [ ] **Step 1: Alimentar o harness com o molde REAL (17 tarefas) e escrever a assercao que falha**

Em `ferramentas/harness.py`, substituir o stub magro de `ROT_CATS`/`ROT_TAREFAS` pelo molde real lido do banco em 20/07/2026:

```javascript
var ROT_CATS = [
  { codigo:'fila_follow_up', rotulo:'Fila & Follow-up', ordem:1 },
  { codigo:'captacao',       rotulo:'Captação',         ordem:2 },
  { codigo:'conteudo',       rotulo:'Conteúdo',         ordem:3 },
  { codigo:'loja_estoque',   rotulo:'Loja & Estoque',   ordem:4 },
  { codigo:'pos_venda',      rotulo:'Pós-venda',        ordem:5 },
  { codigo:'analise',        rotulo:'Análise',          ordem:6 },
  { codigo:'fechamento',     rotulo:'Fechamento',       ordem:7 }];
var ROT_TAREFAS = [
  { id:'t01', categoria:'fila_follow_up', titulo:'Rodar a Fila do dia até zerar',            dias_semana:[1,2,3,4,5],   ordem:1, ativa:true },
  { id:'t02', categoria:'fila_follow_up', titulo:'Atualizar quem respondeu',                 dias_semana:[1,2,3,4,5],   ordem:2, ativa:true },
  { id:'t03', categoria:'fila_follow_up', titulo:'Revisar lista fria',                       dias_semana:[5],           ordem:3, ativa:true },
  { id:'t04', categoria:'captacao',       titulo:'Registrar as abordagens do dia',           dias_semana:[1,2,3,4,5,6], ordem:1, ativa:true },
  { id:'t05', categoria:'conteudo',       titulo:'Conferir o card de hoje',                  dias_semana:[1,2,3,4,5],   ordem:1, ativa:true },
  { id:'t06', categoria:'conteudo',       titulo:'Publicar a peça do dia',                   dias_semana:[1,2,3,4,5],   ordem:2, ativa:true },
  { id:'t07', categoria:'conteudo',       titulo:'Responder DM e comentário',                dias_semana:[1,2,3,4,5,6], ordem:3, ativa:true },
  { id:'t08', categoria:'conteudo',       titulo:'Produzir os cards da semana seguinte',     dias_semana:[4],           ordem:4, ativa:true },
  { id:'t09', categoria:'conteudo',       titulo:'Agendar as publicações da semana',         dias_semana:[1],           ordem:5, ativa:true },
  { id:'t10', categoria:'loja_estoque',   titulo:'Conferir estoque e preço',                 dias_semana:[1],           ordem:1, ativa:true },
  { id:'t11', categoria:'loja_estoque',   titulo:'Revisar preço vs concorrência',            dias_semana:[3],           ordem:2, ativa:true },
  { id:'t12', categoria:'pos_venda',      titulo:'Checar quem comprou na semana',            dias_semana:[4],           ordem:1, ativa:true },
  { id:'t13', categoria:'pos_venda',      titulo:'Pedir depoimento de quem comprou',         dias_semana:[2],           ordem:2, ativa:true },
  { id:'t14', categoria:'analise',        titulo:'Ler a auditoria da semana e escolher 1 ação', dias_semana:[1],        ordem:1, ativa:true },
  { id:'t15', categoria:'analise',        titulo:'Revisar o funil: leads entrados vs convertidos', dias_semana:[5],     ordem:2, ativa:true },
  { id:'t16', categoria:'analise',        titulo:'Fechar a semana: o que funcionou, o que corta',  dias_semana:[5],     ordem:3, ativa:true },
  { id:'t17', categoria:'fechamento',     titulo:'Fechar o dia: nota e pendências',          dias_semana:[1,2,3,4,5,6], ordem:1, ativa:true }];
```

Acrescentar as assercoes (seguindo o estilo de assercao que o `harness.py` ja usa):

```
ASSERCAO: a aba Rotina tem exatamente 7 colunas .rot-col
ASSERCAO: os contadores de carga sao, em ordem, 10 8 8 9 10 3 0
ASSERCAO: a coluna de domingo existe e esta vazia (nao some)
ASSERCAO: toda .rot-cel tem um <svg class="tr-ico"> dentro
ASSERCAO: a tarefa 'Rodar a Fila do dia até zerar' aparece em 5 colunas
```

- [ ] **Step 2: Rodar o harness para verificar que FALHA**

```bash
python ferramentas/harness.py
```

Esperado: falha nas 5 assercoes novas. A grade nao existe: a `renderRotina` atual produz `.dia-sec` por categoria.

- [ ] **Step 3: Reescrever `renderRotina` pelo patch**

Acrescentar a `ferramentas/patch_hierarquia.py`, antes do bloco de gravacao:

```python
# ------------------------------------------------------------- Rotina: grade 7 col
ROTINA_NOVA = r'''
function rotCargaBarra(n){
var mx=Math.max.apply(null,n.slice(1,8))||1;
var i=1,out="";
for(;i<=7;i++){
var alt=Math.round(100*n[i]/mx);
out+='<div class="rot-carga-cel"><div class="rot-carga-num">'+n[i]+'</div><div class="rot-carga-tubo"><div class="rot-carga-fita" style="height:'+alt+'%"></div></div><div class="rot-carga-dia">'+DIAS_ISO[i]+"</div></div>"}
return'<div class="rot-carga" aria-label="Carga de tarefas por dia da semana">'+out+"</div>"}
function rotCelula(par,pode){
var t=par.tarefa,ct=par.cat;
return'<div class="rot-cel" style="--tr:'+trilhoDe(ct.codigo)+'">'+iconeCat(ct.codigo)+'<span class="rot-cel-tit">'+c(t.titulo||"")+'</span><span class="rot-cel-cat">'+c(ct.rotulo||ct.codigo)+"</span>"+(pode?'<button class="dia-rm" data-acao="rot-rm-tarefa" data-id="'+c(t.id)+'">remover</button>':"")+"</div>"}
function rotGrade(cats,pode){
var hojeIso=new Date(l()+"T12:00:00").getDay();
hojeIso=0===hojeIso?7:hojeIso;
var i=1,out="";
for(;i<=7;i++){
var itens=tarefasDoDia(cats,i);
out+='<div class="rot-col'+(i===hojeIso?" hoje":"")+'"><div class="rot-col-cab">'+DIAS_ISO[i]+'<span class="rot-col-n">'+itens.length+"</span></div>"+(itens.length?itens.map(function(p){return rotCelula(p,pode)}).join(""):'<div class="rot-col-vazio">livre</div>')+"</div>"}
return'<div class="rot-grade">'+out+"</div>"}
'''
troca('function renderRotina(', ROTINA_NOVA + 'function renderRotina(', 'funcoes da grade da Rotina')
```

Depois, **substituir a funcao `renderRotina` INTEIRA**, nao remendar por dentro. Codigo antigo preservado atras de um `0?` (ou qualquer outra forma de codigo morto) e divida tecnica que o proximo leitor paga: **nao fazer isso**.

Como trocar a funcao inteira com seguranca, dado que o arquivo e uma linha so: localizar `async function renderRotina(){` e caminhar contando chaves ate a que fecha, exatamente como o script Node da exploracao faz. Acrescentar ao `patch_hierarquia.py` este helper e usa-lo:

```python
def troca_funcao(nome, novo_corpo, rotulo):
    """Substitui uma funcao inteira, do 'async function NOME(' ate a chave que fecha.
    Falha alto se o nome nao aparecer exatamente 1x."""
    global src
    marca = 'async function %s(' % nome
    n = src.count(marca)
    if n != 1:
        print('  FALHOU [%s]: "%s" aparece %dx, esperava 1x' % (rotulo, marca, n))
        sys.exit(1)
    i = src.index(marca)
    j = src.index('{', i)
    d = 0
    k = j
    while k < len(src):
        if src[k] == '{': d += 1
        elif src[k] == '}':
            d -= 1
            if d == 0: break
        k += 1
    if d != 0:
        print('  FALHOU [%s]: chaves desbalanceadas' % rotulo); sys.exit(1)
    src = src[:i] + novo_corpo.strip() + src[k+1:]
    print('  ok [%s] (%d bytes trocados)' % (rotulo, k + 1 - i))
```

**Armadilha:** contar chaves cegamente quebra se houver `{` ou `}` dentro de uma string literal do corpo da funcao. A `renderRotina` tem varias strings HTML, mas **nenhuma contem chave** (conferido no arquivo atual). Se em algum momento passar a conter, este helper para de servir e a troca tem que voltar a ser por ancora de texto exato. Deixar este comentario no codigo.

A `renderRotina` nova, completa:

```javascript
async function renderRotina(){
var e=E("lista");
e.innerHTML='<div class="estado">Lendo o molde…</div>';
var r=await t.rpc("rotina_completa",{});
if(r.error)return void(e.innerHTML='<div class="estado erro">Falha ao ler a rotina: '+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");
var d=r.data;
if(!d||!1===d.ok)return void(e.innerHTML='<div class="estado erro">'+c(d&&d.msg||"Falha ao ler a rotina.")+"</div>");
var pode=!0===d.pode_editar,cats=d.categorias||[],corpo,forms="";
corpo=cats.length?rotCargaBarra(cargaSemana(cats))+rotGrade(cats,pode):'<div class="estado"><strong>O molde está vazio.</strong>'+(pode?"Crie a primeira categoria abaixo. As tarefas do molde viram o checklist da aba Hoje, todo dia.":"O dono ainda não digitou o molde da rotina.")+"</div>";
if(pode){
var ops=cats.map(function(x){return'<option value="'+c(x.codigo)+'">'+c(x.rotulo)+"</option>"}).join(""),
togs=[1,2,3,4,5,6,7].map(function(i){return'<button class="rot-dia-tog" data-acao="rot-dia" data-dia="'+i+'" aria-pressed="false">'+DIAS_ISO[i]+"</button>"}).join("");
forms='<div class="dia-sec">'+(cats.length?'<div class="dia-sec-tit">Nova tarefa no molde</div><div class="rot-form"><div class="rot-form-lin"><input id="rotNovoTit" placeholder="Título da tarefa…" autocomplete="off"><select id="rotNovaCat" aria-label="Categoria">'+ops+'</select></div><div class="rot-form-lin">'+togs+'<span class="rot-dica">nenhum dia marcado = todo dia</span></div><div class="rot-form-lin"><button class="btn-acao" data-acao="rot-add-tarefa">Adicionar tarefa</button></div></div>':"")+'<div class="rot-form"><div class="dia-sec-tit">Nova categoria</div><div class="rot-form-lin"><input id="rotNovaCatRot" placeholder="Nome da categoria (ex: Atendimento e Vendas)" autocomplete="off"><button class="btn-acao" data-acao="rot-add-cat">Criar categoria</button></div></div></div>'}
e.innerHTML=corpo+forms}
```

- [ ] **Step 4: CSS da grade**

Acrescentar ao fim de `public/app.css`:

```css
/* ---------- Rotina: carga da semana + grade de 7 colunas ---------- */
.rot-carga{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:0 0 18px}
.rot-carga-cel{display:flex;flex-direction:column;align-items:center;gap:5px}
.rot-carga-num{font-family:var(--mono);font-size:13px;font-weight:500;color:var(--text)}
.rot-carga-tubo{width:100%;height:38px;background:var(--surface);border-radius:var(--radius-p);display:flex;align-items:flex-end;overflow:hidden}
.rot-carga-fita{width:100%;background:var(--accent);opacity:.28;border-radius:var(--radius-p)}
.rot-carga-dia{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}

.rot-grade{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;align-items:start}
.rot-col{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:8px;min-height:60px}
.rot-col.hoje{border-color:var(--accent-linha);background:var(--accent-tint)}
.rot-col-cab{display:flex;align-items:center;justify-content:space-between;font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);padding:0 2px 7px;border-bottom:1px solid var(--line);margin-bottom:7px}
.rot-col-n{font-size:11px;letter-spacing:0;color:var(--text)}
.rot-col-vazio{font-size:12px;color:var(--dim);padding:6px 2px}

/* trilho: barra de 3px + icone. NUNCA preenchimento (ver spec secao 3). */
.rot-cel{position:relative;padding:7px 6px 7px 11px;margin-bottom:5px;border-radius:var(--radius-p);background:var(--surface);display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.rot-cel::before{content:"";position:absolute;left:0;top:4px;bottom:4px;width:3px;border-radius:2px;background:var(--tr)}
.rot-cel .tr-ico{width:13px;height:13px;flex:none;stroke:var(--tr);fill:none;stroke-width:1.7}
.rot-cel-tit{font-size:12.5px;line-height:1.3;flex:1 1 100%;order:3}
.rot-cel-cat{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--tr)}
.rot-cel .dia-rm{margin-left:auto}

/* Refluxo: abaixo de 900px a grade vira pilha por dia. So CSS, sem 2o layout em JS. */
@media (max-width:900px){
  .rot-grade{grid-template-columns:1fr}
  .rot-col{min-height:0}
  .rot-carga{gap:3px}
  .rot-carga-tubo{height:26px}
}
```

- [ ] **Step 5: Aplicar o patch e rodar tudo**

```bash
git checkout public/app.js && python ferramentas/patch_hierarquia.py
python ferramentas/validar.py
python ferramentas/harness.py
```

Esperado: `validar.py` verde; `harness.py` com as 5 assercoes da Task 4 passando, incluindo os contadores `10 8 8 9 10 3 0`.

**Se os contadores nao baterem, o defeito esta em `cargaSemana`, nao no stub.** O molde real do stub foi copiado do banco e ja foi conferido tarefa por tarefa contra esses numeros.

- [ ] **Step 6: Commit**

```bash
git add ferramentas/patch_hierarquia.py ferramentas/harness.py public/app.js public/app.css
git commit -m "feat(rotina): grade de 7 colunas com carga da semana visivel

A tela agrupava por categoria e escrevia os dias como texto, entao a carga
seg 10 | ter 8 | qua 8 | qui 9 | sex 10 | sab 3 | dom 0 era invisivel, embora
o handoff v32 a tenha nomeado como ponto de risco. Agora ela e a primeira
coisa da tela. Domingo aparece vazio de proposito: sumir esconderia a
informacao de que domingo esta livre.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Conteudo em kanban de funil, com a data em vista

**Files:**
- Modify: `ferramentas/patch_hierarquia.py`, `public/app.js` (via patch), `public/app.css`, `ferramentas/harness.py`

**Interfaces:**
- Consumes: `nivelPeca`, `c()`, `l()`, `fmtDia`, `syncLinha` (existentes).
- Produces: `renderConteudo` reescrita, `contKanban`, `contCard`, `contUltimaPub`. `data-acao="sync-agora"` preservado. Novo `data-acao="cont-descartado"` para abrir/fechar a coluna colapsada.

- [ ] **Step 1: Alimentar o harness com conteudo real e escrever as assercoes que falham**

Em `ferramentas/harness.py`, o stub `CONT` hoje tem 2 itens e um `status_codigo:'planejado'` que **nao existe no banco**. Trocar por uma amostra com os cinco status reais e datas relativas a `2026-07-20`:

```javascript
var CONT = [
  { id:'c1', titulo:'Story bastidores', data:'2026-07-15', tipo_rotulo:'Story', tipo_codigo:'story', status_rotulo:'A produzir',  status_codigo:'a_produzir',  semana:'S29', url:'https://www.notion.so/c1', hoje:false },
  { id:'c2', titulo:'Reels comparativo', data:'2026-07-18', tipo_rotulo:'Reels', tipo_codigo:'reels', status_rotulo:'Em produção', status_codigo:'em_producao', semana:'S29', url:null, hoje:false },
  { id:'c3', titulo:'Story enquete',     data:'2026-07-20', tipo_rotulo:'Story', tipo_codigo:'story', status_rotulo:'A produzir',  status_codigo:'a_produzir',  semana:'S30', url:null, hoje:true },
  { id:'c4', titulo:'Feed lancamento',   data:'2026-07-24', tipo_rotulo:'Feed',  tipo_codigo:'feed',  status_rotulo:'Pronto',      status_codigo:'pronto',      semana:'S30', url:null, hoje:false },
  { id:'c5', titulo:'Reels tutorial',    data:'2026-08-05', tipo_rotulo:'Reels', tipo_codigo:'reels', status_rotulo:'A produzir',  status_codigo:'a_produzir',  semana:'S32', url:null, hoje:false },
  { id:'c6', titulo:'Story recap',       data:'2026-07-14', tipo_rotulo:'Story', tipo_codigo:'story', status_rotulo:'Publicado',   status_codigo:'publicado',   semana:'S29', url:null, hoje:false },
  { id:'c7', titulo:'Story ideia velha', data:'2026-07-13', tipo_rotulo:'Story', tipo_codigo:'story', status_rotulo:'Descartado',  status_codigo:'descartado',  semana:'S29', url:null, hoje:false }];
```

Assercoes novas:

```
ASSERCAO: existem 4 colunas .cont-col visiveis (a_produzir, em_producao, pronto, publicado)
ASSERCAO: a coluna Descartado nasce colapsada, com contador 1
ASSERCAO: c1 (15/07, a_produzir) recebe classe nivel-vencido
ASSERCAO: c3 (20/07, a_produzir) recebe classe nivel-quente
ASSERCAO: c4 (24/07, pronto) recebe classe nivel-morno
ASSERCAO: c5 (05/08, a_produzir) recebe classe nivel-frio
ASSERCAO: c6 (publicado) recebe classe nivel-ok e NAO conta como vencida
ASSERCAO: o cabecalho diz 'última publicação há 6 dias'
ASSERCAO: a coluna a_produzir tem cabecalho com 3 itens e 1 vencida
```

**Prova do invariante 4:** `nivelPeca` deriva de `l()`. O harness fixa a data congelando o retorno de `l()` para `'2026-07-20'` no stub, senao as assercoes apodrecem amanha. Fazer isso explicitamente, nao confiar no relogio da maquina.

- [ ] **Step 2: Rodar o harness para verificar que FALHA**

```bash
python ferramentas/harness.py
```

Esperado: falham as 9 assercoes novas. A `renderConteudo` atual produz `.cont-log` por data, sem coluna e sem classe de nivel.

- [ ] **Step 3: Reescrever `renderConteudo` pelo patch**

Substituir a funcao `renderConteudo` INTEIRA usando o helper `troca_funcao('renderConteudo', ..., ...)` criado na Task 4. As funcoes auxiliares novas (`CONT_COLUNAS`, `contUltimaPub`, `contCard`, `contColuna`) entram junto, no mesmo bloco. Nada de remendo por dentro nem de codigo morto preservado:

```javascript
var CONT_COLUNAS=[
{cod:"a_produzir",rot:"A produzir"},
{cod:"em_producao",rot:"Em produção"},
{cod:"pronto",rot:"Pronto"},
{cod:"publicado",rot:"Publicado"}];
function contUltimaPub(itens){
var ult=null,i=0;
for(;i<itens.length;i++)if("publicado"===itens[i].status_codigo&&(!ult||itens[i].data>ult))ult=itens[i].data;
if(!ult)return'<span class="cont-pub nenhuma">nenhuma publicação na janela</span>';
var dd=Math.round((new Date(l()+"T12:00:00")-new Date(ult+"T12:00:00"))/864e5);
return'<span class="cont-pub'+(dd>=3?" alerta":"")+'">última publicação há '+dd+(1===dd?" dia":" dias")+"</span>"}
function contCard(x){
var nv=nivelPeca(x.data,x.status_codigo);
var sub=x.tipo_rotulo||x.semana?'<div class="cont-tipo">'+c(x.tipo_rotulo||"")+(x.semana?(x.tipo_rotulo?" · ":"")+c(x.semana):"")+"</div>":"";
return'<div class="cont-card nivel-'+nv+'"><div class="cont-data-chip">'+c(fmtDia(x.data))+("vencido"===nv?'<span class="cont-venc">vencida</span>':"")+'</div><div class="cont-tit">'+c(x.titulo||"")+"</div>"+sub+(x.url?'<a class="cont-link" target="_blank" rel="noopener" href="'+c(x.url)+'">Notion</a>':"")+"</div>"}
function contColuna(col,itens){
var meus=itens.filter(function(x){return x.status_codigo===col.cod}).sort(function(a,b){return a.data<b.data?-1:a.data>b.data?1:0});
var venc=meus.filter(function(x){return"vencido"===nivelPeca(x.data,x.status_codigo)}).length;
return'<div class="cont-col" data-col="'+c(col.cod)+'"><div class="cont-col-cab"><span class="cont-col-rot">'+c(col.rot)+'</span><span class="cont-col-n">'+meus.length+"</span>"+(venc?'<span class="cont-col-venc">'+venc+" vencida"+(1===venc?"":"s")+"</span>":"")+"</div>"+(meus.length?meus.map(contCard).join(""):'<div class="cont-col-vazio">vazia</div>')+"</div>"}
async function renderConteudo(){
var e=E("lista");
e.innerHTML='<div class="estado">Lendo o calendário…</div>';
var r=await t.rpc("conteudo_periodo",{});
if(r.error)return void(e.innerHTML='<div class="estado erro">Falha ao ler o conteúdo: '+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");
var d=r.data;
if(!d||!1===d.ok)return void(e.innerHTML='<div class="estado erro">'+c(d&&d.msg||"Falha ao ler o conteúdo.")+"</div>");
var itens=d.itens||[];
var topo='<div class="cont-topo"><div class="cont-topo-esq"><span class="cont-janela">'+c(fmtDia(d.ini))+" a "+c(fmtDia(d.fim))+"</span>"+contUltimaPub(itens)+"</div>"+syncLinha(d.sync)+'<button class="btn-sync" data-acao="sync-agora">Sincronizar</button></div>';
if(!itens.length)return void(e.innerHTML=topo+'<div class="estado"><strong>Calendário vazio na janela.</strong>De '+c(fmtDia(d.ini))+" a "+c(fmtDia(d.fim))+", nenhuma peça com Data no Notion."+(null==(d.sync||{}).ok?" O sync nunca rodou: toque em Sincronizar.":"")+"</div>");
var desc=itens.filter(function(x){return"descartado"===x.status_codigo});
var kan='<div class="cont-kanban">'+CONT_COLUNAS.map(function(col){return contColuna(col,itens)}).join("")+"</div>";
var dsc=desc.length?'<div class="cont-desc"><button class="cont-desc-cab" data-acao="cont-descartado" aria-expanded="false">Descartado <span class="cont-col-n">'+desc.length+'</span></button><div class="cont-desc-corpo">'+desc.map(contCard).join("")+"</div></div>":"";
e.innerHTML=topo+kan+dsc}
```

E acrescentar o tratador no delegador, ancorado no `sync-agora` existente:

```python
troca(
    'if("sync-agora"===o)return void sincronizarAgora(e);',
    'if("cont-descartado"===o){var cd=e.parentNode;cd.className="cont-desc"+("true"===e.getAttribute("aria-expanded")?"":" aberto");e.setAttribute("aria-expanded","true"===e.getAttribute("aria-expanded")?"false":"true");return}if("sync-agora"===o)return void sincronizarAgora(e);',
    'acao cont-descartado'
)
```

- [ ] **Step 4: CSS do kanban**

Acrescentar ao fim de `public/app.css`:

```css
/* ---------- Conteudo: kanban de funil com a data em vista ---------- */
.cont-topo{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 16px}
.cont-topo-esq{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-right:auto}
.cont-janela{font-family:var(--mono);font-size:11px;color:var(--dim)}
.cont-pub{font-size:12.5px;color:var(--dim)}
.cont-pub.alerta{color:var(--quente-fg);font-weight:500}
.cont-pub.nenhuma{color:var(--erro-fg)}

.cont-kanban{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-items:start}
.cont-col{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:9px}
.cont-col-cab{display:flex;align-items:center;gap:7px;padding:0 2px 8px;border-bottom:1px solid var(--line);margin-bottom:8px}
.cont-col-rot{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.cont-col-n{font-family:var(--mono);font-size:12px;font-weight:500;color:var(--text)}
.cont-col-venc{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;color:var(--quente-fg);background:var(--quente-bg);border:1px solid var(--quente-linha);border-radius:99px;padding:1px 6px;margin-left:auto}
.cont-col-vazio{font-size:12px;color:var(--dim);padding:6px 2px}

/* sinal de urgencia: faixa + chip preenchido. NUNCA e trilho de categoria. */
.cont-card{position:relative;padding:9px 9px 9px 12px;margin-bottom:6px;border-radius:var(--radius-p);background:var(--surface);border:1px solid var(--line)}
.cont-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:2px 0 0 2px;background:var(--frio)}
.cont-card.nivel-vencido::before,.cont-card.nivel-quente::before{background:var(--quente)}
.cont-card.nivel-morno::before{background:var(--morno)}
.cont-card.nivel-frio::before{background:var(--frio)}
.cont-card.nivel-ok::before{background:var(--ok)}
.cont-card.nivel-nulo::before{background:var(--line-forte)}
.cont-data-chip{display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;color:var(--dim);margin-bottom:4px}
.cont-card.nivel-vencido .cont-data-chip,.cont-card.nivel-quente .cont-data-chip{color:var(--quente-fg)}
.cont-card.nivel-morno .cont-data-chip{color:var(--morno-fg)}
.cont-card.nivel-ok .cont-data-chip{color:var(--ok-fg)}
.cont-venc{font-size:9px;letter-spacing:.08em;text-transform:uppercase;background:var(--quente-bg);border:1px solid var(--quente-linha);border-radius:99px;padding:1px 5px}
.cont-card .cont-tit{font-size:13px;line-height:1.35}
.cont-card .cont-tipo{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-top:3px}

.cont-desc{margin-top:14px}
.cont-desc-cab{background:none;border:1px solid var(--line);border-radius:var(--radius-p);padding:6px 11px;font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.cont-desc-corpo{display:none;margin-top:8px;max-width:340px}
.cont-desc.aberto .cont-desc-corpo{display:block}

@media (max-width:900px){
  .cont-kanban{grid-template-columns:1fr}
}
```

- [ ] **Step 5: Aplicar e rodar tudo**

```bash
git checkout public/app.js && python ferramentas/patch_hierarquia.py
python ferramentas/validar.py
python ferramentas/harness.py
```

Esperado: `validar.py` verde, `harness.py` com as 9 assercoes da Task 5 passando.

- [ ] **Step 6: Commit**

```bash
git add ferramentas/patch_hierarquia.py ferramentas/harness.py public/app.js public/app.css
git commit -m "feat(conteudo): kanban de funil com a data carregando o sinal de urgencia

A lista plana pintava 'Publicado' e 'A produzir' com o mesmo chip cinza, e
escondia que 45 de 66 cards sao backlog e que a ultima publicacao foi 14/07.
Agora: 4 colunas de funil, Descartado colapsado, e a data derivando nivel na
leitura (invariante 4) para que a peca vencida salte da coluna de 45.

O cabecalho declara a janela porque a coluna Publicado mostra 3 de 8: as
outras 5 caem fora do janela_atras_dias=7. Declarar a janela e o que impede
a tela de mentir.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Aba Hoje reordenada, com trilho nas tarefas

**Files:**
- Modify: `ferramentas/patch_hierarquia.py`, `public/app.js` (via patch), `public/app.css`, `ferramentas/harness.py`

**Interfaces:**
- Consumes: `trilhoDe`, `iconeCat` (Task 3), `contCard` (Task 5).
- Produces: ordem nova em `renderHoje`; `hojeTarefas` e `hojeConteudo` com trilho e sinal.

- [ ] **Step 1: Assercoes que falham**

Acrescentar em `ferramentas/harness.py`:

```
ASSERCAO: em .conteudo, .dia-sec de 'Nota do dia' e o ULTIMO .dia-sec da tela
ASSERCAO: a ordem dos titulos de secao e: Rotina do dia, Conteúdo de hoje, Lembretes, Nota do dia
ASSERCAO: toda linha de tarefa do dia tem <svg class="tr-ico">
ASSERCAO: os 8 data-acao da aba Hoje continuam presentes no DOM:
          dia-marcar, dia-remover, dia-add, dia-puxar,
          lemb-marcar, lemb-remover, lemb-add, dia-nota-ok
```

A ultima assercao e a rede de seguranca contra o risco nomeado no spec secao 9: perder um `data-acao` na reescrita quebra um botao **em silencio**.

- [ ] **Step 2: Rodar para verificar que FALHA**

```bash
python ferramentas/harness.py
```

Esperado: falha a ordem (hoje a nota vem em terceiro, antes de Lembretes e Conteúdo) e falha o trilho.

- [ ] **Step 3: Reordenar, ancorado**

```python
troca(
    'e.innerHTML=hojePlacar(d)+hojeTarefas(d)+hojeNota(d)+hojeLembretes(d)+hojeConteudo(d)}',
    'e.innerHTML=hojePlacar(d)+hojeTarefas(d)+hojeConteudo(d)+hojeLembretes(d)+hojeNota(d)}',
    'ordem da aba Hoje: nota vai para o fim'
)
```

Trilho na linha de tarefa, trocando o cabecalho de categoria e a linha:

```python
troca(
    'return\'<div class="dia-cat-rot">\'+c(ct.rotulo||ct.codigo)+"</div>"+(ts||\'<div class="dia-vazio">Nada nesta categoria hoje.</div>\')',
    'return\'<div class="dia-cat-rot" style="--tr:\'+trilhoDe(ct.codigo)+\'">\'+iconeCat(ct.codigo)+c(ct.rotulo||ct.codigo)+"</div>"+(ts||\'<div class="dia-vazio">Nada nesta categoria hoje.</div>\')',
    'trilho no cabecalho de categoria da aba Hoje'
)
```

E trocar `hojeConteudo` para usar `contCard` em vez de `contItem`, herdando o sinal de urgencia:

```python
troca(
    'function hojeConteudo(d){var itens=(d.conteudo||[]).map(contItem).join("");',
    'function hojeConteudo(d){var itens=(d.conteudo||[]).map(contCard).join("");',
    'aba Hoje herda o card de conteudo com sinal'
)
```

- [ ] **Step 4: CSS do trilho na aba Hoje**

Acrescentar ao fim de `public/app.css`:

```css
/* ---------- Hoje: trilho de categoria no cabecalho de secao ---------- */
.dia-cat-rot{display:flex;align-items:center;gap:6px;padding-left:9px;position:relative;color:var(--tr)}
.dia-cat-rot::before{content:"";position:absolute;left:0;top:2px;bottom:2px;width:3px;border-radius:2px;background:var(--tr)}
.dia-cat-rot .tr-ico{width:13px;height:13px;flex:none;stroke:var(--tr);fill:none;stroke-width:1.7}
.cont-solto .cont-card{max-width:340px}
```

- [ ] **Step 5: Aplicar e rodar tudo**

```bash
git checkout public/app.js && python ferramentas/patch_hierarquia.py
python ferramentas/validar.py
python ferramentas/harness.py
python ferramentas/prova_trilho.py
```

Esperado: as tres verdes, e o `harness.py` confirmando os 8 `data-acao` presentes.

- [ ] **Step 6: Commit**

```bash
git add ferramentas/patch_hierarquia.py ferramentas/harness.py public/app.js public/app.css
git commit -m "feat(hoje): nota vai para o fim, e as tarefas ganham trilho de categoria

A ordem era placar, tarefas, nota, lembretes, conteudo: a nota no meio da
pilha sem justificativa. A propria tarefa do molde e 'Fechar o dia: nota e
pendencias', entao a nota e o ato de fechamento e vai para o fim.
Conteudo de hoje passa a usar contCard e herda o sinal de urgencia.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Prova de ponta a ponta e deploy

**Files:**
- Modify: `docs/handoffs/handoff_migracao_pitwall_v33.md` (criar)

**Interfaces:**
- Consumes: tudo.
- Produces: tela no ar.

- [ ] **Step 1: Suite completa, do zero, a partir do repo limpo**

```bash
git status --porcelain
python ferramentas/validar.py
python ferramentas/harness.py
python ferramentas/prova_trilho.py
```

Esperado: working tree limpo (tudo commitado) e as tres suites verdes.

- [ ] **Step 2: Conferir que a Fila nao foi tocada**

```bash
git diff --stat 87030b7..HEAD -- public/
git log -p 87030b7..HEAD -- public/app.js | grep -c "sugerirMensagem\|pintarVariante\|copiarScript\|waHrefFila"
```

Esperado do `grep -c`: **0**. Qualquer numero acima de zero significa que a obra encostou nos invariantes 13 a 16 e precisa ser revertida naquele ponto.

- [ ] **Step 3: NAO fazer deploy ainda**

A obra vive na branch `frontend-hierarquia`, decisao do dono nesta sessao. **Nao dar push em `main` nesta tarefa:** push em main e o deploy, e o merge so acontece depois da revisao final de branch inteira. Publicar aqui pularia o portao.

Para provar na tela antes do merge, servir o `public/` local:

```bash
python -m http.server 8000 --directory public
```

E abrir `http://localhost:8000`. As RPCs batem no Supabase real, entao os numeros conferidos no Step 4 sao os do banco de verdade.

- [ ] **Step 4: Prova na tela real, contra os numeros do banco**

Abrir `http://localhost:8000` (servido no Step 3), entrar, e conferir olhando:

1. Aba **Rotina**: a barra de carga mostra `10 8 8 9 10 3 0`. A coluna de hoje esta marcada. Domingo aparece vazio, escrito `livre`.
2. Aba **Conteúdo**: coluna `A produzir` com 45 e `7 vencidas`; `Em produção` 4 com `3 vencidas`; `Pronto` 3 com `2 vencidas`; `Publicado` 3; `Descartado` colapsado com 6.
3. O cabecalho diz `última publicação há 6 dias` (ou o numero correto do dia em que rodar).
4. Aba **Hoje**: a Nota do dia e a ultima secao.
5. Encolher a janela abaixo de 900px: a grade da Rotina e o kanban viram uma coluna, sem rolagem horizontal.

**Numero na tela que nao bater com o banco reprova o deploy.**

- [ ] **Step 5: Handoff v33**

Criar `docs/handoffs/handoff_migracao_pitwall_v33.md` registrando **decisoes, nao so estado**:

- As duas decisoes do dono contra a recomendacao (cor hibrida, grade de 7 colunas) e por que foram aceitas.
- O achado da janela: `publicado` 3 na janela contra 8 na base, e por que o cabecalho declara a janela.
- A correcao do CLAUDE.md: a suite e Python (esprima + Chrome headless), nao acorn + jsdom, e `node` existe nesta maquina ao contrario do que o `ferramentas/LEIA-ME.md` afirma.
- Baselines repontadas (fecha a pendencia 12 do v32).
- Pendencias que continuam abertas do v32: 401 sem log, fidelidade do `index.ts`, calibrar meta de captacao, ligar captacao para lead.

- [ ] **Step 6: Commit**

```bash
git add docs/handoffs/handoff_migracao_pitwall_v33.md
git commit -m "docs: handoff v33 (hierarquia do frontend reorganizada)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review deste plano

**Cobertura do spec:**

| Secao do spec | Tarefa |
|---|---|
| 3. Trilho x sinal | 2 (tokens), 3 (helpers) |
| 3.1 Atribuicao por `codigo` | 3 (`trilhoDe`, `TRILHO_MAPA` + anel) |
| 3.2 Medicao | 2 (`prova_trilho.py`) |
| 4. Rotina grade 7 colunas | 4 |
| 4. Refluxo abaixo de 900px | 4 (CSS), conferido na 7 |
| 5. Conteudo kanban | 5 |
| 5. Data com sinal de urgencia | 3 (`nivelPeca`), 5 (classes `nivel-*`) |
| 5. Descartado colapsado | 5 |
| 5. Ultima publicacao ha N dias | 5 (`contUltimaPub`) |
| 6. Hoje reordenado | 6 |
| 7. Fila intocada | 7 Step 2 (prova por `grep -c` = 0) |
| 8. Portao de validacao | 1, e Step 5 de cada tarefa |
| 9. Risco de perder `data-acao` | 6 Step 1 (assercao dos 8) |
| 10. Criterio de pronto | 7 Step 4 |

**Correcao feita durante a escrita:** o spec dizia `publicado` 8 no criterio de pronto. Dentro da janela padrao sao 3. Corrigido nos numeros de verdade deste plano e virou requisito de UI (o cabecalho declara a janela). **O spec precisa ser corrigido tambem** na secao 8, item 3, e na secao 5.

**Consistencia de tipos:** `trilhoDe` devolve `"var(--tr-x)"` e e sempre consumida dentro de `style="--tr:..."`; o CSS le `var(--tr)`. `nivelPeca` devolve os seis literais usados nas classes `.nivel-*`, e o CSS define os seis. `cargaSemana` devolve array de 8 com indice 0 nao usado, e `rotCargaBarra` itera de 1 a 7.
