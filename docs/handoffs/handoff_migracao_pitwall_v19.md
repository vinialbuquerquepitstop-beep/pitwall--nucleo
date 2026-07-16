# Handoff Migracao Pit Wall 2.0 (Nucleo) — v19

## Como usar este documento
Este handoff SUBSTITUI o v18 e todos os anteriores. Comece por "Estado em uma frase", "O que mudou nesta sessao" e "Primeiro movimento do proximo chat".

Convencao de escrita: prosa sem acento, sem cedilha, sem travessao. EXCECAO obrigatoria: valores reais do sistema carregam seus proprios caracteres e nao se mexe (rotulos de cadencia com o ponto do meio U+00B7 como `R3 · D14`, nome da aba `Pitstop Imports — CRM de Clientes` com em-dash U+2014, status com emoji, `--morno` = `#f2a71b`, marca `#0025cc`). **A copy dos scripts em `dicionario_scripts` e texto para CLIENTE: leva acento e cedilha normais e nao se normaliza.**

---

## Estado em uma frase
**Fase 3.5 FECHADA.** O frontend foi reconstruido a partir do deploy minificado, dois bugs de fila que escondiam clientes reais foram achados e corrigidos, e o app agora e governado pelo motor de cadencia em vez de por `proximo_contato`. Seguranca de banco segue FECHADA com uma unica pendencia de painel. **Nao ha bloqueio tecnico aberto.**

---

## O que mudou nesta sessao

### 1. Frontend da Fase 3.5 entregue (bloqueio de 3 sessoes, resolvido)
O dono subiu o `index_deploy.min.html` (minificado, nao o `index_brand.html`). A logica estava integra e o `index_brand.html` foi **reconstruido legivel** a partir dele, ja com a Fase 3.5 dentro.

Entregues:
- Chip de `cadencia_rotulo` no card (`R1 · D0`, `P1 · D1 pos-venda`)
- Marcador de atraso vindo de `cadencia_dias_para` (chip vermelho `Nd de atraso`; chip verde `vence hoje` quando `= 0`)
- Botao **Sugerir mensagem** chamando a RPC `sugerir_mensagem`, com Copiar e deep link de WhatsApp
- Aba **Pos-venda** nova
- Pitboard: `Ativos` foi substituido por `Pos-venda`

### 2. BUG DE FILA #1 (grave, nao estava em nenhum handoff)
A funcao `entraNaFila` exigia `status === 'pendente'`. Leads que compraram tem `status = 'convertido'`.

**Efeito: a regua de pos-venda inteira (perfil `comprou`, 6 passos ate D365) estava rodando no `pg_cron` e era INVISIVEL no app.** Tres clientes reais (LEAD-0001 Diego, LEAD-0006 Isac, LEAD-0014 Artu) estavam vencidos no `P1 · D1 pos-venda` desde 12/07 sem que ninguem soubesse.

### 3. BUG DE FILA #2
A fila lia `proximo_contato`. O motor escreve `cadencia_vence_em`. Para o perfil `em_espera` os dois **divergem por desenho**:

| LEAD-0008 Erickao | valor |
|---|---|
| `cadencia_vence_em` (passo `R1 · 2 dias antes`) | 18/07 |
| `proximo_contato` (data combinada) | 20/07 |

**Efeito: o lembrete pre-data nunca disparava na hora.** Chegava no dia combinado, quando ja tinha perdido a funcao.

### 4. CAUSA RAIZ, uma so
A fila era da Fase 1 e derivava de `proximo_contato` + `status`. O motor da Fase 3 trabalha com `cadencia_vence_em` + `cadencia_encerrada`. **Duas fontes de verdade divergiram.**

**Correcao aplicada. Regra nova da fila:**
```
cadencia_encerrada = false
E cadencia_vence_em <= hoje (data local BR do dispositivo)
E perfil <> 'comprou'
E nao arquivado
E ultimo_toque_em nao e hoje
```
Sem filtro de `status`. **Quem manda e o motor.** `cancelado` e `lista_fria` saem sozinhos porque o motor nao lhes da cadencia (confirmado: `cadencia_vence_em` nulo nos dois).

