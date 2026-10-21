# External Calc — VS5.3d / Origem imutável de listas

**Data:** 21/10/2026. **Status:** contrato e validação isolados; banco real e RLS ainda não homologados.

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

`VS53D_CONTRACT_TESTS`: sujeito ao CI.

`VS53D_STORAGE_PERSISTENCE`: NOT_IMPLEMENTED.

`REAL_JWT_RLS`: NOT_RUN.

`GATE1_PRODUCTION`: NO_GO.

Próximo slice: escolher storage canônico e demonstrar RLS real **sob autorização explícita e ambiente isolado**. Não abrir uma migração de produção como substituto dessa prova.
