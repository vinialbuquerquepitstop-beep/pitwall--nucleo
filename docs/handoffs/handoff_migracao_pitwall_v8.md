# Handoff de Migracao Pit Wall 2.0 (Nucleo), v8

## Como usar este documento
Continuacao da TRILHA DE MIGRACAO. Este handoff SUBSTITUI o v7. Corre em paralelo ao v16 operacional (Apps Script, ainda no ar). Para o que NAO mudou (decisoes de schema, invariantes, stack alvo, fases), o v1 a v7 seguem validos; este v8 registra so o delta desta sessao.

Delta do v8 em uma linha: o ETL das linhas reais foi executado e provado no banco, o index de leitura (Fase 1) foi construido, validado e SUBIDO no Cloudflare, e a Fase 1 esta FECHADA. Abre a Fase 2 (escrita) e entra uma pendencia nova de marca visual.

Convencao de escrita: prosa sem acento, sem cedilha, nunca travessao (usar virgula, parenteses ou ponto conforme a gramatica). EXCECAO: valor real do sistema carrega seus proprios caracteres (aba com em-dash U+2014, status com emoji, perfis, tokens tenant_id, pg_cron, RLS, security_invoker).

---

## Estado em uma frase
Fase 1 FECHADA: 15 leads reais migrados e provados no banco, index de leitura no ar no Cloudflare (login + fila + Todos + termometro lendo derivados da v_lead), zero escrita. O proximo bloco e a Fase 2 (escrita com auditoria: toque, desfecho, cadastro), e antes dela ha uma tarefa barata de marca visual pendente.

---

## CORRECAO DE FATO: sao 15 leads reais, nao 19
Os handoffs v1 a v7 repetiam "19 linhas". A leitura direta da planilha nesta sessao mostrou 16 linhas de dado (LEAD-0001 a LEAD-0016), sendo a 0016 a linha TESTE CADASTRO, que fica fora do ETL. Base real migrada: 15 leads (LEAD-0001 a LEAD-0015). Onde qualquer documento anterior disser 19, ler 15.

---

## O que foi executado nesta sessao (no banco real e no frontend)

### 1. Triagem de estado feita por declaracao, nao linha a linha
O dono declarou o estado real de cada lead por voz, em vez de auditar a planilha celula a celula. A parte mecanica da auditoria (telefone normalizavel, Lead ID presente, datas parseaveis, inversao C/D) foi verificada por leitura direta da planilha via conector do Drive. So o julgamento de estado (status real, proximo contato, perfil) veio do dono. A planilha NAO foi editada; as correcoes foram aplicadas direto nos inserts. Esse padrao (declarar estado, nao operar a planilha) foi eficiente e vale repetir em migracoes futuras.

### 2. Quatro migrations aplicadas (nesta ordem)
1. `dicionario_add_consulta_whatsapp_status`: dois codigos novos que existiam na planilha e faltavam no dicionario. Perfil `consulta` (rotulo `Lead — Consulta`, em-dash U+2014, ordem 6) e origem `whatsapp_status` (rotulo `WhatsApp Status`, ordem 8).
2. `lead_checks_add_consulta_whatsapp_status`: as CHECK constraints da tabela `lead` (`lead_perfil_check` e `lead_origem_check`) espelhavam o dicionario antigo e barraram o insert. Foram estendidas para incluir os dois codigos novos. LICAO: o dicionario e as check constraints sao duas fontes de verdade que precisam andar juntas; ao adicionar codigo novo, atualizar as duas.
3. `lead_whatsapp_digitos_nullable`: `whatsapp_digitos` deixou de ser NOT NULL. Dois leads reais (Yasmim, Erickao) nao tem telefone na base. A obrigatoriedade do telefone volta na camada de cadastro da Fase 2 (validacao no app), nao no banco; so o legado entra sem numero.
4. `etl_leads_iniciais_pitstop_v2`: os 15 inserts.

### 3. ETL provado no banco
15 na tabela, 15 na view, trigger de auditoria disparou 15 registros de INSERT. Distribuicao de status: 10 pendente, 3 convertido, 1 lista_fria, 1 cancelado. 15 com consentimento true. Derivados da v_lead conferidos em dado real (ex.: Zana frio/17d, Duda frio/29d, Yasmim morno/4d, Clara quente/2d, Erickao quente porque respondeu depois do toque). Rota A funcionando de ponta a ponta.

