# TREE PAGE FIDELITY METHOD V1

## Objetivo

Transformar o mecanismo que produziu fidelidade visual no Tree em um processo repetível para novas páginas, sem permitir que a ferramenta visual redefina produto, fluxo, regra ou segurança.

## Regra central

```text
CONTRATO SEMÂNTICO DA PÁGINA
        ↓
DESIGN SYSTEM + GOLDEN REFERENCE
        ↓
PAGE SPEC
        ↓
IMPLEMENTAÇÃO
        ↓
AUDITORIA DE FIDELIDADE
        ↓
SLICE GATE REAL
        ↓
CONSOLIDAÇÃO
        ↓
PRÓXIMA PÁGINA
```

A fidelidade do Tree nasceu de redução progressiva de liberdade. Primeiro a operação e a semântica foram estabilizadas. Depois uma tela-mãe foi iterada no Stitch. Só após aprovação foram extraídos tokens, componentes, shell e page patterns. A implementação real foi então comparada sistematicamente com a referência.

## Aplicação ao External Calc

O novo export do Stitch deve ser tratado como visual canon candidate. Ele altera a direção visual para dark-first e define com clareza shell, densidade e composição da página Analyze. Ele não substitui os contratos já definidos do External Calc.

### O que o export define visualmente

- canvas `#0b0f17`;
- sidebar `#111827` com 240px;
- panel `#161f2e`;
- Inter 400/500/600/700;
- page frame de 32px e max-width de 1280px;
- top grid 7/5;
- bottom grid 8/4;
- azul = ação/seleção/inferência;
- emerald = pronto/interpretado;
- amber = ambiguidade;
- tabela como protagonista operacional;
- status global sticky no topo;
- metadados técnicos em mono.

### O que o export NÃO autoriza remover

O export não mostra `InvalidPanel`, `EvidenceDrawer`, `idle`, `partial`, `empty` e a composição completa de `failed/retry`. Esses requisitos continuam existindo porque vêm do contrato do produto. A próxima iteração visual deve expressá-los usando a mesma linguagem, não apagá-los para igualar a screenshot.

## Pipeline por página

### 0 — Semantic Precondition
Antes de qualquer prompt visual, fechar purpose, owner entity, supporting entities, ações, estados, regras, permissões e transições.

**Gate:** o Stitch não recebe uma página apenas pelo nome.

### 1 — Escolher o archetype
Toda nova página precisa declarar se é workspace, command center, list, detail, flow step etc. Primeiro tenta reutilizar archetype existente.

### 2 — Compor com o sistema existente
A página nasce com AppShell, densidade, tipografia, superfícies, grids, primitives e domain components existentes.

**Regra:** `nova página != novo design system`.

### 3 — Gerar/iterar visual somente onde há decisão aberta
O Stitch recebe o contrato funcional e as restrições do Design System. A ferramenta pode explorar composição; não pode redefinir semântica.

### 4 — Extrair JSON da referência aprovada
Extrair foundations, shell, layout geometry, component anatomy, semantic states, page archetype, responsive behavior e gaps entre visual e contrato do produto.

### 5 — Normalizar
Não transportar classes/hex one-off cegamente. Valores recorrentes viram tokens semânticos. Padrões recorrentes viram primitives/domain components. Exceções permanecem locais e justificadas.

### 6 — Criar PAGE_SPEC.json
A Page Spec faz a ponte entre produto e design. Ela diz exatamente qual componente mostra qual entidade, quais ações existem e quais estados precisam existir.

### 7 — Implementar sem reinvenção
A implementação deve reutilizar o sistema. Um novo componente primitivo exige evidência de que os existentes não representam a necessidade.

### 8 — Auditoria de fidelidade
Comparar referência e implementação em:

```text
proporção
padding
gaps
altura/largura
line-height
peso tipográfico
densidade
bordas
alinhamento
contraste
anatomia de componente
tratamento semântico de estados
responsividade
```

Não usar “parece parecido” como gate.

### 9 — Gate real da Slice
Além do visual, a página só consolida quando funcional, dados, semântica, permissões, isolamento, auditabilidade, estados, design, qualidade e operação estão corretos.

### 10 — Consolidar antes da próxima página
Se a página revelou um padrão legítimo novo, ele sobe para o Design System. Se não, fica local. A próxima página começa do sistema consolidado, não de outro design independente.

## Regra de mudança do Design System

```text
necessidade operacional real
        ↓
padrão atual não resolve
        ↓
candidato visual
        ↓
auditoria contra canon
        ↓
implementação
        ↓
gate da página
        ↓
promoção para Design System
```

Isso evita dois extremos: Design System rígido que não evolui e Design System frouxo que é redesenhado em cada tela.

## Artefatos

- `EXTERNAL_CALC_STITCH_VISUAL_CONTRACT_V1.json`
- `TREE_PAGE_FIDELITY_METHOD_V1.json`
- `TREE_PAGE_SPEC_TEMPLATE_V1.json`

## Próximo gate recomendado

Antes de declarar este novo dark-first como Design System canônico:

1. completar no Stitch os estados e componentes obrigatórios ausentes;
2. aprovar visualmente a Analyze como tela calibradora junto da Overview;
3. extrair novamente o JSON final;
4. normalizar tokens/componentes;
5. aplicar na implementação;
6. comparar render vs referência;
7. somente então executar `DESIGN CANON FREEZE`.
