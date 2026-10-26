# EXTERNAL CALC — Execução Linear V3: Generalização, não memorização

**Decisão humana de 20/10/2026:** interromper o ciclo "lista falhou → regex local → mesma lista passa". A prioridade do produto passa a ser interpretar **estruturas inéditas** e provar associação correta de modelo, variante, cor, condição, preço e origem. Esta decisão governa apenas o External Calc, **não altera silenciosamente o método global Tree, os contratos C01–C05 nem o freeze visual**.

**Status:** método aprovado; evidência operacional de generalização ainda **NO-GO**. Este V3 sucede o plano operacional V2 *para o Gate de interpretação*, preservando as partes de segurança, tenant, persistência, cotação e beta que não conflitem.

## Estado inicial verificável
- Todos os fornecedores/listas reais disponíveis foram utilizados ou inspecionados em desenvolvimento. Não classificar nenhum deles como holdout genuíno.
- No laboratório read-only, a lista sintética Vértice: 49 → 58 ofertas depois de ajustes; o teste "Central Mix", reformatação da mesma base com 58 ofertas, obteve **40 candidatos e 3 ambiguidades de campo**. Isso demonstra insuficiência de generalização apesar do golden de 58 aprovado.
- PR #181: testes da lista Vértice e regressões verdes no ramo de desenvolvimento; **não** prova universalidade.
- PRs #178–#180: investigação, paginação, governança C01 e quarentena permanecem dependentes e sem aplicação no Supabase ativo. Frontend PR #92 permanece sem prova E2E mobile conclusiva. Nunca inferir prontidão de deploy READY.
- O Interpreter Core V1 é **FROZEN** em seu gate estrutural histórico; mudanças no Core exigem proposta, ownership, impacto e novo gate, não um patch silencioso.

## Regra central de produto
"Universal" significa **comportamento de generalização demonstrável dentro do domínio e dos formatos declarados**. Não significa reconhecer qualquer texto do mundo, nem sucesso em corpus sintético equivalente ao real. Abster-se com `REVIEW_REQUIRED` é correto quando o texto não resolve a associação; atribuir silenciosamente valor errado é falha P0.

## Linha única de execução (sem atalhos)
```text
G0 — BASELINE + CONGELAR DADOS USADOS
  ↓
S1 — MODELO DE RELAÇÕES: DOCUMENTO / BLOCO / PRODUTO / VARIANTE / EVIDÊNCIA
  ↓
S2 — EXTRAÇÃO GENÉRICA: TOKENS / PAPÉIS / VALORES / ABSTENÇÕES
  ↓
S3 — RESOLVER ESCOPO E VÍNCULOS: atributo → oferta / início-fim do bloco
  ↓
G1 — PROVAS SINTÉTICAS SEPARADAS: DEV / REGRESSÃO / DESAFIO INÉDITO
  ↓
S4 — BOUNDARY C01: candidate+trace+reason → revisão humana
  ↓
G2 — TESTE VERTICAL REAL READ-ONLY (mesmo SHA, observabilidade)
  ↓
G3 — E2E ISOLADO: autenticação, revisão, cotação e simulação
  ↓
G4 — HOLDOUT EXTERNO GENUINAMENTE NOVO + ACEITE DE SEGURANÇA
  ↓
BETA CONTROLADO (se todos os gates PASS)
```

### G0. Prova de partida
- Inventariar SHA do Core, schema, list-intake, PRs e runtime; diff do branch não é deploy.
- Colocar todas as listas já vistas em `KNOWN/REGRESSION`; a lista Vértice e a variação Central Mix **não são duas fontes independentes**.
- Registrar falhas existentes incluindo 58/40 e o erro CPO; não "zerar ambiguidade" com descarte de avisos.
- Saída: `BASELINE.json` com autoria, hashes, fonte de evidência, limites, status. Nenhum texto real de terceiro em Git.

### S1. Estrutura e relações
- O contrato genérico de interpretação define `source → sections → product_blocks → variants → attributes → source_spans → proposed_offers`.
- Independência de fornecedor/empresa. Cabeçalho, nota comercial, contato, valor não comercial e produto precisam de papéis distintos.
- Separar expressamente `model_generation`, `storage_capacity`, `ram`, `display_size`, `quantity`; 13" e 16/512 não significam 13 GB.
- Estrutura não é uma lista fechada de regex para marcas. Propor alteração do Core se o contrato vigente não suportar vínculos e escopos.

### S2. Extração semântica
- Extrair entidades candidatas e seus spans mesmo se a ordem for preço→cor ou cor→preço.
- O parser não atribui fornecedor, modelo, cor ou condição ausente por adivinhação. `null` é permitido com motivo.
- Normalização de BRL `6.890`, `6.890,00`, `R$ 6.890,00` deve ter evidência e distinção de telefones, códigos e parcelas.
- IA é **proponente opcional**, não fonte de verdade. Todo atributo sugerido precisa de evidência no texto, validação de formato e bloqueio humano se materialmente incerto.

