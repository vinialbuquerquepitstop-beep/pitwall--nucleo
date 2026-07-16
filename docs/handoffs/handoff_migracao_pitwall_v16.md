# Handoff Migracao Pit Wall 2.0 (Nucleo) — v16

## Como usar este documento
Este handoff SUBSTITUI o v15 e todos os anteriores da linha de migracao. Comece por "Estado em uma frase", "O que mudou nesta sessao" e "Primeiro movimento do proximo chat".

Convencao de escrita: prosa sem acento, sem cedilha, sem travessao. EXCECAO obrigatoria: valores reais do sistema carregam seus proprios caracteres e nao se mexe (rotulos de cadencia com o ponto do meio U+00B7 como `R3 · D14`, nome da aba `Pitstop Imports — CRM de Clientes` com em-dash U+2014, status com emoji, `--morno` = `#f2a71b`, marca `#0025cc`).

---

## Estado em uma frase
A **Fase 3 esta no ar**: a regua de cadencia nativa roda em `pg_cron` todo dia as 05:00 (America/Sao_Paulo), lendo cadencia como CONFIGURACAO EDITAVEL no banco, com transicao automatica de perfil. A trilha de ciberseguranca (B1 + B2) esta fechada no que depende de SQL; restam apenas itens de painel. A regua do Apps Script + Google Agenda esta funcionalmente aposentada.

---

## O que mudou nesta sessao

### 1. Ciberseguranca B2 (fechado)
- **Migration `b2_revoke_authenticated_fn_auditar`.** `fn_auditar` (gatilho de auditoria) estava executavel por `authenticated` via `/rest/v1/rpc/fn_auditar`. Revogado. ACL final: so `postgres` e `service_role`.
- **Detalhe tecnico que permitiu revogar sem quebrar nada:** em Postgres o privilegio EXECUTE de funcao de trigger e checado na CRIACAO do trigger, nao no disparo. Provado: apos a revogacao, um cadastro real gerou 3 registros de auditoria normalmente.
- **`fn_tenant_atual` e `fn_papel_atual` PERMANECEM com grant para `authenticated`, por design.** As policies de RLS referenciam essas funcoes e o usuario precisa de EXECUTE em tempo de query. Revogar quebraria toda leitura. Elas so devolvem o proprio tenant e papel do chamador. Os avisos do advisor sobre elas sao **risco aceito e documentado**, nao pendencia.
- **Prova de isolamento multi-tenant EXECUTADA E VERDE.** Segundo tenant real criado, com usuario dono proprio, JWT simulado. Resultados: T2 ve so o proprio lead (zero dos 15 da Pitstop); auditoria isolada; `registrar_toque` e `editar_lead` em lead de outro tenant retornam "sem permissao"; dono ve exatamente 15 leads. Sandbox limpo e verificado.
- **Achado relevante pro SaaS:** a numeracao de `lead_code` ja e POR TENANT (o lead do T2 nasceu LEAD-0001 tambem). Isso ja estava certo.

### 2. Auditoria da regua (antes de construir)
Tres achados que mudaram o desenho:
- **A regua legada nao e auditavel byte a byte e nao vale o esforco.** O codigo dela (`Código.gs`, projeto CRM Calendar Automation) nunca entrou nos handoffs. Como a Fase 3 a substitui, auditar linha a linha seria trabalho morto. Auditei o DESENHO contra o comportamento real da base.
- **O gargalo nao e o desenho da cadencia, e a aderencia a ela.** Dados reais: 8 de 15 leads sao `repescagem` (funil majoritariamente de reativacao); 6 dos 10 pendentes estavam com proximo contato VENCIDO; Zana (LEAD-0004), lead forte de venda, estava ha 24 dias sem toque. O publico nao esta sendo sufocado, esta sendo ESQUECIDO. Isso valida a Regra 1.
- **"A melhor regua possivel" nao e descobrivel hoje.** Com 3 eventos pos-corte, qualquer numero otimo seria invencao. Resposta correta de engenharia: cadencia como DADO editavel, com trilha de auditoria, para corrigir com evidencia.

