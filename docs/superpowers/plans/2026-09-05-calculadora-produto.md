# Calculadora como produto — Plano de Implementacao

> **Para quem for executar:** tocar bloco a bloco, tarefa a tarefa. Os passos usam
> checkbox (`- [ ]`). Nenhum bloco comeca antes do anterior fechar o portao.

**Objetivo:** transformar a calculadora de superficie de consulta em produto
comercializavel, onde **outro lojista alimenta a propria tabela com os proprios
fornecedores, sozinho, sem SQL, sem deploy e sem sessao de IA.**

**Desenho de record:** `docs/superpowers/specs/2026-09-05-calculadora-produto-design.md`.
Se este plano divergir da spec, a spec ganha e o executor avisa.

**Arquitetura:** um projeto Supabase, um deploy na Cloudflare, N tenants isolados por
RLS. Catalogo **do tenant**, semeado uma vez no nascimento da conta e mantido dai em
diante pelo proprio lojista (decisao do dono, 07/09/2026). Escrita so por RPC
`SECURITY DEFINER`, com `tenant_id` vindo de `privado.fn_tenant_atual()`, nunca do
payload.

**Stack:** Postgres/Supabase (RLS, RPC), frontend estatico servido pela Cloudflare
(`public/calc/`), Edge Function Deno para a chamada ao modelo.

---

## Contexto de origem

Sessao de 05/09/2026. Decisoes do dono, respondendo pergunta direta:

| Decisao | Resposta |
|---|---|
| Objetivo | **Sistema comercializavel**, outro lojista usando sem dificuldade |
| Invariante 17 (nao construir SaaS antes do pagamento) | **Rompido conscientemente**, custo assumido |
| Assentos | **Time completo incluso**, sem cobranca por cabeca |
| Acesso | **So por login.** Nenhuma superficie de preco publica |
| Cota de modelo | **3.000 linhas/mes + 3.000 de abertura** (decidida nesta sessao) |
| Fornecedores | Cada lojista cadastra **os proprios**. Os do dono nunca vazam |

---

## Estado medido em 05/09/2026 (tudo consultado, nada presumido)

O que **ja esta pronto** e nao precisa de obra:

- 33 das 35 tabelas de `public` tem `tenant_id`, RLS ligado e policy.
- `privado.fn_tenant_atual()` e `fn_papel_atual()` derivam de `app_usuario` **e
  filtram por `ativo`**. Desligar usuario corta o acesso na query seguinte, sem
  revogar token. Verificado no corpo das duas funcoes nesta sessao.
- Nenhuma das funcoes de `public` tem UUID de tenant hardcoded.
- O frontend nao tem tenant hardcoded.
- `calc_dados` tem policy exigindo tenant **e** papel `dono`
  (`calc_dados_sel`, migration `calc_dados_select_apenas_dono`, 17/08/2026).

O que **quebra** e vira tarefa:

| Achado | Numero medido |
|---|---|
| Linha orfa em `calc_dados` no tenant `...0004`, com **14 dos 17 fornecedores do dono** | 341 produtos, 520 precos, de 27/07/2026 |
| Constraints em `calc_dados` | **1** (sem FK para `tenant`, sem unique por tenant) |
| Scripts com `Pitstop Imports` fixo no texto | **48 de 126**. Com `{loja}`: **0** |
| `Pitstop Imports` no `public/index.html` | **3** ocorrencias |
| `privado.fn_provisionar_tenant` | **nao existe** |
| Linhas em `public.tenant` | **1** |
| Policies de INSERT/UPDATE em `calc_dados` / `tenant` / `app_usuario` | **0**. So SELECT |
| Escritas em `calc_dados` pelo frontend | **0** |
| `public/calc/consultor/dados.js` | arquivo estatico de 29,7 KB, servido **sem sessao** |
| `.single()` em `public/calc/index.html:1458` | quebra a pagina inteira com 2+ linhas visiveis |

**O plano `2026-08-19-segundo-lojista-tenant.md` esta inteiro em aberto.** Nenhuma das
sete tarefas foi executada. Ele nao e descartado: as Tarefas 1 a 4 e 6 dele viram o
Bloco 0 deste plano, e a Tarefa 7 dele (tela de precos, que ele deixou fora de escopo)
e exatamente o que este plano constroi.

---

## Restricoes globais

Valem para todos os blocos, sem repetir:

1. **`tenant_id` vem sempre de `privado.fn_tenant_atual()` dentro da RPC.** Nunca do
   payload do cliente. E a unica regra que impede o lojista A gravar no blob do B.
2. **Nome de fornecedor e praca nunca entram na semente.** So no tenant que os cadastrou.
2b. **Linha de semente (`tenant_id is null`) nunca e lida em execucao.** Nenhuma policy
    das tabelas de catalogo faz `or tenant_id is null`. Se fizesse, o dono do produto
    herdaria por acidente a obrigacao de manter catalogo, que ele recusou em 07/09.
3. Invariantes do `CLAUDE.md` de pe, em especial: nivel derivado na leitura (4), chave
   por `codigo` e nunca por `rotulo` (12), `CURRENT_DATE` proibido em data de negocio
   (10), historico append-only (6), helpers de RLS em `privado` (8), `authenticated`
   nunca recebe TRUNCATE (9).
4. Toda escrita de schema passa pelo subagent `base` (unico com `apply_migration`).
   Frontend passa pelo `vitrine`. Prova passa pela `bandeira`. Postura de seguranca
   passa pelo `pit-guard` antes de qualquer bloco tocar auth ou dado de terceiro.
5. `CREATE OR REPLACE FUNCTION` reseta ACL: refazer REVOKE/GRANT explicito depois.
   `CREATE OR REPLACE VIEW` derruba `security_invoker = on`: refazer o `ALTER VIEW`.
6. Suite do frontend, conferindo **EXIT CODE**, nunca o texto da saida:
   ```
   python ferramentas/validar.py
   python ferramentas/harness.py
   python ferramentas/prova_trilho.py
   python ferramentas/prova_grafico.py
   python ferramentas/prova_atmosfera.py
   node --check public/app.js
   for w in 360 390 414 1280 1440; do python ferramentas/diag_mobile.py $w; done
   for w in 1500 1920 2560; do python ferramentas/diag_largo.py $w; done
   ```
   Baseline em 02/09/2026: **1037 linhas impressas, 1042 rotulos declarados, 1037
   distintos executados**, EXIT 0 nas cinco larguras de celular e nas tres de monitor.
7. `execute_sql` do MCP devolve so o resultado do ultimo statement: cada verificacao e
   uma chamada separada. Para schema e carga grande, `apply_migration`.
8. **Nenhum export de fornecedor entra no repo**, nem como corpus de teste. Dado
   comercial de terceiro vive em `privado` ou e sintetico.
9. **Cada bloco termina em algo que o dono consegue abrir.** Encanamento provado sem
   tela nao fecha bloco (ordem do dono, 17/07/2026: "faca sempre palpavel").
10. **A calc tem que poder sair inteira depois (D2).** Nenhuma tabela `calc_*` ganha FK
    para tabela de operacao (`lead`, `venda`, `conteudo`, `captacao`, `dia_*`,
    `escopo_*`, `fin_*`). So `tenant`, `app_usuario` e os helpers de `privado`, que sao
    a base de auth compartilhada. Conferir a cada migration:

    ```sql
    select conrelid::regclass as tabela, confrelid::regclass as aponta_para
      from pg_constraint
     where contype='f' and conrelid::regclass::text like 'calc\_%'
       and confrelid::regclass::text not in ('tenant','app_usuario');
    ```
    Esperado: **zero linhas**, em todo bloco.

---

## Decisoes do dono — TODAS FECHADAS em 05/09/2026

- [x] **D1 — Os 341 produtos do tenant `...0004` servem de historico?**
  **NAO.** Delete direto, **sem snapshot**. O Passo 2 da Tarefa 1 do plano de 19/08
  (criar `privado.calc_snapshot_20260727`) **nao se executa**: pular direto do Passo 1
  (provar o estado) para o Passo 3 (delete).
- [x] **D2 — O que e vendido?**
  **O conjunto**: Pit Wall com a calculadora dentro. **Mas a calculadora vira produto
  separado depois.** Vira restricao global 10 abaixo, e nao muda a ordem dos blocos.
- [x] **D3 — Regras de descarte sao configuraveis por tenant?**
  **SIM.** `calc_regra` chega ao tenant novo pela semente, ja **pre-marcada**, e o
  lojista liga e desliga cada uma no proprio catalogo. "Nao vendo Android" e politica
  da Pitstop, nao lei.
- [x] **D4 — `Acessório` e margem.**
  **Margem propria** (`aav`/`apc` no `config`), e **passa a entrar na calc do
  consultor**. Detalhe na secao 3.2 da spec.

  **Correcao factual registrada:** o dono citou "airpods, apple watchs" como
  acessorios. `Apple Watch` **e categoria propria**, ja recebe `iav`/`ipc` e **ja
  aparece no consultor hoje**. D4 muda somente `Acessório` (12 itens).

- [x] **D5 — Quem atualiza o catalogo? (07/09/2026)**
  **O CLIENTE.** Palavras do dono: *"nao assumi atualizar nenhum catalogo base. quem
  vai atualizar e o cliente."* Isso **corrige** o desenho de 05/09, que previa uma
  camada global mantida por ele e usava esse compromisso como justificativa da
  cobranca recorrente.

  O que muda no schema, e nao e cosmetico:
  - `calc_modelo` e `calc_cor` ganham `tenant_id`, e a unique passa a ser
    `(tenant_id, codigo)` com `nulls not distinct`. Sem isso o segundo cliente que
    cadastrar `iPhone 18 Pro Max 256GB` colide com o primeiro.
  - As cinco policies de catalogo filtram **so** por `tenant_id = fn_tenant_atual()`.
    Nenhuma faz `or tenant_id is null`.
  - `tenant_id is null` deixa de ser "global" e passa a ser **semente**: lida uma unica
    vez, por `fn_provisionar_tenant`, no nascimento da conta.
  - O lado Apple entra **duas vezes** no Bloco 1: como semente e no tenant `...0001`.

  Modelo novo (`iPhone 18`) entra em cada tenant pelo laco de pendencia que ja existe,
  sem ninguem publicar nada. **Custo aceito:** zero aprendizado compartilhado, e a
  cobranca recorrente passa a se sustentar no sistema rodando.

- [x] **D6 — A coluna `calc_carga.texto_bruto` fica ou sai? (09/09/2026)**
  **FICA.** Ela guarda a lista colada enquanto a carga esta em rascunho, e e apagada
  no instante em que a carga e aprovada ou descartada. So o papel `dono` do proprio
  tenant enxerga.

  **Por que o dono escolheu ficar:** resolver pendencia passa a **reprocessar na
  hora**, entao ele responde as 12 pendencias e ve a cobertura subir na propria tela,
  antes de aprovar. Sem a coluna, resolver pendencia so ensinaria o catalogo e a
  cobertura daquela carga **nao mudaria**: ele resolveria 12 pendencias, veria o mesmo
  numero, e o ganho so apareceria na carga do mes seguinte.

  **Tensao registrada, nao escondida:** a secao 2.3 deste plano dizia *"o texto e
  processado e o bruto e descartado; se um dia for guardado, bucket privado com
  retencao declarada"*. A implementacao adotou a segunda metade da frase, e o dono
  ratificou em 09/09. A retencao esta declarada: **enquanto o rascunho existir, e nem
  um minuto mais.**

- [x] **D7 — Como travar o portao de cobertura do Bloco 2? (09/09/2026)**
  **Comparacao pareada, nao numero absoluto.** Na MESMA entrada, a tela nova nao pode
  cobrir menos que o caminho de hoje (a skill `calculadoras` rodada por sessao de IA).

  **Por que o `>= 89%` caiu:** auditoria de 09/09/2026 mostrou que o 89% **nao tem
  medicao de origem**. O par `612 de 690` aparece pela primeira vez em
  `.claude/skills/calculadoras/references/procedimento-alimentacao.md:92`, **dentro de
  aspas, como exemplo de FORMATO**. O `612` nao existe como medicao em nenhum outro
  ponto do repo; o `690` existe uma vez, mas como **"690 precos"** no contexto do
  volume da derivacao do consultor, nao como linhas lidas. A spec de 05/09 promoveu o
  exemplo a fato. Detalhe e formula na **secao 2.6b da spec**.

  O 89% sobrevive so como **alvo declarado do dono**, nunca como baseline medida.

