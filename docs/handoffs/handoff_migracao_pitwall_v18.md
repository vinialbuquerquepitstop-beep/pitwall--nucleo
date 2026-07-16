# Handoff Migracao Pit Wall 2.0 (Nucleo) — v18

## Como usar este documento
Este handoff SUBSTITUI o v17 e todos os anteriores. Comece por "Estado em uma frase", "O que mudou nesta sessao" e "Primeiro movimento do proximo chat".

Convencao de escrita: prosa sem acento, sem cedilha, sem travessao. EXCECAO obrigatoria: valores reais do sistema carregam seus proprios caracteres e nao se mexe (rotulos de cadencia com o ponto do meio U+00B7 como `R3 · D14`, nome da aba `Pitstop Imports — CRM de Clientes` com em-dash U+2014, status com emoji, `--morno` = `#f2a71b`, marca `#0025cc`). **A copy dos scripts em `dicionario_scripts` e texto para CLIENTE: leva acento e cedilha normais e nao se normaliza.**

---

## Estado em uma frase
**Fase 3 FECHADA e seguranca FECHADA.** O motor `pg_cron` foi observado rodando em producao (12/07 e 13/07, `succeeded`), a superficie de privilegios do banco foi reduzida ao minimo e provada, e dois bugs de fuso horario nao registrados foram achados e corrigidos. **O unico bloqueio restante e o frontend da Fase 3.5**, que depende do `index_brand.html` ser enviado no chat.

---

## O que mudou nesta sessao

### 1. Fase 3 fechada: cron observado em producao
```
jobid 1 | 2026-07-12 08:00 UTC | succeeded
jobid 1 | 2026-07-13 08:00 UTC | succeeded
```
Era a unica parte da Fase 3 nunca observada. **Fecha. Nao reabrir.**

### 2. BUG DE FUSO #1 (novo, nao estava em nenhum handoff)
O banco roda em **UTC**. A operacao roda em **America/Sao_Paulo**. `fn_regua_varredura()` ja usava `(now() at time zone 'America/Sao_Paulo')::date` corretamente, mas a `v_lead` NAO.

- `v_lead.cadencia_dias_para` usava `CURRENT_DATE` (UTC).
- Efeito: das 21:00 as 00:00 BRT, o app mostrava **1 dia a mais de atraso** do que o motor enxergava. Exatamente a janela em que o dono opera no celular.
- Corrigido (migration `corrigir_fuso_cadencia_dias_para_v_lead`): agora usa `(now() at time zone 'America/Sao_Paulo')::date`.
- **`security_invoker` caiu no `create or replace view` e foi restaurado** (migration `restaurar_security_invoker_v_lead`). A armadilha do handoff v17 se confirmou na pratica.

### 3. BUG DE FUSO #2 (novo, MAIS GRAVE)
`cadastrar_lead` usava `current_date` (UTC) para `data_contato` e `proximo_contato`.
- Efeito: **lead cadastrado depois das 21:00 BRT nascia datado AMANHA** e sumia da fila do dia. Perda silenciosa de lead.
- Corrigido na migration `seg_e_corrigir_cadastrar_lead_helper_e_fuso` (variavel `v_hoje` em fuso BR).
- **Comprovado:** teste pos-fix devolveu `data_contato = 2026-07-13` com hora BR 22:xx, quando antes teria gravado 14/07.

### 4. TRILHA DE SEGURANCA COMPLETA (4 migrations)

**`seg_a_revogar_anon_schema_public`**
- `anon` tinha `arwdDxtm` (tudo, inclusive TRUNCATE) em 9 objetos.
- Revogado de tabelas, views, sequences, funcoes **e do proprio schema (`USAGE`)**.
- `anon` agora nao existe no schema `public`.

**`seg_b_minimo_privilegio_authenticated`**
- **Achado maior que o do v17:** `authenticated` tambem tinha `arwdDxtm` em tudo.
- **A RLS NUNCA bloqueia `TRUNCATE`.** O grant `D` em `public.lead` era um buraco real, nao teorico.
- Reduzido ao minimo comprovado no codigo das RPCs:
  - `SELECT` em todas as tabelas (RLS filtra)
  - `INSERT, UPDATE` em `lead`
  - `INSERT` em `lead_evento` e `evento_uso`
  - **Nada mais.** Sem DELETE, sem TRUNCATE, sem REFERENCES, sem TRIGGER.
- `auditoria` nao recebeu INSERT: `fn_auditar` e `SECURITY DEFINER` e escreve como `postgres`.

**`seg_c_fechar_execute_publico_em_funcoes_futuras`**
- Postgres concede `EXECUTE` a `PUBLIC` em TODA funcao nova por padrao. Foi essa fresta que gerou o retrabalho manual da trilha B1.
- Fechado na origem via `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM public`.

