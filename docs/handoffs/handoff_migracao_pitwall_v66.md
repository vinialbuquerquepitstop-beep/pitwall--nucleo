# Handoff v66 — 19/08/2026

Substitui todos os anteriores. Sessao de CORRECAO, disparada por um bug reportado pelo
dono em uma frase: "esta sendo possivel adicionar o mesmo lead, mesmo colocando o mesmo
numero de telefone". A investigacao virou a **Fatia 2 inteira**, que era a fatia barata
do roteiro da v65. **Cinco migrations entraram.** Nenhuma linha de frontend mudou.

---

## 0. Para quem chega agora, em oito linhas

1. O bug reportado nao era falta de trava. O `UNIQUE` existia e **nunca chegou a ser
   consultado**, porque duas linhas guardavam a mesma pessoa em formatos diferentes.
2. Causa raiz: das TRES portas que escrevem telefone, so duas canonicalizavam o DDI 55.
   `editar_lead` nao canonicalizava.
3. A trava passou a comparar o **sufixo** do numero, entao formato nao abre mais brecha.
4. A Aretusa duplicada foi fundida sem perder a informacao que so existia na duplicata.
5. Ao medir o banco para responder "qual a proxima fatia", apareceu um furo MAIOR:
   **`registrar_venda` nunca re-ancorava a cadencia.** Quem comprava seguia na regua de
   venda, e o motor de pos-venda nunca recebia ninguem novo.
6. Isso foi corrigido tambem, e com ele a **Fatia 2 fechou por completo**.
7. Frontend intocado: `git diff` em `public/` vazio. A suite de tela nao se aplica a
   esta sessao e nao foi rodada.
8. As proximas fatias sao a 3 (pos-venda de um clique + pedido de indicacao) e a 4
   (repescagem por evento). A 3 estava BLOQUEADA pelo furo do item 5, e agora nao esta.

---

## 1. O bug, e por que a trava nao pegou

O banco tinha `UNIQUE (tenant_id, whatsapp_digitos)` desde sempre. O que faltava era
**um formato unico**. Tres funcoes escrevem telefone:

| Funcao | Canonicalizava o 55 | Checava duplicata |
|---|---|---|
| `cadastrar_lead` | sim | sim, com aviso amigavel |
| `registrar_venda` | sim (cliente e motoboy) | por texto exato |
| **`editar_lead`** | **nao** | **nao** |

`editar_lead` fazia so `regexp_replace(p_whatsapp, '[^0-9]', '', 'g')` e gravava. Faltava
o bloco que as outras duas tinham:

```sql
if length(v_digitos) in (10, 11) then v_digitos := '55' || v_digitos; end if;
```

### A sequencia exata, reconstruida pelo `lead_evento`

1. **14/08 21:36** — `cadastrar_lead` grava Aretusa como `5521969683300`. Correto.
2. **14/08 21:40** — o dono abre **Editar**. A tela preenche o campo com os digitos crus
   (`5521969683300`) sob um rotulo que pede "DDD + numero". Ele reescreve para
   `21969683300`. `editar_lead` grava do jeito que veio. O lead sai do formato canonico.
3. **18/08 01:48** — o dono cadastra Aretusa de novo. `cadastrar_lead` normaliza para
   `5521969683300`, procura duplicata **com esse valor**, nao acha (o registro dela esta
   como `21969683300`) e insere `LEAD-0030`.

Extensao medida na base de 31 leads: 28 canonicos, **1 sem o 55** (`LEAD-0027`, a bomba,
que ja tinha explodido) e 2 sem telefone nenhum (`LEAD-0007`, `LEAD-0008`, do ETL).

---

## 2. A trava nova

```sql
create unique index lead_tenant_whats_uniq
  on public.lead (tenant_id, right(whatsapp_digitos, 11))
  where whatsapp_digitos is not null and arquivado_em is null;
```

A constraint antiga (`lead_tenant_id_whatsapp_digitos_key`) saiu. A nova compara o
SUFIXO, entao `21969683300` e `5521969683300` colidem: **nenhuma RPC futura reabre o
furo esquecendo o 55.** Escolha do dono, contra a alternativa de so tapar o buraco
conhecido.

E parcial em `arquivado_em is null`, no mesmo padrao do `lead_tenant_cpf_uniq` que ja
existia na tabela: **lead arquivado devolve o numero para a base**, o que permite
recadastrar quem saiu.

---

## 3. A fusao da Aretusa

| | `LEAD-0027` | `LEAD-0030` |
|---|---|---|
| Antes | `21969683300` | `5521969683300` |
| Vendas | 1 (VENDA-0011, iPhone 14, R$ 4.300) | 0 |
| Eventos | 7 | 2 |
| Depois | canonico e **ativo** | **arquivado** |

`LEAD-0030` foi arquivado com a semantica de `arquivar_lead()` (cadencia encerrada,
evento append-only). A informacao real que so existia nele, **a consulta do iPhone 14
512GB de 18/08**, virou nota no historico do `LEAD-0027`. Nada de verdadeiro foi
descartado.