- [x] **D14 — Linha sem condicao: condicao padrao por fornecedor? (11/09/2026)**
  **REVISADA pelo dono na mesma sessao, e a revisao e a que vale:** *"na verdade,
  pergunte quando nao houver condição descrita"*. **A opcao A abaixo CAIU.**
  - Lista em que um fornecedor nao descreve a condicao gera **UMA pergunta por
    fornecedor, por lista**. A resposta vale para AQUELA lista, nao vira padrao
    silencioso.
  - A resposta da lista anterior daquele fornecedor aparece **pre-selecionada como
    sugestao**: desempata, e nada entra sem a confirmacao. Com isso a regra da spec
    "o perfil desempata, nunca decide" **volta a nao ter excecao**, e o risco aceito
    na opcao A (seminovo entrando calado como padrao) deixa de existir.
  - Custo: um clique por fornecedor sem condicao, em toda lista. O contador
    `n_cond_padrao` proposto abaixo nao e mais necessario.
  - Implementacao: a pendencia de condicao passa a ser uma por fornecedor (isso nao
    mudou, e segue junto com o `2.4a zero`), e o leitor passa a receber as respostas
    DAQUELA carga ao reprocessar. Isso muda a assinatura de `privado.calc_parse_v2`:
    **argumento novo nao entra por `create or replace`, cria SOBRECARGA**. E `drop` e
    `create`, e a assercao E3 da prova so olha `public`, entao conferir `privado` a mao.

  Registro da primeira resposta, que ficou sem efeito:
  **Sim, opcao A, sem marca na linha e valendo tambem para CPO.** Resposta do dono,
  citada exata: *"a"*. **Decisao consciente CONTRA a recomendacao**, que era a opcao
  B (mesmo padrao, mas a linha marcada `condicao presumida` na tela e o padrao nunca
  valendo para CPO, que e onde a comissao muda). Registrada e nao se reabre.

  O problema medido: fornecedor que nao escreve a condicao em linha nenhuma (fixture
  C, `Junior recreio`) casa **0 de N**, e nenhuma resposta resolve (a pendencia tem o
  texto-sentinela `sem condicao declarada`, e o leitor nao le apelido de condicao).

  **O risco aceito, nomeado para nao sumir:** se o fornecedor passar a mandar
  seminovo sem escrever, o custo entra como a condicao padrao, calado, e nada na tela
  denuncia. O `formato_mudou` da 2.4b NAO pega esse caso (o layout e o mesmo).

  O que a decisao muda e o que ela NAO muda:
  - **A spec perde uma regra dura.** "O perfil desempata, nunca decide" (4.4) passa a
    ter UMA excecao nomeada, `condicao_padrao`. O resto do perfil segue so
    desempatando.
  - O padrao so preenche linha em que NEM a linha NEM o bloco dizem a condicao.
    Condicao escrita sempre ganha, e a ordem de `calc_regra.prioridade` (CPO 10 antes
    de Lacrado 20) segue intacta.
  - **Ele nao se aprende de carga aprovada**, ao contrario do resto do perfil: um
    fornecedor que nunca escreve condicao nunca tem linha casada de onde aprender.
    Ele nasce da RESPOSTA do dono a pendencia de condicao daquele fornecedor.
  - **Isso exige mudanca no leitor, e ela vai JUNTO com o `2.4a zero`:** hoje a
    pendencia de condicao se agrupa por (`tipo`, `texto`) com texto fixo, entao dois
    fornecedores sem condicao caem numa pendencia so e uma resposta valeria para os
    dois. Ela passa a ser uma por fornecedor. E o mesmo trecho do leitor (`pend_bruta`)
    que o `2.4a zero` mexe, e cada mexida no v2 muda o md5 de record e roda a prova
    inteira: juntar e mexer uma vez so.
  - Transparencia sem marcar a linha: um contador de proveniencia `n_cond_padrao` no
    `resumo`, igual aos tres que ja existem (`n_do_cabecalho`, `n_cor_vizinha`,
    `n_cond_conflito`). Diz quantas linhas vieram do padrao, nao quais. **Proposta
    da Torre, dentro da opcao A**: nao e a marca por linha da opcao B.

- [x] **D16 — `descartar` numa pergunta de FORNECEDOR: manter (11/09/2026).**
  Resposta do dono, citada exata: *"a"*. **Com a recomendacao.**
  - O que ela faz, medido pela `bandeira` no `2.4a zero`: grava `calc_regra` tipo
    `descarte` com o texto do cabecalho, a linha do cabecalho vira aviso e o aviso
    tira o BLOCO INTEIRO daquele fornecedor desta lista e de TODA lista futura. As
    linhas vao para `n_descarte`, contadas: nao e perda silenciosa. E o que a spec
    4.1 diz que `descartar` significa ("isso nunca e preco, nem agora nem depois").
  - **Obrigacao da tela `Alimentar`, parte da decisao:** o botao diz por extenso
    *"nunca mais ler preco deste fornecedor, em nenhuma lista"*, com `ignorar` (so
    nesta lista) ao lado. Enquanto a 2.4c (desfazer) nao existir, e um clique sem
    volta pela tela.
  - A alternativa recusada: o resolver recusar `descartar` em pendencia de
    fornecedor, deixando so `ignorar`, lista a lista.
  - Assercao que nomeia a combinacao: R14 da `prova_calc_parse.sql`. Se um dia
    virar recusa, e ela que muda, nao so um numero da mensagem.
  - Efeito colateral fechado junto: `descartar` numa pergunta de CONDICAO passa a
    ser recusado com motivo (trava T4). O texto dela e o `codigo` do fornecedor, e
    descarta-lo levaria ao mesmo efeito da D16 por uma pergunta que era so "qual a
    condicao". Ate aqui era recusado, mas por acaso (a G3 pegava).

### Pendencia nova aberta por D4

- [ ] **D4a — Comissao de `Acessório` na escada do consultor.** A escada
  `config.comissao` hoje tem so os ramos `lacrado` e `seminovo`, por nivel
  (Embaixador / C1 / C2 / C3). Acessorio entrando no consultor precisa de valor.
  **Nao inventar numero.** Bloqueia so o Passo 3.3, dentro do Bloco 3.
  Estrutura recomendada: um ramo `acessorio` proprio na escada; se o dono nao quiser
  escada separada, cai no ramo `lacrado` do nivel, o que e o default estrutural mais
  proximo do comportamento atual.

---

## Mapa dos blocos

| Bloco | Entrega | Termina em | Depende de |
|---|---|---|---|
| **0** | Saneamento multi-tenant | FK provada, marca fora da tela | ~~nada~~ **FECHADO 06/09** |
| **1** | Catalogo vira tabela, duas camadas | painel `Catalogo` em `/calc/` | ~~Bloco 0~~ **FECHADO 08/09** |
| **2** | Tela `Alimentar` | **o dono roda a carga dele sem Claude Code** | Bloco 1 |
| **2.4** | **Aprendizado de fornecedor** | **o cliente ensina fornecedor novo sozinho** | Bloco 2 |
| **5** | Modelo na pilha 3 e cota | cobertura de dia 1 medida | **2.4** |
| **3** | Consultor sai do repo | `curl` sem sessao devolve nada | Bloco 5, **D4a** |
| **4** | Nascimento de tenant e equipe | conta nova criada sem SQL | Bloco 3 |
| **6** | Piloto e cobranca | primeiro lojista externo | Bloco 4 |

Com D1 a D4 fechadas, **o Bloco 0 nao tem mais bloqueador.** A unica decisao aberta e
D4a (comissao de acessorio), e ela trava um passo dentro do Bloco 3, nao o inicio.

### A ordem mudou em 10/09/2026, e o motivo nao e tecnico

Ordem do dono, citada exata: *"nao darei auxilio de atualizacao de lista de forn para
clientes."* Desenho de record:
`docs/superpowers/specs/2026-09-10-aprendizado-de-fornecedor.md`.

Duas mudancas na fila, e as duas sao consequencia daquela frase:

1. **Nasce o 2.4, aprendizado de fornecedor**, fatia do Bloco 2. O laco de aprendizado
   ja existe (`calc_pendencia_resolver` escreve alias e reprocessa), mas **so ensina
   sinonimo de coisa que ja esta no catalogo**. Medido em 10/09: `calc_alias.aponta`
   nao tem FK nem check, e a RPC nao valida o destino, entao apelido para fornecedor
   novo grava sem erro e **nao casa nada**, calado. Isso nunca apareceu no tenant do
   dono (catalogo completo) e aparece em **todo** cliente.
2. **O Bloco 5 sobe para antes do 3 e do 4.** A primeira carga de um tenant novo tem
   todo fornecedor desconhecido; sem o modelo pre-preenchendo a resposta, o cliente
   encara dezenas de perguntas cruas no dia 1, que e exatamente o portao do Bloco 6
   reprovando. O Bloco 4 desce porque criar UMA conta na mao, no painel do Supabase,
   custa minutos.

O papel do modelo nao muda (5.2): ele nao le preco e nao grava nada. Devolve proposta
na forma dos tres verbos (`criar` / `apontar` / `descartar`) e o cliente aprova em
bloco.

---

# Bloco 0 — Saneamento multi-tenant

**Absorve as Tarefas 1, 2, 4 e 6 do plano `2026-08-19-segundo-lojista-tenant.md`.**
Aquele documento tem o SQL passo a passo; nao reescrever aqui, executar de la.
A Tarefa 5 dele (acesso do parceiro e Notion) **nao entra**: e substituida pelo Bloco 4.
A Tarefa 3 dele (`fn_provisionar_tenant`) entra no Bloco 4, com plano e status.

**Agentes:** `base` (SQL), `vitrine` (HTML), `pit-guard` (modela), `bandeira` (prova).

- [ ] **0.1 — Fechar o vazamento de `calc_dados`.** Tarefa 1 do plano de 19/08, **sem
  o Passo 2**: por D1 o historico nao serve, entao nao se cria
  `privado.calc_snapshot_20260727`. Sequencia: provar o estado, **delete direto** da
  orfa, FK para `tenant`, unique por tenant, provar que fechou.

```sql
delete from public.calc_dados
 where tenant_id = '00000000-0000-0000-0000-000000000004';
```
Esperado: `DELETE 1`. Sao 341 produtos e 520 precos de 27/07/2026, com 14 dos 17
fornecedores do dono. **Confirmado descartavel pelo dono em 05/09/2026.**
- [x] **0.2 — Corrigir o `.single()`.** FEITO em 06/09/2026.

  **Correcao de diagnostico, medida na execucao:** este plano e o de 19/08 diziam que
  o `.single()` quebra "com 2+ linhas visiveis". **Falso.** `calc_dados` tem
  `PRIMARY KEY (tenant_id)`, e a policy `calc_dados_sel` filtra por tenant: um `dono`
  ve no maximo UMA linha, sempre. Duas linhas visiveis nao e um estado alcancavel.

  O modo de falha real e o **oposto: ZERO linhas.** `.single()` com zero linhas
  devolve erro de PostgREST, e a tela cuspia `Nao foi possivel carregar os precos:
  JSON object requested, multiple (or no) rows returned`. **Isso e exatamente o
  primeiro segundo de toda loja nova** (Bloco 4), que nasce sem carga aprovada.

  Feito: `.maybeSingle()`, mais `mostrarVazio()` ao lado de `mostrarErro()` em
  `public/calc/index.html`. Barra **neutra**, nunca vermelha, porque vermelho e para
  dado quebrado e nao para dado ausente; mais `botaoSair()` e remocao do gate, para o
  usuario nao ficar preso na tela vazia. Erro de verdade continua indo para
  `mostrarErro()`. No Bloco 2 esse estado vazio ganha o botao que leva a `Alimentar`.
- [ ] **0.3 — A marca vira variavel nos scripts.** Tarefa 2 do plano de 19/08:
  `{loja}` e `{vendedor}` resolvidos em `sugerir_mensagem`, 48 scripts atualizados,
  GRANT refeito.
- [ ] **0.4 — A marca sai do HTML.** Tarefa 4 do plano de 19/08: 3 ocorrencias fora do
  `index.html`, nome da loja vindo de `tenant.nome` no boot, com degradacao para
  `Pit Wall` sozinho se a leitura falhar.
- [ ] **0.5 — `tenant` ganha ciclo de vida.**

```sql
alter table public.tenant
  add column if not exists plano      text not null default 'trial',
  add column if not exists status     text not null default 'ativo',
  add column if not exists trial_ate  date;

alter table public.tenant
  add constraint tenant_status_ck check (status in ('ativo','suspenso','encerrado')),
  add constraint tenant_plano_ck  check (plano  in ('trial','padrao','interno'));

update public.tenant set plano='interno' where id='00000000-0000-0000-0000-000000000001';
```

**Portao do Bloco 0** (nada segue sem os cinco):

```sql
select
  (select count(*) from public.calc_dados c
     where not exists (select 1 from public.tenant t where t.id=c.tenant_id)) as orfaos,
  (select count(*) from pg_constraint where conrelid='public.calc_dados'::regclass
     and contype='f') as fks,
  (select count(*) from public.dicionario_scripts where texto_template ilike '%Pitstop%') as marca_fixa,
  (select count(*) from public.dicionario_scripts where texto_template like '%{loja}%') as com_variavel,
  (select count(*) from public.tenant where plano is not null) as tenants_com_plano;
```

