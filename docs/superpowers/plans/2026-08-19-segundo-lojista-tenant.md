# Segundo Lojista (tenant novo) — Plano de Implementacao

> **Para quem for executar:** use `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans` para tocar tarefa a tarefa. Os passos usam
> checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** colocar um segundo lojista para operar o Pit Wall no mesmo banco,
com a operacao (reguas e scripts) clonada, a marca correta na tela e nas
mensagens, o conteudo administrado pelo dono, e **zero** exposicao da tabela de
fornecedores da Pitstop Imports.

**Arquitetura:** um unico projeto Supabase, um unico deploy na Cloudflare, um
`tenant` novo isolado por RLS. Nada de instancia separada, nada de superficie de
SaaS (invariante 17: nao ha pagamento envolvido, e uma parceria). O provisionamento
e uma funcao de banco chamada pelo dono, nao uma tela.

**Stack:** Postgres/Supabase (RLS, RPC, pg_cron), frontend trio servido pela
Cloudflare (`public/index.html`, `app.css`, `app.js`), Edge Function Deno para o
Notion.

---

## Contexto de origem

Sessao de 19/08/2026. O dono pediu para "passar o sistema para outro lojista" e
decidiu, respondendo pergunta direta:

| Decisao | Resposta do dono |
|---|---|
| Isolamento | **Tenant novo no mesmo banco** |
| Relacao comercial | **Socio/parceiro/favor**, sem cobranca |
| Concorrencia | **Nao concorre** (outra cidade ou outro produto) |
| Reguas e scripts | **Vao junto**, o sistema e pra ser util |
| Atualizacao do sistema e do conteudo | **O dono continua sendo quem atualiza** |
| Nome do sistema | **Pit Wall continua**, e o nome do produto, nao da loja |
| Calculadora | **NAO leva os fornecedores do dono**, e cadastrada com os dele |

---

## Estado medido em 19/08/2026 (nao presumir, foi tudo consultado)

O que **ja esta pronto** e nao precisa de obra:

- 33 das 35 tabelas de `public` tem `tenant_id` com RLS ligado e policy.
- `privado.fn_tenant_atual()` deriva o tenant de `app_usuario`, nunca de constante.
  **Nenhuma** das 56 funcoes de `public` tem UUID de tenant hardcoded.
- `fn_regua_varredura()` ja itera todos os tenants e grava `regua_execucao` por tenant.
- `fn_rotina_semear()` ja varre `app_usuario` e semeia na loja de cada um.
- As 4 RPCs que aceitam `p_tenant_id` por parametro (`sincronizar_conteudo`,
  `sincronizar_molde`, `registrar_falha_sync`, `registrar_falha_molde`) tem EXECUTE
  **so** para `postgres` e `service_role`. `authenticated` nao alcanca nenhuma.
- O frontend nao tem tenant hardcoded.
- `venda_nf` guarda upload de arquivo, nao razao social: nao ha dado fiscal da loja
  no schema.
- `dicionario_rotulos` nao tem `tenant_id`, mas so tem policy de **SELECT**: e
  compartilhado e ninguem consegue editar. Nao e bloqueador.

O que **quebra** e vira as tarefas abaixo:

| Achado | Numero medido |
|---|---|
| Linha orfa em `calc_dados` no tenant `...0004`, com **14 dos 17 fornecedores do dono**, nome, bairro e custo por cor | 341 ofertas, de 27/07/2026 |
| `calc_dados` e a **unica** tabela com `tenant_id` sem FK para `tenant` (por isso o orfao existiu). As outras 3 sem FK (`auditoria`, `escopo_frente_evento`, `venda_nf`) tem **zero** linhas orfas | 1 linha orfa no banco inteiro |
| Scripts com `Pitstop Imports` escrito dentro do texto | **48 de 126** |
| `Pitstop Imports` escrito no HTML | 3 lugares: [index.html:7](../../../public/index.html), `:19`, `:43` |
| Tabelas de configuracao que um tenant novo NAO herda | 8 (ver Tarefa 3) |
| A calc **so le** `calc_dados`: nenhum `insert`/`update`/`upsert` no frontend | 1 `from('calc_dados')`, 0 escritas |

