# Processo: atualizar as calculadoras

Escrito em 27/07/2026. Estado medido nesta data, nao lembrado.

> Este documento e a versao para LER. A fonte operacional de record e a skill
> `.claude/skills/calculadoras/`, que o Claude carrega sozinho quando voce cola uma lista
> de fornecedor. Se os dois divergirem, a skill esta certa: e ela que tem a regra de
> auto-atualizacao a cada mudanca.

---

## 1. Mapa: quais calculadoras existem

| # | Onde | Quem entra | Fonte do preco | Como sobe | Mostra custo? |
|---|------|-----------|----------------|-----------|---------------|
| A | `flat-resonance-09ba.pitstopimports.workers.dev/calc/` (Cloudflare) | so papel `dono` | tabela `public.calc_dados` no Supabase (blob JSONB) | SQL no Dashboard. **Sem push, sem deploy** | Sim (custo de fornecedor, margem, scanner) |
| B | `.../calc/consultor/` (Cloudflare) | papel `vendedor` (qualquer papel != dono cai aqui) | arquivo `public/calc/consultor/dados.js` no repo | `git push` na `main` (Cloudflare publica sozinha) | Nao. So preco de venda (`pv`/`pp`) e comissao |
| C | Netlify, repo `calculadora-pitstop` (PUBLICO) | ninguem: sem login | `dados.js` publico do repo | **APOSENTADA** em 27/07/2026 por decisao do dono: nao usa mais | Sim, e **sem login** — vazamento ainda aberto enquanto a pagina existir |

Roteamento: quem loga em `/calc/` e nao e `dono` e redirecionado para `/calc/consultor/`
(`rotearPorPapel()`, `public/calc/index.html`). As duas dividem a mesma sessao
(`storageKey:'sb-calc-auth'`), que nao e a sessao do painel Pit Wall.

Usuarios ativos hoje (`public.app_usuario`): Albuquerque = `dono`, Brendon = `vendedor`.

---

## 2. Estado medido em 27/07/2026

- `calc_dados`: 340 linhas de produto (produto x fornecedor), `atualizado_em` = **21/07/2026**.
  Config: `d` 300, `iav` 550, `ipc` 650, `mav` 1200, `mpc` 1300.
- `public/calc/consultor/dados.js`: 103 combinacoes modelo+condicao, `config.validade` =
  **18/07/2026**.
- **A tabela do consultor esta VENCIDA ha 9 dias.** Com `validade` no passado, a calc do
  consultor acende os dois banners vermelhos ("Tabela vencida. Nao cote e nao feche"),
  marca o selo como `vencida em 18/07/2026` e **bloqueia copiar pedido** (`VENC=true`
  barra as quatro funcoes de fechamento). Na pratica o Brendon nao consegue cotar hoje.
- Os precos em si estao alinhados: conferi as 103 combinacoes contra o custo do banco e
  **103/103 batem** com a regra da secao 3 (zero divergencia). O problema e so a data.

---

## 3. Regra de derivacao (provada, nao suposta)

A calc do consultor e derivavel 100% da tabela de custo do banco:

```
pv (a vista)     = menor custo daquela cor entre todos os fornecedores + margem a vista
pp (parcelado)   = mesmo menor custo                                   + margem parcelado
margem a vista   = 550  (iPhone, iPad, Apple Watch)   |  1200 (MacBook, Mac Mini)
margem parcelado = 650  (iPhone, iPad, Apple Watch)   |  1300 (MacBook, Mac Mini)
```

Prova pontual: Apple Watch S11 46mm Jet Black, menor custo 2399 (Junior) -> `pv` 2949,
`pp` 3049. Rose, menor custo 2599,99 (MP Imports) -> `pv` 3149,99.
Prova agregada: 103 de 103 combinacoes com o menor `pv` igual a custo minimo + margem.

