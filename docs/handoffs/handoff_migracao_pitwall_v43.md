# Handoff Migracao Pit Wall (Nucleo) v43

Substitui a v42. Data: 31/07/2026.

---

## 1. Headline: a regua estava PARADA. Nao lenta, parada.

Pedido do dono: *"analise a regua de crm e suas acoes relacionadas, audite e
encontre brechas, falhas, incoerencias e pontos de melhoria"* e, depois da
auditoria, *"ok para acoes de melhorias do crm, atue com liberdade"*.

O diagnostico, medido no banco vivo antes de escrever qualquer linha:

- **16 das 16 cadencias vencidas estavam travadas. 100%.** LEAD-0007 (Yasmim)
  parado ha **23 dias** na fila sem a maquina fazer nada.
- Em toda a historia do sistema: **11 `cadencia_avancou` para 11 `toque_enviado`**
  (1 para 1), **0 `esfriado_por_silencio`**, **0 `cadencia_encerrada`**,
  **1 `perfil_transicionado`**. A regua nunca decidiu nada sozinha: era espelho
  do clique, nao motor.
- **0 eventos `respondeu` na base inteira.** Nao existia RPC `registrar_resposta`.
  O botao "Respondeu" da Fila existia, mas com `data-acao="leque"`: **so abria o
  menu de desfechos, nao registrava nada.** O invariante 2 estava correto no
  schema e morto na operacao.
- **`nivel` mentia**: `ultimo_toque_em IS NULL` retornava `'quente'`. Os 6 leads
  mais negligenciados da base eram os que a tela pintava de melhor.
- **Duas fontes de verdade** para "quando falar de novo": `lead.proximo_contato`
  (que a Fila ordena) e `cadencia_estado.passo_vence_em` (que a regua obedece).
  LEAD-0005 remarcado para 20/09 com a regua achando 27/07.
- **Estados orfaos**: `registrar_desfecho`, `arquivar_lead` e `editar_lead` nao
  encerravam nem sincronizavam a cadencia. LEAD-0017 era `lista_fria` com
  cadencia viva vencida ha 10 dias.
- **Pos-venda 100% morto**: 5 clientes travados no `P1 · D1`, porque o passo
  ancorava em `toque_anterior` e no pos-venda **nao existe toque anterior**, o
  marco e a venda.
- **Ninguem vigiava a regua.** O `cron.job` descartava o retorno. A regua estava
  inerte ha semanas e nenhuma tela avisou.

### A causa raiz

A REGRA 1 da varredura (`sem toque confirmado, NAO avanca`) tinha a intencao
certa e o `continue` no lugar errado: **todo o resto da maquina** (esfriamento,
transicao, encerramento, `limite_silencio_dias`) vivia **depois** dele, no mesmo
loop. Consequencia:

> A regua so agia sobre o lead que voce ja tinha trabalhado. Quem voce esqueceu,
> ela tambem esquecia. Exatamente o inverso da razao de existir dela.

---

## 2. Decisoes tomadas (e o que foi recusado)

1. **O beco da REGRA 1 virou caminho.** Coluna nova
   `cadencia_perfil.dias_ate_abandono`. Passo vencido sem toque: dentro da
   tolerancia segue cobrando na fila; passando dela, a regua decide sozinha.
   Recusado deixar o `continue` e so alertar na tela: alerta que ninguem le e a
   mesma coisa que nada.
2. **Abandono nao e esfriamento.** Evento novo `abandonado_sem_toque`.
   `esfriado_por_silencio` = o cliente sumiu; `abandonado_sem_toque` = eu sumi.
   Colapsar os dois apagaria a unica pergunta que importa na revisao semanal.
3. **O freio de resposta deixou de ser permanente.** MUDANCA CONSCIENTE DE
   COMPORTAMENTO, sinalizada ao dono. Antes: responder punha `encerrada = true`
   para sempre, e o lead que engajou (o mais valioso) saia da maquina e nunca
   voltava. Agora o freio e **relativo**: enquanto a ultima palavra for do
   cliente, a bola e sua e a regua nao empurra; assim que voce toca e ele nao
   volta, o silencio recomeca e a regua retoma. O invariante 2 continua valendo
   (responder freia); o que caiu foi a sentenca perpetua.
