# EXTERNAL CALC — SCREEN CONTRACTS V0

Data: 18/09/2026
Base: `EXTERNAL_CALC_SYSTEM_MAP_V0.md`
Status: contrato funcional de interface antes da implementação real

## 1. Regra

Uma tela existe para representar uma operação real.

Para cada tela definir:
- objetivo;
- entidade/estado;
- dados de entrada;
- fonte dos dados;
- ações;
- mutações;
- estados visuais;
- permissões;
- logs/telemetria;
- transição seguinte.

O Stitch define linguagem visual. Este documento define significado operacional.

## 2. Overview

### Objetivo
Dar contexto imediato da operação e acesso aos três workspaces sem duplicar suas funções.

### Entidades
- Analysis resumida;
- Offer/Opportunity resumida;
- PendingReview;
- QuickAction.

### Dados
Na fase mock:
- análises recentes sintéticas;
- oportunidades sintéticas;
- pendências sintéticas;
- ações rápidas.

Na integração real, nenhuma métrica pode ser inventada quando a fonte ainda não existir.

### Ações
- Nova análise;
- abrir análise recente;
- abrir pendência;
- ir para Calcular;
- ir para Mercado.

### Estados
- loading;
- empty;
- ready;
- partial;
- error.

### Regra
Card de Overview é resumo/navegação, não lugar de regra de negócio.

## 3. Analisar — Analysis Workspace

### Objetivo
Receber uma lista, representar a interpretação e permitir revisão auditável.

### Entidades
- RawDocument;
- InterpretationRun;
- OfferRecord;
- Ambiguity;
- InvalidRecord;
- Evidence/Trace.

### Dados
Fonte atual da preparação:
`external-calc-workspace-v0.json`.

Fonte futura:
`InterpreterClient -> InterpretationBundle/v1`.

### Componentes
- SourceInput;
- ProcessingStatus;
- InterpretationSummary;
- OfferTable;
- AmbiguityPanel;
- InvalidPanel;
- EvidenceDrawer.

### Ações
- colar/enviar;
- iniciar interpretação;
- selecionar oferta;
- filtrar por estado;
- abrir evidência;
- encaminhar oferta válida para Calcular.

### Mutações
Slice 01: nenhuma mutação operacional persistente.

### Estados
Documento:
`idle | uploading | queued | interpreting | ready | failed`.

Registro:
`interpreted | inferred`.

Revisão:
`ambiguity | invalid`.

### Gate visual
- inferred não pode parecer igual a interpreted;
- ambiguity deve pedir atenção sem parecer erro fatal;
- invalid não deve entrar no caminho de cálculo;
- EvidenceDrawer deve preservar source/rule/derived_from quando existirem.

## 4. Calcular — Calculator Workspace

### Objetivo
Transformar uma oferta selecionada em cenários de preço sem redigitação desnecessária.

### Entidades
- OfferRecord;
- CalculationInput;
- CalculationResult;
- InstallmentScenario;
- UpgradeScenario;
- ReverseCalculation.

### Dados
Hoje: comportamento real existente na calculadora legada.
Preparação: mock versionado.
Futuro: `CalculatorClient`.

### Entrada automática
Quando aberta a partir de Analisar:
- modelo;
- condição;
- cor;
- fornecedor;
- custo/preço de origem;
- record_id/run_id quando aplicável.

### Entrada editável
Somente parâmetros comerciais explicitamente permitidos pelo contrato.

### Componentes
- OfferSelector;
- CostEditor;
- MarginEditor;
- FreightControl;
- CalculationSummary;
- InstallmentTable;
- UpgradeCalculator;
- ReverseCalculator.

### Ações
- alterar parâmetro permitido;
- recalcular;
- comparar cenários;
- encaminhar oferta para Mercado.

### Regra
O componente não implementa regra crítica de cálculo. Ele apresenta input/output do serviço.

## 5. Mercado — Market Workspace

### Objetivo
Mostrar o que foi observado externamente e sustentar um indicador de preço com evidência explícita.

### Entidades
- MarketResearch;
- MarketObservation;
- MarketStatistics;
- PriceIndicator;
- EvidenceSource.

### Dados
Preparação: mock.
Futuro: `ResearchClient`.

### Componentes
- ResearchStatus;
- MarketSummary;
- PriceIndicator;
- EvidenceList;
- SourceDetails.

### Ações
- iniciar/atualizar pesquisa quando autorizado;
- abrir fonte;
- inspecionar horário/data;
- comparar preço analisado com referência.