O que NAO vem do banco e vive so no `dados.js` do consultor: `config.validade`,
`config.pb` (100, acrescimo aplicado no parcelado), `config.taxas` (2x a 18x) e
`config.comissao` (escada Embaixador / C1 / C2 / C3 por categoria e por condicao).
Acessorios ficam de fora da calc do consultor.

---

## 4. Passo a passo A — atualizar a SUA calc (`/calc/`, custo)

Frequencia: sempre que chegar lista nova de fornecedor.

1. Montar o blob `{config, bateria, tela, produtos}` completo, no formato que a calc ja
   consome. Cada produto precisa de `n` (nome), `f` (fornecedor), `l` (local), `c`
   (categoria), `t` (`Lacrado` ou `Seminovo`) e preco: `v` numerico > 0, **ou** `cs` com
   cores `{n, h, v}`. `bateria` e `tela` precisam existir como array, mesmo vazio.
   Se qualquer item falhar, a calc mostra a barra vermelha e **nao exibe preco nenhum**
   (`validarDados`, `public/calc/index.html:1297`).
2. Supabase Dashboard > SQL Editor (voce e dono do projeto, roda como service role):

```sql
insert into public.calc_dados (tenant_id, dados) values (
  '00000000-0000-0000-0000-000000000001',
  $j$
  { ... COLE AQUI O OBJETO INTEIRO ... }
  $j$::jsonb
)
on conflict (tenant_id) do update
  set dados = excluded.dados, atualizado_em = now();
```

3. Conferir que gravou (mesma janela do SQL Editor):

```sql
select atualizado_em,
       jsonb_array_length(dados->'produtos') as n_produtos,
       dados->'config' as config
  from public.calc_dados;
```

4. Abrir `/calc/` logado como dono e dar **Ctrl+F5**. Sem barra vermelha e com dois
   precos conferidos na tela = subiu. Nao precisa de push nem de deploy: a pagina le a
   tabela a cada carregamento.

Armadilha: `authenticated` so tem `SELECT` em `calc_dados` (invariante 9). Escrita so
pelo Dashboard/service role. Nao tente gravar pela pagina.

---

## 5. Passo a passo B — atualizar a calc do CONSULTOR (`/calc/consultor/`, venda)

Frequencia: junto com a A, sempre. Se voce atualizar so a A, o consultor cota com preco
velho; se so mexer na A e nao repor a validade, ele nao cota nada.

1. Terminar o passo A primeiro. O custo do banco e a fonte; o `dados.js` do consultor e
   derivado. Ordem invertida gera divergencia.
2. Editar `public/calc/consultor/dados.js`. Para cada modelo+condicao (sem Acessorio),
   por cor: `pv` = menor custo + 550 (ou 1200 em MacBook/Mac Mini), `pp` = menor custo +
   650 (ou 1300). Manter `h` (hex da cor) e `n` (nome da cor) como estao.
3. **Repor `config.validade`** com a data nova em `dd/mm/aaaa`. Este e o campo que mais
   morre esquecido, e o unico que trava a calc inteira.
4. Se a comissao ou as taxas de cartao mudaram, ajustar `config.comissao` e
   `config.taxas` no mesmo arquivo.
5. Validar antes de empurrar (a suite Python do repo NAO cobre a calc; e node mesmo):

```
node --check public/calc/consultor/dados.js
node -e "const D=new Function(require('fs').readFileSync('public/calc/consultor/dados.js','utf8')+'; return DADOS;')(); console.log(D.produtos.length,'produtos | validade',D.config.validade); if(!/^\d{2}\/\d{2}\/\d{4}$/.test(D.config.validade))throw new Error('validade em formato errado');"
```

6. Commitar e empurrar (a Cloudflare publica no push):

```
git add public/calc/consultor/dados.js
git commit -m "feat(calc): tabela do consultor valida ate DD/MM/AAAA"
git push
```

Se o `git push` falhar por proxy morto, empurre pelo prefixo `!` no prompt.

