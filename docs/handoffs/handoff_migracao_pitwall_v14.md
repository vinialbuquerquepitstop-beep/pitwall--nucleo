# Handoff de Migracao Pit Wall 2.0 (Nucleo), v14

## Como usar este documento
Continuacao da TRILHA DE MIGRACAO. Este handoff SUBSTITUI o v13. Para o que NAO mudou (schema, ETL, invariantes, contratos das RPCs, stack alvo), os handoffs v1 a v13 seguem validos; este v14 registra so o delta desta sessao mais duas orientacoes que o dono pediu pra deixar cravadas (sugestao de mensagem com banco de scripts, e como o conteudo chega no sistema). Le primeiro "Estado em uma frase", "O que mudou nesta sessao", "Sugestao de mensagem (banco de scripts)" e "Como o conteudo entra no sistema".

Delta do v14 em uma linha: o drill de restauracao passou (A2 fechado de verdade), a operacao diaria foi CORTADA pro nucleo, e o B1 (revoke do anon nas RPCs) foi aplicado e provado no banco.

Convencao de escrita: prosa sem acento, sem cedilha, nunca travessao (virgula, parenteses ou ponto conforme a gramatica). EXCECAO: valor real do sistema carrega seus proprios caracteres (aba com em-dash U+2014, status com emoji, nomes de funcao, campos do Notion como Data/Tipo/Status, tokens, pg_cron, RLS, security_invoker).

---

## Estado em uma frase
O nucleo virou a operacao real: escrita no ar e usada no celular, backup automatico cifrado provado por drill de restauracao, e a porta do anon fechada nas funcoes de escrita (B1). A planilha CRM esta congelada como espelho historico. O proximo bloco grande e a Fase 3 (regua nativa em pg_cron), e logo apos ela entra a sugestao de mensagem com banco de scripts.

## Mapa das fases
- Fase 0. Schema. FEITA e provada.
- Fase 1. Frontend login + leitura + ETL das 15 linhas. FECHADA.
- Fase 2. Escrita no banco com auditoria. FECHADA.
- Corte operacional (cutover do CRM). **FEITO nesta sessao.** Operacao diaria de leads roda no nucleo; planilha CRM congelada.
- **Fase 3. Regua nativa em pg_cron. <- proximo bloco grande.**
- Fase 3.5 (nova, registrada nesta sessao). Sugestao de mensagem com banco de scripts. Depende da regua existir. Ver secao propria.
- Fase 4. Aposenta a planilha formalmente, e reaponta o Notion/conteudo pro nucleo. (O backup diario, que era parte desta fase, JA esta pronto e provado.)
- Fase 5. Dashboards, visual, calculadora, reconstrucao da interface. So depois do nucleo.
- Fase SaaS. So quando um lojista pagar.

---

## O que mudou nesta sessao

### 1. Drill de restauracao APROVADO (A2 fechado de verdade)
Foi criado e rodado o workflow `restore_drill.yml` (`.github/workflows/`), disparo manual pela aba Actions. Ele sobe um Postgres 17 descartavel dentro do runner, decifra o `.gpg` mais recente de `backups/` com o secret `BACKUP_PASSPHRASE`, cria papeis e stubs de auth (anon/authenticated/service_role, `auth.uid()/role()/jwt()`), restaura com `pg_restore --no-owner`, e confere os dados. Resultado: DRILL APROVADO. O backup real decifra, restaura e traz os dados intactos. Isso prova a cadeia inteira (cifra no repo -> decifra -> restaura -> dado), nao so o round-trip validado em sessao. O backup deixou de ser esperanca; virou rede provada.
- Alcance consciente do drill: cobre o dado do schema `public` (o que nao pode morrer). Nao reconstroi auth/storage/extensoes; a estrutura (tabelas, RPCs, RLS) se recria reaplicando as migrations. Erros residuais de grant/politica na restauracao sao tolerados de proposito; o juiz e a checagem de dado (leads >= 15, tenant = 1, rotulos >= 27, LEAD-0001 e LEAD-0015 presentes). Usados >= de proposito nos que crescem, entao o drill continua valido depois do corte, sem editar o arquivo.

