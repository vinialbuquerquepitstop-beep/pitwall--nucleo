# DOCUMENTO MESTRE — Interpretador Independente de Listas de Fornecedores

Data: 15/09/2026
Status: proposta de arquitetura para trabalho em fatias
Escopo: Calculadora -> Catalogo -> Alimentar

> Principio central: **fornecedor novo deve gerar conhecimento novo, nao codigo novo.**

Este documento nasce de uma auditoria do estado atual da linha `calculadora` no GitHub. Ele nao apaga a spec de produto de 05/09 nem a spec de aprendizado de fornecedor de 10/09. Ele organiza a proxima fase: transformar o leitor que hoje funciona por catalogo + regras + contexto + correcoes sucessivas em um **interpretador independente do fornecedor**, sem perder as protecoes que ja funcionam.

Enquanto estiver em branch, este documento e proposta. Depois de aprovado pelo dono e incorporado ao fluxo da linha `calculadora`, ele passa a ser a direcao arquitetural para o tema interpretacao de listas. Regra de negocio existente continua valendo, salvo decisao explicita do dono.

---

## 1. Baseline auditada

Auditoria feita sobre o repositorio em 15/09/2026.

- `main` no arranque desta auditoria: `db3f107a705912bd71f3890e9658f4f8bdc5fd7c`.
- ultimo commit funcional da calculadora encontrado: `5c25b0e3a18a735b2435505d540c8f68edee5d75`, capacidade sem `GB` e preco na linha de baixo.
- commit que registra as provas depois dessa migration: `9df17d0aac457b617e56fa5e71d7edabf27f082c`.
- handoff vivo da linha calculadora: `docs/handoffs/handoff_calculadora_pitwall_v20.md`.
- provas de banco registradas depois da ultima migration: **77 leitor + 39 laco + 29 catalogo = 145 em execucao, 0 falhas**.
- a ultima prova registrada da tela Alimentar no commit que trouxe resposta em lote foi **170 assercoes**.

Esta auditoria leu o estado do repo e as provas registradas nele. Ela nao fez uma nova leitura independente do banco vivo nesta sessao.

Fontes de record usadas:

- `docs/superpowers/specs/2026-09-05-calculadora-produto-design.md`
- `docs/superpowers/specs/2026-09-10-aprendizado-de-fornecedor.md`
- `docs/calculadora/PROCESSO.md`
- `.claude/skills/calculadoras/references/formato-dados.md`
- `.claude/skills/calculadoras/references/procedimento-alimentacao.md`
- `public/calc/alimentar/index.html`
- `public/calc/index.html`
- migrations `calc_*` ate 14/09/2026

---

## 2. O que ja existe e deve ser preservado

A Alimentacao atual nao deve ser descartada. Ela ja resolveu a parte mais dificil do produto: o ciclo seguro entre entrada crua, duvida, ensino e aprovacao.

### 2.1 Ingestao real

A tela aceita texto, `_chat.txt` e `.zip` do WhatsApp, trata encoding e recusa binario. A janela padrao de 7 dias evita que preco velho concorra com preco atual.

### 2.2 Carga em rascunho

`calc_carga` mantem a importacao separada do dado aprovado. `texto_bruto` existe enquanto o rascunho existe e e apagado ao aprovar ou descartar.

### 2.3 Catalogo por tenant

O parse usa catalogo do tenant, com modelos, cores, condicoes, fornecedores, aliases e regras. A semente nao e catalogo global vivo.

### 2.4 Aprendizado humano

A pendencia nao e so correcao visual. A resposta pode ensinar o catalogo. Hoje existem, entre outros, os verbos `apontar`, `criar`, `descartar`, `definir`, `confirmar` e `ignorar`.

### 2.5 Releitura em lote

`calc_pendencia_anotar` ensaia a resposta sem aplicar a releitura completa. `calc_carga_reler` aplica o lote e rele uma vez. Isso preserva as guardas sem fazer uma releitura cara por clique.

### 2.6 Guardas contra falha silenciosa

O projeto ja aprendeu que cobertura alta nao basta. Existem guardas de conservacao, ensino efetivo e descarte efetivo porque uma linha pode sumir da pendencia e mesmo assim virar preco no fornecedor errado.

### 2.7 Proveniencia