### S3. Resolução de associação
- Associar os spans a um produto, variante, bloco e preço; escopo termina em nova âncora ou condição contraditória.
- Herdar preço compartilhado por N cores apenas quando justificável; criar N ofertas rastreáveis, não multiplicar silenciosamente.
- Preservar condições de categoria válidas e impedir CPO individual contaminando outra categoria.
- Expor `association_reason`, `source_spans`, `alternatives`, `uncertainty`. Se faltar associação, `REVIEW_REQUIRED`.

### G1. Generalização sintética, pré-registrada
- Gerador determinístico de fornecedores **fictícios**, catálogo **artificial** e **oracle independente** do parser. Arquivos de saída locais/CI, nunca dados reais.
- Partições: treino/desenvolvimento aberto; regressão conhecida; avaliação por semente/layout previamente **não usada para ajustes**. Não ajustar regex/prompt com o mesmo holdout e alegar PASS depois; se abriu e corrigiu, migra para regressão e troca o desafio.
- Medir precisão/recall de ofertas e campos, erros de associação, faltantes, duplicatas, abstinências e contagem; comparar por identidade e fonte, não só 58 == 58.
- Falha crítica: qualquer preço, modelo, variante ou fornecedor errado sem revisão. Exigir zero erro crítico silencioso **na amostra adjudicada**; definir metas de cobertura antes do ensaio e publicar denominadores. Falta de referência independente = NO-GO.
- Evidência só sintética = `SYNTHETIC_GENERALIZATION_PASSED`, **não** `PRODUCTION_READY`.

### G2. Vertical read-only
- Rodar parser real via `buildQueue`/Service com a mesma fonte e SHA, sem DB; comparar candidato por candidato, incluindo traces.
- A UI do laboratório é observabilidade auxiliar: contadores verdes e deploy READY nunca substituem o arquivo de prova.
- Falha de uma fonte desafiante bloqueia o gate, mesmo que as listas de regressão fiquem verdes.

### G3. Segurança e E2E
- Frontend, backend, autenticação e C01→C05 sem duplicação; tenant isolado; cotação e simulação por C01 revisado; segurança/quarentena de execuções prévias.
- No ambiente ativo, não repetir lista com escrita parcial antiga até reconciliação autorizada das 24 revisões.
- Exigir RLS/autenticação real, rollback, provas de navegador mobile e desktop; não confundir CI sintético com prova real.

### G4. Realidade externa
- Fornecedor/documento **externo não visto** só pode ser obtido em nova operação, sem inventar que já existe. O corpus atual inteiro é DEV/REGRESSION.
- Até surgir fonte externa realmente inédita, o beta pode avançar em software isolado e segurança, mas **liberação ampla da interpretação de terceiros continua NO-GO**.
- Congelar hashes e commits antes de abrir fonte, adjudicação humana sem olhar parser, executar uma vez, registrar falhas e promover para regressão após avaliação.

## Ownership e regra de mudança
- `INTERPRETER_CORE`: extração/associação genérica, somente por proposta de unfreeze se necessária.
- `UNIVERSAL_INPUT`: codecs/canonicalização; nenhuma regra comercial C01.
- `C01/LIST_INTAKE`: composição, evidência, bloqueio de promoção; não duplicar resolução semântica por fornecedor.
- `PRODUCT/SERVICE`: orquestração de revisão; `PLATFORM`: auth, auditoria, persistência, segurança, limites; `FRONTEND`: apenas apresentação.
- Alteração estrutural deve passar pelo Proof Governance cross-slice; alterar a documentação **não** congela contrato executável nem autoriza deploy.

## Governança anti-overfitting
1. Nenhuma lista usada para desenvolver regras entra em métrica de generalização cega.
2. Regra nova deve explicar classe estrutural identificável **sem nomes ou preços de fornecedor**.
3. Bug observado vira caso negativo e regressão; mas alterar apenas até uma fixture passar **não** encerra slice.
4. Não criar provider profiles fixos como remendo universal; perfis específicos (se existirem) pertencem à integração declarada, não ao motor comum.
5. Não usar uma mesma lista reformatada como fonte independente de evidência.
6. Progresso real = cruzamento de casos independentes e prova campo a campo, não quantidade de patches, fixtures ou avisos escondidos.
7. Pare e redesenhe o contrato se forem necessárias duas rodadas de regex para o mesmo padrão sem ganho no conjunto de avaliação novo.

## Próximo passo executável
Rodar o gerador `ferramentas/external-calc-generalization/v0/generate.mjs` em DEV com seed de demonstração; verificar `manifest + oracle` independentemente do parser; obter baseline *sem correções*; em seguida, escrever spec de relações e escolher a primeira alteração arquitetural necessária. Não alterar a calculadora online nem promover ofertas.
