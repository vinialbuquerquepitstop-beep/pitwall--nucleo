# Contrato do modulo Financeiro (Pit Wall 2.0)

**Fonte da verdade: `pitwall--nucleo/docs/financeiro/CONTRATO.md`, no git.**
Qualquer outra copia deste arquivo (projeto do Claude, chat, drive) e copia de leitura.
Divergiu do repo? O repo ganha, e a copia se descarta.

Revisao 2, 01/09/2026.

---

## 0. Como este documento carrega

Em `CLAUDE.md`, no bloco de arranque:

```
Ao tocar em qualquer coisa com prefixo fin_ ou na aba Financeiro:
leia docs/financeiro/CONTRATO.md ANTES de escrever a primeira linha.
Se o contrato conflitar com o pedido do prompt, o CONTRATO ganha e voce avisa.
```

O contrato mora no git e carrega sozinho. Os prompts ficam curtos e descartaveis. Mudar uma regra e um commit, nao uma correcao em doze prompts.

### Nota sobre numeracao, ler antes de usar

Eu vinha citando "invariantes 13 a 16". **Essa numeracao colidia** com a numeracao global do projeto, que ja usa 6, 7, 8, 9, 10, 12 e 18 para outras coisas nos handoffs e no PRD de estado.

Corrigido aqui:

- invariantes **herdados** mantem o numero global que ja tinham (secao 2.1);
- invariantes **novos do Financeiro** ganham prefixo `F` e nao entram na sequencia global (secao 2.2).

**Onde qualquer documento anterior disser "invariantes 13 a 16", leia F1 a F4.**

---

## 1. Inventario do modulo, medido

O que existe hoje. Serve para o Claude Code saber o que NAO precisa criar.

| Item | Estado |
|---|---|
| Tabelas | 5: `fin_conta` (12 col), `fin_categoria` (12), `fin_importacao` (13), `fin_movimento` (19), `fin_regra` (15) |
| RPCs publicas | 11, todas `security invoker`, `search_path` fixo, dono-only |
| Helpers privadas | 5 em `privado`: `fn_fin_norm`, `fn_fin_esc`, `fn_fin_casa`, `fn_fin_aplicar_regras`, `fn_fin_importacao_fechar` |
| Storage | 1 bucket `extrato`, privado, teto 10 MB, path prefixado por `tenant_id` |
| Tela | 1 aba, 4 sub-views por chip: `Visão · Movimentos · Importar · Regras` |
| Categorias | 33 ativas em 9 grupos |
| Suite | 143 assercoes do Financeiro (87 `fin:`, 56 `fin2:`) dentro de 885 totais |

**As 11 RPCs, por nome:**

Leitura: `fin_config` · `fin_painel` · `fin_movimentos`
Escrita fatia 1: `fin_importar_extrato` · `fin_classificar` · `fin_lancar`
Regras fatia 2: `fin_regras` · `fin_regra_sugerir` · `fin_regra_prever` · `fin_regra_salvar` · `fin_regra_aplicar`

**A unica `security definer` do modulo** e `privado.fn_fin_importacao_fechar`. Se uma entrega criar a segunda, ela precisa de justificativa escrita no handoff.

---

## 2. Os invariantes

Violar qualquer um reprova a entrega. Nao ha excecao por conveniencia, prazo ou "so desta vez".

### 2.1 Herdados do projeto, com o numero global

**Inv. 6 — Append-only.**
`fin_importacao` e append-only. `authenticated` NAO tem UPDATE nela: as contagens sao fechadas por `privado.fn_fin_importacao_fechar`, unica escrita permitida. Historico e auditoria nunca sao reescritos.

**Inv. 7 — `tenant_id` e RLS em toda tabela.**
As 5 tabelas tem `tenant_id` e RLS ligada. Financeiro e dono-only: vendedor ve zero linha. Provado com usuario real.

**Inv. 8 — Helper privada mora em `privado`.**
Funcao `security definer` e helper de casamento vivem no schema `privado`, invisiveis ao PostgREST. Nunca em `public`.