### Estados
Pesquisa:
`idle | researching | ready | insufficient_evidence | failed`.

Indicador:
`cheap | fair | expensive | insufficient_evidence`.

### Regra
Sem evidência suficiente não existe classificação de preço.

## 6. Evidence Drawer

Componente transversal.

### Objetivo
Responder “por que o sistema mostrou isso?”.

### Pode exibir
- raw/source;
- linha/origem;
- regra;
- chosen;
- derived_from;
- alternativas;
- score como score, não probabilidade;
- versão do motor/schema/knowledge quando relevante.

### Não pode
- ocultar inferência;
- converter score em certeza;
- editar o Core diretamente;
- aplicar learning proposal automaticamente.

## 7. Histórico — posterior

Reservar rota/componente, mas não habilitar no primeiro corte.

Quando existir deve armazenar/recuperar Analysis sem misturar organizações e sem depender de estado local do navegador como fonte da verdade.

## 8. Organização e Configurações — posterior

Devem nascer junto de:
- Auth;
- tenant isolation;
- autorização server-side;
- audit log.

Não criar apenas como telas decorativas antes da camada real existir.

## 9. Contrato de navegação

```text
OVERVIEW
  ├→ NOVA ANÁLISE
  │     ↓
  │   ANALISAR
  │     ↓ oferta válida
  │   CALCULAR
  │     ↓ identidade da oferta
  │   MERCADO
  │     ↓
  │   RESULTADO/EVIDÊNCIA
  │
  ├→ análise recente (posterior: HistoryClient)
  ├→ pendência
  └→ quick action
```

A navegação deve preservar contexto da oferta selecionada entre Analisar, Calcular e Mercado.

## 10. Contrato do AppShell

### Sidebar / PrimaryNav
Ativos:
- Overview;
- Analisar;
- Calcular;
- Mercado.

Posteriores:
- Histórico;
- Organização;
- Configurações.

### Header
- título da superfície;
- contexto mínimo;
- CTA primário quando existir;
- na Overview: `Nova análise`.

### Regra
AppShell não conhece lógica de domínio; apenas navegação, contexto e composição.

## 11. Estados globais obrigatórios

Toda superfície operacional deve possuir, quando aplicável:
- loading;
- empty;
- partial;
- error;
- retry;
- permission denied;
- stale/refresh quando dados externos tiverem frescura relevante.

Nenhum erro técnico bruto deve ser a experiência final.

## 12. Matriz tela → cliente

| Tela | Cliente/fonte | Estado atual |
|---|---|---|
| Overview | agregador futuro + mocks | PREPARADO |
| Analisar | InterpreterClient | contrato real / integração bloqueada pelo gate |
| Calcular | CalculatorClient | PREPARADO |
| Mercado | ResearchClient | PREPARADO |
| Histórico | HistoryClient | POSTERIOR |
| Organização | Auth/Org services | POSTERIOR |

## 13. Auditoria do Design System V0

O Design System V0 deve conseguir representar sem improviso:

- interpreted;
- inferred;
- ambiguous;
- invalid;
- processing;
- success;
- failed;
- insufficient evidence;
- cheap;
- fair;
- expensive;
- evidence/source;
- loading;
- empty;
- partial.

Componentes esperados:
- Button;
- Input;
- Select;
- Badge;
- Card;
- table/list;
- OfferRow;
- ProcessingStatus;
- AmbiguityPanel;
- EvidenceDrawer;
- PriceIndicator;
- ResearchStatus.

Se faltar um componente, adicionar por necessidade operacional. Não criar variação apenas decorativa.

## 14. Gate — Screen Contracts V0

- [x] Overview possui objetivo e limites;
- [x] Analisar possui entidade, dados, ações e estados;
- [x] Calcular possui fronteira de input/output;
- [x] Mercado possui evidência e insuficiência explícitas;
- [x] navegação preserva contexto;
- [x] telas posteriores estão separadas do Beta;
- [x] fronteiras de segurança estão preservadas;
- [ ] auditar Overview Stitch contra o contrato;
- [ ] auditar Design System V0 contra todos os estados;
- [ ] congelar primeira vertical slice.

## 15. Próxima execução

Fazer **UI Contract Audit V0**:

1. pegar a Overview aprovada no Stitch;
2. mapear cada card/ação/estado a este documento;
3. remover qualquer widget sem função operacional;
4. identificar estados/componentes ausentes no Design System V0;
5. congelar a referência visual;
6. iniciar **Vertical Slice 01 — Analysis Workspace / Read-only Interpretation**.
