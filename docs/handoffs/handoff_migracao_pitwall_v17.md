# Handoff Migracao Pit Wall 2.0 (Nucleo) — v17

## Como usar este documento
Este handoff SUBSTITUI o v16 e todos os anteriores da linha de migracao. Comece por "Estado em uma frase", "O que mudou nesta sessao" e "Primeiro movimento do proximo chat".

Convencao de escrita: prosa sem acento, sem cedilha, sem travessao. EXCECAO obrigatoria: valores reais do sistema carregam seus proprios caracteres e nao se mexe (rotulos de cadencia com o ponto do meio U+00B7 como `R3 · D14`, nome da aba `Pitstop Imports — CRM de Clientes` com em-dash U+2014, status com emoji, `--morno` = `#f2a71b`, marca `#0025cc`). **A copy dos scripts em `dicionario_scripts` e texto para CLIENTE: leva acento e cedilha normais e nao se normaliza.**

---

## Estado em uma frase
A **Fase 3.5 esta pronta no backend**: a `v_lead` agora expoe a cadencia (passo, rotulo, vencimento, atraso) e a RPC `sugerir_mensagem` devolve a copy certa do passo certo, lendo de um banco de scripts editavel. **Falta apenas o frontend**, que ainda nao le nada disso. A Fase 3 (motor `pg_cron`) segue no ar, mas o agendador **ainda nao foi observado disparando em producao**.

---

## O que mudou nesta sessao

### 1. Verificacao do cron (item 2 do v16): PENDENTE, sem falha
- Job `regua_pitwall_diaria` existe, `active = true`, schedule `0 8 * * *` (UTC) = 05:00 America/Sao_Paulo.
- **`cron.job_run_details` esta VAZIO (0 execucoes).**
- Motivo: o job nasceu em 11/07 depois das 05:00. Primeira disparada real: **12/07 as 05:00**.
- **Isto continua sendo a unica parte da Fase 3 nao observada em producao.** Confirmar no proximo chat:
  ```sql
  select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
  ```

### 2. Pendencia 1 resolvida no BANCO (migration `expor_cadencia_na_v_lead`)
A `v_lead` nao expunha nada de cadencia. Sem isso, a Fase 3.5 era impossivel (o banco de scripts e chaveado por `perfil` + `passo`, e nenhuma leitura do app devolvia o passo). **Este foi o pre-requisito duro, e por isso veio antes da 3.5.**

Colunas novas, todas appendadas no fim (nenhuma coluna existente mudou de nome, tipo ou ordem, entao o frontend atual nao quebra):

| Coluna | Conteudo |
|---|---|
| `cadencia_passo` | numero do passo atual |
| `cadencia_rotulo` | rotulo do passo (`R3 · D14`, `P1 · D1 pos-venda`) |
| `cadencia_vence_em` | data de vencimento do passo |
| `cadencia_encerrada` | booleano, `false` por padrao |
| `cadencia_dias_para` | dias ate vencer. **NEGATIVO = ATRASADO** |

`LEFT JOIN` em `cadencia_estado`, entao lead sem cadencia volta nulo e nao some da leitura.

Verificado: `security_invoker = on` preservado apos o `create or replace`; RLS ativa em `lead` e `cadencia_estado`; leitura com JWT do dono devolve 15 leads, 13 com cadencia (LEAD-0002 sem perfil e LEAD-0009 em lista_fria voltam nulos, como o motor definiu); os 4 atrasados aparecem com `cadencia_dias_para` negativo.

### 3. Fase 3.5, backend completo

**Tabela `dicionario_scripts`** (migration `fase35_dicionario_scripts`):
- `id uuid pk`, `tenant_id` FK em `tenant`, `perfil`, `passo`, `rotulo_ref`, `texto_template`, `ativo`, `criado_em`, `atualizado_em`.
- `unique (tenant_id, perfil, passo)`.
- **`passo = 0` e o FALLBACK do perfil**, usado quando o passo especifico nao tem copy cadastrada.
- `rotulo_ref` e SO documentacao humana. **A chave real e o numero do passo**, nunca o rotulo (rotulo e editavel e mudaria a chave).
- RLS ligada, policy `select` por `fn_tenant_atual()`; `anon` revogado; `authenticated` so com SELECT; `service_role` com tudo.
- Auditoria append-only via `fn_auditar` + `fn_touch_atualizado_em`. Os 12 inserts do seed cairam na `auditoria` (confirmado).
- **Copy e CONFIGURACAO, igual a cadencia.** Trocar mensagem e 1 UPDATE, zero codigo.

