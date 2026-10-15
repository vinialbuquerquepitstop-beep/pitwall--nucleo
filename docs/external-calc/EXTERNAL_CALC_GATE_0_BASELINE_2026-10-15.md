# External Calc — Gate 0 / Baseline verificável — 2026-10-15

Status: **PASS documental / NO-GO operacional**. Este registro não aprova Gate 1 nem beta.

## Estado verificável
| Eixo | Evidência | Status |
|---|---|---|
| Método | Plano V2 em `docs/external-calc/EXTERNAL_CALC_PLANO_DE_CONVERGENCIA_V2.md` | VERSIONADO |
| Backend main | `ee5070732f6bd69938a5c2e55b4944550960594c` (commit documental). Código funcional anterior: `683999c31a2e3bb49ce3fd254dc8cc29d9f63d9e` | SHA IDENTIFICADO; deploy atual não atestado |
| Backend #176 | Fechado e mergeado em `683999c31a2e3bb49ce3fd254dc8cc29d9f63d9e` | MERGED / CI histórico aprovado; PROVA OPERACIONAL PENDENTE |
| Frontend main | `d9f0d2b54ea8f62ed3d817c423cb2434fa160d7f` (#91) | SHA IDENTIFICADO; deploy atual não atestado |
| Frontend #92 | `feat(external-calc): make ZIP batch intake primary` | ABERTO; visual aprovado no registro do PR; integração ainda não mergeada |
| Gate #150 | Issue `External Calc — Release Gate do Interpreter com fornecedores novos` | FECHADO desde 08/10 apesar das evidências posteriores NO-GO. **Status GitHub da issue não representa aceite comercial**. Não reabrir automaticamente um gate histórico; transportar pendências para o Gate 1 V2 |
| Benchmark combinado | 14 arquivos privados, commit código `683999c3...` | 1.043 candidatos ativos; 165 shadow bloqueados; 506 ambiguidades, não são registros validados |
| Auditoria 68 | 62 linhas comerciais sem referência + 6 falsos sinais; arquivo privado, fora do GitHub | PROVA DE LACUNA; adjudicação individual pendente |
| Catálogo de fornecedores | `supplier_catalog_provided=false` na prova | RESOLUÇÃO REAL NÃO TESTADA |
| Frontend staging desktop/mobile | Evidência de aprovação visual anterior e CI, mas sem revalidação do build deployado + sessão + persistência | UNVERIFIED |
| Segurança/tenant, rollback | Não comprovados neste ciclo | UNVERIFIED |

## Contratos e fronteiras
- **C01** revisa ofertas, sem promoção automática de shadow.
- **C02–C05** permanecem no backend/Service; zero cálculo comercial no frontend.
- Entrada `TXT/CSV` no parser principal; ZIP como batch do backend, frontend consome `POST /api/external-calc/v0/batch-list-intake`.
- Parser `buildQueue` e `auditIntegratedShadow` são caminhos de leitura utilizados no benchmark; `processListIntakeCommand` com RPC é caminho de escrita e não pode ser chamado na homologação privada sem staging/usuário autorizado.
- No benchmark, ausência de sobreposição por **arquivo** não prova de-duplicação semântica por oferta.
- Fornecedor sem catálogo não significa resolver falhou, significa **não testado**.

## Impedimentos que exigem evidência antes de afirmar PASS do produto
1. Conferir SHA de release implantado backend/front e resultado de smoke autenticado usando a mesma revisão, em staging.
2. Resolver PR #92: revisar status dos checks, merge/retorno de reprovação, sem redesenho de telas já aprovadas.
3. Criar matriz de ground truth humana independente para 18 casos golden + 62 linhas comerciais sem referência + amostra dirigida das 506 ambiguidades; medir erro comercial silencioso e omissão.
4. Identidade de fornecedor com catálogo real controlado, sem contaminar fornecedor externo.
5. Prova E2E login → batch/colar → revisão C01 → cotação → simulação → histórico (desktop e mobile), multi-tenant e rollback.
6. Holdout de >=3 fornecedores inéditos, sem ajuste prévio.

## Próxima execução autorizada
**Gate 1 — Matriz de verdade do interpretador.** Não criar novos gates ou parsers por fornecedor. Antes de PR de parser: reproduzir caso, adjudicar por fonte, criar teste genérico com negativo e revisar consequências C01. Não publicar TXT ou preços privados em GitHub. Owner decide GO só por critérios no Plano V2.