Esperado: `0, 1, 0, 48, 1`. Mais `grep -c "Pitstop Imports" public/index.html` = `0`
e a suite inteira em EXIT 0.

**Correcao medida em 06/09/2026:** o Passo 5 da Tarefa 1 do plano de 19/08 (criar
unique em `tenant_id`) era **redundante**: `calc_dados` ja tem
`PRIMARY KEY (tenant_id)`, que ja garante uma linha por tenant. Nao foi criada, e o
portao passou a cobrar `contype='f'` (so a FK, que era o que de fato faltava).

### BLOCO 0 FECHADO em 06/09/2026

Portao medido: `orfaos=0, fks=1, marca_fixa=0, com_loja=48, tenants_com_plano=1`,
mais `fk_proibida=0` (restricao global 10). Suite em **EXIT 0** nos oito comandos:
`harness` **1114 passou, 0 falhou** (1119 declaradas, 1114 executadas, 5 de ramo
alternativo), `validar`, `prova_trilho`, `prova_grafico`, `prova_atmosfera`,
`node --check`, cinco larguras de celular e tres de monitor.

| Passo | Estado | Prova |
|---|---|---|
| 0.1 orfa + FK | **FEITO** | migration `calc_dados_limpa_orfa_e_fk_tenant`. 1 linha, 0 orfaos, 1 FK, 494 produtos do dono intactos. Tenant fantasma bloqueado em bloco `DO` com rollback |
| 0.2 `.single()` | **FEITO** | `maybeSingle()` + `mostrarVazio()` em `public/calc/index.html` |
| 0.3 marca nos scripts | **FEITO** | 4 migrations. `Pitstop` fixo: 0. `{loja}`: 48. `{vendedor}`: 53. Texto renderizado sem chave crua |
| 0.4 marca no HTML | **FEITO** | 3 lugares fora do `index.html`, `pwLoja()` no `app.js`, **5 assercoes novas** no harness |
| 0.5 ciclo de vida do tenant | **FEITO** | migration `tenant_ciclo_de_vida`. `plano='interno'`, `status='ativo'`, 2 checks |

### Quatro defeitos que a execucao achou e o plano de 19/08 nao via

Todos medidos em 06/09/2026, todos com preco se tivessem passado:

1. **Seis formas da marca, nao duas.** O `UPDATE` daquele plano teria deixado
   `" Imports"` orfao pendurado no meio da frase, em 17 scripts.
2. **Seis scripts assinam so `Vini`, sem citar a loja.** A busca `ilike '%Pitstop%'`
   nunca os alcancava: sao exatamente os que fariam o vendedor de outra loja se
   apresentar com o nome do dono. Corrigidos por `regexp_replace` com `\m...\M`.
3. **24 scripts com artigo masculino colado na variavel** (`aqui é o {vendedor}`).
   Invisivel enquanto o vendedor e sempre `Vini`. Com uma vendedora chamada Ana, os
   24 mandam **"aqui é o Ana"** ao cliente. Nao estava em plano nenhum. O artigo saiu.
4. **O mock do harness nao tinha `maybeSingle` nem a tabela `tenant`.** `pwLoja()`
   estourava calada dentro do proprio `try`, e a assercao nova nunca seria exercida.
   O stub usa **`Loja de Prova`**, nunca o nome real: stub com o nome do dono cegaria
   o teste, porque marca fixa de volta no HTML continuaria passando.

### Duas correcoes do proprio plano, medidas na execucao

- `calc_dados` **ja tinha `PRIMARY KEY (tenant_id)`**: a unique que o plano de 19/08
  mandava criar era redundante. So faltava a FK.
- O `.single()` **nao quebra com 2+ linhas** (impossivel, dada a PK mais a RLS por
  tenant). Quebra com **zero** linhas, que e o primeiro segundo de toda loja nova.
  O diagnostico estava invertido, e o conserto certo era estado vazio nomeado.

### Uma instabilidade conhecida, deixada em paz

A assercao `fin: OFX sem lancamento diz o que houve` falhou em **1 de 3 corridas** e
passou nas outras duas; contra o `HEAD` passou 1 de 1. O proprio harness ja documenta
que ela cai quando cresce o numero de assercoes antes dela. **Nao foi mexida**:
alargar o `finAte` para calar guard-rail e repontar baseline, e a regra do projeto
proibe. Fica registrada para o dia em que a causa for atacada de verdade.

---

# Bloco 1 — O catalogo sai do markdown e vira tabela

**Depende de:** Bloco 0. **Agentes:** `base` (schema e seed), `vitrine` (painel),
`bandeira` (prova).

**D3 fechada: descarte e configuravel por tenant.** `calc_regra` global nasce com as
regras do dono, e cada tenant liga e desliga a sua. Como a tabela ja aceita
`tenant_id` nulo (global) ou preenchido (do tenant), a configuracao e uma linha do
tenant que **sobrepoe** a global de mesmo `padrao`. Resolucao: regra do tenant ganha
da global; sem regra do tenant, vale a global. Mesma direcao do `calc_alias`.

Consequencia na tela do Bloco 1: o painel `Catalogo` mostra as regras de descarte com
um interruptor por regra, ja marcadas no padrao do dono. **Interruptor desligado nao
apaga a global**, grava uma linha do tenant com `ativo=false`.

**Por que primeiro:** a tela de alimentar nao tem contra o que parsear enquanto o
catalogo morar em `.claude/skills/calculadoras/references/formato-dados.md`. Esse
arquivo e o ativo do produto e hoje so o Claude consegue ler.

### BLOCO 1 FECHADO em 08/09/2026

Commit `9327c30`. Tres migrations: `calc_catalogo_duas_camadas`,
`calc_catalogo_semente`, `calc_catalogo_tenant_pitstop`.

**Portao medido:** 17 fornecedores com praca exata (zero divergencia contra o blob,
acento e travessao inclusos), 124 modelos no catalogo contra 118 em uso no blob,
`modelo_sem_catalogo=0`, `cor_sem_catalogo=0`, `fk_proibida=0`. Camadas:
modelo 124/124, cor 32/32, alias 27/48, regra 20/20, **fornecedor 0/17**.
Isolamento provado com JWT, nao so lido: o `dono` ve **0** linhas de semente e 17
fornecedores; o `vendedor` ve **0** fornecedores; tenant inexistente ve **0**
modelos. Advisors: os 3 WARN da baseline, zero achado novo.

Suite em EXIT 0 nos **onze** comandos, `harness` **1114 passou, 0 falhou**
(baseline exata). Duas provas novas: `prova_catalogo.js` (50 assercoes) e
`diag_calc.py` (360, 390, 414).

#### Tres correcoes do proprio plano, medidas na execucao

| O que o plano dizia | O que a execucao mediu |
|---|---|
| `calc_modelo` leva 66 iPhones, aliases `>= 10` | o catalogo real e **124 modelos e 48 apelidos**. O portao so fecha com todos, porque o blob usa 118 deles: contar 66 deixaria 52 nomes de fora e reprovaria |
| o painel mostra as regras com **interruptor por regra** | o painel do 1.3 e **so leitura**, como o proprio titulo do passo diz. Interruptor e escrita, e escrita so por RPC (Bloco 2). O painel EXIBE `ativo`, com a palavra `ligada`/`desligada`; ligar e desligar entra junto com `calc_pendencia_resolver` |
| `calc_regra` do tenant **sobrepoe** a global de mesmo `padrao` | com D5 nao ha global viva. A semente e copiada no nascimento e dali em diante so existe a linha do tenant. **Nao ha resolucao de sobreposicao a implementar**, e isso simplifica o Bloco 2 |

#### Dois defeitos que a execucao achou e nenhum plano via

1. **`calc(env(...,0px)+80px)` sem espaco em volta do `+` e CSS invalido**, e o
   Chrome descarta a declaracao inteira. Medido em 08/09/2026 com quatro variantes
   isoladas: com espaco devolve `80px`, sem espaco devolve `0px`. Efeito: o
   `padding-bottom` do `body` das **duas** calcs era 0, entao a barra fixa de 64px
   cobria o fim do conteudo em todas as abas, **desde sempre**. 4 ocorrencias
   corrigidas (2 no `body`, 2 no `.toast`).
2. **Nenhuma ferramenta olhava para a calc.** `diag_mobile.py` e `diag_largo.py`
   medem `public/index.html` reusando o stub do `harness.py`. A barra de abas saiu
   de CINCO para SEIS colunas com a suite inteira verde. `ferramentas/diag_calc.py`
   fecha o buraco, e ja na primeira corrida achou `📚CATÁLOGO` pedindo **63px numa
   coluna de 60px** em 360px. Consertado com media query em `max-width:400px`
   (respiro e tracking apertados na tela estreita), nao encurtando o rotulo.

#### Uma ressalva de operacao

O subagente `vitrine` **travou no watchdog** (600s sem progresso) sem escrever nada.
A tela e as duas ferramentas foram construidas pela Torre. Registrado por honestidade
de processo, nao como excecao a regra: quem constroi tela continua sendo o `vitrine`.

## 1.1 Schema

- [ ] **Criar as tabelas globais.** `tenant_id` nulo significa global.

```sql
-- tenant_id NULO = linha de SEMENTE, copiada no nascimento da conta e nunca
-- lida em execucao. tenant_id preenchido = catalogo daquele lojista, que e
-- quem o mantem (decisao do dono, 07/09/2026).
-- A unique carrega o tenant: sem isso, o segundo cliente que cadastrar
-- "iPhone 18 Pro Max 256GB" colide com o primeiro. `nulls not distinct`
-- mantem a semente unica entre si.
create table public.calc_modelo (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenant(id),
  codigo     text not null,                 -- invariante 12: a chave e o codigo
  nome       text not null,                 -- nome canonico exibido
  categoria  text not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  constraint calc_modelo_u unique nulls not distinct (tenant_id, codigo),
  constraint calc_modelo_categoria_ck check (categoria in
    ('iPhone','iPad','MacBook','Apple Watch','Acessório','1ª Linha','Garmin','Moto Elétrica'))
);

create table public.calc_cor (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenant(id),
  codigo    text not null,
  nome      text not null,
  hex       text not null,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint calc_cor_u unique nulls not distinct (tenant_id, codigo),
  constraint calc_cor_hex_ck check (hex ~ '^#[0-9a-f]{6}$')
);

create table public.calc_alias (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenant(id),   -- NULL = global
  tipo       text not null,
  texto      text not null,               -- como o fornecedor escreve
  aponta     text not null,               -- codigo canonico de destino
  criado_em  timestamptz not null default now(),
  constraint calc_alias_tipo_ck check (tipo in ('modelo','cor','condicao','fornecedor')),
  constraint calc_alias_u unique nulls not distinct (tenant_id, tipo, texto)
);

create table public.calc_fornecedor (
  id         uuid not null default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant(id),
  codigo     text not null,
  nome       text not null,
  praca      text not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  primary key (id),
  constraint calc_fornecedor_u unique (tenant_id, codigo)
);

create table public.calc_regra (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenant(id),   -- NULL = global
  tipo       text not null,
  padrao     text not null,
  acao       text not null,
  valor      text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  constraint calc_regra_tipo_ck check (tipo in ('descarte','token','outlier','condicao')),
  constraint calc_regra_acao_ck check (acao in ('descartar','pendencia','substituir','aceitar'))
);
```

- [ ] **RLS: global se le, tenant se filtra, ninguem escreve.**

```sql
alter table public.calc_modelo     enable row level security;
alter table public.calc_cor        enable row level security;
alter table public.calc_alias      enable row level security;
alter table public.calc_fornecedor enable row level security;
alter table public.calc_regra      enable row level security;

-- As CINCO filtram igual, e NENHUMA faz "or tenant_id is null".
-- Linha de semente (tenant_id null) e invisivel em execucao, de proposito:
-- ver a secao 2.4 da spec e a decisao do dono de 07/09/2026.
create policy calc_modelo_sel on public.calc_modelo for select to authenticated
  using (ativo and tenant_id = privado.fn_tenant_atual());
create policy calc_cor_sel on public.calc_cor for select to authenticated
  using (ativo and tenant_id = privado.fn_tenant_atual());
create policy calc_alias_sel on public.calc_alias for select to authenticated
  using (tenant_id = privado.fn_tenant_atual());
create policy calc_regra_sel on public.calc_regra for select to authenticated
  using (tenant_id = privado.fn_tenant_atual());

create policy calc_fornecedor_sel on public.calc_fornecedor for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');
```

Nenhuma policy de INSERT, UPDATE ou DELETE em nenhuma das cinco. Escrita so por RPC.
`calc_fornecedor` exige papel `dono`: fornecedor e praca sao dado de custo, o vendedor
nao ve.

