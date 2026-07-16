# Backend: Postgres / Supabase

O nucleo do sistema. Postgres gerenciado pela Supabase, com Auth de verdade, RLS em
tudo, auditoria por trigger e a regua em pg_cron. Este arquivo cobre os padroes que nao
podem ser esquecidos entre sessoes.

## Autenticacao

Supabase Auth, email e senha. O UID do dono e `fb2aad8e-b728-4e59-a198-71da2156449d`.
Cada usuario do app tem uma linha em `app_usuario` com `papel` (`dono` ou `vendedor`).
O papel do usuario logado sai de `privado.fn_papel_atual()`, o tenant de
`privado.fn_tenant_atual()`. Ambas no schema `privado` para ficarem fora do PostgREST.

Leaked Password Protection: recurso da Supabase que barra senha ja vazada no cadastro/
troca. BLOQUEADO no plano Free (exige Pro). Mitigacao gratuita: senha de dono forte e
unica, checada na mao em haveibeenpwned.com/Passwords. Reavaliar na fase SaaS, quando
auto-cadastro de usuarios torna a protecao relevante.

## Row Level Security

RLS ligada em todas as tabelas de negocio. Cada policy referencia
`privado.fn_tenant_atual()` para isolar por tenant e, onde faz sentido,
`privado.fn_papel_atual()` para diferenciar dono de vendedor. Padroes que mordem:
- `CREATE OR REPLACE VIEW` derruba `security_invoker = on` em silencio. Sempre seguir
  com `ALTER VIEW ... SET (security_invoker = on)` e conferir em `pg_class.reloptions`.
- `CREATE OR REPLACE FUNCTION` reseta as ACLs para o default do Postgres. Refazer os
  REVOKE/GRANT explicitos depois de toda substituicao.
- Corpo de funcao com chamada schema-qualificada (ex `public.fn_tenant_atual()`) nao e
  redirecionado so mudando `search_path`: editar o corpo tambem.

## Privilegios (hardening ja aplicado)

- `authenticated` com o minimo necessario. TRUNCATE/DELETE/REFERENCES/TRIGGER revogados.
- `anon` sem EXECUTE em nenhuma funcao.
- Helper functions movidas de `public` para `privado`, invisiveis a API.
- As 14 policies de RLS referenciam `privado.*`.
- Advisor de seguranca: rodar `get_advisors` com `type: security`. Zero resultado e
  passe limpo. Rodar depois de qualquer mudanca de schema, funcao ou policy.

## Auditoria append-only

Trigger em cada escrita relevante grava em `auditoria` (tabela, registro_id, acao,
`antes`/`depois` em jsonb, usuario, quando). Prova de auditoria: uma escrita gera
exatamente UM registro com antes e depois corretos. Nunca UPDATE/DELETE em `auditoria`.

## RPC sugerir_mensagem

Estritamente read-only. Recebe o lead, resolve `perfil` + `passo` atual, busca em
`dicionario_scripts`, resolve placeholders (ex `{data_combinada}`) e devolve `opcoes[]`
(as 3 variantes Direto/Consultivo/Leve) mais um campo `texto` compat vel apontando para
a variante 1. Nao grava toque, nao mexe em estado. E a UNICA fonte de texto de
abordagem na Fila (invariante 13).

## pg_cron

`regua_pitwall_diaria` as 08:00 UTC chama `fn_regua_varredura()`. Ver `regua-cadencia.md`
para a logica. Todo numero de cadencia mora em config, nunca no corpo da funcao.

## Padroes de MCP (Supabase)

- `execute_sql` devolve so o resultado do ULTIMO statement do bloco. Cada verificacao e
  uma chamada separada, ou empacotar tudo num `json_build_object` num unico SELECT.
- `apply_migration` e preferido para DDL e insert em massa: lida com acento e payload
  grande, e transacional (rollback total na falha).
- Simular RPC como autenticado: encadear
  `set_config('request.jwt.claims','{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}',false)`
  + `set role authenticated` antes da chamada; `reset role` separado depois (nao combina
  com query que retorna resultado).
- Teste destrutivo sem mutar: envolver em
  `DO $$ ... RAISE EXCEPTION 'PROVA >> %', resultado; END $$` para forcar rollback e
  devolver o resultado capturado na mensagem de erro.
- Contagem de usuarios do dashboard e nao confiavel para tabela pequena: consultar
  `auth.users` direto.

## Backup

Workflow `backup_git.yml` (GitHub Actions): dump GPG-encriptado commitado no repo.
Requer binario do PostgreSQL 17 (`export PATH="/usr/lib/postgresql/17/bin:$PATH"`) e
Session pooler (porta 5432, `pooler.supabase.com`). Direct connection e IPv6
(inalcancavel do runner); Transaction pooler (6543) e incompativel com `pg_dump`.
Restore drill valida os magic bytes `PGDMP` apos decrypt e pre-cria roles e stubs de
auth antes do `pg_restore`.