### 2. Corte operacional feito (cutover do CRM)
A operacao diaria de leads passou pro nucleo. Confirmado pelo dono. Regras adotadas:
- Todo cadastro, toque, desfecho e reagendamento acontece SO no app. Nada de planilha.
- A planilha CRM (`1lJj4w...`) vira espelho congelado: referencia historica, nunca mais editada. A aposentadoria formal e Fase 4.
- O que NAO existe ainda: a regua nativa (Fase 3). Nada avanca cadencia nem esfria lead sozinho no nucleo. A fila esta ordenada por atraso (mais vencidos no topo) e o dono trabalha de cima pra baixo, na mao. A disciplina diaria e o motor ate a Fase 3 entrar.
- Sensor e regua antigos do Apps Script ficam ociosos (a planilha nao muda mais). Nao precisa desligar agora.

### 3. B1 aplicado: revoke do anon nas funcoes (migration `b1_revoke_anon_execute_rpcs`)
Fechou os avisos de seguranca do Supabase sobre o anon poder executar as funcoes. Descoberta que ajustou o comando: a permissao vinha de DOIS lugares ao mesmo tempo, de PUBLIC (`=X/postgres`) e de `anon` direto. Revogar so do anon nao fecharia nada. A migration revoga EXECUTE de PUBLIC e de anon nas 8 funcoes (5 RPCs: `cadastrar_lead`, `registrar_toque`, `registrar_conversando`, `reagendar_proximo_contato`, `registrar_desfecho`; 2 helpers: `fn_tenant_atual`, `fn_papel_atual`; gatilho: `fn_auditar`) e reafirma o GRANT pra `authenticated` nas 7 que ele de fato usa (o `fn_auditar` nao entra: gatilho dispara pelo mecanismo do trigger sem exigir EXECUTE do usuario). `service_role` intacto.
- Prova: `has_function_privilege` apos a migration retorna anon = false nas 8, authenticated = true, service_role = true.
- Efeito na operacao: nenhum na tela. O app opera logado (papel authenticated), que manteve tudo. A unica diferenca e que uma chamada nao autenticada agora leva permission denied em vez de resposta vazia. Defesa em profundidade: a RLS ja bloqueava por dentro; isto tranca a porta que estava so encostada.
- Checagem opcional recomendada: abrir o app, logar, dar 1 toque e cadastrar 1 lead teste (apagar depois) so pra confirmar por olho que o caminho authenticated segue intacto. A logica diz que sim.

---

## Sugestao de mensagem (banco de scripts) -- pedido do dono, registrado pra nao perder

Necessidade que o dono quer cravada: DEPOIS que a regua estiver aplicada, o app nao deve so dizer "toque devido neste lead"; deve SUGERIR a mensagem a enviar, puxada de um banco de scripts. Fecha o laco de "o sistema diz QUEM tocar" para "o sistema diz O QUE dizer".

Por que depende da regua (Fase 3): a regua e quem sabe o `perfil`, o `passo_atual` e o `passo_rotulo` do lead na cadencia. Sem isso o app nao tem como escolher QUAL script daquele momento. Por isso e Fase 3.5, logo apos a regua, nao antes.

Desenho proposto (a detalhar no chat que construir):
- Banco de scripts vive numa tabela nova, por exemplo `dicionario_scripts` (tenant_id, perfil, passo/passo_rotulo, texto_template), lida em runtime igual ao `dicionario_rotulos`. Multi-tenant desde o nascimento (cada loja teria seus scripts no futuro SaaS).
- O texto e template com variaveis substituidas na hora: `{nome}`, `{produto}`, etc. O front resolve as variaveis com o dado do lead.
- Integracao natural com o WhatsApp: o deep link do WhatsApp aceita `?text=`, entao o botao de WhatsApp pode abrir a conversa com a mensagem sugerida JA digitada. Isso NAO viola a invariante "WhatsApp so abre, nao registra toque"; pre-preencher texto continua so abrindo. Quem registra segue sendo o botao Toque enviado.
- Autoria do conteudo dos scripts (a copy de cada passo por perfil) e tarefa das skills de conteudo (socialmedia, reels-virais); o pitwall-nucleo so faz a fiacao (tabela, leitura, substituicao, deep link).
- Perguntas em aberto pro dia da construcao: os scripts variam por perfil, por passo, ou pelos dois? Quantos passos por perfil (vem junto com a cravada da cadencia da Fase 3)? O app so sugere com botao copiar, ou ja pre-preenche o WhatsApp via `?text=`?

---

## Como o conteudo entra no sistema (orientacao pedida pelo dono)