## 1.2 Seed: a semente, e o tenant do dono

**Duas escritas distintas, nao confundir:**

| Escrita | `tenant_id` | Para que serve |
|---|---|---|
| **semente** | `NULL` | ser copiada no nascimento de toda conta futura. Nunca lida em execucao |
| **tenant do dono** | `...0001` | a Pitstop Imports operando hoje. E uma conta como qualquer outra |

O lado Apple (modelo, cor, alias de cor e condicao, regras) entra **duas vezes**:
uma como semente e outra no tenant `...0001`. Parece duplicacao e nao e: a semente e
um retrato congelado para clientes futuros, e o tenant do dono e catalogo vivo que
**ele** vai editar, como qualquer cliente. Foi a decisao de 07/09/2026 que separou
os dois: nao existe camada compartilhada que o dono do produto mantenha.

Fornecedor e praca entram **so** no tenant `...0001`, nunca na semente.

- [ ] **Carregar o catalogo de `formato-dados.md` para as tabelas.** Fonte:
  `.claude/skills/calculadoras/references/formato-dados.md`, secao 4.

| Alvo | Vem de | Quantidade esperada |
|---|---|---|
| `calc_modelo` (semente **e** `...0001`) | iPhone 66 + iPad 6 + MacBook/Mac Mini 8 + Apple Watch 7 + Acessorio 12 + 1ª Linha 2 + Garmin 6 + Moto 1, mais os que entraram em 15/08 e 17/08 | conferir contra `calc_dados` |
| `calc_cor` (semente **e** `...0001`) | as 32 cores em uso com hex | 32 |
| `calc_alias` tipo `cor` (semente **e** `...0001`) | as unificacoes de 03/08 (`Black`->`Preto`, `Blue`->`Azul`, `White`->`Branco`, `Green`->`Verde`, `Orange`->`Laranja`, `Rose`->`Rosa`, `Prateado`->`Silver`, `Dourado`->`Gold`) mais `ULTRAMARINE`/`PACIFIC BLUE`->`Azul` | >= 10 |
| `calc_alias` tipo `condicao` (semente **e** `...0001`) | `cpo`/`(CPO)`/`certified pre-owned`->`CPO`, `lacrado`/`novo`->`Lacrado`, `seminovo`/`usado`/`vitrine`->`Seminovo` | 8 |
| `calc_regra` tipo `descarte` (semente **e** `...0001`) | `mensagem`, `msg`, `aviso`, `peça não genuína`, `1ª linha`, `réplica`, `similar`, `genérico`, preco em dolar | 9 |
| `calc_regra` tipo `token` (semente **e** `...0001`) | `4,850,00`->4850.00, `4.3999,99`->4399.99, `7.200,00,00`->7200.00, `1.1550`->1550.00 | 4 |
| `calc_regra` tipo `outlier` (semente **e** `...0001`) | acima de 1.6x o menor da mesma combinacao | 1 |
| `calc_fornecedor` do tenant `...0001` | os 17 do dono, com praca exata | 17 |
| `calc_alias` do tenant `...0001` tipo `fornecedor` | `MELHOR DE CAXIAS`->Five Cell, `Charles revel`/`REVEL IMPORTS`/`APARELHOS AMERICANOS`->Revel, `Fábio souza`/`davi fabio`->Davi/Fábio, `Júnior recreio`/`Recreio`->Júnior, `TABELA ATUALIZADA`->MP Imports, `Dg JPA`->DG Jacarepaguá, `Raphael barra da Tijuca`->Rafael, `Br 10, iraja`->BR10 | >= 12 |

**Acentos e o travessao das pracas sao valores reais: copiar exato.** A ordem de
condicao (`CPO` testado ANTES de `Lacrado`) vira coluna de prioridade na regra, nao
ordem de insercao: em 27/07/2026 a ordem errada gerou 341 produtos com **zero CPO**
mesmo com CPO farto nas listas.

- [ ] **Prova do seed contra o blob vivo.** Todo `n` de produto do blob tem que existir
  em `calc_modelo`, e toda cor em `calc_cor`:

```sql
select count(*) as modelo_sem_catalogo
  from public.calc_dados d, jsonb_array_elements(d.dados->'produtos') p
 where d.tenant_id='00000000-0000-0000-0000-000000000001'
   and not exists (select 1 from public.calc_modelo m where m.nome = p->>'n');
```
Esperado: `0`. Idem para cor.

## 1.3 Painel `Catalogo` (o palpavel do bloco)

- [ ] **Aba nova em `/calc/`, so leitura**, mostrando o que o sistema sabe: contagem de
  modelos por categoria, as cores com o quadradinho do hex, os fornecedores do tenant
  com praca, e os aliases aprendidos. Campo vazio aparece com rotulo e estado vazio
  nomeado, nunca some (memoria `campo-vazio-tem-que-aparecer`).

**Portao do Bloco 1:** o dono abre `/calc/`, clica em `Catalogo`, e ve 17 fornecedores
com praca correta e a contagem de modelos batendo com o blob. Suite em EXIT 0 com as
assercoes novas do painel.

---

# Bloco 2 — A tela `Alimentar`

**Depende de:** Bloco 1. **Agentes:** `base` (RPCs), `vitrine` (tela),
`pit-guard` (revisa o caminho de escrita), `bandeira` (prova).

**E o bloco que muda o produto.** No fim dele a Pitstop Imports atualiza o proprio
preco sem abrir sessao de IA.

## 2.1 Schema de carga

- [ ] **Criar `calc_carga`, `calc_pendencia` e `calc_uso`.**

```sql
create table public.calc_carga (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id),
  status       text not null default 'rascunho',
  origem       text,
  blob_proposto jsonb,
  n_lidas      int not null default 0,
  n_casou      int not null default 0,
  n_duvidoso   int not null default 0,
  n_descarte   int not null default 0,
  n_pendencia  int not null default 0,
  aprovado_por uuid,
  aprovado_em  timestamptz,
  criado_em    timestamptz not null default now(),
  constraint calc_carga_status_ck check (status in ('rascunho','aprovada','descartada'))
);

create table public.calc_pendencia (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant(id),
  carga_id   uuid not null references public.calc_carga(id) on delete cascade,
  causa      text not null,
  tipo       text not null,
  texto      text not null,
  n_linhas   int not null default 1,
  exemplo    text,
  decisao    text,
  decidido_em timestamptz,
  criado_em  timestamptz not null default now()
);

create table public.calc_uso (
  tenant_id  uuid not null references public.tenant(id),
  competencia date not null,          -- primeiro dia do mes
  linhas_modelo int not null default 0,
  credito_extra int not null default 0,
  primary key (tenant_id, competencia)
);
```

`calc_carga` e `calc_pendencia` sao append-only para `authenticated` (SELECT apenas;
escrita so por RPC), pelo invariante 6.

## 2.2 As tres RPCs

- [ ] **`calc_carga_abrir(p_texto text) returns uuid`** — `SECURITY DEFINER`. Cria a
  carga em rascunho no tenant de `fn_tenant_atual()`, roda o parse deterministico
  contra `calc_modelo` + `calc_cor` + `calc_alias` + `calc_regra` + `calc_fornecedor`,
  grava as quatro pilhas e as pendencias **agrupadas por causa**.

  Ordem de leitura obrigatoria, na sequencia da secao 5 do `formato-dados.md`:
  modelo -> capacidade -> **condicao com CPO primeiro** -> cor -> descarte -> preco ->
  fornecedor pelo **cabecalho**, nunca pelo remetente.

  Agrupamento: uma pendencia por `(tipo, texto)`, com `n_linhas` contando quantas
  linhas ela afeta. **Cem linhas de cor `PURPLE` sao UMA pendencia**, nao cem.

- [ ] **`calc_pendencia_resolver(p_pendencia uuid, p_decisao text, p_aponta text)`** —
  grava a decisao **e** escreve o aprendizado em `calc_alias` ou `calc_regra` do
  tenant, e reprocessa a carga. E o laco de aprendizado; sem a escrita no catalogo a
  mesma pendencia volta no mes seguinte.

- [ ] **`calc_carga_aprovar(p_carga uuid) returns jsonb`** — valida, grava
  `calc_dados`, deriva e grava `calc_venda`, fecha a carga, tudo na mesma transacao.
  Carrega a trava de tres numeros que a skill ja usa hoje:

```sql
  if v_produtos <> v_esp_produtos then raise exception 'guarda produtos: %', v_produtos; end if;
  if v_precos   <> v_esp_precos   then raise exception 'guarda precos: %',   v_precos;   end if;
  if v_soma     <> v_esp_soma     then raise exception 'guarda soma: %',     v_soma;     end if;
```

  Os tres esperados saem do parse, ANTES da escrita. Nao bateu, a transacao inteira
  volta. **A trava vai em bloco, nunca inline**: `case when ok then true else (select
  1/0)::boolean end` nao funciona, o Postgres dobra `1/0` em tempo de planejamento e
  reprova carga correta.

- [ ] **GRANT explicito depois de cada `CREATE OR REPLACE`:**

```sql
revoke all on function public.calc_carga_abrir(text) from public;
grant execute on function public.calc_carga_abrir(text) to authenticated;
```
Idem para as outras duas.

## 2.3 A tela

- [ ] **`/calc/alimentar`, quatro passos, so para papel `dono`:**

| Passo | Mostra | Acao |
|---|---|---|
| 1 Colar | area de texto e upload do `_chat.txt` | enviar |
| 2 Fornecedor | cabecalhos achados, com contagem de listas | nomear e dar a praca |
| 3 Pendencias | agrupadas por causa, com `n_linhas` e o exemplo original copiado | decidir |
| 4 Diff | subiu / caiu / novo / sumiu, **variacao acima de 15% item a item**, fornecedor sem lista nova, cobertura medida | aprovar |

Textos obrigatorios na tela, porque sao trava do produto e nao enfeite:
- cobertura na forma **`casaram X de Y linhas (Z%)`**, medida, nunca estimada, mais a
  linha das descartadas. O par `612 de 690` e exemplo de FORMATO, nao medicao (D7);
- **`N linhas nao entraram`**, com a lista, sempre visivel;
- descarte com contagem, para o dono ver que existiram;
- lista com mais de 7 dias entra com **aviso explicito de custo velho**.

- [ ] **O upload nao vai para o repo nem para bucket publico.** O texto e processado e
  o bruto e descartado; se um dia for guardado, bucket privado com retencao declarada.

**Portao do Bloco 2** (e o portao mais importante do plano): **o dono roda a carga de
setembro inteira pela tela, sem Claude Code**, e o resultado bate com o que a sessao de
IA produziria. Medir e registrar:

```sql
select status, n_lidas, n_casou, n_pendencia, n_descarte,
       round(100.0*n_casou/nullif(n_lidas,0),1) as cobertura
  from public.calc_carga order by criado_em desc limit 1;
```
Esperado: cobertura **nao menor que a do caminho atual da skill, na MESMA entrada** (D7,
09/09/2026). A mesma lista passa pelos dois caminhos e se comparam `casou / lidas /
descartadas`. O antigo `>= 89%` caiu porque **o 89% nao tem medicao de origem**: o par
`612 de 690` era exemplo de FORMATO em `procedimento-alimentacao.md:92`, promovido a
fato pela spec de 05/09. Detalhe na secao 2.6b da spec.
Se o novo cobrir MENOS que o velho na mesma lista, o seed do Bloco 1 esta incompleto
e o bloco nao fecha.

### BLOCO 2, FATIA 1 (2.1 e 2.2) ENTREGUE em 09/09/2026 — o bloco segue ABERTO

Commit `77f954c`. **A tela (2.3) NAO entra**, entao o bloco NAO esta fechado e o
portao de cobertura NAO foi medido. A fatia foi cortada a pedido do dono: o parser
e conferido antes de ser embrulhado em wizard, porque o defeito de CPO de
27/07/2026 ficou sete dias no ar por ninguem olhar a pilha intermediaria.

Cinco migrations (`calc_carga_schema`, `calc_parse_helpers`, `calc_parse_motor`,
`calc_carga_rpcs`, `calc_parse_correcoes`), versionadas em
`supabase/migrations/20260909_calc_*.sql`.

Prova: `ferramentas/prova_calc_parse.sql`, **27 assercoes, PASSOU, 0 falhas**.
Medido: `lidas=18 casou=11 duvidoso=6 nao_reconhecido=1 descarte=2 cobertura=61,1%`.
**Os 61,1% sao o TETO da fixture**, que e um circuito de armadilhas com 7 das 18
linhas escritas para falhar: o motor casou **11 de 11 atingiveis**. Isso nao diz
nada sobre o portao de 89%, que so a carga real do dono mede.

#### O que a execucao contradisse no plano

