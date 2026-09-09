# Handoff — Calculadora como produto, v4

Data: 09/09/2026. Linha `calculadora`. **Topo da linha.** Substitui o v3.

Escrito para uma sessao comecando **fria**. Tudo abaixo foi medido nesta sessao.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao. Valores reais do
sistema aparecem exatos.

---

## 0. Leia nesta ordem

1. `CLAUDE.md`.
2. `docs/calculadora/PROCESSO.md` — como conduzir um bloco desta linha.
3. Este arquivo.
4. `docs/superpowers/specs/2026-09-05-calculadora-produto-design.md`, **secao 2.6b**
   (o portao novo) — so se for mexer em cobertura.
5. O v3 (`handoff_calculadora_pitwall_v3.md`) so se precisar do detalhe dos seis
   defeitos do parser. O resto dele esta resumido aqui.

**Nao comece pelo plano.** O plano manda construir a tela; esta sessao concluiu que
ha um passo antes dela. Secao 3.

---

## 1. A UNICA coisa que a proxima sessao precisa fazer

**Medir o parser contra uma lista REAL, antes de escrever a primeira linha da tela.**

O dono vai colar uma lista de fornecedor. O que fazer com ela esta na secao 3, com o
SQL pronto.

Nao ha nada bloqueado, nada quebrado e nada pendente de conserto. O repo esta
sincronizado (`0 0`) e a tree limpa.

---

## 2. Decisoes do dono (nao perguntar de novo)

| # | Pergunta | Resposta | Quando |
|---|---|---|---|
| D1 | Os 341 produtos do tenant `...0004` servem de historico? | **Nao.** Ja apagados | 07/09 |
| D2 | O que e vendido? | **O conjunto.** A calc vira produto separado DEPOIS | 07/09 |
| D3 | Descarte configuravel por tenant? | **Sim**, padrao pre-marcado | 07/09 |
| D4 | `Acessório` e margem | **Margem propria** (`aav`/`apc`), e entra no consultor | 07/09 |
| D5 | Quem atualiza o catalogo? | **O CLIENTE.** So ha semente no nascimento | 07/09 |
| **D6** | `calc_carga.texto_bruto` fica ou sai? | **FICA** | **09/09** |
| **D7** | Como travar o portao de cobertura? | **Comparacao pareada** | **09/09** |
| — | Assentos | Time completo incluso, acesso so por login | 06/09 |
| — | Cota de modelo | 3.000 linhas/mes + 3.000 de abertura | 06/09 |

### D6 — `texto_bruto` FICA

Guarda a lista colada **enquanto a carga esta em rascunho**, e e apagada no instante
em que a carga e aprovada ou descartada. So o papel `dono` do proprio tenant le.

Motivo da escolha: com ela, resolver pendencia **reprocessa na hora** e o dono ve a
cobertura subir na tela antes de aprovar. Sem ela, ele resolveria 12 pendencias e
veria o mesmo numero, com o ganho so na carga do mes seguinte.

Retencao declarada: **enquanto o rascunho existir, e nem um minuto mais.**

### D7 — o portao dos 89% caiu, porque o numero nunca foi medido

> Na MESMA entrada, a tela nova nao pode cobrir menos que o caminho de hoje
> (a skill `calculadoras` rodada por sessao de IA).

**Por que caiu.** Auditoria de 09/09/2026: o par `612 de 690` aparece pela primeira
vez em `.claude/skills/calculadoras/references/procedimento-alimentacao.md:92`,
**dentro de aspas, como exemplo de FORMATO**, na frase *"Fechar com a cobertura real
medida: '...'"*. O `612` **nao existe como medicao em nenhum outro ponto do repo**. O
`690` existe uma vez, mas como **"690 precos"** (volume da derivacao do consultor),
nao como linhas lidas de uma carga. A spec de 05/09 leu o exemplo como fato e o
promoveu a portao.

O 89% sobrevive so como **alvo declarado do dono**, nunca como baseline medida.
Formula e detalhe: **secao 2.6b da spec**.