**Inv. 9 — Zero DELETE, zero TRUNCATE.**
`authenticated` nunca recebe DELETE, TRUNCATE, REFERENCES ou TRIGGER. Remocao e sempre soft, por `arquivado_em`. **A RLS nao protege contra TRUNCATE**, por isso o grant e a defesa.

**Inv. 10 — Data de negocio com fuso.**
Toda data de negocio usa `(now() at time zone 'America/Sao_Paulo')::date`. `current_date` e `CURRENT_DATE` estao **PROIBIDOS** em funcao, view ou policy que produza data de negocio. O banco esta em UTC; a operacao esta em Sao Paulo.

**Inv. 12 — `codigo` e a chave, `rotulo` e display.**
Em `fin_categoria`, `codigo` e a chave e e imutavel. `rotulo` e texto de tela e pode ser editado sem quebrar nada. Codigo nunca aparece na tela; rotulo nunca aparece em regra.

**Inv. 18 — Sem `dominio`, fora de todo total. Sem default silencioso.**

> Movimento sem `dominio` classificado (`empresa` / `pessoal`) nao entra em NENHUM total de resultado, de gasto ou de meta. Aparece somente como "nao classificado", com valor visivel, cobrando o trabalho. `dominio` NUNCA tem default silencioso.

E o invariante que sustenta a aba inteira. Existe uma conta so, com dinheiro da loja e da casa misturados. O extrato nao sabe qual e qual e nenhuma heuristica sabe. So o dono sabe. Com default silencioso, o mercado do mes vira custo da loja e o lucro parece certo estando errado.

**Corolario, mesmo peso: caixa e resultado sao verdades separadas e NUNCA se somam.** O Dashboard le a `venda` (resultado por competencia). O Financeiro le o caixa (`fin_movimento`). Nao se calcula lucro nem margem contabil a partir do extrato.

### 2.2 Novos do Financeiro

**F1 — Agente propoe, dono aprova.**
Nenhum agente grava `dominio`, meta ou provisao sozinho. Toda saida de agente e proposta com estado (`pendente` / `aceita` / `recusada` / `ajustada`). Recusa fica registrada e a mesma proposta nao volta no ciclo seguinte.

**F2 — Agente so repete decisao ja tomada.**
Dominio proposto por agente so pode REPETIR decisao que o dono ja tomou **3 vezes ou mais** para a mesma contraparte. Contraparte nova sai com `dominio` nulo, sempre. Isso nao e inferencia: e repeticao. E o unico jeito de automatizar sem matar o Inv. 18.

**F3 — Base incompleta nao vira numero.**
A tela NUNCA exibe numero economico derivado de um periodo cuja base esteja abaixo de **95% julgada em VALOR** (nao em numero de linhas). No lugar do numero, exibe `base incompleta: N% julgado · faltam R$ X em Y linhas`, com atalho para Movimentos filtrado e ordenado por valor.

Vale para receita, margem, ponto de equilibrio, meta, provisao e alerta. **E no lugar do numero, nunca ao lado dele.**

Julgado, para efeito deste calculo, e: tem `dominio`, OU tem categoria de natureza `neutro` (aplicacao e resgate nao tem lado a decidir).

**F4 — Saldo por contraparte, se existir, e sobre toda a base.**
Netting por contraparte calcula sobre TODA a base, nunca sobre a janela selecionada, e declara desde quando conta. Com menos de 3 meses de base, nao e exibido.

Motivo: **janela corta ciclo.** Dinheiro que sai antes do inicio da janela e volta dentro dela produz um saldo que nao existe. Esse erro ja foi cometido de verdade neste projeto, sobre a contraparte BR IPHONES, e produziu tres numeros publicados errados.

### 2.3 Invariantes de construcao

**C1 — Motor de classificacao e UNICO.**
`privado.fn_fin_aplicar_regras` serve o botao `fin_regra_aplicar` E a importacao. Nao se duplica logica de casamento. Duas implementacoes divergem, e no dia em que divergirem a importacao classifica diferente do botao.

