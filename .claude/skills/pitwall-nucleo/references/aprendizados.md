# Aprendizados

Memoria evolutiva da migracao. Decisoes fechadas, armadilhas ja pagas, correcoes de
rumo. Ler no inicio da sessao para nao recomecar do zero; atualizar no fim quando uma
dinamica relevante acontecer. Consolidado a partir do historico de handoffs (ate v24).

## Decisoes fechadas

- Stack: Postgres/Supabase + Cloudflare Worker + frontend vanilla JS. Escolhida e viva.
- Multi-tenant desde a Fase 0, mesmo single-tenant hoje. RLS e `tenant_id` em tudo, para
  nao fazer retrofit de isolamento com dado dentro.
- Cadencia como CONFIG, nao codigo: `cadencia_regra` + `cadencia_perfil`. Ajustar a
  regua e editar dado.
- Banco de scripts com 3 variantes (Direto/Consultivo/Leve) via coluna `variante`,
  constraint unica em `(tenant_id, perfil, passo, variante)`. Assinatura formal so em
  primeiro contato e reativacao apos silencio longo.
- Frontend passou de monolito (`index_brand.html`) para trio legivel
  (`public/index.html` + `app.css` + `app.js`), servido direto sem minificacao. Split
  validado por acorn + harness jsdom + MD5.
- Leaked Password Protection: bloqueado por plano (exige Pro). Registrado como bloqueado,
  nao como pendente de acao. Mitigacao gratuita adotada.

## Armadilhas de seguranca ja pagas

- `CREATE OR REPLACE VIEW` derruba `security_invoker = on` em silencio. Sempre seguir com
  `ALTER VIEW ... SET (security_invoker = on)` e conferir em `pg_class.reloptions`.
- `CREATE OR REPLACE FUNCTION` reseta ACLs para o default. Refazer REVOKE/GRANT depois.
- Corpo de funcao com chamada schema-qualificada nao muda so com `search_path`: editar o
  corpo.
- Helper de RLS em `public` fica exposto ao PostgREST. Mover para `privado`. As 14
  policies passaram a referenciar `privado.*`.
- `authenticated` nunca com TRUNCATE. `anon` sem EXECUTE em funcao.

## Armadilhas de MCP ja pagas

- `execute_sql` so retorna o ultimo statement. Verificacao = chamada separada, ou
  empacotar num `json_build_object` unico.
- `apply_migration` para acento e insert em massa (transacional). `execute_sql` corrompe
  acento em payload grande.
- Simulacao autenticada: `set_config(request.jwt.claims...)` + `set role authenticated`
  antes; `reset role` separado depois.
- Prova destrutiva sem mutar: `DO $$ ... RAISE EXCEPTION 'PROVA >> %', r; END $$`.
- Contagem de usuarios do dashboard e nao confiavel para tabela pequena: consultar
  `auth.users` direto.

## Armadilhas de frontend ja pagas

- Fragmento corrompe. Entregar sempre arquivo completo e fechado.
- No harness jsdom, `init()` e pulado: chamar `renderLista` direto nos testes.
- Checksum como prova exige a receita escrita (campos, separador, ordenacao), senao nao
  e reproduzivel.
- Debug no mobile: capturador de `error` + `unhandledrejection` como toast vermelho,
  porque o dono opera sem console.
- Binding resiliente com `on(id, evt, fn)`: elemento ausente vira warning, init continua.

## Armadilhas de deploy e backup ja pagas

- `name` no `wrangler.jsonc` tem que bater com o Worker no painel, senao o build falha.
- `not_found_handling: single-page-application` protege o hash de recovery de senha.
- Backup: PostgreSQL 17 binario, Session pooler (porta 5432). Direct e IPv6
  (inalcancavel do runner); Transaction pooler (6543) incompativel com `pg_dump`.

## Correcoes de rumo

- `respondido_freia` virou coluna POR PERFIL em `cadencia_perfil`, nao regra global.
  `em_espera` e `comprou` nao freiam por resposta de proposito.
- `sugerir_mensagem` passou a devolver `opcoes[]` com `texto` compat vel na variante 1,
  em vez de um texto so.
- Timebox venceu: o nucleo roda em operacao diaria. O que sobra e melhoria, tratada uma
  frente por vez, sem inercia de migracao.

## Como atualizar este arquivo

No fim de uma sessao com decisao de schema, armadilha nova de RLS/MCP ou correcao de
rumo, adicionar a linha na secao certa. E assim que a skill evolui junto com o sistema.
