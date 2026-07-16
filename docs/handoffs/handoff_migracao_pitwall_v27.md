# Handoff Migracao Pit Wall (Nucleo) v27

Substitui a v26. Data: 16/07/2026.

---

## 1. Estado: a Fase 4 esta no ar e em uso

| O que | Estado |
|---|---|
| Fase 4, historico do lead | **No ar.** Commit `e95c98e`, deploy conferido contra o blob do git. |
| Emoji e acento no `dicionario_rotulos` | **Feito.** 27 rotulos limpos, `codigo` intacto. |
| Uso real em producao | O dono registrou um `toque_enviado` no LEAD-0013 as 20:50 do dia 16/07, depois do deploy. **O app esta sendo usado.** |
| `registrar_nota` em producao | **Ainda nao exercitada por uso real.** Provada em transacao revertida contra o banco real, nao por um humano clicando. Diferenca honesta. |
| Memoria do projeto | **Versionada.** `docs/`, `ferramentas/`, `.claude/skills/` e `CLAUDE.md` entraram no repo (fora de `public/`, entao nao vao ao ar). Antes viviam so no Desktop, sem backup. |
| Layout | O diretorio de trabalho E o repo (`public/` + `wrangler.jsonc` na raiz), como o CLAUDE.md sempre descreveu. O clone em `nucleo/` era paliativo e sumiu. |

Commits desta sessao: `e95c98e` (Fase 4), `259874b` (README), `86d95cf` (memoria do
projeto), `3952f82` (caminhos das ferramentas).

---

## 2. Proximo passo: Fase 5, captacao ativa

Pedido do dono: **aba de captacao ativa, com metricas e objetivos diarios, com banco.**

### 2.1 O numero que justifica a frente

`prospeccao_ativa` existe como `origem` desde sempre e tem **0 de 15 leads**. A origem
real de tudo: `whatsapp_direto` 9, `whatsapp_status` 2, `indicacao` 2, `instagram` 1,
`parceria_pag_local` 1.

**Todo lead do Pit Wall chegou sozinho.** O sistema inteiro (regua, cadencia, scripts,
Fila do dia, historico) e uma maquina de TRABALHAR lead que chegou. Nao existe nenhum
conceito de "preciso de N leads novos". O dono esta certo: e um buraco real, e e o maior
que sobrou. Nao e mais uma aba no dado velho: e um laco novo, com tabela nova.

### 2.2 A decisao que precisa vir ANTES do schema

**O que conta como uma captacao ativa: esforco ou resultado?**

- **Esforco** = abordagem enviada a alguem que ainda nao e lead.
- **Resultado** = lead novo criado com `origem = prospeccao_ativa`.

Sao coisas diferentes e a escolha decide o schema inteiro.

**Recomendacao: a meta diaria mede ESFORCO.** Voce controla quantas abordagens faz hoje;
nao controla se estranho responde. Meta de resultado ("3 leads novos hoje") depende de
terceiro e vira numero que voce fura sem ter feito nada errado. Meta furada por motivo
alheio, tres dias seguidos, vira numero que voce aprende a ignorar, e ai a aba morreu.

Resultado continua sendo medido, mas como **consequencia observada**, nunca como a meta.

### 2.3 O risco que precisa de decisao do dono: LGPD

O invariante 16 ja diz que a Fila so devolve link de WhatsApp com `consentimento = true`.
O `lead` tem `consentimento` e `consentimento_em`. Este projeto ja leva consentimento a
serio.

**Captacao ativa e, por definicao, falar com quem nao pediu contato.** Guardar nome e
telefone de prospect frio e dado pessoal de gente que nao consentiu. Isso colide de frente
com o invariante 16.

Nao e necessariamente um bloqueio: existe base legal possivel (legitimo interesse), e
guardar menos dado ajuda. Mas **e decisao consciente do dono, registrada, antes do
schema**, e a tabela precisa carregar a base legal como o `lead` carrega
`consentimento_em`. Construir primeiro e perguntar depois seria construir passivo.

### 2.4 Esboco (nao construir antes de 2.2 e 2.3)

Duas tabelas novas, ambas com `tenant_id` + RLS + auditoria (invariante 7):

- **`captacao`**: a abordagem. Quando, para quem (minimo necessario), canal, base legal,
  e `virou_lead_id` nulavel, que liga ao `lead` quando a pessoa responde e qualifica.
  O `lead` de hoje NAO serve: ele exige `produto`, `condicao`, `perfil`, que abordagem
  fria nao tem.
- **`meta_diaria`**: `tenant_id` + data + tipo + alvo. Numero de meta e config, nunca
  chumbado no codigo (mesmo espirito do invariante 11, que tirou os numeros de cadencia
  de dentro da funcao).

**`evento_uso` ja existe e esta vazia** (`tipo` + `payload jsonb`, com RLS). Tentador
reusar, mas ela e telemetria de uso do produto, nao dado de negocio. Meta e captacao sao
negocio. **Nao colapsar os dois** (mesmo espirito do invariante 1: sensor nao e regua).