---

## 4. O furo maior, achado ao responder "qual a proxima fatia"

`registrar_venda` seta `perfil = 'comprou'` e **nao chamava
`privado.fn_cadencia_trocar_perfil`**. `editar_lead` chamava; `registrar_venda`, nunca.

Duas consequencias, ambas medidas no banco vivo:

**1. O sistema ia cobrar venda de quem ja comprou.** Aretusa fechou R$ 4.300 em 18/08,
perfil `comprou`, e a cadencia dela seguia em **`avaliando`, passo `R2 · D3`, vencendo
20/08**. O veredito da fila dizia `espere — vence em 1d`. No dia seguinte ela apareceria
com script de quem ainda esta decidindo comprar.

**2. O motor de pos-venda nunca recebia ninguem novo.** O v65 registrou "motor pronto,
0 execucoes". Estava pronto **pela metade**: semeia o P1 e para, e quem fecha venda hoje
nem chegava a entrar. Os seis clientes com pos-venda ativo, todos travados no passo 1:

| Cliente | Passo | Vencido ha | Vendas |
|---|---|---|---|
| Victor Maia Dargains | `P1 · D1 pos-venda` | **33 dias** | 2 |
| Lucas da silva dos santos | `P1 · D1 pos-venda` | 27 dias | 1 |
| Gabriel Britto | `P1 · D1 pos-venda` | 10 dias | **4** |
| Lohran | `P1 · D1 pos-venda` | 10 dias | 1 |
| Renata Bittecourt | `P1 · D1 pos-venda` | 5 dias | 1 |
| Gabrielle | `P1 · D1 pos-venda` | 2 dias | 1 |

---

## 5. O que mudou em `registrar_venda`

a) **A busca do cliente existente** comparava `whatsapp_digitos` por texto exato e nao
   filtrava arquivado. Agora casa pelo sufixo, mesmo criterio do indice, e ignora
   arquivados: venda nao fica pendurada em quem saiu da base.

b) **Venda nao cancelada re-ancora a regua no P1 de pos-venda**, atualiza
   `proximo_contato` e grava evento `cadencia_iniciada`.

### Duas decisoes registradas

**Venda nova REINICIA o pos-venda no P1.** P1 e P2 sao sobre a entrega do aparelho
recem-comprado; quem acabou de comprar nao pode receber "quer fazer upgrade?" (P5) no
lugar de "chegou tudo certo?". Gabriel Britto, com 4 vendas, volta ao P1 a cada compra.

**Nao usei trigger em `lead.perfil`.** Um trigger cobriria todas as portas de uma vez,
que e a mesma filosofia do indice por sufixo, mas dispararia tambem dentro de
`fn_regua_varredura`. Mexer no motor da regua para consertar a venda seria trocar um bug
por um risco maior. A correcao ficou explicita, dentro da funcao.

O prazo **nao foi hardcoded**: `fn_cadencia_trocar_perfil` le `dias_offset` da
`cadencia_regra` (invariante 11).

---

## 6. Backfill

- **Aretusa** re-ancorada na **data da venda**, nao em hoje+1: o pos-venda dela esta
  devido, nao futuro. Caiu em 19/08, entao ela entra na fila de **hoje**, com
  `P1 · D1 pos-venda`.
- **`LEAD-0009`** (Anderson barbeiro), unico lead ativo sem estado de cadencia, veio do
  ETL de 05/07 com **zero eventos**: nunca entrou na regua. Recebeu o mesmo estado dos
  pares `lista_fria` (`LEAD-0007`, `LEAD-0008`, `LEAD-0017`): passo 1 **ENCERRADO**.
  Lista fria e decisao da regua (invariante 3): fechar buraco de modelo nao pode virar
  tarefa nova sem o dono pedir.

Leads ativos sem estado de cadencia depois disto: **dois, ambos legitimos.** `LEAD-0002`
(cancelado, `perfil` null) e `LEAD-0031` (cadastrada 19/08 as 21:56; o cron das 08:00
semeia amanha).

---

## 7. A incoerencia que a propria prova revelou

Tornar a trava parcial teve um efeito colateral que so apareceu na Prova 4: o aviso
amigavel de `cadastrar_lead` consultava a tabela inteira e passou a apontar um lead
**arquivado**, invisivel em tela nenhuma, barrando o recadastro legitimo de quem saiu da
base. Entrou uma quinta migration alinhando o criterio do aviso ao do indice.

Licao: **mudar o alcance de uma trava muda o significado de toda mensagem que fala sobre
ela.** A prova pegou; a leitura do codigo nao teria pego.

---

## 8. Provas

Todas rodadas **como o dono autenticado** (`request.jwt.claims` + `set local role
authenticated`, com RLS valendo) e **desfeitas por exception** ao final, para nao sujar
a base.

### Dedupe (6 de 6)

