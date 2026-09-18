# EXTERNAL CALC — SYSTEM MAP V0

Data: 18/09/2026
Status: arquitetura operacional do produto
Branch: `feat/external-calc-frontend-preparation-v0`

## 1. Objetivo

Transformar o External Calc em um produto cuja interface represente o sistema real, sem criar telas desconectadas do Interpreter Core, da Calculadora, da futura pesquisa de mercado e dos gates técnicos.

Este documento liga:

```text
CORE / OPERAÇÃO REAL
        ↓
ENTIDADES E ESTADOS
        ↓
CONEXÕES E CONTRATOS
        ↓
ARQUITETURA DA INFORMAÇÃO
        ↓
CONTRATOS DE TELA
        ↓
OVERVIEW + DESIGN SYSTEM
        ↓
VERTICAL SLICES REAIS
```

A Overview do Stitch continua sendo a tela calibradora visual. Ela não redefine regra de negócio, entidade, permissão ou verdade operacional.

## 2. Regra de leitura

Cada bloco abaixo recebe um estado:

- **REAL** — existe hoje no repositório/operação;
- **PREPARADO** — contrato, mock ou fronteira já definida, mas serviço ainda não estabilizado;
- **POSTERIOR** — deliberadamente fora do primeiro corte externo.

Nunca apresentar um bloco PREPARADO como backend concluído.

## 3. Mapa macro

```text
USUÁRIO
  │
  ▼
APP SHELL / OVERVIEW
  │
  ├───────────────┬────────────────┐
  ▼               ▼                ▼
ANALISAR        CALCULAR          MERCADO
  │               │                │
  ▼               ▼                ▼
SourceInput   CalculatorClient   ResearchClient
  │               │                │
  ▼               ▼                ▼
Input Adapter  Calc boundary     Observações / fontes
  │               │                │
  ▼               ▼                ▼
Interpreter    Resultado de       Price Indicator
Core V1        cálculo             │
  │                                ▼
  ▼                             Evidências
InterpretationBundle               │
  │                                │
  ├─ records                       │
  ├─ ambiguities                   │
  ├─ invalid                       │
  ├─ warnings                      │
  ├─ metrics                       │
  └─ trace                         │
  │                                │
  └──────────── oferta selecionada ┘
                 │
                 ▼
              RESULTADO
                 │
                 ▼
              HISTÓRICO
             (POSTERIOR)
```

Camadas transversais futuras/obrigatórias para beta externa:

```text
AUTH
ORGANIZATION / TENANT
AUTHORIZATION
AUDIT LOG
OBSERVABILITY
ERROR HANDLING
SECURITY
```

## 4. Estado real dos módulos

| Módulo | Estado | Evidência atual | Papel no produto |
|---|---|---|---|
| Calculadora operacional | REAL | `public/calc/index.html` | venda, upgrade, reverso, custos, margem, parcelamento |
| Alimentador/lista | REAL | `public/calc/alimentar/index.html` | ingestão, leitura, pendências, aprovação |
| Consultor | REAL / fora do Beta | `public/calc/consultor/` | superfície comercial futura |
| Interpreter Core | REAL em evolução | contratos V1 + ferramentas do core | interpretar sem banco/write |
| InterpretationBundle | REAL | JSON Schema versionado | contrato principal da interpretação |
| Mock Workspace | REAL como mock | `external-calc-workspace-v0.json` | contrato provisório de UI |
| Protótipo frontend | REAL isolado | `prototypes/external-calc-frontend-v0/` | navegação mock Analisar/Calcular/Mercado |
| CalculatorClient | PREPARADO | fronteira definida | desacoplar UI da calculadora legada |
| ResearchClient | PREPARADO | mock e contrato conceitual | pesquisa de mercado |
| Price Indicator | PREPARADO | mock com cheap/fair/expensive/insufficient | sinal de preço baseado em evidência |
| HistoryClient | POSTERIOR | interface reservada | persistência e recuperação de análises |
| Auth + Organization | POSTERIOR para frontend atual | pipeline do External Beta | acesso externo e isolamento |