O que nasce de aprendizado carrega origem e carga. Essa trilha e obrigatoria para desfazer erro aprendido.

### 2.8 Humano antes da verdade operacional

A carga so deve virar custo vigente depois de conferencia. Esta regra permanece mesmo quando o interpretador ficar mais autonomo.

---

## 3. Diagnostico: por que o leitor ainda nao e independente de fornecedor

O leitor atual e competente, mas o crescimento dele esta cada vez mais orientado pelos casos que apareceram nas listas reais. Isso e correto para corrigir defeito de producao; nao e suficiente como arquitetura de um interpretador geral.

### 3.1 O parser virou um corpo grande alterado por cirurgia

Migrations recentes leem `prosrc`, conferem `md5`, fazem substituicoes textuais exatas e recriam `calc_parse_v2` ou helpers. A tecnica protege contra aplicar patch em corpo inesperado, mas mostra um limite arquitetural: cada comportamento novo exige cirurgia no corpo anterior.

Isso nao escala para dezenas de formatos novos.

### 3.2 Regras recentes sao validas, mas muito ligadas ao corpus atual

Exemplos medidos no codigo atual:

- numero de iPhone inferido na faixa 11 a 17;
- capacidade sem `GB` reconhecida em posicoes especificas;
- tamanhos de Watch excluidos de preco;
- familias Garmin especificas excluidas de preco;
- lista de familias usada para decidir quando uma linha sem `iPhone` e iPhone;
- desempate de cor baseado na posicao observada no bloco.

Cada uma fecha um defeito real. O risco aparece quando a proxima lista exige a proxima excecao e o motor vira a soma dos fornecedores que ja passaram por ele.

### 3.3 O contexto existe, mas nao como componente explicito

O leitor ja herda fornecedor, modelo, capacidade e condicao em varios cenarios. Porem essa memoria esta embutida no fluxo do parser. Nao existe um contrato claro de estado como:

```text
fornecedor_atual
familia_atual
modelo_atual
capacidade_atual
condicao_atual
moeda_atual
inicio_do_bloco
inicio_da_mensagem
```

Sem essa separacao, corrigir uma heranca tende a mexer junto na deteccao da linha.

### 3.4 O sistema aprende vocabulario melhor do que aprende forma

Hoje ele aprende muito bem coisas como:

```text
"JT Telles" -> joao_telles
"16PM" -> um codigo canonico
```

Mas o objetivo ainda incompleto e aprender com seguranca algo como:

```text
este formato usa modelo como cabecalho
capacidade vale para as linhas seguintes
cor costuma vir antes do preco
condicao vale para o bloco
uma mudanca de timestamp fecha contexto
```

A spec de 10/09 ja desenhou `perfil`/dialeto e `formato_mudou`, mas essa camada ainda nao e o centro do leitor vivo.

### 3.5 Cor desconhecida nao fecha o mesmo laco de aprendizado

A spec de 10/09 registra que o leitor nao cria pendencia de `cor` adequada ao verbo `criar`. Cor desconhecida pode cair em `duvidoso`, mas ainda nao tem o mesmo ciclo completo de fornecedor/modelo:

```text
nao conheco -> pergunto -> ensino -> releio -> nao pergunto de novo
```

### 3.6 Categoria ainda aparece codificada na interface

`public/calc/index.html` declara hoje as categorias em `KCATS`:

```text
iPhone, iPad, MacBook, Apple Watch, Acessorio, 1a Linha, Garmin, Moto Eletrica, JBL
```

Isso e suficiente para a operacao atual, mas novo dominio nao deveria exigir editar o frontend para existir.

### 3.7 Confidence ainda e implicita

As pilhas `casou`, `duvidoso` e `nao reconhecido` sao uma boa base de abstencao, mas o sistema nao carrega de ponta a ponta:

- candidatos considerados;
- evidencia usada;
- confidence por campo;
- por que ganhou o candidato A e nao B;
- qual parte foi herdada de contexto.

Sem essa trilha fica mais dificil auditar um falso positivo e mais facil transformar heuristica em verdade silenciosa.

### 3.8 As travas de aprovacao criticas ainda dependem da tela