### 3. Cadencia virou configuracao editavel (migration `fase3_cadencia_config_editavel`)
Duas tabelas novas, RLS por tenant, `anon` sem privilegio, auditoria append-only em toda mudanca:
- **`cadencia_perfil`** (por tenant, por perfil): `limite_silencio_dias`, `permite_esfriar`, `perfil_seguinte`, `respondido_freia`, `ativo`.
- **`cadencia_regra`** (por tenant, perfil, passo): `rotulo`, `dias_offset`, `ancora`, `ativo`.
- **Prova:** mudei o limite da repescagem de 14 pra 15 e voltei; as duas mudancas cairam na auditoria com valor antes e depois (`15 -> 14`).
- **REVER CADENCIA NO FUTURO, INCLUSIVE PRA TESTE, E 1 UPDATE.** Zero codigo a reescrever. Era exigencia explicita do dono.
- Nota: `fn_auditar` grava `registro_id = new.id`, entao **toda tabela auditada PRECISA de coluna `id`**. A primeira tentativa da migration reprovou por isso (chave composta sem `id`); a transacao reverteu inteira e foi reaplicada com `id uuid primary key default gen_random_uuid()`.

### 4. Ancora de passo (migration `fase3_cadencia_ancora_e_caudas_longas`)
O pedido do dono de "toque 1 ou 2 dias ANTES da data combinada" nao cabia no modelo (todo intervalo era positivo, relativo ao passo anterior). Solucao estrutural:
- Coluna **`ancora`**: `'toque_anterior'` (X dias apos o toque do passo anterior, padrao) ou `'data_combinada'` (X dias em relacao ao `proximo_contato` marcado, **aceita NEGATIVO**).
- `dias_apos_anterior` renomeada para **`dias_offset`** (o nome antigo mentia para a ancora nova). Rename seguro: nada lia a coluna ainda.
- Constraint `cadencia_regra_offset_coerente`: offset negativo so com ancora `data_combinada`.

### 5. Transicao automatica de perfil, Opcao B (migration `fase3_transicao_de_perfil`)
Aprovada pelo dono. Quando a cadencia de um perfil se esgota sem resposta, o lead **NAO esfria: migra para o perfil seguinte e recomeca a cadencia de la**.
- Coluna `perfil_seguinte` em `cadencia_perfil`. Trava anti-loop: `perfil_seguinte <> perfil`.
- `compra_imediata`, `consulta`, `avaliando`, `em_espera` -> **`repescagem`**.
- `repescagem` e **terminal e esfria** (vira `lista_fria`).
- `comprou` e **terminal e NUNCA esfria** (relacionamento nao tem fim).
- Verificado com CTE recursiva: zero ciclos, todos os caminhos terminam.
- **Razao:** um lead que nao fechou em 60 ou 90 dias nao e mais "quente" nem "avaliando", e repescagem. Mantem os perfis honestos e faz o funil se auto-organizar quando a base sair de 15 pra 150 leads.

### 6. O MOTOR (migrations `fase3_motor_regua_pgcron` + 2 correcoes)
`public.fn_regua_varredura()` -> `jsonb`. `SECURITY DEFINER`, `search_path` travado, **EXECUTE revogado de `public`, `anon` e `authenticated`** (a varredura e do agendador, nao do app).

Nao existe UM numero de cadencia embutido no codigo. Tudo vem das tabelas de configuracao.

- **`pg_cron` 1.6.4 instalado.** Job `regua_pitwall_diaria`, schedule `0 8 * * *` (UTC) = **05:00 America/Sao_Paulo**, ativo.