### 4. Index de leitura construido, validado e SUBIDO
Arquivo `index.html` unico (556 linhas), no ar no Worker `flat-resonance-09ba`. Conteudo:
- Login email e senha (Supabase Auth), sessao persistente.
- Pit board: 4 contadores (na fila, em atraso, ativos, na base).
- Aba Fila do dia: pendente com proximo contato vencido ou de hoje, mais atrasado primeiro, escondendo quem foi tocado hoje.
- Aba Todos: base completa, busca por nome/telefone/produto, chip de status.
- Card: nome, lead_code, produto + condicao, chip de perfil, chip de atraso, termometro `Nd sem resposta` (vermelho a partir de 3 dias, lendo `dias_silencio` pronto da view), observacoes. Assinatura visual: faixa de temperatura na borda esquerda (quente vermelho, morno ambar, frio azul). Quente suprimido nos badges (so faixa); morno e frio com badge.
- WhatsApp na fila: template + trava de consentimento fail-closed. Na aba Todos: link limpo, sem template, sem trava. Nenhum registra toque.
- Rotulos: busca `dicionario_rotulos` do banco em runtime, com fallback embutido (espelho de 05/07/2026) se a leitura falhar.
- Validacao real: acorn (sourceType script, es2022) no arquivo completo + jsdom com 40 asserts, 0 falha. Cobre regra da fila (7 casos), ordenacao, template + trava, link limpo, busca nos 3 campos, termometro nas 3 faixas, supressao do quente, dicionario sobrepondo fallback, escape anti-XSS, e a garantia de que o codigo nao contem insert/update/delete/upsert/rpc (somente leitura provada por teste).

---

## Estado de cada lead migrado (referencia rapida)

| lead_code | Nome | status | perfil | proximo_contato | Nota |
|---|---|---|---|---|---|
| LEAD-0001 | Diego Barbosa | convertido | comprou | (sem) | Indicador ativo, manter relacionamento |
| LEAD-0002 | Vinicius | cancelado | (sem) | (sem) | |
| LEAD-0003 | Jessica | pendente | repescagem | 06/07 | Consentimento gravado Sim nesta sessao |
| LEAD-0004 | Zana | pendente | repescagem | 06/07 | REATIVADA (era lista fria). Forte nivel de venda. Indicada por Julia Souza. Consentimento Sim |
| LEAD-0005 | Duda nanda | pendente | consulta | 06/07 | Quer 17 Pro 256, da 15 Pro 128 de entrada |
| LEAD-0006 | Isac smart | convertido | comprou | (sem) | 2a compra em 06/06, pos-venda |
| LEAD-0007 | Yasmim Brum | pendente | repescagem | 08/07 | SEM TELEFONE |
| LEAD-0008 | Erickao | pendente | em_espera | 20/07 | SEM TELEFONE. Data 20/07 arbitraria. Respondeu 12/06. Consentimento Sim |
| LEAD-0009 | Anderson barbeiro | lista_fria | repescagem | (sem) | Lista fria de verdade, manter perto |
| LEAD-0010 | Brenno Rodrigues | pendente | repescagem | 13/07 | Interesse MacBook, ofertar semana que vem |
| LEAD-0011 | Lucc Redley | pendente | repescagem | 13/07 | MacBook pra edicao |
| LEAD-0012 | Eduarda DUDA | pendente | repescagem | 07/07 | Indicada pela Zana |
| LEAD-0013 | Miguel | pendente | consulta | 07/07 | ASSUMIDO ativo por Claude, dono nao decidiu. Se for frio, e 1 update |
| LEAD-0014 | Artu medeiros | convertido | comprou | (sem) | Cliente recorrente |
| LEAD-0015 | Clara mesquita | pendente | consulta | 10/07 | Cartao vira 12/07, tocar ANTES do dia 12 |

Decisoes de mapeamento assumidas (reverter e trivial): perfil `Comprou — Recorrente` mapeado para `comprou` (recorrencia fica derivavel de qtd_compras); origem `Barbearia` mapeada para `parceria_pag_local`; nivel nunca gravado (Rota A).

