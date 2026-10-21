# External Calc — VS5.3i / Proposta executável de fonte PostgreSQL em staging

**Data:** 21/10/2026. **Classificação:** SQL CANDIDATE / UNAPPROVED / NOT A MIGRATION.
**PR base:** #198, que foi comprovado apenas com transporte HTTP simulado. Produção: NO-GO.

## Objetivo
Preparar uma proposta auditável de fonte **ORIGINAL_SUPPLIER_TEXT**, sem promover dados a C01, sem suplantar a revisão humana, sem criar storage real e sem alterar os gates anteriores.

Artefatos:
- ferramentas/external-calc-generalization/v0/VS53I_SOURCE_STORAGE_STAGING_CANDIDATE.sql — espécime SQL **não aplicado**.
- ferramentas/external-calc-generalization/v0/proof-vs53i.mjs — verificador estrutural estático com mutações negativas.
- docs/external-calc/EXTERNAL_CALC_VS53I_POSTGRES_STAGING_CANDIDATE_V0.md — este checkpoint.

**Nada** foi gravado em bancos Supabase. O SQL foi intencionalmente colocado fora de supabase/migrations, não é um plano aprovado e não deve ser colado em nenhum SQL Editor antes do gate humano.

## Topologia proposta para revisão
1. **privado.extcalc_original_source_v0**: linha fonte bruta tenant-scoped, ref opaca, origem ORIGINAL, filename, actor de captura, content_bytes BYTEA e SHA-256 GENERATED ALWAYS sobre os próprios bytes. A restrição inicial de 1 MiB é **proposta não aprovada**, sujeita a benchmark, UX e operação real.
2. **privado.extcalc_original_source_state_event_v0**: eventos append-only QUARANTINED/REVOKED separados do bruto. Sem mutação do conteúdo ao bloquear uma fonte. Um estado rejeitado não volta a AVAILABLE nesta proposta.
3. Trigger BEFORE UPDATE OR DELETE em ambas as tabelas, mais revogação de escrita para anon/authenticated. Isso não impede superuser/DDL, que dependem de governança, backup e privilégios segregados.
4. RLS habilitada e forçada em ambas as tabelas, leitura exclusivamente por authenticated + auth.uid() presente + tenant calculado em privado.fn_tenant_atual() + papel dono de privado.fn_papel_atual(). Essas funções são existentes no modelo, mas **sua execução efetiva em staging ainda precisa ser comprovada**.
5. **public.extcalc_original_source_probe_v0**: view com security_invoker=true e somente metadados esperados pela VS5.3h. Não expõe conteúdo nem filename. Role authenticated lê a view apenas se tiver permissões mínimas de schema/tabelas + cumprir a policy. As tabelas brutas estão em schema privado, que obrigatoriamente deve estar fora da lista de schemas Data API.

## Questões que NÃO estão aprovadas
- PostgreSQL versus Storage privado como tecnologia definitiva (VS5.3e ainda é proposta).
- Convenção de gravação: somente ingestão servidor/autorizada com tenant, ator, hash e ref derivados de identidade real; nenhuma API de inserção foi construída.
- A existência/disponibilidade de pgcrypto extensions.digest(bytea,text) no staging, schema privado não exposto e grants necessários.
- Retenção, exclusão legal, restauração a partir de quarentena, limites de bytes, observabilidade e revogação real.
- Como o resolver VS5.3f consumirá bytes e estado efetivo na mesma leitura server-side sob JWT validado e sem service_role/RLS bypass.
- Grant SELECT aos usuários authenticated nas tabelas privadas é aceitável apenas se schema privado não for exposto pela Data API e políticas reais forem provadas. Acesso raw indevido é bloqueio de gate.

## Prova técnica exigida antes de aprovação
1. **Escolha e autorização explícita** de projeto staging isolado, identificando ref, organização e conta, sem apontar para produção unjzpyexgtbcmjfgcqrx nem para outro produto.
2. Revisar o SQL contra schema real: confirmar tenant/id/funções, pgcrypto, PostgreSQL >=15, owner, GRANT, FORCE RLS, tipos, triggers, view security_invoker e exposição da Data API; obter revisão de segurança.
3. Executar migration e seed **apenas após autorização de DDL** e plano de reversão em staging; criar dois atores e tenants sintéticos, uma fonte por tenant. Admin seed não conta como prova de RLS.
4. Executar VS5.3g com VS5.3h em GET real: OWN 2/2 FOUND; cross 2/2 deny; anon 2/2 deny; absent 2/2 deny. Conferir 8/8, sem dados brutos na view. Isso sozinho ainda não dá PASS de RLS: comparar metadata instalada e permissões.
5. Verificar raw bytes SHA 256, UTF-8 exato, timeout, tamanho, concorrência, duplicação e rollback; impedir overwrite real, inclusive UPDATE e DELETE em transação autorizada de staging.
6. Validar que não há escrita em C01 nem promoção silenciosa e que o incidente de 20/10 e #178–#180 continuam independentes do produto.

## Evidência atual
Provas prévias: VS5.3d 8/8 stub; VS5.3f 12/12 stub; VS5.3g 12/12 simulado; VS5.3h 15/15 HTTP mock; VS5.3i é **apenas revisão estrutural estática**. Não há PostgreSQL local instalado no runner da sessão e nenhum staging autorizado foi identificado. Listagem de branches Supabase do projeto produtivo foi negada por permissão; não se tratou isso como confirmação de ambiente.

**CI verificado:** PR #199 (DRAFT), commit fb18892ca0b8bc3d5e188aa3725e908e8e22fd4a. GitHub Actions generalization run 39685560505 / job 119518600686: SQL candidate static 6/6 PASS, ownership 30 paths deny=4; demais cinco workflows PASS (seis no total). Prova restrita à estrutura textual do SQL, não à execução de DDL, não à sintaxe efetiva do PostgreSQL, não a JWT/RLS real.

**Estados:** VS53I_SQL_DRAFT=CI_PASS_STATIC_ONLY; REAL_STORAGE=NOT_IMPLEMENTED; REAL_RLS=NOT_RUN; C01_RELEASE=NO_GO.

O próximo passo depois da aprovação **não é nova simulação**: é executar SQL e JWT A/B contra o staging explícito, registrando uma prova externa verificável.
