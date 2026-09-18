# EXTERNAL CALC — FRONTEND PREPARATION V0

Data: 18/09/2026  
Status: trilha paralela de preparação  
Base técnica: `feat/external-calc-v0` @ `53af5714f86eab44eabe155b1f7e8a5b7bd954f7`  
Regra: esta trilha não altera `main`, produção, banco, parser operacional nem o gate do Interpreter.

## 1. Objetivo

Preparar o futuro frontend do External Calc usando a calculadora atual como base funcional real, sem redesenhar às cegas e sem acoplar a interface a contratos de backend que ainda estão em estabilização.

A meta desta V0 é deixar prontos:

1. inventário do frontend atual;
2. fluxo canônico do produto externo;
3. mapa de telas;
4. fronteiras de componentes;
5. contratos de UI por mock;
6. estados de erro/ambiguidade/processamento;
7. plano de migração do frontend atual;
8. gates para iniciar a implementação real quando o Calc Service, Research Engine e Price Indicator estabilizarem.

## 2. Regra central

> Preservar a operação validada; substituir o acoplamento.

A calculadora atual já contém decisões operacionais valiosas. Elas não devem ser descartadas apenas porque o frontend será refeito.

O que muda é a forma de estruturar a aplicação:

- experiência atual → referência funcional;
- HTML monolítico → componentes/features;
- chamadas diretas de banco → services/adapters;
- estado implícito em DOM → estado de aplicação;
- telas internas Pitstop → experiência de produto independente;
- contratos provisórios → contratos versionados;
- UI dependente do Supabase → UI consumidora do Calc Service.

## 3. Inventário real do frontend atual

### 3.1 `public/calc/index.html`

Responsabilidades encontradas:

- venda;
- upgrade;
- cálculo reverso;
- scanner de oferta;
- catálogo;
- busca de modelo;
- seleção de fornecedor;
- seleção de cor;
- custo manual;
- frete;
- margem;
- preço à vista;
- parcelamento 12x e 18x;
- abatimento;
- defeitos/reparos no usado;
- avaliação de entrada;
- cálculo de diferença do upgrade;
- copiar proposta para WhatsApp;
- configuração de margem;
- leitura de catálogo e preços;
- autenticação e roteamento por papel.

Navegação atual relevante:

`VENDA | UPGRADE | REVERSO | OFERTA | CATÁLOGO`

### 3.2 `public/calc/alimentar/index.html`

Fluxo atual em quatro passos:

1. Colar a lista;
2. O que a leitura achou;
3. Pendências / aprendizado;
4. Conferir e aprovar.

Entradas atuais:

- texto colado;
- `_chat.txt`;
- export `.zip`;
- janela temporal de mensagens.

A tela também já representa conceitos importantes para o produto externo:

- cobertura medida;
- pendências;
- aprendizado;
- releitura;
- aprovação;
- comparação com dados atuais.

### 3.3 `public/calc/consultor/index.html`

Superfície simplificada para operação comercial:

- venda;
- upgrade;
- proposta;
- parcelas;
- comissão;
- montagem de pedido.

Esta superfície não entra no primeiro External Calc Beta. Fica registrada como possível modo futuro de compartilhamento/colaboração.

## 4. O que deve ser preservado

### 4.1 Interações já validadas

Preservar conceitualmente:

- busca rápida por modelo;
- cálculo instantâneo;
- comparação por fornecedor;
- custo manual;
- preço à vista;
- parcelamento;
- upgrade;
- cálculo reverso;
- copiar proposta;
- fluxo de alimentar lista;
- revisão humana de pendências;
- evidência antes de aprovação;
- catálogo como referência explícita;
- conceito de scanner de oportunidade.

### 4.2 Linguagem operacional

A nova experiência pode mudar visualmente, mas deve continuar compreensível para quem já usa a calculadora.

Termos que podem permanecer, quando fizerem sentido no produto externo:

- custo;
- fornecedor;
- modelo;
- condição;
- cor;
- preço;
- margem;
- à vista;
- parcelado;
- pendência;
- evidência;
- menor custo;
- oportunidade.

## 5. O que NÃO deve ser carregado como arquitetura

Não copiar para o produto externo:

- Supabase chamado diretamente dentro das páginas;
- autenticação embutida no HTML de cada tela;
- lógica de negócio espalhada no DOM;
- IDs de elemento como API interna;
- regras de negócio duplicadas entre telas;
- frontend decidindo verdade operacional;
- escrita de preço disparada pelo interpretador;
- dependência de papel `dono` no Core;
- contratos implícitos de objetos;
- arquivos HTML gigantes como unidade principal de evolução.

