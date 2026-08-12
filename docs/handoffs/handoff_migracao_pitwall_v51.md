# Handoff Migracao Pit Wall (Nucleo) v51

Substitui a v50. Data: 11/08/2026.

---

## 1. Headline: clique de acao parou de recarregar a tela

Pedido do dono: *"corrija o carregamento acionado toda vez que alguma funcao e
clicada"*.

Nao era so um spinner feio. Todo clique de acao chamava `B()`, a carga completa
da base, e isso custava, **medido nesta maquina com fila de 25 leads**:

| medida | antes | depois |
|---|---|---|
| chamadas de rede por clique | **20** | **2** |
| ...sendo `sugerir_mensagem` | 17 | 0 (1 quando o card fica) |
| ...`dicionario_rotulos` | 1 | **0** |
| ...`v_lead` | 1 (a base inteira) | 1 (**uma linha**, por `.eq`) |
| a lista pisca (`estado.carregando`) | **sim** | **nao** |
| cards que sobrevivem ao clique | **0 de 24** | **24 de 24** |
| Historico aberto sobrevive | **nao** | **sim** |

Na aba Hoje, marcar uma tarefa relia `painel_do_dia` e remontava o dia inteiro;
agora vira o checkbox daquela linha e recalcula o placar, com **1 chamada** (a
propria RPC) e **zero** releituras.

**Esta no ar.** Commit `9a6f7f8`, `a3e17bb..9a6f7f8`, aprovado pelo dono depois do
preview local. Deploy conferido no Worker (secao 10), nao no navegador.

---

## 2. A causa, em uma frase

`q()` chamava `B()` no sucesso de QUALQUER acao. `B()` apagava `#lista` antes de
buscar, relia `dicionario_rotulos` (config que nao muda na sessao) e terminava em
`k()`, que na Fila dispara `prefetchFilaSug(24)` **depois de zerar o cache
`filaSug`**.

Dois agravantes que nenhum handoff tinha registrado:

- **Aba que nao e de lead** (Escopo, Vendas, Clientes, Conteudo, Nfs): o clique
  baixava a base de leads que aquela tela nem mostra, e depois o render da aba
  apagava `#lista` de novo. **Dois apagoes por clique.**
- Com `filaSug` zerado, `filaWaCard` cai no fallback `wa.me/<numero>` **sem
  texto**. Por ~1s depois de todo clique, `Chamar no WhatsApp` abria conversa
  vazia.

---

## 3. O que foi feito

Quatro camadas, no idioma que o repo ja tinha: `renderConteudo(silencioso)`,
nascido no kanban, e o `registrarNota`, que ja repintava so o painel do
Historico. Nao se inventou padrao novo.

1. **Carga quieta.** `B(sil)` e todos os renders assincronos ganham o modo
   silencioso: nao apagam a lista, a troca so acontece com o dado na mao. O
   spinner continua onde e certo: primeira carga, troca de aba e o botao
   Atualizar.
2. **`dicionario_rotulos` uma vez por sessao** (guarda `dicOk`, que Atualizar e o
   login limpam).
3. **`aposAcao()` no lugar de `B()`**: acao de lead com card na mao vai para
   `trocarCard`; acao em outra aba re-renderiza **so aquela aba, em silencio**;
   o resto e `B(!0)`.
4. **`trocarCard(id, card)`**: rele UM lead (`.eq("id", id)`), atualiza o array
   local pelo Lead ID (invariante 5), recalcula o pitboard com `pb()` (sem rede)
   e troca **so aquele card**, pelo mesmo `x()` da lista. Se o lead saiu da fila,
   o card sai; se a fila esvaziou, `k()` pinta o estado vazio de verdade.
5. **Cache de sugestao sobrevive ao render**, e a entrada do lead tocado e
   **invalidada**: depois de um toque a cadencia andou, entao sugestao em cache
   estaria errada, e sugestao velha e pior que sugestao ausente (invariante 13).
6. **Hoje cirurgico**: `dia-marcar` / `lemb-marcar` viram o `aria-checked`
   daquela linha; `dia-remover` / `lemb-remover` tiram aquela linha; os dois
   recalculam o placar contando o DOM. `dia-add`, `lemb-add` e `dia-puxar`
   releem, mas em silencio: a linha nova so o servidor conhece.

### 3.1 Um achado do banco que definiu o desenho

