# HANDOFF — Pitstop Upgrade Cloudflare → Pitwall V2
Data de consolidação: 2026-11-12 (America/Sao_Paulo)

## 0. Ponto de retomada e fonte principal
- Repositório de execução: `vinialbuquerquepitstop-beep/pitwall--nucleo`
- Branch: `feat/upv1-catalog-capture-on-main`; PR draft [#207](https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo/pull/207)
- SHA confirmado ANTES da criação deste handoff: `a4a396a1d13d190d6cba759d2bf5559dec093f69` (refazer leitura do HEAD após esta gravação)
- Núcleo canônico: `vinialbuquerquepitstop-beep/pitswal-v2` / `feature/upv1-crm-v2-intake`, draft [PR #40](https://github.com/vinialbuquerquepitstop-beep/pitswal-v2/pull/40), SHA verificado `4a369060f0b771614103b484655008696f8859c2`
- Source manifest: `worker/upgrade-v2-core/source-manifest.json` (blobs canônicos do intake/delivery; não copiar versões divergentes).
- README do núcleo indica que commits na main podem acionar Workers Builds. **Não efetuar merge sem autorização específica.**
- `AGENTS.md` não localizado na raiz deste repositório, README verificado. Manter o método TREE existente.

## 1. Objetivo/arquitetura aprovada
Link Instagram → página pública `/upgrade/` no Worker Cloudflare **existente** `flat-resonance-09ba` → `POST /api/upgrade/v1/lead` com antiabuso → Hyperdrive dedicado `UPGRADE_V2_DB_INGRESS` → banco Supabase **Pitwall V2** → recibo privado → reconciliação do lead por operador autorizado → **um único CRM Pitwall V2**.
- Cloudflare Workers + static assets: `worker/external-calc-worker.mjs`, `public/upgrade/index.html`, `wrangler.jsonc`.
- Backend da External Calc, Hyperdrive legado `UPGRADE_DB` e banco `unjzpyexgtbcmjfgcqrx` **NÃO** são ingress V2.
- CRM atual AppDeploy `pitswall-v2-preview-s00-4-uv6a46` deve ficar intacto. Não criar segundo CRM, outro Worker, staging ou preview publicado.

## 2. DoD do slice de integração
Funcional: cliente escolhe iPhone, informa troca opcional (ou nenhuma), preferência à vista/6/10/12/18 parcelas, nome, WhatsApp, endereço opcional, consentimento; recebe referência idempotente.
Dependências: Hyperdrive V2 com role PostgreSQL restrita, rate limiter de borda, HMAC IP, organização fixada no backend, RLS/identidade, operador CRM separadamente autorizado.
Aceite: sem preços inventados; rejeição de payload inválido; 429 antes de DB; retry idêntico em timeout; HTTP 400 libera correção com nova chave; nenhuma exposição de credenciais; controle de tenant.
Prova: testes do HEAD exato, build Worker real, 404/503 fail-closed enquanto OFF, conexão segura, teste controlado com recibo antes de habilitar uso comercial, E2E do operador/CRM e rollback.
Recuperação: manter flags `UPGRADE_V2_PUBLIC_ENABLED=false`, `UPGRADE_V2_OPERATOR_ENABLED=false`, preservar versão publicada e binding legado; rollback do Worker por versão se houver autorização de publicar e defeito.

## 3. Implementado no código, NÃO PUBLICADO
- Landing em três etapas; escolha manual quando catálogo V2 não está aprovado; troca opcional (`trade_in:null`), endereço opcional e origem Instagram definida no servidor.
- Parcelamento é **preferência**, não cotação: integração de preços, stock e simulação real da External Calc ainda pendente de contrato financeiro autorizado. Botão automático permanece desabilitado.
- `modules/upgrade/crm-v2/upgrade-intake.cjs`: validação estrita, consentimento, replay hash, isolamento de organização. `upgrade-delivery.cjs`: dados do lead, observações de endereço/troca e origem orgânica.
- Fluxo de HTTP 400 e timeout diferenciado: 400 confirmado permite corrigir e nova chave; falha incerta preserva snapshot original e chave, sem prometer que não gravou. Refresh perde chave; interface orienta evitar recarga.
- `worker/upgrade-v2-route-guard.cjs`: fluxo V2 somente, fail-closed; `worker/upgrade-v2-edge-abuse.cjs`: rate limiter/HMAC por IP; `worker/upgrade-v2-direct-ingress.cjs`: ingresso dedicado e escopo PostgreSQL.
- Revisar SHA do branch antes de reutilizar resultados anteriores. Provas executadas em sandbox Node (mocks de banco, não produção): núcleo 15/15, landing com no-trade 9/9 e testes adicionais HTTP 8/8 em rodadas específicas; não equivale a build real Cloudflare nem navegador real.

## 4. Realidade observada em 2026-11-12
**COMPROVADO**
- Cloudflare conta ID `87c4f759874a24d8862139945ea8e1b3`. Worker existente `flat-resonance-09ba`. URL `https://flat-resonance-09ba.pitstopimports.workers.dev`.
- Hyperdrives existentes: `pitstop-connect-hub-staging-db` ID `6a35651fc97f4a34b0850fbc9abc0de7` (Neon, não usar), `pitstop-upgrade-v1-db` ID `3b2d749f7ee74994aa149c601217b6f7` (Supabase legado, não usar).
- NÃO há `pitwall-v2-upgrade-ingress`, nem binding `UPGRADE_V2_DB_INGRESS` no Worker publicado; nenhuma flag V2 está publicada como habilitada.
- Supabase V2 project ref `wmtzmodavmipmcqybpqs`. Host direto `db.wmtzmodavmipmcqybpqs.supabase.co`, porta 5432, DB `postgres`, role `pw_upgrade_ingress_backend_login`.
- PostgreSQL `pw_upgrade_ingress_backend_login`: LOGIN true, BYPASSRLS false, **SEM SENHA** (`rolpassword IS NULL`). Papel de acesso `pw_upgrade_ingress` tem GRANTs mínimos por coluna confirmados: INSERT campos do recibo; SELECT id/hash/organização/chave e vínculo de serviço; UPDATE/DELETE e leitura de WhatsApp negados. RLS e FORCE RLS mantidos.
- Organização fixada no backend `501bca7d-0833-4f99-bb3c-bbc2f82c4a6c`.
**NÃO VERIFICADO**
- Build/bundle real Worker da branch; conexão do login dedicado; INSERT real; E2E CRM; visibilidade visual no navegador; preços publicados reais.
**BLOQUEIO OPERACIONAL**
- Hyperdrive requer credencial de origem. Sem senha do login dedicado, NÃO criar configuração fictícia nem reutilizar banco External Calc.

## 5. Próxima ação mínima (TREE: FUNDAÇÃO → EXECUÇÃO → PROVA)
1. Em um canal administrativo seguro para PostgreSQL, provisionar senha aleatória e exclusiva para `pw_upgrade_ingress_backend_login`. **Não** registrar senha em GitHub, chat, SQL salvos, URLs, logs, imagens ou arquivos. Preferir conexão interativa protegida (ex.: psql `\\password pw_upgrade_ingress_backend_login` com acesso administrativo aprovado); validar `rolpassword IS NOT NULL` por consulta somente-leitura. Não modificar role operador.
2. Com segredo mantido na interface protegida Cloudflare, criar a configuração Hyperdrive **no mesmo account**: nome `pitwall-v2-upgrade-ingress`; esquema PostgreSQL; host `db.wmtzmodavmipmcqybpqs.supabase.co`; porta `5432`; DB `postgres`; usuário `pw_upgrade_ingress_backend_login`; TLS exigido e validação adequada ao certificado; **caching.disabled=true**. Cloudflare valida conexão na criação. Nunca usar role postgres/service_role.
3. Com ID criado, preparar alteração mínima de `wrangler.jsonc` acrescentando binding `UPGRADE_V2_DB_INGRESS` com esse ID, preservando `UPGRADE_DB`. Não fazer deploy nem merge sem autorização específica. HMAC/IP limiter e binding V2 validados antes de ativar flag. Manter V2 OFF.
4. Gate de publicação isolado: comparar fonte e versão live, plano de rollback, deploy autorizado com OFF → testar 404/503 e regressões existentes → execução privada controlada do INSERT usando identidade restrita → autorização **separada** para ativação comercial e reconciliação CRM. Não confundir PASS técnico com autorização.

## 6. Comandos/consultas de verificação (somente leitura)
```sql
SELECT rolcanlogin, rolbypassrls, rolpassword IS NOT NULL AS has_password
FROM pg_authid WHERE rolname='pw_upgrade_ingress_backend_login';
SELECT has_column_privilege('pw_upgrade_ingress','pitwall_private.pw_upgrade_requests','organization_id','INSERT') AS can_insert,
 has_column_privilege('pw_upgrade_ingress','pitwall_private.pw_upgrade_requests','id','SELECT') AS can_read_id,
 has_table_privilege('pw_upgrade_ingress','pitwall_private.pw_upgrade_requests','UPDATE') AS can_update;
```
Retomar pela leitura do HEAD e deste handoff. Sem novos protocolos/checkpoints redundantes; corrigir apenas delta com risco material.

## 9. Continuidade sem desbloqueio de credencial (12/11/2026)
A pedido do owner, o gate de senha PostgreSQL + criação do Hyperdrive V2 foi adiado; **não é autorização para ativação, deploy ou escrita comercial**. Avanço no delta da interface pública: hero, etiqueta, step 2, resumo lateral e descrição da última etapa deixam explícito que a troca é opcional e que preços/parcelas dependem de confirmação. Código em `public/upgrade/index.html` e regressão em `worker/upgrade-public-manual-flow.test.cjs`; execução do código atual no sandbox Node: **10/10 PASS**, sem conexão financeira real. A API financeira presente em `ferramentas/external-calc-public-upgrade/v0` é uma implementação LEGADA de publicação/cotação e não está montada nas rotas públicas do Worker V2; não reativá-la ou reutilizar captura legada para contornar o gate. Próximo slice financeiro requer contrato/catálogo V2 autorizado, precificação canônica e prova de fonte real antes de apresentar valores ao cliente.

## 10. UP-CATALOG-V2 | Projeção segura de modelos (12/11/2026)
Criado `worker/upgrade-v2-approved-catalog.cjs` com adaptador fail-closed, fonte de publicações aprovada injetada apenas pelo servidor, tenant fixo, validação de status/validade/revisão e projeção **somente** de modelo/capacidade/condição. Não importa módulos nem conexões da API legada, não expõe preço/custo/fornecedor/ID e permanece OFF. Testes em `worker/upgrade-v2-approved-catalog.test.cjs`, **8/8 PASS** em sandbox Node efêmero sem rede. É fundação de catálogo, NÃO é catálogo publicado: falta conectar o leitor real aprovado e provar a fonte financeira e o runtime Cloudflare. Flags públicas OFF, sem deploy/merge/migration/escrita comercial. Gate de Hyperdrive mantido adiado por decisão do owner.

## 11. Infraestrutura Cloudflare V2 criada e associada na branch (12/11/2026)
- Supabase login `pw_upgrade_ingress_backend_login`: `rolpassword IS NOT NULL`; role não tem BYPASSRLS. Verificado vínculo `pw_upgrade_ingress`: `inherit_option=false`, `set_option=true`, `pg_has_role(...,'SET')=true`, compatível com `SET LOCAL ROLE` no escopo V2.
- Cloudflare Hyperdrive dedicado **criado pelo owner** `pitwall-v2-upgrade-ingress`, ID `46ef09094f34420490a060efd9297d62`; origem `db.wmtzmodavmipmcqybpqs.supabase.co:5432/postgres`, login `pw_upgrade_ingress_backend_login`. **Cache SQL desativado** e **TLS sslmode=require** corrigidos por API e comprovados após gravação; senha nunca exibida.
- `wrangler.jsonc` da branch do PR #207 inclui binding `UPGRADE_V2_DB_INGRESS` ID acima, mantendo `UPGRADE_DB` legado e flags `UPGRADE_V2_PUBLIC_ENABLED=false` e `UPGRADE_V2_OPERATOR_ENABLED=false`; associação **não publicada**. Confirmação estática por leitura da branch passou.
- **NÃO VERIFICADO:** conexão efetiva via Hyperdrive / teste SQL da role, bundle/build Workers, prova de INSERT real, binding no Worker publicado. Nenhum deploy, merge ou escrita comercial foi autorizado/executado. Próximo gate técnico: build da branch sem deploy e preflight da identidade; após autorização expressa de publicação, deploy com as flags OFF e rollback conhecido antes de testar conexão/recibo controlado.

## 12. Build Cloudflare sem deploy — prova do SHA 7f3a8df (12/11/2026)
- Repo completo clonado em sandbox descartável, HEAD `7f3a8df867ad29cf13c92558f3f7588d746bd13e`; `npm install --no-save --package-lock=false --ignore-scripts wrangler@4 pg@8.16.3` apenas no sandbox (sem commit/lockfile); Wrangler 4.161.0.
- `npx wrangler deploy --dry-run --outdir /tmp/pitwall-upgrade-v2-build`: **PASS exit 0**, bundle `external-calc-worker.js` gerado, 12 assets, 738.11 KiB bruto / 146.27 KiB gzip, reconheceu `UPGRADE_DB`, `UPGRADE_V2_DB_INGRESS` (ID `46ef09094f34420490a060efd9297d62`), limiter e flags `UPGRADE_V2_PUBLIC_ENABLED=false` e `UPGRADE_V2_OPERATOR_ENABLED=false`.
- `node --test worker/upgrade-v2-route-guard.test.cjs worker/upgrade-v2-direct-ingress.test.cjs worker/upgrade-public-manual-flow.test.cjs worker/upgrade-v2-approved-catalog.test.cjs`: **31/31 PASS, exit 0**; testes simulam banco e request, não provam SQL remoto.
- Configuração LIVE do Worker consultada via Cloudflare: binding `UPGRADE_V2_DB_INGRESS` e secret `UPGRADE_V2_IP_HMAC_SECRET` ainda ausentes no deploy; flags V2 não constam como publicadas. Logo **NÃO** executar captura real / não habilitar flag. Hyperdrive existe como recurso separado.
- Próxima ação mínima: provisionar o segredo HMAC por mecanismo protegido sem divulgá-lo em conversas ou código; preparar rollback e autorização expressa de deploy com ambas as flags V2 OFF. Só então provar no runtime publicado a conectividade, RBAC/RLS e recibo controlado, com autorização específica de escrita de teste. Não ativar uso comercial antes da homologação.

## 13. Preflight de publicação e rollback (13/11/2026)
- PR #207 HEAD inspecionado: `da86a9b7fdcf87d12c86596ad3f21ee243f77719`, permanece DRAFT. Build Wrangler `dry-run` PASS e testes 31/31 do mesmo código documentados na seção 12; **não repetir sem delta concreto**.
- Deploy **atualmente ao vivo** do Worker `flat-resonance-09ba`: deployment `8487bc70-b01c-4be7-96e2-4e8fd1446e36`, versão `d31c3992-6cfc-422d-b682-670a4bc53929` (100%; version number 2149; de 2026-11-10T23:54:14Z). Versão anterior conhecida `9aa24494-241b-4ac5-8917-c278c0ab6a88` (não usar como rollback por padrão). **Rollback alvo** é a versão 2149 acima, desde que essa ainda seja a versão ativa no preflight imediato ao deploy; se mudar, reler a versão ativa.
- **DEFEITO DE PARIDADE PRÉ-DEPLOY:** `UPGRADE_DB_PROBE_ENABLED` publicado está `true`, enquanto `wrangler.jsonc` da branch traz `false`. Deploy direto da branch alteraria comportamento fora do slice; manter bloqueado até reconciliar explicitamente a configuração desejada, preservando contratos legados e sem tocar no Worker vivo agora. Não mudar o valor silenciosamente.
- **BLOQUEIO:** `UPGRADE_V2_IP_HMAC_SECRET` inexistente no Worker publicado. O segredo precisa de criação por canal protegido; verificar se o mecanismo de secrets da Cloudflare gera nova versão/deploy antes de executar. Não usar valores em texto, arquivo, GitHub ou logs.
- V2 ingress binding `UPGRADE_V2_DB_INGRESS` só existe no `wrangler.jsonc` da branch; ausente no Worker live. `UPGRADE_V2_PUBLIC_ENABLED`/`UPGRADE_V2_OPERATOR_ENABLED` continuam OFF na branch e ausentes na versão publicada. Não habilitar.
- **NEXT:** reconciliar delta entre bindings/vars do live e config da branch, escolher procedimento de segredo que não publique involuntariamente, validar rollback ativo e obter autorização **específica** de deploy com V2 OFF. Teste SQL real e captura controlada não autorizados. Sem merge/deploy/migration/escrita comercial nesta rodada.

## 14. Correção do drift de probe e gate do segredo (13/11/2026)
- Defeito de paridade do preflight (seção 13) **corrigido na branch**: `wrangler.jsonc` agora mantém `UPGRADE_DB_PROBE_ENABLED=true`, igual ao Worker publicado; a rota `_db-probe` existente exige token secreto Bearer, POST e faz duas consultas somente-leitura. Nenhuma mudança em produção.
- Prova do delta no SHA `0d1d0dbee04695cc7ce54314c35acbcb96dbe8f4`: `node --test worker/upgrade-hyperdrive-probe.test.cjs` **8/8 PASS**. O novo teste valida o valor do probe, os dois bindings independentes e ambas flags V2 OFF. O build Wrangler previamente aprovado corresponde a um SHA anterior; mudança apenas no valor da flag (não alegar novo build).
- **Secret HMAC** `UPGRADE_V2_IP_HMAC_SECRET` ainda não configurado no Worker live. Segundo a documentação Cloudflare, dashboard > Variables and Secrets > Add > Secret > Deploy e `wrangler secret put` publicam uma nova versão. Para não executar deploy involuntário, **não usar esses caminhos sem autorização**. `wrangler versions secret put` pode criar versão não ativada, mas exige canal protegido para fornecer a credencial e procedimento de gestão de versões autorizado; não criar segredo fictício nem exibi-lo em ferramenta/chats.
- Próxima ação: autorização expressa de preparação/publicação de versão (com flags V2 OFF, segredos protegidos e rollback da versão live reconfirmada), ou provisionamento em painel como parte do deploy coordenado; em seguida prova de conexão SQL controlada. Não assumir liberação comercial.