### 5. Decisao do dono: pos-venda em ABA SEPARADA
A fila do dia continua sendo lista de VENDA. Pos-venda (`perfil = 'comprou'`) vive em aba propria, com regra `cadencia viva E perfil = 'comprou'`, ordenada por vencimento.

---

## DECISOES DE PRODUTO TOMADAS NESTA SESSAO (nao reabrir)

1. **Pos-venda nao tem desfecho de venda.** Os botoes `Fechou` e `Sem interesse` nao existem na aba. Cliente que ja comprou nao fecha de novo. Sobram `Toque enviado` e `Sugerir mensagem`. O motor avanca a regua com o toque, e `respondido_freia = false` no perfil `comprou`, entao resposta nao freia.
2. **`Ativos` saiu do pitboard.** Contava `status = 'pendente'`, metrica que perdeu sentido quando o motor virou a fonte de verdade. Pitboard agora: `Fila / Atraso / Pos-venda / Base`.
3. **Gate LGPD preservado e estendido para a sugestao.** O texto do script SEMPRE aparece. O botao `Abrir no WhatsApp` so aparece com `consentimento = true` **E** telefone. Sem consentimento: aviso vermelho `Sem consentimento LGPD. Nao abrir conversa.` Sem telefone: `Sem telefone na base. Copie o texto.`

---

## PROVAS EXECUTADAS

Suite Acorn (`sourceType: 'script'`) + jsdom, **33 testes, 100% passando nos DOIS arquivos** (`index_brand.html` e `index_deploy.min.html`).

| Prova | Resultado |
|---|---|
| Sintaxe do bloco inline (Acorn) | parse limpo |
| Todos os 61 ids referenciados existem no HTML | PASS |
| BUG 1: pos-venda visivel (Artu na aba Pos-venda) | PASS |
| BUG 2: Erickao NAO entra na fila (vence 18/07) | PASS |
| Pos-venda nao polui a fila do dia | PASS |
| `cancelado` sem cadencia fica fora da fila | PASS |
| Lead tocado hoje sai da fila | PASS |
| Ordem da fila: mais vencido primeiro | PASS |
| Chip de `cadencia_rotulo` renderiza | PASS |
| Pos-venda NAO tem `fechou` nem `sem-interesse` | PASS |
| LGPD: sem consentimento nao gera deep link | PASS |
| LGPD: sem telefone nao gera deep link | PASS |
| `encodeURIComponent` no texto do script | PASS |
| `esc()` bloqueia XSS | PASS |
| **Minificado passa na mesma suite** | PASS |

**Licao:** a suite falhou 2 vezes num teste que clicava nas abas. Nao era bug do app — era bug do TESTE (`init()` nao roda em jsdom porque o client Supabase vem de script externo). **Testar `renderLista` direto, nunca simular clique que dependa de `init()`.**

---

## ESTADO DE SEGURANCA (o que falta)

**Advisor Supabase rodado nesta sessao: ZERO lint de banco.** Sobrou exatamente **um** alerta, e ele nao e de banco:

| # | Item | Nivel | Onde | Bloqueia? |
|---|---|---|---|---|
| 1 | **Leaked Password Protection desligado** | WARN | Painel: Authentication > Sign In / Providers | **Nao hoje.** Sim antes do 1o cliente SaaS. |
| 2 | Rate limits de Auth nao confirmados | — | Painel: Authentication > Rate Limits | Nao. Confirmar os defaults do FREE. |
| 3 | MFA / TOTP | — | Exige fluxo de enrollment no frontend | Adiado conscientemente para Fase 5. |

### Sobre o item 1, com precisao
- **O que e:** ao criar ou trocar senha, o Supabase consulta o HaveIBeenPwned e recusa senhas que ja vazaram em outros sites. A checagem usa hash parcial; a senha nao e enviada.
- **Ele NAO testa a senha atual.** Ligar sozinho nao protege nada. **Ligar + trocar a senha depois** e o que resolve.
- **Mitigacao equivalente hoje:** se a senha do dono for longa, unica e nunca reusada em outro site, o risco pratico e proximo de zero. Sistema single-tenant, um login so.
- **Pode exigir plano Pro.** Se aparecer com cadeado, e isso.
- **Vira BLOQUEIO REAL no gate da Fase A do SaaS**, junto com MFA. No momento em que existir usuario que nao e o dono, controle de senha deixa de ser higiene e vira obrigacao.

