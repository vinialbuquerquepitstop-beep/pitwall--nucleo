# EXTERNAL CALC — F1 controlled intake and source price coverage

**Data:** 22/10/2026. **Contexto:** usuário explicitamente pediu parar de repetir pacotes JWT/SQL e avançar na finalização funcional do produto.

## Decisão de escopo

O modo de importação V0 sob esta branch será **somente revisão humana**: nenhum candidato passa diretamente para oferta VALID/cotável. A indisponibilidade de holdout genuíno e benchmark DEV 3/33 impede generalização liberada. O comportamento anterior de `partitionCandidates` continua disponível apenas para avaliar causas/telemetria, mas a rota `processListIntakeCommand` **não chama mais** `extcalc_persist_auto_promoted_c01_v0`; persiste somente candidatos `REVIEW_REQUIRED`, incluindo os que a heurística antiga classificaria como elegíveis. `auto_promoted=0`, `review_required=candidates`.

Nenhuma alteração no Core Interpreter/C01–C05; nenhum cálculo no frontend. Nada foi mergeado, publicado ou instalado em produção.

## Implementado na branch backend
`feat/external-calc-f1-controlled-intake-20261022`:
- `ferramentas/external-calc-list-intake/v0/source-price-coverage-v0.js`: reconciliação explícita linha-fonte vs referência `review_evidence.field_sources.price` e texto original exato `source_lines.raw`. Aponta índices da fonte com sinal monetário não explicados por candidato. Falhas de indexação e múltiplos preços explícitos sinalizam revisão. Relatório contém hash/índice, não copia conteúdo do fornecedor.
- `ferramentas/external-calc-list-intake/v0/list-intake-api.js`: importação em modo fail-closed, sempre só grava candidatos para revisão, contabiliza linhas monetárias não cobertas, expõe `price_coverage`, `manual_recovery_required` e `review_mode=HUMAN_REVIEW_REQUIRED`. Mantém o vínculo da fonte e autorização via RPC existentes; não falsifica recuperação.
- `prova_source_price_coverage_v0.js` e `prova_controlled_intake_flow_v0.js`: unidades/regressão, incluindo fonte original com preço divergente, preço não coberto, preço múltiplo, ausência de prova e proibição de promoção.

## Implementado na branch frontend
`vinialbuquerquepitstop-beep/pitstop-calc:feat/external-calc-f1-intake-coverage-ui-20261022`:
- `frontend-next/lib/external-calc-adapter.ts`: valida contrato de review-only; falha com `UNSAFE_INTAKE_RESPONSE` se backend ainda retornar promoções automáticas ou resultados sem cobertura; não interpreta uma resposta legado como sucesso.
- `frontend-next/components/calculator-operational-workspace.tsx`: preserva layout e navegação aprovados; substitui rótulo enganoso 'lista processada' por 'interpretação preliminar · revisão obrigatória', explicita **zero ofertas liberadas**, exibe linhas com preço não cobertas ou múltiplos preços e impede alegar lista completa.
- Nenhuma alteração feita em produção, no design system global ou nas telas já aprovadas /revisao.

## Evidência e limitações
- Releitura das duas branches no GitHub: **14/14 controles estáticos PASS** (não execução E2E).
- Execução Node local de módulo de cobertura equivalente, casos unitários: `C01_CONTROLLED_PRICE_COVERAGE_V0=PASS` e `node --check` PASS. A cópia local usou o mesmo algoritmo com formatação condensada, não o blob exato publicado; não usar como prova de build do repositório inteiro.
- **Não foi executado** `prova_controlled_intake_flow_v0.js` contra o checkout completo nem `next build`/`tsc --noEmit`. Rede do contêiner não resolve `github.com`; repositórios privados foram alterados por conectores, não clonados. Não afirmar integração E2E ou Preview sem essas provas.
- Cobertura de linhas por expressão regular é **heurística, não adjudicação**. Um texto sem sinal `R$`/emoji não prova que todos os preços foram identificados; atributo `source_truth_verified=false`, `can_auto_promote=false` e `review_required=true` sempre.
- Ausência de item na interpretação **ainda não pode ser corrigida com criação manual segura**; a implementação por enquanto torna a perda explícita, mas a recuperação é um P0.
- `source_id` legado gerado a partir de hash na importação precisa de prova contra o store de fonte original do backend, especialmente no staging VS53L; não confundir relatório de importação com persistência aceita.
- Interface de revisão real está em outra branch `pitstop-calc:feat/external-calc-f1-real-review-pilot-20261022`, não integrada; VS53N é ledger audit-only, não promoção validada para cotação.
- O gate JWT A/B positivo, qualidade de intérprete e interoperabilidade C01→C05 seguem pendentes para release. **Não repetir o pacote JWT negativo por rotina**; a próxima fase de trabalho deve construir recuperação de ofertas ausentes/integração real.

## Ordem de convergência sem novos testes do usuário
1. Harmonizar frontend intake e frontend revisão real em uma branch única, com build/typecheck e sem trocar o design aprovado.
2. Fechar contrato server-side `Create Missing Candidate` com origem literal, autorização e guarda C01; nunca inserir oferta diretamente em `extcalc_offer_revision`.
3. Validar o fluxo real fonte→candidato→correção→cálculo/quote em Preview separado de produção. Se a origem não existir, retornar estado honesto.
4. Rodar benchmark DEV e holdout de verdade para avaliação automática, sem ativar promoção até provar.
5. Registrar `NO_GO` para produção enquanto faltarem positivos operacionais, revisão auditada, quarentena das 24 revisões suspeitas e consentimento de release.

**Gate:** F1_CONTROLLED_INTAKE=IMPLEMENTED_STATIC_PROVEN; F1_MISSING_LINE_DETECTION=IMPLEMENTED_UNIT_MIRROR_PASS; F1_BACKEND_E2E=NOT_RUN; F1_FRONTEND_BUILD=NOT_RUN; F1_OMITTED_ITEM_RECOVERY=BLOCKED; PRODUCT_CONTROLLED_V0=NO_GO; PRODUCTION=NO_GO.