## 5. Entidades do produto

### 5.1 Analysis

Unidade de trabalho criada quando o usuário inicia uma nova análise.

Estado conceitual:

```text
idle
→ uploading
→ queued
→ interpreting
→ ready
└→ failed
```

Na V0 de frontend, Analysis pode existir apenas como estado de aplicação/mock. Persistência definitiva pertence à fase de histórico.

### 5.2 RawDocument

Entrada submetida pelo usuário.

V1:
- texto simples;
- WhatsApp `_chat.txt`;
- WhatsApp `.zip`.

O documento bruto nunca deve ser confundido com oferta validada.

### 5.3 InterpretationRun

Execução do Interpreter Core.

Campos já sustentados pelo contrato:
- `run_id`;
- `document_id`;
- `document_hash`;
- `engine_version`;
- `schema_id`;
- `schema_version`;
- `knowledge_version`;
- timestamps.

### 5.4 OfferRecord

Registro interpretado utilizável.

Estados canônicos atuais:
- `interpreted`;
- `inferred`.

Uma oferta não deve nascer de uma ambiguidade silenciosamente promovida.

### 5.5 Ambiguity

Questão que o motor não conseguiu resolver com segurança.

Campos do contrato:
- id;
- campo;
- causa;
- raw;
- candidatos;
- sources;
- contexto.

A UI deve apresentar ambiguidade como pendência/revisão, nunca como confirmação.

### 5.6 InvalidRecord

Trecho rejeitado por regra estrutural/semântica.

Não entra no fluxo de cálculo como oferta válida.

### 5.7 Evidence / Trace

Explicação estruturada de como um campo/registro foi obtido.

O frontend deve conseguir responder:
- de onde veio;
- qual regra foi usada;
- qual linha/origem sustentou;
- se houve inferência;
- quais alternativas existiam quando aplicável.

### 5.8 Calculation

Transformação de uma oferta em cenário comercial.

Inputs preparados:
- custo;
- frete;
- margem;
- desconto/ajustes;
- modalidade relevante.

Outputs preparados:
- custo total;
- preço;
- margem/lucro;
- parcelamento;
- cenários.

Até o Calc Service estabilizar, a UI não deve inventar um contrato definitivo além do mock/versionamento acordado.

### 5.9 MarketResearch

Pesquisa associada à identidade canônica de uma oferta.

Contrato provisório:
- status;
- observations;
- source;
- price;
- captured_at;
- statistics;
- evidence quality.

### 5.10 PriceIndicator

Sinal derivado da pesquisa.

Estados obrigatórios:
- `cheap`;
- `fair`;
- `expensive`;
- `insufficient_evidence`.

Nunca exibir cheap/fair/expensive sem evidência suficiente.

## 6. Fluxo operacional canônico

```text
NOVA ANÁLISE
   ↓
INPUT DA LISTA
   ↓
INTERPRETAÇÃO
   ↓
REVISÃO
   ├─ interpreted ─┐
   ├─ inferred ────┤
   ├─ ambiguous → revisão
   └─ invalid → excluído do caminho feliz
                   │
                   ▼
            SELECIONAR OFERTA
                   │
                   ▼
               CALCULAR
                   │
                   ▼
          PESQUISAR MERCADO
                   │
                   ▼
           PRICE INDICATOR
                   │
                   ▼
              EVIDÊNCIAS
                   │
                   ▼
               RESULTADO
                   │
                   ▼
              HISTÓRICO
              (posterior)
```

## 7. Estados de processamento

### Documento
`idle | uploading | queued | interpreting | ready | failed`

### Registro
`interpreted | inferred | ambiguous | invalid`

Observação: `ambiguous` e `invalid` são coleções separadas no contrato atual do InterpretationBundle; a UI pode unificá-los visualmente em uma camada de revisão, mas não no domínio.