**RPC `sugerir_mensagem(p_lead_id uuid)`** (migration `fase35_rpc_sugerir_mensagem`):
- `SECURITY INVOKER`, `search_path` travado em `public`. ACL final: `postgres | authenticated | service_role`. Sem `PUBLIC`, sem `anon`. Confirmado em `pg_proc.proacl`.
- **SOMENTE LEITURA.** Nao escreve em `lead`, nao registra toque, nao mexe em cadencia. A invariante "WhatsApp so abre, nao registra toque" continua intacta.
- Fluxo: le `cadencia_estado` (nao encerrada) -> busca script do passo -> se nao houver, cai no fallback do perfil (passo 0) -> substitui variaveis -> devolve json.
- Variaveis: `{nome}` (primeiro nome), `{produto}`, `{condicao}`, `{valor_oferta}`, `{data_combinada}` (formato DD/MM).
- Retorno: `{ ok, lead_id, lead_code, nome, whatsapp, perfil, passo, passo_rotulo, origem_script ('passo'|'fallback'), script_id, texto }`. Erro: `{ ok: false, msg }`.

### 4. Prova contra o DADO REAL (licao do v16 aplicada, nao so teste sintetico)

| Lead | Passo lido | Origem | Resultado |
|---|---|---|---|
| Diego (0001) | `P1 · D1 pos-venda` | passo | pos-venda renderizado com o produto certo |
| Zana (0004) | `R1 · D0` | passo | repescagem com "14 Pro Max 256" |
| Duda (0005) | `R2 · D2` | passo | consulta no passo 2, copy do passo 2 |
| Erickao (0008) | `R1 · 2 dias antes` | passo | **`{data_combinada}` virou 20/07 sozinho** |
| Vinicius (0002) | sem perfil | erro tratado | `ok: false`, "defina o perfil" |
| Anderson (0009) | lista_fria, sem cadencia | **fallback** | caiu no script generico do perfil, como projetado |

### 5. Seed de copy (12 scripts, tenant Pitstop)
Fallback (passo 0) dos 6 perfis + os passos vivos hoje: `compra_imediata` 1, `consulta` 1 e 2, `em_espera` 1, `repescagem` 1, `comprou` 1.

**AVISO REGISTRADO AO DONO: essa copy e funcional, NAO e a voz da Pitstop.** Foi semeada so pra feature nao nascer vazia. Revisar com a skill de conteudo antes de disparar pra cliente real. **Cadencia com script generico e pior que cadencia sem script.**

---

## Achado de seguranca (nao executado, aguarda decisao do dono)
A ACL da `v_lead` mostra `anon=arwdDxtm`. O `anon` tem grant amplo na view (heranca do grant padrao do Supabase no schema `public`, anterior a esta sessao). Hoje e inofensivo: a RLS bloqueia tudo sem JWT e escrita so passa por RPC. Mas e segunda linha de defesa aberta de graca.

Fecha com uma linha, quando o dono autorizar:
```sql
revoke all on public.v_lead from anon;
```
**Checar tambem as demais tabelas e views do schema publico**, provavelmente tem o mesmo grant herdado.

---

## Primeiro movimento do proximo chat
1. **Confirmar o cron** (`cron.job_run_details`). Se rodou 12/07 as 05:00, a Fase 3 esta 100 por cento observada em producao e fecha.
2. **Fechar o frontend (o unico bloqueio real da 3.5).** O dono precisa mandar o `index_brand.html`. **O repo GitHub e PRIVADO: `raw.githubusercontent.com` retorna 404, entao Claude NAO consegue buscar sozinho.** Nao gastar turno tentando de novo.
   Entrega prevista, arquivo completo e validado (Acorn `sourceType: 'script'` + jsdom), tres coisas num deploy manual so:
   - `cadencia_rotulo` no card do lead;
   - marcador de atraso quando `cadencia_dias_para < 0`;
   - botao de sugestao de mensagem chamando a RPC.
3. **Revisar a copy dos 12 scripts** com a skill de conteudo.