## 6. Fluxo canônico do External Calc

```text
INÍCIO
  ↓
NOVA ANÁLISE
  ↓
COLAR / ENVIAR LISTA
  ↓
INTERPRETANDO
  ↓
REVISÃO DA INTERPRETAÇÃO
  ├─ interpretado
  ├─ inferido
  ├─ ambíguo
  └─ inválido
  ↓
OFERTAS VÁLIDAS
  ↓
CALCULAR
  ↓
PESQUISAR MERCADO
  ↓
INDICADOR DE PREÇO
  ├─ barato
  ├─ dentro do mercado
  ├─ caro
  └─ evidência insuficiente
  ↓
EVIDÊNCIAS
  ↓
RESULTADO
  ↓
HISTÓRICO (fase posterior)
```

## 7. Navegação proposta para o Beta

Primeira navegação canônica:

```text
Analisar
Calcular
Mercado
```

Preparados, mas não habilitados no primeiro corte:

```text
Histórico
Organização
Configurações
```

### 7.1 Analisar

É a evolução direta de `/calc/alimentar/`.

Responsabilidades:

- colar/enviar lista;
- acompanhar processamento;
- visualizar resumo;
- revisar registros;
- visualizar ambiguidades;
- selecionar uma oferta para cálculo;
- abrir evidência/trace.

### 7.2 Calcular

É a evolução funcional da calculadora atual.

Responsabilidades:

- modelo;
- condição;
- cor;
- custo;
- fornecedor;
- frete;
- margem;
- preço de venda;
- parcelamento;
- upgrade;
- cálculo reverso.

A tela pode receber uma oferta diretamente da etapa de análise para evitar redigitação.

### 7.3 Mercado

É a evolução do conceito atual de `OFERTA`, mas com fonte explícita e pesquisa real.

Responsabilidades:

- preço observado;
- fontes;
- data/hora;
- amostra;
- dispersão;
- indicador;
- comparação com o custo analisado;
- evidência que sustenta o indicador.

## 8. Tela principal: Analysis Workspace

A primeira tela realmente nova do External Calc deve ser um workspace, não apenas um formulário.

Estrutura:

```text
┌──────────────────────────────────────────────────────────┐
│ External Calc                               Nova análise │
├───────────────┬──────────────────────────────────────────┤
│ Analisar      │ Lista / arquivo                          │
│ Calcular      │                                          │
│ Mercado       │ Resumo da interpretação                  │
│               │                                          │
│ Histórico*    │ Ofertas interpretadas                    │
│               │                                          │
│               │ Pendências / ambiguidades                │
│               │                                          │
│               │ Evidência / trace                        │
└───────────────┴──────────────────────────────────────────┘
```

`Histórico*` permanece preparado, mas oculto/desabilitado até a fase correspondente.

## 9. Estados obrigatórios da interface

Todo componente que consome o interpretador deve entender estes estados:

### Documento

- idle;
- uploading;
- queued;
- interpreting;
- ready;
- failed.

### Registro

- interpreted;
- inferred;
- ambiguous;
- invalid.

### Pesquisa

- idle;
- researching;
- ready;
- insufficient_evidence;
- failed.

### Indicador

- cheap;
- fair;
- expensive;
- insufficient_evidence.

Nunca converter `ambiguous` em valor visualmente “confirmado”.

## 10. Fronteiras de componentes

Estrutura conceitual:

```text
AppShell
├── PrimaryNav
├── AnalysisWorkspace
│   ├── SourceInput
│   ├── ProcessingStatus
│   ├── InterpretationSummary
│   ├── OfferTable
│   ├── AmbiguityPanel
│   └── EvidenceDrawer
├── CalculatorWorkspace
│   ├── OfferSelector
│   ├── CostEditor
│   ├── MarginEditor
│   ├── FreightControl
│   ├── InstallmentTable
│   ├── UpgradeCalculator
│   └── ReverseCalculator
└── MarketWorkspace
    ├── ResearchStatus
    ├── MarketSummary
    ├── PriceIndicator
    ├── EvidenceList
    └── SourceDetails
```

## 11. Fronteiras de dados

A UI não deve conhecer Supabase, tabelas `calc_*` ou RPCs.

Ela deve depender de quatro interfaces:

```text
InterpreterClient
CalculatorClient
ResearchClient
HistoryClient (posterior)
```

### 11.1 InterpreterClient

Entrada:

- documento;
- metadata mínima.

Saída:

- run;
- records;
- ambiguities;
- metrics;
- warnings.

### 11.2 CalculatorClient

Entrada:

- oferta;
- regras comerciais;
- ajustes do usuário.

Saída:

- preço;
- margem;
- parcelamento;
- cenários.

### 11.3 ResearchClient

Entrada:

- identidade canônica da oferta.

Saída:

- observações;
- fontes;
- estatísticas;
- indicador;
- evidência.

### 11.4 HistoryClient

Não implementar na preparação V0.

Somente reservar a interface.

## 12. Mock como contrato provisório

Até os serviços reais estabilizarem, o frontend deve ser construível contra mocks versionados.

Arquivo inicial:

`docs/calculadora/mocks/external-calc-analysis-v0.json`

Regra:

> trocar mock por API não deve exigir redesenhar componente.

## 13. Mapeamento atual → futuro

| Atual | Futuro |
|---|---|
| `/calc/alimentar/` | Analysis Workspace |
| Passo 1 — colar lista | SourceInput |
| Passo 2 — leitura | InterpretationSummary + OfferTable |
| Passo 3 — pendências | AmbiguityPanel |
| Passo 4 — aprovar | Review/Apply boundary |
| `/calc/` VENDA | Calculator Workspace |
| `/calc/` UPGRADE | UpgradeCalculator |
| `/calc/` REVERSO | ReverseCalculator |
| `/calc/` OFERTA | Market Workspace / Price Indicator |
| `/calc/` CATÁLOGO | Catalog/knowledge reference |
| `/calc/consultor/` | futura superfície colaborativa |

## 14. Estratégia de migração

### Fase F0 — Frontend Inventory

Status: concluído nesta preparação.

Gate:

- telas atuais identificadas;
- fluxos identificados;
- responsabilidades identificadas;
- acoplamentos identificados.

### Fase F1 — Information Architecture

Definir:

- navegação;
- workspace;
- hierarquia;
- estados;
- progressão entre análise, cálculo e mercado.

Gate:

- nenhuma tela necessária fica sem destino;
- nenhum conceito de backend vira elemento visual sem motivo.

### Fase F2 — Mock Contracts

Criar mocks versionados para:

- interpretação;
- cálculo;
- pesquisa;
- indicador.

Gate:

- frontend pode rodar sem Supabase;
- nenhum mock exige banco;
- estados ambíguos estão representados.

### Fase F3 — Prototype

Construir frontend isolado usando somente mocks.

Gate:

- fluxo principal pode ser percorrido;
- mobile e desktop básicos;
- nenhuma chamada operacional;
- nenhum segredo;
- nenhum write.

### Fase F4 — Real Service Integration

Só inicia quando:

- Gate Interpreter Ready = verde;
- Calc Service possui contrato estável;
- Research Engine V0 possui resposta estável;
- Price Indicator V0 possui contrato estável.

Trocar adapters mock por clients reais.

### Fase F5 — Usability Gate

Usuário zero executa:

1. envia lista;
2. entende o que foi interpretado;
3. identifica ambiguidade;
4. abre uma oferta;
5. calcula;
6. pesquisa;
7. compreende o indicador;
8. acessa evidência.

Sem instrução técnica externa.

## 15. Decisão visual

A estrutura atual é base funcional, não obrigação estética.

Nesta etapa:

- não congelar tipografia final;
- não congelar paleta final;
- não congelar layout final;
- preservar densidade útil;
- preservar velocidade de operação;
- preservar leitura de custo/preço/margem;
- reduzir aparência de ferramenta interna;
- preparar linguagem de produto independente.

O design visual final deve acontecer depois que o fluxo mock estiver validado.

## 16. Segurança

Durante Frontend Preparation V0:

- nenhum segredo novo no repositório;
- nenhum dado real de fornecedor em mock;
- nenhum acesso a produção;
- nenhum write em Supabase;
- nenhum bypass de autenticação;
- nenhum deploy externo;
- nenhum merge em `main`.

A implementação real seguirá o princípio de frontend não confiável: toda autorização e regra crítica deve ser validada no serviço/backend.

## 17. Gate FRONTEND PREPARATION V0

A preparação está pronta quando existirem:

- [x] inventário atual;
- [x] mapa atual → futuro;
- [x] fluxo canônico;
- [x] componentes propostos;
- [x] estados obrigatórios;
- [x] fronteiras de dados;
- [ ] mock de interpretação;
- [ ] mock de cálculo;
- [ ] mock de pesquisa/indicador;
- [ ] protótipo isolado.

## 18. Próximo passo desta trilha

Criar o pacote de mocks V0 e, em seguida, construir um protótipo isolado do `Analysis Workspace`.

O protótipo NÃO substitui a calculadora atual e NÃO consome o backend real.

A integração começa somente quando os gates técnicos do External Calc autorizarem.