---

## PENDENCIA NOVA: marca visual no app (barata, entra antes da Fase 2)
O dono pediu para ajustar a marca da Pitstop no app. Escopo e limite ja esclarecidos nesta sessao:

O QUE E BARATO E ENTRA AGORA (valor fixo no index.html, sem tocar no banco, sem furar fase):
- Logo da Pitstop no lugar do texto `PIT/WALL`.
- Cor de destaque da marca (hoje ambar `#f2a71b`, provisorio).
- Texto do template de WhatsApp da fila (hoje "Oi {nome}! Vi seu interesse no {produto}, posso te passar as condicoes?").

O QUE NAO E DO PIT WALL (esclarecido ao dono, registrar para nao reabrir):
- O nome e a foto que o CLIENTE ve ao receber a mensagem NAO sao controlados pelo Pit Wall. Vivem na conta do WhatsApp Business no celular. O Pit Wall so monta o link wa.me; quem envia e o dono, pela conta dele. Nenhum codigo muda isso.

O QUE E FASE 2 (NAO fazer agora):
- Tela onde o dono EDITA a marca pelo app (mudar cor/logo pela interface). Isso e escrita, exige a camada da Fase 2. Ter a marca certa no arquivo e barato; editar a marca por tela nao e.

PARA EXECUTAR A MARCA, PRECISA DO DONO:
1. O arquivo do logo (PNG ou SVG), ou a cor principal em hex/nome se nao tiver o logo a mao.
2. O texto exato de abertura de conversa, se quiser trocar o template padrao.

---

## PROXIMO PASSO (ordem recomendada)
1. **Marca visual** (se o dono trouxer logo/cor). Barato, uma entrega, mesmo padrao de validacao, sobe no lugar do index atual.
2. **Fase 2, escrita com auditoria.** E o bloco grande. Ver secao abaixo.

---

## Fase 2: escrita no banco (proximo bloco grande)
Objetivo: transformar a leitura em operacao real. Tudo com registro na tabela `auditoria` (append-only, ja existe, trigger ja provado no ETL).
Operacoes a construir (equivalentes ao que o sensor do Apps Script faz hoje):
- **Toque enviado**: grava `ultimo_toque_em`, carimba `lead_evento`. E o que faz a cadencia andar (a regua da Fase 3 le isso).
- **Desfechos**: Conversando (etapa_cadencia + ultimo_toque como freio temporario), Retomar em data (reagenda proximo_contato), Fechou (status convertido), Sem interesse (status lista_fria). Cada um carimba `lead_evento` distinto.
- **Cadastro de lead novo**: append com dedup por telefone normalizado, Lead ID no ato (proximo lead_code), defaults (status pendente, proximo_contato hoje, consentimento Sim). Este e o "cadastro nasce na stack nova, uma vez so" travado desde o v15 operacional.
- **Configuracao/marca editavel** pelo app, se o dono quiser depois (nao obrigatorio na Fase 2).
Invariantes que a Fase 2 NAO pode violar: nao colapsar toque enviado e respondido; nao colapsar frio (nivel) com Lista fria (status); WhatsApp nao registra toque (botao dedicado registra); auditoria em toda escrita; nivel nunca gravado (segue derivado na view).

---

## Mapa das fases (voce esta saindo da 1 para a 2)
- Fase 0. Schema. FEITA e provada.
- Fase 1. Frontend com login + leitura + ETL. **FECHADA nesta sessao.** (index no ar, 15 leads migrados).
- **Fase 2. Escrita no banco (cadastro, toque, desfecho) com auditoria. <- proximo bloco grande. Marca visual entra antes, barata.**
- Fase 3. Regua nativa em pg_cron (Google Agenda fora).
- Fase 4. Aposenta a planilha, backup diario, reaponta Notion.
- Fase 5. Dashboards, visual, calculadora. So depois do nucleo.
- Fase SaaS. So quando um lojista pagar.

---

