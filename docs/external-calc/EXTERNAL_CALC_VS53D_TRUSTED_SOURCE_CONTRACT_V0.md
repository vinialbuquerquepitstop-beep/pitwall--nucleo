# External Calc — VS5.3d / Origem imutável de listas

**Data:** 21/10/2026. **Status:** VS53D_STATIC_AND_STUB_PASS (CI GitHub, head `fbbc74e616f4664ebec255779b9ba39ac7b6c283`); banco real e RLS **BLOCKED / NOT_RUN**.

## Evidência do repositório

- `public.extcalc_source_supplier` relaciona `tenant_id/source_id` a `supplier_id`, mas **não contém a lista bruta**.
- `public.extcalc_execution` armazena snapshots de execução, não está definida como fonte autoritativa original.
- `public.calc_carga.blob_proposto` é payload proposto do fluxo legado, não garantia de texto bruto imutável.
- `public.extcalc_review_candidate.candidate_snapshot` é snapshot C01 de revisão, não substitui documento original.

Portanto, não usar nenhum desses registros como origem bruta sem novo contrato e evidência.

## Adapter de prova

`trusted-original-source.cjs` especifica `createTrustedOriginalSourceResolver({repository})` com `loadTenantOriginalSource({source_ref,tenant_id,actor_ref})`. A camada exige:
- `source_contract_version = external-calc-original-supplier-source/v0`;
- `source_type = ORIGINAL_SUPPLIER_TEXT`, `immutability = APPEND_ONLY`, `state = AVAILABLE`;
- referência e tenant coincidentes com a identidade do servidor e resolução vinculada ao ator;
- texto original não vazio, nome de arquivo e SHA-256 do conteúdo efetivo, verificado antes de interpretar;
- rejeição de fonte mutável, snapshot derivado, hash adulterado, linha com tenant errado ou referência não permitida;
- nenhuma operação de escrita nem autorização C01.

O `repository` é uma **porta sem implementação persistida**. O teste usa repositório em memória; uma conexão real exige contrato de storage/SQL, RLS e ambiente separado. `APPEND_ONLY` é uma declaração de integridade no contrato, **não** uma prova de enforcement pela infraestrutura.

## Gate de armazenamento pendente

Antes de criar schema e publicar qualquer endpoint:
1. Decidir onde ficam os bytes originais (tabela tenant-scoped, Storage privado com metadados ou outra camada); documentar retenção, limites de arquivo, classificação e exclusão.
2. Definir RLS e permissões: leitura autorizada por JWT real; `service_role` não serve para provar segregação; tenant deriva apenas do Auth.
3. Projetar registro imutável `(tenant_id,source_ref,content_sha256,created_by,created_at)` com prova de não alteração e tratamento de arquivo retirado/quarentenado.
4. Separar fonte de texto original das propostas C01 e das revisões; nunca reprocessar snapshots como se fossem entradas originais.
5. Testar em **Supabase staging separado**, com duas contas/tenants e dados exclusivamente fictícios. Não modificar produção, quarentena nem dados comerciais existentes.
6. Confirmar tamanho de payload/limites do Worker, segregação por usuário, observabilidade sem conteúdo sensível, limpeza e rollback.

## Decisão

`VS53D_CONTRACT_TESTS`: **PASS 8/8**, execução GitHub Actions `39641866072`, job `synthetic-oracle` `119367189878`; ownership `GENERALIZATION_OWNERSHIP=PASS paths=25 deny=4`. Esta evidência é de testes in-memory + integração HTTP-shaped isolada, **não é** prova de acesso a Supabase real.

`VS53D_STORAGE_PERSISTENCE`: NOT_IMPLEMENTED.

`REAL_JWT_RLS`: NOT_RUN.

`GATE1_PRODUCTION`: NO_GO.

Próximo slice: escolher storage canônico e demonstrar RLS real **sob autorização explícita e ambiente isolado**. Não abrir uma migração de produção como substituto dessa prova.

## Escopo exato de integridade e ameaça residual

- `content_sha256` atualmente verifica o SHA-256 do **texto fornecido pelo repository após codificação UTF-8 em Node**. Não comprova por si só que os bytes originais do upload foram capturados sem normalização, substituição de caracteres ou mudança de encoding. A futura fonte deve capturar bytes na ingestão, guardar o digest desses bytes e rejeitar decodificação inválida; se a entrada for texto colado, definir explicitamente o ponto de conversão única para UTF-8 sem transformação implícita.
- O retorno `APPEND_ONLY` é um valor declarado no registro; não impede fisicamente UPDATE/DELETE por grants, triggers, funções privilegiadas ou conta com bypass RLS. Não classificar como imutável real antes de inspecionar ACL, políticas, caminho único de ingestão, trilha de auditoria e tentativas reais de alteração.
- A função `repository.loadTenantOriginalSource` continua uma porta de confiança **não implementada**. O stub nega tenant/ator incorretos, mas uma implementação real deverá validar `auth.uid()`, papel permitido e tenant server-side, com RLS ativa e consulta parametrizada, sem confiar em qualquer campo do cliente.
- O tamanho de `content` não é limitado pelo resolver experimental. Bloquear integração real até fixar e testar limite de bytes, tamanho do resultado, timeouts e contagem de subrequests (incidente operacional em 20/10).
- Status de exclusão/revogação (`QUARANTINED`, `REVOKED`, `DELETED`) deve falhar fechado. Retenção e descarte sob exigência legal devem usar procedimento auditável, sem reclassificar fonte derivada como original.
- Não demonstrado: contenção das 24 revisões produtivas potencialmente contaminadas; manter gate separado #178–#180 e **não importar** novos catálogos comerciais no frontend antigo.

## Critério de passagem do próximo gate

Uma **proposta** de armazenamento tenant-scoped pode ser preparada sem tocar produção, mas o gate de `REAL_SOURCE_RLS` exige projeto staging **identificado e expressamente autorizado**, credenciais de teste A/B para tenants distintos, tabela/bucket com captura original verificada, política instalada (não apenas migração no Git), autenticação `authenticated` e testes positivos/negativos de leitura, adulteração, revogação e isolamento. Toda alteração DDL fica fora de escopo até autorização humana explícita.