O proprio `public/calc/alimentar/index.html` registra que `calc_carga_aprovar` aceita situacoes que a tela bloqueia, como pendencia aberta e fornecedor suspeito. Integridade financeira nao deve depender apenas de botao desabilitado no browser.

### 3.9 Performance ja virou limite arquitetural

A lista real de 17/08 chegou a cerca de 30 segundos de leitura. A resposta em lote resolveu a multiplicacao do custo, mas o `statement_timeout` de `authenticated` foi elevado para 60 segundos, afetando o papel inteiro. O proximo salto nao pode ser aumentar timeout de novo.

---

## 4. Definicao de "independente de fornecedor"

O sistema so sera considerado independente de fornecedor quando TODAS as frases abaixo forem verdadeiras.

1. **Um fornecedor nunca visto nao exige mudanca de codigo para ser cadastrado e ter sua primeira lista processada.**
2. **Formato novo gera interpretacao parcial + pendencias, nao preco silenciosamente errado.**
3. **A segunda lista do mesmo fornecedor pergunta menos que a primeira.**
4. **A terceira lista tende a perguntar menos que a segunda quando o formato e estavel.**
5. **Mudar o formato do fornecedor acende alerta antes de degradar preco silenciosamente.**
6. **Modelo, cor ou atributo novo gera conhecimento, nao branch de codigo.**
7. **O codigo do motor nao contem `if fornecedor == X`.** Perfil de fornecedor pode desempatar, nunca decidir sozinho.
8. **Novo fornecedor passa por corpus holdout sem que o executor veja a resposta e escreva regra para ele.**
9. **Toda interpretacao aceita consegue explicar de onde vieram modelo, capacidade, cor, condicao, fornecedor e preco.**
10. **Linha que nao atingiu confidence minima vira pendencia. Nunca vira preco so para aumentar cobertura.**

---

## 5. Arquitetura alvo

A nova arquitetura nao substitui o ciclo Alimentar. Ela substitui gradualmente o interior do leitor.

```text
RAW INPUT
   |
   v
1. INGESTAO
   texto / zip / txt / recorte temporal
   |
   v
2. NORMALIZACAO
   preserva raw + cria forma normalizada
   |
   v
3. SEGMENTACAO
   mensagem / bloco / linha / fronteira
   |
   v
4. CLASSIFICACAO ESTRUTURAL
   cabecalho / fornecedor / modelo / atributo / preco / aviso / lixo
   |
   v
5. EXTRACAO DE CANDIDATOS
   modelo / capacidade / cor / condicao / preco / moeda / outros atributos
   |
   v
6. CONTEXT ENGINE
   herda e invalida contexto com regras explicitas
   |
   v
7. RESOLUCAO CANONICA
   catalogo + alias + regras + dialeto
   |
   v
8. VALIDACAO
   combinacao existe? contradicao? preco plausivel? campo obrigatorio?
   |
   v
9. CONFIDENCE + ABSTENCAO
   interpretado / inferido / ambiguo / invalido
   |
   +---------> PENDENCIA -> ENSINO -> RELEITURA
   |
   v
10. PRODUTO CANONICO EM RASCUNHO
   |
   v
11. DIFF + APROVACAO
```

### 5.1 Separacao obrigatoria entre parser e memoria

Quatro coisas diferentes nao podem virar uma tabela ou um `if` so:

**Catalogo / ontologia**

```text
"iPhone 16 Pro Max 256GB" existe e pertence a categoria iPhone
```

**Alias**

```text
"16PM 256" aponta para aquele item canonico
```

**Regra semantica geral**

```text
"1281 ciclos" nao e preco
```

**Dialeto do fornecedor**

```text
historicamente este fornecedor coloca cor antes do preco
```

O dialeto e evidencia fraca. Ele pode desempatar. Nao pode transformar ausencia de evidencia em certeza.

---

## 6. Representacao intermediaria obrigatoria

Antes de montar produto, o novo motor deve conseguir devolver uma representacao auditavel por linha.

Exemplo conceitual:

