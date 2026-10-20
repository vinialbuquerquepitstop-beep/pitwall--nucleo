# External Calc — Gate 1: quarentena reversível da importação parcial (PROPOSTA)

**Estado:** aprovação humana requerida. Somente plano e verificações de leitura; **não executar UPDATE, DELETE, DDL, migração, merge ou deploy em produção**.

## Ocorrência observada — 20/10/2026

A interpretação da lista WhatsApp ultrapassou o limite de subrequests por invocação do Cloudflare Worker. Na auditoria **somente-leitura** do Supabase, foi localizada uma única análise `analysis_10fed621d3cfdd15a0a07fe8` com **25 candidatas C01 gravadas, 24 revisões `VALID` e `CURRENT` sem revisão humana**, e 1 candidata sem revisão. As 24 estão visíveis para projeções de ofertas atuais.

As linhas que as próprias candidatas apontam mostram erros de autoridade: contexto de iPhone 16 Pro Max reaproveitado depois de novos cabeçalhos de iPhone 16 normal/16e, Bordô normalizado para Roxo, cor Laranja ausente e um campo de cor contendo texto monetário. A auditoria de revisão contabilizou 4 ofertas com referência de modelo atravessando novos cabeçalhos e outras anomalias (classes podem se sobrepor). **Não tratar essas 24 revisões como oferta comercial aprovada**.

## Decisão proposta

**Quarentena por par (`tenant_id`, `analysis_id`)**, não exclusão física, reparo cosmético do snapshot C01 nem simples atualização de `freshness_status`. O `UPDATE` da tabela `extcalc_offer_revision` executa o trigger `privado.extcalc_offer_revision_track_capture_v0`, que captura histórico de modelos acompanhados. Portanto, a alteração pontual de uma coluna pode produzir efeitos colaterais.

**Mecanismo futuro sob aprovação:** registro de quarentena ativo/revogável em estrutura própria com escopo de tenant, autoria, justificativa, data de ativação/revogação e RLS. Um único predicado `NOT EXISTS (quarantine active for tenant/analysis)` precisa ser aplicado **no servidor** a todas as consultas de ofertas comerciais atuais. Rejeitar no servidor a seleção de ofertas da análise em qualquer cotação ou simulação, além dos filtros de listagem, para evitar chamadas por referência direta. Não duplicar regras C01–C05 no frontend.

## Consumidores auditados — read-only em definição atual do Supabase

| Função ou área | Situação | Comportamento exigido com quarentena |
| --- | --- | --- |
| `extcalc_product_current_offers_v0` | `VALID`, `CURRENT` | Excluir análise quarantined |
| `extcalc_product_home_context_v1` | `CURRENT` | Excluir análise quarantined |
| `extcalc_movement_feed_v0` | utiliza revisões atuais | Excluir do conjunto de movimentação comercial |
| `extcalc_supplier_price_history_v0` | utiliza revisões atuais | Excluir de preços e indicadores comerciais |
| `extcalc_list_pending_review_candidates_v0` | fila depende de candidatos e revisões `VALID` | Mostrar incidente como caso operacional separado; não ressuscitar automaticamente 25 candidatas após quarentena |
| `extcalc_history_list_v0` | mostra revisão/histórico | **Preservar** histórico com indicação visível de quarentena/incident, não apagar |
| `extcalc_product_source_execution_v0` e cotação/simulação | recebem referência direta | Bloquear referência a oferta quarantined antes de expor execução ou simulação |
| Endpoints alternativos e acessos diretos | não completamente enumerados | Auditar integralmente antes de qualquer migração |

A tabela de quarentena não pode ser pública/editável por um cliente arbitrário: somente API de proprietário autorizado, com `auth.uid()`, tenant e papel `dono` verificados; não conceder permissões `PUBLIC` acidentalmente em funções `SECURITY DEFINER`. O contexto de autenticação real do Supabase continua não homologado fora da produção.

## Simulação real SOMENTE-LEITURA: impacto da exclusão por análise

Consulta de leitura executada em 20/10/2026, em `extcalc_offer_revision`, reproduzindo os filtros de `extcalc_product_current_offers_v0` e subtraindo apenas o par `tenant_id/analysis_id` afetado via `NOT EXISTS` em uma CTE, **sem inserir quarentena nem modificar snapshots**:

| Métrica | Resultado |
| --- | ---: |
| Revisões `VALID / CURRENT / SUCCEEDED` com `reviewed_offer` não nulo, antes | **63** |
| Revisões atuais pertencentes à análise afetada | **24** |
| Revisões restantes na simulação, depois da exclusão da análise | **39** |
| Total de revisões C01 persistidas, inalteradas | **64** |

A simulação confirma a abrangência numérica deste filtro específico (24 isoladas, 39 restantes), **não comprova** os demais consumidores, autorização, ausência de acessos diretos ou rollback real. É proibido interpretar a simulação como quarentena ativada.

## Teste de pré-condição e plano de reversão

1. Identificar **um único tenant** e **uma única source** relacionados à análise; os identificadores de origem e fingerprint devem coincidir. Nenhum outro `analysis_id` pode ser afetado.
2. Antes de habilitar a quarentena, conferir `25` candidatas, `24` revisões atuais e `0` revisões humanas, sem mutações concorrentes. Caso contrário, **abortar**.
3. Salvar evidência segura das chaves e fingerprints anteriores, sem publicar dados dos fornecedores em PR público.
4. Em ambiente de testes local/gratuito, provar: 24 ofertas deixam de aparecer nos consumidores comerciais, 0 ofertas de outra análise somem, consulta histórica preservada, cotação por ID direto negada, revisão humana permanece rastreável.
5. Execução real (somente após aprovação) deve ser transacional, com operador, razão e recibo verificável. Nenhuma exclusão de linhas C01.
6. **Rollback:** revogar/desativar o registro de quarentena, sem reescrever snapshots originais. Confirmar retorno das mesmas 24 chaves e ausência de efeitos em outras análises. Esse rollback é operacional e **não certifica a correção dos dados** — jamais promover automaticamente após reverter.
7. Fallback em caso de migração não homologada: deixar o Worker/importação e as ofertas sem republicação ou uso comercial, com aviso claro ao operador; não declarar release.

## Limites de aceite

- O plano **não foi aplicado**. A análise parcial continua ativa no Supabase e pode contaminar consultas existentes.
- Os PRs #178/#179 são rascunhos; o frontend PR #92 segue com validação GitHub Actions não comprovada.
- CI sintético/Netlify `READY` não substituem teste de RLS, auth, cotação e dados reais.
- Nenhum novo serviço pago nem Docker local será necessário para desenvolver a proposta, mas alterações em produção exigem autorização expressa e execução monitorada.

**Gate humano pendente:** autorizar ou rejeitar a implementação e ativação de uma quarentena do `analysis_id` afetado em produção, após homologação do alcance e rollback.