---

## Restricoes globais

Valem para todas as tarefas, sem repetir:

1. **`calc_dados` NUNCA entra em clone de tenant.** Ordem explicita do dono.
2. Invariantes do `CLAUDE.md` continuam de pe, em especial: nivel derivado na
   leitura (4), chave por `codigo` e nunca por `rotulo` (12), `sugerir_mensagem`
   como unica fonte de texto de abordagem e estritamente read-only (13),
   `CURRENT_DATE` proibido em data de negocio (10), nao construir superficie de
   SaaS antes do primeiro pagamento (17).
3. Toda escrita de schema passa pelo subagent `base` (unico com `apply_migration`).
   Frontend passa pelo `vitrine`. Prova passa pela `bandeira`.
4. `CREATE OR REPLACE FUNCTION` reseta ACL: refazer REVOKE/GRANT explicito depois.
5. Suite de validacao do frontend, EXIT CODE (nunca o texto):
   ```
   python ferramentas/validar.py
   python ferramentas/harness.py
   python ferramentas/prova_trilho.py
   python ferramentas/prova_grafico.py
   python ferramentas/prova_atmosfera.py
   node --check public/app.js
   for w in 360 390 414 1280 1440; do python ferramentas/diag_mobile.py $w; done
   ```
   Baseline em 19/08/2026: **691 assercoes, 0 falhas**, EXIT 0 nos seis comandos
   e nas cinco larguras.
6. `execute_sql` do MCP devolve so o resultado do ultimo statement: cada
   verificacao e uma chamada separada.

---

## Decisoes que faltam do dono (bloqueiam o inicio)

- [ ] **D1 — Os 341 precos do tenant `...0004` servem para alguma coisa?**
  Bloqueia a Tarefa 1. Se servirem como historico de 27/07, viram snapshot fora
  de `calc_dados` antes do delete. Se forem lixo da tentativa revertida na v39,
  vao direto para o delete.
- [ ] **D2 — Nome da loja do parceiro e nome do usuario dele.** Bloqueia as
  Tarefas 3 e 5. Precisa do texto exato como ele quer ver na tela e na assinatura
  do WhatsApp.
- [ ] **D3 — Email do parceiro** para criar o acesso. Bloqueia a Tarefa 5.
- [ ] **D4 — A `config` da calc dele** (margens e as 18 taxas de maquininha) vai
  como padrao editavel ou em branco? Recomendacao registrada: **taxas em branco**,
  porque taxa de maquininha errada faz ele vender no prejuizo achando que ganhou.
  So importa quando a Tarefa 7 for decidida.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| migration (banco) | remover orfao de `calc_dados` + FK + unique | 1 |
| `public.sugerir_mensagem` | resolver `{loja}` e `{vendedor}` no envio | 2 |
| `public.dicionario_scripts` (dados) | trocar marca fixa por variavel nos 48 scripts | 2 |
| `privado.fn_provisionar_tenant` | clonar as 8 tabelas de configuracao | 3 |
| `public/index.html` | tirar `Pitstop Imports` de 3 lugares | 4 |
| `public/app.js` | preencher o nome da loja a partir de `tenant.nome` | 4 |
| `public.conteudo_fonte` (dados) | ligar o calendario dele, no workspace Notion do dono | 5 |
| `public.app_usuario` (dados) | criar o acesso dele | 5 |

---

## Tarefa 1: Fechar o vazamento da tabela de fornecedores

**Depende de:** D1.
**Agente:** `base`. **Prova:** `bandeira`.

**Por que primeiro:** o tenant `...0004` guarda 14 dos 17 fornecedores do dono com
bairro e custo. Hoje ninguem le, porque nenhum `app_usuario` aponta para ele. Mas o
passo normal de onboarding e criar um usuario apontando para um tenant novo: se
alguem reaproveitar o `...0004`, o parceiro abre a calc e ve a tabela inteira. E
armadilha armada, nao risco teorico.

