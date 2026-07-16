# Handoff de Migracao Pit Wall 2.0 (Nucleo), v5

## Como usar este documento
Continuacao da TRILHA DE MIGRACAO. Este handoff SUBSTITUI o v4. Corre em paralelo ao v16 operacional (sistema no ar hoje, Apps Script). Para tudo que NAO mudou (schema aplicado, decisoes de schema, invariantes, stack alvo, fases), o v2, v3 e v4 continuam valendo; este v5 registra so o delta desta sessao e cravou uma correcao de rota.

Convencao de escrita: prosa sem acento, sem cedilha, nunca travessao. EXCECAO: valor real do sistema carrega seus proprios caracteres (aba com em-dash U+2014, status com emoji, perfis, tokens tenant_id, pg_cron, RLS, security_invoker).

---

## O que estamos fazendo e por que (orientacao rapida)

**O que:** tirar o Pit Wall do par Apps Script + Google Sheets e coloca-lo num banco de verdade (Postgres via Supabase) com login, frontend hospedado (Cloudflare) e a regua virando job agendado (pg_cron).

**Por que:** nao e por volume nem performance (a escala e minima, 19 linhas). E pelo MODELO DE ACESSO, quatro coisas que a stack atual nao entrega de forma nativa: login real, isolamento por usuario, auditoria completa e base multi-tenant. Isso e o que transforma "planilha de um dono" em "produto que outro lojista pode usar isolado". O banco existe pelo acesso, nao pelo dado.

**Onde estamos no processo:** o esqueleto ja esta de pe. Fase 0 (schema) aplicada e provada. Fase 1 (frontend com login) com a casca no ar e testada (login OK, RLS provada pelo browser). O que falta na Fase 1 e o miolo: as telas de LEITURA (fila, Todos, card) e o ETL das 19 linhas. Nada de dado foi migrado ainda. A operacao real segue 100% no Apps Script; o site novo e uma leitura paralela ate a Fase 2 ligar a escrita.

Mapa das fases (voce esta na 1):
- Fase 0. Schema no Postgres. FEITA e provada.
- **Fase 1. Frontend com login + telas de leitura + ETL das 19 linhas. EM ANDAMENTO. <- voce esta aqui.**
- Fase 2. Escrita no banco (cadastro, toque, desfecho) com auditoria. Fecha a blindagem.
- Fase 3. Regua nativa em pg_cron (Google Agenda fora do escopo).
- Fase 4. Aposenta a planilha, backup diario, reaponta Notion.
- Fase 5. Dashboards, visual, calculadora. So depois do nucleo.
- Fase SaaS. So quando um lojista pagar.

---

## Estado em uma frase
Nesta sessao foi obtido o schema real do banco (nomes verdadeiros das colunas), montou-se e validou-se uma primeira versao das telas de leitura, e no meio do caminho a rota foi CORRIGIDA: o nivel e os dias de silencio vao ser derivados DENTRO da view `v_lead` (caminho 1), nao no frontend (caminho 2). O index construido no caminho 2 foi DESCARTADO e NAO instalado. O passo travado agora e ler a definicao atual da `v_lead` para recria-la com seguranca.

---

## O que aconteceu nesta sessao (delta)

1. **Schema real obtido.** Rodou-se o `information_schema.columns`. Os nomes verdadeiros das colunas estao na secao "Schema real" abaixo. Isso destrava construir telas por nome certo, nao por chute.

2. **Descoberta que mudou o plano do card:** a view `v_lead` NAO expoe `nivel` nem `dias_silencio`. Hoje ela e so um espelho das colunas do `lead`. O v4 assumia que esses dois campos viriam "prontos de v_lead"; nao vem. Se o card ler `c.dias_silencio`/`c.nivel` da view atual, os dois voltam `undefined` e o termometro quebra em silencio.