1. **`calc_carga_aprovar` NAO deriva `calc_venda`.** O plano manda derivar e gravar
   essa tabela no 2.2. Ela **nao existe**: o consultor ainda le o `dados.js`
   estatico do repo, e a tabela nasce no Bloco 3. Aprovar grava custo e so.
2. **`calc_carga` ganhou duas colunas que o plano nao previa.** `resumo jsonb`
   (os cabecalhos achados e a quebra de descartes por motivo, que o passo 2 e o
   passo 4 do wizard precisam mostrar e o blob nao carrega) e `texto_bruto`
   (a lista colada, guardada SO enquanto a carga esta em rascunho e apagada na
   aprovacao ou no descarte). Sem `texto_bruto` a RPC `calc_pendencia_resolver`
   **nao consegue reprocessar**, e o dono resolveria 12 pendencias sem ver numero
   nenhum mudar: o laco de aprendizado so valeria na carga do mes seguinte.
   Retencao declarada, visivel so ao papel `dono` do proprio tenant.
3. **Nasceu uma quarta RPC, `calc_carga_descartar`.** Sem ela a lista bruta de uma
   carga abandonada fica no banco para sempre.
4. **`n_casou` conta a linha que ENTRA NO BLOB, nao a que casou.** As duas divergem
   (linha sem cor num grupo colorido nao cabe no produto), e declarar a maior seria
   cobertura inflada.

#### Seis defeitos que a execucao achou e nenhum plano via

1. **`\b` em Postgres e BACKSPACE**, nao fronteira de palavra (que e `\y`). Nao da
   erro: o regex nunca casa e a funcao devolve NULL em silencio. Estava em 8
   lugares e teria dado polegada NULL em todo Mac e capacidade NULL em todo iPhone.
2. **`novo` casava DENTRO de `seminovo`**, e com prioridade 20 contra 30 Lacrado
   engolia TODO Seminovo, inclusive o banner de bloco. 5 das 12 linhas que casavam
   sairam com a condicao errada. Estava no catalogo vivo **e na semente**, entao
   toda conta nova nasceria com ele. **Mesma classe do CPO invertido de 27/07/2026**
   (341 produtos com zero CPO): regra de condicao sem limite explicito. Aquela foi
   corrigida com `prioridade`; esta precisou de fronteira de palavra, nas duas
   camadas.
3. **Cabecalho desconhecido nao quebrava o bloco**: os precos de um fornecedor nao
   identificado eram atribuidos ao fornecedor ANTERIOR. Preco certo no fornecedor
   errado passa no validador e no diff, e so aparece quando alguem compra pelo
   custo de outra loja.
4. **Preco com PONTO decimal sumia inteiro.** A regra de token `4,850,00 -> 4850.00`
   do proprio catalogo produz ponto decimal; o leitor so conhecia o formato
   brasileiro, via `4850` e `00`, pegava o ultimo e reprovava na faixa. A linha nao
   entrava no blob **e nao virava pendencia**.
5. **Cor decorada entrava com o hex de outra cor.** `VERDE MENTA` contem `verde`
   como palavra inteira, entao a cor desconhecida era gravada como `Verde`, calada,
   violando o "nunca inventar hex sem avisar".
6. **Linha sem cor num grupo colorido sumia do blob mas contava como casou.**

#### Licao de processo

A prova reprovou uma vez, e **o defeito era da prova, nao do motor**: havia DUAS
copias da fixture sintetica (uma no scratchpad, outra embutida na prova) e elas
divergiram, entao uma assercao cobrava uma linha que a entrada nao tinha. E o
mesmo erro do `CLAUDE.md` 17 versoes desatualizado, em miniatura. **Uma copia so.**

E a separacao de papeis pagou: quem escreveu o parser escreveu a prova, entao esse
erro so apareceu porque a `bandeira` rodou e leu. Ela tambem provou que a segunda
rodada **nao afrouxou o criterio** (teto ainda 11, assercao do preco decimal
intacta, `v_total` ainda 27) e registrou que o `git diff` vazio **nao era prova de
nada**, porque o arquivo estava untracked.

---

## 2.4 Aprendizado de fornecedor (fatia nova, 10/09/2026)

**Desenho de record:** `docs/superpowers/specs/2026-09-10-aprendizado-de-fornecedor.md`.
Se este plano divergir dela, **a spec ganha** e o executor avisa. Aqui so o que
executar, na ordem.

**Agentes:** `base` (RPC e colunas), `vitrine` (a aba), `bandeira` (as seis provas),
`pit-guard` antes do commit (a RPC nova e caminho de escrita novo).

**A ordem interna mudou em 11/09/2026, por medicao.** A RPC foi chamada pela
primeira vez e o `criar` fornecedor nao tem onde se apoiar: cabecalho desconhecido
no topo da lista vira a sentinela `(sem cabecalho antes da lista)` e o texto dele
nao chega a pendencia. Detalhe na secao 7b da spec. Ordem nova:

```
2.4a bis (guardas)  ->  2.4a zero (o cabecalho chega a pendencia)
  ->  2.4a zero bis (a pergunta de condicao vira resposta)  ->  2.4a (criar)
  ->  2.4a ter  ->  2.4a quater  ->  2.4b  ->  2.4c
```

**Correcao de 11/09/2026, tarde:** o `2.4a`, o `ter` e o `quater` sairam JUNTOS,
numa migration so, e nao em tres passos. Motivo, e ele vale registrar porque a
tentacao de fatiar mais fino vai voltar: `criar` fornecedor e escrita SEM VOLTA
enquanto a 2.4c nao existir. Entregar o verbo sem a guarda de quase-igual seria
entregar um botao irreversivel sem protecao nenhuma, e entregar sem `origem` seria
gravar no catalogo do cliente linhas que ninguem consegue achar depois. As tres
fatias eram uma so o tempo todo.

- [x] **2.4a zero — FECHADO em 11/09/2026** (handoff v10). Migration
  `20260911_calc_parse_condicao_e_cabecalho.sql`, gerada por script a partir do
  corpo vivo; md5 novo do v2 `e4b7f4ad8ecd66edc784ba8d43a7fbc8`. Entraram as quatro
  coisas abaixo (cabecalho, pergunta por fornecedor, heranca D15, misto vira
  pergunta). Prova **PASSOU, 75 assercoes**, fixture D e secao Z. **Ficou de fora,
  e e a proxima fatia:** o leitor RECEBER as respostas de condicao da carga (muda a
  assinatura do v2: `drop` e `create`) e o verbo novo no resolver (`calc_pendencia`
  tem check em `decisao`: `apontar`/`descartar`/`ignorar`, entao e DDL).
- **2.4a zero — texto original do item:** O cabecalho candidato chega a pendencia. Hoje, sem fornecedor
  anterior, a linha de cabecalho desconhecida some e as linhas abaixo dela caem numa
  pendencia so, `(sem cabecalho antes da lista)`, que nao nomeia ninguem. No dia 1 de
  um cliente e TODA lista. O leitor tem que devolver o texto do cabecalho candidato
  como `texto` da pendencia de fornecedor, uma pendencia por cabecalho. Trabalho de
  parser, no territorio da D10/D13 (bairro x loja), e por isso muda o md5 de record do
  v2 e passa pelas secoes A, B, D e E da prova inteira.
  **Leva junto a parte de leitor da D14** (11/09): a pendencia de condicao passa a
  ser uma por fornecedor, em vez de uma so para a carga inteira, e o leitor passa a
  receber as respostas da carga ao reprocessar. Mesmo trecho do leitor, uma mexida
  so no v2.

  **Achado de 11/09, e ele e da classe PRECO ERRADO:** duas condicoes
  INCOMPATIVEIS no mesmo lugar sao decididas pela `prioridade` da regra, calado.
  Medido no v2:

  | Onde | Texto | Sai como | Certo? |
  |---|---|---|---|
  | banner | `LACRADOS E SEMINOVOS` | TODAS as linhas `Lacrado` | **nao**: o seminovo de 2.700 vira o menor custo de lacrado |
  | linha | `seminovo, era lacrado` | `Lacrado` | **nao** |
  | linha | `seminovo cpo` | `CPO` | ambiguo |
  | linha | `lacrado importado cpo caixa branca` | `CPO` | sim (CPO vem lacrado; assercao A2) |
  | cabecalho `(CPO)` + banner `Lacrado` | | `CPO`, `n_cond_conflito=1` | sim |

  E o que ja sai certo, medido: dois banners na mesma lista (cada bloco com a sua),
  o mesmo modelo nas duas condicoes (dois produtos), a linha ganhando do banner, e o
  banner NAO vazando para o fornecedor seguinte. O banner VAZA para o bloco de modelo
  seguinte do mesmo fornecedor, que e o certo para lista em secao (`LACRADOS` e
  depois varios modelos).

  **Proposta, aguardando o dono:** `CPO` com `Lacrado` segue `CPO` (sao
  compativeis). `Seminovo` junto de `Lacrado` ou de `CPO`, na linha ou no banner,
  vira PERGUNTA, e a linha nao entra no blob ate a resposta. E a mesma regra da D14
  revisada: quando a condicao nao esta clara, pergunta.

  **Heranca da condicao, regra do dono (11/09/2026):** *"muitas vezes, a lista
  inicia com a condição e o restante dos modelos segue sem condição acompanhando. se
  for em uma lista só, fica sem até aparecer a condição dos próximos modelos na
  lista"*. A condicao declarada vale para os modelos seguintes do MESMO fornecedor
  ate aparecer outra. Medido no v2:

  | Lista | Hoje | Com a regra |
  |---|---|---|
  | banner `LACRADOS` no topo, modelos sem nada | herda, 2 de 2 | igual |
  | condicao so na linha do 1o modelo, os outros sem | **1 de 3**, 2 viram pergunta | 3 de 3 |
  | `Lacrado` ... sem ... `Seminovo` ... sem | **2 de 4** | 4 de 4 |
  | bloco: `(CPO)` so no 1o cabecalho | **1 de 2** | 2 de 2 |
  | condicao do 1o fornecedor e o 2o sem nada | nao passa, pergunta | igual (lista nova) |

  Hoje so a linha que e SO condicao (banner) passa adiante. A condicao escrita
  dentro da linha de um modelo, ou no cabecalho do bloco, vale so para ela.
  A pergunta por fornecedor da D14 fica para as linhas ANTES da primeira condicao
  daquele fornecedor.

  **D15 — A regra da condicao, fechada pelo dono em 11/09/2026.** Respostas citadas
  exatas: *"a, sim"* e *"b, nesse caso, passam a ser a condição de cima. no caso,
  lacrado. a menos que seja uma lista com o titulo misto, e condições mista. ai,
  vale o que esta na linha."*

  1. Condicao escrita na propria linha vale para ela.
  2. Linha sem condicao herda a ULTIMA condicao declarada daquele fornecedor, venha
     ela de banner, de cabecalho de bloco (`(CPO)`) ou de linha de modelo.
     **Inclusive dentro de secao com banner:** `SEMINOVOS`, depois uma linha com
     `lacrado`, e as de baixo passam a `Lacrado`. **Decisao consciente CONTRA a
     recomendacao**, que tratava a linha como excecao so dela. Registrada e nao se
     reabre.
  3. **Titulo misto** (banner com condicoes incompativeis, `LACRADOS E SEMINOVOS`):
     ali NAO ha heranca. Cada linha vale pelo que ela diz, e linha sem condicao sob
     titulo misto vira pergunta.
  4. Linhas antes da primeira condicao daquele fornecedor: UMA pergunta por
     fornecedor, por lista (D14 revisada).
  5. `CPO` com `Lacrado` no mesmo lugar e `CPO`. `Seminovo` junto de outra condicao
     no mesmo lugar (linha ou banner) vira pergunta.
  6. Fornecedor novo zera a condicao corrente (medido: ja e assim).

