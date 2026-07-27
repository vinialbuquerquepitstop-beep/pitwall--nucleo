# Mapa: onde cada calculadora vive

Medido em 27/07/2026. Atualizar este arquivo sempre que URL, arquivo, guard, RLS ou
deploy mudarem.

---

## A. Calc do dono — `/calc/`

- **URL**: `https://flat-resonance-09ba.pitstopimports.workers.dev/calc/`
- **Arquivo**: `public/calc/index.html` (1442 linhas, legivel, nao minificado)
- **Fonte do preco**: tabela `public.calc_dados` no Supabase (projeto
  `unjzpyexgtbcmjfgcqrx`), um blob JSONB por tenant.
- **Como sobe preco**: upsert SQL. **Nao tem deploy, nao tem push.** A pagina busca a
  tabela a cada carregamento; Ctrl+F5 basta.
- **Login**: proprio, `storageKey:'sb-calc-auth'`. Nao herda a sessao do painel Pit Wall,
  e o logout aqui nao desloga o painel.
- **Roteamento por papel** (`rotearPorPapel()`): le `app_usuario.papel` do proprio uid.
  `dono` fica e carrega os precos; qualquer outro papel, ou papel indefinido (default
  seguro), e redirecionado para `/calc/consultor/`.
- **Botao interno** (custo/margem): escondido para quem nao e `dono`
  (`esconderInternoSeNaoDono()`). Isso e cosmetico: o dado ja chegou no navegador e
  aparece no devtools. Esconder de verdade exigiria filtrar no backend, adiado
  conscientemente pelo dono na v39.
- **O que a tela faz**: menor custo por fornecedor, margem, avaliacao de usado com
  desconto de entrada, scanner de oportunidades (`hot` / `hist` / `comp`), reverso.

### RLS de `calc_dados`

- `authenticated` tem **so SELECT**, com `using (tenant_id = privado.fn_tenant_atual())`.
- Escrita e por service role (Dashboard/MCP). Nao existe caminho de escrita pela pagina.
- `CREATE OR REPLACE` em funcao/view reseta ACL: se mexer, refazer REVOKE/GRANT.

---

## B. Calc do consultor — `/calc/consultor/`

- **URL**: `.../calc/consultor/`
- **Arquivos**: `public/calc/consultor/index.html` (518 linhas) e
  `public/calc/consultor/dados.js` (~25 KB, uma linha `const DADOS = {...}`)
- **Fonte do preco**: o proprio `dados.js`, versionado no repo.
- **Como sobe preco**: editar o arquivo, commitar, `git push` na `main`. A Cloudflare
  publica sozinha (Workers Builds). Push E deploy.
- **Login**: guard de sessao no `index.html`, mesmo `storageKey` da `/calc/`. Sem sessao,
  redireciona para `/calc/` (que mostra a tela de login).
- **O que a tela faz**: busca de modelo, preco a vista e parcelado (2x a 18x), simulador
  de comissao por nivel (Embaixador / C1 / C2 / C3), fluxo de upgrade com entrada, e
  copia de pedido formatado para mandar no WhatsApp da loja.
- **Trava de validade**: `checkValidade()` compara `config.validade` com a data de hoje.
  Vencida, acende dois banners vermelhos, marca o selo e **bloqueia as quatro funcoes de
  copiar pedido** (`VENC=true`). Na pratica o consultor para de cotar. Repor a validade
  em toda rodada de atualizacao nao e opcional.

### Furo conhecido, ainda aberto

`.../calc/consultor/dados.js` e arquivo estatico servido pela Cloudflare e **nao passa
por RLS**. Medido em 27/07/2026: um `curl` sem sessao nenhuma devolveu o arquivo inteiro.
Quem souber a URL baixa a tabela de venda e a escada de comissao completa. Nao e o custo
de fornecedor (esse esta protegido desde a v39), mas e o mesmo tipo de furo. Fechar exige
mover o blob para o Supabase atras de RLS, como ja foi feito com o custo. Nao decidido.

---

## C. Netlify (`calculadora-pitstop`) — APOSENTADA

Decisao do dono em 27/07/2026: nao usa mais. **Nao alimentar.**

Sobra uma acao de seguranca que parar de usar nao resolve: enquanto o site seguir
publicado, o `dados.js` publico de la continua expondo **custo de fornecedor** sem login
nenhum. Despublicar o site (ou tornar o repo privado e deletar o deploy) encerra o
vazamento. E clique no painel da Netlify, fora do alcance do Claude Code.

---

## Usuarios e acesso

`public.app_usuario` em 27/07/2026:

| Nome | Papel | Uid |
|---|---|---|
| Albuquerque | `dono` | `fb2aad8e-b728-4e59-a198-71da2156449d` |
| Brendon | `vendedor` | `130353b1-64da-4ed4-b766-776261191a99` |

Para criar acesso novo de colaborador: Supabase > Authentication > Add user (email e
senha), depois

```sql
insert into public.app_usuario (id, tenant_id, nome, papel, ativo)
values ('<uid novo>', '00000000-0000-0000-0000-000000000001', '<nome>', 'vendedor', true);
```

O CHECK de `papel` aceita `dono` e `vendedor`. O papel `parceiro` foi criado e revertido
na v39: nao recriar sem o dono pedir.

---

## Deploy e prova

- Git e a fonte da verdade; a Cloudflare publica no push. O `name` no `wrangler.jsonc`
  (`flat-resonance-09ba`) tem que bater com o Worker no painel.
- O `origin` do clone local aponta para um proxy morto (`127.0.0.1:41729`): `git push`
  daqui falha. O dono empurra com o prefixo `!` no prompt.
- "Nao esta no ar" quase sempre e cache do navegador. Provar com `curl` no worker, nao
  com F5.
