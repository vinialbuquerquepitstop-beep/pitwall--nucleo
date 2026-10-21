# External Calc — VS5.3h / Transporte de leitura GET protegido para homologação

**Data:** 21/10/2026. **Estado:** módulo opcional ISOLADO; GitHub CI apenas MOCK. **RLS real: NOT_RUN.** Produção NO-GO.

## Valor incremental (sem reabrir VS5.3d–g)
VS5.3g define 8 verificações lógicas A/B/ANON, mas não faz requests. VS5.3h fornece o transporte HTTP de leitura de metadados a ser conectado somente depois de identificado e autorizado um projeto Supabase **exclusivo de staging do External Calc**. Não publica endpoints, não persiste listas, não constrói fontes originais, não executa SQL e não modifica C01–C05.

Arquivos:
- ferramentas/external-calc-generalization/v0/guarded-staging-read-transport.cjs
- ferramentas/external-calc-generalization/v0/proof-vs53h.mjs

## Fronteiras
- Operação exclusiva GET em https://<project_ref>.supabase.co/rest/v1/<table_name> usando select explícito de **somente metadados** (tenant_id, source_ref, versão/tipo/estado/imutabilidade, hash SHA-256).
- A projeção tabela/view ainda **não foi escolhida nem criada**. A configuração exige nome restrito extcalc_*_probe_v0. Se for uma VIEW, configurar security_invoker e provar RLS das tabelas subjacentes, owner/grants e ausência de SECURITY DEFINER perigoso.
- Requer project_ref=approved_staging_ref, chave publishable sb_publishable_*, JWT A/B distintos com sub, role=authenticated, issuer do projeto e exp futura. **O decode local não verifica assinatura**: JWT real é validado remotamente pelo Supabase e isso deve ser demonstrado na homologação. Não são aceitos tokens service_role pelo claim.
- Projeto produtivo já conhecido unjzpyexgtbcmjfgcqrx está bloqueado explicitamente. A igualdade approved_staging_ref **NÃO comprova a autorização humana** e NÃO identifica produção desconhecida; a validação organizacional do destino é obrigatória e separada.
- Sem upload, POST, RPC, INSERT, UPDATE, DELETE, body, cookies, SQL, redirecionamentos, raw bytes ou texto de fornecedor. Retornos ambíguos, acima de uma linha, extras, falhas de rede e status inesperados geram rejeição.
- Chaves/JWT são fornecidos SOMENTE em memória no teste autorizado; não colocar em GitHub Actions, logs, documentação, issue, console ou PR. O CI usa credenciais fictícias NÃO ASSINADAS, fetch injetado e nenhuma conexão.
- Não usar service_role/BYPASSRLS como prova. Mesmo os 8 reads passando, sem inspecionar policies e grants aplicados, não declarar RLS real.
- A API/VIEW de metadados deve impedir leitura por roles não autorizados e não expor bytes originais; segurança é compromisso do backend, não apenas do seletor GET.

## Como conectar após gate explícito (NÃO EXECUTAR EM PROD)
1. Confirmar por escrito ID/nome do projeto *staging*, dono do ambiente e isolamento físico da produção; definir retenção, armazenamento PostgreSQL/Storage e table/view metadata-only; preparar JWT A/B de usuários sintéticos em tenants separados.
2. Aprovar migrations/DDL para staging em gate humano distinto, implementar fonte original append-only (VS5.3e) e preparar reader sob políticas reais.
3. Inspecionar no staging pg_class.relrowsecurity, pg_policies, grants, owner/bypassrls, função/VIEW security mode e validade de identidade sem consultar dados comerciais.
4. Só então instanciar createGuardedStagingReadProbe({project_ref,approved_staging_ref,table_name,publishable_key,jwt_a,jwt_b,fetchImpl:fetch}) no operador autorizado e passar probe para runIsolationMatrix da VS5.3g. Conferir 8/8 READ, negativa cruzada e source OWN válida.
5. Capturar evidência mascarada do **ambiente real** e revisar externamente assinatura Auth, policies, hashes/bytes e ausência de bypasses. O harness sempre declara real_rls_verified=false por contrato até processo de atestação separado.
6. Testes de update/delete negados e imutabilidade física exigem autorização separada; VS5.3h não executa writes.

## Validação de regressão — sem rede
node ferramentas/external-calc-generalization/v0/proof-vs53h.mjs

15 casos esperados: 8 GETs A/B/ANON/ausente simulados; negar ref produtiva, aprovação divergente, path/SQL, role privilegiada, chave não publishable, JWT expirado/emissor incorreto, sub duplicado, ator/ref inválido, redirect, erro 500, vazamento cross-tenant, raw bytes indevidos, múltiplas linhas e falso sucesso quando OWN ausente.

**Evidência CI:** PR #198 DRAFT sobre PR #197, commit 2e14665f5d3775a03a71f29b090913d523ba75de; GitHub Actions Generalization run 39680758512 / job 119502314139: VS53H_OK 1–15 e EXTERNAL_CALC_VS53H_GUARDED_TRANSPORT=PASS checks=15 network=MOCK_ONLY real_rls=NOT_RUN; ownership PASS paths=29 deny=4; seis workflows SUCCESS. Dados reais, JWT assinados e RLS efetiva não foram acessados.

**Estado após prova:** VS53H_TRANSPORT_MOCK=CI_PASS; VS53H_REAL_SUPABASE=NOT_RUN; RELEASE_NO_GO; incidentes #178–#180 pendentes.