### Decisao ABERTA (nao trava nada agora)

**D4a — comissao de `Acessório` na escada do consultor.** A escada `config.comissao`
so tem os ramos `lacrado` e `seminovo`, por nivel (Embaixador / C1 / C2 / C3).
**Nao inventar numero: ele paga comissao real ao Brendon.** Trava o passo 3.3, dentro
do Bloco 3. Nao trava a medicao nem a tela.

---

## 3. O proximo passo, com o SQL pronto

### Por que medir ANTES da tela

O plano manda construir a tela (Bloco 2, fatia 2). Esta sessao recomendou o
contrario, com dois numeros:

| Medido em 09/09/2026 | Resultado |
|---|---|
| Arquivos em `public/` que a fatia 1 entregou | **0**. Foram 1.575 linhas, todas SQL |
| Contra o que o parser foi provado | **18 linhas sinteticas escritas a mao**, das quais 7 feitas para falhar de proposito |

O motor casou **11 de 11** no teto atingivel daquela fixture, mas **nunca viu uma
lista de verdade**. Construir a tela primeiro significa que o primeiro teste real
acontece com o dono olhando para ela, que e o pior lugar para descobrir que a
cobertura e 40%.

E a D7 **ja exige** essa medicao. Ela nao precisa de tela: `calc_carga_abrir` recebe
texto puro, que e exatamente o que a tela vai mandar depois.

### As quatro RPCs, assinatura conferida em 09/09/2026

| Funcao | Argumentos | Retorna |
|---|---|---|
| `calc_carga_abrir` | `p_texto text` | `uuid` |
| `calc_carga_aprovar` | `p_carga uuid` | `jsonb` |
| `calc_carga_descartar` | `p_carga uuid` | `void` |
| `calc_pendencia_resolver` | `p_pendencia uuid, p_decisao text, p_aponta text default null` | `jsonb` |

### O procedimento

**1. Abrir a carga com a lista real.** Nao aprovar nada ainda.

```sql
select public.calc_carga_abrir($$
<a lista que o dono colar, inteira, entre os cifroes>
$$) as carga_id;
```

Usar `$$ ... $$` e nao aspas simples: a lista tem apostrofo, acento e quebra de
linha. Aspas simples quebram na primeira palavra com apostrofo.

**2. Ler os numeros da carga**, que e a metade nova da comparacao:

```sql
select lidas, casou, duvidoso, nao_reconhecido, descarte,
       round(100.0 * casou / nullif(lidas,0), 1) as cobertura_pct
  from public.calc_carga
 where id = '<carga_id>';
```

**3. Ver as pendencias agrupadas por causa**, que e o que a tela vai mostrar:

```sql
select causa, count(*) as linhas
  from public.calc_pendencia
 where carga_id = '<carga_id>'
 group by causa order by 2 desc;
```

**4. A MESMA lista pelo caminho de hoje.** Invocar a skill `calculadoras` e seguir o
`procedimento-alimentacao.md`. Anotar `casou / lidas / descartadas`.

**5. Comparar.** `casou_novo >= casou_velho` na mesma entrada = D7 satisfeita.

**6. Descartar a carga de teste**, para nao deixar rascunho pendurado nem manter o
`texto_bruto` gravado:

```sql
select public.calc_carga_descartar('<carga_id>');
```

### Os tres desfechos, e o que cada um manda fazer

| Cobertura | O que significa | Proximo passo |
|---|---|---|
| **>= a do caminho velho** | o motor funciona fora do laboratorio | construir a tela (fatia 2), com o portao ja medido |
| **abaixo, por erro de leitura** | o parser tem defeito | consertar o parser ANTES da tela |
| **abaixo, por modelo/cor/fornecedor faltando** | o problema e o seed, nao o motor | voltar ao Bloco 1.2. A tela nem era o assunto |

**Restricao 8 continua valendo:** a lista **nao entra no repo**, nem como fixture.
Ela vai para `calc_carga.texto_bruto` no tenant do dono e sai no descarte (D6).