### 7. Estado real da Pitstop apos a primeira varredura
- 13 cadencias inicializadas (LEAD-0002 sem perfil e LEAD-0009 em lista_fria ficam de fora, corretamente).
- **Duda nanda (LEAD-0005)** e **Eduarda (LEAD-0012)**: tinham toque confirmado apos o vencimento, **avancaram de passo sozinhos**.
- **Zana (0004), Miguel (0013), Yasmim (0007), Clara (0015)**: vencidos e SEM toque. Regra 1 os manteve PARADOS na fila, esperando o dono. 4 leads na fila de hoje. **A regua nao esconde a omissao, ela expoe.**
- **Diego (0001), Isac (0006), Artu (0014)** (`comprou`): entraram no pos-venda, vencem em `P1 · D1` (12/07).
- **Erickao (0008)**: `R1 · 2 dias antes` vence 18/07, dois dias antes da data combinada de 20/07. Lembrete pre-data armado.

---

## AS REGRAS DO MOTOR (contrato, decorar isto)

- **Regra 0, inicializacao.** Lead com `perfil` preenchido, nao arquivado, status em (`pendente`,`feito`,`convertido`) e sem linha em `cadencia_estado` ganha cadencia no passo 1. **NUNCA sobrescreve um `proximo_contato` ja definido pelo operador** (`coalesce(proximo_contato, ...)`). Evento `cadencia_iniciada`.
- **Regra 1, avanco verificado por toque.** So avanca se `ultimo_toque_em::date >= passo_vence_em`. Sem toque, NAO avanca: o lead fica na fila, vencido, cobrando acao. Evento `cadencia_avancou`. O novo vencimento conta a partir do TOQUE, nao de hoje.
- **Freio (`respondido_em`).** NAO e mais lei global: e a coluna configuravel **`respondido_freia`**. Perseguicao (compra_imediata, consulta, avaliando, repescagem) = `true`. Agendado e relacionamento (em_espera, comprou) = `false`.
- **Regra 2, fim de cadencia** (no ULTIMO passo, com toque feito, sem resposta, silencio >= `limite_silencio_dias`). **PRECEDENCIA:**
  1. `perfil_seguinte` preenchido -> **TRANSICIONA** (evento `perfil_transicionado`). Nao esfria.
  2. senao, `permite_esfriar` -> vira `lista_fria` (evento `esfriado_por_silencio`).
  3. senao -> encerra a cadencia (evento `cadencia_encerrada`). Caso do `comprou`.
- **`limite_silencio_dias` e a PACIENCIA DEPOIS que a cadencia inteira acabou**, nao entre passos. Por isso subiu junto com as caudas longas.
- **Idempotente.** Rodar duas vezes no mesmo dia: zero acoes na segunda. Provado.

---

## A CADENCIA VIGENTE (tenant Pitstop, tudo editavel por UPDATE)

| Perfil | Passos | Cadencia | Limite silencio | Esfria | Resp. freia | Vai para |
|---|---|---|---|---|---|---|
| `compra_imediata` | 8 | D0 → D1 → D3 → D7 → D14 → D30 → D60 → D90 | 15 d | sim | sim | repescagem |
| `consulta` | 7 | D0 → D2 → D5 → D10 → D20 → D35 → D60 | 15 d | sim | sim | repescagem |
| `avaliando` | 6 | D0 → D3 → D7 → D14 → D30 → D60 | 15 d | sim | sim | repescagem |
| `em_espera` | 3 | `R1 · 2 dias antes` → `R2 · Data combinada` → `R3 · D5` | 10 d | sim | **NAO** | repescagem |
| `repescagem` | 6 | D0 → D7 → D14 → D30 → D60 → D90 | 30 d | sim | sim | **(terminal)** |
| `comprou` | 6 | `P1 · D1 pos-venda` → `P2 · D7 tudo certo?` → `P3 · D30` → `P4 · D90` → `P5 · D180 upgrade?` → `P6 · D365 upgrade` | (nenhum) | **NUNCA** | **NAO** | **(terminal)** |

Os dois passos de `em_espera` ancorados em `data_combinada` sao os unicos com ancora nao padrao. `R1` tem `dias_offset = -2`.