**Arquivos:**
- Migration nova via `apply_migration` (nome sugerido: `fecha_orfao_calc_dados`)

- [ ] **Passo 1: Provar o estado antes**

```sql
select tenant_id, jsonb_array_length(dados->'produtos') as produtos, atualizado_em
from public.calc_dados order by atualizado_em;
```
Esperado: 2 linhas, o `...0001` com 494 produtos e o `...0004` com 341.

- [ ] **Passo 2 (so se D1 disser que serve): guardar o snapshot fora de `calc_dados`**

```sql
create table if not exists privado.calc_snapshot_20260727 as
select * from public.calc_dados
 where tenant_id = '00000000-0000-0000-0000-000000000004';
revoke all on privado.calc_snapshot_20260727 from public, anon, authenticated;
```
O schema `privado` e invisivel ao PostgREST (invariante 8), entao o snapshot nao
fica exposto na API.

- [ ] **Passo 3: Apagar a linha orfa**

```sql
delete from public.calc_dados
 where tenant_id = '00000000-0000-0000-0000-000000000004';
```
Esperado: `DELETE 1`.

- [ ] **Passo 4: Criar a FK que impede tenant fantasma**

```sql
alter table public.calc_dados
  add constraint calc_dados_tenant_id_fkey
  foreign key (tenant_id) references public.tenant(id);
```

- [ ] **Passo 5: Criar a unique de uma linha por tenant**

```sql
alter table public.calc_dados
  add constraint calc_dados_tenant_id_key unique (tenant_id);
```
Motivo: a calc le uma linha por tenant. Sem a unique, uma segunda linha do mesmo
tenant faz a tela escolher em silencio qual preco mostrar.

- [ ] **Passo 6: Provar que fechou**

```sql
select count(*) as orfaos_restantes
  from public.calc_dados c
 where not exists (select 1 from public.tenant t where t.id = c.tenant_id);
```
Esperado: `0`.

```sql
insert into public.calc_dados (tenant_id, dados)
values ('00000000-0000-0000-0000-000000000009', '{}'::jsonb);
```
Esperado: **ERRO** de violacao de foreign key. Se passar, a FK nao foi criada.
Se por acaso inserir, desfazer com `delete from public.calc_dados where tenant_id
= '00000000-0000-0000-0000-000000000009';`.

---

## Tarefa 2: A marca vira variavel nos scripts

**Depende de:** nada. **Vale mesmo que a parceria nao aconteca.**
**Agente:** `base`. **Prova:** `bandeira`.

**Por que:** 48 dos 126 scripts tem `Pitstop Imports` escrito no texto. Isso ja e um
bug hoje: **o Brendon (papel `vendedor`) manda mensagem assinando "aqui e o Vini"**.
Com o parceiro, o cliente dele receberia WhatsApp assinado com a loja do dono.
Trocar o texto no momento do clone nao resolve, porque qualquer edicao futura de
script volta a assinar errado. A solucao permanente e a marca virar variavel, como
`{nome}` e `{produto}` ja sao.

**Interfaces:**
- Consome: `public.tenant.nome`, `public.app_usuario.nome`
- Produz: `sugerir_mensagem` passa a resolver `{loja}` e `{vendedor}`

- [ ] **Passo 1: Levantar as formas exatas da marca nos scripts**

```sql
select distinct substring(texto_template from '[^.!?]*Pitstop[^.!?]*') as trecho,
       count(*) over (partition by substring(texto_template from '[^.!?]*Pitstop[^.!?]*')) as ocorrencias
from public.dicionario_scripts
where texto_template ilike '%Pitstop%'
order by 2 desc;
```
Formas ja conhecidas em 19/08/2026: `aqui é o Vini, da Pitstop Imports` e
`Vini, da Pitstop`. Se aparecer forma nova, incluir no Passo 3.

- [ ] **Passo 2: Alterar `sugerir_mensagem` para resolver as duas variaveis**

A funcao nao e SECURITY DEFINER e as policies ja permitem ler as duas tabelas
(`tenant` por `id = fn_tenant_atual()`, `app_usuario` por `id = auth.uid()`).
Declarar duas variaveis novas junto das existentes:

```sql
  v_loja     text;
  v_vendedor text;
```

Preencher logo depois do bloco que preenche `v_nome`/`v_produto`:

```sql
  select nome into v_loja from public.tenant where id = v_lead.tenant_id;
  select split_part(btrim(nome), ' ', 1) into v_vendedor
    from public.app_usuario where id = auth.uid();
  v_loja     := coalesce(nullif(btrim(v_loja), ''), 'nossa loja');
  v_vendedor := coalesce(nullif(btrim(v_vendedor), ''), 'a gente');
```

E acrescentar os dois `replace` na montagem do texto, mantendo os cinco que ja
existem:

```sql
                 replace(replace(replace(replace(replace(replace(replace(
                   s.texto_template,
                   '{nome}', v_nome),
                   '{produto}', v_produto),
                   '{condicao}', v_cond),
                   '{valor_oferta}', v_valor),
                   '{data_combinada}', v_data),
                   '{loja}', v_loja),
                   '{vendedor}', v_vendedor)
```

- [ ] **Passo 3: Trocar a marca fixa pelas variaveis nos 48 scripts**

```sql
update public.dicionario_scripts
   set texto_template = replace(
         replace(texto_template,
                 'aqui é o Vini, da Pitstop Imports',
                 'aqui é o {vendedor}, da {loja}'),
         'Vini, da Pitstop',
         '{vendedor}, da {loja}'),
       atualizado_em = now()
 where texto_template ilike '%Pitstop%';
```
Esperado: `UPDATE 48`.

- [ ] **Passo 4: Refazer os GRANTs (o CREATE OR REPLACE resetou)**

```sql
revoke all on function public.sugerir_mensagem(uuid) from public;
grant execute on function public.sugerir_mensagem(uuid) to authenticated;
```

- [ ] **Passo 5: Provar que nao sobrou marca fixa**

```sql
select count(*) as ainda_com_marca
  from public.dicionario_scripts where texto_template ilike '%Pitstop%';
```
Esperado: `0`.

```sql
select count(*) as com_variavel
  from public.dicionario_scripts where texto_template like '%{loja}%';
```
Esperado: `48`.

- [ ] **Passo 6: Provar o texto renderizado, com lead real**

```sql
select (sugerir_mensagem((select id from public.lead
                           where perfil is not null and arquivado_em is null
                           order by criado_em desc limit 1)) -> 'opcoes' -> 0 ->> 'texto') as texto;
```
Esperado: o texto sai com `Pitstop Imports` no lugar de `{loja}` (porque quem roda
e o tenant do dono) e **sem** nenhuma chave `{...}` sobrando.

- [ ] **Passo 7: Suite do frontend**

`sugerir_mensagem` alimenta a Fila. Rodar os seis comandos e as cinco larguras da
restricao global 5. Esperado: EXIT 0 em todos, 691 assercoes, 0 falhas.

---

## Tarefa 3: Funcao de provisionamento

**Depende de:** D2 (nome da loja).
**Agente:** `base`. **Prova:** `bandeira`.

**Por que:** um tenant novo nasce sem uma linha de configuracao. Sem isso a regua
faz `continue when not found` e nao inicia cadencia nenhuma, `sugerir_mensagem`
volta vazia, a Rotina nao semeia e as abas Escopo e Captacao ficam em branco. O
sistema abre bonito e nao faz nada, sem erro nenhum na tela.

**O que copia (8 tabelas, a operacao):**
`cadencia_perfil` (6), `cadencia_regra` (36), `dicionario_scripts` (126),
`rotina_categoria` (7), `rotina_tarefa` (17), `escopo_frente` (9),
`captacao_frente` (1), `catalogo_iphone` (6).

**O que NAO copia:** `calc_dados` (ordem do dono), `lead`, `venda`, `venda_nf`,
`venda_pagamento`, `captacao`, `conteudo`, `conteudo_fonte`, `conteudo_molde`,
`dia_tarefa`, `dia_lembrete`, `dia_nota`, `escopo_acao`, `motoboy`, `auditoria`,
`cadencia_estado`, `regua_execucao`.