---

## 4. Estado vivo, medido em 09/09/2026

### Banco (projeto `unjzpyexgtbcmjfgcqrx`)

```sql
select
  (select count(*) from public.calc_modelo where tenant_id is null) as modelos_semente,
  (select count(*) from public.calc_cor    where tenant_id is null) as cores_semente,
  (select count(*) from public.calc_alias  where tenant_id is null) as aliases_semente,
  (select count(*) from public.calc_regra  where tenant_id is null) as regras_semente,
  (select count(*) from public.calc_fornecedor) as fornecedores_tenant,
  (select count(*) from public.calc_carga) as cargas;
```

Esperado: **124, 32, 27, 20, 17, 0**.

Advisors de seguranca: **7 achados**, todos esperados. Os quatro `calc_*`
(`calc_carga_abrir`, `calc_carga_aprovar`, `calc_carga_descartar`,
`calc_pendencia_resolver`) sao `SECURITY DEFINER` com `grant execute to
authenticated` e barreira de papel **no corpo** da funcao, seguindo o precedente de
`registrar_venda` e `remover_nf`. **Nao sao regressao. Quem "consertar" tirando o
GRANT quebra a tela.** Mais o leaked password protection.

### Repo

Sincronizado com `github/main` em `cda1255`, tree limpa. **O remote e `github`; o
`origin` e proxy morto.** Push: `git push github HEAD:main`.

Se o push for negado pelo classifier, **o dono roda com `!` na frente, no proprio
prompt**. Aconteceu duas vezes nos Blocos 1 e 2. Antes de concluir que a sessao nao
tem rede, **tentar de novo**: falhou e passou minutos depois, sem mudar nada.

`git add -A` esta **mecanicamente negado** (`.claude/settings.json`). Sempre
`git add <caminho>`.

### Migrations

**9 `calc_*` versionadas.** Uma **NAO** esta, de proposito:
`calc_catalogo_tenant_pitstop` carrega os 17 fornecedores do dono com praca, e a
restricao global 8 proibe dado comercial no repo. Motivo completo e caminho de
recuperacao pelo backup em
`supabase/migrations/20260908_calc_catalogo_tenant_pitstop.NAO-VERSIONADA.md`.
Isso **contraria a T6** do plano de rebarbas, e a contradicao esta declarada la.
Se o dono discordar, e decisao dele: o SQL esta no banco.

---

## 5. O que esta aberto, e o que cada coisa trava

| Item | Trava | Peso |
|---|---|---|
| **Medir o parser** | nada. E o proximo passo | 1 lista do dono |
| **D4a** (comissao de acessorio) | passo 3.3, no Bloco 3 | decisao |
| **T8** — isolamento das 3 tabelas novas com JWT | Bloco 4 | prova |
| **T9** — auditoria e `calc_uso` | Bloco 5 (o LLM) | decisao |

T8 e T9 estao no plano `2026-09-09-rebarbas-bloco2-calculadora.md`, com o status de
cada uma. **Nenhuma das duas muda o que o dono consegue fazer amanha**: T8 prova
isolamento entre tenants e existe 1 tenant; T9 mede cota de LLM e o LLM entra no
Bloco 5. Nao fazer as duas antes da medicao.

---

## 6. Duas licoes desta sessao que valem para o projeto inteiro

**1. Numero em exemplo de formato vira fato dois documentos adiante.** Foi assim que
o 89% virou portao. Ou o exemplo usa valores obviamente falsos (`X de Y`), ou carrega
a data e a fonte da medicao.

**2. Plano nao e verdade, e uma hipotese datada.** O plano de rebarbas afirmava que
as 3 migrations do Bloco 1 nao estavam no repo (5 das do Bloco 2 ja estavam), que a
T2 era sobre escolher denominador (era sobre nao haver medicao), e mandava versionar
a terceira migration (a restricao 8 do plano principal proibe). Remedir no arranque,
sempre, e corrigir o documento na hora.
