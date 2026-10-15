# External Calc — Gate 1 / regressões sintéticas executadas (diagnóstico histórico)

**Data:** 2026-10-15. **Gate 1: IN_PROGRESS / comercial NO-GO**.

## Proveniência decisiva
Os 10 cenários foram executados **somente** contra cópia local do arquivo `pitwall--nucleo-main.zip`, snapshot **08/10/2026** (etiqueta SHA do ZIP `25f3d564b3ae84bc64a766931f823a50d744d32a`). NÃO são testes executados contra HEAD atual ou código pós-PR #176 (`683999c3...`). Portanto, **não afirmar regressões atuais**, nem abrir correção de código em função deste diagnóstico isolado.

Os 10 cenários originalmente propostos tinham placeholders `DEVICE X`/`IPAD X`, não reconhecíveis pelo parser; foram revisados para `iPhone 16 Pro`/`iPad Air 11 M4 128GB` e `Apple Pencil`/`AirPods`. Sem nomes reais, false negatives distorciam a análise. Os preços dos fixtures são **sintéticos**, não dados privados de fornecedores. Executados em modo buildQueue/partitionCandidates read-only; nenhuma chamada a RPC/C01, nenhum deploy.

## Resultados verificáveis na versão arquivada
- **PASS 5/10:** GEN-01 filho cor+preço (2 variantes corretas); GEN-02 preço→cor (1 associação correta); GEN-03 limite de cabeçalhos de capacidades (2 ofertas sem bleed); GEN-06 símbolo monetário sem valor não gerou oferta; GEN-09 isolamento de condição Lacrado/CPO (2 ofertas distintas).
- **FAIL 5/10:** GEN-04 Apple Pencil duplicado em blocos (0 candidatos, 3 ambiguidades); GEN-05 AirPods com preço adjacente isolado (0 candidatos, 1 ambiguidade); GEN-07 fornecedor ausente gerou 1 candidato selecionado para `auto` por `partitionCandidates` (verificar se a autoridade moderna aborta em entrada/batch); GEN-08 pontuação `💵. 6700` (0 candidatos, 1 ambiguidade); GEN-10 preço sintético R$415 preservado literalmente mas selecionado para `auto` (verificar política moderna de outlier antes de alegar falha atual).

## Limites importantes
- GEN-07 e GEN-10 validam política de aprovação proposta; o sistema moderno pode implementar o bloqueio em camada posterior não presente no snapshot. Essas falhas não provam promoção persistida.
- Não existe equivalência por produto contra a adjudicação humana das 62 linhas comerciais reais.
- 18 golden permanecem pendentes de replay no SHA atual.
- Não converter 5/10 em precisão estatística.
- A execução foi totalmente local, sem gravação em C01, catálogo, serviço ou frontend.

## Próxima ação no caminho crítico
1. Reexecutar **estes testes exatos e golden** no commit backend `683999c3...` ou HEAD atual, utilizando checkout íntegro com módulos shadow; preparar runner determinístico. 
2. Conferir `auto-promotion-authority` e barreiras de supplier/outlier na última versão **antes** de qualquer PR corretivo.
3. Adjudicar referência privada por campo e origem, incluindo 62 linhas; somente erros confirmados no SHA atual poderão gerar patches mínimos em classes genéricas.

Artefato privado local: `GATE1_HISTORICAL_EXECUTED_ASSERTIONS.json` (contém somente testes sintéticos e métricas; não foi enviado ao repo).
