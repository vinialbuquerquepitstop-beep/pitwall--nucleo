# Handoff — Calculadora como produto, v9

Data: 11/09/2026. Linha `calculadora`. **Topo da linha.** Substitui o v8.

Escrito para uma sessao comecando **fria**. Tudo abaixo foi medido nesta sessao.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao. Valores reais do
sistema aparecem exatos.

---

## 0. Leia nesta ordem

1. `CLAUDE.md`.
2. `docs/calculadora/PROCESSO.md`.
3. Este arquivo.
4. `docs/superpowers/specs/2026-09-10-aprendizado-de-fornecedor.md`, **com a secao
   7b nova**, que registra o que esta sessao contradisse nela.
5. O plano, secao `2.4`, que ganhou a ordem interna nova e o item `2.4a zero`.
6. O v8 so para o historico da promocao do v2.

---

## 1. O que esta sessao fez, em uma frase

**A 2.4a bis fechou, e maior do que a spec pedia:** o laco de aprendizado para de
aceitar resposta calada. Toda resposta do dono agora ou ENSINA ou e RECUSADA com
motivo.

| Peca | Onde |
|---|---|
| migration aplicada | `supabase/migrations/20260911_calc_resolver_nada_calado.sql` (version `20260911063536`) |
| prova | `ferramentas/prova_calc_parse.sql`, fixture C e secoes F e G |
| spec corrigida | secao 7b de `2026-09-10-aprendizado-de-fornecedor.md` |
| plano corrigido | secao 2.4: ordem interna nova e o item `2.4a zero` |

**Nada de tela.** A fatia e de banco, e a tela `Alimentar` segue esperando a 2.4
(decisao do v8, que esta sessao reforca: ver secao 4).

---

## 2. A medicao que mudou o escopo

A `calc_pendencia_resolver` nunca tinha sido CHAMADA (v8, secao 9: provada so na
estrutura). Esta sessao a chamou com a identidade do dono, com as fixtures A e B da
prova mais uma terceira (C, o dia 1 em miniatura), cada decisao numa subtransacao e
tudo desfeito no fim. **21 combinacoes** (7 pendencias x 3 respostas), medidas ANTES
de escrever qualquer coisa:

| Pendencia | apontar valido | apontar inexistente | descartar |
|---|---|---|---|
| `modelo` linha normalizada (Poco) | ensina (13 -> 14 de 18) | **linha evapora** | ensina |
| `modelo` cabecalho com emoji (Zeta) | ensina (11 -> 12 de 12) | **linha evapora** | aceita, nao ensina |
| `cor` `verde menta` | aceita, nao ensina | aceita, nao ensina | ensina |
| `preco` (duas causas) | recusava | recusava | aceita, nao ensina |
| `condicao` sentinela | aceita, nao ensina | aceita, nao ensina | aceita, nao ensina |
| `fornecedor` sentinela | aceita, nao ensina | aceita, nao ensina | aceita, nao ensina |

"Aceita, nao ensina" = grava em `calc_alias` ou `calc_regra`, devolve sucesso, e a
MESMA pendencia volta ao reler a lista. O dono responderia, veria a pergunta de novo
no mes seguinte e concluiria que o produto nao funciona.

**"Linha evapora" e o caso que a spec descrevia, e ele e PIOR do que ela dizia.** A
spec (3.1) dizia que a linha fica "fora e sem explicacao". Medido numa lista de 3
linhas:

```
antes   lidas=3 casou=1 duvidoso=0 nao_reconhecido=2 pendencias=2
depois  lidas=3 casou=1 duvidoso=0 nao_reconhecido=0 pendencias=0
```

Duas linhas saem de TODAS as pilhas. A carga fica com zero pendencias, pronta para
aprovar, e o blob sai sem os dois produtos. **Quarta aparicao da perda silenciosa
neste projeto** (as outras: AirPods ANC em 09/09, emoji colado em 10/09, preco com
ponto decimal em 09/09).

---

## 3. O que a migration faz

Tres guardas GERAIS, que nao dependem de saber qual combinacao falha:

| Guarda | Onde | O que recusa |
|---|---|---|
| **G1** destino existe | resolver | `apontar` para codigo fora do catalogo DO TENANT (a semente conta como inexistente, D5) |
| **G2** conservacao | resolver **e** `calc_carga_abrir` | leitura em que `n_lidas <> n_casou + n_duvidoso + n_nao_reconhecido` |
| **G3** a resposta ensina | resolver | `apontar`/`descartar` depois do qual a mesma (`tipo`, `texto`) volta a ser pendencia |