7. Conferir que subiu de verdade (cache de navegador engana):

```
curl -s https://flat-resonance-09ba.pitstopimports.workers.dev/calc/consultor/dados.js | grep -o "validade\":\"[0-9/]*\""
```

8. Abrir `/calc/consultor/` logado como o Brendon (ou aba anonima), Ctrl+F5: selo verde
   `valida ate DD/MM/AAAA`, sem banner vermelho, e um pedido de teste copiando.
9. Avisar o consultor que a tabela nova esta no ar e ate quando vale.

---

### Aviso: a calc do consultor tambem vaza, em menor grau

Medido em 27/07/2026 com este comando, **sem sessao nenhuma**:

```
curl -s https://flat-resonance-09ba.pitstopimports.workers.dev/calc/consultor/dados.js
```

Devolveu o arquivo inteiro. O login do `/calc/consultor/` e guarda de TELA
(`index.html` checa a sessao e redireciona), mas o `dados.js` e arquivo estatico servido
pela Cloudflare e nao passa por RLS. Ou seja: quem souber a URL baixa a tabela de preco
de venda e **a escada de comissao inteira** (Embaixador / C1 / C2 / C3), sem logar.
Nao e o custo de fornecedor, entao e menos grave que o caso da Netlify, mas e o mesmo
tipo de furo. Fechar exige mover esse blob para o Supabase atras de RLS, como ja foi
feito com o custo. Nao esta no escopo deste documento; fica anotado como decisao pendente.

---

## 6. Netlify (`calculadora-pitstop`) — APOSENTADA

Decisao do dono em 27/07/2026: **nao usa mais**. Nao alimentar. As calculadoras ativas
sao so a A (`/calc/`) e a B (`/calc/consultor/`).

Sobra uma acao de seguranca, porque parar de usar nao apaga a pagina: enquanto o site da
Netlify estiver publicado, o `dados.js` com custo de fornecedor continua baixavel por
qualquer um. Despublicar o site na Netlify (ou tornar o repo privado e deletar o deploy)
encerra o vazamento. Nao alcanço esse repo a partir daqui: e clique seu no painel.

Pendencia aberta desde a v39, e ela e de seguranca, nao de conforto: esse `dados.js` e
**publico e tem custo de fornecedor**. Qualquer pessoa com o link baixa sua tabela de
custo sem login. Enquanto essa calc existir do jeito que esta, manter tres tabelas em dia
custa trabalho E mantem o vazamento aberto. As duas saidas honestas sao: (a) aposentar a
Netlify agora que a `/calc/` faz o mesmo atras de login, ou (b) trocar o `dados.js` de la
por fixture falso e mandar a pagina ler o Supabase. Decisao sua.

---

## 7. Checklist de fechamento (o ciclo inteiro)

- [ ] Blob de custo gravado em `calc_dados`, `atualizado_em` conferido no SELECT
- [ ] `/calc/` abre logada como dono, sem barra vermelha, 2 precos conferidos
- [ ] `dados.js` do consultor regenerado a partir do MESMO blob
- [ ] `config.validade` reposta com data futura
- [ ] `node --check` passou
- [ ] push feito e `curl` no worker devolve a validade nova
- [ ] `/calc/consultor/` com selo verde e pedido de teste copiando
- [ ] consultor avisado

---

## 8. O que da para automatizar (nao construido, decisao do dono)

Hoje o passo 5.2 e digitacao a mao de 103 modelos ja calculaveis. Como a regra da secao 3
esta provada, um `ferramentas/gerar_consultor.js` leria o blob de `calc_dados`, aplicaria
menor custo + margem por cor, receberia a validade como argumento e escreveria o
`dados.js` inteiro. O ciclo viraria: atualizar o banco -> rodar um comando -> push.

Isso mata a divergencia por digitacao e o esquecimento da validade de uma vez. Nao foi
construido porque a v39 ja teve overbuild revertido nesta area: so entra se voce pedir.
