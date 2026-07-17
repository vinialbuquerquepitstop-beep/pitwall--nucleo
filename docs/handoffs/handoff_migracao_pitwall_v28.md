# Handoff Migracao Pit Wall (Nucleo) v28

Substitui a v27. Data: 16/07/2026.

---

## 1. Estado

| O que | Estado |
|---|---|
| Fase 4, historico do lead | No ar (`e95c98e`) e em uso: o dono registrou um `toque_enviado` real no LEAD-0013 as 20:50. |
| `registrar_nota` em producao | **Ainda nao exercitada por uso real.** Provada contra o banco em transacao revertida, nao por humano clicando. |
| **Fase 5, captacao ativa** | **Banco aplicado e provado. Front empurrado (`6210aec`), autorizado pelo dono.** |
| Memoria do projeto | Versionada no repo, fora de `public/`. |

---

## 2. Fase 5: o que foi construido

### 2.1 Por que existe
`prospeccao_ativa` tinha **0 de 15 leads**. Todo lead chegou sozinho (`whatsapp_direto` 9,
`whatsapp_status` 2, `indicacao` 2, `instagram` 1, `parceria_pag_local` 1). O Pit Wall
inteiro era uma maquina de TRABALHAR lead que chegou, sem nenhum conceito de "preciso de
N leads novos". A Fase 5 e o laco que CRIA lead.

### 2.2 Banco

| Objeto | Papel |
|---|---|
| `captacao_frente` | Config das frentes. Frente nova e um INSERT, nunca deploy. Seed: `instagram_dm` ("Instagram · DM"), uma so, para provar o laco antes de espalhar. |
| `captacao_meta` | Config da meta. Seed: `abordagens_dia` = **10**. Invariante 11: o numero vive aqui, nunca dentro da funcao nem no JS. |
| `captacao` | O esforco. Dedup por `unique(tenant_id, frente, identificador)`. |
| `registrar_captacao` / `registrar_opt_out` / `placar_captacao` / `captacao_do_dia` | As 4 RPCs. `security invoker`: a RLS vale. |

Todas com `tenant_id` + RLS + auditoria. Grants minimos: nada de DELETE nem TRUNCATE para
`authenticated` (invariante 9). `anon` nao executa nenhuma RPC.

### 2.3 Decisoes

| Decisao | Resultado |
|---|---|
| **A meta mede ESFORCO** | O dono controla quantas abordagens faz; nao controla se o estranho responde. Meta de resultado seria furada por motivo alheio e viraria numero ignorado, e ai a aba morre. "Viraram lead" aparece como consequencia observada, nunca como a meta. |
| **Consentimento nasce `true`** | **DECISAO CONSCIENTE DO DONO, CONTRA RECOMENDACAO.** Ver 2.4. |
| Alvo = 10/dia | Chute inicial, do Claude. **Calibrar depois de uma semana de dado real.** Trocar e um UPDATE, nao um deploy. |
| Uma frente so | Instagram · DM. Provar o laco antes de espalhar. |
| A aba mora em `Operação` | Captacao e acao, nao analise. O Dashboard (grupo `Análise`) segue vazio e nao foi destravado por isto: contar o proprio esforco e honesto com n=1; taxa de conversao nao. |

### 2.4 Consentimento: o registro da decisao

O dono decidiu: **"consentimento e sim ate que se diga o contrario"**, contra a
recomendacao. O conselho dado, e recusado, foi:

- A trava viva e `function b(a){if(!a||!0!==a.consentimento)return null;...}`: a Fila so
  devolve link de WhatsApp com `consentimento === true`. Se todo prospect frio nascer
  `true`, essa trava passa **todo mundo** e o invariante 16 vira enfeite. Falha que parece
  estar funcionando e a pior.
- A lei exige consentimento "livre, informada e **inequivoca**". Sim-por-padrao nao e
  inequivoco, e chamar de consentimento nao torna consentimento.