E tres travas, cada uma de um fato medido:

| Trava | Por que |
|---|---|
| **T1** `apontar` em `condicao` recusa | o leitor (v1 e v2) le condicao so de `calc_regra`, nunca de `calc_alias`. Os **9 apelidos de condicao** do tenant sao dado morto (nao apagados: decisao do dono) |
| **T2** pendencia ja respondida nao se responde de novo | o segundo `descartar` duplicava regra; o segundo `apontar` estourava a unique com mensagem de banco |
| **T3** `apontar`/`descartar` exigem carga em `rascunho` | fora dele o `texto_bruto` ja foi apagado e nao ha contra o que provar G2 e G3. Antes, a RPC gravava o apelido e devolvia `reprocessou=false`: ensinava sem prova. `ignorar` segue aceito em qualquer estado |

**A G2 foi para o `calc_carga_abrir` tambem, e isso tem um custo que o dono precisa
saber:** se o leitor tiver defeito de contagem numa lista REAL, a carga nao abre (a
mensagem diz que o defeito e do leitor, nao da lista). Nas tres fixtures a conta
fecha. **Numa lista real ainda nao foi medido.** A troca e deliberada: travar ruidoso
ganha de perder produto calado.

Efeito para o dono: o que ensinava continua ensinando (a assercao G6 cobra as quatro
combinacoes pelo nome). O que era aceito sem ensinar passa a ser recusado com uma
frase. A tela `Alimentar` herda a regra: onde a resposta nao ensina, a saida e
`ignorar`.

### Prova

`ferramentas/prova_calc_parse.sql`, rodada pela `bandeira`, arquivo inteiro do disco
(1125 linhas, com comentarios):

```
PASSOU: 66 assercoes, 0 falhas
  fixture A (formato linha), v2: lidas=18 casou=13 duvidoso=4 nao_reconhecido=1 descarte=2 cobertura=72.2%
  fixture B (formato bloco), v2: lidas=12 casou=11 duvidoso=0 nao_reconhecido=1 cobertura=91.7%
  fixture B (formato bloco), v1: casou=0 de 12 (o v1 nao le bloco, por desenho)
  fixture C (dia 1), v2: lidas=4 casou=0 pendencias=condicao "sem condicao declarada", fornecedor "(sem cabecalho antes da lista)"
  resolver: 4 respostas aceitas (todas ensinaram), 17 recusadas com motivo declarado, 0 aceitas caladas
```

Eram **52** (as 49 do v8 mais E1/E2/E3). Entraram **14**: F1 a F3 (conservacao nas
tres fixtures) e G1 a G11 (o resolver chamado de verdade). Limpeza depois da prova:
`cargas=0, pendencias=0, aliases_tenant=61, semente_prova=0, regras_aprendidas=0`,
igual ao antes.

As assercoes da G **nao listam quais combinacoes falham, cobram a regra**. Se o leitor
aprender a ler cor decorada amanha, `cor verde menta / apontar` passa a ser aceita e
a prova continua verde sem ser reescrita. O que ela nunca deixa passar: aceita e nao
ensinou (G2), aceita e perdeu linha (G3), aceita e derrubou `n_casou` (G4), recusa
por erro nao declarado (G5, porque um `null` qualquer tambem "recusa").

**ATENCAO, colisao de nome:** os rotulos G1 a G11 da PROVA nao sao as guardas G1 a G3
da MIGRATION. Na migration, G2 e conservacao e G3 e "a resposta ensina"; na prova,
G2 cobra a resposta que nao ensinou e G3 a linha perdida. Nao foram renomeados de
proposito: o arquivo commitado e o que rodou, byte a byte.

---

## 4. O que a medicao revelou e esta migration NAO conserta

Registrado na secao 7b da spec e no plano. Em ordem de custo:

1. **`criar` fornecedor nao tem onde se apoiar. E o bloqueador real da 2.4a.**
   Cabecalho de fornecedor desconhecido no TOPO da lista (sem fornecedor anterior
   para herdar) vira a sentinela `(sem cabecalho antes da lista)`: o texto
   `TABELA XPTO IMPORTS` nao chega nem a pendencia nem a `cabecalhos`. No dia 1 de
   um cliente TODO fornecedor e desconhecido, entao toda a lista cai numa pendencia
   so, que nao nomeia ninguem. Por isso nasceu o **`2.4a zero`** no plano, antes do
   `criar`: o leitor tem que carregar o cabecalho candidato ate a pendencia. E
   trabalho de parser no territorio da D10/D13 (`Irajá` e bairro, `Cristiano` e
   loja), muda o md5 de record do v2 e passa pela prova inteira.
