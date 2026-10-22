# EXTERNAL CALC — VS5.3M / C01 JWT A/B HTTP (22/10/2026)

## Ponto de partida e escopo
- C01 instalado e validado no PostgreSQL 17 do `external-calc-staging`, ref `mfsshvckclnmftpaprxk` (PitswallV2); prova transacional sintética com ROLLBACK = **PASS**, fonte VS5.3i imutável e permissões verificadas.
- Prova anterior VS5.3k com navegador real e sessões JWT A/B = **9/9 PASS**, mas exercitou **APENAS** source metadata/reading, não RPCs comerciais C01. Não reaproveitar como PASS do C01.
- Prova C01 HTTP assinada = **NOT_RUN** nesta sessão. Nenhum token ou senha foi coletado; não marcar PASS sem JSON/screenshot de execução real.
- Nenhuma escrita nesta execução. Produção `unjzpyexgtbcmjfgcqrx` fora de escopo, **NO_GO**; GitHub Actions proibido.

## Contas, staging e preflight
- Consulta read-only no Supabase validou 2 memberships QA ativas com o mapeamento esperado A/B; todas as RPCs `extcalc_bind_source_supplier_v0`, `extcalc_persist_review_candidate_v0`, `extcalc_persist_auto_promoted_c01_v0` instaladas.
- Tabelas `extcalc_supplier`, `extcalc_review_candidate`, `extcalc_offer_revision` sem registros. A chave publicável do teste VS5.3k V3 corresponde à chave atual desse projeto; não registrar credenciais sensíveis no repositório.
- Erros esperados confrontados com a fonte original do SQL de staging e SQL guard #179.

## Novo verificador local — pacote Windows
Artefato entregue na conversa: `EXTERNAL_CALC_VS53M_C01_JWT_AB_WINDOWS_V1.zip`.
SHA-256 do pacote: `25e680b627401bd339f94adad184da85a04e326a2f09a3d485f9ff08a7187f8e`.
Contém seis arquivos: `TESTE_C01_JWT_AB_STAGING_V1.html`, `SERVIDOR_LOCAL_C01_V1.cjs`, `INICIAR_TESTE_C01_WINDOWS.cmd`, `TESTAR_SERVIDOR_LOCAL.cjs`, `TESTAR_INTERFACE_LOCAL.cjs`, `LEIA_PRIMEIRO_VS53M.txt`.

Reusa a arquitetura VS5.3k V3, que já passou com Auth A/B real: Node.js sem dependências; servidor exclusivamente `127.0.0.1:8767`, API externa fixa `https://mfsshvckclnmftpaprxk.supabase.co`, sessão obtida em `/auth/v1/token`, verificação independente de UID QA em `/auth/v1/user`. Zero scripts externos, telemetria, armazenamento local, logs de senha/token ou endpoint arbitrário. O proxy aceita só uma allowlist de 12 casos e não aceita payload RPC arbitrário do navegador. Relatório exportável não contém senha/e-mail/JWT/chave.

## Casos VS5.3M (12)
1–3: as três RPCs negam papel anônimo;
4–5: A não vincula fonte B, B não vincula fonte A;
6: fonte A quarentenada não pode ser vinculada;
7–8: fornecedor inexistente é recusado para a fonte correta de A e B;
9–10: `p_candidate={}` rejeitado por A e B;
11–12: `p_promoted={}` rejeitado por A e B.
Assert de negócio exige erro HTTP 4xx e código `P0001` com mensagem exata da guarda; para anônimo, aceita negação de privilégios `42501` ou RPC não visível `PGRST202` 404. Não aceitar erro 5xx, resposta 2xx, URL errada ou mero token decodificado.

## Provas desta execução
- `node --check` do server e JS da interface = PASS.
- `TESTAR_SERVIDOR_LOCAL.cjs` com upstream simulado (sem rede Supabase): `VS53M_LOCAL_TRANSPORT_MOCK=PASS`; protege origin/host, lista de 12 RPC cases, nega rota arbitrária e requisições sem papel apropriado.
- `TESTAR_INTERFACE_LOCAL.cjs` com DOM e HTTP simulados: `VS53M_BROWSER_LOGIC_MOCK=PASS`, cobre 12/12 cenário simulado e FAIL_CLOSED ao adulterar uma resposta; tokens e senhas não aparecem no relatório.
- **Estes testes locais NÃO equivalem a JWT assinado real**.

## Como continuar — sem intervenção no banco
1. Usuário extrai ZIP no Windows, executa `INICIAR_TESTE_C01_WINDOWS.cmd`.
2. A página local abre `http://127.0.0.1:8767/`; clique Testar conexão.
3. Usuário informa os mesmos logins A/B do VS5.3k, localmente, sem enviar a conversa.
4. Clique `Executar 12 testes C01`; exporte o relatório sem credenciais ou print do resultado; análise exige PASS 12/12 + `authenticated_users_verified_via_auth_user=true` + `simulated_tokens=false`.
5. Reconsultar read-only Supabase após prova: 0 suppliers/bindings/candidates/revisions e fontes originais 3, eventos 1. Qualquer diferença = FAIL_CLOSED.
6. Com 12/12 e pós-conciliação OK, promover apenas `VS53M_C01_SIGNED_JWT_NEGATIVE_AB=PASS`; ainda falta teste **positivo E2E**, holdout, incidentes PRs #178–#180 e release humano. Produção NO_GO.

## Restrições
Os casos são projetados para rejeição e não intencionam persistência. Uma regressão severa poderia gerar efeito colateral no staging; sempre auditar linhas após a execução. Não criar permissões extras, serviços pagos, novos usuários, token fixo em arquivo, CI/GitHub Actions, migração produtiva ou merge.