### Como mudar a cadencia (o dono pediu isso explicitamente)
```sql
-- Mudar um intervalo:
update public.cadencia_regra set dias_offset = 3
 where tenant_id = '00000000-0000-0000-0000-000000000001' and perfil = 'consulta' and passo = 2;

-- Mudar a paciencia antes de esfriar/transicionar:
update public.cadencia_perfil set limite_silencio_dias = 20
 where tenant_id = '00000000-0000-0000-0000-000000000001' and perfil = 'repescagem';

-- Desligar um passo sem apagar (util pra TESTE A/B):
update public.cadencia_regra set ativo = false
 where tenant_id = '00000000-0000-0000-0000-000000000001' and perfil = 'comprou' and passo = 6;
```
Toda mudanca cai na `auditoria` com valor antes e depois. Rastreavel.

---

## OS DOIS BUGS QUE O TESTE PEGOU (aprendizado caro, nao repetir)

Rodei o motor num tenant sandbox descartavel com 6 leads sinteticos (1 por regra). **6 de 6 asserts passaram.** Mas dois bugs so apareceram ao bater no DADO REAL:

1. **O freio matava o pos-venda.** LEAD-0006 e LEAD-0014 responderam; o freio permanente encerraria a cadencia e o pos-venda D1..D365 nunca rodaria. **Freio de perseguicao nao pode frear relacionamento.**
2. **O freio matava o `em_espera` (mais grave).** LEAD-0008 (Erickao) ficou com cadencia ENCERRADA. Ele respondeu e marcou 20/07. Mas `em_espera` E, por definicao, um lead que RESPONDEU e AGENDOU. O freio aniquilava exatamente o perfil cuja razao de existir e o toque marcado. Cadencia reaberta manualmente.

**Correcao:** "responder freia" virou configuracao por perfil (`respondido_freia`), nao lei global.

**LICAO PRA SKILL:** teste sintetico verde nao substitui teste contra o dado real. Os 6 asserts passaram e os dois bugs continuavam vivos, porque nenhum lead sintetico combinava `respondido_em` + perfil agendado/relacionamento. **Ao testar regra de negocio, gerar os casos a partir do dado real, nao so do modelo mental.**

---

## Ponto de atencao operacional (o dono precisa ler)
A regua colocou 3 clientes convertidos na fila (pos-venda D1, vence 12/07) e mantem 4 leads vencidos parados. **Se o dono nao tocar, eles ficam la para sempre**, porque a Regra 1 nao avanca sem toque. Isso e o desenho CORRETO, mas significa que a fila cresce se a operacao nao acompanhar. A auditoria mostrou que esse ja e o gargalo real (24 dias de silencio na Zana). **A regua nao resolve a aderencia; ela torna o problema visivel e inescapavel.**

---

## Primeiro movimento do proximo chat
1. Confirmar com o dono que a fila do app no celular mostra os leads certos apos a varredura (a regua mexeu em `proximo_contato` de varios leads). Se algo parecer errado na tela, e leitura do frontend, nao o motor (o motor foi provado no banco).
2. Confirmar amanha (12/07 ou depois) que o cron rodou de fato: `select * from cron.job_run_details where jobid = 1 order by start_time desc limit 5;`. Esta e a UNICA parte da Fase 3 ainda nao observada em producao (o agendamento em si; a funcao ja foi provada por chamada direta).
3. **Ir para a Fase 3.5, sugestao de mensagem com banco de scripts.** AGORA ESTA DESTRAVADA: o motor sabe `perfil` + `passo_rotulo` de cada lead, que e exatamente a chave do banco de scripts. Desenho ja acordado: tabela `dicionario_scripts` (tenant_id, perfil, passo/passo_rotulo, texto_template), substituicao de variaveis (`{nome}`, `{produto}`), deep link do WhatsApp com `?text=` (pre-preencher texto NAO viola a invariante "WhatsApp so abre, nao registra toque"). A copy de cada passo e tarefa das skills de conteudo; o nucleo faz so a fiacao.

---