### O que ja esta FECHADO (nao reabrir)
- `anon` fora do schema `public` (nem `USAGE` tem)
- `authenticated` sem `TRUNCATE`, `DELETE`, `REFERENCES`, `TRIGGER`
- Helpers de RLS (`fn_tenant_atual`, `fn_papel_atual`) no schema `privado`, fora do PostgREST
- `ALTER DEFAULT PRIVILEGES` fechado: objeto novo nao nasce mais furado
- 15 policies ativas, isolamento multi-tenant provado
- Backup GPG + restore drill passando no GitHub Actions

---

## A PERGUNTA DA ESTETICA: quando reformular?

**Resposta curta: comeca AGORA, mas em duas camadas separadas, e so uma delas pode andar hoje.**

A confusao aqui e tratar "estetica" como uma coisa so. Sao duas, com riscos completamente diferentes:

### Camada 1 — LINGUAGEM VISUAL (cor, tipografia, espacamento, hierarquia, movimento)
**Pode ser reformulada AGORA. Risco praticamente zero.**

Motivo: e CSS. O markup ja e semantico (`.card`, `.chip`, `.pitboard`, `.btn-acao`), os tokens ja estao em variaveis CSS (`:root`), e o JS nao depende de aparencia — depende de classes e de `data-acao`. Trocar a pele nao toca em uma linha de logica. Nenhum teste da suite quebra.

**Pre-requisito unico e barato:** o **split do monolito** (`index.html` + `app.css` + `app.js`). Hoje sao 52 KB num arquivo so, o que faz cada edicao de design custar caro em token e aumenta o risco de derrubar o JS mexendo no CSS. **Separar primeiro, depois desenhar.** O split e mecanico, cabe numa sessao.

Restricao inegociavel que sobrevive a qualquer redesign:
- `--morno` (`#f2a71b`) e SEMANTICO. Nunca se unifica com a marca `#0025cc`.
- `quente` / `morno` / `frio` precisam continuar legiveis a distancia, no sol, no celular.

### Camada 2 — ARQUITETURA DE INFORMACAO (quais telas existem, o que cabe em cada uma)
**Tem que ESPERAR. Nao por perfeccionismo, por sequenciamento.**

Motivo: as telas que faltam ainda nao existem. A Fase 4 traz **timeline do lead** (historico de eventos). A Fase 5 traz **dashboard e metricas** e a **aba de aniversariantes**. Redesenhar a navegacao hoje significa desenhar para 4 abas e depois refazer para 6 ou 7. **Isso e retrabalho garantido.**

Sinal de alerta que ja apareceu nesta sessao: as abas passaram de 3 para 4 e os rotulos ja tiveram que ser encurtados (`Indicacoes` virou `Indic.`). **A barra de abas horizontal ja esta no limite no celular.** Ela nao aguenta a Fase 5. A decisao de navegacao (barra inferior? menu? agrupamento?) precisa ser tomada com o mapa completo de telas na mesa, nao antes.

### Sequencia recomendada
| Quando | O que |
|---|---|
| **Proxima sessao** | Split do monolito em `index.html` + `app.css` + `app.js` |
| **Logo depois (pode ser paralelo)** | **Skin pass:** nova linguagem visual, so CSS. Zero risco ao JS. |
| **Depois da Fase 5** | **Rebuild de IA:** navegacao, hierarquia de telas, com o mapa completo |

**Traduzindo:** voce pode ter um app **bonito** em duas sessoes. Um app **bem arquitetado visualmente** so depois que existir tudo o que ele precisa mostrar. Nao adianta desenhar a vitrine antes de saber quantos produtos entram nela.

---

## Primeiro movimento do proximo chat