| # | Cenario | Resultado |
|---|---|---|
| 1 | Editar pondo o WhatsApp de outro lead **sem** o 55 | recusado: `Ja existe outro lead com esse WhatsApp: Aretusa (LEAD-0027)` |
| 2 | O mesmo numero **com** o 55 | recusado igual |
| 3 | Salvar com o campo WhatsApp vazio | telefone preservado (`5521992807473`) |
| 4 | Digitar `(21) 98888-1234` | gravado `5521988881234` |
| 5 | Cadastrar do zero o numero de um lead **ativo** | recusado |
| 6 | Cadastrar o numero de um lead **arquivado** | permitido |

### Pos-venda (ponta a ponta)

Venda registrada com o telefone digitado **sem** o DDI:

```
ok=true | cliente_novo=false (casou pelo sufixo, nao criou lead duplicado)
lead LEAD-0031 | cadencia comprou passo 1 (P1 · D1 pos-venda) vence 20/08
proximo_contato do lead 20/08
```

### Estado final medido

31 leads, **0 duplicatas ativas**, **0 leads sem o 55**, `LEAD-0032` do teste nao existe,
`LEAD-0031` intacto. Grants restaurados identicos nas tres funcoes reescritas
(`authenticated`, `postgres`, `service_role`; nenhum `public`, nenhum `anon`).

**Frontend intocado.** `git diff HEAD -- public/` vazio, entao a suite de tela (os seis
comandos e as cinco larguras) nao se aplica a esta sessao e **nao foi rodada**. Ultimo
numero valido continua sendo o da v65: 713 assercoes, 0 falhas.

---

## 9. As migrations

| Migration | O que faz |
|---|---|
| `20260819221335_whatsapp_canonico_trava_por_sufixo_e_fusao_lead_duplicado` | troca a trava e funde a Aretusa |
| `20260819221406_corrige_editar_lead_normaliza_e_recusa_duplicata` | `editar_lead` normaliza, valida e recusa duplicata |
| `20260819221534_cadastrar_lead_dedup_coerente_com_indice_parcial` | alinha o aviso ao indice |
| `...registrar_venda_reancora_posvenda_e_dedup_por_sufixo` | venda entrega o cliente ao pos-venda |
| `...backfill_cadencia_aretusa_e_lead0009` | corrige os dois leads quebrados |

Versionadas em `supabase/migrations/`, commits `3fa53f8` e `9b17b52`.

---

## 10. O que ficou aberto

1. **A tela ainda convida ao erro que causou tudo.** O painel de edicao preenche o campo
   com os digitos crus (`5521969683300`) sob um rotulo que pede "DDD + numero". Hoje o
   banco protege, mas formatar a exibicao (`(21) 96968-3300`) mataria o convite. Obra de
   frontend, nao feita sem ordem do dono.
2. **`LEAD-0007` e `LEAD-0008` seguem sem telefone.** `editar_lead` agora impede
   *apagar*, mas nao preenche o que ja estava vazio. Sao leads de 05/07, do ETL.
3. **A Fatia 3 esta desbloqueada e e a proxima.** Botao de um clique no Pitscare no
   padrao do `sugerir_mensagem`, mais o **passo de indicacao** explicito no P2 ou P3
   (indicacao e 40% de conversao e R$ 14.170 da receita, e nao ha nada sistematizado
   pedindo). Os seis clientes da tabela da secao 4 sao a fila inicial dela.
4. **Fatia 4** (cara, maior teto): normalizar `lead.produto`, hoje texto livre sujo
   (`"13 128GB 14 128GB"`, `"IPad e 17 Pro Max"`), e casar com `catalogo_iphone` /
   `calc_dados` para o lead entrar na fila COM O MOTIVO ESCRITO, fora do calendario.
5. **`docs/superpowers/plans/2026-08-19-segundo-lojista-tenant.md` continua sem commit**,
   38 tarefas, nenhuma executada. Pendencia herdada da sessao das 17:09 de 19/08, que
   perguntou ao dono se devia commitar e nunca foi respondida. O tenant `...0004` segue
   no banco com 341 precos e 14 fornecedores, esperando decisao.
6. Herdados da v65 e ainda validos: `permite_esfriar` e config morta em 4 dos 6 perfis;
   `LEAD-0019` e `LEAD-0028` com `origem` nula (R$ 8.700 em venda concluida); a lista
   compacta "Fila de hoje" mostrando `38d de atraso` em vez do chip de veredito; e a
   escrita de volta no Notion bloqueada pela capability **"Update content"**.

---

## 11. A ressalva que continua valendo

Nao ha amostra para calibrar score nenhum: **21 toques, 3 respostas, 7 vendas** na base
inteira. Os cortes do veredito da Fatia 1 sao hipotese de benchmark externo, nao numero
medido aqui, e isso esta escrito no `comment on view` da propria `v_lead`. Quando houver
60 a 90 toques, a tarefa e comparar o veredito exibido com o desfecho real e **trocar o
palpite pelo numero** — nao construir score mais sofisticado antes disso.