```json
{
  "line_id": 184,
  "raw": "BLACK 980",
  "normalized": "black 980",
  "role_candidates": [
    {"role": "product_price", "score": 0.93},
    {"role": "note", "score": 0.07}
  ],
  "entities": {
    "color": [{"value": "black", "score": 0.98, "evidence": "alias/catalog"}],
    "price": [{"value": 980, "currency": "USD", "score": 0.99, "evidence": "numeric-pattern"}]
  },
  "context": {
    "supplier": {"value": "x", "source_line": 170},
    "model": {"value": "iphone_16_pro_max", "source_line": 179},
    "storage_gb": {"value": 256, "source_line": 181}
  },
  "decision": "interpreted"
}
```

Os numeros de score acima sao ilustrativos. Nao devem ser tratados como probabilidades calibradas ate existir medicao.

A representacao tem tres funcoes:

1. provar por que uma linha virou produto;
2. permitir trocar uma camada sem reescrever as demais;
3. gerar dataset de erro e aprendizado sem guardar logica implicita em comentario de migration.

---

## 7. Context Engine

O contexto passa a ser componente de primeira classe.

Estado minimo:

```text
message_id
message_timestamp
supplier_candidate
supplier_canonical
category
model_candidate
model_canonical
storage
condition
currency
block_start
last_structural_role
```

Toda heranca deve ter:

- regra que abre o contexto;
- regra que fecha o contexto;
- linha de origem;
- confidence;
- motivo de invalidacao.

Exemplo:

```text
IPHONE 16 PRO MAX      -> abre modelo
256GB                  -> abre storage
BLACK 980              -> herda modelo + storage
WHITE 985              -> herda modelo + storage
512GB                  -> troca storage, preserva modelo
BLACK 1100             -> herda modelo + novo storage
APPLE WATCH S11 46     -> fecha contexto de iPhone
```

A meta nao e escrever esse exemplo no codigo. A meta e que classificacao estrutural + regras de estado produzam esse comportamento.

---

## 8. Candidate Engine e confidence

O motor nao deve perguntar apenas "casou ou nao casou". Ele deve produzir candidatos e decidir se pode ou nao assumir.

Estados de saida:

### INTERPRETADO

Todos os campos obrigatorios tem evidencia suficiente e nao ha contradicao relevante.

### INFERIDO

Existe uma inferencia permitida e rastreavel, por exemplo contexto herdado. A tela pode mostrar isso na auditoria, mas nao precisa incomodar o usuario em toda linha.

### AMBIGUO

Ha dois ou mais candidatos plausiveis ou falta campo obrigatorio. Vira pendencia.

### INVALIDO

Linha nao e produto, e descarte estrutural ou regra explicita.

Politica central:

> **precision antes de recall.** Um preco certo fora da tabela custa uma pergunta. Um preco errado dentro da tabela contamina venda.

---

## 9. Dialeto do fornecedor

A spec de 10/09 ja acertou o principio: **perfil desempata, nunca decide**.

O perfil deve ser derivado apenas de cargas aprovadas e pode registrar sinais como:

```json
{
  "layout": "block",
  "model_as_header": 0.94,
  "storage_inherited": 0.91,
  "color_before_price": 0.88,
  "condition_scope": "block",
  "timestamp_breaks_context": true,
  "lists_seen": 4
}
```

Esses valores representam frequencia observada, nao permissao para ignorar a lista atual.

O perfil serve para:

1. desempatar candidatos que ja sao plausiveis sem ele;
2. detectar mudanca de formato;
3. reduzir perguntas repetidas sem criar certeza silenciosa.

### 9.1 `formato_mudou`

Manter a ideia da spec atual: comparar estrutura e cobertura com historico aprovado. O limite de 15 pontos pode continuar como primeira constante declarada, mas deve ser recalibrado com dados reais.

Quando o formato muda, o comportamento correto e:

```text
mais pendencia + aviso
```

nunca:

```text
usar o perfil antigo como regra dura
```

---

## 10. Aprendizado completo

O laco de aprendizado passa a ter cinco destinos separados.

### 10.1 Alias

Outro nome para entidade conhecida.

### 10.2 Entidade nova

Fornecedor, modelo, cor ou outra entidade realmente nova.

### 10.3 Regra semantica

Padrao que vale alem daquele fornecedor, somente quando existe prova suficiente e escopo explicito.

### 10.4 Dialeto

Estatistica de forma aprendida de carga aprovada.

### 10.5 Resposta local da carga

Decisao que nao deve virar memoria permanente, como uma condicao definida apenas para a lista atual.