**Ordem importa:** `rotina_categoria` antes de `rotina_tarefa`, porque
`fn_rotina_semear()` faz join por `rc.codigo = rt.categoria` dentro do mesmo tenant.
O array da funcao ja esta na ordem certa; nao reordenar.

**Interfaces:**
- Produz: `privado.fn_provisionar_tenant(p_nome text, p_modelo uuid) returns uuid`

- [ ] **Passo 1: Criar a funcao**

```sql
create or replace function privado.fn_provisionar_tenant(p_nome text, p_modelo uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_novo uuid;
  v_tab  text;
  v_cols text;
  v_vals text;
  v_tabelas text[] := array[
    'cadencia_perfil', 'cadencia_regra', 'dicionario_scripts',
    'rotina_categoria', 'rotina_tarefa', 'escopo_frente',
    'captacao_frente', 'catalogo_iphone'];
begin
  if nullif(btrim(coalesce(p_nome, '')), '') is null then
    raise exception 'Nome da loja e obrigatorio';
  end if;
  if not exists (select 1 from public.tenant where id = p_modelo) then
    raise exception 'Tenant modelo % nao existe', p_modelo;
  end if;

  insert into public.tenant (nome) values (btrim(p_nome)) returning id into v_novo;

  foreach v_tab in array v_tabelas loop
    -- duas listas na mesma varredura: a de destino com todas as colunas,
    -- a de origem com tenant_id trocado pelo tenant novo. Colunas de id com
    -- default sao omitidas para o default gerar valor proprio.
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
           string_agg(case when column_name = 'tenant_id' then '$2'
                           else quote_ident(column_name) end,
                      ', ' order by ordinal_position)
      into v_cols, v_vals
      from information_schema.columns
     where table_schema = 'public'
       and table_name = v_tab
       and not (column_name = 'id' and column_default like 'gen_random_uuid%');

    execute format('insert into public.%I (%s) select %s from public.%I where tenant_id = $1',
                   v_tab, v_cols, v_vals, v_tab)
      using p_modelo, v_novo;
  end loop;

  return v_novo;
end;
$function$;

revoke all on function privado.fn_provisionar_tenant(text, uuid) from public;
```

Nao ha GRANT para `authenticated`: a funcao vive no schema `privado` (invisivel ao
PostgREST, invariante 8) e so roda pelo MCP/SQL editor, com o dono presente. Isso e
deliberado, pelo invariante 17: onboarding nao vira tela enquanto ninguem paga.

- [ ] **Passo 2: Rodar o provisionamento**

Trocar o nome pelo que vier de D2. Exemplo preenchido:

```sql
select privado.fn_provisionar_tenant('Loja do Parceiro',
                                     '00000000-0000-0000-0000-000000000001') as tenant_novo;
```
Anotar o UUID devolvido: e ele que entra nas Tarefas 5 e 6.

- [ ] **Passo 3: Provar que a configuracao chegou completa**

