# Procedimento: do export do chat ate os precos no ar

O dono cola o export. A partir dai, tudo abaixo e trabalho da skill. Ele so volta a ser
chamado em dois pontos: **aprovar o diff** e **rodar o push**.

---

## Passo 0 — Estado vivo (nunca pular)

```sql
select atualizado_em,
       jsonb_array_length(dados->'produtos') as n_produtos,
       dados->'config' as config
  from public.calc_dados;
```

```
node -e "const D=new Function(require('fs').readFileSync('public/calc/consultor/dados.js','utf8')+'; return DADOS;')(); console.log(D.produtos.length,'produtos | validade',D.config.validade);"
git log -1 --oneline
```

Se o `dados.js` local divergir do que esta no ar, conferir antes de sobrescrever:

```
curl -s https://flat-resonance-09ba.pitstopimports.workers.dev/calc/consultor/dados.js | grep -o "validade\":\"[0-9/]*\""
```

O clone local atrasa em relacao ao GitHub e as vezes pula para frente sozinho pelo
OneDrive. Conferir `git log -1` na hora, nao confiar no arranque.

**Medir o atraso do clone ANTES de commitar, nao depois** (em 15/08/2026 eram 25
commits, e um deles renormalizou o `index.html` inteiro de CRLF para LF):

```
git fetch github main && git rev-list --left-right --count github/main...HEAD
```

Saida `25  1` quer dizer 25 atras e 1 a frente. Se estiver atras, **nao rebasear** o
`index.html`: mover a base com `git reset --hard github/main` e REAPLICAR as edicoes,
que sao poucas e pontuais. Rebase num arquivo renormalizado conflita linha a linha.

---

## Passo 1 — Parsear o export

Formatos que o dono pode mandar: texto colado direto no chat, export JSON do Telegram
Desktop (`result.json`, com remetente e data por mensagem), ou print. Print exige leitura
de imagem e tem taxa de erro maior: conferir numero a numero contra o diff antes de gravar.

Ler cada mensagem contra o catalogo de `references/formato-dados.md` e separar em tres
pilhas:

- **Casou**: modelo, capacidade, condicao, cor e preco reconhecidos com certeza.
- **Duvidoso**: reconheceu o modelo mas algo esta ambiguo (cor nova, condicao estranha,
  preco com condicao pendurada).
- **Nao reconhecido**: nao casou com nada.

Duvidoso e nao reconhecido **nao entram no blob**. Vao numerados para o dono, com a linha
original copiada.

Ancorar a data: cada lista tem a data da mensagem. Lista de mais de 7 dias entra so com
aviso explicito, porque custo velho vira margem errada.

---

## Passo 2 — Montar o blob novo

- Preservar `config` inteiro do blob atual (as margens moram la).
- Preservar `bateria` e `tela` como estao (hoje `[]`, e o validador exige que sejam array).
- Fornecedor que **nao apareceu** nesta rodada: manter as linhas antigas dele e **listar
  no diff como "sem lista nova"**. Nunca apagar em silencio, nunca fingir que o preco e
  de hoje.
- Nome, categoria, condicao, praca e hex de cor sempre na forma canonica do catalogo.

Validar mentalmente contra `validarDados()` antes de propor: produto sem `f` ou `l`
derruba a calc inteira, nao so aquela linha.

---

## Passo 3 — Diff para o dono (ponto de aprovacao 1)

Apresentar, compacto:

- fornecedores lidos, com a data da lista de cada um;
- total de precos: quantos subiram, quantos cairam, quantos iguais, quantos novos;
- **toda variacao acima de 15%**, uma a uma, com o custo antigo e o novo;
- modelos que sairam de linha (estavam no blob, nao vieram na lista nova);
- fornecedores sem lista nova;
- a pilha de pendencias, numerada.

Fechar com a cobertura real medida: "casaram 612 de 690 linhas (89%)". Numero medido,
nunca estimado.

Esperar o "pode gravar".

---

## Passo 4 — Gravar em `calc_dados`

Preferir `apply_migration` por MCP (transacional, lida com acento e payload grande) ou o
SQL Editor do Dashboard:

```sql
insert into public.calc_dados (tenant_id, dados) values (
  '00000000-0000-0000-0000-000000000001',
  $j$  { ... blob inteiro ... }  $j$::jsonb
)
on conflict (tenant_id) do update
  set dados = excluded.dados, atualizado_em = now();
```

**Carga grande (centenas de produtos): staging primeiro.** Medido em 15/08/2026 com
1.043 precos. Enviar o blob inteiro de uma vez significa reenviar tudo a cada tentativa
que falhar. O caminho:

1. `create table privado.carga_DDMM (ord bigint, l text)` e carregar o texto compacto
   (`n|c|t|f|cor:v,cor:v`, ~35 KB contra ~91 KB do JSON) por `regexp_split_to_table`.
2. Diagnosticar por SELECT: contagem, soma, cor sem hex, fornecedor sem praca, preco
   invalido. So seguir com tudo zerado.
3. Montar o jsonb lendo do staging, gravar, e dropar a tabela no fim.

**A trava vai em bloco `DO`, nunca inline.** `case when ok then true else (select
1/0)::boolean end` NAO funciona: o Postgres dobra `1/0` em tempo de planejamento e
estoura antes de olhar o dado, reprovando carga correta. O que funciona, depois do
insert e dentro da mesma transacao:

```sql
do $guarda$
declare np int; npr int; sm numeric;
begin
  select jsonb_array_length(dados->'produtos') into np from public.calc_dados where tenant_id='...';
  select count(*), round(sum((c->>'v')::numeric),2) into npr, sm
    from public.calc_dados d, jsonb_array_elements(d.dados->'produtos') p, jsonb_array_elements(p->'cs') c
    where d.tenant_id='...';
  if np <> <esperado> then raise exception 'guarda produtos: %', np; end if;
  if npr <> <esperado> then raise exception 'guarda precos: %', npr; end if;
  if sm <> <esperado> then raise exception 'guarda soma: %', sm; end if;
end $guarda$;
```

Os tres numeros esperados saem do parser, ANTES de enviar. Bateu dos dois lados, o dado
atravessou; nao bateu, a transacao inteira volta.

Conferir depois, em chamada separada (o `execute_sql` do MCP so devolve o resultado do
ultimo statement do bloco):

```sql
select atualizado_em, jsonb_array_length(dados->'produtos') as n_produtos
  from public.calc_dados;
```

Pedir ao dono para abrir `/calc/` e dar Ctrl+F5: sem barra vermelha e dois precos
conferidos na tela.

---

## Passo 5 — Gerar o `dados.js` do consultor

Derivar do MESMO blob, pela regra de `references/formato-dados.md` (menor custo por cor
mais a margem lida do `config`). Acessorio fica de fora.

**Sempre repor `config.validade`.** Janela curta: a validade nao deve passar da data em
que o custo envelhece. Custo de mais de uma semana com validade de duas e promessa que a
margem nao cobre. Confirmar a data com o dono se ele nao disser.

Preservar `pb`, `taxas` e `comissao` como estao, a menos que o dono mande mudar.

Validar antes de commitar:

```
node --check public/calc/consultor/dados.js
node -e "const D=new Function(require('fs').readFileSync('public/calc/consultor/dados.js','utf8')+'; return DADOS;')(); console.log(D.produtos.length,'produtos | validade',D.config.validade); if(!/^\d{2}\/\d{2}\/\d{4}$/.test(D.config.validade))throw new Error('validade em formato errado');"
```

Quando a mudanca for so a validade, provar que **nada mais** mudou:

```
git show HEAD:public/calc/consultor/dados.js > /tmp/antes.js
node -e "const fs=require('fs');const a=fs.readFileSync('/tmp/antes.js','utf8'),d=fs.readFileSync('public/calc/consultor/dados.js','utf8');console.log('so a data mudou?', a.replace('DD/MM/AAAA_ANTIGA','X')===d.replace('DD/MM/AAAA_NOVA','X'));"
```

---

## Passo 6 — Commit e push

