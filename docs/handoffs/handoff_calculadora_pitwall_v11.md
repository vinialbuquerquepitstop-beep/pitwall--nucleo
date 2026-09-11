# Handoff — Calculadora como produto, v11

Data: 11/09/2026. Linha `calculadora`. **Topo da linha.** Substitui o v10, que e da
MESMA sessao e continua valendo para o `2.4a zero` (o cabecalho na pendencia e a
regra da condicao).

Escrito para uma sessao comecando **fria**. Tudo abaixo foi medido nesta sessao.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao. Valores reais do
sistema aparecem exatos.

---

## 0. Leia nesta ordem

1. `CLAUDE.md`.
2. `docs/calculadora/PROCESSO.md`.
3. Este arquivo.
4. O v10, secoes 3 e 6: o `2.4a zero` e as armadilhas medidas ali.
5. O plano, secao 2.4 (`2.4a zero bis`) e as decisoes **D14, D15 e D16**.

---

## 1. O que esta fatia entregou (`2.4a zero bis`)

**A pergunta de condicao virou resposta.** Ate aqui o leitor PERGUNTAVA ("qual a
condicao do Junior nesta lista?") e a unica saida era `ignorar`: as linhas ficavam
fora da tabela. Agora o dono responde, e elas entram.

| | Antes | Depois |
|---|---|---|
| fixture C (`junior` sem condicao) | 0 de 4 na tabela, sem resposta possivel | 2 de 4, respondendo `Lacrado` uma vez |
| fixture D (as cinco perguntas) | 11 de 16 | **16 de 16** com as cinco respondidas |
| `descartar` em pergunta de condicao | recusado **por acaso** (a G3 pegava) | recusado com motivo (trava T4) |
| assercoes da prova | 75 | **89** |

**Nada de tela.** Esta fatia e de banco. A tela `Alimentar` segue esperando.

Migration: `supabase/migrations/20260911_calc_parse_respostas_de_condicao.sql`,
version `20260911100937`, aplicada pelo `base`. Gerada por script a partir dos
DOIS corpos vivos (leitor e resolver), 19 trocas que tinham que achar o trecho
exatamente uma vez. Script de record: `gera_respostas.py` no scratchpad da sessao,
e o que ele faz esta descrito no cabecalho da migration.

### O desenho, em quatro frases

1. **`definir` e o verbo novo** (`calc_pendencia.decisao`, DDL no check). So vale
   em pendencia de `condicao`, so com condicao ATIVA do tenant e grafia exata
   (`CPO`, `Lacrado`, `Seminovo`). **Nao escreve no catalogo:** fica na propria
   pendencia, vale para AQUELA carga, pode ser trocada e desfeita com `ignorar`.
   E a D14 ao pe da letra: a resposta nunca vira padrao silencioso.
2. **O leitor recebe as respostas** como mapa `texto da pergunta -> condicao`:
   `privado.calc_parse_v2(uuid, text, jsonb default '{}')`. Ela so preenche linha
   SEM condicao lida: nunca troca a que a lista escreveu.
3. **A chave da pergunta virou coluna** (`cond_chave`), lida nos dois lugares: na
   hora de perguntar e na hora de aplicar a resposta. Com duas expressoes
   separadas, bastaria uma divergir para a resposta nunca pegar e a pergunta
   voltar para sempre.
4. **O resolver passa TODAS as respostas da carga a cada releitura.** Era a
   armadilha da fatia (secao 4).

---

## 2. A decisao do dono nesta sessao (D16)

**`descartar` numa pergunta de FORNECEDOR: MANTER.** Resposta citada exata: *"a"*,
com a recomendacao da Torre. Registro completo no plano.

O que ela significa: um clique tira o BLOCO INTEIRO daquele fornecedor desta lista
e de TODA lista futura (grava `calc_regra` de descarte com o texto do cabecalho).
As linhas vao para `n_descarte`, contadas: nao e perda silenciosa. **Obrigacao que
a decisao cria para a tela `Alimentar`:** o botao diz por extenso *"nunca mais ler
preco deste fornecedor, em nenhuma lista"*, com `ignorar` (so nesta lista) ao lado.
Enquanto a 2.4c (desfazer) nao existir, e um clique sem volta.

A combinacao passou a ter assercao com nome: **R14**. Se um dia virar recusa, e ela
que muda, nao so um numero de mensagem.

Efeito colateral fechado junto: `descartar` em pergunta de CONDICAO agora e recusado
com motivo (T4). O texto dela e o `codigo` do fornecedor, entao descarta-la levava ao
mesmo efeito da D16 por uma pergunta que era so "qual a condicao".

---

## 3. Prova

`ferramentas/prova_calc_parse.sql`, 86948 bytes, md5
`191bc333831c1e9e4626fb5bbc399784`, rodada pela `bandeira`:

```
PASSOU: 89 assercoes, 0 falhas
  fixture A (formato linha), v2: lidas=18 casou=13 duvidoso=4 nao_reconhecido=1 descarte=2 cobertura=72.2%
  fixture B (formato bloco), v2: lidas=12 casou=11 duvidoso=0 nao_reconhecido=1 cobertura=91.7%
  fixture B (formato bloco), v1: casou=0 de 12 (o v1 nao le bloco, por desenho)
  fixture C (dia 1), v2: lidas=4 casou=0 pendencias=condicao "junior", fornecedor "TABELA XPTO IMPORTS"
  fixture D (condicao), v2: lidas=16 casou=11 perguntas de condicao=5
  resolver: 6 respostas aceitas (todas ensinaram), 15 recusadas com motivo declarado, 0 aceitas caladas
  respostas de condicao (D14): fixture C casou 0 -> 2 com "junior" = Lacrado; fixture D 11 -> 16 de 16 com as 5 respondidas
```

Limpeza medida ANTES e DEPOIS (para "0 depois" significar "nada gravado", e nao "ja
era 0"): `cargas=0, pendencias=0, aliases_tenant=61, semente_prova=0,
regras_aprendidas=0`, e a regra `tabela xpto imports` da R14 tambem voltou a 0.

**A secao R, em uma linha cada:** R1 a resposta pega; R2 ela sobrevive a resposta
seguinte; R3 trocar a resposta; R4 `ignorar` desfaz; R5 condicao inexistente
recusada; R6 `definir` fora de condicao recusado; R7 a trava T4; R8 T3 fora de
rascunho; R9 a lista seguinte pergunta de novo e a sugestao volta; R10 linha mista
e uma resposta por linha; R11 fixture D 16 de 16; R12 o leitor recusa valor invalido
vindo direto; R13 sem sobrecarga e sem grant em `privado`; R14 a D16 nomeada.

### Duas coisas que melhoraram no METODO da prova

- **O md5 do arquivo passou a ser conferido DENTRO do banco, por construcao.** A
  `bandeira` envolveu o arquivo num `do $bandeira$ ... $arq$<arquivo>$arq$ ...
  execute q; end` que so executa depois de o proprio Postgres confirmar
  `md5(q) = 191bc...` e `octet_length(q) = 86948`. Conferir em duas chamadas
  separadas nao prova que o texto executado e o conferido.
- **O esperado de 89 saiu do `grep -c 'v_total := v_total + 1;'` no arquivo**, nao
  do briefing da Torre. E a regra que o v10 ja tinha escrito, agora aplicada pelo
  lado de quem prova.

---

## 4. A armadilha desta fatia, e ela quase passou

**O resolver rele a lista INTEIRA a cada resposta, de qualquer tipo.** Se ele
passasse ao leitor so a resposta do momento, a resposta seguinte (um `apontar` de
modelo, um `descartar`) relia sem as respostas de condicao ja dadas, e cada linha
respondida voltava para duvidoso, **calada**: a cobertura cairia sozinha entre dois
cliques do dono. Por isso o resolver monta o mapa com TODAS as respostas `definir`
daquela carga a cada chamada, e a assercao R2 cobra exatamente essa sequencia.

**Divida declarada, e ela e da mesma familia:** nao existe guarda no resolver contra
QUEDA de `n_cond_respondida` ou de `n_casou` numa releitura. A G2 cobra conservacao
de linhas; a G3 so olha a pendencia do momento; a G4 ("resposta aceita nunca derruba
a cobertura") vive **so na matriz da prova**, nunca em execucao. A `bandeira` mediu
os dois caminhos possiveis hoje e nenhum se realiza, mas **a defesa e circunstancial,
nao estrutural**. Vetor para o dia em que mudar: gravar `definir` numa pergunta por
fornecedor, responder algo que reatribua aquelas linhas, e assertar
`n_cond_respondida` antes e depois.

---

## 5. Estado vivo, medido em 11/09/2026 (depois desta fatia)

| Funcao | md5 | len |
|---|---|---|
| `privado.calc_parse_v2(uuid, text, jsonb)` | `3b5338e92f74e84e8def43ca2d77d02b` | 34483 |
| `public.calc_pendencia_resolver` | `2efc6bd94b3600b060079254c27f4f58` | 10448 |
| `public.calc_carga_abrir` (intocada) | `6a1176e94c4b5117e3bb0b3ca9ff3b76` | 3957 |
| `privado.calc_parse` (v1, intocado) | `f74503007e8e373ce2997b54c249c84c` | 19746 |

- ACL do leitor depois do DROP + CREATE: `{postgres=X/postgres}`. **Sem grant para
  `authenticated`, `anon` ou `service_role`: e desenho**, a barreira de papel mora
  nas RPCs de `public` (memoria `parse-v2-sem-grant-e-desenho`).
- Sem sobrecarga de `calc_*` em `public` nem em `privado`.
- `calc_pendencia_decisao_ck`: `apontar`, `descartar`, `ignorar`, `definir`.
- Contagens: 125, 40, 17, 0, 61 (modelos semente, aliases semente, fornecedores,
  cargas, aliases do tenant).
- **Advisors de seguranca: 8**, sem entrante. A composicao REAL, medida hoje, e
  diferente da que o `PROCESSO.md` descreve: sao **CINCO** `calc_*` com
  `SECURITY DEFINER` e grant a `authenticated` (`calc_carga_abrir`,
  `calc_carga_aprovar`, `calc_carga_descartar`, `calc_config_margem_salvar`,
  `calc_pendencia_resolver`), mais `registrar_venda`, `remover_nf` e o leaked
  password. O texto do PROCESSO fala em quatro; o total de 8 sempre bateu porque o
  quinto entrou no lugar do que se chamava "o oitavo".

---

## 6. A consulta da SUGESTAO, que a tela vai usar

A D14 manda perguntar em TODA lista, com a resposta anterior **pre-selecionada**. A
resposta anterior nao se aplica sozinha: ela se le. A consulta, provada na R9:

```sql
select q.aponta
  from public.calc_pendencia q
 where q.tenant_id = privado.fn_tenant_atual()
   and q.tipo = 'condicao' and q.texto = $1        -- o texto da pergunta de agora
   and q.decisao = 'definir' and q.carga_id <> $2  -- a carga aberta agora
 order by q.decidido_em desc
 limit 1;
```

Pela RLS, o dono le `calc_pendencia` direto: nao precisa de RPC nova para isso.

**Armadilha para a tela, medida e NAO consertada:** `calc_pendencia` guarda
historico (invariante 6), e a pendencia que some depois de uma resposta NAO e
apagada. Entao "pendencia aberta" nao e `decisao is null`: e `decisao is null` **e**
ainda estar na ultima leitura. `calc_carga_aprovar` conta `decidido_em is null` e
devolve `pendencias_abertas`, que pelo mesmo motivo pode contar pergunta que ja nao
existe. Decidir na fatia da tela, e provar.

---

## 7. O que NAO foi provado

- **Isolamento das RPCs contra vendedor e contra tenant errado.** A prova roda
  inteira com o `sub` do dono. Pendencia desde o v9. Vetor: repetir a matriz da
  secao G com `sub` de vendedor e com `sub` inexistente, exigindo recusa por papel.
- **A regra da condicao e as respostas numa lista REAL do mes.** As fixtures sao
  sinteticas (restricao 8). Segue valendo o aviso do v10: dois apelidos do `fmata`
  carregam condicao no proprio texto, entao linha sem condicao sob eles herda.
- **A migration contra o banco linha a linha.** O que foi conferido sao os md5 dos
  corpos vivos contra os do disco, nos dois sentidos (antes e depois).
- Suite de frontend: nada em `public/` mudou.

---

## 8. O proximo passo

| # | Item | Trava | Peso |
|---|---|---|---|
| 1 | `2.4a` `criar` (`calc_catalogo_criar`), `ter` quase-igual, `quater` origem | a tela | o grosso |
| 2 | A tela `Alimentar` (com a frase por extenso da D16 e a sugestao da secao 6) | o portao do Bloco 2 | grande |
| 3 | Isolamento vendedor/tenant na secao G | passe de seguranca da fatia | pequeno |
| 4 | Guarda de queda de `n_cond_respondida` / `n_casou` no resolver (secao 4) | nada hoje | pequeno |
| 5 | Derrubar o v1 | o portao do Bloco 2 | pequeno |

O portao do Bloco 2 continua o mesmo: **o dono roda a carga do mes pela tela,
sozinho, sem Claude Code** (D7).

---

## 9. O que continua verdade

- Invariante 17; restricao 8 (fixtures sinteticas, precos inventados).
- `privado.calc_parse_v2` sem grant para `authenticated` e DESENHO.
- Nao criar FK de `calc_*` para tabela de operacao.
- Nao deixar linha nao entendida virar preco, nem sumir. Condicao que nao esta clara
  nao vira preco: vira pergunta (D14/D15), e agora a pergunta tem resposta.
- `create or replace` PRESERVA dono e ACL; quem reseta e `DROP` + `CREATE`, que e o
  caminho obrigatorio para mudar assinatura. Esta fatia foi o primeiro `drop` desde
  a correcao, e a ACL foi conferida depois.