**C2 — Nada de dado de config chumbado no JS.**
Categoria, conta e grupo vem de `fin_config`, chamada uma vez por sessao. Nenhum codigo, rotulo ou lista fixa dentro de `app.js`.

**C3 — Texto de erro so vem do servidor.**
A tela nunca inventa frase de recusa. O vocabulario fechado esta na secao 4.

**C4 — Convencao de chave de retorno.**
Leitura devolve `msg`. Escrita devolve `erro`. Toda RPC devolve `ok`.

**C5 — Zero token de cor novo.**
Sao 9 grupos financeiros contra 7 tokens de trilho medidos. A colisao e ASSUMIDA e nomeada: `Marketing` e `Vida` dividem matiz e quem os separa e o icone (megafone x xicara). `Sem categoria` NAO e trilho: e ESTADO, e usa `--morno`, nunca `--erro`. Grupo desconhecido cai em hash deterministico do `codigo` com icone generico.
`--morno` = `#f2a71b` e semantico e NUNCA se unifica com a marca `#0025cc`.

**C6 — Entrega vertical.** Secao 3.

---

## 3. A regra de corte: entrega vertical

**Uma entrega e uma frase que o dono verifica na tela.**

- "O painel desconta devolucao e a tela explica o desconto" e uma entrega.
- "Abatimento derivado no `fin_painel`" **nao e entrega**. E preparacao, e preparacao nao vai sozinha para producao.

Teste, antes de escrever a primeira linha: escreva a frase. Se ela nao tem sujeito visivel na tela, o corte esta errado. Refaca o corte.

**Consequencia: migration, RPC, policy, tela e assercao de teste da mesma entrega sobem NO MESMO COMMIT.** Servidor que passa a devolver campo novo sem leitor na tela e **entrega reprovada**, nao entrega parcial.

Este invariante nasceu de um defeito real: a Task 1 da Fatia 2.1 subiu sozinha, o servidor passou a devolver `abatido`, a tela que explicaria era a Task 6 e nunca chegou. Um numero encolheu R$ 131,02 na tela do dono sem explicacao. O calculo estava certo e a experiencia ficou pior.

---

## 4. As recusas nomeadas

Vocabulario fechado. A tela exibe estas frases e nao inventa outras.

```
Sessao invalida.
Financeiro e restrito ao dono.
Conta nao encontrada.
Conta desativada: reative antes de importar.
Nenhum lancamento no arquivo.
Data ausente na linha N.
Data invalida na linha N: ...
Valor invalido na linha N.
Descricao vazia na linha N.
Caminho do arquivo fora da pasta do tenant.
Importacao recusada por duplicidade inesperada. Nada foi gravado.
Nada para mudar: informe categoria, dominio ou observacao.
Categoria desconhecida ou desativada: <codigo>
Dominio invalido: use empresa ou pessoal.
Informe o padrao a casar.
Tipo de casamento invalido: use contem, comeca ou exato.
Ordem invalida: use data ou valor.
Informe a entrada e a saida do repasse.
Entrada e saida sao o mesmo lancamento.
Lancamento nao encontrado.
Entrada e saida invertidas: a entrada e o valor positivo e a saida e o negativo.
Lancamento ja faz parte de outro repasse.
Par desigual: a diferenca e de X%, acima dos 5% permitidos.
Categoria nao pode ser escolhida a mao: <codigo>
Informe o repasse a desfazer.
Este lancamento nao esta em nenhum repasse.
Prioridade fora da faixa: use de 0 a 9999.
Regra arquivada: crie uma nova em vez de editar esta.
Janela invertida.
Padrao generico demais: "UBER" casa 4 de 12 lancamentos (33.3%).
```

Recusa nova entra aqui no mesmo commit que a cria.

---

## 5. Decisoes de desenho fechadas

Nao sao invariantes, sao decisoes ja tomadas. Reabrir exige decisao explicita do dono, registrada no handoff.