3. **Duas rotas avaliadas para preencher esse buraco:**
   - **Caminho 1 (escolhido):** derivar `nivel` e `dias_silencio` como expressoes DENTRO da `v_lead`. Fonte unica no banco. Qualquer leitor futuro (regua pg_cron, dashboard da Fase 5, digest diario) le o mesmo valor. Alinhado ao v16 (fonte unica) e ao v1 da migracao ("nivel vira expressao na query, nao coluna").
   - **Caminho 2 (descartado):** derivar no frontend. Rapido e sem tocar na RLS, mas reintroduz o calculo duplicado que o v16 tinha eliminado de proposito. So faria sentido para nao mexer na view as cegas; como o index nem foi instalado, nao ha ganho em carregar esse debito.

4. **Index do caminho 2 foi construido, validado (acorn + jsdom, 43 asserts) e DESCARTADO.** O dono nao instalou. Serve so de referencia de layout (fila, Todos, card, termometro, badges de nivel morno/frio, WhatsApp com trava de consentimento na fila e link limpo em Todos). Sera refeito no caminho 1, mais enxuto, sem logica de temperatura no front.

5. **Pergunta de fundo levantada pelo dono (registrada como pendencia, ver abaixo):** falta de lembrete/confirmacao quando um lead fica sem toque. Diagnostico: nao e problema de leitura, e buraco de AVISO (push/prestacao de contas), que pertence a Fase 2/3, nao a Fase 1.

---

## DECISAO TRAVADA nesta sessao: derivacao na view (caminho 1)

`nivel` e `dias_silencio` passam a ser expressoes dentro da `v_lead`. O frontend le pronto, sem recalcular. Logica (identica a Rota A ja validada em harness):

```sql
-- dias_silencio: null se sem toque, ou se respondeu depois do ultimo toque
case
  when ultimo_toque_em is null then null
  when respondido_em is not null and respondido_em >= ultimo_toque_em then null
  else greatest(0, floor(extract(epoch from (now() - ultimo_toque_em)) / 86400))::int
end as dias_silencio,

-- nivel: 0-2 quente, 3-6 morno, 7+ frio; sem toque ou respondeu = quente
case
  when ultimo_toque_em is null then 'quente'
  when respondido_em is not null and respondido_em >= ultimo_toque_em then 'quente'
  when floor(extract(epoch from (now() - ultimo_toque_em)) / 86400) <= 2 then 'quente'
  when floor(extract(epoch from (now() - ultimo_toque_em)) / 86400) <= 6 then 'morno'
  else 'frio'
end as nivel
```

Decisao fina a bater na hora de recriar: contagem por blocos de 24h (como acima) vs dia de calendario (um toque as 23h de ontem contaria 1 dia hoje, nao 0). Default = 24h, igual ao ja validado. Trocar e uma linha.

---

## PRIMEIRO PASSO ACIONAVEL (o que esta travado agora)

NAO recriar a view as cegas. Antes, ler a definicao atual E o `security_invoker`. Isso e critico: com dado real, se o `security_invoker` estiver desligado, a view roda como dona e pode vazar leads entre tenants. Recriar sem preservar isso quebraria a blindagem, que e o motivo inteiro da migracao.

Rodar no SQL Editor do Supabase (projeto `unjzpyexgtbcmjfgcqrx`):

```sql
-- 1) corpo atual da view
select pg_get_viewdef('public.v_lead', true) as viewdef;

-- 2) opcoes da view (procurar por security_invoker=true)
select relname, reloptions
from pg_class
where relname = 'v_lead';
```

Com essas duas saidas, o proximo chat monta o `CREATE OR REPLACE VIEW` completo, preservando colunas, join e `security_invoker = on`, com as duas expressoes novas. Entrega pronto pra colar.

Em paralelo, para destravar o ETL, ler tambem (read-only, seguro):

```sql
-- 3) mapa rotulo -> codigo, para o ETL traduzir os valores do Sheets
select dominio, codigo, rotulo from dicionario_rotulos order by dominio, ordem;
```

---

## PROMPT PRONTO PARA A EXTENSAO CLAUDE IN CHROME

Cole o bloco abaixo numa sessao do Claude in Chrome, com a aba do Supabase ja aberta e logado. O agente le o resultado direto da tela, o que resolve o problema de "nao consigo copiar o resultado" do SQL Editor.

