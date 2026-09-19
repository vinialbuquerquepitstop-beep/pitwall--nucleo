# INTERPRETADOR CORE INDEPENDENTE V1

Data: 17/09/2026
Status: direcao arquitetural para a branch `feat/calculadora-interpretador-assuncao-v1`
Escopo: evolucao do leitor da Calculadora para um motor reutilizavel e independente

## 1. Tese

O objetivo nao e apenas criar um parser que aceite fornecedores novos.

O objetivo e criar um **Interpretador Core** capaz de receber uma fonte comercial semi-estruturada, produzir registros canonicos auditaveis e declarar com precisao o que nao conseguiu entender, sem depender da Calculadora, da UI, do Supabase, de um fornecedor especifico, de um dominio Apple ou de um modelo de IA.

A Calculadora Pitwall passa a ser um consumidor desse motor, e nao o lugar onde a inteligencia mora.

Principio:

> fornecedor novo deve gerar conhecimento novo; dominio novo deve gerar schema/adaptador novo; nenhum dos dois deve exigir cirurgia no nucleo do interpretador.

---

## 2. Independencia real: cinco eixos

O motor so sera realmente independente quando passar simultaneamente nestes cinco eixos.

### 2.1 Independencia de fornecedor

- nenhum `if fornecedor == X`;
- formato desconhecido degrada para ambiguidade/pendencia;
- perfil do fornecedor apenas desempata;
- segunda e terceira listas podem aproveitar memoria externa aprovada.

### 2.2 Independencia de banco

O Core nao conhece:

- Supabase;
- Postgres;
- tabela `calc_*`;
- tenant_id;
- RPC;
- RLS.

Ele recebe conhecimento por contrato e devolve resultado por contrato.

Um adaptador Pitwall pode ler/escrever no Supabase. Outro consumidor pode usar JSON local, SQLite, outro Postgres ou nenhuma persistencia.

### 2.3 Independencia de dominio

O Core nao conhece uma lista fixa de categorias como iPhone, MacBook, Watch, Garmin ou JBL.

Ele recebe um `DomainSchema` que descreve:

- campos comuns;
- campos obrigatorios;
- tipos;
- aliases;
- validadores;
- combinacoes permitidas;
- regras de plausibilidade.

Apple vira um pacote de dominio. Eletronicos pode ser outro. Pecas automotivas, bebidas ou moda podem existir sem alterar o pipeline estrutural.

### 2.4 Independencia de host

A mesma interpretacao deve poder rodar:

- em teste unitario;
- em CLI;
- em processo Node/Deno;
- em Edge Function;
- em Worker/servico HTTP;
- em job assíncrono.

O codigo do Core nao chama navegador, banco ou rede diretamente.

### 2.5 Independencia de IA

IA e plugin opcional.

Sem modelo disponivel, o sistema continua:

- normalizando;
- segmentando;
- classificando deterministicamente;
- extraindo candidatos;
- herdando contexto;
- validando;
- abstendo.

O modelo so pode propor hipoteses para casos que o caminho deterministico nao resolveu. Toda proposta volta para validacao deterministica.

---

## 3. O produto real

Nome conceitual deste componente:

`Interpreter Core`

Entrada:

```text
RawDocument
+ SourceMetadata
+ DomainSchema
+ KnowledgeSnapshot opcional
+ InterpretationPolicy
```

Saida:

```text
InterpretationBundle
```

O `InterpretationBundle` contem:

- documento normalizado;
- segmentos;
- linhas e papeis candidatos;
- entidades candidatas;
- contexto herdado e origem;
- registros interpretados;
- ambiguidades;
- rejeicoes estruturais;
- propostas de aprendizado;
- metricas;
- trace da decisao;
- versoes de motor/schema/knowledge usadas.

O Core **nao aprova**, **nao grava preco**, **nao cria catalogo** e **nao altera memoria**.

---

## 4. Arquitetura em portas e adaptadores