**`seg_d_mover_helpers_rls_para_schema_privado`** + **`seg_e_...`**
- `fn_tenant_atual()` e `fn_papel_atual()` eram `SECURITY DEFINER` **expostas como endpoint REST** (`/rest/v1/rpc/fn_tenant_atual`).
- Movidas para o schema **`privado`**, que o PostgREST nao expoe (so `public` e `graphql_public`).
- **14 policies recriadas** apontando para `privado.*`. (`p_rotulos_select` nao usa os helpers e ficou intacta. Total: 15 policies.)
- `public.fn_tenant_atual` e `public.fn_papel_atual` foram **dropadas**.

### 5. A TORNEIRA (o achado estrutural mais importante)
O `ALTER DEFAULT PRIVILEGES` do schema `public` estava **reabrindo o buraco a cada objeto novo**: toda tabela e funcao futura nascia com grant total para `anon`.

Sem fechar isso, a faxina de seguranca teria que ser refeita na Fase 4, na Fase 5 e em cada tenant novo do SaaS.

Estado final dos defaults (papel criador `postgres`, que e quem roda as migrations):
| Objeto futuro | ACL padrao |
|---|---|
| tabelas/views | `authenticated=r` apenas. Sem anon. |
| sequences | ninguem alem de postgres/service_role. |
| funcoes | `authenticated=X`. Sem anon, **sem PUBLIC**. |

Nota: os defaults do papel `supabase_admin` ainda concedem tudo pro `anon`, mas **nao se aplicam** porque as migrations rodam como `postgres`. Nao ha como altera-los e nao ha necessidade.

---

## PROVAS EXECUTADAS (nao "a migration passou")

**Licao central desta sessao: `apply_migration` retornar `success` NAO prova que o app funciona.** A migration `seg_d` passou limpa e mesmo assim **quebrou `cadastrar_lead`**, porque o corpo da funcao chamava `public.fn_tenant_atual()` **schema-qualificado** (o `search_path` nao resolve chamada qualificada). So o teste funcional pegou.

| Prova | Resultado |
|---|---|
| `truncate public.lead` como `authenticated` | BLOQUEADO (sem grant) |
| `delete from public.lead` como `authenticated` | BLOQUEADO (sem grant) |
| `select from public.lead` como `anon` | BLOQUEADO (sem grant) |
| Isolamento: JWT de UUID inexistente | `fn_tenant_atual = NULL`, **0 linhas em 11 tabelas** |
| Leitura com JWT do dono | 15 leads, 20 eventos, 13 cadencias, 12 scripts, 27 rotulos, 212 auditorias |
| `cadastrar_lead` | `ok=true`, LEAD-0016, `data_contato` = data BR correta |
| `registrar_toque` / `registrar_conversando` / `reagendar_proximo_contato` / `sugerir_mensagem` / `arquivar_lead` | todas `ok=true` |
| Auditoria durante o teste | `+10` linhas (append-only vivo) |
| `fn_regua_varredura()` | `ok=true`, data `2026-07-13`, 2 avancos pendentes |
| Advisor Supabase (security) | **zero lint de banco** |
| Dado real apos todos os testes | 15 leads, 212 auditorias, 15 policies. **Nada vazou.** |

**Padrao de teste destrutivo seguro (reusar sempre):** bloco `do $$ ... raise exception 'PROVA >> %', resultado; end $$;`. A exception forca `rollback` de tudo e devolve o resultado na mensagem de erro. Permite testar RPCs de escrita contra dado real sem sujar dado real.

---

## Estado operacional do funil (13/07, hora BR)

15 leads, 13 com cadencia, **8 vencidos**. O dono tocou Zana (LEAD-0004) e Clara (LEAD-0015) em 13/07 as 21:54 BRT, **depois** do cron das 05:00 — por isso o motor ainda nao avancou os dois. O cron de 14/07 as 05:00 vai fazer exatamente esses 2 avancos (comprovado em dry-run).

**Regra 1 nao avanca sem toque.** Lead vencido fica vencido para sempre se o dono nao tocar. Isso e o desenho CORRETO: a regua nao resolve aderencia, ela torna a omissao inescapavel.

---

## Primeiro movimento do proximo chat