- [x] **2.4a zero bis — A pergunta de condicao vira resposta. FECHADO em
  11/09/2026** (handoff v11). Migration
  `20260911_calc_parse_respostas_de_condicao.sql` (version `20260911100937`),
  gerada por script a partir dos dois corpos vivos, 19 trocas conferidas. md5
  novos: leitor `3b5338e92f74e84e8def43ca2d77d02b` (len 34483), resolver
  `2efc6bd94b3600b060079254c27f4f58` (len 10448). Prova **PASSOU, 89 assercoes**
  (eram 75), secao R. O que entrou:
  - **Verbo `definir`** em `calc_pendencia.decisao` (DDL no check). So em
    pendencia de `condicao`, so com condicao ATIVA do tenant e grafia exata
    (`CPO`, `Lacrado`, `Seminovo`). **Nao escreve no catalogo:** a resposta fica
    na propria pendencia, vale para AQUELA carga, pode ser trocada (definir de
    novo) e desfeita (`ignorar`). E a D14 ao pe da letra.
  - **O leitor recebe as respostas:** `privado.calc_parse_v2` passou a
    `(uuid, text, jsonb default '{}')`, por **DROP + CREATE** (argumento novo por
    `replace` criaria SOBRECARGA, e com `default` a chamada de 2 argumentos
    ficaria AMBIGUA). A ACL foi refeita: segue `{postgres=X/postgres}`.
  - **A chave da pergunta virou coluna** (`cond_chave`), lida nos DOIS lugares:
    na pendencia e na aplicacao da resposta. Duas expressoes separadas bastava
    uma divergir para a resposta nunca pegar e a pergunta voltar para sempre.
  - **O resolver passa TODAS as respostas da carga a cada releitura**, nao so a
    do momento. Era a armadilha da fatia: a releitura acontece em QUALQUER
    resposta, entao responder o fornecedor devolveria para duvidoso, calada,
    cada linha de condicao ja respondida. Assercao R2.
  - **Trava T4:** `descartar` em pergunta de condicao recusado com motivo (era
    recusado por acaso, pela G3). Ver D16.
  - Contador de proveniencia novo no `resumo`: `n_cond_respondida` (quantas
    linhas entraram pela resposta do dono).
  - Medido: fixture C vai de 0 para 2 linhas na tabela com `junior` = Lacrado;
    fixture D vai de 11 para **16 de 16** com as cinco respondidas.
  - **Ficou de fora, e e divida nomeada:** nao ha guarda no resolver contra
    QUEDA de `n_cond_respondida` ou de `n_casou` numa releitura (a G2 cobra
    conservacao de linhas, a G3 so olha a pendencia do momento, e a G4 vive so
    na matriz da prova). Hoje o cenario nao se realiza (a `bandeira` mediu os
    dois caminhos), mas a defesa e circunstancial, nao estrutural.
- [x] **2.4a — O verbo `criar`. FECHADO em 11/09/2026** (handoff v12), junto com o
  `ter` e o `quater` abaixo, numa migration so:
  `20260911_calc_catalogo_criar.sql` (version `20260911135930`).
  `public.calc_catalogo_criar(p_pendencia uuid, p_nome text, p_extra jsonb)`,
  `SECURITY DEFINER`, papel `dono`, `tenant_id` de `privado.fn_tenant_atual()`. O
  `tipo` vem da PENDENCIA, nunca do payload. Cria a linha do catalogo, o alias da
  grafia que gerou a pendencia, os aliases das demais grafias **provadamente
  iguais** vistas na carga, tira as pendencias irmas da fila e reprocessa.
  md5 `4f3b1f4a9cca7e8a38afa4c1c7db964c` (len 8093).
  **Tres coisas que a execucao contradisse, e o documento se corrige aqui:**
  1. **A releitura nao podia ser duplicada.** Uma RPC separada, como este item e a
     spec pediam, repetiria as ~90 linhas de cauda do `calc_pendencia_resolver`
     (G2, G3, remontagem do blob, refresco do resumo, pendencia nova). Duas copias
     bastaria UMA divergir para a cobertura passar a depender do VERBO usado, e
     isso nao aparece em contagem nenhuma. Saiu para
     `privado.calc_reprocessar(uuid, uuid, text, text, text, boolean, text)`, UMA
     copia, chamada pelos dois verbos. md5 `3db9a91b6be0462910321615b92e4ccc`
     (len 4814). O resolver caiu de 10448 para 6468 chars, exatamente a cauda.
     Os 10 trechos movidos foram conferidos byte a byte contra o corpo VIVO antes
     de aplicar, e as 89 assercoes anteriores sao o que prova que a extracao nao
     mudou comportamento.
  2. **`codigo` nao e hash, e slug.** Este item mandava hash deterministico de
     `privado.calc_norm(nome)`. O catalogo VIVO nao usa hash: usa slug legivel
     (`mp_imports`, `airpods_4_anc`, `iphone_15_pro_max_256gb`). Hash faria metade
     do catalogo ilegivel, e o `codigo` e o que aparece em apelido e em pendencia.
     Ficou slug de `calc_norm(nome)` com sufixo numerico em colisao: continua
     deterministico e continua sendo o `codigo`, nunca o rotulo (invariante 12).
  3. **`cor` NAO se cria, e e recusa declarada.** Medido em 11/09/2026: o leitor
     **nunca** devolve pendencia de `tipo = 'cor'`. Cor desconhecida cai em
     `duvidoso` junto com a linha, sem virar pergunta. Criar cor seria caminho sem
     chamador e sem prova, que e exatamente o que este projeto ja paga com o
     parser v1. Quando o leitor aprender a PERGUNTAR cor, o ramo entra junto com a
     prova dele. `condicao` tambem e recusa, por outro motivo: a resposta dela vale
     so para aquela lista (D14, verbo `definir`), entao nao ha o que criar.