## Pendencias abertas (fila do proximo trabalho)
1. **[dono] Frontend nao mostra a cadencia.** A tela nao sabe que `cadencia_estado` existe. O `passo_rotulo` (ex `R3 · D14`) deveria aparecer no card. E uma leitura nova na `v_lead` + 1 linha no card. Barato, alto valor: o dono passa a ver ONDE cada lead esta na regua.
2. **[proximo bloco] Fase 3.5**, sugestao de mensagem (ver acima).
3. **[dono, painel] Protecao de senha vazada** (Authentication > Sign In / Providers). Pode ser recurso de plano Pro; se estiver bloqueado, nao e falha de config. Mitigante gratuito: senha longa, unica, nao reutilizada.
4. **[dono, painel] Rate limits de Auth**: confirmar que os limites padrao do FREE estao ativos.
5. **[adiado conscientemente] MFA/TOTP.** Nao e um toggle: exige fluxo de enrollment e challenge no frontend. Com 1 usuario, senha forte e a porta `anon` fechada, **nao vale travar nada por isso agora**. Entra junto da reconstrucao da interface (Fase 5).
6. **[dono] Telefones de Yasmim (LEAD-0007) e Erickao (LEAD-0008)**; confirmar Miguel (LEAD-0013) ativo ou frio. Destravado pela feature de edicao ha 2 sessoes.
7. **Registrar dominio proprio** (some o `flat-resonance-09ba`).
8. **Digest diario:** agora e trivial. Um segundo job `pg_cron` manda 1x/dia o resumo (fila de hoje, esfriando, vencidos). Canal em aberto (email, WhatsApp pra si, push).
9. **Fase 4:** aposentar a planilha do CRM, reapontar o sync do Notion. O pipeline de CONTEUDO (Notion -> `syncNotion` -> aba `Conteudo` -> `getConteudo`) segue INTEIRO no Apps Script antigo e nao foi tocado.
10. **Aba de aniversariantes** (Fase 5). Depende de `data_nascimento` preenchida em massa.
11. **Metricas/dashboard** (Fase 5). Cravar o que mede antes de construir.
12. **SaaS:** Fase A (validar demanda, sinal de pagamento). Interesse nao e pagamento. A prova de isolamento desta sessao e o alicerce, sem ter construido superficie de SaaS antes da hora.

---

## Invariantes (seguem validas, agora com duas novas)
- Toda escrita gera registro de auditoria append-only (`fn_auditar`, provado).
- Escrita do app so por RPC; o frontend nunca escreve direto em tabela.
- Nivel derivado na leitura, nunca armazenado (`v_lead`, Rota A: 0-2 quente, 3-6 morno, 7+ frio).
- `security_invoker = on` em toda view sobre tabela com RLS.
- "Toque enviado" e "Respondido" NUNCA colapsam num evento so.
- Arquivamento e irreversivel no app; nao existe hard delete de lead com historico.
- `--morno` (`#f2a71b`) e semantico (temperatura de pneu) e NUNCA se unifica com a marca `#0025cc`.
- **[NOVA] Cadencia e CONFIGURACAO, nunca codigo.** Nenhum numero de dia pode ser escrito dentro de `fn_regua_varredura()`. Se um numero de cadencia aparecer no corpo da funcao, e bug.
- **[NOVA] Toda tabela auditada precisa de coluna `id`** (`fn_auditar` grava `registro_id = new.id`).

---

## Referencias do sistema (inalteradas)
- Supabase project: `unjzpyexgtbcmjfgcqrx`
- Cloudflare Worker: `flat-resonance-09ba` (`pitstopimports.workers.dev`)
- GitHub: `vinialbuquerquepitstop-beep/pitwall--nucleo` (branch `main`)
- Auth UID do dono: `fb2aad8e-b728-4e59-a198-71da2156449d`
- Tenant Pitstop: `00000000-0000-0000-0000-000000000001`
- Simular chamada autenticada no MCP:
  `select set_config('request.jwt.claims', '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', false); set role authenticated;`
- MCP Supabase: SQL multi-statement retorna SO o resultado do ultimo statement. Rodar cada verificacao como chamada separada.