```text
                 +----------------------+
 TXT / ZIP ------>|                      |
 CSV / XLSX ----->|   INPUT ADAPTERS     |
 API ------------>|                      |
 PDF futuro ----->|                      |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 |                      |
                 |   INTERPRETER CORE   |
                 |                      |
                 | normalize            |
                 | segment              |
                 | classify             |
                 | extract candidates   |
                 | context              |
                 | resolve              |
                 | validate             |
                 | confidence/abstain   |
                 | explain              |
                 |                      |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 | InterpretationBundle |
                 +----------+-----------+
                            |
          +-----------------+------------------+
          |                 |                  |
          v                 v                  v
   Pitwall Adapter      CLI / JSON        Outra aplicacao
   Supabase/RPC         local             via API
```

O ponto critico e: **input adapter e persistence adapter ficam fora do Core**.

---

## 5. Camadas do Core

### 5.1 Normalizer

Converte grafias para forma comparavel sem destruir o raw.

Nunca substitui a evidencia original.

Saida minima:

```json
{
  "raw": "BLACK 980 💵",
  "normalized": "black 980",
  "offsets": [],
  "normalization_steps": []
}
```

### 5.2 Segmenter

Descobre fronteiras de:

- documento;
- mensagem;
- bloco;
- linha;
- cabecalho;
- mudanca temporal;
- mudanca de fonte.

Nao tenta ainda escolher produto.

### 5.3 Structural Classifier

Responde primeiro: **que funcao esta linha exercendo?**

Possiveis papeis sao schema/configuracao, nao fornecedor hardcoded:

- header;
- supplier_header;
- product_header;
- variant;
- price_line;
- condition;
- note;
- warning;
- noise;
- unknown.

Pode devolver multiplos candidatos.

### 5.4 Candidate Extractor

Extrai hipoteses sem forcar verdade unica.

Exemplo:

```json
{
  "field": "storage_gb",
  "candidates": [
    {"value": 256, "score": 0.94, "evidence": "token:256"}
  ]
}
```

### 5.5 Context Engine

Componente de primeira classe e imutavel por passo.

Campos dependem do schema, mas cada heranca registra:

- valor;
- origem;
- regra de abertura;
- regra de encerramento;
- confidence;
- validade temporal/estrutural.

Nenhum campo pode aparecer em um registro final sem `source` ou `derived_from`.

### 5.6 Resolver

Confronta candidatos com `KnowledgeSnapshot`:

- entidades;
- aliases;
- ontologia;
- combinacoes permitidas;
- dialeto aprovado.

O catalogo ajuda a resolver. Ele nao classifica sozinho uma linha bruta.

### 5.7 Validator

Aplica regras declaradas pelo dominio/politica:

- obrigatoriedade;
- tipo;
- combinacao;
- faixa plausivel;
- contradicao;
- moeda;
- duplicidade;
- coerencia de contexto.

### 5.8 Confidence + Abstention

Estados canonicos:

- `interpreted`;
- `inferred`;
- `ambiguous`;
- `invalid`.

Nao existe `unknown -> best guess -> grava`.

Quando falta evidencia, a saida correta e `ambiguous`.

### 5.9 Explanation Trace

Cada decisao deve ser reconstruivel.

Nao e log textual solto; e dado estruturado.

Exemplo:

```json
{
  "field": "model",
  "chosen": "iphone_16_pro_max",
  "sources": [179],
  "rules": ["header-model", "context-inherit"],
  "alternatives": [],
  "confidence": 0.96
}
```

Os scores nao devem ser chamados de probabilidades ate existir calibracao.

---

## 6. Contratos publicos do Core

A fronteira do motor deve ser pequena e estavel.

### 6.1 Interpretar

Conceitualmente:

```text
interpret(
  document,
  source,
  schema,
  knowledge,
  policy
) -> InterpretationBundle
```

### 6.2 Reinterpretar

O Core nao precisa de um caminho especial de releitura.

Nova resposta humana ou novo conhecimento gera um novo `KnowledgeSnapshot`/`policy overlay` e a mesma funcao `interpret()` roda de novo.

Isso reduz estados ocultos.

### 6.3 Sem writes