1. **Frontend da Fase 3.5. E o unico bloqueio real, ha tres sessoes.**
   O dono precisa **colar/subir o `index_brand.html` no chat**. O repo GitHub e PRIVADO: `raw.githubusercontent.com` retorna 404. **Claude NAO consegue buscar sozinho. Nao gastar turno tentando.**

   Entrega prevista, arquivo completo e validado (Acorn `sourceType: 'script'` + jsdom), num deploy manual so:
   - `cadencia_rotulo` no card do lead;
   - marcador de atraso quando `cadencia_dias_para < 0`;
   - botao de sugestao de mensagem chamando a RPC `sugerir_mensagem`.

   Contrato ja definido, so plugar:
   ```js
   const r = await chamarRPC('sugerir_mensagem', { p_lead_id: leadId });
   if (r.ok) {
     const link = r.whatsapp
       ? `https://wa.me/${r.whatsapp}?text=${encodeURIComponent(r.texto)}`
       : null; // sem telefone: mostrar o texto para copiar
   }
   ```
   O `encodeURIComponent` fica no JS DE PROPOSITO: Postgres nao tem urlencode nativo.

2. **Revisar a copy dos 12 scripts** com a skill de conteudo. A copy semeada e FUNCIONAL, **nao e a voz da Pitstop**. Cadencia com script generico e pior que cadencia sem script.

3. **Abas novas** (o dono sinalizou interesse). Cravar o escopo antes de codar.

---

## Pendencias abertas

1. **[dono, BLOQUEIO] Subir o `index_brand.html` no chat.** Trava toda a entrega visivel da Fase 3.5.
2. **[dono, painel] Ativar Leaked Password Protection** (Authentication > Sign In / Providers). **Unica pendencia de seguranca que sobrou.** Pode exigir plano Pro.
3. **[dono, conteudo] Revisar os 12 scripts semeados.** Copy generica em cliente real e risco de marca.
4. **[dono] Telefones de Yasmim (LEAD-0007) e Erickao (LEAD-0008).** Sem telefone nao existe deep link, so texto pra copiar. **Erickao vence 18/07** (lembrete pre-data). Confirmar tambem Miguel (LEAD-0013): ativo ou frio.
5. **[dono, painel] Rate limits de Auth:** confirmar limites padrao do FREE ativos.
6. **[adiado conscientemente] MFA/TOTP.** Exige fluxo de enrollment no frontend. Fase 5.
7. **Registrar dominio proprio** (some o `flat-resonance-09ba`).
8. **Digest diario:** segundo job `pg_cron` com o resumo do dia. Canal em aberto.
9. **Fase 4:** aposentar a planilha do CRM, reapontar o sync do Notion. Pipeline de CONTEUDO segue INTEIRO no Apps Script antigo, intocado.
10. **Aba de aniversariantes** (Fase 5). Depende de `data_nascimento` em massa.
11. **Metricas/dashboard** (Fase 5). Cravar o que mede antes de construir.
12. **SaaS:** Fase A, validar demanda com sinal de pagamento. Interesse nao e pagamento.

---

## Invariantes (atualizadas)

- Toda escrita gera registro de auditoria append-only (`fn_auditar`).
- Escrita do app so por RPC; o frontend nunca escreve direto em tabela.
- Nivel derivado na leitura, nunca armazenado (`v_lead`: 0-2 quente, 3-6 morno, 7+ frio).
- `security_invoker = on` em toda view sobre tabela com RLS. **Reconfirmar apos todo `create or replace view`** (confirmado nesta sessao: a opcao CAI de verdade).
- "Toque enviado" e "Respondido" NUNCA colapsam num evento so.
- **WhatsApp so ABRE, nunca registra toque.** `sugerir_mensagem` e read-only por desenho.
- Arquivamento e irreversivel no app; nao existe hard delete de lead com historico.
- `--morno` (`#f2a71b`) e semantico e NUNCA se unifica com a marca `#0025cc`.
- **Cadencia e CONFIGURACAO, nunca codigo.** Nenhum numero de dia dentro de `fn_regua_varredura()`.
- **Copy tambem e CONFIGURACAO, nunca codigo.** Tudo em `dicionario_scripts`.
- **A chave do script e `perfil` + `passo` (inteiro), nunca o rotulo.**
- Toda tabela auditada precisa de coluna `id` (`fn_auditar` grava `registro_id = new.id`).
- **[NOVA] O banco esta em UTC; a operacao esta em America/Sao_Paulo.** TODA data de negocio usa `(now() at time zone 'America/Sao_Paulo')::date`. **`current_date` e `CURRENT_DATE` estao PROIBIDOS** em funcao, view ou policy que produza data de negocio.
- **[NOVA] Helper de RLS (`SECURITY DEFINER`) mora no schema `privado`, nunca em `public`.** `public` e exposto pelo PostgREST; `privado` nao.
- **[NOVA] `authenticated` nunca recebe `TRUNCATE`, `DELETE`, `REFERENCES` ou `TRIGGER`.** A RLS **nao** protege contra TRUNCATE.
- **[NOVA] Tabela nova nasce com `SELECT` para `authenticated` e nada mais.** Escrita e grant explicito, decidido caso a caso.

---