- [x] **D17 — DECIDIDA pelo dono em 11/09/2026: opcao (a), a recomendada.
  CONSTRUIDA no mesmo dia** (handoff v12). Resposta citada exata: *"a"*. A pergunta
  de fornecedor ja feita fica de pe: uma resposta nunca faz outra pergunta aberta
  (ou ignorada) da mesma carga sumir. O caso do mes seguinte (fornecedor novo
  depois de um conhecido, na PRIMEIRA leitura) **segue aberto de proposito** e
  continua coberto so pelo alarme da D13 e pela obrigacao de tela da D10.
  Migration `20260911_calc_parse_pergunta_de_fornecedor_fica.sql` (version
  `20260911164835`), gerada por script dos corpos vivos, cinco trocas. O leitor
  ganhou `p_forn_abertos text[] default '{}'` (DROP + CREATE, ACL refeita): o
  cabecalho cujo texto e pergunta aberta vira papel `forn_aberto` e fecha o bloco
  do fornecedor de cima. `privado.calc_reprocessar` monta a lista a cada releitura
  (`decisao is null` ou `ignorar`). Na abertura a lista e vazia: **a foto da
  primeira leitura da fixture E ficou identica antes e depois**
  (`5b3461788184f306b6865c45451ed384`). md5 novos: leitor
  `2f6addafb4b3d26c6a43f2c8dceec4cc` (35417), releitura
  `85c66ad95414f1386a394ba4e6a4bfb3` (5485). Fumaca: criar o MP do topo agora da
  casou **1** (era 4), blob 494 -> 495 (so o 16 128GB a 4.400 no nome do MP), e as
  tres perguntas do XPTO seguem abertas. Assercoes K13 e K14 (esta, a pergunta
  ignorada).
  **A primeira versao NAO fechava a (a), e a `bandeira` reprovou com as 104
  assercoes verdes.** O criterio dela foi o texto que o dono decidiu, nao a
  amostra da prova. Caso medido, classe PRECO ERRADO: o dono IGNORA a mensagem
  `XPTO CELL IMPORTS` (16 256GB a 4.100) e cria o fornecedor pela grafia
  `*Xpto  Cell  Imports*` (o mesmo modelo a 4.900); o blob saia com **4.100**. O
  leitor reconhece fornecedor pelo NOME, `XPTO CELL IMPORTS` contem `xpto cell
  imports`, e `forn_aberto` vinha DEPOIS de `forn` no `case`: nome reconhecido
  vencia pergunta ignorada. A primeira tentativa de correcao
  (`20260911_calc_d17_pergunta_ignorada_fica.sql`, version `20260911183244`) pos
  `forn_aberto` ANTES de `forn` e **nao consertou**: o `base` rodou a fumaca ao
  aplicar e o blob saiu com o mesmo 4.100. Erro da Torre: o `case` so escreve o
  ROTULO `papel`; o fornecedor da linha vem de `h.forn`, calculado pelo casamento
  por NOME, que nao olha o papel. A K13 tinha passado por acaso de dado (la o
  cabecalho do XPTO nao casava nome nenhum). O conserto de verdade e uma linha,
  em `20260911_calc_d17_forn_aberto_sem_fornecedor.sql`: `hdr_forn` e nulo
  quando o cabecalho e `forn_aberto`. Desta vez o `base` provou ANTES de aplicar,
  com o `create` dentro de um bloco desfeito. **Cabe na (a) sem decisao nova:** a pergunta ja feita fica de pe ate o
  dono responder ELA; o custo e no maximo um clique para confirmar uma grafia que
  o nome ja reconheceria, e o ganho e nunca entrar preco que ele mandou deixar
  fora. Junto, um defeito do `criar` achado no mesmo passe: `criar` sobre a
  propria pergunta ignorada nao a incluia (apelido e marcacao pegavam so
  `decisao is null`), entao o historico dizia `ignorar` com efeito de `criar`
  (invariante 6) e o `grafias` voltava 2 ou 0 (esse entrou certo na segunda
  migration). Assercoes K15 e K16. md5 finais: leitor
  `85c430fa9540b653298c85ab5ab5ce6f` (36324), criar
  `cf70594b319b96b7ba313ddab4782af9` (8579).
  **Segunda licao, e ela e sobre a Torre:** aplicar e so depois provar custou uma
  migration que declara um conserto que nao aconteceu. Mudanca de leitor que
  promete mudar PRECO se prova antes de aplicar, com o `create` dentro de um
  bloco desfeito e a fumaca do caso que motivou.
  **Licao de metodo, e ela vale para toda assercao desta prova:** a K14 amostrou
  UM caso (pergunta ignorada contra um fornecedor de OUTRO nome) e o comentario
  dela prometia o caso geral. Prova verde nao e contrato cumprido quando a
  amostra e mais estreita que a frase.
  **Texto original do achado:** Responder uma pergunta de fornecedor faz
  OUTRAS perguntas de fornecedor sumirem, e os precos delas entram no nome errado.
  Achado pela prova do `2.4a` na primeira rodada (assercao K3), em 11/09/2026, e
  medido de novo fora da prova. **Classe PRECO ERRADO.**
  No dia 1 todo fornecedor e desconhecido, entao cada cabecalho vira pergunta. Na
  fixture E sao quatro: `TABELA MP DISTRIBUIDORA` no topo e tres grafias do XPTO
  abaixo. Criar o primeiro (`MP Distribuidora`) faz o leitor aplicar a D10 ("o
  fornecedor vale ate o proximo cabecalho RECONHECIDO") aos tres de baixo:

  | | Antes de responder | Depois de criar o MP |
  |---|---|---|
  | perguntas de fornecedor na leitura | 4 | **1** (so a do modelo JBL sobra) |
  | casou | 0 | **4** (1 do MP + 3 do XPTO) |
  | 16 256GB a 4.900 e 15 128GB a 3.700 (do XPTO) | fora | **na tabela, no nome do MP** |
  | 16 128GB do XPTO a 4.450 | fora | **some no `min()`** contra o 4.400 do MP |
  | o que avisa | | so `fornecedor_conferir` com `suspeita_alta` |

  Tres perguntas que o dono JA VIU somem por causa da resposta a OUTRA, e a
  cobertura SOBE, entao nenhuma guarda de queda pegaria. **Nao nasceu com o
  `criar`:** `apontar` o primeiro cabecalho para um fornecedor que ja existe faz o
  mesmo, desde a 2.4a zero. O `criar` so torna o dia 1 o caminho normal ate ele.
  **Por que e decisao do dono:** o conserto mexe na D10 e na D13, que sao dele.
  As opcoes, com o efeito:
  - **(a) A pergunta ja feita fica de pe (recomendada).** O leitor passa a receber
    as perguntas de fornecedor ainda abertas da carga (como ja recebe as respostas
    de condicao) e nao absorve aquele cabecalho no fornecedor de cima. A primeira
    leitura continua exatamente como a D10/D13 decidiram. Fecha o dia 1. Custo:
    uma fatia de parser (argumento novo no v2, `drop` + `create`). **Nao fecha** o
    caso do mes seguinte: fornecedor NOVO depois de um conhecido ainda entra no
    nome do de cima, e se o nome dele nao tiver palavra de fornecedor cadastrado,
    nem o alarme acende.
  - **(b) Mensagem nova com cabecalho desconhecido nunca herda (revisa a D10).**
    Fecha o dia 1 E o mes seguinte. Custo: lista longa do MESMO fornecedor
    quebrada em varias mensagens, com primeira linha que nao e produto (`🔥
    PROMOCAO 🔥`), vira pergunta falsa. E o falso positivo que a D13 recusou, e
    so da para medir numa lista real dele.
  - **(c) Deixar, e a tela mostrar `fornecedor_conferir` de forma dificil de
    ignorar** (ja e requisito da D10 no v5). Nao conserta nada; depende de o dono
    ler um alarme toda vez.
  Enquanto nao decidir, a assercao **K13** e excecao nomeada: passa enquanto o
  defeito se comporta como medido e o alarme acende, e o `PASSOU` da prova imprime
  o defeito em toda rodada. Quando o conserto entrar, ela reprova sozinha.
- [x] **D18 — FECHADA em 11/09/2026. O `descartar` nao descartava, e o que ele
  deveria tirar entrava no nome do fornecedor de cima.** Achado pela `bandeira` em
  11/09/2026, com as **106 assercoes verdes**, procurando o proximo buraco da D17
  em vez de aceitar a prova. Classe PRECO ERRADO. Nao nasceu nesta fatia: vem da
  2.4a bis (o `descartar` grava a regra) e, na parte da semente, do Bloco 1.

  **A causa raiz, uma so:** a regra de descarte e gravada com
  `lower(v_p.texto)` (mais escape de regex), mas o leitor casa o padrao contra o
  texto **normalizado** (`privado.calc_norm`, que tira acento, `*`, `|`, aspas e
  colapsa espaco). Padrao numa normalizacao, texto em outra: nunca casa, e falha
  **calada**. Mesma familia do `\b` que era backspace e do `calc()` colado.

  | # | Vetor medido | Efeito |
  |---|---|---|
  | 13 | `descartar` o cabecalho `Fábrica Zeta` (acento) | padrao `fábrica zeta` contra texto `fabrica zeta`: `n_descarte` 0 e o bloco vai para **MP Distribuidora iPhone 16 256GB 3100** |
  | 15 | `descartar` `*Fabrica  Zeta*` (asterisco, espaco duplo) | padrao `fabrica  zeta\*`: descarte 0, **3100 no MP** |
  | 16 | ASCII, mas em formato BLOCO (cabecalho de modelo entre o fornecedor e o preco) | o padrao casa, o cabecalho de modelo corta o descarte: descarte 0, **3100 no MP** |
  | 17 | `descartar` um padrao curto sem ancora (`PROMO`) | casa a linha de OUTRO fornecedor: a pergunta `Loja Delta` **some da leitura** e fica `decisao is null` orfa |
  | 14 | controle, ASCII em formato linha | funciona (e por isso a R14 passava) |

  **A R14 passava por sorte de dado:** o cabecalho da fixture C e ASCII, esta em
  formato linha e nao aparece na linha de nenhum outro fornecedor. Quatro formas
  de cabecalho, tres quebradas, uma na prova.

  **Defeito lateral, mesma causa, e este esta no ar desde o Bloco 1:** as regras
  de descarte da SEMENTE que tem acento nunca casaram: `réplica` (900),
  `genérico` (950) e `peça não genuína` (1.900) entram como preco, medido 5 de 5.
  Preco de replica vira o menor da combinacao e, pelo fator de outlier 1.6, pode
  EXPULSAR da tabela o preco real de outros fornecedores. O efeito de outlier nao
  foi medido; vetor: somar a linha de replica a uma lista com o mesmo modelo em
  outro fornecedor.

  **O conserto tem que garantir tres coisas, e a prova ganha uma assercao por
  vetor (13 a 18):**
  1. o padrao sai do texto NORMALIZADO e ancorado na linha inteira, entao acento,
     `*` e espaco duplo casam e linha de outro fornecedor nao casa;
  2. o cabecalho descartado FECHA o bloco do fornecedor de cima (senao o descarte
     que falha vira preco no nome errado, que e pior do que nao descartar);
  3. as linhas dele vao para `n_descarte` ate o proximo cabecalho de fornecedor,
     mesmo com cabecalho de modelo no meio.
  E as regras de semente com acento precisam ser regravadas na normalizacao certa.

  **COMO FICOU, e o que a execucao contradisse do que esta escrito acima.**
  Duas migrations, e a segunda conserta um erro da primeira:
  `20260911_calc_d18_descartar_descarta.sql` (version `20260911200343`) e
  `20260911_calc_d18_ancora_por_medida.sql`.

  - **`calc_regra.escopo`** (`linha` | `fornecedor`) carrega o ALCANCE. O leitor
    ganhou o papel `forn_descartado`, que vem ANTES de `forn` e de `forn_aberto`
    no `case` (mesma licao da D17: papel novo depois de `forn` e so rotulo), fecha
    o bloco de cima e manda tudo para `n_descarte` ate o proximo cabecalho de
    fornecedor. Cabecalho de modelo no meio nao interrompe mais: era ele que fazia
    o vetor 16 escapar.
  - **A ancora sai da MEDIDA contra a propria lista, nao do tipo da pergunta.**
    Conta-se, com a mesma cadeia do leitor (`calc_norm(calc_limpar(linha))`),
    quantas linhas o texto IGUALA, quantas ele COMECA e em quantas ele APARECE:
    iguala -> `^texto$`; comeca -> `^texto`; aparece dentro -> `\ytexto\y`; nao
    aparece -> RECUSA com mensagem, em vez de gravar regra que nunca casaria.
    A ordem e a defesa do vetor 17: `PROMO` iguala a linha do cabecalho, entao
    vira `^promo$` e nao casa mais a linha `- 5.400 PROMO` de outro fornecedor.
  - **G4: `descartar` tem que aumentar `n_descarte`.** E a guarda que faltava, e
    a razao dela e o achado mais caro desta fatia: **a G3 ("a resposta tem que
    ensinar") nao pega esta classe.** Quando o descarte falha, as linhas sao
    ABSORVIDAS pelo fornecedor de cima e a pendencia some da leitura do mesmo
    jeito. Ensinar e engolir sao indistinguiveis para a G3, e foi exatamente
    assim que a D18 viveu com a prova verde.
  - **T5: pergunta de `preco` nao se descarta.** O texto dela e um MOTIVO por
    construcao (`preco com condicao pendurada: ...`), nunca um pedaco da lista.

  **O erro que eu cometi no meio, e quem pegou.** A primeira migration fez a T5
  recusar `cor` TAMBEM. Estava errado: descartar uma pergunta de cor era uma
  resposta que FUNCIONAVA (o texto `verde menta` esta dentro da linha do preco, a
  regra casa essa linha, a pendencia some de verdade), e estreitar o verbo teria
  tirado do dono uma resposta permanente, deixando so o `ignorar`, que vale para
  UMA lista. Quem pegou foi a assercao **G6** da prova, "o que ensinava continua
  ensinando", que existe so para isso. Registrado porque a licao nao e sobre cor:
  **guarda nova se mede contra o que ja funcionava, nao so contra o defeito.**

  **Tres correcoes ao que esta escrito acima:**
  1. `réplica` (900) e `genérico` (950) estao `ativo = false` por DECISAO do dono
     (17/08/2026). O preco de replica entrar **nao era** so o defeito de
     normalizacao, e nao e esta fatia que muda isso: e interruptor. As regras
     ATIVAS que falhavam calado eram `peça não genuína`, `somente para mídia`
     (dentro de uma regra ativa) e `à vista` / `só hoje` (na de pendencia). As
     cinco foram regravadas, as duas desligadas inclusive, para o defeito nao
     voltar no dia em que o interruptor subir.
  2. `1ª linha` NAO estava quebrada: o `ª` sobrevive ao `calc_norm` (medido).
  3. O vetor 16, medido no vivo, dava `descarte=0` mas **nao** dava preco errado
     na fixture que eu montei, porque havia outra pergunta ABERTA entre ele e o
     fornecedor de cima, e a D17 ja protegia. O defeito dele e o descarte que nao
     acontece; o preco errado exige que o cabecalho de cima ja esteja reconhecido.

  Prova: secao **L** de `ferramentas/prova_calc_parse.sql` (fixture F, os quatro
  vetores num laco, L18/L18b para a semente e a regra geral, L19 para a T5).
  **L18b e a assercao que vale mais que as outras:** ela nao lista casos, cobra a
  regra. Nenhum padrao de `descarte` ou de `condicao` pode ter alternativa numa
  normalizacao diferente da do texto contra o qual ele casa.
- [x] **2.4a bis — Fechar o buraco silencioso.** `calc_pendencia_resolver` passa a
  REPROVAR apelido que aponta para codigo inexistente. Hoje grava sem erro e nao casa
  nada. Medido em 10/09: `calc_alias.aponta` nao tem FK nem check.
  **FECHADO em 11/09/2026, e maior do que este item pedia.** Medidas 21 combinacoes
  pendencia x resposta antes de escrever: 4 ensinavam, 16 eram aceitas sem ensinar e
  1 (este item) fazia a linha SUMIR de todas as pilhas. Entraram tres guardas gerais
  (destino existe; `n_lidas = n_casou + n_duvidoso + n_nao_reconhecido`, tambem no
  `calc_carga_abrir`; a mesma pendencia nao pode voltar) e tres travas (condicao nao
  se ensina por apelido; nao responder duas vezes; so em rascunho). Migration
  `20260911_calc_resolver_nada_calado.sql`; prova `prova_calc_parse.sql` **PASSOU, 66
  assercoes** (eram 52), com `4 aceitas, 17 recusadas com motivo, 0 aceitas caladas`.
  Handoff v9.
- [x] **2.4a ter — Guarda de quase-igual. FECHADO em 11/09/2026**, na MESMA
  migration do `2.4a`, e nao depois, por um motivo: enquanto a 2.4c (desfazer) nao
  existir, criar fornecedor e escrita SEM VOLTA. Soltar o `criar` sozinho seria
  entregar um botao irreversivel sem a unica guarda que o protege.
  `privado.calc_nucleo(text)` (md5 `9e9545726257a1bd3a877852cf9495c4`, len 716) tira
  o enfeite comercial (`TABELA`, `IMPORTS`, `DISTRIBUIDORA`, `ATACADO`, `CELL`...) e
  ordena o que sobra. `TABELA MP DISTRIBUIDORA` e `MP Imports` caem os dois em `mp`,
  entao a pergunta aparece: **nao cria e nao une**, devolve as duas grafias lado a
  lado (memoria `fornecedores-mesma-pessoa`). O dono responde no proprio payload
  (`{"confirmar_novo":"sim"}`) ou usa `apontar`. Assercoes K2 e K3.
  **Nao e medida de distancia, e igualdade sobre o que sobra**, e isso foi escolha:
  nao exige extensao (`pg_trgm` nao esta instalado neste banco, medido), e da para
  explicar ao dono em uma frase. O preco declarado: falso positivo custa uma
  pergunta a mais; falso negativo (erro de digitacao) nao e pego. Os dois sao
  baratos perto de unir sozinho o custo de duas pessoas diferentes.
- [x] **2.4a quater — Origem em tudo que se aprende. FECHADO em 11/09/2026**, na
  mesma migration, e tambem nao depois: `criar` e a primeira RPC que escreve linha
  NOVA de catalogo, e sem proveniencia a linha com mais chance de estar errada (a
  que o cliente inventou as pressas) e justamente a que ninguem acha depois.
  `origem text not null default 'manual'` (`semente` / `aprendizado` / `manual`, com
  check), `carga_id uuid` e `criado_por uuid` nas cinco: `calc_alias`, `calc_regra`,
  `calc_modelo`, `calc_cor`, `calc_fornecedor`. **15 colunas, conferidas.**
  Backfill total para `semente`: tudo que existia entrou por migration, nada foi
  aprendido de carga, porque o verbo que aprende nasceu agora. Medido depois de
  aplicar: **zero** linha com `origem <> 'semente'`.
  `calc_catalogo_criar` e `calc_pendencia_resolver` carimbam `aprendizado` (K1, K7,
  K12). **Sem FK de `carga_id` para `calc_carga`**, de proposito: proveniencia nao
  pode sumir quando a carga sumir, e `calc_carga.aprovado_por` ja e uuid solto pelo
  mesmo motivo.
- [ ] **2.4b — Dialeto do fornecedor.** `perfil jsonb`, `n_listas int` e
  `cobertura_media numeric` em `calc_fornecedor`, aprendidos **so de carga aprovada**.
  **O perfil desempata, nunca decide**: o parser segue generico. Mais a bandeira
  `formato_mudou` (cobertura 15 pontos abaixo da media do proprio fornecedor, ou
  layout/`cor_pos` diferente do memorizado). Os 15 pontos sao constante DECLARADA,
  recalibrada depois da terceira carga real, igual ao token da 5.4.
- [ ] **2.4c — O palpavel: a aba mostra o que aprendeu.** Secao nova no painel
  `Catalogo`, newest-first (invariante 6), com `desfazer` por linha, e a curva por
  fornecedor (`MP Imports · 3 listas · 61% -> 88% -> 97%`).

**Portao do 2.4:** a MESMA lista de um fornecedor novo passa duas vezes, e a segunda
abre **estritamente menos pendencias** que a primeira. Sem essa medicao a promessa do
produto nao tem numero. As seis provas estao na secao 7 da spec; a primeira a fechar e
o apelido apontando para codigo inexistente.

---

# Bloco 3 — O consultor sai do repo

**Depende de:** ~~Bloco 2~~ **Bloco 5** (a ordem mudou em 10/09, ver o mapa dos
blocos). O Passo 3.3 depende tambem de **D4a**.
**Agentes:** `base`, `vitrine`, `pit-guard`, `bandeira`.

**Por que:** enquanto `public/calc/consultor/dados.js` for arquivo estatico, a frase
"acesso so por login" e falsa, e nao existe versao de outro lojista desse arquivo.

## 3.0 `Acessório` ganha margem propria (D4)

**Vem antes da derivacao, porque a derivacao le a margem.**

- [ ] **Acrescentar `aav` e `apc` ao `config`** do blob de custo, com o valor que o
  dono definir. Migration de dado, nao de schema (o `config` e jsonb).

- [ ] **`mg()` em `public/calc/index.html` passa a ter quatro ramos**, nao tres:

| Ordem | Teste | Devolve |
|---|---|---|
| 1 | `semMargem(c)` (`1ª Linha`, `Garmin`, `Moto Elétrica`) | `{av:0, pc:0}` |
| 2 | `MacBook` ou `Mac Mini` | `config.mav` / `config.mpc` |
| 3 | **`Acessório`** | **`config.aav` / `config.apc`** |
| 4 | resto (iPhone, iPad, **Apple Watch**) | `config.iav` / `config.ipc` |

  A margem continua saindo do `config`, nunca fixa no codigo (regra 5 da spec).

- [ ] **Estender `ferramentas/prova_sem_margem.js`.** Ela hoje tem 22 assercoes e le
  `SEMMARGEM`, `semMargem` e `mg` do arquivo real, sem copiar a logica. Acrescentar as
  assercoes do quarto ramo: `Acessório` devolve `aav`/`apc` e **nao** `iav`/`ipc`.
  Assercao de regressao obrigatoria: **`Apple Watch` continua em `iav`/`ipc`**, porque
  foi exatamente a categoria que o dono confundiu com acessorio.

**Prova do defeito que D4 conserta:** um AirPods Pro de custo R$1.500 hoje aparece com
venda de R$2.050 (leva `iav` 550). Depois de 3.0, aparece com `aav`. Conferir esse item
na tela antes de seguir.

- [ ] **3.1 Criar `calc_venda`**, um blob por tenant, mesma forma de `calc_dados`, com
  policy de SELECT para `authenticated` do tenant **sem exigir papel dono** (o vendedor
  precisa ler preco de venda).

- [ ] **3.2 A derivacao vira funcao**, dentro de `calc_carga_aprovar`:

```
para cada (modelo, condicao, cor):
    custo = MENOR v entre os fornecedores que tem aquela cor
    pv    = custo + mg(categoria).av
    pp    = custo + mg(categoria).pc
mg() e o mesmo quatro-ramos do passo 3.0: aav/apc para Acessório,
mav/mpc para MacBook e Mac Mini, iav/ipc para o resto (Apple Watch incluso).
Classes sem margem (1ª Linha, Garmin, Moto Elétrica) ficam de fora da derivacao.
Acessório ENTRA (D4), com aav/apc.
config.validade reposta em toda carga aprovada.
```

**A derivacao le a margem da mesma fonte que a tela do dono.** Se `mg()` e a derivacao
divergirem, o dono ve um preco e o consultor cota outro: por isso o passo 3.0 vem
antes, e a prova do 3.2 compara os dois lados.

Prova de record da regra: 103 de 103 combinacoes bateram em 27/07/2026, zero
divergencia. Se der divergencia agora, investigar antes de "corrigir": ou a margem
mudou no `config`, ou alguem editou o `dados.js` a mao.

- [ ] **3.3 `public/calc/consultor/index.html` passa a ler `calc_venda`** em vez de
  `dados.js`, mantendo `checkValidade()` e os quatro bloqueios de copiar pedido.

  **Depende de D4a.** Com `Acessório` entrando, o `boot()` do consultor exige
  `config.comissao` cobrindo a categoria nova. Hoje ele so valida
  `comissao.C1.lacrado`; acrescentar a guarda do ramo de acessorio, senao a calc abre
  e paga comissao errada em silencio. **Nao inventar o numero: ele vem de D4a.**

  Enquanto D4a nao vier, o Bloco 3 fecha os passos 3.0, 3.1, 3.2, 3.4 e 3.5 e para
  aqui. Nao entregar acessorio no consultor com comissao chutada.

- [ ] **3.4 Projecao por papel.** Hoje `vendedor` le **zero** linhas de `calc_dados` e
  o painel `public/app.js` (linhas 1151 e 1164) volta vazio para ele. Com time completo
  incluso isso deixa de ser aceitavel: criar a RPC `SECURITY DEFINER` que devolve **so**
  preco de venda para papel `vendedor`, sem custo, sem fornecedor, sem margem.

- [ ] **3.5 Apagar `public/calc/consultor/dados.js` do repo** e do worker.

**Portao do Bloco 3:**

```
curl -s https://flat-resonance-09ba.pitstopimports.workers.dev/calc/consultor/dados.js -o /dev/null -w "%{http_code}\n"
```
Esperado: `404`. E, com o JWT de um `vendedor`, `select count(*) from public.calc_dados`
devolvendo `0` enquanto `calc_venda` devolve `1`.

---

# Bloco 4 — A conta nasce sozinha

**Depende de:** Bloco 3. **Agentes:** `base`, `vitrine`, `pit-guard`, `bandeira`.

- [ ] **4.1 `privado.fn_provisionar_tenant`.** Tarefa 3 do plano de 19/08, com duas
  mudancas: nao clona `dicionario_scripts` com marca fixa (o Bloco 0 ja resolveu), e
  **nao clona `calc_dados` nem `calc_fornecedor`** (ordem do dono, ainda de pe). Passa
  a **copiar a semente do catalogo** (`tenant_id is null`) para o tenant novo: modelo,
  cor, alias de cor e condicao, e regras. Fornecedor NAO, que e do tenant que o cadastrou.
  A partir da copia, aquele catalogo e do cliente e ninguem mais o atualiza por ele.

- [ ] **4.2 Signup.** Cria usuario no Auth, cria `tenant` com `plano='trial'` e
  `trial_ate`, cria `app_usuario` com papel `dono`, tudo numa RPC. O primeiro usuario
  de um tenant e sempre `dono`.

- [ ] **4.3 Tela de equipe**, so para papel `dono` do tenant:

| Acao | RPC |
|---|---|
| Convidar por email | `calc_equipe_convidar(p_email, p_papel)` |
| Desligar | `calc_equipe_desligar(p_uid)` -> `ativo=false` |
| Listar quem tem acesso | leitura de `app_usuario` pela policy `p_usuario_select`, que ja permite ao dono ver o tenant dele |

O `tenant_id` do convidado vem de `fn_tenant_atual()` de quem convida. **Nunca do
formulario.** Papel aceito: so `dono` e `vendedor`.

- [ ] **4.4 Onboarding.** Depois do signup, o usuario cai direto na tela `Alimentar`,
  passo 1. Nao existe estado inicial "sistema vazio sem instrucao".

**Portao do Bloco 4:** o dono do produto cria uma conta nova do zero, **sem tocar em
SQL nem no painel do Supabase**, convida um vendedor, importa uma lista e ve preco na
tela. Mais a prova de isolamento (Tarefa 6 do plano de 19/08, que nunca rodou): com o
JWT de cada tenant, `lead`, `venda`, `calc_dados` e `calc_fornecedor` devolvendo `0`
para o tenant errado, nos dois sentidos.

---

# Bloco 5 — O modelo na pilha 3, e a cota

**Depende de:** ~~Bloco 4~~ **a fatia 2.4** (a ordem mudou em 10/09: este bloco subiu
para antes do 3 e do 4, e deixou de ser opcional, porque o dono nao dara auxilio de
atualizacao de lista aos clientes). **Agentes:** `base`, `pit-guard`, `bandeira`.

- [ ] **5.1 Edge Function** que recebe **so a pilha nao reconhecida** mais o catalogo,
  chama a API com `claude-opus-5`, e devolve proposta estruturada. A chave vive em
  variavel de ambiente do Deno, **nunca no repo**. A funcao le o tenant do JWT.

- [ ] **5.2 Proposta nunca vira preco sozinha.** O retorno do modelo entra como
  **pendencia**, na mesma tela do Bloco 2, para o lojista decidir. Nao existe caminho
  em que uma linha lida pelo modelo entre no blob sem gente aprovar.

- [ ] **5.3 Cota.** `calc_uso` por tenant e competencia. Limite **3.000 linhas/mes**,
  mais **3.000 de credito de abertura, uma vez**. Estourou, a tela diz:
  `Cota do mes atingida. Suas listas continuam sendo lidas; N linhas ficaram sem
  analise automatica.` O parse deterministico **nunca** para.

- [ ] **5.4 Medir token de verdade.** Na primeira carga real pela Edge Function, medir
  com `count_tokens` e reajustar a cota. Os numeros da spec (~$0,30 por carga, ~$1,50
  de teto mensal) sao estimativa, nao medicao.

- [ ] **5.5 Bootstrap.** Catalogo do tenant vazio: o modelo **propoe** o catalogo
  (fornecedores achados, modelos, cores) e o lojista aprova em bloco. So as listas dos
  ultimos 15 dias: formato antigo casou **0%** nas medicoes de 27/07/2026, nao vale
  token.

**Portao do Bloco 5:** uma conta nova de teste, com um export real de fornecedor que
**nao** seja dos 17 do dono, fecha a primeira carga com cobertura medida e registrada,
e o consumo de cota fica dentro do credito de abertura.

---

# Bloco 6 — Piloto e cobranca

**Depende de:** Bloco 5.

**D2 fechada:** o produto e vendido **como conjunto** (Pit Wall com a calculadora
dentro), e a calculadora **vira produto separado depois**. Duas consequencias:
o plano do piloto oferece o sistema inteiro, nao so a calc; e a restricao global 10
(nenhuma FK de `calc_*` para tabela de operacao) e o que mantem o desmembramento
futuro barato. Conferir aquela query a cada migration, nao no fim.

- [ ] **6.1 Piloto com UM lojista real, de graca**, com o dono do produto olhando a
  carga dele. A primeira carga externa e onde se descobre o que a semente nao sabe.
- [ ] **6.2 Termo de controlador e operador**, uma pagina, antes do primeiro cliente
  cadastrar dado real. O backup diario (`backup_git.yml`) passa a conter dado comercial
  de terceiro.
- [ ] **6.3 Rota de saida.** Script que extrai so os dados de um tenant. Escrever
  enquanto o desenho esta fresco, nao quando o cliente pedir.
- [ ] **6.4 Cobranca** do conjunto (D2). Preco ancorado em **flat por loja**, ja que
  assento deixou de ser alavanca (time completo incluso). A trava tecnica que compensa
  o flat e a cota de `calc_uso` do Bloco 5, que limita linha enviada ao modelo, nunca
  numero de gente.
- [ ] **6.5 Registrar o gatilho do desmembramento.** A calc vira produto separado
  depois (D2). O momento de reabrir esse desenho e quando aparecer interessado que
  queira **so** a calculadora. Ate la, restricao global 10 mantem a porta aberta de
  graca.

**Portao do Bloco 6, e e o portao do produto inteiro:** se **mais de 1 em cada 5**
clientes precisar falar com o dono do produto para concluir a primeira carga, **parar
de vender e consertar o wizard.** Vinte clientes que se viram sozinhos se sustentam;
vinte que ligam no dia 1 consomem a semana inteira e nenhuma mensalidade cobre.

---

## Riscos aceitos conscientemente

1. **Superficie de SaaS antes do primeiro pagamento** (invariante 17), decisao
   explicita do dono nesta sessao.
2. **Sem catalogo mantido, o fosso e fraco.** Decisao do dono em 07/09/2026: quem
   atualiza catalogo e o cliente. Consequencias aceitas: zero aprendizado compartilhado
   (duzentos clientes ensinam `PURPLE -> Lilás` duzentas vezes), e a cobranca recorrente
   passa a se sustentar no sistema rodando, nao em catalogo atualizado.
3. **Um plano Supabase para todos.** O uso dos clientes conta no limite do dono.
4. **Backup com dado de terceiro** (risco 6.2 acima).
5. **Churn com a tabela na mao** depois de tres cargas. Defesa natural: custo envelhece
   em uma semana.
6. **`dicionario_rotulos` fica compartilhado** entre tenants. So tem policy de SELECT,
   entao ninguem edita; o efeito e as lojas verem os mesmos rotulos de display.

---

## Fim de obra

Ao terminar cada bloco: exigir handoff do subagent que atuou, atualizar
`.claude/skills/calculadoras/references/` conforme a regra de auto-atualizacao da
propria skill (o catalogo saindo do markdown para o banco **e** mudanca de onde as
coisas vivem, entao `mapa-calculadoras.md` muda em todos os blocos), e atualizar
`docs/handoffs/handoff_indice_pitwall.md`.