2. **Linha sem condicao nao tem caminho de resolucao.** O candidato natural e
   condicao padrao por fornecedor (`perfil.condicao_padrao`, 4.4 da spec), **mas isso
   conflita com a regra da propria spec, "o perfil desempata, nunca decide"**:
   preencher condicao que a linha nao diz e decidir. **Decisao do dono, nao tomada.**
3. Cor decorada (`verde menta`) nao aprende por apelido.
4. `descartar` de pendencia de CABECALHO de modelo nao pega a linha do preco (a regra
   de descarte casa por linha, e no formato bloco a linha do preco nao repete o nome).

Os itens 3 e 4 sao pequenos e agora falham RUIDOSOS, entao nao sao urgentes.

---

## 5. Estado vivo, medido em 11/09/2026 depois da migration

```sql
select
  (select count(*) from public.calc_modelo where tenant_id is null) as modelos_semente,
  (select count(*) from public.calc_alias  where tenant_id is null) as aliases_semente,
  (select count(*) from public.calc_fornecedor) as fornecedores_tenant,
  (select count(*) from public.calc_carga) as cargas,
  (select count(*) from public.calc_alias
    where tenant_id='00000000-0000-0000-0000-000000000001') as aliases_tenant;
```

Esperado: **125, 40, 17, 0, 61**. Orfaos de `calc_alias` (contra `codigo`, nunca
`nome`: armadilha do v8): **0, 0, 0**.

Valores de record:

| Funcao | md5 | len |
|---|---|---|
| `public.calc_carga_abrir` | `6a1176e94c4b5117e3bb0b3ca9ff3b76` | 3957 |
| `public.calc_pendencia_resolver` | `aa8efe9920f12c61207f4b161a4a1177` | 8066 |
| `privado.calc_parse` (v1, intocado) | `f74503007e8e373ce2997b54c249c84c` | 19746 |
| `privado.calc_parse_v2` (intocado) | `20e11504caaa4b8c5bede180569bf1c3` | 27427 |

**O corpo vivo das duas RPCs e byte a byte o do arquivo**: md5 do trecho entre os
`$fn$` do disco calculado aqui (Python) e pela `bandeira`, os dois batendo com o
banco. Script: extrair com `re.finditer(r'\$fn\$(.*?)\$fn\$', s, re.S)`, arquivo
lido com `newline=''` (0 bytes CR).

ACL das duas: `postgres`, `authenticated`, `service_role`. Sem `anon`, sem PUBLIC.
Sem sobrecarga (E3). As duas no v2 (E1). **Advisors: 8**, os mesmos do v8, nenhum
novo.

---

## 6. Como esta sessao trabalhou, e o que vale repetir

**Chamar a coisa antes de guardar a coisa.** A spec pedia uma guarda para um caso.
Medir as 21 combinacoes antes de escrever mostrou que o caso era um de cinco, e que
o dele era o pior. Uma guarda escrita so para o caso da spec teria deixado 16
combinacoes aceitas caladas, com a prova verde.

**Guarda por lei, nao por caso.** G2 (conservacao) e G3 (a resposta ensina) nao sabem
nada de cor, condicao ou fornecedor. Elas cobrem os casos medidos e os que ainda nao
existem.

**O teste de que a guarda nao fechou a porta que funcionava** (G6) e tao importante
quanto os de recusa. Sem ele, uma G3 errada que recusasse TUDO passaria verde em
G1 a G5.

**Roteamento:** `base` aplicou e verificou (V1 a V9, zero divergencia); `bandeira`
rodou a prova. A Torre mediu, escreveu a migration e a prova, e commitou.
`pit-guard` NAO foi acionado: a fatia so ESTREITA um caminho de escrita existente, e
a barreira de papel e o filtro de tenant ficaram byte a byte iguais. A RPC nova
(`calc_catalogo_criar`), quando vier, passa por ele.

---

## 7. Armadilhas medidas nesta sessao (soma as do v8)

**Contador de assercoes se confere no disco, nunca no handoff anterior.** A Torre
passou 63 como esperado para a `bandeira`, partindo das 49 do v8, que eram o numero
de ANTES da secao E. O certo era 66. Pego antes do veredito por
`grep -c 'v_total := v_total + 1'` no arquivo (o laco da secao A roda uma vez so).
Esperado errado reprovaria uma prova certa, ou, pior, levaria alguem a mexer na
prova ate bater.

