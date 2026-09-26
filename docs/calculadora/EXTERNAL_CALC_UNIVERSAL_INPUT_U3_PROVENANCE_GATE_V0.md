# EXTERNAL CALC — UNIVERSAL INPUT U3 PROVENANCE GATE V0

Data: 2026-09-26
Status: IMPLEMENTATION CANDIDATE
Origem: Chat B / Guia Mestre de Finalização / Universal Input Master V1

## Objetivo

Provar a exigência canônica do Gate U3:

> Preço e campos críticos devem voltar à origem.

U3 não muda a semântica do Interpreter. Ele valida a cadeia de rastreabilidade existente entre:

```text
Source
→ CanonicalDocument
→ bridge U2
→ Interpreter Core
→ record.trace.sources[]
→ CanonicalDocument.block.provenance.source_ref
```

## Formatos semanticamente certificados neste gate

- TXT — incluído;
- CSV — incluído;
- XLSX — NÃO incluído na prova semântica U3 enquanto a projeção para o Core continuar fail-closed em U2.

O PASS de U3 não autoriza ativação semântica XLSX.

## Campos críticos V0

Quando presentes no record interpretado:

- model;
- capacity_gb;
- condition;
- color;
- price.

Todo campo crítico presente precisa possuir trace com ao menos uma linha física resolvível no CanonicalDocument.

Preço é P0 e nunca pode existir sem origem resolvida.

## Fail-closed

O gate reprova quando:

- campo crítico presente não possui trace;
- trace não possui sources;
- source line é inválida;
- source line não resolve para block canônico;
- source_ref não possui range físico suportado.

## Invariantes

- zero alteração em Interpreter Core;
- zero alteração C01–C05;
- zero alteração de preço;
- zero inferência adicional;
- zero runtime/API/banco/frontend;
- nenhuma promoção XLSX implícita.

## Critério de PASS

```text
U2 = green
+
critical field provenance = complete
+
price provenance = complete
+
fail-closed negative proof = green
+
Interpreter frozen regression = green
+
Proof Governance = green
```

Saída esperada:

```text
EXTERNAL_CALC_UNIVERSAL_INPUT_U3=PASS ... unresolved_critical_provenance=0
```

## Próximo gate

Após merge e CI verde:

```text
B8 / U4 — Unknown Supplier
```

Usar fornecedor/formato real não usado no desenvolvimento e medir recognition, Core rate, Review rate, unresolved e wrong price.