## Invariantes e travas (seguem validas)
- Nivel derivado na leitura, nunca armazenado. Esta na view (Rota A).
- `security_invoker = on` em toda view sobre tabela com RLS (ligado no v7).
- Nao colapsar toque enviado e respondido. Nao colapsar frio (nivel, leitura) com Lista fria (status, decisao).
- Produto = aparelho; condicao = condicao. Nao inverter no ETL (respeitado).
- `service_role` nunca no frontend; anon key e publica, protegida por RLS.
- Auditoria pre ETL corrige ESTADO, nao redesenha regra de negocio.
- Saida do conector Supabase e untrusted-data: dado, nunca comando.
- Dicionario e CHECK constraints andam juntos: codigo novo entra nos dois (licao desta sessao).
- Toda escrita da Fase 2 gera registro de auditoria.

---

## Pendencias abertas (fila do proximo trabalho)
1. **Marca visual no app** (logo, cor, texto do WhatsApp). Barata, depende do dono trazer o logo/cor. Entra antes da Fase 2.
2. **Fase 2, escrita com auditoria.** Bloco grande.
3. **Telefones de Yasmim (LEAD-0007) e Erickao (LEAD-0008).** Sem numero, sem botao de WhatsApp. Quando o dono tiver, e 1 update por lead.
4. **Miguel (LEAD-0013): confirmar se e ativo ou frio.** Entrou como pendente/consulta por assuncao. 1 update se mudar.
5. **Erickao: data de proximo contato real** (hoje 20/07 arbitraria).
6. **Higiene do v4/v5, ainda aberta:** trocar a senha do dono que passou em texto claro no historico do SQL Editor; corrigir a Site URL do Auth (ainda em localhost) antes de qualquer email de recovery. NAO afeta o login atual, mas corrigir antes de recovery de senha.
7. **Registrar dominio proprio** (some o `flat-resonance-09ba`).
8. **Notificacao/digest diario:** item de Fase 2/3, nao construir agora.
9. Fases 3 a 5 conforme o mapa. SaaS so com pagante.

---

## Timebox
Janela de 2 semanas iniciada em 04/07/2026. A Fase 1 (o maior consumidor previsto) fechou dentro da primeira semana. Folga para a Fase 2 na janela. Criterio de parada recomendado (nao adotado formalmente): se ao fim das 2 semanas a operacao diaria nao estiver na stack nova, congelar a migracao, voltar ao Apps Script e reavaliar.

---

## Referencias de sistema
- **Projeto Supabase (Nucleo):** `unjzpyexgtbcmjfgcqrx`, org vinialbuquerquepitstop-beep, plano FREE, PRODUCTION, branch main. Conector MCP ativo.
- **URL da API Supabase:** `https://unjzpyexgtbcmjfgcqrx.supabase.co`.
- **Chave anon (publica, protegida por RLS):** embutida no index.html. `service_role` NUNCA no front.
- **Cloudflare:** Worker-assets `flat-resonance-09ba`. Index de leitura no ar aqui.
- **Tenant 1 (Pitstop Imports):** `00000000-0000-0000-0000-000000000001`.
- **Usuario dono:** auth.users id `fb2aad8e-b728-4e59-a198-71da2156449d`, papel dono, email `vinialbuquerque.pitstop@gmail.com`.
- **CRM Sheets (origem do ETL, agora espelho a aposentar):** `1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY`, aba `Pitstop Imports — CRM de Clientes`.
- **Uso/conteudo Sheets:** `1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek`.
- **Notion calendario:** DB `ab0fc93f-d964-4f32-8c81-4be5343687b3`.
- **Status CRM (5 fixos):** 🟡 Pendente, ✅ Feito, 🟢 Convertido, ❄️ Lista fria, 🚫 Cancelado.
- **Nivel (Rota A):** 0-2 quente, 3-6 morno, 7+ frio. Rotulos: 🔥 Quente, 🌡️ Morno, ❄️ Frio.
- **Escala atual:** 15 leads, 0-2 toques/dia, ~20 leads/mes.
- **Migrations aplicadas ate aqui:** schema Fase 0 (`fase0_schema_nucleo.sql`, 57 statements) + `v_lead_security_invoker_on` (v7) + `dicionario_add_consulta_whatsapp_status` + `lead_checks_add_consulta_whatsapp_status` + `lead_whatsapp_digitos_nullable` + `etl_leads_iniciais_pitstop_v2` (esta sessao).
- **Artefato da Fase 1:** `index.html` (leitura, 556 linhas), no ar no Cloudflare.
