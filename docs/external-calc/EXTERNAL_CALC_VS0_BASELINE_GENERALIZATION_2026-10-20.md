# External Calc — VS0 / baseline de generalização sintética

**Registro de evidência — 20/10/2026; sem alteração em produção.**

## Artefatos
- Branch metodológico: `method/external-calc-generalization-gate-20261020` / PR #182 (DRAFT).
- Gerador: `ferramentas/external-calc-generalization/v0/generate.mjs`, seed **DEV pública** `dev-demo-north-0001`, 20 blocos artificiais e 33 ofertas esperadas.
- Oracle: gerado antes da execução de `buildQueue`. O verificador assegura hash, vínculos fonte e enumeração das 33 ofertas. O benchmark só imprime agregados, sem registrar catálogo real nem tokens.
- Workflow: `External Calc - Generalization Method V0`, primeiro run #39534938845, conclusão **SUCCESS para o harness**, com experimento DEV explicitamente `FAIL`.

## Medição do primeiro confronto (Main / branch de documentação)
| Métrica | Valor |
|---|---:|
| Blocos artificiais | 20 |
| Ofertas esperadas pelo oracle independente | 33 |
| Candidatos extraídos pelo parser | 25 |
| Multiconjunto exatamente correspondente (modelo+capacidade+cor+condição+preço) | 3 |
| Ofertas esperadas sem match exato | 30 |
| Candidatos não equivalentes no match exato | 22 |
| Precisão de match estrito | 3 / 25 = 12% |
| Recall de match estrito | 3 / 33 ≈ 9,1% |
| Erros de lineage entre os matches exatos | 0 observados (não significa cobertura de lineage dos não-matches) |

**Importante:** divergência estrita mistura associações materiais e normalizações de alias/condição. Não reclassificar 30 como preços silenciosamente errados sem auditoria de pares e source span. Mesmo assim, a amostra **reprova qualquer gate de fidelidade**. A identificação de 25 candidatos não é sucesso.

## Resultado metodológico
- `GENERALIZATION_HARNESS=PASS`: determinismo, oracle SHA, rejeição de adulteração, comparador reprova preço mutado.
- `C01_GENERALIZATION_DEV_SAMPLE=FAIL`: parser atual não alcança a referência independente.
- `C01_SYNTHETIC_CHALLENGE=NOT_RUN`: nenhuma semente blind foi aberta; não antecipar avaliação cega.
- `C01_EXTERNAL_UNSEEN=UNAVAILABLE`: todos os fornecedores naturais atuais foram vistos; não fingir holdout.
- `BETA_GENERALIZATION=NO_GO`.

## Próxima decisão VS1
Auditar `scoreRoles/segmentDocument/buildContextTrace` no `Interpreter Core`, o contrato `CanonicalDocument` e `expandColorVariants` no intake, propondo um resolvedor de vínculos genérico. **Não** corrigir individualmente a seed DEV antes de congelar a hipótese estrutural, contraexemplos e matriz de avaliação.

Este documento é uma fotografia da primeira prova, não um dado canônico de qualidade permanente.
