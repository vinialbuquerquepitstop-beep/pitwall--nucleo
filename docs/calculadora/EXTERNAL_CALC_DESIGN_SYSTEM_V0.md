# EXTERNAL CALC — DESIGN SYSTEM V0

Data: 18/09/2026  
Status: fundação visual executável derivada da Overview + Slice 01  
Branch: `feat/external-calc-slice-01-analysis-v0`

## 1. Papel

Este documento transforma a direção visual aprovada em regras reutilizáveis para o frontend do External Calc.

A ordem de autoridade é:

```text
OPERAÇÃO / CONTRATOS DO PRODUTO
        ↓
OVERVIEW APROVADA NO STITCH
        ↓
DESIGN SYSTEM V0
        ↓
COMPONENTES / TOKENS NO GITHUB
        ↓
TELAS
```

O Stitch continua referência visual. Ele não redefine entidade, fluxo, regra, permissão ou estado operacional.

Depois de implementado e auditado, GitHub + tokens + componentes + documentação passam a ser a fonte de verdade executável.

## 2. Direção

O External Calc deve parecer:

- produto operacional premium;
- claro, calmo e preciso;
- desktop-first;
- denso o suficiente para operação real;
- explicável;
- confiável;
- mais próximo de uma ferramenta profissional do que de um dashboard promocional.

Evitar:

- card soup;
- dashboard SaaS genérico;
- gradientes decorativos;
- glassmorphism;
- neon/glow;
- microtexto em excesso;
- badges decorativos;
- containers para tudo;
- azul usado sem função;
- score/confiança apresentados como certeza.

Princípio:

> less containers, more structure.

## 3. Hierarquia visual

A hierarquia canônica da Slice 01 é:

```text
AppShell
  ↓
PageHeader
  ↓
Processing Status
  ↓
Source Workbench + Summary Rail
  ↓
Offer Table dominante + Review Rail
  ↓
Evidence Drawer
```

A tabela de ofertas é o elemento operacional dominante depois que a interpretação termina.

Pendências e inválidos ficam em rail contextual, não competindo visualmente com a tabela.

## 4. Layout V0

### Shell

- sidebar persistente no desktop;
- conteúdo amplo;
- largura máxima aproximada: 1500px;
- respiro horizontal de 32–36px;
- divisores usados para estruturar mais do que cards.

### Sidebar

Implementação V0:
- largura: 232px;
- fundo branco;
- borda direita sutil;
- item ativo com fundo azul muito claro;
- itens futuros desabilitados explicitamente.

### Page frame

- fundo geral off-white;
- conteúdo principal sem “card externo”;
- sessões definidas por alinhamento, espaço e divisores.

### Grid principal

```text
Source / Workbench     ~ 70%
Summary Rail           ~ 30%

Offer Table            flexível
Review Rail            310px
```

Em larguras menores, rails descem para baixo do conteúdo principal.

## 5. Tokens V0

Estes valores são tokens de implementação V0 e devem permanecer centralizados. Eles ainda podem ser refinados em auditoria pixel a pixel com a Overview.

### Superfícies

```css
--bg: #F7F8FA;
--surface: #FFFFFF;
--surface-subtle: #F3F5F8;
```

### Texto

```css
--text: #08142D;
--muted: #5F6D83;
--muted-2: #8994A6;
```

### Marca / ação

```css
--blue: #1D71F0;
--blue-strong: #145CC8;
--blue-soft: #EEF5FF;
```

Azul é funcional:
- seleção;
- CTA;
- processamento;
- navegação ativa;
- evidência/ação clicável.

Nunca usar como decoração generalizada.

### Linhas

```css
--line: #E1E6EE;
--line-strong: #CFD7E4;
```

### Semânticos

Success:
```css
#197642
#EDF8F1
#C5E7D1
```

Warning / ambiguity:
```css
#86600B
#FFF8E8
#EAD8A9
```

Error / invalid:
```css
#A52A42
#FFF2F4
#EFC7CF
```

## 6. Geometria

V0:

- radius principal: 14px;
- controles: 9–12px;
- badge: pill;
- sombra: mínima e somente quando ajuda hierarquia;
- preferir borda/divisor a sombra;
- evitar containers aninhados.

## 7. Tipografia

Direção:
- sans-serif moderna;
- títulos compactos;
- números com tabular numerals;
- mono somente para IDs, hashes, versões, run IDs e detalhes técnicos.