Toda escrita aprendida deve continuar com origem, carga e autor. Desfazer aprendizado e requisito de produto, nao ferramenta administrativa.

---

## 11. Categorias e schemas por dominio

A arquitetura deve parar de depender de uma lista fixa no frontend.

Existe um nucleo comum:

```text
brand
family/category
model
condition
supplier
price
currency
```

E atributos por dominio.

Exemplos:

**iPhone**

```text
storage_gb
color
region
sim_type
battery_health quando usado
```

**MacBook**

```text
chip
ram_gb
storage_gb
screen_inches
keyboard_layout
color
```

**Apple Watch**

```text
series
size_mm
connectivity
material
case_color
band
```

A categoria deve dirigir schema e validacao. Ela nao deve exigir um novo ramo de UI para cada fornecedor.

---

## 12. LLM: onde entra e onde nao entra

O modelo nao e o parser principal e nunca grava verdade operacional sozinho.

Uso permitido:

```text
deterministico nao resolveu
        |
        v
fragmento pequeno + contexto + candidatos + schema
        |
        v
LLM devolve JSON estruturado com hipoteses
        |
        v
validador deterministico
        |
        v
confidence / pendencia
```

O modelo pode ajudar em:

- abreviacao nova;
- cabecalho estranho;
- classificacao estrutural rara;
- sugestao de candidato;
- explicacao para o usuario.

O modelo nao pode:

- escrever em `calc_dados`;
- criar fornecedor/modelo/cor sem passar pelo fluxo de aprendizado;
- aprovar carga;
- inventar campo ausente para melhorar cobertura;
- receber privilegio amplo de escrita no banco.

---

## 13. Onde o motor deve viver

Direcao alvo: **o interpretador deixa de ser um corpo monolitico de PL/pgSQL**.

Postgres continua sendo autoridade para:

- tenant;
- catalogo;
- aliases;
- regras;
- cargas;
- pendencias;
- proveniencia;
- aprovacao transacional.

A logica pesada de interpretacao deve migrar gradualmente para um modulo versionado e testavel em codigo, preferencialmente executado server-side. Edge Function/Deno e candidato natural porque ja estava previsto para a camada de modelo, mas a escolha final do host deve ser fechada depois de medir a Fatia 1.

Regra arquitetural:

> regex, segmentacao, contexto, candidatos e confidence precisam poder ser testados sem aplicar migration no banco.

Nao fazer big bang. O leitor atual fica vivo durante a migracao.

---

## 14. Estrategia de migracao: SHADOW MODE

O maior erro seria substituir `calc_parse_v2` de uma vez.

A migracao sera paralela:

```text
MESMA ENTRADA
   |
   +------> leitor atual v2 --------> resultado A
   |
   +------> novo interpretador -----> resultado B

comparador:
- produtos
- precos
- fornecedor
- modelo
- condicao
- cor
- pendencias
- linhas silenciosamente erradas
- tempo
```

No inicio, **A continua sendo a verdade operacional**. B so observa.

O novo motor so pode virar principal quando passar os gates de regressao e holdout. A promocao e decisao explicita, nao consequencia de uma migration.

---

## 15. Corpus de prova

A regra global atual diz que export real de fornecedor nao entra no repo. Ela permanece.

Entao o corpus tem duas camadas.

### 15.1 Corpus sintetico no repo

Pode e deve existir no GitHub. Deve cobrir:

- linha unica;
- bloco;
- capacidade em cabecalho;
- capacidade em linha separada;
- preco embaixo;
- cor antes/depois do preco;
- duas moedas;
- numero que nao e preco;
- timestamp que quebra contexto;
- fornecedor desconhecido;
- modelo desconhecido;
- cor desconhecida;
- condicao ausente;
- contradicao;
- categoria nao Apple;
- mensagem com lixo comercial.

### 15.2 Corpus real privado

Listas reais podem ser usadas para prova, mas ficam fora do repo, em storage privado ou mecanismo equivalente. O teste guarda identificador/hash e resultado esperado, nao o conteudo comercial no GitHub.

### 15.3 HOLDOUT

Parte das listas fica proibida para desenvolvimento da fatia. O executor nao usa o holdout para criar regra. Ele roda no fim para medir generalizacao.