```sql
select 'cadencia_perfil' t, count(*) filter (where tenant_id='00000000-0000-0000-0000-000000000001') dono,
       count(*) filter (where tenant_id <> '00000000-0000-0000-0000-000000000001') novo from cadencia_perfil
union all select 'cadencia_regra', count(*) filter (where tenant_id='00000000-0000-0000-0000-000000000001'), count(*) filter (where tenant_id <> '00000000-0000-0000-0000-000000000001') from cadencia_regra
union all select 'dicionario_scripts', count(*) filter (where tenant_id='00000000-0000-0000-0000-000000000001'), count(*) filter (where tenant_id <> '00000000-0000-0000-0000-000000000001') from dicionario_scripts
union all select 'rotina_categoria', count(*) filter (where tenant_id='00000000-0000-0000-0000-000000000001'), count(*) filter (where tenant_id <> '00000000-0000-0000-0000-000000000001') from rotina_categoria
union all select 'rotina_tarefa', count(*) filter (where tenant_id='00000000-0000-0000-0000-000000000001'), count(*) filter (where tenant_id <> '00000000-0000-0000-0000-000000000001') from rotina_tarefa
union all select 'escopo_frente', count(*) filter (where tenant_id='00000000-0000-0000-0000-000000000001'), count(*) filter (where tenant_id <> '00000000-0000-0000-0000-000000000001') from escopo_frente
union all select 'captacao_frente', count(*) filter (where tenant_id='00000000-0000-0000-0000-000000000001'), count(*) filter (where tenant_id <> '00000000-0000-0000-0000-000000000001') from captacao_frente
union all select 'catalogo_iphone', count(*) filter (where tenant_id='00000000-0000-0000-0000-000000000001'), count(*) filter (where tenant_id <> '00000000-0000-0000-0000-000000000001') from catalogo_iphone;
```
Esperado: as duas colunas iguais em todas as 8 linhas (6, 36, 126, 7, 17, 9, 1, 6).

- [ ] **Passo 4: Provar que dado NAO veio junto**

```sql
select
  (select count(*) from lead        where tenant_id <> '00000000-0000-0000-0000-000000000001') as leads,
  (select count(*) from venda       where tenant_id <> '00000000-0000-0000-0000-000000000001') as vendas,
  (select count(*) from calc_dados  where tenant_id <> '00000000-0000-0000-0000-000000000001') as calc,
  (select count(*) from conteudo    where tenant_id <> '00000000-0000-0000-0000-000000000001') as conteudo;
```
Esperado: `0, 0, 0, 0`. **A coluna `calc` em zero e a prova da ordem do dono.**

- [ ] **Passo 5: Provar que o join da rotina sobreviveu ao clone**

```sql
select count(*) as tarefas_com_categoria_valida
  from public.rotina_tarefa rt
  join public.rotina_categoria rc
    on rc.tenant_id = rt.tenant_id and rc.codigo = rt.categoria
 where rt.tenant_id <> '00000000-0000-0000-0000-000000000001';
```
Esperado: `17`. Se vier menos, a ordem de copia quebrou e `fn_rotina_semear()` vai
semear menos tarefas sem reclamar.

---

## Tarefa 4: A marca sai do HTML

**Depende de:** Tarefa 3 (precisa do tenant novo para testar de verdade).
**Agente:** `vitrine`. **Prova:** `bandeira`.

**Por que:** `Pitstop Imports` esta escrito em tres lugares fixos. O parceiro abriria
o sistema dele lendo o nome da loja do dono. `Pit Wall` **fica**, e o nome do produto.

**Arquivos:**
- Modificar: `public/index.html` linhas 7, 19, 43
- Modificar: `public/app.js` (bloco de boot)

**Regra de degradacao:** o nome do produto continua no HTML estatico. So o nome da
loja e preenchido por JS. Se a leitura falhar, a tela mostra `Pit Wall` sozinho, e
nunca uma string vazia ou o nome da loja errada.

- [ ] **Passo 1: Deixar o HTML sem nome de loja**

Em [index.html:7](../../../public/index.html): `<title>Pit Wall</title>`
Em `:19`: `<div class="marca-sub" data-loja="nucleo">Núcleo</div>`
Em `:43`: `<div class="marca-sub" data-loja></div>`

- [ ] **Passo 2: Preencher pelo banco no boot**

A policy `p_tenant_select` ja permite `id = fn_tenant_atual()`, entao a leitura sai
com o token do proprio usuario, sem RPC nova:

```js
const {data:tn} = await sb.from('tenant').select('nome').single();
if (tn && tn.nome) {
  document.title = 'Pit Wall · ' + tn.nome;
  document.querySelectorAll('[data-loja]').forEach(el=>{
    el.textContent = el.dataset.loja === 'nucleo' ? tn.nome + ' · Núcleo' : tn.nome;
  });
}
```
Marcar o elemento da linha 19 com `data-loja="nucleo"` para ele receber o sufixo.

- [ ] **Passo 3: Assercao nova no harness**