Fluxo atual, para nao confundir com o CRM. E puxada MANUAL com cache, nao envio automatico:
1. O dono cria e tagueia o card no Notion (Calendario de Conteudo, a base mae). Card so conta com `Data` preenchida.
2. No app, o dono clica ↻ Sincronizar. Isso roda `syncNotion` no Apps Script (`Code.gs`).
3. `syncNotion` chama a API do Notion, pega cards na janela (hoje menos 7 ate hoje mais 28 dias), e faz FULL REPLACE (limpa e regrava) a aba `Conteudo` da planilha de conteudo (`1fWhQ78...`). Nada incremental.
4. `getConteudo` le essa aba e serve pras abas Conteudo e Hoje do app.

Regras que quebram silenciosamente se ignoradas: `Data` ausente = card fora do sync; `Tipo`/`Status`/`Semana` sao select de grafia exata (Tipo: Reels, Story, Carrossel; Status: A produzir, Em produção, Pronto, Publicado, Descartado); deletar nao funciona pela API, para sumir um card marca `Status` = Descartado.

O ponto critico pra migracao: esse pipeline INTEIRO ainda vive no Apps Script antigo. O nucleo cobriu so o subsistema de CRM (leads). O subsistema de conteudo (Notion, `syncNotion`, planilha de cache `1fWhQ78...`, abas Conteudo/Hoje) NAO foi migrado e continua na stack velha. Os dois sempre foram arquiteturalmente separados: o CRM lia a planilha `1lJj4w...` sem Notion; o conteudo le o Notion e cacheia na `1fWhQ78...`. Reapontar o conteudo pro nucleo e item de Fase 4/5, ainda nao iniciado. Enquanto isso, o conteudo segue funcionando exatamente como antes; o corte do CRM nao o afetou.

---

## Primeiro movimento do proximo chat
1. Confirmar por olho, se ainda nao fez, que o caminho authenticated segue intacto apos o B1 (logar, 1 toque, 1 cadastro teste, apagar). Se algo falhar aqui, e o unico ponto que o B1 poderia ter mexido; me traga o erro.
2. **Ir para a Fase 3, a regua nativa em pg_cron.** E o proximo bloco grande. Antes de codar, cravar com o dono: a cadencia por perfil (quantos passos, intervalos por perfil) e o limite de silencio da Regra 2. Esses numeros vem do dono ou do codigo da regua antiga (Apps Script). Regras ja acordadas: Regra 1 (so avanca com toque confirmado no passo), Regra 2 (esfria so quem foi tocado, ignorado, chegou ao ultimo passo e passou do limite de silencio). Estado vive em `cadencia_estado`.
3. Logo apos a regua: **Fase 3.5, sugestao de mensagem com banco de scripts** (secao propria acima), e a **feature de editar lead** (destrava telefones de LEAD-0007/LEAD-0008 e a data placeholder de LEAD-0008).

---

## Pendencias abertas (fila do proximo trabalho)
1. [proximo bloco grande] Fase 3, regua nativa em pg_cron. Depende de cravar cadencia por perfil e limite de silencio.
2. Fase 3.5, sugestao de mensagem com banco de scripts (`dicionario_scripts`, substituicao de variaveis, deep link `?text=`). Depende da regua.
3. Feature de editar lead (RPC + UI). Destrava: telefones de Yasmim (LEAD-0007) e Erickao (LEAD-0008); data real de proximo contato do Erickao (o 20/07 e placeholder suspeito, corrige quando a edicao existir); confirmar Miguel (LEAD-0013) ativo ou frio.
4. Abas do topo tocaveis (viram filtros). Evolucao de frontend, deferida.
5. Vigiar nos primeiros dias de operacao no nucleo: o backup automatico roda verde as 05:05; a planilha nao esta mais sendo editada por reflexo.
6. Registrar dominio proprio (some o `flat-resonance-09ba`).
7. Reconstrucao da interface (Fase 5). Gatilho: operacao cortada E estavel (a parte do corte ja aconteceu; falta a estabilidade com a regua). Opcional agora: rascunho de direcao de design (spec, sem codigo).
8. Reapontar o conteudo/Notion pro nucleo (Fase 4/5). Hoje ainda no Apps Script (ver secao de conteudo).
9. Restante da trilha B de seguranca (pos-B1): MFA, rate limiting, protecao de senha vazada, prova de isolamento com um segundo tenant real.
10. SaaS: comecar pela validacao de demanda com 3 a 5 lojistas (sinal de pagamento). Interesse nao e pagamento.

---

