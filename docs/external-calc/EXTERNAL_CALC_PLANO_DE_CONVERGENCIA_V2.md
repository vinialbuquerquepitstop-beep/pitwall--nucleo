> **Contexto histórico:** este é o plano V2 (15/10). A nova decisão de 20/10, iniciada como proposta versionada, está em `EXTERNAL_CALC_EXECUCAO_LINEAR_V3_GENERALIZACAO.md`. Para o Gate de interpretação, **V3 prevalece após integração**, enquanto este V2 preserva o histórico e obrigações de segurança/E2E. Não considerar fornecedores já usados como holdout inédito; não declarar generalização a partir de golden treinado.

# EXTERNAL CALC — PLANO DE CONVERGÊNCIA OPERACIONAL V2

## Decisão
Um único caminho crítico para o Beta V0, mantendo G1/G2/G3 e C01–C05 aprovados. Não criar novos subsistemas, painéis, camadas de scoring, protocolos ou parsers por fornecedor. **NO-GO** até o teste real do usuário zero.

## Evidência de partida (15/10/2026)
- Benchmark local read-only do commit `683999c31a2e3bb49ce3fd254dc8cc29d9f63d9e`, corpus privado 14 TXT: 1.043 candidatos ativos; 165 registros shadow, todos bloqueados; 506 ambiguidades ativas. Estes números **não são ofertas comercialmente validadas**.
- 68 linhas monetárias sem menção de provenance em ambos parsers: 62 com valores comerciais e 6 marcadores não monetários; 62 linhas não equivalem a 62 ofertas.
- Shadow principal/experimental não unificado no produto. Catálogo de fornecedores ausente no benchmark. Confirmação de equivalência de candidato, confiança, provenance e preço, ainda pendente.
- Frontend #92 e deploy/E2E/autenticação precisam de prova contemporânea. Readiness histórico não é prova atual.

## Regra de execução
Trabalhar em um só vertical slice: **fornecedor → importar/colar → interpretar → resolver dúvidas → revisar C01 → cotar → simular → histórico**. Todo PR deve fechar um erro reproduzível nessa trilha, com fixture, teste e prova do fluxo afetado. Nenhuma expansão de interface ou infraestrutura fora desse caminho.

## Gate 0 — Baseline verificável (máximo 1 ciclo)
Entregas: estado dos branches/PRs/deploys; SHA backend/frontend; mapeamento contrato único da oferta e autoridade; relatório de lacunas restritas. NÃO refazer código aprovado. Critério PASS: todos os artefatos e donos explicitados e reproduzíveis. Sem alegar produção a partir de CI.

## Gate 1 — Verdade de interpretação (máximo 2 ciclos)
Entregas: referência humana independente das 14 listas (amostra estratificada e todos os casos críticos: 18 golden + 62 linhas + ambiguidades críticas), cada oferta com modelo, capacidade, cor, preço, condição, fornecedor, linha/fonte e adjudicação. Consolidar casos de múltiplas variantes e preços compartilhados. Não usar o resultado do parser como ground truth.
Metas de bloqueio: zero preço incorreto silencioso, zero fornecedor inventado, zero atribuição de produto/cor ao bloco errado, zero omissão silenciosa nos casos adjudicados. Incerteza pode virar REVIEW_REQUIRED com explicação. Medir precisão e recall separadamente por campo e por oferta. Se a referência for insuficiente, bloquear GO, não estimar taxa.

## Gate 2 — Saída única e Advisor (máximo 2 ciclos)
Manter regras determinísticas como primeira tentativa. Adaptar os extratores experimentais ao mesmo contrato de candidatos/evidence, não duplicar contratos C01–C05. De-duplicação e reconciliação por fonte + linha/escopo + identidade produto/variante + preço + condição, não apenas ID. IA Advisor somente quando necessária para ambiguidade, com provenance e comparação com fonte; nunca atribuir valores ausentes. Revisão humana antes de persistir mudanças ambíguas. Resolver classes de falhas presentes nas 62 linhas, não hardcodear fornecedores.
Critério PASS: suite golden sem regressão, casos negativos de contaminação de preço, fontes inéditas não vazando fornecedor e coerência do source-line lineage.

## Gate 3 — Fatia E2E do usuário zero (máximo 2 ciclos)
Um único ambiente staging isolado de produção e tenant de teste. Um usuário faz login, seleciona/cria fornecedor, cola/importa TXT e ZIP, revisa, confirma C01, cota, usa trade-in/parcelas/cartões/Advisor, fecha e reabre histórico em desktop e celular. Conferir SHA exato front/backend/deploy e gravações apenas quando autorizadas. Testes com 2 tenants e 2 perfis, negação cruzada, rollback, logs mínimos sem listas privadas.
Critério PASS: vídeo/evidências e resultado API/DB do mesmo run; nenhuma fixture em telas reais; owner humano aprova visual e operação. PR #92 não pode ser considerado entregue sem prova atual.

## Gate 4 — Teste cego / beta controlado (máximo 1 ciclo)
Separar 3 ou mais fornecedores/formatos de lista realmente inéditos, jamais usados para ajustar regras ou prompts antes da primeira execução; marcar frozen holdout. Executar primeiro sem alteração. Comparar com adjudicação independente. Manter erro material em REVIEW_REQUIRED, nunca READY silencioso. Depois corrigir regressões, mantendo um holdout novo para não contaminar avaliação. Entrada em beta só após Gate 1–3 PASS e aceite de segurança.

## Critérios de GO
(1) nenhuma alteração não autorizada em fornecedor/C01; (2) zero erros silenciosos materiais nos golden e nos casos críticos; (3) cobertura da referência medida sem lacuna silenciosa; (4) E2E staging autenticado desktop+mobile+histórico aprovado; (5) isolamento de tenant e rollback testados; (6) teste cego executado e comparado com referência humana. GO só para beta controlado. Caso contrário NO-GO com bloqueios identificados.

## Controle anti-desvio
- No máximo 4 gates de conclusão, além de Gate 0; cada etapa tem dono, artefato, prova e decisão.
- Relatórios são subprodutos da prova, nunca uma etapa nova por si só.
- Máximo 2 ciclos de correção por gate; após isso registrar problema e decidir escopo com owner, sem expansão silenciosa.
- Frontend e backend só progridem em paralelo quando têm fronteiras e contrato congelados.
- Não pedir ao usuário para rodar scripts repetidos sem hipótese discriminante e resultado de decisão correspondente.
- Não usar porcentagem de maturidade inferida como KPI de qualidade.

## Quadro de trabalho imediato
1. Conferir GitHub PRs/frontend/deploy e branch SHA.
2. Produzir matriz de casos golden (18) + 62 linhas comerciais + amostra de ambiguidades (506), validada por fonte, não por saída do parser.
3. Corrigir padrões por classes genéricas (variante cor/preço, acessórios, repetições) e unificar saída, sem lançar promoções.
4. Provar vertical slice em staging com usuário zero.
5. Executar holdout e tomar decisão de beta.