```
Voce vai executar TRES consultas SQL de leitura no Supabase e me devolver o resultado
COMPLETO de cada uma, em texto. Sao todas read-only. NAO rode nenhum outro comando,
NAO altere, crie ou apague nada. Se qualquer consulta parecer que vai escrever, pare
e me avise.

Contexto: projeto Supabase ref unjzpyexgtbcmjfgcqrx. Preciso da definicao da view
v_lead e das opcoes dela, mais o dicionario de rotulos.

Passos:
1. Va para o SQL Editor do projeto (app.supabase.com, projeto unjzpyexgtbcmjfgcqrx,
   secao SQL Editor). Abra uma nova query.
2. Cole e rode esta consulta. Copie o valor inteiro do campo viewdef, sem cortar:
   select pg_get_viewdef('public.v_lead', true) as viewdef;
3. Nova query. Cole, rode e me diga o conteudo da coluna reloptions (em especial se
   aparece security_invoker=true):
   select relname, reloptions from pg_class where relname = 'v_lead';
4. Nova query. Cole, rode e me devolva todas as linhas (dominio, codigo, rotulo):
   select dominio, codigo, rotulo from dicionario_rotulos order by dominio, ordem;

Me entregue as tres saidas identificadas como (1) viewdef, (2) reloptions, (3)
dicionario. Se alguma consulta der erro, cole a mensagem de erro exata.
```

Depois que o Chrome trouxer as tres saidas, cole-as no proximo chat. Com (1) e (2) recrio a `v_lead` com seguranca; com (3) destravo o ETL.

---

## Depois da view: reconstruir o index (caminho 1)

Mesmas telas do descartado, porem lendo `c.nivel` e `c.dias_silencio` prontos da view. Remove a funcao `derivar()` do front. Continua sendo SO LEITURA (nada de escrita; toque, desfecho e cadastro sao Fase 2). Layout de referencia ja definido:
- Duas abas: Fila do dia e Todos (com busca por nome/telefone/produto).
- Card: nome, lead_code, produto, condicao, status, chip de perfil.
- Termometro: `Nd sem resposta`, vermelho a partir de 3 dias.
- Nivel: suprime "Quente" (default, ruido), destaca morno/frio. Decisao do dono, reversivel em 1 linha.
- WhatsApp na fila: com template + trava de consentimento (so aparece se `consentimento = true`). Na aba Todos: link limpo, sem template, sem trava. Nenhum dos dois registra toque (isso e Fase 2).
- Validacao exigida antes de entregar: acorn (script, es2022) no arquivo completo + jsdom.

Config do arquivo: `SUPABASE_URL` = `https://unjzpyexgtbcmjfgcqrx.supabase.co` (ja sei). `SUPABASE_ANON_KEY` = copiar da casca atual (index.html do v4). A `service_role` NUNCA vai pro frontend.

---

## ETL das 19 linhas (o gate do dado)

Sem ETL, as telas sobem vazias e nao da pra validar de verdade. Desenho inalterado (v2/v3/v4):
- Traduz rotulo do Sheets para codigo normalizado via `dicionario_rotulos` (direcao inversa: rotulo -> codigo). Por isso a consulta (3) do prompt acima.
- `lead_code` vem do Lead ID da planilha (as 19 ja tem, backfill rodado no v4).
- Datas para timestamptz. `tenant_id` fixo em `...0001`.
- Rodar uma vez, conferir 19 linhas.
- ARMADILHA que ja custou caro: no Sheets, Produto (col C) = qual aparelho; Modelo (col D) = condicao. No schema ja estao separados em `produto` e `condicao`. NAO inverter no ETL.

O que falta pra gerar os inserts: a saida (3) do dicionario + o CSV da aba do CRM (exportar a aba `Pitstop Imports — CRM de Clientes` como CSV e subir no chat). Com os dois, o proximo chat gera os 19 `insert` prontos.

---

## PENDENCIA NOVA registrada: notificacao / confirmacao (Fase 2/3)