### 2.5 Sequencia

1. Dono decide 2.2 (esforco x resultado) e 2.3 (base legal). **Portao.**
2. Schema + RLS + auditoria, provado como dono, como vendedor e como tenant errado.
3. Mock da aba, na linguagem da v3, com dado real. **Portao: aprovacao.**
4. Construir + validar (suite + harness) + empurrar em horario combinado.

### 2.6 Onde a aba mora

Provavelmente sob **`Operação`**, ao lado da Fila: captacao e acao, nao analise. O grupo
`Análise` (Dashboard) segue vazio. **Nao confundir as duas:** o Dashboard esta segurado
por falta de amostra; a captacao NAO tem esse problema, porque contar o proprio esforco
e honesto com n=1. Sao coisas diferentes e a captacao nao destrava o Dashboard.

---

## 3. Pendencias

| # | Item | Nota |
|---|---|---|
| 1 | **Fase 5: captacao ativa** | Ver secao 2. Comeca por decisao, nao por codigo. |
| 2 | Dashboard: conteudo | Segurado. 15 leads, 11 dias: taxa e teatro. Definir metrica ANTES da view. |
| 3 | `pb-pe` dinamico | Estatico. Entra com o 2. |
| 4 | Baseline `ferramentas/app.js.antes` | **Atualizar ao COMECAR a proxima obra** (`cp public/app.js ferramentas/app.js.antes`), nao no meio. Hoje ela e o pre-Fase-4, entao `validar.py` ainda responde "o que a Fase 4 mudou?". |
| 5 | Desempate de eventos no mesmo minuto | `historico_lead()` ordena por `criado_em`; dois eventos no mesmo minuto desempatam arbitrariamente. Irrelevante no volume atual. |
| 6 | Leaked Password Protection | BLOQUEADA: exige plano Pro. |
| 7 | `Desktop/pitwall deploy/` | Monolito morto de 09/07, sem git, anterior ao redesign. Candidato a apagar para ninguem editar um cadaver. |

---

## 4. Armadilhas que custaram tempo (nao repetir)

- **Conferir deploy com o md5 da copia de trabalho.** `core.autocrlf=true`: a copia tem
  CRLF, o blob e o que vai ao ar tem LF. Comparar com `git show HEAD:public/app.js`.
  A receita certa esta no README.
- **`/index.html` devolve 307 para `/`.** Baixar a raiz para conferir o HTML.
- **Handoff que declara deploy antes do push.** A v25 dizia "NAO EMPURRADO" com o codigo
  no ar havia horas, e custou uma sessao de reinvestigacao.
- **CLAUDE.md dizia que os `references/` das skills nao existiam.** Existem, com conteudo
  (`invariantes.md` 126 linhas). Sessoes vinham pulando o conhecimento do projeto.
  Corrigido.
- **Regex esperta para "achar emoji".** A minha deu 27/27 e era teste quebrado, nao
  achado. Ler as linhas e conferir `length` foi o que provou.
- **Mexer na estrutura de pastas sem rodar as ferramentas depois.** A promocao a raiz
  quebrou os 4 scripts (tinham `nucleo` no caminho). Rodar pegou.

---

## 5. Ferramentas

Em `ferramentas/` (ver `ferramentas/LEIA-ME.md`). Rodar da raiz.

- `python ferramentas/validar.py` — suite estatica. Sintaxe (esprima), contrato de IDs e
  classes, invariantes, paleta, Fase 4.
- `python ferramentas/harness.py` — **execucao real em Chrome headless**, 31 assercoes.
  Nao existe node nesta maquina, entao acorn/jsdom nao rodam; o Chrome instalado e um
  runtime melhor, porque tambem aplica o CSS.
- `python ferramentas/mock_historico.py` — regera o mock (saida ignorada pelo git).

**Ponto cego conhecido:** o check de classes de `validar.py` so ve `class="literal"`.
Classe montada por concatenacao escapa da regex e vai conferida na mao na secao [8].

---

## 6. Invariantes reforcados

- Meta mede o que voce controla. Esforco, nao resultado.
- Antes de mudar dado, provar quem consome. As CHECK constraints provaram em minutos que
  `rotulo` era display puro.
- Antes de dimensionar obra, checar o que o banco JA oferece. A Fase 4 parecia backend +
  front; era so front, porque as funcoes existiam ha duas fases.
- O dado real ensina o que o chute erra. `autor` NULL virou "Régua"; `prospeccao_ativa`
  com 0 de 15 leads e o que justifica a Fase 5.
- Regra de negocio mora num lugar so. A recusa de data futura ficou em `registrar_nota()`;
  a suite trava contra duplica-la no JS.
- Teste que so le sintaxe nao prova comportamento. Chrome roda de verdade; transacao
  revertida prova o banco sem sujar dado de cliente.
- Handoff so declara deploy DEPOIS do push, conferido contra o blob.
