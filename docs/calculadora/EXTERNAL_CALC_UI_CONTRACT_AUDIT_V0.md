# EXTERNAL CALC — UI CONTRACT AUDIT V0

Data: 18/09/2026
Base:
- `EXTERNAL_CALC_SYSTEM_MAP_V0.md`
- `EXTERNAL_CALC_SCREEN_CONTRACTS_V0.md`
- Overview aprovada no Google Stitch
- External Calc Design System V0

Status: PASS CONDICIONAL para congelar arquitetura visual e iniciar Slice 01 isolada

## 1. Escopo

Auditar se a Overview e a linguagem do Design System V0 representam o sistema que será conectado depois, sem criar semântica falsa no frontend.

Esta auditoria não valida pixel-perfect nem tokens linha a linha porque o artefato visual/arquivo do Design System V0 ainda não está versionado nesta branch. Ela valida a estrutura e os componentes já definidos para a Overview.

## 2. Overview — correspondência funcional

### AppShell
**PASS**

O shell é coerente com a arquitetura do produto e deve permanecer neutro em relação ao domínio.

### Navegação Analisar / Calcular / Mercado
**PASS**

Corresponde diretamente aos três workspaces canônicos.

### Header “Overview” + “Nova análise”
**PASS**

“Nova análise” é o CTA principal correto para iniciar o fluxo canônico.

### Análises recentes
**PASS COMO MOCK / POSTERIOR COMO DADO REAL**

A superfície faz sentido para o produto, mas dados reais dependem de HistoryClient/persistência. Até esse gate existir:
- usar mock/fixture;
- não sugerir histórico persistido;
- não criar dependência de banco apenas para alimentar o card.

### Oportunidades
**PASS CONCEITUAL / FONTE A DEFINIR**

Pode representar ofertas cujo custo esteja favorável em relação ao mercado, mas só vira informação real após Research Engine + Price Indicator.

Antes disso:
- usar mock;
- não calcular oportunidade no componente;
- não chamar um sinal de “oportunidade” sem evidência suficiente.

### Pendências
**PASS**

É semanticamente suportado por:
- ambiguities;
- invalid;
- warnings.

No futuro agregador de Overview, a origem da pendência deve ser rastreável até Analysis/InterpretationRun.

### Ações rápidas
**PASS**

Devem apenas navegar/iniciar operações existentes:
- Nova análise;
- Calcular;
- Mercado;
- abrir pendência quando houver contexto.

Não criar ações sem fluxo real correspondente.

## 3. Estados do Interpreter

### interpreted
**PASS**

Deve possuir apresentação de confirmação normal.

### inferred
**PASS COM DISTINÇÃO OBRIGATÓRIA**

Não pode parecer equivalente a certeza direta. Badge/estado visual distinto.

### ambiguous
**PASS / COMPONENTE OBRIGATÓRIO**

Deve existir como pendência explícita, nunca convertido em registro confirmado.

### invalid
**PASS / COMPONENTE OBRIGATÓRIO**

Precisa de representação própria e não pode seguir para cálculo.

## 4. Evidência e confiança

**PASS**

A direção da Overview/DS V0 já prevê evidência/confiança. O contrato real exige que isso não seja decorativo.

O `EvidenceDrawer` deve conseguir exibir:
- sources;
- rules;
- derived_from;
- alternatives;
- score;
- versões de engine/schema/knowledge quando necessário.

Regra:
score permanece score; não renomear como probabilidade sem calibração.

## 5. Price Indicator

**PASS ESTRUTURAL / BACKEND AINDA PREPARADO**

O DS deve representar:
- cheap;
- fair;
- expensive;
- insufficient_evidence.

Obrigatório:
`insufficient_evidence` possuir tratamento de primeira classe.

Não permitir:
`sem dados → fair`.

## 6. Cobertura do Design System V0

Com base no conjunto já definido, a fundação é adequada se contiver:

Base:
- Button;
- Input;
- Select;
- Badge;
- Card;
- table/list.