4. **`sem_contato` e nivel proprio, nao "quente".** Recusado inventar cor nova
   sem medir: usa a paleta `--quente` (ja medida, 4.65 no tint) porque e o estado
   que mais pede acao, com **rotulo proprio** para nao se disfarcar de "vai bem".
   Nivel nao e temperatura aqui, e ausencia de leitura.
5. **Quem respondeu sem eu ter tocado NAO e `sem_contato`.** A prova pegou isso:
   lead que chegou pelo Instagram e mandou mensagem sozinho caia em
   `sem_contato`. Houve contato, foi ele quem comecou. `respondido_em` tem
   precedencia sobre `ultimo_toque_em` nulo.
6. **Uma fonte de verdade para a data.** `reagendar_proximo_contato` passa a
   escrever tambem em `passo_vence_em`. Recusado deixar a Fila ler
   `passo_vence_em` direto: o operador remarca o LEAD, nao o passo.
7. **Trocar perfil = trocar estrategia.** `editar_lead` com perfil novo reinicia
   a cadencia no passo 1 do perfil novo, com evento `perfil_transicionado`
   marcado `(manual)`. Antes o join da regua seguia rodando o perfil antigo em
   silencio.
8. **`convertido` NAO encerra a cadencia; `sem_interesse` sim.** Quem comprou
   entra no pos-venda. Encerrar no "Fechou" mataria o upgrade D180/D365.
9. **Pos-venda ancora em `data_venda`.** Ancora nova no CHECK de
   `cadencia_regra`. Cliente **sem venda registrada** (os 3 herdados do CRM) tem
   a cadencia encerrada com evento explicando: nao existe ancora confiavel, e
   inventar uma data envenenaria o pos-venda. Eles ja aparecem em **Falta venda**.
10. **`authenticated` continua SEM escrita direta em `cadencia_estado`.** A prova
    exigiu isso e pegou o bug: as RPCs novas quebrariam em producao por falta de
    privilegio. Solucao: helpers **SECURITY DEFINER no schema `privado`**
    (invisiveis ao PostgREST, invariante 8), chamados so **depois** de a RPC ja
    ter provado o acesso ao lead via RLS. Recusado dar `GRANT UPDATE` (abriria
    escrita direta pela API) e recusado tornar as RPCs DEFINER (perderiam o RLS
    que hoje as isola).
11. **`regua_execucao` grava UMA LINHA POR TENANT.** A prova pegou o vazamento: a
    primeira versao gravava `tenant_id` nulo com policy `tenant_id is null or
    ...`, entao qualquer tenant enxergava a execucao de todos. Violava o
    invariante 7.

---

## 3. Banco (9 migrations, todas aplicadas)

| migration | o que faz |
|---|---|
| `regua_config_abandono_ancora_venda_execucao` | `cadencia_perfil.dias_ate_abandono`; ancora `data_venda`; evento `abandonado_sem_toque`; tabela `regua_execucao` com RLS; calibragem inicial |
| `regua_varredura_v2_destrava_abandono` | `privado.fn_regua_desfecho` (a precedencia num lugar so) + varredura reescrita: higiene, ancora de venda, log |
| `regua_freio_reversivel_por_toque` | o freio de resposta vira relativo |
| `rpcs_resposta_e_sincronia_de_cadencia` | `registrar_resposta` (nova) + reagendar/desfecho/arquivar/editar sincronizando estado |
| `v_lead_nivel_sem_contato_e_speed_to_lead` | nivel `sem_contato`; `primeiro_toque_em`, `horas_ate_1o_toque`, `horas_esperando_1o_toque`, `bola_com`; rotulo novo |
| `backfill_posvenda_ancora_data_venda` | rebaseia o P1 na data da venda; encerra pos-venda sem ancora |
| `backfill_reconcilia_proximo_contato_e_cadencia` | limpa o passivo das duas fontes de verdade |
| `helpers_privados_escrita_cadencia` + `rpcs_usam_helpers_privados_cadencia` | `privado.fn_cadencia_reagendar/encerrar/trocar_perfil` e as RPCs usando |
| `fix_nivel_respondido_vence_sem_contato` / `regua_execucao_log_por_tenant_rls_estrita` | as duas correcoes que a prova exigiu |
| `fix_search_path_helpers_privados` | higiene herdada apontada pelo advisor |