Se a fatia falhar no holdout, o defeito deve ser corrigido por classe, nao adicionando regra daquele fornecedor.

---

## 16. Metricas oficiais

Cobertura sozinha deixa de ser suficiente.

Medir por carga:

```text
n_lidas
n_interpretadas
n_inferidas
n_ambiguas
n_invalidas
n_pendencias
n_produtos
n_precos
n_preco_errado_silencioso
parse_ms
```

Medir por fornecedor ao longo do tempo:

```text
perguntas_lista_1
perguntas_lista_2
perguntas_lista_3
cobertura_lista_1..N
mudancas_de_formato
aprendizados_reutilizados
```

Metricas de produto que definem sucesso:

1. `preco_errado_silencioso = 0` nas provas.
2. `code_change_required_for_new_supplier = 0` no holdout.
3. perguntas caem em fornecedor estavel.
4. novo formato degrada para pendencia, nao para erro.
5. tempo nao exige aumento adicional do timeout global de `authenticated`.

---

## 17. Gates obrigatorios por fatia

Toda fatia do interpretador deve passar, no minimo:

1. suite existente da calculadora verde;
2. mesma entrada, cobertura do caminho novo nao pior que o baseline sem justificativa explicita;
3. zero preco errado silencioso nas fixtures conhecidas;
4. corpus adversarial;
5. holdout sem regra especifica para o fornecedor;
6. nenhum `if` por nome/codigo de fornecedor dentro do motor;
7. nenhuma escrita operacional feita pelo LLM;
8. tenant errado continua sem acesso;
9. prova de que a mutacao correspondente reprova;
10. medicao de tempo antes/depois.

A fatia nao passa por quantidade de assercoes. Passa pelo contrato.

---

## 18. Plano de execucao em fatias

### FATIA 0 — Congelar contrato e risco atual

Objetivo: criar baseline antes de mudar inteligencia.

Entregas:

- inventario das regras atuais do leitor por classe;
- corpus sintetico de regressao e adversarial;
- formato de resultado intermediario acordado;
- medicao de tempo;
- metricas de erro silencioso;
- mover para o servidor as travas criticas de aprovacao que hoje vivem so na tela, sem mudar UX;
- declarar que nenhum novo defeito sera resolvido aumentando timeout global.

Nao muda o resultado do parser.

### FATIA 1 — Interpretacao estrutural em shadow mode

Objetivo: separar `linha e o que?` de `qual produto e?`.

Entregas:

- normalizador preservando raw;
- segmentador de mensagem/bloco/linha;
- classificador estrutural;
- IR auditavel;
- execucao paralela sem escrever produto.

O v2 continua principal.

### FATIA 2 — Context Engine

Objetivo: tornar heranca e reset de estado explicitos.

Entregas:

- estado de contexto;
- fronteiras;
- origem de cada campo herdado;
- testes de vazamento de contexto entre familias, mensagens e fornecedores.

### FATIA 3 — Candidate Engine

Objetivo: extrair entidades sem forcar resposta unica.

Entregas:

- candidatos de modelo, capacidade, cor, condicao, preco e moeda;
- evidencia;
- score inicial nao calibrado;
- catalogo como resolvedor, nao como parser de linha.

### FATIA 4 — Confidence, validacao e abstencao

Objetivo: decidir quando o sistema pode aceitar sozinho.

Entregas:

- estados interpretado/inferido/ambiguo/invalido;
- validacao de combinacoes;
- contradicoes;
- pendencia por causa;
- zero preenchimento inventado.

### FATIA 5 — Dialeto + `formato_mudou`

Objetivo: fazer a segunda lista aprender com a primeira sem criar regra dura.

Entregas:

- perfil derivado so de carga aprovada;
- frequencias estruturais;
- desempate;
- alerta de mudanca de formato;
- curva de perguntas por fornecedor.

### FATIA 6 — Aprendizado completo de entidades

Objetivo: fechar os buracos restantes do ciclo.

Entregas:

- cor desconhecida vira pergunta ensinavel;
- categoria/schema deixam de depender de `KCATS` fixo;
- entidade nova entra pelo mesmo caminho auditavel;
- desfazer aprendizado.

### FATIA 7 — LLM fallback

Objetivo: reduzir pendencia rara sem entregar controle ao modelo.