**Pendencia-sentinela nao e grafia.** Quatro textos de pendencia sao CAUSA, nao
trecho da lista: `sem condicao declarada`, `sem cor num grupo que tem cor`,
`(sem cabecalho antes da lista)` e as duas de `preco`. Apelido ou regra de descarte
construidos a partir deles nao casam com nada. A G3 os recusa sem precisar
conhecer a lista, e e melhor assim do que uma lista fixa desses textos na RPC (duas
copias da mesma string, uma no parser e outra no resolver, divergem).

**`$fn$` dentro de aspas duplas no Bash some.** O primeiro calculo de md5 por
`python -c "..."` quebrou porque o Bash expandiu o `$fn`. Script em arquivo no
scratchpad resolve.

**A `bandeira` leu a tree suja como outra sessao.** Eram os arquivos desta sessao,
ainda nao commitados. O criterio certo continua sendo o do runbook: tree suja so
indica outra sessao quando aparece arquivo ou commit que VOCE nao fez. Conferido
aqui com `git status` e `git log -3` antes de commitar.

---

## 8. O que NAO foi provado, e o vetor de cada um

- **Isolamento das duas RPCs novas contra vendedor e tenant errado.** A secao G roda
  so como dono. A barreira (`v_papel <> 'dono'`) e o filtro de tenant nao mudaram,
  mas nao foram EXERCITADOS. Vetor: na propria prova, trocar o `sub` das claims por
  um que nao existe em `app_usuario` e por um de vendedor, e esperar a recusa da
  barreira nas duas funcoes.
- **A G2 numa lista REAL.** Vetor: antes de o dono usar a tela, rodar
  `privado.calc_parse_v2` na lista do mes e conferir `lidas = casou + duvidoso +
  nao_reconhecido`. Se nao fechar, o defeito e do leitor e a carga nao abre.
- **Suite de frontend nao rodou.** Nenhum arquivo de `public/` foi tocado.
- Continuam abertos do v8: a RPC de salvar margem nunca foi chamada de um navegador;
  `fornecedor_conferir` nao foi visto numa `calc_carga` REAL (a secao G grava cargas
  reais dentro da transacao, mas nao assere esse campo); o portao do Bloco 2 (D7).
  **O terceiro item do v8 (`resolver -> reprocesso -> resumo` nunca chamado) FECHOU**:
  a secao G chama o caminho inteiro.

---

## 9. O proximo passo

| # | Item | Trava | Peso |
|---|---|---|---|
| 1 | **`2.4a zero`**: o cabecalho candidato chega a pendencia | o `criar` fornecedor | parser, medio |
| 2 | **Decisao do dono**: linha sem condicao, condicao padrao por fornecedor? | 2.4b | conversa |
| 3 | `2.4a` `criar`, `ter` quase-igual, `quater` origem | a tela | o grosso |
| 4 | A tela `Alimentar` | o portao do Bloco 2 | grande |
| 5 | Isolamento vendedor/tenant na secao G | nada | pequeno |
| 6 | Derrubar o v1 | o portao do Bloco 2 | pequeno |

**A pergunta do item 2, com o efeito na mesa** (PROCESSO, secao 6): hoje uma lista
em que o fornecedor nao escreve a condicao em linha nenhuma (fixture C, `Junior
recreio`) casa **0 de N**, e nenhuma resposta resolve. Com condicao padrao por
fornecedor, casaria tudo, mas o sistema passaria a AFIRMAR uma condicao que o
fornecedor nao escreveu, e se ele mudar o estoque de lacrado para seminovo sem avisar,
o custo entra na tabela errada calado. Alternativa conservadora: o padrao so vale com
bandeira visivel na linha (`condicao presumida`), e nunca para CPO, que e onde a
comissao muda.

O portao do Bloco 2 continua o mesmo: **o dono roda a carga do mes pela tela,
sozinho, sem Claude Code**, com cobertura nao menor que a do caminho manual da skill
na mesma entrada (D7).

---

## 10. O que continua verdade

- Invariante 17: nao construir superficie de SaaS antes do primeiro pagamento.
- Restricao 8: nenhum export de fornecedor no repo. A fixture C e sintetica.
- `privado.calc_parse_v2` sem grant para `authenticated` e DESENHO (memoria
  `parse-v2-sem-grant-e-desenho`).
- Nao criar FK de `calc_*` para tabela de operacao. Esta migration nao cria nenhuma.
- Nao deixar linha nao entendida virar preco. **Corolario desta sessao: nem sumir.**
  Linha lida esta em alguma pilha, sempre.
- `calc_catalogo_tenant_pitstop` segue NAO versionada, de proposito.