### Pesquisa
`idle | researching | ready | insufficient_evidence | failed`

### Indicador
`cheap | fair | expensive | insufficient_evidence`

## 8. Conexões entre módulos

### 8.1 SourceInput → InterpreterClient

Entrada:
```text
RawDocument
+ SourceMetadata
+ DomainSchema
+ KnowledgeSnapshot
+ InterpretationPolicy
```

Saída:
```text
InterpretationBundle
```

### 8.2 InterpretationBundle → Analysis Workspace

A UI consome:
- run;
- records;
- ambiguities;
- invalid;
- warnings;
- metrics;
- trace.

A UI não consome Supabase/RPC diretamente.

### 8.3 OfferRecord → CalculatorClient

A seleção de oferta deve transportar identidade/campos já interpretados para evitar redigitação.

O usuário pode ajustar campos comerciais permitidos; a UI não altera a interpretação original silenciosamente.

### 8.4 OfferRecord → ResearchClient

Pesquisa recebe a identidade canônica da oferta, não texto arbitrário da tela.

Saída provisória:
- observações;
- fontes;
- estatísticas;
- qualidade da evidência;
- indicador.

### 8.5 Research → PriceIndicator

```text
observações válidas
+ estatísticas
+ preço analisado
+ política/versionamento
→ indicador
```

Sem evidência suficiente:
`insufficient_evidence`.

### 8.6 Resultado → HistoryClient

Reservado. Não implementar persistência real nesta trilha antes do gate correspondente.

## 9. Arquitetura da informação

Navegação Beta:

```text
Overview
Analisar
Calcular
Mercado
```

Preparados para depois:

```text
Histórico
Organização
Configurações
```

A navegação funcional original `VENDA | UPGRADE | REVERSO | OFERTA | CATÁLOGO` não deve ser copiada como arquitetura externa. Seus comportamentos úteis são redistribuídos nas novas superfícies.

## 10. Overview como tela calibradora

A Overview aprovada no Stitch é a entrada do sistema e a referência do Design System V0.

Ela deve resumir o produto sem duplicar workspaces.

Estrutura funcional:

```text
AppShell
├─ PrimaryNav
├─ Header
│  ├─ Overview
│  └─ Nova análise
├─ RecentAnalyses
├─ Opportunities
├─ PendingReview
└─ QuickActions
```

Princípios:
- desktop-first;
- premium claro;
- navy + azul como acentos funcionais;
- superfícies brancas;
- bordas suaves;
- sombras mínimas;
- densidade operacional;
- estados visíveis;
- evidência/confiança legíveis.

A Overview mostra estado; a operação detalhada acontece nos workspaces.

## 11. Componentes exigidos pelo sistema real

Base:
- `AppShell`;
- `PrimaryNav`;
- `Button`;
- `Input`;
- `Select`;
- `Badge`;
- `Card`;
- tabelas/listas.

Específicos do domínio:
- `SourceInput`;
- `ProcessingStatus`;
- `InterpretationSummary`;
- `OfferRow`;
- `AmbiguityPanel`;
- `EvidenceDrawer`;
- `PriceIndicator`;
- `ResearchStatus`;
- `EvidenceList`;
- `SourceDetails`;
- `CalculationSummary`;
- `InstallmentTable`.

O Design System V0 só deve crescer quando um componente corresponder a uma necessidade operacional real.

## 12. Fronteira frontend ↔ backend

Regra:

```text
Frontend
  ↓
Client/Adapter
  ↓
Service contract
  ↓
Core / backend
```

Proibido como arquitetura futura:
- frontend chamando tabela `calc_*` diretamente;
- componente conhecendo RPC;
- regra crítica no DOM;
- UI escolhendo tenant;
- UI promovendo ambiguidade para verdade;
- segredo no frontend.

## 13. Fronteiras de confiança