Domínio:
- OfferRow;
- ProcessingStatus;
- AmbiguityPanel;
- EvidenceDrawer;
- PriceIndicator;
- ResearchStatus.

Estados:
- loading;
- empty;
- partial;
- error;
- interpreted;
- inferred;
- ambiguous;
- invalid;
- insufficient evidence.

### Ajuste obrigatório antes do freeze
Confirmar que o DS possui tratamento explícito para:
1. invalid;
2. insufficient evidence;
3. partial;
4. failed/retry;
5. stale/freshness para pesquisa futura.

Se não houver, adicionar somente essas variantes necessárias.

## 7. Elementos que NÃO devem ganhar semântica falsa

Até os serviços correspondentes existirem:

| Elemento | Regra |
|---|---|
| Recent analyses | mock, sem persistência implícita |
| Opportunities | mock até Research + Price |
| Market freshness | não inventar timestamp real |
| Organization switcher | não ativar sem tenant real |
| User permissions | não simular autorização como segurança |
| History | oculto/desabilitado |
| Learning/aprovação | sem write automático |

## 8. Decisão sobre a Overview

A Overview pode ser congelada como **referência visual calibradora**, com estas regras:

1. shell, hierarquia, grid, densidade e linguagem visual podem ser referência;
2. cards são superfícies de leitura/navegação;
3. nenhuma métrica mock vira verdade operacional;
4. estados do Core prevalecem sobre simplificações visuais;
5. Research/Price permanecem mocks até seus gates;
6. Histórico/Organização não são ativados antecipadamente.

## 9. Primeira vertical slice

### Nome
`SLICE 01 — ANALYSIS WORKSPACE / READ-ONLY INTERPRETATION`

### Objetivo
Implementar a primeira operação completa de frontend contra contrato versionado, ainda sem backend real/write.

### Fluxo
```text
SourceInput
  ↓
ProcessingStatus
  ↓
InterpretationSummary
  ↓
OfferTable
  ├→ OfferRow interpreted
  └→ OfferRow inferred
  ↓
AmbiguityPanel / InvalidPanel
  ↓
EvidenceDrawer
```

### Fonte
`docs/calculadora/mocks/external-calc-workspace-v0.json`

### Contrato futuro
`InterpretationBundle/v1`

### Proibições
- Supabase direto;
- write;
- auth fake usada como segurança;
- pesquisa real;
- price indicator real;
- histórico real;
- aprendizagem automática.

## 10. Gate da Slice 01

Antes de chamar a Slice 01 de concluída:

- [ ] renderizar documento idle;
- [ ] renderizar processing;
- [ ] renderizar ready;
- [ ] renderizar failed + retry;
- [ ] renderizar interpreted;
- [ ] renderizar inferred distinto;
- [ ] renderizar ambiguities;
- [ ] renderizar invalid;
- [ ] abrir trace/evidência;
- [ ] suportar empty;
- [ ] suportar partial;
- [ ] navegação para Calcular preserva offer context no estado local/mock;
- [ ] zero write;
- [ ] zero segredo;
- [ ] zero banco;
- [ ] gate automático verde;
- [ ] comparação visual com Overview/DS V0.

## 11. Resultado da auditoria

```text
SYSTEM MAP                    PASS
SCREEN CONTRACTS              PASS
OVERVIEW STRUCTURE            PASS
OVERVIEW DATA SEMANTICS       PASS WITH MOCK BOUNDARIES
DESIGN SYSTEM COVERAGE        PASS WITH STATE CHECK
REAL BACKEND INTEGRATION      NOT AUTHORIZED YET
SLICE 01 ISOLATED FRONTEND    AUTHORIZED
```

## 12. Próximo passo

Implementar a Slice 01 no protótipo/frontend isolado usando somente mock + contrato versionado.

Depois:
```text
implementação
→ gate automático
→ revisão visual contra Stitch
→ revisão operacional
→ consolidação dos componentes
→ Slice 02
```