### Contrato do frontend (ja definido, so plugar)
```js
const r = await chamarRPC('sugerir_mensagem', { p_lead_id: leadId });
if (r.ok) {
  const link = r.whatsapp
    ? `https://wa.me/${r.whatsapp}?text=${encodeURIComponent(r.texto)}`
    : null; // sem telefone: mostrar o texto para copiar
}
```
O `encodeURIComponent` fica no JS DE PROPOSITO: Postgres nao tem urlencode nativo e fazer na mao em SQL seria fonte de bug com acento e quebra de linha.

---

## Pendencias abertas (fila do proximo trabalho)
1. **[dono, BLOQUEIO] Mandar o `index_brand.html`.** Trava a entrega visivel da 3.5 e da Pendencia 1. Tudo que depende de banco ja esta feito.
2. **[dono, conteudo] Revisar os 12 scripts semeados.** Copy generica em cliente real e risco de marca.
3. **[dono] Telefones de Yasmim (LEAD-0007) e Erickao (LEAD-0008).** Sem telefone nao existe deep link, so texto pra copiar. **Erickao vence 18/07** (lembrete pre-data): se o numero nao entrar, o lembrete nao vai a lugar nenhum. Confirmar tambem Miguel (LEAD-0013) ativo ou frio.
4. **[seguranca] `revoke all on public.v_lead from anon`** e varredura dos grants herdados no schema publico.
5. **[dono, painel] Protecao de senha vazada** (Authentication > Sign In / Providers). Pode ser recurso de plano Pro.
6. **[dono, painel] Rate limits de Auth**: confirmar limites padrao do FREE ativos.
7. **[adiado conscientemente] MFA/TOTP.** Exige fluxo de enrollment no frontend. Entra na Fase 5.
8. **Registrar dominio proprio** (some o `flat-resonance-09ba`).
9. **Digest diario:** segundo job `pg_cron` com o resumo do dia. Canal em aberto.
10. **Fase 4:** aposentar a planilha do CRM, reapontar o sync do Notion. Pipeline de CONTEUDO segue INTEIRO no Apps Script antigo, intocado.
11. **Aba de aniversariantes** (Fase 5). Depende de `data_nascimento` em massa.
12. **Metricas/dashboard** (Fase 5). Cravar o que mede antes de construir.
13. **SaaS:** Fase A, validar demanda com sinal de pagamento. Interesse nao e pagamento.

---

## Ponto de atencao operacional (segue valendo, do v16)
A regua colocou 3 convertidos no pos-venda (vence 12/07) e mantem 4 leads vencidos parados (Zana -5 dias, Miguel -4, Yasmim -3, Clara -1). **Regra 1 nao avanca sem toque: se o dono nao tocar, eles ficam la para sempre.** Isso e o desenho CORRETO. A regua nao resolve aderencia, ela torna a omissao visivel e inescapavel. Agora, com a 3.5, a desculpa "nao sei o que escrever" tambem cai.

---

## AS REGRAS DO MOTOR (contrato, inalterado desde v16)
- **Regra 0, inicializacao.** Lead com `perfil`, nao arquivado, status em (`pendente`,`feito`,`convertido`) e sem linha em `cadencia_estado` ganha cadencia no passo 1. NUNCA sobrescreve `proximo_contato` definido pelo operador. Evento `cadencia_iniciada`.
- **Regra 1, avanco verificado por toque.** So avanca se `ultimo_toque_em::date >= passo_vence_em`. Sem toque, NAO avanca. O novo vencimento conta a partir do TOQUE, nao de hoje. Evento `cadencia_avancou`.
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

## Invariantes
- Toda escrita gera registro de auditoria append-only (`fn_auditar`).
- Escrita do app so por RPC; o frontend nunca escreve direto em tabela.
- Nivel derivado na leitura, nunca armazenado (`v_lead`: 0-2 quente, 3-6 morno, 7+ frio).
- `security_invoker = on` em toda view sobre tabela com RLS. **Reconfirmar apos todo `create or replace view`.**
- "Toque enviado" e "Respondido" NUNCA colapsam num evento so.
- **WhatsApp so ABRE, nunca registra toque.** Pre-preencher `?text=` NAO viola isso. `sugerir_mensagem` e read-only por desenho.
- Arquivamento e irreversivel no app; nao existe hard delete de lead com historico.
- `--morno` (`#f2a71b`) e semantico e NUNCA se unifica com a marca `#0025cc`.
- **Cadencia e CONFIGURACAO, nunca codigo.** Nenhum numero de dia dentro de `fn_regua_varredura()`.
- **[NOVA] Copy tambem e CONFIGURACAO, nunca codigo.** Nenhum texto de mensagem hardcoded no frontend ou em funcao. Tudo em `dicionario_scripts`.
- **[NOVA] A chave do script e `perfil` + `passo` (inteiro), nunca o rotulo.** Rotulo e editavel; usa-lo como chave quebraria a busca no primeiro UPDATE de texto.
- Toda tabela auditada precisa de coluna `id` (`fn_auditar` grava `registro_id = new.id`).

---

## Licoes desta sessao
- **Ordem importa mais que a lista.** O v16 mandava ir pra 3.5 e deixava "frontend nao mostra cadencia" como pendencia separada. Eram a MESMA dependencia: sem `passo` na leitura, o banco de scripts nao tem chave. Ler a fila de pendencias procurando o pre-requisito escondido, nao executar na ordem escrita.
- **Fallback por perfil (passo 0) salva a feature de nascer quebrada.** Lead sem cadencia ativa (lista_fria, cadencia encerrada) ainda recebe sugestao. Sem isso, a RPC devolveria vazio justo nos leads que mais precisam de reativacao.
- **Repo privado: Claude nao busca arquivo do GitHub.** `raw.githubusercontent.com` da 404. Ate haver token ou o dono colar o arquivo, todo trabalho de frontend depende de upload manual.

---

## Referencias do sistema (inalteradas)
- Supabase project: `unjzpyexgtbcmjfgcqrx`
- Cloudflare Worker: `flat-resonance-09ba` (`pitstopimports.workers.dev`)
- GitHub: `vinialbuquerquepitstop-beep/pitwall--nucleo` (branch `main`) — **PRIVADO**
- Auth UID do dono: `fb2aad8e-b728-4e59-a198-71da2156449d`
- Tenant Pitstop: `00000000-0000-0000-0000-000000000001`
- Simular chamada autenticada no MCP:
  `select set_config('request.jwt.claims', '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', false); set role authenticated;`
  (rodar `reset role;` ao terminar)
- MCP Supabase: SQL multi-statement retorna SO o resultado do ultimo statement. Cada verificacao em chamada separada.