## AS REGRAS DO MOTOR (contrato, inalterado)
- **Regra 0, inicializacao.** Lead com `perfil`, nao arquivado, status em (`pendente`,`feito`,`convertido`) e sem linha em `cadencia_estado` ganha cadencia no passo 1. NUNCA sobrescreve `proximo_contato` definido pelo operador. Evento `cadencia_iniciada`.
- **Regra 1, avanco verificado por toque.** So avanca se o toque (em data BR) for >= `passo_vence_em`. Sem toque, NAO avanca. O novo vencimento conta a partir do TOQUE, nao de hoje. Evento `cadencia_avancou`.
- **Freio (`respondido_em`)** e configuravel por perfil (`respondido_freia`), nao lei global. Perseguicao = `true`. Agendado e relacionamento (`em_espera`, `comprou`) = `false`.
- **Regra 2, fim de cadencia** (ultimo passo, com toque, sem resposta, silencio >= `limite_silencio_dias`). PRECEDENCIA: 1) `perfil_seguinte` -> TRANSICIONA; 2) senao `permite_esfriar` -> `lista_fria`; 3) senao encerra.
- **Idempotente.** Rodar duas vezes no mesmo dia: zero acoes na segunda.

## A CADENCIA VIGENTE (tenant Pitstop, tudo editavel por UPDATE)

| Perfil | Passos | Cadencia | Limite silencio | Esfria | Resp. freia | Vai para |
|---|---|---|---|---|---|---|
| `compra_imediata` | 8 | D0 → D1 → D3 → D7 → D14 → D30 → D60 → D90 | 15 d | sim | sim | repescagem |
| `consulta` | 7 | D0 → D2 → D5 → D10 → D20 → D35 → D60 | 15 d | sim | sim | repescagem |
| `avaliando` | 6 | D0 → D3 → D7 → D14 → D30 → D60 | 15 d | sim | sim | repescagem |
| `em_espera` | 3 | `R1 · 2 dias antes` → `R2 · Data combinada` → `R3 · D5` | 10 d | sim | **NAO** | repescagem |
| `repescagem` | 6 | D0 → D7 → D14 → D30 → D60 → D90 | 30 d | sim | sim | **(terminal)** |
| `comprou` | 6 | `P1 · D1 pos-venda` → `P2 · D7 tudo certo?` → `P3 · D30` → `P4 · D90` → `P5 · D180 upgrade?` → `P6 · D365 upgrade` | (nenhum) | **NUNCA** | **NAO** | **(terminal)** |

### Como mudar cadencia e copy (1 UPDATE cada, zero codigo)
```sql
-- intervalo de um passo:
update public.cadencia_regra set dias_offset = 3
 where tenant_id = '00000000-0000-0000-0000-000000000001' and perfil = 'consulta' and passo = 2;

-- paciencia antes de esfriar/transicionar:
update public.cadencia_perfil set limite_silencio_dias = 20
 where tenant_id = '00000000-0000-0000-0000-000000000001' and perfil = 'repescagem';

-- copy de um passo:
update public.dicionario_scripts set texto_template = 'novo texto com {nome} e {produto}'
 where tenant_id = '00000000-0000-0000-0000-000000000001' and perfil = 'repescagem' and passo = 1;
```
Toda mudanca cai na `auditoria` com valor antes e depois.

---

## Dicionarios (codigos estaveis, rotulo e editavel)
- `status`: `pendente`, `feito`, `convertido`, `lista_fria`, `cancelado`
- `perfil`: `compra_imediata`, `avaliando`, `em_espera`, `repescagem`, `comprou`, `consulta`
- `origem`: `indicacao`, `instagram`, `whatsapp_direto`, `loja_fisica`, `prospeccao_ativa`, `parceria_influencer`, `parceria_pag_local`, `whatsapp_status`
- `condicao`: `lacrado`, `vitrine`, `seminovo` (**nao existe "a vista"** — condicao e estado do aparelho, nao forma de pagamento)
- `nivel`: `quente`, `morno`, `frio` (derivado, nunca gravado)
- `etapa`: `conversando`, `negociacao_parada`

---

## Referencias do sistema
- Supabase project: `unjzpyexgtbcmjfgcqrx`
- Cloudflare Worker: `flat-resonance-09ba` (`pitstopimports.workers.dev`)
- GitHub: `vinialbuquerquepitstop-beep/pitwall--nucleo` (branch `main`) — **PRIVADO**
- Auth UID do dono: `fb2aad8e-b728-4e59-a198-71da2156449d`
- Tenant Pitstop: `00000000-0000-0000-0000-000000000001`
- Schemas: `public` (exposto pelo PostgREST), **`privado`** (NAO exposto, mora o helper de RLS)
- Cron: `regua_pitwall_diaria`, `0 8 * * *` UTC = 05:00 America/Sao_Paulo
- Simular chamada autenticada no MCP:
  `select set_config('request.jwt.claims', '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', false); set role authenticated;`
  (rodar `reset role;` ao terminar)
- MCP Supabase: SQL multi-statement retorna SO o resultado do ultimo statement. Cada verificacao em chamada separada.
