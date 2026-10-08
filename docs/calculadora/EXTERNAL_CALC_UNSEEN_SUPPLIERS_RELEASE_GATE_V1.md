# External Calc — Gate de Generalização com Fornecedores Inéditos V1

**Estado:** PROPOSTO / NÃO EXECUTADO. Bloqueia a liberação geral até existir evidência real.

## Separação de dados
- **Desenvolvimento/regressão:** as 14 listas SP já inspecionadas (incluindo Mega Storia, ON CELL e Captain Cell); servem para corrigir e prevenir regressões, nunca para medir teste cego.
- **Holdout genuíno:** ao menos 3 fornecedores/documentos completos e inéditos, com fontes independentes, jamais vistos durante a construção de regras. Os originais ficam privados. Não editar regex após abrir o conjunto sem invalidar e renovar o holdout.
- Congelar hash SHA-256 do pacote e de cada arquivo **antes** da execução e registrar SHA do backend, versão do schema, data e versão da rotina de interpretação.

## Procedimento
1. Concluir os bloqueios conhecidos da Mega Storia e Captain Cell sem usar o holdout.
2. Revalidar as 14 listas no caminho integrado do batch/serviço, com rastreabilidade dos pares produto-variante-preço, incluindo abstentions.
3. Congelar parser/schema. Abrir o novo corpus SOMENTE na rodada de teste cego.
4. Gerar ground truth revisado por humano, reconciliando todas as linhas comerciáveis e sinalizações de ausência.
5. Executar intake autenticado num tenant de homologação isolado e guardar artefatos privados; testar fornecedores novos, existentes, semelhantes e não identificados.
6. Medir e publicar agregados: total de ofertas esperadas / extraídas / reconciliadas; revisão; preços/cores/capacidades incorretos; atribuições de fornecedor incorretas; ofertas silenciosamente perdidas; promoção insegura.
7. Exigir **zero erros críticos silenciosos** e 100% de reconciliação entre ofertas, revisão e justificativa auditável; exigir revisão funcional e isolamento de lojas.
8. Depois, fazer E2E e deploy controlado com rollback. Esta prova não substitui CI, segurança ou aprovação humana de mudanças visuais.

## Contrato de evidência
Rodar `node ferramentas/external-calc-list-intake/v0/gate_unseen_suppliers_v1.js <evidence.json>`.
Campos: `contract_version, freeze_sha256, parser_commit, run_at, evidence_uri, ground_truth_reviewed, review_queue_verified, cross_tenant_isolation_verified, suppliers[ {source_id,sha256,seen_during_development:false,ground_truth_count,reconciled_count} ], critical_errors`.
Os cinco contadores críticos precisam ser 0: `wrong_price_silent, wrong_supplier_silent, wrong_variant_silent, missing_offer_silent, unsafe_auto_promotion`.
O executor verifica **declarações de evidência**, não comprova sozinho sua autenticidade; a validação humana das referências e logs/artefatos externos é obrigatória.

**Nunca adicionar o corpus privado ou dados pessoais ao GitHub. Nunca afirmar PASS de generalização com as listas usadas em desenvolvimento.**