Nunca usar mono como linguagem principal de score, preço ou headline.

Hierarquia:

```text
eyebrow
page title
section title
body / operational text
technical metadata
```

## 8. Primitives V0

Primitives que devem ser reutilizadas:

- Button / Primary;
- Button / Secondary;
- IconButton;
- Input;
- Textarea;
- Select;
- Badge / Status;
- Segmented Control;
- Divider;
- Empty State;
- Metadata Chip.

## 9. Componentes de domínio V0

### ProcessingStatus

Representa:

`idle | uploading | queued | interpreting | ready | failed`

Nunca esconder falha como ausência de resultado.

### InterpretationSummary

Mostra:
- ofertas;
- interpretadas;
- inferidas;
- para revisar;
- run metadata.

### OfferRow

Representa um `OfferRecord`.

Estados:
- interpreted;
- inferred.

A diferença entre eles precisa ser visualmente legível sem transformar inferência em erro.

### AmbiguityPanel

Representa `Ambiguity`.

Cor de warning, não de erro fatal.

### InvalidPanel

Representa `InvalidRecord`.

Não entra no caminho de cálculo.

### EvidenceDrawer

Componente transversal para explicar decisões.

Pode mostrar:
- chosen;
- source;
- rule;
- derived_from;
- alternatives;
- score;
- run_id;
- engine/schema/knowledge;
- document hash.

Score permanece score.

### PriceIndicator

Reservado para Slice futura.

Estados:
- cheap;
- fair;
- expensive;
- insufficient_evidence.

`insufficient_evidence` é estado de primeira classe.

## 10. Estados globais

Toda superfície deve prever quando aplicável:

- loading;
- empty;
- partial;
- error;
- retry;
- permission denied;
- stale/freshness;
- success.

Slice 01 cobre:

```text
idle
processing
ready
failed
empty
partial
interpreted
inferred
ambiguous
invalid
```

## 11. Regras de composição

1. Um elemento protagonista por zona.
2. Não envolver cada informação em card.
3. Preferir rail contextual para informação secundária.
4. Tabelas/listas dominam operações densas.
5. Métrica só existe quando possui fonte real ou está explicitamente marcada como mock.
6. Status semântico deve ser reconhecível por texto + forma, não apenas cor.
7. Ações futuras ficam desabilitadas, não simuladas.
8. Evidência deve estar a um clique do resultado que ela explica.

## 12. Segurança na UI

A UI é ambiente não confiável.

Proibido:
- secret;
- service role;
- regra crítica de autorização;
- tenant vindo do cliente como fonte da verdade;
- chamada direta a tabela operacional;
- ambiguidade promovida automaticamente;
- learning write automático.

A Slice 01 continua:
- zero banco;
- zero write;
- zero fetch;
- zero Supabase;
- mock/fixture apenas.

## 13. Dev-only

O seletor de cenários da Slice 01 é ferramenta de desenvolvimento.

Ele deve:
- existir no protótipo;
- cobrir estados;
- ser removido/ocultado em versão de usuário externo.

Não faz parte do produto final.

## 14. Golden Reference V0

A fundação visual atual é composta por:

1. Overview Stitch aprovada — referência de linguagem;
2. Slice 01 — primeira aplicação operacional do sistema;
3. este documento — regras extraídas;
4. tokens CSS e componentes do repositório.

A Slice 01 não substitui a Overview como referência geral de shell; ela valida como a linguagem funciona em um workspace real.

## 15. Gate da fundação

Design System V0 pode ser considerado utilizável quando:

- [x] shell consistente;
- [x] hierarquia de página definida;
- [x] tokens centralizados;
- [x] azul funcional;
- [x] estados semânticos definidos;
- [x] tabela/lista como padrão operacional;
- [x] rail contextual definido;
- [x] EvidenceDrawer definido;
- [x] loading/empty/partial/error representáveis;
- [x] Slice 01 implementada;
- [x] gate automatizado da Slice 01 verde;
- [ ] revisão visual humana em preview;
- [ ] normalização final após essa revisão.

## 16. Próximo passo

Abrir a Slice 01 em preview e executar revisão visual/operacional:

```text
proporção
padding
gaps
densidade
alinhamento
tipografia
bordas
contraste
legibilidade
status
evidência
responsividade básica
```

Após aprovação:

```text
DESIGN SYSTEM V0
→ FOUNDATION FREEZE V0
→ consolidar componentes
→ aguardar/consumir contrato real da próxima Slice
```
