# Concorrencia, tendencias do nicho e pauta da semana seguinte

Processo das tres funcoes da frente Social que nao vem do Metricool (SKILL.md,
frente 2, itens b/c/d). Diferente do resto da auditoria, a evidencia aqui e
pesquisa, nao numero medido — declarar isso no relatorio, nunca disfarcar de dado
duro (ver `formato-relatorio.md`, secoes 3b/3c/3d).

## Limite real: o que da pra medir e o que nao da

Instagram bloqueia leitura de feed de terceiros sem login: WebSearch e WebFetch NAO
entregam o feed real de um perfil, so o que ficou indexado (mencao publica, noticia,
as vezes uma legenda que vazou pra busca). Nao escrever "o concorrente postou X essa
semana" como se fosse observacao direta do feed quando na pratica veio de um
resultado de busca generico. Se a pesquisa nao trouxer nada especifico do perfil,
registrar isso explicitamente ("busca nao retornou post especifico desta semana
para @X") em vez de inventar tema so pra preencher a secao.

## b. Concorrentes diretos (lista herdada de `socialmedia`)

- `@blackapplerj`
- `@tigraoimports`
- `@smart.especializadaapple`
- `@voce_deiphone`

Pesquisar (WebSearch) por sinais indiretos, ja que o feed direto e opaco:
- `<perfil> instagram` e `<perfil> pitstop OR apple OR iphone` — mencao publica,
  reels ou posts que vazaram pra indexacao, cobertura fora do Instagram.
- Nome comercial do concorrente + `promocao` OU `lancamento` + mes/ano atual.

Registrar por concorrente: o que foi encontrado (com fonte/link) ou "nada indexado
essa semana" — nunca deixar em branco sem dizer que foi checado.

## c. Assuntos em alta no nicho

Pesquisar antes de sugerir qualquer pauta:
- `iphone OR macbook OR apple lancamento <mes/ano atual> brasil` — noticia real da
  semana.
- MacRumors, 9to5Mac, MacWorld para rumor ou lancamento confirmado (mesma fonte que
  a skill `socialmedia` usa pro calendario Apple).
- Cambio dolar/importacao na semana, se for tema — afeta preco, e gatilho real de
  conteudo, nunca urgencia falsa.
- Formato dominante da semana (unboxing, comparativo, bastidor) — o que aparece
  repetido nas buscas acima e nos achados da secao (b).

## d. Pauta pra semana seguinte

Depois de (b) e (c), montar 2 a 4 sugestoes de assunto ou dica. Para cada uma:

1. Ler os Vetores ativos no periodo. **Fonte preferencial: a pagina Notion
   🎯 Vetores de Campanha · Conteudo IG (id `38e80e29017e819aa860c0cf3b651082`,
   dentro de 🏁 Pitwall · Central de Conteudo), via `notion-fetch`.** Confirmado em
   20/07/2026 que essa pagina espelha exatamente a aba `Vetores` da planilha
   (mesma Semana/Periodo/Gancho/Ancora/Pecas/Trava/Status linha a linha) — como a
   rotina ja tem conector Notion, nao precisa de Google Drive/Sheets pra essa
   checagem. So cair pro Google Sheets direto (contrato em
   `pitwall-conteudo/references/vetores-estrategia.md`) se essa pagina Notion nao
   existir mais ou divergir da planilha — nesse caso, citar a divergencia como
   achado, nao so seguir uma fonte calada.
2. Testar a sugestao contra os Vetores ativos: ela reforca um Vetor existente (citar
   o nome exato do Vetor) ou e pauta fora da linha atual?
3. Se for fora da linha atual, marcar explicitamente como tal no relatorio — quem
   decide abrir Vetor novo e o dono, nao a auditoria (mesma regra de `SKILL.md`:
   "audita e registra, nao edita o Calendario nem os Vetores por conta propria").

Formato de cada sugestao no relatorio:
```
[Assunto ou dica] — gatilho: [concorrente / tendencia / calendario Apple]
  Vetor: [nome exato do Vetor ativo que reforca] OU "fora dos Vetores atuais"
```

## Por que isso e funcao fixa, nao extra opcional

Uma auditoria Social que so olha Metricool ve o proprio umbigo: numero sem contexto
de mercado nao diz se o ritmo esta certo ou se o nicho inteiro mudou de assunto. As
quatro funcoes da frente Social (numeros, concorrencia, tendencia, pauta) rodam toda
vez que a frente Social entra na auditoria — semanal, ou pontual quando o pedido for
"audita o Instagram" ou equivalente amplo.

Pontual sobre um recorte mais estreito (ex: "por que o alcance caiu essa semana")
pode pular (b)/(c)/(d) se o pedido for so sobre o numero — mas declarar isso
explicitamente no relatorio ("pauta e concorrencia nao verificadas nesta rodada
pontual, fora do escopo pedido"), nunca omitir em silencio.