## Invariantes e travas (seguem validas)
- Toda escrita gera registro de auditoria (trigger `fn_auditar`, provado).
- Escrita so por RPC; o frontend nunca escreve direto em tabela (nenhum insert/update/delete/upsert no front).
- anon nao executa nenhuma funcao de escrita nem helper (B1). authenticated e service_role preservados.
- Nivel derivado na leitura, nunca armazenado (v_lead, Rota A: 0-2 quente, 3-6 morno, 7+ frio).
- `security_invoker = on` em toda view sobre tabela com RLS.
- Nao colapsar "toque enviado" e "respondido". WhatsApp so abre (mesmo com `?text=` pre-preenchido no futuro); o botao Toque enviado registra. Dois eventos distintos.
- Nao colapsar frio (nivel, leitura) com ❄️ Lista fria (status, decisao da regua).
- Produto = aparelho; condicao = condicao. Nao inverter.
- `service_role` NUNCA no frontend; anon key e publica, protegida por RLS.
- `UNIQUE (tenant_id, whatsapp_digitos)` torna telefone duplicado impossivel; nao existe "cadastrar mesmo assim".
- Config de Auth e troca de senha: so pelo painel do Supabase, nunca por SQL.
- Backup: pg_dump 17 (server e 17.6) via Session pooler, cifrado AES256, so `.gpg` no git. Nunca commitar dump em claro. `BACKUP_PASSPHRASE` vive fora do GitHub (gerenciador de senhas); perder = backups irrecuperaveis.
- Conteudo: `Data` obrigatoria no card; sync e full replace na janela hoje-7..hoje+28; grafia exata nos selects; deletar = Status Descartado.
- Entrega em unidade fechada, validada, nunca fragmento.

---

## Referencias de sistema
- Projeto Supabase (Nucleo): `unjzpyexgtbcmjfgcqrx`, org vinialbuquerquepitstop-beep, plano FREE, PRODUCTION, branch main. Conector MCP ativo.
- Worker / URL do app: `https://flat-resonance-09ba.pitstopimports.workers.dev`.
- Repo GitHub: privado, `vinialbuquerquepitstop-beep/pitwall--nucleo`, branch `main`. `public/index.html`, `wrangler.jsonc`, `.github/workflows/backup_git.yml`, `.github/workflows/restore_drill.yml`, pasta `backups/`.
- Secrets do repo: `SUPABASE_DB_URL` (Session pooler), `BACKUP_PASSPHRASE` (cifra dos backups).
- Tenant 1 (Pitstop Imports): `00000000-0000-0000-0000-000000000001`.
- Usuario dono: auth.users id `fb2aad8e-b728-4e59-a198-71da2156449d`, papel dono, email `vinialbuquerque.pitstop@gmail.com`.
- CRM Sheets (espelho congelado): `1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY`, aba `Pitstop Imports — CRM de Clientes`.
- Conteudo Sheets (cache do Notion, ainda ativo no Apps Script): `1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek`.
- Notion calendario de conteudo: DB `ab0fc93f-d964-4f32-8c81-4be5343687b3`.
- Cor da marca (azul): `#0025cc`. Termometro morno (semantico): `#f2a71b`.
- Estado do banco (verificado nesta sessao): 15 leads (LEAD-0001..LEAD-0015), 1 tenant, 27 rotulos, 0 eventos (limpos apos testes), todo lead com code.
- Postgres do servidor: 17.6 (pg_dump/pg_restore 17 obrigatorio no backup e no drill).
- Migrations aplicadas: `fase0_schema_nucleo.sql` + `v_lead_security_invoker_on` + `dicionario_add_consulta_whatsapp_status` + `lead_checks_add_consulta_whatsapp_status` + `lead_whatsapp_digitos_nullable` + `etl_leads_iniciais_pitstop_v2` + `fase2_funcoes_escrita` + **`b1_revoke_anon_execute_rpcs` (esta sessao)**.

---

## Nao reabrir, a menos que o dono peca
Construir superficie de SaaS antes do primeiro pagante; migrar mais dado sem necessidade; transformar o deploy num CI elaborado; colapsar "toque enviado" e "respondido"; colapsar frio (nivel) com ❄️ Lista fria (status); fazer o WhatsApp registrar toque; unificar o ambar do termometro com o azul da marca; reintroduzir "cadastrar mesmo assim"; commitar dump em claro no git; usar pg_dump mais antigo que o servidor; iniciar a reconstrucao visual antes da operacao estabilizar com a regua. O Pit Wall e sensor; a regua e o motor de cadencia; a base vive no Postgres.