`registrar_toque` grava `ultimo_toque_em = now()` (`pg_get_functiondef`, lido em
11/08/2026), e `entraNaFila` exige `dataLocalDe(ultimo_toque_em) !== hoje`.
**O toque tira o lead da fila do dia**, entao o caminho cirurgico dominante e
REMOVER o card, nao repinta-lo. Ja `registrar_resposta` nao mexe em status,
`proximo_contato` nem `ultimo_toque_em`: esse card fica e e trocado no lugar.
Os dois caminhos sao exercitados pela suite.

---

## 4. Escopo e Rotina ficaram de fora, de proposito

O dono escolheu "cirurgico em tudo". **Escopo e Rotina nao ficaram cirurgicos**,
e isso e decisao consciente, nao esquecimento.

O placar de uma frente (`nota`, `faixa`, `dias_parada`) e derivado no servidor,
dentro de `escopo_completo`. Recalcular isso no cliente para poupar uma leitura
seria **inventar numero que o cliente nao possui**, e a tela passaria a afirmar
uma nota que ninguem pode auditar. Aquelas abas ficam com o re-render silencioso
do `aposAcao()`: sem spinner, sem baixar a base de leads, e sem estado aberto
para perder (conferido: nao ha `aria-expanded` nem painel expansivel nos blocos
de Escopo e Rotina, entao o resultado na tela e visualmente identico ao
cirurgico).

Regra que fica: **o que a tela ja sabe, a tela resolve; o que so o servidor sabe,
re-render silencioso.** Nunca inventar dado no cliente para evitar uma leitura.

---

## 5. O instrumento estava cego (e isso quase validou o errado)

Duas correcoes no `harness.py` que valem mais que a obra:

1. **`.eq()` e `.neq()` do stub nao filtravam.** Devolviam a tabela inteira. Como
   `trocarCard` faz `.from("v_lead").select("*").eq("id", id)` esperando UMA
   linha, o stub devolvia as 25, o app pegava `data[0]` (**lead errado**) e a
   primeira rodada de medida "passou" pelo motivo errado: 25 cards com 24 marcas,
   um card duplicado no lugar do tocado. Agora filtram de verdade. E o mesmo
   defeito que o `.not()` ausente causou na v46, e o comentario que ja estava la
   ("stub incompleto nao falha barulhento: ele cega o teste") descrevia o caso
   sem que ninguem tivesse consertado o resto.
2. **Nenhuma RPC de escrita de lead era stubada.** `registrar_toque`,
   `registrar_resposta`, `registrar_conversando` e `registrar_desfecho` caiam no
   `rpc nao stubada` (`ok:false`), entao `q()` ia para o ramo de erro e **o
   caminho de recarga pos-acao nunca foi exercitado pela suite em nenhuma
   sessao**. As quatro entraram espelhando `pg_get_functiondef`.

Nasceu tambem `window.__fromChamadas`, irmao do `__rpcChamadas` para o lado das
tabelas: sem ele nao da para afirmar "este clique nao releu a base".

---

## 6. Provas

Todas nesta maquina, **exit code conferido**, depois da ultima mudanca:

| prova | resultado |
|---|---|
| `python ferramentas/harness.py` | **284 passou / 0 falhou** — EXIT 0 (era 255) |
| `python ferramentas/validar.py` | EXIT 0 |
| `python ferramentas/prova_trilho.py` | EXIT 0 |
| `python ferramentas/diag_mobile.py` 360 / 390 / 414 | EXIT 0 nos tres |
| `node --check public/app.js` | EXIT 0 |
| os 4 `patch_*.py`, 2a vez | `ja aplicado, nada a fazer` |

**As 29 assercoes novas foram provadas nos DOIS sentidos.** Rodadas contra o
`app.js` do HEAD numa copia isolada (`git show HEAD:public/app.js`, arvore de
trabalho intocada), elas **reprovam 12 vezes**, exatamente nos defeitos: a lista
pisca, o dicionario e relido, a rajada dispara, 0 de 2 cards sobrevivem, o
Historico fecha, o Escopo baixa `v_lead`, o placar do Hoje nao tem chave por
codigo. Guard-rail que nao morde nao e guard-rail.

Tres assercoes merecem nome, porque sao as que um refactor futuro vai tentar
burlar:
- **identidade de no do DOM** (`querySelector(...) === noGuardado`): e o unico
  jeito de provar que uma tela NAO foi remontada. Comparar HTML nao distingue
  "igual" de "recriado igual".
- **contagem de rede por clique** (`<= 2`): trava a rajada com numero, nao com
  adjetivo.
- **LGPD no caminho novo** (invariante 16): lead sem consentimento repintado
  cirurgicamente continua sem link de WhatsApp e sem pedir sugestao. O caminho e
  novo, entao a garantia teve que ser provada nele, nao deduzida do antigo.