O dono levantou a falta de aviso quando um lead fica sem toque. Diagnostico e enderecamento:
- NAO e falha da leitura nem da derivacao. O lead sem toque NAO se perde: pela Regra 1 da regua (avanco so com toque confirmado), ele fica na fila esperando acao; pela Regra 2, so vira ❄️ Lista fria quem foi tocado e ignorado. A falha real e "o operador nao abre a fila", entao o alvo e a atencao do operador, nao a logica do lead.
- Sao dois pedidos distintos:
  - **Lembrete (push):** avisar sem abrir o app. Hoje o modelo e pull (a fila so aparece se abrir). No Apps Script isso era coberto pelos eventos do Google Agenda, que a migracao tirou de proposito prometendo "notificacao na tela" no lugar, ainda nao construida.
  - **Confirmacao (fechar o loop):** tipo "tocou 2 de 5, sobraram 3". Exige a camada de escrita (Fase 2) pro app saber o que foi tocado. Sem escrita, e chute.
- Lugar certo: depois da Fase 2 (escrita) e apoiado na regua da Fase 3 (pg_cron), que define de forma principiada quem esta vencido/esfriando. Construir antes e por o carro na frente do motor.
- Ganho barato quando chegar la: um pg_cron manda 1x/dia um digest ("Fila hoje: N. Esfriando: X. Vencidos: Y."), cumprindo a promessa da notificacao no lugar da Agenda. Precisa so de um read agendado + um canal. Canal em aberto (tradeoffs): email (gratis, mas ignoravel), WhatsApp pra si mesmo (chega onde ja se olha, depende da camada de mensagem ja prevista pra abstrair), push do browser (bom no celular, exige permissao).
- Acao agora: NENHUMA. Anotado como item de Fase 2/3. Nao construir na Fase 1.

---

## Schema real do banco (obtido nesta sessao)

Tabelas: `tenant`, `app_usuario`, `lead`, `lead_evento`, `cadencia_estado`, `auditoria`, `evento_uso`, `dicionario_rotulos`. View: `v_lead`.

Colunas da tabela `lead` (a base do CRM):
`id` (uuid), `tenant_id` (uuid), `lead_code` (text), `dono_user_id` (uuid), `nome`, `whatsapp_digitos`, `produto`, `condicao`, `perfil`, `origem`, `indicado_por`, `status`, `tipo_msg`, `situacao`, `observacoes`, `data_contato` (date), `proximo_contato` (date), `ultima_resposta` (date), `ultimo_toque_em` (timestamptz), `respondido_em` (timestamptz), `etapa_cadencia`, `consentimento` (bool), `consentimento_em` (timestamptz), `upgrade_entrada` (bool), `aparelho_entrada`, `qtd_compras` (int), `valor_total` (numeric), `valor_oferta` (numeric), `criado_em`, `atualizado_em`.

Colunas da view `v_lead` HOJE (espelho do lead, SEM os derivados):
`id, tenant_id, lead_code, dono_user_id, nome, whatsapp_digitos, produto, condicao, perfil, origem, indicado_por, status, tipo_msg, situacao, observacoes, data_contato, proximo_contato, ultima_resposta, ultimo_toque_em, respondido_em, etapa_cadencia, consentimento, consentimento_em, upgrade_entrada, aparelho_entrada, qtd_compras, valor_total`.
Falta na view vs tabela: `valor_oferta`, e os DOIS derivados a adicionar (`nivel`, `dias_silencio`).

`dicionario_rotulos`: `dominio`, `codigo`, `rotulo`, `ordem`. E o tradutor rotulo <-> codigo (usado no ETL e nas telas). No teste do v4 tinha 25 linhas.

`cadencia_estado`: `lead_id`, `tenant_id`, `perfil`, `passo_atual`, `passo_rotulo`, `passo_vence_em` (date), `encerrada` (bool), `atualizado_em`. Estado da regua da Fase 3.

`auditoria`: append-only, `tabela`, `registro_id`, `acao`, `antes` (jsonb), `depois` (jsonb), `usuario_id`, `criado_em`. Alimentada na Fase 2.