1. **DEPLOY do que ja esta pronto.** Subir `index_deploy.min.html` no repo (Cloudflare republica sozinho) e `index_brand.html` como fonte legivel. **Sem isso, os 3 clientes de pos-venda seguem invisiveis.**
2. **Revisar a copy dos 12 scripts** (skill de conteudo). A copy semeada e FUNCIONAL, nao e a voz da Pitstop. **Agora existe um botao que entrega essa copy para cliente real.** Isso virou risco de marca ativo, nao teorico.
3. **Split do monolito.** Habilita todo o trabalho de design com custo baixo.

---

## Pendencias abertas

1. **[dono, deploy] Subir os dois arquivos no repo.** Nada aparece na tela sem isso.
2. **[dono, conteudo] Revisar os 12 scripts semeados.** Prioridade subiu: o botao ja existe.
3. **[dono, painel] Leaked Password Protection.** Unica pendencia de seguranca. Ligar E TROCAR a senha depois.
4. **[dono, painel] Confirmar rate limits de Auth** (defaults do FREE).
5. **[dono] Telefones de Yasmim (LEAD-0007) e Erickao (LEAD-0008).** Sem telefone, so texto para copiar. **Erickao vence 18/07.** Confirmar tambem Miguel (LEAD-0013): ativo ou frio.
6. **[tecnico] Split do monolito** em `index.html` + `app.css` + `app.js`.
7. **[adiado] MFA/TOTP.** Fase 5.
8. **Registrar dominio proprio** (some o `flat-resonance-09ba`).
9. **Digest diario:** segundo job `pg_cron` com o resumo do dia. Canal em aberto.
10. **Fase 4:** timeline do lead; aposentar a planilha do CRM; reapontar o sync do Notion. Pipeline de CONTEUDO segue INTEIRO no Apps Script antigo, intocado.
11. **Fase 5:** dashboard, metricas, aniversariantes. **Cravar o que mede antes de construir.**
12. **Rebuild de IA visual.** So depois da Fase 5.
13. **SaaS:** Fase A, validar demanda com sinal de pagamento. Interesse nao e pagamento. **Gate de entrada: Leaked Password + MFA.**

---

## Invariantes (atualizadas)

- Toda escrita gera registro de auditoria append-only (`fn_auditar`).
- Escrita do app so por RPC; o frontend nunca escreve direto em tabela.
- Nivel derivado na leitura, nunca armazenado (`v_lead`: 0-2 quente, 3-6 morno, 7+ frio).
- `security_invoker = on` em toda view sobre tabela com RLS. **Reconfirmar apos todo `create or replace view`** (a opcao CAI de verdade).
- "Toque enviado" e "Respondido" NUNCA colapsam num evento so.
- **WhatsApp so ABRE, nunca registra toque.** `sugerir_mensagem` e read-only por desenho.
- **Sem `consentimento = true`, sem deep link de WhatsApp.** O texto pode ser exibido; o link, nao.
- Arquivamento e irreversivel no app; nao existe hard delete de lead com historico.
- `--morno` (`#f2a71b`) e semantico e NUNCA se unifica com a marca `#0025cc`.
- **Cadencia e CONFIGURACAO, nunca codigo.** Nenhum numero de dia dentro de `fn_regua_varredura()`.
- **Copy tambem e CONFIGURACAO, nunca codigo.** Tudo em `dicionario_scripts`.
- **A chave do script e `perfil` + `passo` (inteiro), nunca o rotulo.**
- Toda tabela auditada precisa de coluna `id`.
- O banco esta em UTC; a operacao esta em America/Sao_Paulo. **TODA data de negocio usa `(now() at time zone 'America/Sao_Paulo')::date`.** `current_date` e `CURRENT_DATE` estao PROIBIDOS em funcao, view ou policy que produza data de negocio.
- Helper de RLS (`SECURITY DEFINER`) mora no schema `privado`, nunca em `public`.
- `authenticated` nunca recebe `TRUNCATE`, `DELETE`, `REFERENCES` ou `TRIGGER`. **A RLS nao protege contra TRUNCATE.**
- Tabela nova nasce com `SELECT` para `authenticated` e nada mais.
- **[NOVA] A FILA E GOVERNADA PELO MOTOR.** `cadencia_vence_em` + `cadencia_encerrada`. **`proximo_contato` e `status` NAO governam a fila.** Eles divergem do motor por desenho no perfil `em_espera` e no perfil `comprou`.
- **[NOVA] Pos-venda (`perfil = 'comprou'`) vive em aba propria** e nao tem desfecho de venda.
- **[NOVA] Frontend: validar com Acorn + jsdom antes de toda entrega.** Testar `renderLista` direto; **nunca simular clique que dependa de `init()`** (o client Supabase vem de script externo e nao carrega em jsdom).
- **[NOVA] Linguagem visual pode mudar a qualquer momento (CSS). Arquitetura de informacao so depois da Fase 5.**

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