- O que o dono queria e legitimo e tinha nome proprio: **legitimo interesse + opt-out**,
  que nao exige consentimento e ja traz o direito de oposicao ("ate que se diga o
  contrario"). Era o modelo dele, com o campo certo.

**Contencao adotada, e ela e o que segura o estrago:** `captacao` e tabela PROPRIA.
Prospect frio **nao vira `lead`** enquanto nao responder, entao a Fila e a regua nem o
enxergam, e a trava do invariante 16 continua valendo para o `lead`. A colisao so
aconteceria se alguem passar a criar lead direto de prospect frio: **se isso for pedido,
e a hora de reabrir esta conversa.**

`opt_out_em` existe porque e a **segunda metade da regra do dono**: "ate que se diga o
contrario" so existe se houver onde gravar o contrario. E o banco **bloqueia** a
reabordagem depois disso, provado.

---

## 3. O front: a v1 do mock foi reprovada

O dono reprovou: "amadora, falta organizacao e intuitividade". Estava certo, e o
diagnostico veio da **propria referencia v3**, que diz textualmente:

> "O azul da marca aparece em quatro lugares e mais nenhum: item ativo, contador da fila,
> acao primaria e o chip de indicacao."

| Defeito da v1 | Correcao |
|---|---|
| Barra de progresso azul | **Quinto uso da marca**, e o maior elemento da tela. Removida. A v2 nao adiciona nenhum uso novo. |
| Celula "faltam 7" | Era "3 de 10" dito de novo. O pitboard JA faz "X de Y" na terceira linha (`Base ativa \| 10 \| de 15 na base`). Agora sao 4 quantidades DIFERENTES. |
| Formulario gordo | Captacao e atividade de **ritmo**: senta e dispara N seguidas. Virou UMA linha: digitar, Enter, proximo. |
| Card gordo por abordagem | Virou linha densa alinhada. A tese da referencia e "timing screen, nao cockpit". |
| "Pediu para parar" em bloco fixo | Espaco permanente para acao rara. Virou acao discreta no fim da linha. |

**Licao:** antes de desenhar, reler a referencia e obedecer o que ela DIZ, nao so imitar o
que ela parece. A regra do azul estava escrita e eu quebrei.

---

## 4. Validacao

- **Suite (`validar.py`): TUDO PASSOU.** O contrato de IDs foi **corrigido, nao afrouxado**:
  a Fase 5 cria elementos em runtime, entao a regra virou "todo ID que o JS busca existe no
  HTML **ou** na saida do proprio JS". Whitelist teria escondido erro de verdade.
- **Harness Chrome: 63 assercoes** (era 31). Prova o loop real: Enter registra sem tocar no
  botao, o campo limpa, o foco volta, o placar sobe, o pitboard de LEAD fica escondido na
  aba (sao numeros de outro laco), dedup recusa com a data, opt-out bloqueia a reabordagem,
  e voltar pra Fila nao deixa residuo.
- **Banco, em transacao revertida:** RLS com dono=1, vendedor=0, **TENANT ERRADO=0**
  (isolamento). 1 escrita = **exatamente 1** registro de auditoria, com antes/depois e autor
  certo. Dedup, frente invalida e identificador vazio recusados.
- Advisor de seguranca: nenhum alerta novo. So o Leaked Password Protection ja conhecido.

---

## 5. Achados tecnicos

- **A auditoria pegou um defeito meu antes de eu ver.** Fiz as tabelas de config com chave
  composta; `fn_auditar` resolve por `coalesce(new->>'id', new->>'lead_id')`, entao
  `registro_id` saiu nulo e a escrita foi **recusada**. A auditoria barrou o que nao
  conseguiria registrar. O padrao do projeto para config auditada ja existia e e `id`
  surrogate (`cadencia_regra`, `cadencia_perfil`). Corrigido para ele.
- **`dicionario_rotulos` NAO e auditado** e nao tem `tenant_id`. Chave composta, sem trigger.
  Foi por isso que o UPDATE do emoji (v26) nao deixou rastro. Pre-existente, nao mexido.
  Colide com o invariante 7 se for considerada tabela de dado; hoje e config compartilhada.
- **A mensagem da Fila comeca com "Oi X! Vi seu interesse no [produto]".** Para prospect
  frio isso e mentira na primeira linha. Mais um sinal de que a maquinaria da Fila pressupoe
  lead que chegou, e de que captacao e outro laco.
- `CREATE OR REPLACE FUNCTION` reseta ACL: refiz REVOKE/GRANT e **conferi** que
  `authenticated` executa e `anon` nao.

---

## 6. Pendencias

| # | Item | Nota |
|---|---|---|
| 1 | **Calibrar a meta** | 10/dia e chute. Rodar uma semana e ajustar com dado real. `update captacao_meta set alvo = N where codigo='abordagens_dia'`. Sem deploy. |
| 2 | **Ligar captacao -> lead** | `captacao.virou_lead_id` existe e **nada preenche ainda**. Falta o passo "essa pessoa respondeu, virou lead". E o momento em que o consentimento passa a ser verdade. **Quando isso for construido, reabrir a conversa de 2.4.** |
| 3 | Dashboard: conteudo | Segurado. 15 leads, 11 dias: taxa e teatro. Definir metrica ANTES da view. |
| 4 | `pb-pe` dinamico | Estatico. Entra com o 3. |
| 5 | Baseline `ferramentas/app.js.antes` | Atualizada para o pre-Fase-5. **Atualizar ao COMECAR a proxima obra**, nao no meio. |
| 6 | Desempate de eventos no mesmo minuto | `historico_lead()` ordena por `criado_em`. Irrelevante no volume atual. |
| 7 | Leaked Password Protection | BLOQUEADA: exige plano Pro. |
| 8 | `Desktop/pitwall deploy/` | Monolito morto de 09/07, sem git. Candidato a apagar. |

---

## 7. Armadilhas (nao repetir)

- **Conferir deploy com o md5 da copia de trabalho.** `core.autocrlf=true`: a copia tem
  CRLF, o blob e o que vai ao ar tem LF. Comparar com `git show HEAD:public/app.js`.
  Receita no README.
- **`/index.html` devolve 307 para `/`.** Baixar a raiz.
- **Handoff que declara deploy antes do push.** A v25 fez isso e custou uma sessao.
- **Mexer na estrutura de pastas sem rodar as ferramentas depois.** Ja quebrou os 4 scripts.
- **Regex esperta para "achar emoji".** A minha deu 27/27 e era teste quebrado, nao achado.
- **Desenhar sem reler a referencia.** A regra do azul estava escrita e eu quebrei.

---

## 8. Invariantes reforcados

- Meta mede o que voce controla: esforco, nao resultado.
- Config e config: frente, meta e numero vivem em tabela, e mudam sem deploy.
- Antes de dimensionar obra, checar o que o banco JA oferece (a Fase 4 era so front).
- O dado real ensina o que o chute erra: `autor` NULL virou "Régua"; `prospeccao_ativa`
  com 0 de 15 justificou a Fase 5.
- Regra de negocio mora num lugar so. A recusa de reabordagem esta em
  `registrar_captacao()`; a suite trava contra duplica-la no JS.
- Teste que so le sintaxe nao prova comportamento. Chrome roda de verdade; transacao
  revertida prova o banco sem sujar dado de cliente.
- Quando o dono decide contra o conselho, registrar a decisao, o custo e a contencao, e
  seguir. Ver 2.4.
- Handoff so declara deploy DEPOIS do push, conferido contra o blob.