Cuidados do CLAUDE.md cumpridos e conferidos: `security_invoker = on` reconferido
em `pg_class.reloptions` nas TRES views apos `CREATE OR REPLACE`; ACL refeita
(`revoke`/`grant`) apos cada `CREATE OR REPLACE FUNCTION`; nenhum numero de
cadencia dentro do corpo da funcao (invariante 11).

---

## 4. Frontend (5 costuras, cada uma conferida como ocorrencia UNICA)

`ferramentas/patch_regua_crm.js` e `ferramentas/patch_regua_painel.js` (o script
aborta se achar 0 ou 2 ocorrencias):

1. delegado trata `"respondeu"` chamando `registrar_resposta`;
2. o botao **Respondeu** passa a REGISTRAR; o leque vira **Desfecho** (rotulo
   honesto);
3. o chip de nivel passa a mostrar `sem_contato`;
4. funcao `reguaLinha` entra antes de `syncLinha` (mesmo escopo);
5. `renderHoje` pinta a linha da regua entre o placar e a fila.

`public/app.css`: `.card.t-sem_contato::before` e `.chip.nivel-sem_contato`,
ambos sobre a paleta `--quente` ja medida. Nenhum token de cor novo entrou.

---

## 5. Provas

| prova | resultado |
|---|---|
| `node ferramentas/prova_regua.js` (**nova**) | **27 assercoes, 0 falhas, EXIT 0** |
| `node ferramentas/prova_cliente.js` | 109 assercoes, EXIT 0 (sem regressao) |
| `node ferramentas/prova_nf.js` | 54 assercoes, EXIT 0 |
| `node ferramentas/prova_metricas.js` | 65 assercoes, EXIT 0 |
| `node ferramentas/prova_sessao.js` | 18 assercoes, EXIT 0 |
| `node --check public/app.js` | EXIT 0 |
| carga do arquivo inteiro em VM | sem ReferenceError |

**17 assercoes no banco**, com `set local role authenticated` e claims do dono,
dentro de transacao que **volta atras de proposito** (`raise exception` no fim):
registrar_resposta grava exatamente 1 evento; nivel vira `quente` e nao
`sem_contato`; `bola_com = voce`; reagendar sincroniza `passo_vence_em`; trocar
perfil reinicia no passo 1; `sem_interesse` encerra a cadencia e limpa a data;
arquivar encerra; **tenant errado nao registra, nao reagenda, nao arquiva, ve 0
leads e 0 execucoes da regua**; `authenticated` segue sem UPDATE direto em
`cadencia_estado`; `fn_regua_desfecho` nao e executavel pelo usuario.

Advisors de seguranca: **nenhum warning novo**. Os 5 restantes sao herdados
(`registrar_venda` e `remover_nf` DEFINER expostos; leaked password protection).

**O que NAO foi provado:** o fluxo pela TELA logada (exigiria a senha do dono) e
a suite Python (`validar.py`, `harness.py`, `prova_trilho.py`), que segue sem
rodar nesta maquina por falta de Python. O contraste de `sem_contato` usa tokens
ja medidos, mas nao foi remedido em Chrome headless.

---

## 6. O estado depois da obra (medido)

Primeira execucao real da regua nova: **2 de higiene** (LEAD-0003 e LEAD-0017),
**2 transicoes** por abandono (LEAD-0008 e LEAD-0013 para repescagem), **1
abandono** para lista fria (LEAD-0007, 23 dias). Segunda rodada: **0 acoes**
(idempotente).