Assertar sobre o DOM renderizado (nunca `document.body.textContent`, que enxerga o
proprio `app.js` colado no `<body>`): o `.marca-sub` mostra o nome vindo do banco, e
o `<title>` comeca com `Pit Wall`.

- [ ] **Passo 4: Suite completa**

Seis comandos e cinco larguras. Esperado: EXIT 0, e a contagem de assercoes subindo
de 691 para 693.

- [ ] **Passo 5: Commit e push**

```bash
git remote -v
git fetch origin main && git rev-list --left-right --count origin/main...HEAD
git add public/index.html public/app.js ferramentas/harness.py
git commit -m "feat(tenant): o nome da loja vem do banco, Pit Wall fica no HTML"
git push origin HEAD:main
```
A Cloudflare publica sozinha no push, ~30 segundos ate servir o arquivo novo.

---

## Tarefa 5: O acesso dele e o conteudo

**Depende de:** D2, D3, Tarefas 3 e 4.
**Agente:** Torre (painel do Supabase e do Notion sao clique, fora do alcance do
Claude Code). **Prova:** `bandeira`.

**Por que o Notion assim:** `NOTION_TOKEN` e env unico do Deno e `conteudo_fonte` nao
tem coluna de token. Como o dono decidiu que **ele** continua atualizando o conteudo
do parceiro, a saida certa e criar o calendario do parceiro **dentro do workspace
Notion do dono**, como um segundo banco de dados. `conteudo_fonte.notion_db_id` ja e
por tenant e o cron das 08:30 ja itera as fontes ativas: custo zero de codigo.
Limite honesto a registrar com o parceiro: **ele le, nao escreve** no Notion.

- [ ] **Passo 1: Criar o usuario no Auth**

Supabase > Authentication > Add user, com o email de D3. Copiar o UID gerado.

- [ ] **Passo 2: Ligar o usuario ao tenant novo**

```sql
insert into public.app_usuario (id, tenant_id, nome, papel, ativo)
values ('<uid do passo 1>', '<uuid devolvido na Tarefa 3>', '<nome de D2>', 'dono', true);
```
O CHECK de `papel` aceita so `dono` e `vendedor`. O papel `parceiro` foi criado e
revertido na v39: **nao recriar**.

- [ ] **Passo 3: Criar o calendario dele no Notion do dono**

Duplicar a estrutura do Calendario de Conteudo num banco de dados novo, no mesmo
workspace. Copiar o `database_id` da URL.

- [ ] **Passo 4: Ligar a fonte de conteudo**

```sql
insert into public.conteudo_fonte
  (tenant_id, codigo, rotulo, notion_db_id, janela_atras_dias, janela_frente_dias, ativo)
values ('<uuid da Tarefa 3>', 'calendario', 'Calendário de Conteúdo',
        '<database_id do passo 3>', 7, 28, true);
```

- [ ] **Passo 5: Disparar o sync na mao e conferir**

```sql
select public.fn_conteudo_disparar_sync();
```
Depois:
```sql
select tenant_id, origem, ok, msg, vistos, inseridos, criado_em
  from public.conteudo_sync_log order by criado_em desc limit 4;
```
Esperado: uma linha `ok = true` para cada tenant. Se vier a mensagem de Vault sem
`service_role_key`, o problema e o segredo, nao a fonte nova.

- [ ] **Passo 6: Esconder a calculadora para tenant sem preco**

A calc dele nasce vazia e nao ha tela de cadastro (Tarefa 7, nao decidida). Deixar o
acesso visivel entrega tela em branco no primeiro dia. Esconder o item de menu
quando `calc_dados` do tenant nao tiver linha, e rodar a suite completa depois.

---

## Tarefa 6: Prova de isolamento (gate, nada sobe sem ela)

**Depende de:** Tarefa 5.
**Agentes:** `pit-guard` modela, `bandeira` prova. **Nao pode ser pulada.**

Nunca houve um segundo usuario de outra loja neste banco: a RLS esta construida mas
**nunca foi exercitada de verdade**.