## Contrato da RPC `sugerir_mensagem` (read-only)

Entrada: `p_lead_id uuid`. Saida: `json`.

Sucesso:
```json
{ "ok": true, "lead_id": "...", "lead_code": "LEAD-0004", "nome": "...",
  "whatsapp": "5522...", "perfil": "compra_imediata", "passo": 1,
  "passo_rotulo": "R1 · D0", "origem_script": "passo" | "fallback",
  "script_id": "...", "texto": "..." }
```
Falha: `{ "ok": false, "msg": "..." }`

Placeholders substituidos no banco: `{nome}` (primeiro nome), `{produto}`, `{condicao}`, `{valor_oferta}`, `{data_combinada}`.

`passo = 0` e o fallback do perfil: lead sem cadencia ativa ainda recebe sugestao.
**`encodeURIComponent` fica no JS DE PROPOSITO:** Postgres nao tem urlencode nativo.

---

## Dicionarios (codigos estaveis, rotulo e editavel)
- `status`: `pendente`, `feito`, `convertido`, `lista_fria`, `cancelado`
- `perfil`: `compra_imediata`, `avaliando`, `em_espera`, `repescagem`, `comprou`, `consulta`
- `origem`: `indicacao`, `instagram`, `whatsapp_direto`, `loja_fisica`, `prospeccao_ativa`, `parceria_influencer`, `parceria_pag_local`, `whatsapp_status`
- `condicao`: `lacrado`, `vitrine`, `seminovo` (**nao existe "a vista"** — condicao e estado do aparelho, nao forma de pagamento)
- `nivel`: `quente`, `morno`, `frio` (derivado, nunca gravado)
- `etapa`: `conversando`, `negociacao_parada`

---

## Colunas de `v_lead` usadas pelo frontend
`id`, `lead_code`, `nome`, `whatsapp_digitos`, `produto`, `condicao`, `perfil`, `origem`, `indicado_por`, `status`, `observacoes`, `proximo_contato`, `ultimo_toque_em`, `consentimento`, `upgrade_entrada`, `aparelho_entrada`, `valor_oferta`, `data_nascimento`, `dias_silencio`, `nivel`, `arquivado_em`, **`cadencia_passo`**, **`cadencia_rotulo`**, **`cadencia_vence_em`**, **`cadencia_encerrada`**, **`cadencia_dias_para`**

`cadencia_dias_para` negativo = passo VENCIDO. Zero = vence hoje.

---

## Referencias do sistema
- Supabase project: `unjzpyexgtbcmjfgcqrx`
- Cloudflare Worker: `flat-resonance-09ba` (`pitstopimports.workers.dev`)
- GitHub: `vinialbuquerquepitstop-beep/pitwall--nucleo` (branch `main`) — **PRIVADO**. `raw.githubusercontent.com` retorna 404. **Claude nao busca sozinho. Nao gastar turno tentando.**
- Auth UID do dono: `fb2aad8e-b728-4e59-a198-71da2156449d`
- Tenant Pitstop: `00000000-0000-0000-0000-000000000001`
- Schemas: `public` (exposto pelo PostgREST), **`privado`** (NAO exposto, mora o helper de RLS)
- Cron: `regua_pitwall_diaria`, `0 8 * * *` UTC = 05:00 America/Sao_Paulo
- Simular chamada autenticada no MCP:
  `select set_config('request.jwt.claims', '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', false); set role authenticated;`
  (rodar `reset role;` ao terminar)
- MCP Supabase: SQL multi-statement retorna SO o resultado do ultimo statement. Cada verificacao em chamada separada.
- Validacao de frontend: `npm install acorn jsdom` + `html-minifier-terser` para gerar o `.min`.