Efeito colateral bom: a suite passou a ser defensiva (`if (vivo) {...}`) porque,
ao rodar no codigo antigo, ela ESTOUROU num `undefined` e levou junto os blocos
de Escopo e Hoje, que nunca chegaram a ser avaliados. Falha tem que reprovar, nao
derrubar a rodada.

---

## 7. Onde encostou

| arquivo | o que |
|---|---|
| `ferramentas/patch_carga_quieta.py` | **novo.** Camadas 1-4 + `trocarCard`, na linha 1 minificada. +1.576 bytes |
| `ferramentas/patch_cirurgico_dia.py` | **novo.** Hoje cirurgico, `data-cel` no placar, `nf-seg` silencioso. +1.157 bytes |
| `public/app.js` | os dois patches + 6 edicoes nos blocos legiveis (`renderDash`, `renderEscopo`, `renderRotina`, `renderVendas`, `renderClientes`, `renderNfs` ganham `sil`) |
| `ferramentas/harness.py` | stub honesto (secao 5) + 29 assercoes novas |
| `public/app.css` | **nao encostou.** O feedback do clique ja e o toast |

Diff limpo: **42 linhas em `app.js`**, zero CRLF (conferido por contagem de
bytes, nao por `grep`, que mentiu no meio do caminho). Os dois patches gravam com
`newline='\n'`, entao a pendencia 1 do v50 nao voltou a morder.

---

## 8. Decisoes

1. **Frescor so do lead tocado** (escolha do dono). O resto revalida na troca de
   aba, em silencio, e no botao Atualizar, com spinner. Risco assumido e
   nomeado: se a regua do pg_cron mexer em OUTRO lead com a aba aberta, so
   aparece na proxima troca de aba.
2. **Sem otimismo de UI.** Nada e pintado antes de a RPC voltar: `registrar_toque`
   pode ser recusado pela regua, e pintar antes ensinaria o operador a confiar
   numa tela que as vezes mente. ~200ms nao pagam isso.
3. **Escopo e Rotina silenciosos, nao cirurgicos** (secao 4).
4. **`Y("btnAtualizar","click",B)` virou funcao explicita.** O Event do clique
   entraria como o argumento `sil` e faria o botao Atualizar ficar silencioso:
   armadilha fechada antes de existir.

---

## 9. Pendencias

1. **`.gitattributes` com `* text=auto eol=lf`** (herdada do v50, secao 4.2).
   Continua decisao do dono porque muda o checkout de todo mundo. Esta sessao
   contornou gravando os patches com `newline='\n'`.
2. Herdado do v47/v49/v50, tudo ainda aberto:
   - o relatorio de entrega nao registra que foi enviado (sem `despachado_em`);
   - o texto do relatorio nao e configuravel (formato no JS);
   - `privado.fn_venda_atualizar` tem EXECUTE para `authenticated` e e SECURITY
     DEFINER, nomeado para o `pit-guard` decidir;
   - **VENDA-0003 duplicada** (faturamento inflado em R$ 8.400);
   - **Conteudo e Hoje continuam sem a forma nova** (a Fila passou na frente tres
     vezes agora). A recomendacao do v48 segue de pe.
3. Escrita de volta no Notion segue bloqueada pela capability "Update content",
   que so o dono pode ligar.

---

## 10. Deploy conferido

Push pela URL real do GitHub (o `origin` desta maquina aponta para o proxy do
sandbox, que esta desligado; `git push origin main` falha). O clone foi conferido
EM DIA com o GitHub real antes do commit, nos dois sentidos, entao o push nao
levou trabalho de outra sessao.

| prova | resultado |
|---|---|
| `git ls-remote` refs/heads/main | `9a6f7f8`, igual ao HEAD local |
| md5 `public/app.js` vs servido | `55ff290578b2f968...` nos dois |
| md5 `public/app.css` vs servido | `42c1acdcc8fabd61...` nos dois |
| md5 `public/index.html` vs servido **na raiz** | `237c85dc79e57c48...` nos dois |
| `aposAcao` / `trocarCard` / `hojePlacarAtualiza` / `data-cel` no servido | presentes |

Armadilha para a proxima sessao: **`GET /index.html` no Worker devolve 307**, nao
o arquivo. Comparar md5 desse caminho da o hash de string vazia
(`d41d8cd98f00b204e9800998ecf8427e`) e parece divergencia de deploy. O caminho a
conferir e a **raiz** (`/`). Isso e o `not_found_handling: single-page-application`
funcionando, nao defeito.