| # | Decisao | Motivo |
|---|---|---|
| D-a | **OFX e lido no navegador**, nao no servidor | OFX 1.x e SGML raso, tag de folha nao fecha, parser de XML quebra. Leitura por bloco com regex tolerante, encoding cai para `windows-1252` |
| D-b | **Upload opcional, importacao obrigatoria** | falha no upload do arquivo nao aborta a importacao. Perder o extrato guardado e ruim; perder a importacao inteira e pior |
| D-c | **Previa obrigatoria** antes de gravar | o dono ve antes |
| D-d | **Dedupe por `hash_dedupe` e por `fitid`** | o hash carrega ocorrencia: dois cafes iguais no mesmo dia sao possiveis mas exigem confirmacao |
| D-e | **Padrao que casa > 60% da base e recusado**, com o numero na cara | `forcar: true` passa por cima. **A tela nunca forca sozinha** |
| D-f | **Regra que nao classifica nada nao existe** | `check (categoria_codigo is not null or dominio is not null)` |
| D-g | **Indice unico sobre a forma NORMALIZADA do padrao** | duas regras para o mesmo texto com acento diferente nao coexistem. `fn_fin_norm` e `IMMUTABLE` e **nao usa `unaccent`** (extensao nao instalada de proposito); faz o servico com `upper(translate(...))` |
| D-h | **`fin_regras` NAO filtra por `ativo`** | filtrar esconderia a regra pausada, que ficaria viva e invisivel |
| D-i | **`fin_regra_sugerir` nao sugere categoria nem dominio** | inferir se o Uber foi da loja ou pessoal e exatamente o que o Inv. 18 proibe |
| D-j | **Previa de regra EXPIRA** | mexer na regra depois da previa tranca o botao de gravar de novo |
| D-k | **Sobrescrever exige confirmacao com o NUMERO** | `Sobrescrever os 1`, nunca um sim generico. Depois de rodar, a tela DECLARA que sobrescreveu |
| D-l | **`aplicar todas` manda payload VAZIO** | `ids: []` e erro no servidor, nunca "todas" |
| D-m | **Janela para em HOJE no mes corrente** | comparar 25 dias contra 31 do mes anterior e a maneira mais barata de a tela mentir |
| D-n | **`delta_pct` e `null` quando nao havia base** | a tela escreve `novo`. Desenhar `0%` inventaria uma comparacao que nunca existiu |
| D-o | **Conflito de regra usa `--morno`, nunca `--erro`** | ambiguidade cobra trabalho, nao e falha de sistema |
| D-p | **A sub-view Regras vazia nao mostra "criar regra"** | ensina que se comeca pela linha do movimento |
| D-q | **Nao existe aporte / capital de terceiro** | decisao do dono, 27/08. Desenho arquivado no historico do projeto |

---

## 6. Os tres portoes

### 6.1 Portao de entrada, antes de escrever a primeira linha

- [ ] `git status` limpo
- [ ] migrations aplicadas no banco **==** migrations versionadas no git, conferido via MCP, nao presumido
- [ ] suite verde, EXIT 0 em todos:
  ```
  python ferramentas/validar.py
  python ferramentas/harness.py
  python ferramentas/prova_trilho.py
  python ferramentas/prova_grafico.py
  python ferramentas/prova_atmosfera.py
  node --check public/app.js
  python ferramentas/diag_mobile.py  em 360, 390, 414, 1280, 1440
  ```
- [ ] a frase da entrega esta escrita e tem sujeito visivel na tela

**Se qualquer item reprovar, a entrega da vez passa a ser fechar esse item.** Nao se constroi sobre estado nao conferido.

### 6.2 Portao de saida, antes de dizer pronto

- [ ] SQL rodado no banco de verdade, nao revisado no olho
- [ ] RLS testada como dono E como vendedor
- [ ] a tela le TODO campo novo que o servidor passou a devolver, zero campo orfao
- [ ] assercao nova na suite, com prefixo que identifica o ALVO da prova
      (`fin:`, `fin2:`, `fin3:` e as fatias seguintes para o produto;
      `suite:` para prova da propria ferramenta de validacao)