O Core nao expoe:

```text
approve()
createSupplier()
writePrice()
learnAlias()
```

Essas funcoes pertencem ao consumidor/adapter.

---

## 7. Schemas versionados

Os schemas de entrada/saida e de dominio devem ser versionados.

Exemplo:

```text
core-contract/v1
interpretation-bundle/v1
domain/apple-electronics/v1
knowledge-snapshot/v1
```

JSON Schema e o formato recomendado para contratos de dados e validacao externa.

O schema de dominio pode definir extensoes sem alterar o Core.

Exemplo Apple:

```json
{
  "entity": "product_offer",
  "required": ["model", "price", "currency"],
  "properties": {
    "model": {"type": "string"},
    "storage_gb": {"type": "integer"},
    "color": {"type": "string"},
    "condition": {"type": "string"},
    "price": {"type": "number"},
    "currency": {"type": "string"}
  }
}
```

---

## 8. KnowledgeSnapshot: memoria sem acoplamento

O Core recebe um snapshot somente leitura.

```text
KnowledgeSnapshot
  entities
  aliases
  semantic_rules
  supplier_profiles
  domain_rules
  metadata/version
```

Ele pode devolver `LearningProposal[]`, mas nunca aplicar.

Exemplo:

```json
{
  "kind": "alias_proposal",
  "raw": "16PM",
  "target": "iphone_16_pro_max",
  "evidence": [42, 51, 87],
  "scope": "tenant",
  "confidence": 0.91
}
```

A aplicacao Pitwall decide se isso vira `calc_alias`, pendencia ou nada.

Essa separacao torna o aprendizado portavel e reversivel.

---

## 9. Dialeto como plugin de evidencia

Perfil do fornecedor nao fica embutido no parser.

Ele entra como uma fonte adicional de evidencia:

```text
current evidence
+ approved supplier profile
-> candidate reranking
```

Nunca:

```text
supplier profile
-> fabricate missing evidence
```

Perfis sao derivados apenas de documentos aprovados e carregam versao, janela e numero de observacoes.

Mudanca estrutural relevante produz `format_drift`.

---

## 10. IA como Adapter opcional

Contrato:

```text
ModelFallback.propose(fragment, context, candidates, schema)
  -> hypotheses[]
```

Regras:

- entrada minima;
- resposta estruturada;
- timeout proprio;
- sem acesso direto ao banco;
- sem segredo operacional desnecessario;
- toda hipotese passa por Validator;
- indisponibilidade do modelo vira `ambiguous`, nunca falha operacional completa.

O Core deve conseguir rodar a suite inteira com `ModelFallback = null`.

---

## 11. Input adapters

### V1

- plain text;
- WhatsApp `_chat.txt`;
- WhatsApp `.zip`.

### V2

- CSV;
- XLSX;
- clipboard tabular.

### V3, se houver necessidade real

- PDF texto;
- imagem/OCR;
- e-mail;
- URL/API de fornecedor.

Importante: extrair texto/documento e interpretar oferta sao problemas separados. OCR ruim nao pode virar regra do parser de preco.

---

## 12. Quatro formas de uso

O mesmo Core deve poder ser exposto em quatro superficies.

### Biblioteca

Para Pitwall e testes.

### CLI

Exemplo conceitual:

```text
interpreter parse lista.txt --schema apple-electronics --out result.json
```

Serve para benchmark, desenvolvimento e auditoria.

### HTTP API

```text
POST /v1/interpret
```

Recebe documento ou referencia privada + schema + versao de knowledge.

### Job/Batch

Para muitas listas, sem prender request HTTP longo.

Essas superficies chamam o mesmo motor.

---

## 13. Observabilidade

Cada interpretacao recebe:

- `run_id`;
- `document_hash`;
- `engine_version`;
- `schema_version`;
- `knowledge_version`;
- tempos por etapa;
- contagens por estado;
- warnings;
- fallback usado ou nao.

A trilha deve permitir comparar duas versoes do motor na mesma entrada.

Tracing distribuido pode ser adicionado no host, sem invadir o Core.