```text
USUÁRIO
  ↓  não confiável
FRONTEND
  ↓  input validado
API / SERVICE
  ↓  auth + autorização
DOMÍNIO / REGRA
  ↓
PERSISTÊNCIA
```

Para beta externa, autorização, organização/tenant e regra crítica devem ser server-side. A organização não deve ser aceita como verdade enviada pelo cliente.

## 14. O que a UI pode fazer

- iniciar análise;
- enviar documento;
- acompanhar estado;
- mostrar resumo;
- selecionar oferta válida;
- abrir trace/evidência;
- editar parâmetros comerciais permitidos;
- solicitar cálculo;
- solicitar pesquisa;
- exibir indicador;
- exibir insuficiência de evidência;
- navegar entre workspaces preservando contexto.

## 15. O que a UI não pode decidir

- verdade semântica da interpretação;
- promoção automática de ambiguidade;
- gravação de aprendizado;
- autorização;
- tenant;
- regra crítica de preço;
- qualidade de evidência;
- acesso cross-organization;
- versão de conhecimento usada pelo Core.

## 16. Dependências para integração real

### Interpreter
Integração real bloqueada até:
- Gate Interpreter Ready = PASS;
- regressão determinística verde;
- `silent_wrong_price = 0`;
- `silent_loss = 0` no corpus representativo.

### Calculator
Bloqueado até:
- fronteira Calc Service consumível;
- contrato de entrada/saída versionado;
- regra comercial fora do componente visual.

### Research + Price
Bloqueado até:
- Research Engine V0 com resposta estável;
- Price Indicator V0 com contrato estável;
- fonte/evidência/frescura representáveis.

### History/Auth/Organization
Bloqueado até fase correspondente do pipeline External Beta e testes de isolamento.

## 17. Primeira vertical slice recomendada

**Vertical Slice 01 — Analysis Workspace / Read-only Interpretation**

Escopo:

```text
SourceInput mock/fixture
→ ProcessingStatus
→ InterpretationSummary
→ OfferTable
→ AmbiguityPanel
→ EvidenceDrawer
```

Objetivo:
provar que o frontend entende integralmente o `InterpretationBundle` sem Supabase e sem write.

Não inclui:
- persistência;
- auth externa;
- pesquisa real;
- price indicator real;
- aprovação/learning write;
- deploy em produção.

Gate da Slice 01:
- todos os estados do contrato renderizam;
- interpreted e inferred são distinguíveis;
- ambiguities nunca aparecem como confirmadas;
- invalid é representável;
- trace abre por registro/campo;
- loading/empty/error estão definidos;
- mock pode ser trocado por `InterpreterClient` sem redesenhar os componentes;
- zero segredo;
- zero write;
- zero acesso direto a banco.

## 18. Ordem após Slice 01

```text
SLICE 01
Analysis / Interpretation read-only
        ↓
SLICE 02
Offer → Calculator
        ↓
SLICE 03
Offer → Market Research
        ↓
SLICE 04
Price Indicator + Evidence
        ↓
SLICE 05
Auth + Organization + History
        ↓
SLICE 06
External Beta End-to-End
```

Cada slice precisa fechar:
frontend + contrato + backend disponível + estados + segurança + teste.

## 19. Gate — System Map V0

Este mapa está pronto para congelamento quando:

- [x] operação atual foi inventariada;
- [x] entidades principais foram nomeadas;
- [x] estados foram mapeados;
- [x] conexões entre módulos foram definidas;
- [x] real vs preparado vs posterior está explícito;
- [x] Overview possui papel funcional;
- [x] fronteira frontend/backend está explícita;
- [x] primeira vertical slice foi derivada;
- [ ] contratos de tela derivados em documento próprio;
- [ ] Overview/Design System V0 auditados contra esses contratos.

## 20. Próximo passo

Criar `EXTERNAL_CALC_SCREEN_CONTRACTS_V0.md` e então auditar a Overview/Design System V0 contra esses contratos.

Somente depois disso iniciar implementação visual da Slice 01.
