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

O último export escolhido pelo usuário deve ser tratado como **referência visual global**, não como contrato de uma página específica.

Embora o mock exibido no render contenha conteúdo semelhante a uma tela de análise, isso é apenas o conteúdo usado pela referência. A extração canônica deve separar:

```text
VOCABULÁRIO VISUAL GLOBAL
≠
SEMÂNTICA DA TELA MOSTRADA NO MOCK
```

O arquivo `EXTERNAL_CALC_STITCH_VISUAL_CONTRACT_V1.json` registra essa separação explicitamente.

### O que a referência define visualmente

- direção dark technical command center;
- canvas em torno de `#080b11`;
- sidebar/header em torno de `#0d121d`, com 240px no desktop;
- painéis operacionais escuros translúcidos;
- Inter como família principal observada no render;
- frame de página com 32px;
- grid de 12 colunas com gaps de 24px;
- azul para ação/seleção/informação;
- emerald para sucesso/confirmação;
- amber para revisão/alerta;
- rose/red para erro/inválido;
- metadados técnicos em mono;
- glow restrito a estados e ações de maior ênfase;
- tabelas, painéis técnicos e blocos contextuais como padrões reutilizáveis.

### Regra de escopo

A referência **não autoriza** copiar como padrão global:

- entidades, contagens ou textos do mock;
- o fluxo Entrada → Interpretação → Revisão;
- os labels Slice 02 / Slice 03;
- os spans 7/5 e 8/4 como regra universal;
- o seletor de estado de teste como componente de produto;
- qualquer semântica específica da tela mostrada.

Esses elementos só entram numa página futura quando o `PAGE_SPEC.json` daquela página exigir.

### Conflito no pacote

O `DESIGN.md` do pacote descreve um sistema claro chamado COMMERCIAL AI — Intelligence OS, com Geist + JetBrains Mono. Isso conflita com o render e o HTML dark escolhidos como referência.

Pelo método da Tree, a precedência adotada é:

```text
RENDER APROVADO
→ HTML RENDERIZADO
→ TOKENS NORMALIZADOS
→ METADATA NÃO CONFLITANTE
```

Portanto, o `DESIGN.md` não substitui o visual dark onde houver conflito.

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

Antes de declarar esta referência como Design System canônico:

1. aceitar formalmente esta referência como `Golden Visual Reference`;
2. normalizar os tokens e padrões do JSON;
3. separar primitives globais de padrões opcionais de página;
4. produzir o Design System canônico;
5. criar cada nova tela a partir de `PAGE_SPEC.json`;
6. comparar a implementação contra esta referência em proporção, densidade, tipografia, superfícies, estados e anatomia de componentes;
7. somente então executar `DESIGN CANON FREEZE`.

Não é necessário transformar a tela mostrada no mock na tela calibradora do produto. A referência pode funcionar apenas como fonte de linguagem visual global.