| medida | antes | depois |
|---|---|---|
| cadencias travadas | 16 de 16 | 0 |
| leads falsamente "quentes" | 6 | 0 |
| `sem_contato` visivel na tela | nao existia | 6 |
| bola comigo / com o cliente / fora do jogo | invisivel | 12 / 2 / 5 |
| pos-venda ancorado | nunca disparou | 2 ativos, 3 encerrados por falta de venda |

**Speed-to-lead, medido pela primeira vez: media de 238,4 horas (~10 dias) do
cadastro ate o primeiro toque.** O benchmark de mercado e 5 minutos; acima de 24h
a taxa de fechamento cai para ~12%. A pior espera viva e de **615,6 horas (~26
dias)** de alguem que nunca foi tocado. Esse numero, sozinho, vale mais que
qualquer ajuste de cadencia que se faca daqui pra frente.

---

## 7. Como usar (caminho exato)

**Ver se a regua esta viva:** aba **Hoje**, logo abaixo do placar:
`régua rodou há 3h · 9 leads atrasados`. Se passar de 26h, a linha fica ambar e
diz `· atrasada`. Se nunca rodou ou falhou, ela diz isso com o motivo.

**Registrar que o cliente respondeu:** aba **Fila do dia** -> no card, botao
**Respondeu**. Isso freia a cadencia enquanto a bola estiver com voce. O botao
**Desfecho** (que antes se chamava Respondeu) abre Conversando / Retomar /
Fechou / Sem interesse.

**Ler o termometro certo:** chip **Sem contato** (laranja) = ninguem falou com
essa pessoa ainda. Nao e "quente", e divida.

**Remarcar:** **Desfecho** -> **Retomar** -> data -> **Confirmar**. Agora a regua
obedece a data que voce escolheu.

**Ajustar a tolerancia de abandono:** e DADO, nao codigo.
`update cadencia_perfil set dias_ate_abandono = 5 where perfil = 'compra_imediata';`
Hoje: compra_imediata 7, avaliando 10, consulta 10, em_espera 7, repescagem 21,
comprou NULL (nunca abandona).

---

## 8. Pendencias

1. **A fila continua ordenada por `proximo_contato`, nao por `bola_com`.** As
   colunas novas (`bola_com`, `horas_esperando_1o_toque`) existem na `v_lead` e
   **ainda nao sao usadas pela tela**. O proximo ganho grande e a Fila abrir pelo
   que esta com a bola comigo ha mais tempo, nao pela data.
2. **Speed-to-lead nao esta no Dashboard.** O dado existe (`horas_ate_1o_toque`);
   falta a metrica em `painel_metricas` e o tile na tela.
3. **`permite_esfriar` segue inalcancavel** em 4 dos 6 perfis (a transicao tem
   precedencia e todos tem `perfil_seguinte`). Config que documenta
   comportamento que nao existe: ou ganha precedencia configuravel, ou sai.
4. **`etapa_cadencia` segue decorativa**: 0 leads usam, `negociacao_parada` nao
   tem escritor nenhum e a regua nao le. Mesma decisao pendente.
5. VENDA-0002 e VENDA-0003 identicas (v42 item 1), cadastro vazio nos clientes
   (v42 item 2), agregados herdados divergentes (v42 item 3) e as pendencias da
   v39 seguem abertas.

---

## 9. Aviso de ambiente (sem mudanca desde a v40)

`origin` aponta pra um proxy morto. Push (que E o deploy) sai por
`git push https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo.git main`.
Conferir `git log -1` antes de commitar: este clone recebe commits de outras
sessoes pelo OneDrive.

A Cloudflare serve as duas versoes durante o rollout: medir o tamanho uma vez so
mente. Repetir ate estabilizar (receita na v42 secao 9). `/index.html` responde
0 byte no worker; medir pela raiz com `curl -sL`.