Entregas:

- adapter unico;
- schema JSON estrito;
- contexto minimo;
- cota;
- validacao deterministica depois da resposta;
- fallback total para pendencia quando indisponivel.

### FATIA 8 — Performance e host definitivo

Objetivo: tirar o parse pesado do limite operacional atual.

Entregas:

- benchmark v2 x novo motor;
- decisao registrada de host server-side;
- nenhuma dependencia de novo aumento do timeout global;
- p95 definido e medido.

### FATIA 9 — Promocao do novo motor

Objetivo: trocar a verdade operacional sem big bang.

So acontece quando:

- regressao passa;
- holdout passa;
- zero preco errado silencioso;
- curva de aprendizado melhora;
- dono aprova o diff do shadow mode.

Rollback: voltar a selecionar o v2 como leitor principal sem desfazer catalogo aprendido.

---

## 19. Ordem imediata recomendada

Nao continuar adicionando inteligencia diretamente a `calc_parse_v2` como estrategia principal.

Se aparecer um defeito de producao antes da migracao, ele ainda pode ser corrigido para proteger a loja, mas toda correcao deve responder duas perguntas:

```text
1. isto e uma regra semantica geral ou um remendo do corpus atual?
2. qual fatia do novo motor elimina a necessidade dessa classe de remendo?
```

O proximo trabalho planejado deve ser a **Fatia 0**, e nao o perfil de dialeto isolado. Construir dialeto diretamente em cima do monolito atual antes de criar estrutura/contexto explicitos so adicionaria mais memoria a um leitor dificil de separar depois.

---

## 20. Governanca ChatGPT + Claude

Para esta linha de trabalho:

**Dono do produto**

- decide comportamento de negocio e risco aceitavel;
- aprova merge/promoção.

**ChatGPT — arquitetura e review**

- prepara cada fatia;
- define contrato, invariantes e gates;
- audita diff, migration, testes e handoff;
- classifica `PASSA`, `PASSA COM RESSALVA` ou `VOLTA`;
- nao implementa dentro da branch ativa do Claude durante a fatia.

**Claude Code — executor da Calculadora**

- le este documento e a especificacao da fatia;
- implementa somente o escopo da fatia;
- roda provas;
- registra descobertas fora de escopo sem resolve-las escondido;
- faz commit/push;
- nao inicia a fatia seguinte antes do review.

**GitHub — interface entre os agentes**

Uma fatia deve deixar no repo:

```text
spec da fatia
codigo
migration quando houver
provas
resultado das provas
handoff novo
commit identificavel
```

Sessao ideal:

```text
ChatGPT prepara FATIA N
        |
        v
Claude implementa FATIA N
        |
        v
GitHub
        |
        v
ChatGPT audita
   |           |
 PASSA       VOLTA
   |           |
FATIA N+1   Claude corrige N
```

Regra: **uma fatia, um objetivo, um conjunto de invariantes, um review antes da proxima.**

---

## 21. O que esta fora deste projeto

Este documento nao autoriza:

- mudar politica de margem;
- alterar CRM ou Financeiro;
- criar catalogo global mantido pelo dono;
- aprovar carga automaticamente;
- gravar lista real de fornecedor no GitHub;
- deixar o modelo decidir preco;
- reescrever toda a Calculadora de uma vez;
- substituir o ciclo de pendencias por um chat de IA;
- sacrificar auditabilidade para aumentar cobertura.

---

## 22. Definicao final de pronto

O interpretador esta pronto quando um teste real puder seguir este roteiro:

```text
FORNECEDOR NUNCA VISTO
        |
        v
cola a primeira lista
        |
        v
sistema entende o que consegue
+ pergunta somente o que falta
        |
        v
usuario ensina
        |
        v
aprova
        |
        v
cola a segunda lista
        |
        v
menos perguntas
        |
        v
cola a terceira lista
        |
        v
quase nenhuma pergunta se o formato permaneceu estavel
```

E, durante todo o roteiro:

```text
0 mudanca de codigo para aquele fornecedor
0 preco errado silencioso
0 regra por nome do fornecedor
100% de proveniencia do que foi aprendido
rollback possivel
```

Esse e o portao do produto. Cobertura alta sem essas propriedades nao fecha o interpretador.