---

## 14. Benchmark como produto do motor

O benchmark nao e ferramenta lateral. E parte do contrato de evolucao.

Para a mesma entrada, comparar:

```text
engine A x engine B
```

Por campo e por registro:

- precision;
- recall;
- ambiguous rate;
- silent wrong price;
- supplier leakage;
- context leakage;
- parse_ms;
- memory;
- fallback calls;
- learning proposals.

Indicador principal continua:

`silent_wrong_price = 0`

Mas agora deve existir tambem:

`consumer_specific_code_in_core = 0`

`database_calls_from_core = 0`

`supplier_specific_branch_in_core = 0`

`domain_hardcode_in_pipeline = 0`

---

## 15. Relacao com a Calculadora Pitwall

A Calculadora fica dividida em tres responsabilidades.

### A. Interpreter Core

Interpreta. Nao grava.

### B. Pitwall Adapter

Traduz:

```text
calc catalogo/RPC -> KnowledgeSnapshot
InterpretationBundle -> rascunho/pendencias
LearningProposal -> fluxo humano de ensino
```

### C. Operacao da Calculadora

Continua dona de:

- tenant;
- permissao;
- catalogo operacional;
- margem;
- aprovacao;
- custo vigente;
- historico;
- UI.

Logo, extrair o interpretador nao exige reescrever a Calculadora.

---

## 16. Migração recomendada

### Fase A — Contract Extraction

Sem alterar resultado operacional:

1. definir tipos/JSON Schemas;
2. criar `interpret()` pura;
3. extrair ingestao atual para adapter;
4. construir fixture runner;
5. transformar o benchmark atual em comparador oficial.

### Fase B — Structural Core

1. normalizer;
2. segmenter;
3. structural classifier;
4. IR auditavel;
5. shadow mode.

### Fase C — Semantic Core

1. context engine;
2. candidate extractor;
3. resolver por snapshot;
4. validator;
5. abstention.

### Fase D — Memory Boundary

1. KnowledgeSnapshot;
2. LearningProposal;
3. supplier profile;
4. format drift;
5. Pitwall Adapter aplica somente apos fluxo humano.

### Fase E — Independent Surfaces

1. CLI;
2. HTTP API;
3. batch runner;
4. Pitwall passa a consumir a mesma interface publica.

### Fase F — Optional Intelligence

1. model fallback;
2. novos schemas de dominio;
3. novos input adapters.

---

## 17. O que NAO fazer

- nao criar microservico antes de extrair a funcao pura;
- nao reescrever toda a Calculadora;
- nao migrar o parser para outra linguagem apenas por arquitetura;
- nao colocar LLM no caminho feliz;
- nao transformar profile de fornecedor em regra dura;
- nao persistir dentro do Core;
- nao acoplar `tenant_id` ao modelo de dominio do interpretador;
- nao chamar score de probabilidade sem calibracao;
- nao adicionar PDF/OCR antes de texto/WhatsApp estar generalizado;
- nao otimizar cobertura sacrificando abstencao.

---

## 18. Definicao de pronto do componente independente

O Core V1 esta realmente independente quando for possivel provar o seguinte:

1. executar uma lista por CLI sem Supabase;
2. executar a mesma lista no Pitwall e obter o mesmo `InterpretationBundle` antes do adapter operacional;
3. trocar o KnowledgeSnapshot por um JSON de fixture sem mudar codigo;
4. adicionar um fornecedor novo sem mudar o Core;
5. adicionar um alias novo sem mudar o Core;
6. executar sem LLM;
7. trocar o host sem mudar regra semantica;
8. todo registro final explica suas fontes;
9. toda ambiguidade aparece explicitamente;
10. zero preco errado silencioso no corpus de regressao/holdout;
11. nenhum acesso a banco dentro do pacote Core;
12. nenhum ramo por fornecedor dentro do pacote Core.

Quando essas propriedades forem verdadeiras, a Calculadora deixa de possuir um parser e passa a consumir um **produto de interpretacao reutilizavel**.