**Corrigido em 15/08/2026: o push sai daqui.** O remote morto e o `origin`; existe um
remote `github` apontando para a URL real, que faz fetch E push:

```
git push github HEAD:main
```

Ate a v52 este passo dizia que o push era do dono, com `! git push origin main`. Era
verdade so para o `origin`, e cobrava do dono um passo que a skill podia fazer sozinha.

Depois do push, provar que subiu (cache de navegador engana, e md5 de CSS engana por
CRLF). Do push ate o worker servir o arquivo novo deu **~30 segundos**:

```
curl -s https://flat-resonance-09ba.pitstopimports.workers.dev/calc/consultor/dados.js | grep -o "validade\":\"[0-9/]*\""
```

Para provar mudanca de CODIGO da calc do dono, a URL e **`/calc/`**, nunca
`/calc/index.html`: o worker roda com fallback de SPA e a segunda devolve outra pagina,
sem erro nenhum.

---

## Passo 7 — Fechar

- Pedir ao dono para abrir `/calc/consultor/` (aba anonima ou conta do consultor),
  Ctrl+F5: selo verde `valida ate DD/MM/AAAA`, sem banner vermelho, e um pedido de teste
  copiando.
- Avisar o consultor: tabela nova no ar e ate quando vale.
- Atualizar a skill conforme a secao de auto-atualizacao do `SKILL.md`.

---

## Checklist

- [ ] estado vivo medido antes de mexer (banco, arquivo, git)
- [ ] **validade do consultor conferida logo no inicio** (ja venceu calado duas vezes)
- [ ] atraso do clone medido contra `github/main` ANTES de commitar
- [ ] pendencias listadas e resolvidas com o dono, zero chute
- [ ] diff aprovado antes de gravar
- [ ] `calc_dados` gravado, `atualizado_em` conferido
- [ ] `/calc/` sem barra vermelha
- [ ] `dados.js` derivado do MESMO blob
- [ ] `config.validade` reposta com data futura
- [ ] `node --check` passou
- [ ] commit feito e `git push github HEAD:main` executado
- [ ] `curl` no worker devolve a validade nova (e `/calc/` para mudanca de codigo)
- [ ] consultor avisado
- [ ] references atualizados se o caminho mudou

---

## Travas (nao negociaveis)

1. Linha nao entendida nunca vira preco.
2. Nada e gravado sem diff aprovado.
3. Variacao acima de 15% e mostrada uma a uma, nao agregada.
4. Fornecedor sem lista nova nao e apagado nem apresentado como atual.
5. Margem, comissao e taxa saem do `config`, nunca de numero fixo no codigo.
6. Validade do consultor reposta em toda rodada.
7. Ordem: banco primeiro, `dados.js` depois. Invertido, gera divergencia.
8. Deploy e provado por `curl` no worker, nunca por F5. O push sai da skill, pelo
   remote `github` (o `origin` e o proxy morto).
9. Aparelho com "mensagem" (aviso de peca nao genuina) e DESCARTADO antes de qualquer
   calculo de minimo. A loja nao revende. Ver a regra 5 de
   `references/formato-dados.md`, que explica por que descartar depois nao serve.

---

## Automacao ja desenhada (nao construida)

Duas etapas, nesta ordem, quando o dono mandar:

1. **`ferramentas/gerar_consultor.js`** — elimina a derivacao manual. O script loga no
   Supabase por email e senha (mesmo caminho GoTrue que a calc usa no navegador,
   credencial em variavel de ambiente, nunca no repo), le `calc_dados`, aplica a regra e
   escreve o `dados.js` com a validade passada por argumento:
   `node ferramentas/gerar_consultor.js --validade 07/08/2026`. Determinista, sem LLM,
   risco baixo.
2. **Importador de lista** — o mesmo parser deste procedimento virando codigo. A forma
   recomendada nao e o export em batch: e uma tela onde o dono cola a mensagem do
   fornecedor e ve na hora o que casou e o que nao casou, corrigindo com o contexto
   fresco. Batch sem revisao e onde um preco errado passa despercebido.

Nao construir sem pedido explicito. Esta area ja teve overbuild revertido na v39.