`lead_evento`: `lead_id`, `tipo`, `detalhe`, `criado_por`, `criado_em`. O historico por lead no modelo novo.

---

## Invariantes e travas (seguem validas)
Todas as 8 invariantes e a trava estrategica do v2 seguem intactas. Nenhum dado migrado (invariante de "nao migrar antes do destino existir" preservada; destino existe desde a Fase 0, mas o ETL ainda nao rodou). Reforcos desta sessao:
- Nivel derivado na leitura, nunca armazenado. Agora na view (caminho 1), nao no front.
- Nao colapsar "toque enviado" e "respondido". Nao colapsar frio (nivel, leitura) com ❄️ Lista fria (status, decisao).
- Produto = aparelho; condicao = condicao. Nao inverter no ETL.
- `service_role` nunca no frontend; anon key e publica, protegida por RLS.
- Recriar view preservando `security_invoker`, senao a RLS vaza.

---

## Pendencias abertas (fila do proximo trabalho)
1. **[PRIMEIRO] Ler `pg_get_viewdef` + `reloptions` da `v_lead`** (prompt do Chrome acima). Destrava a recriacao da view.
2. Recriar `v_lead` com `nivel` e `dias_silencio` (caminho 1), preservando security_invoker.
3. Reconstruir o index (caminho 1): fila, Todos, card, lendo derivados prontos. Acorn + jsdom antes de entregar. Subir no Cloudflare.
4. ETL das 19 linhas: precisa do `dicionario_rotulos` (saida 3 do Chrome) + CSV da aba do CRM.
5. Higiene do v4, ainda aberta: trocar a senha do dono que passou em texto claro no historico do SQL Editor; corrigir a Site URL do Auth (ainda em localhost) antes de qualquer email de recovery.
6. Registrar dominio proprio (some o nome aleatorio `flat-resonance-09ba` do Cloudflare).
7. Notificacao/digest diario: item de Fase 2/3, nao construir agora.
8. Fases 2 a 5 conforme o mapa. SaaS so com pagante.

## Timebox
Janela de 2 semanas iniciada em 04/07/2026. O grosso da Fase 1 (telas + ETL) e o maior consumidor da janela e ainda esta por fazer. Criterio de parada recomendado (nao adotado formalmente): se ao fim das 2 semanas a operacao diaria nao estiver na stack nova, congelar a migracao, voltar ao Apps Script e reavaliar.

---

## Referencias de sistema
- **Projeto Supabase (Nucleo):** `unjzpyexgtbcmjfgcqrx`, org vinialbuquerquepitstop-beep, plano FREE, PRODUCTION, branch main.
- **URL do frontend:** `https://unjzpyexgtbcmjfgcqrx.supabase.co`.
- **Cloudflare:** Worker-assets `flat-resonance-09ba`, subdominio workers.dev da conta (URL exata a reconfirmar).
- **Tenant 1 (Pitstop Imports):** `00000000-0000-0000-0000-000000000001`.
- **Usuario dono:** auth.users id `fb2aad8e-b728-4e59-a198-71da2156449d`, papel dono, email `vinialbuquerque.pitstop@gmail.com`.
- **CRM Sheets (origem do ETL):** `1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY`, aba `Pitstop Imports — CRM de Clientes`.
- **Uso/conteudo Sheets:** `1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhF09Ue7ek`.
- **Notion calendario:** DB `ab0fc93f-d964-4f32-8c81-4be5343687b3`.
- **Status CRM (5 fixos):** 🟡 Pendente, ✅ Feito, 🟢 Convertido, ❄️ Lista fria, 🚫 Cancelado.
- **Nivel (Rota A):** 0-2 quente, 3-6 morno, 7+ frio.
- **Escala atual:** 19 linhas, 0-2 toques/dia, ~20 leads/mes.
- **Artefato da Fase 0:** `fase0_schema_nucleo.sql` (57 statements), aplicado e provado.
- **Artefato da Fase 1 (casca no ar):** `index.html` login + diagnostico (v4).
- **Descartado nesta sessao:** index de leitura no caminho 2 (nao instalado; refazer no caminho 1).