- [ ] EXIT 0 nos 7 comandos e nas 5 larguras
- [ ] commit unico, incluindo spec e plano
- [ ] `docs/handoffs/handoff_financeiro_pitwall_v<N>.md` atualizado
- [ ] nenhuma recusa nova fora da secao 4

### 6.3 Portao de confianca

> **Nenhum numero da tela pode mudar de valor sem que a MESMA entrega traga a explicacao na tela.**

Se o calculo mudou, a nota que explica sobe junto. Nao na proxima entrega. Junto. Numero que muda sozinho gasta a confianca de que a aba inteira depende, e confianca perdida custa mais caro do que qualquer feature nova compra.

---

## 7. Auditoria de entrega, checklist binario

Rodar em sessao SEPARADA da que construiu. Auditor que audita o proprio trabalho e carimbo.

- [ ] Toda tabela nova tem `tenant_id` e policy de RLS que o usa?
- [ ] A policy foi testada como dono, como vendedor e como tenant errado?
- [ ] Alguma inferencia de `dominio` entrou no codigo, numa regra ou num agente?
- [ ] Algum `current_date` ou `CURRENT_DATE` novo?
- [ ] Algum grant de DELETE, TRUNCATE, REFERENCES ou TRIGGER para `authenticated`?
- [ ] Alguma `security definer` nova? Justificada por escrito?
- [ ] Algum campo devolvido por RPC sem leitor em `public/app.js`?
- [ ] Algum token de cor novo?
- [ ] Alguma frase de erro inventada na tela?
- [ ] Alguma migration aplicada no banco e ausente do git?
- [ ] Algum numero economico exibido com base abaixo de 95% julgada (F3)?
- [ ] O SQL foi de fato executado, nao so revisado?
- [ ] A entrega resolve o pedido real, ou um parecido?

**Auditoria que nunca reprova e teatro.** Se reprovar, diga o que estava errado e o que foi corrigido.

---

## 8. Linguagem

Prosa de documento e de codigo: **sem acento, sem cedilha, sem travessao.** Substituir o travessao por virgula, dois-pontos ou reescrever.

**Excecao obrigatoria, valores reais do sistema preservam seus caracteres exatos:**
rotulos de sub-view (`Visão · Movimentos · Importar · Regras`, com o ponto do meio U+00B7), rotulos de categoria (`Alimentação fora`, `Pró-labore`), nomes de grupo (`Operação`), status com emoji, e os tokens `--morno` = `#f2a71b` e marca `#0025cc`.

**Copy destinada ao cliente final leva acento e cedilha normais e nao se normaliza.**

---

## 9. O que fica fora, declarado

Recusado ate decisao explicita em contrario:

patrimonio e evolucao patrimonial · saldo bancario em tempo real · lucro e margem contabil a partir do caixa · cartao de credito com parcelamento · Open Finance · IA financeira · metricas de SaaS (usuarios ativos, retencao, onboarding) · taxa de economia · estoque parado · concentracao de receita · capital de terceiro e aporte · canal externo de alerta (WhatsApp bloqueado por decisao, nao por codigo).

Item desta lista que voltar a ser pedido entra pelo portao como qualquer outro, com frase de entrega propria.

---

## 10. Historico de revisao

| Rev | Data | Mudanca |
|---|---|---|
| 1 | 27/08/2026 | Primeira versao completa. Consolida os invariantes herdados com numero global, cria F1 a F4, corrige a numeracao 13-16 que colidia com a global, registra D-q (nao existe aporte) |
| 2 | 01/09/2026 | Item 4 do portao 6.2 deixa de cravar `fin3:` e passa a exigir prefixo que identifica o alvo da prova, admitindo `suite:` para prova de ferramenta. A redacao antiga reprovava toda entrega que nao fosse a Fatia 3 |