- [ ] **Passo 1: Logar no app com o usuario dele e olhar com os olhos**

Esperado: Fila vazia, Vendas vazio, Pitscare vazio. Se aparecer um unico lead da
Pitstop Imports, **parar tudo** e tratar como incidente.

- [ ] **Passo 2: Provar pelo banco, no papel dele**

```sql
select count(*) as leads_visiveis from public.lead;
select count(*) as vendas_visiveis from public.venda;
select count(*) as calc_visivel from public.calc_dados;
```
Rodar com o JWT dele. Esperado: `0, 0, 0`.

- [ ] **Passo 3: Provar o caminho inverso**

Com o dono logado, cadastrar um lead de teste no tenant dele e conferir que o dono
nao ve. Esperado: os 30 leads do dono continuam 30.

- [ ] **Passo 4: Provar a regua nos dois tenants**

```sql
select public.fn_regua_varredura();
select tenant_id, ok, resultado->>'data' as dia, resultado->>'atrasados' as atrasados
  from public.regua_execucao order by criado_em desc limit 4;
```
Esperado: **duas** linhas do dia, uma por tenant, com numeros diferentes.

- [ ] **Passo 5: Rodar os advisors**

`get_advisors(type: 'security')`. Esperado: nenhum achado novo em relacao a
baseline de antes da Tarefa 1.

---

## Tarefa 7: Tela de precos — FORA deste plano

**Nao e placeholder: e escopo que o dono ainda nao decidiu, e depende de spec
propria.** Registrado aqui para nao se perder.

O que se sabe, medido: a calc **so le**. Quem escreve `calc_dados` hoje sou eu, a
partir das listas que o dono cola numa sessao. O parceiro nao tem Claude, e o dono
decidiu que a calc dele e cadastrada com os fornecedores **dele**. Logo: **sem essa
tela, a calculadora nao faz parte do que o parceiro recebe** — nao existe meio-termo,
porque nao ha como encher a tabela dele.

Direcao recomendada quando for decidido: caixa de colar + grade editavel do que o
sistema entendeu + salvar. O erro tem que ser visivel antes de salvar, porque erro
silencioso numa calculadora de preco significa vender no prejuizo sem perceber.
Construir primeiro so para o formato do fornecedor dele, nao um interpretador
universal.

**O argumento que decide, e e sobre o dono, nao sobre o parceiro:** hoje a Pitstop
Imports nao consegue atualizar o proprio preco sem abrir uma sessao de IA. Essa tela
tira a operacao de preco dessa dependencia. Se for construida, e por isso.

Alternativa barata enquanto nao se decide: o parceiro manda a lista e o dono roda o
Claude. Se ele mandar lista toda semana, a tela se paga; se mandar duas vezes e
parar, a obra foi economizada.

---

## Riscos aceitos conscientemente

1. **O backup diario passa a conter PII dos clientes do parceiro.** `backup_git.yml`
   grava dump criptografado de tudo. Pede um termo de uma pagina dizendo quem e
   controlador, quem e operador, e o que acontece com os dados se a parceria acabar.
   Recomendacao de timing: assinar antes de ele cadastrar o primeiro cliente real,
   nao antes do SQL (o SQL sozinho nao cria risco).
2. **Um plano Supabase para os dois.** O uso dele conta no limite do dono.
3. **Nao existe rota de saida.** Extrair so os dados dele exige SQL na mao. Vale
   escrever esse script junto da Tarefa 3, enquanto o desenho esta fresco.
4. **`dicionario_rotulos` fica compartilhado.** So tem policy de SELECT, entao
   ninguem edita; o efeito e as duas lojas verem os mesmos rotulos de display.
5. **`/calc/consultor/dados.js`** e arquivo estatico publico com precos de venda.
   Ja e assim hoje para qualquer um na internet; o parceiro passa a saber onde olhar.

---

## Fim de obra

Ao terminar, exigir handoff do subagent que atuou, criar
`docs/handoffs/handoff_migracao_pitwall_v65.md` e atualizar
`docs/handoffs/handoff_indice_pitwall.md`.
