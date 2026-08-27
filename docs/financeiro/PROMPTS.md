# Prompts do Financeiro (Pit Wall 2.0)

**Fonte da verdade: `pitwall--nucleo/docs/financeiro/PROMPTS.md`, no git.**
Qualquer outra copia e copia de leitura.

Revisao 1, 27/08/2026. Consolida e substitui os prompts espalhados em
`plano_de_prompts_financeiro_v1` e `plano_mestre_financeiro_v1`.

---

## 0. Como usar, versao curta

Toda sessao tem tres blocos, nesta ordem, sem excecao:

```
P-ABRE   ->   UM prompt de entrega   ->   P-FECHA
```

- **Um prompt por sessao.** Nunca dois.
- **`P-ABRE` reprovou? A entrega da vez vira o conserto.** O portao nao e sugestao.
- **`P-AUDITA` roda em sessao SEPARADA** da que construiu.
- Todo prompt de entrega pressupoe que `docs/financeiro/CONTRATO.md` carregou. Se a
  sessao nao anunciar que leu o contrato, pare: o apontamento em `CLAUDE.md` quebrou.

O guia completo de operacao esta em `guia_de_uso_dos_prompts.md`.

---

## 1. Indice

| Prompt | Para que serve | Estado |
|---|---|---|
| `P-ABRE` | portao de entrada | ciclo |
| `P-FECHA` | portao de saida, commit e handoff | ciclo |
| `P-AUDITA` | auditoria em sessao separada | ciclo |
| `P-FREIA` | a sessao esta crescendo sozinha | contencao |
| `P-NAO-INVENTA` | afirmacao sem evidencia | contencao |
| `P-DECIDE` | proposta soou boa demais | contencao |
| `P-ESTRUTURA` | plantar o contrato no repo | bloco 0 |
| `P-R0` | git volta a descrever o banco | bloco 1 |
| `P-W1-COBERTURA` | base incompleta nao vira numero | bloco 1 |
| `P-W1-REPASSE` | dinheiro que so passa sai do resultado | bloco 1 |
| `P-R1` | a tela conta o abatimento | bloco 1 |
| `P-R2` | a faixa cobra o numero certo | bloco 1 |
| `P-R5b` | propor as regras das maiores contrapartes | bloco 2 |
| `P-R3` | arquivar movimento errado | bloco 2 |
| `P-R4` | criar categoria pela tela | bloco 2 |
| `P-R6` | conferencia de saldo | bloco 2 |
| `P-W2-CONTRAPARTE` | cada linha sabe de quem veio | bloco 2 |
| `P-R5` | julgar do maior valor para o menor | bloco 2 |
| `P-W3-PESSOAL` | a Visao Pessoal com grafico | bloco 3 |
| `P-W3-AGENTE1` | o agente classificador | bloco 3 |
| `P-W4-META` | provisoes e meta reversa | bloco 4 |
| `P-W4-AGENTES` | fechamento e vigia | bloco 4 |
| ~~`P-W1-CAPITAL`~~ | aporte de investidor | **CANCELADO** (D-q: nao existe aporte) |

---

## 2. Ciclo

### P-ABRE

```
Portao de entrada do Financeiro. Leia docs/financeiro/CONTRATO.md e confirme que leu.

Rode e devolva EXIT CODE, nao texto de saida, em tabela (item | EXIT | veredito):

1.  git status --porcelain
2.  via Supabase MCP: migrations aplicadas vs supabase/migrations/ no git. Liste a diferenca.
3.  python ferramentas/validar.py
4.  python ferramentas/harness.py
5.  python ferramentas/prova_trilho.py
6.  python ferramentas/prova_grafico.py
7.  python ferramentas/prova_atmosfera.py
8.  node --check public/app.js
9.  python ferramentas/diag_mobile.py em 360, 390, 414, 1280 e 1440

Se QUALQUER item reprovar, pare e diga qual e o conserto.
Nao proponha, nao comece, nao adiante nada da entrega da vez.
```

### P-FECHA

```
Portao de saida. Antes de dizer pronto:

1. Confira item a item o portao de saida do CONTRATO.md, com sim/nao.
2. Liste os arquivos tocados e o hash do commit.
3. Atualize o handoff da linha do Financeiro, no nome que o
   docs/handoffs/handoff_indice_pitwall.md ja usa (nao crie serie paralela).
   Secoes: o que mudou nesta sessao / o que foi PROVADO, com EXIT code /
   o que NAO foi provado / pendencias / primeiro movimento do proximo chat /
   invariantes reforcados.
4. Responda explicitamente: algum numero visivel na tela mudou de valor nesta
   entrega? Se sim, onde esta a explicacao na tela? (portao de confianca)
5. Alguma recusa nova foi criada? Ela entrou na secao 4 do CONTRATO.md?

Se algum item reprovar, NAO commite. Reporte o que falta.
```

### P-AUDITA

```
Voce e auditor, nao construtor. NAO edite nenhum arquivo.
Leia docs/financeiro/CONTRATO.md e o ultimo handoff da linha do Financeiro.

Audite o commit <hash> contra a secao 7 do CONTRATO.md, pergunta por pergunta,
com veredito binario e a evidencia (arquivo e linha, ou consulta rodada).

Cheque em especial:
- campo devolvido por RPC sem leitor em public/app.js
- inferencia de dominio em codigo, regra ou agente (Inv. 18, F2)
- numero economico exibido com base abaixo de 95% julgada (F3)
- current_date ou CURRENT_DATE novo (Inv. 10)
- grant de DELETE ou TRUNCATE para authenticated (Inv. 9)
- token de cor novo (C5)
- frase de erro inventada na tela (C3)
- migration aplicada no banco e ausente do git

Auditoria que nunca reprova e teatro. Se reprovar, diga o que esta errado e como consertar.
```

---

## 3. Contencao

### P-FREIA

```
Pare. Releia a frase da entrega da vez.
Liste o que voce esta prestes a fazer que esta FORA dessa frase.
Para cada item fora, classifique: (a) necessario para a frase acontecer,
(b) melhoria que pode virar entrega propria, (c) escopo que nao deveria existir.
Depois faca so os (a).
```

### P-NAO-INVENTA

```
Antes de afirmar qualquer estado do sistema, rode a consulta ou abra o arquivo.
Marque cada afirmacao da sua resposta como MEDIDO (com a evidencia) ou SUPOSTO.
Afirmacao sem uma das duas marcas nao entra na resposta.
```

### P-DECIDE

```
Voce me deu uma proposta. Antes de eu aprovar:
1. Qual e a MAIOR falha desta proposta?
2. O que ela custa que eu ainda nao vi?
3. Existe versao que entrega 80% do valor com 20% do trabalho? Descreva.
4. Se eu nao fizer nada disso, o que quebra e quando?
Nao valide a ideia. Procure o furo.
```

---

## 4. Bloco 0, estrutura

### P-ESTRUTURA

```
Frase da entrega: o contrato do Financeiro passa a carregar sozinho em toda sessao
que tocar em fin_ ou na aba Financeiro.

Esta entrega toca CLAUDE.md e o indice de handoffs, que sao arquivos de raio grande.
Execute em DUAS fases e PARE entre elas.

=== FASE 1, so conferencia. Nao escreva nada. ===

Rode e reporte em tabela (item | resultado | veredito):
1.  git status --porcelain
2.  ls -la docs/
3.  ls -la docs/financeiro/ 2>/dev/null || echo "nao existe"
4.  cat CLAUDE.md
5.  head -40 docs/handoffs/handoff_indice_pitwall.md
6.  git ls-files supabase/migrations/ | grep -i fatia21 || echo "nao versionada"
7.  git log --oneline -5 -- supabase/migrations/
8.  file doc.md && head -20 doc.md
9.  ls -la docs/superpowers/plans/2026-08-19-segundo-lojista-tenant.md

Responda tambem, uma linha cada:
- CLAUDE.md ja tem bloco de arranque ou de "leia antes de"? Em que linha?
- O indice ja tem linha do Financeiro? Qual o nome dela?
- A migration 20260826_fin_fatia21_painel_abatimento esta versionada?
- doc.md e arquivo de trabalho, lixo, ou conteudo real? Nao commite sem eu dizer.

PARE AQUI.

=== FASE 2, so depois de eu aprovar. ===

1. Criar docs/financeiro/ se nao existir.
2. Os tres arquivos (CONTRATO.md, PROMPTS.md, PLANO.md) eu vou colar.
   Se algum JA existir, NAO sobrescreva: reporte e pare.
3. Patch em CLAUDE.md, com DIFF mostrado antes de aplicar. Se ja houver bloco de
   arranque, as tres linhas entram NELE, sem criar secao nova:

     Ao tocar em qualquer coisa com prefixo fin_ ou na aba Financeiro:
     leia docs/financeiro/CONTRATO.md ANTES de escrever a primeira linha.
     Se o contrato conflitar com o pedido do prompt, o CONTRATO ganha e voce avisa.

4. Registrar a linha no docs/handoffs/handoff_indice_pitwall.md, no formato que o
   indice ja usa. Se ja existir linha do Financeiro, use o nome dela.
5. Commit unico. NAO inclua doc.md nem o plano do segundo lojista: sao dividas
   proprias, tratadas no P-R0.
6. TESTE DE ACEITE, sem ele a entrega nao fecha: abra sessao nova, peca para ler
   public/app.js na parte de fin_, e confirme que ela ANUNCIA ter lido o CONTRATO.md.
   Se nao anunciar, o apontamento esta no lugar errado.

Fora de escopo: qualquer migration, qualquer mudanca em fin_*, qualquer commit de
arquivo que ja estava sem versionar antes desta sessao.
```

---

## 5. Bloco 1, a tela para de mentir

### P-R0

```
Frase da entrega: o git volta a descrever o banco.

ATENCAO: o estado desta divida MUDOU desde a medicao de 26/08 e precisa ser
reconferido, nao presumido. Nao assuma que a migration da fatia 2.1 esta faltando.

Tarefa:
1. Via Supabase MCP, liste as migrations APLICADAS. Liste as VERSIONADAS em
   supabase/migrations/. Mostre a diferenca nos dois sentidos.
2. git status --porcelain completo.
3. Para cada arquivo sem versionar, diga o que e e se deve entrar. Especificamente:
   - doc.md: o que e? Se for lixo ou rascunho, proponha .gitignore em vez de commit.
   - docs/superpowers/plans/2026-08-19-segundo-lojista-tenant.md: e plano real? entra.
4. Commit unico do que deve entrar, mensagem descrevendo que o repo estava atras.
5. Prove: rode a comparacao de novo e mostre diferenca zero.

Se a diferenca ja for zero e nao houver arquivo pendente legitimo, DIGA ISSO e
encerre. Entrega vazia e resultado valido; entrega inventada nao.

Nao mexa em mais nada. Esta entrega e so higiene.
```

### P-W1-COBERTURA

```
Frase da entrega: a tela nunca mais mostra um numero economico sobre base incompleta.

Leia os invariantes F3 e F4 do CONTRATO.md antes de comecar.

Contexto: a base tem 181 linhas e menos de 2% do VALOR julgado. Todo numero de
receita, margem ou meta calculado hoje esta errado. Isso ja produziu erro real,
publicado tres vezes.

Tarefa, vertical:
1. RPC fin_cobertura(p_ini, p_fim), leitura, dono-only, search_path fixo. Devolve:
   valor_bruto_total, valor_bruto_julgado, pct_julgado, linhas_pendentes,
   e o mesmo recortado por dominio.
   JULGADO = tem dominio, OU tem categoria de natureza neutro.
   (neutro conta como julgado: aplicacao e resgate nao tem lado a decidir)
   Regras de janela iguais as do fin_painel (Inv. 10, fim para em hoje no mes corrente).
2. fin_painel passa a devolver pct_julgado da janela pedida.
3. Tela: quando pct_julgado < 95, o bloco de numero economico e SUBSTITUIDO por
   `base incompleta: N% julgado · faltam R$ X em Y linhas`,
   com atalho para Movimentos filtrado por sem dominio e ordenado por valor.
   NAO e aviso ao lado do numero. E NO LUGAR do numero.
   Usa --morno, nunca --erro: base incompleta e trabalho que falta, nao falha.
4. Assercoes fin3:, incluindo uma que PROVE que abaixo de 95% nenhum numero de
   receita, margem ou meta chega na tela.

Este e o guardiao de todo o resto do plano. Sem ele, os agentes dos blocos 3 e 4
vao propor sobre dado incompleto.
```

### P-W1-REPASSE

```
Frase da entrega: dinheiro que so passa pela conta deixa de parecer receita e despesa.

Contexto DECIDIDO pelo dono, nao inferir e nao ampliar:
- Sao repasse: o par Ford (entra AGENCY FORD SUL C MODELOS, sai FORD MODELS SUL),
  Joao Victor da Cunha Pinheiro, Bruno da Costa Azevedo, Ricardo Meireles de Oliveira.
- NAO existe aporte de investidor (CONTRATO.md, D-q). Nao crie categoria de aporte,
  nem coluna natureza_capital, nem view de saldo por contraparte.
- BR IPHONES: significado NAO definido pelo dono. Nao classifique, nao crie regra,
  nao chute. Deixe na fila de julgamento.

Tarefa, vertical:
1. Categoria `repasse` no grupo Neutro. NAO criar grupo novo, NAO criar token de cor.
2. Coluna fin_movimento.repasse_id uuid null.
3. RPC fin_repasse_marcar(payload): {entrada_id, saida_id} liga o par e marca os dois.
   Recusa nomeada quando a diferenca passar de 5% do maior valor.
   Recusa nomeada quando um dos dois ja estiver em outro par.
4. fin_painel EXCLUI repasse de entradas e saidas e DECLARA o valor excluido em
   linha propria. Nao esconda: declare.
5. Tela: acao de marcar par na lista de Movimentos, e a linha do valor excluido na Visao.
6. Assercoes fin3:.
```

### P-R1

```
Frase da entrega: o painel desconta devolucao e a tela diz que descontou.

Contexto: fin_painel JA devolve `bruto` e `abatido` por categoria (fatia 2.1, task 1).
Confirme antes de comecar que public/app.js nao contem ocorrencia de `abatido`.
Efeito hoje: Transporte caiu de 624,95 para 493,93 sem explicacao na tela.

Tarefa, so frontend:
1. Na secao da Visao, quando `abatido` > 0, nota abaixo do valor:
   `624,95 gastos menos 131,02 devolvidos · 27 linhas`
   O ponto do meio e U+00B7. Preserve.
2. Na lista de Movimentos, linha com valor positivo dentro de categoria de gasto
   ganha selo `devolução`. Token existente, nenhum token novo.
3. Assercao fin3: cobrindo a nota e o selo.

Fora de escopo: qualquer mudanca em fin_painel. O servidor ja esta certo.
```

### P-R2

```
Frase da entrega: a faixa mostra quanto entrou e quanto saiu sem julgamento,
nao a diferenca entre os dois.

Contexto medido: 131 linhas sem dominio somam R$ 39.664,38 de entrada e
R$ -38.277,63 de saida. A faixa mostra hoje R$ 1.386,75, que e a soma COM SINAL:
subestima o trabalho pendente em 56 vezes, e por isso o trabalho nao e feito.

Tarefa, vertical:
1. fin_painel passa a devolver no placar:
   nao_classificado_entradas, nao_classificado_saidas.
   Mantenha nao_classificado_valor e nao_classificado_n: nada e removido.
   Regra inalterada: a faixa NAO respeita o filtro de dominio, e a tela diz isso.
2. A faixa, no topo das 3 primeiras sub-views, exibe os dois numeros com destaque
   e o liquido em tamanho menor.
3. Assercoes fin3: para os dois campos e para a faixa.

Nao divida esta entrega em duas.
```

---

## 6. Bloco 2, a base fica limpa e nomeada

### P-R5b

```
Nao escreva codigo. Nao crie migration. Consulta e proposta apenas.

Via Supabase MCP, sobre fin_movimento com arquivado_em is null e dominio is null:
1. Agregue por contraparte, extraindo o nome do trecho da descricao entre os
   separadores ' - '. Devolva n, entrou, saiu, liquido e movimento bruto,
   ordenado por bruto desc.
2. Marque os pares onde entrou e saiu se anulam (diferenca menor que 5% do bruto):
   candidatos a repasse. Compare sobre TODA a base, nunca sobre uma janela (F4).
3. Para as 10 maiores contrapartes, proponha: padrao, tipo_match, categoria_codigo,
   dominio, prioridade.

Restricoes da proposta:
- dominio SO quando obvio pela contraparte (CNPJ de fornecedor de aparelho, ou
  pessoa da familia). Na duvida, dominio null e diga por que. Inv. 18.
- padrao que casar mais de 60% da base sera recusado pelo servidor (D-e). Calcule antes.
- prefira a RAIZ do nome quando a mesma contraparte aparece com grafias diferentes.
  Caso conhecido: `BR IPHONES IMPORTACAO LTDA` e `BR IPHONES IMP LTDA` sao o mesmo
  CNPJ 26.426.950.
- BR IPHONES: NAO proponha categoria nem dominio. Significado nao definido pelo dono.
- NAO existe aporte. Nao proponha essa categoria.

Devolva tabela pronta para eu conferir, e a lista das linhas que NENHUMA regra pega.
```

### P-R3

```
Frase da entrega: lancamento errado sai da base sem sumir do historico.

Contexto medido: fin_movimento.arquivado_em EXISTE e e usada como filtro em toda
leitura, mas NADA nunca escreve nela. Nao ha DELETE para authenticated, e isso
esta certo e nao muda (Inv. 9).

Tarefa, vertical:
1. Coluna fin_movimento.arquivado_por uuid null.
2. RPC fin_movimento_arquivar(payload): {ids[], motivo?}. Dono-only, security invoker,
   search_path fixo. Soft delete. Recusa nomeada para id inexistente e ja arquivado.
3. Policy e grant minimos para o UPDATE alvo.
4. Tela: acao na linha de Movimentos, com confirmacao que mostra o NUMERO
   (`Arquivar os 3`), nunca sim generico. Depois de rodar, a tela DECLARA o que arquivou.
5. Assercoes fin3:, incluindo que a linha arquivada sai de fin_painel, fin_movimentos
   e fin_cobertura.

Responda antes de codar: existe caminho para DESARQUIVAR? Se nao, diga se falta e
nao construa sem eu decidir.
```

### P-R4

```
Frase da entrega: `+ Nova categoria` funciona, e iFood e obra existem.

Contexto medido, tres bloqueios independentes: nao existe RPC de escrita de categoria,
fin_categoria nao tem policy de INSERT, e authenticated tem so SELECT.

Tarefa, vertical:
1. RPC fin_categoria_salvar(payload): cria (sem codigo) ou edita (com codigo).
   Campos: codigo, rotulo, grupo, natureza_esperada, dominio_sugerido, ordem, ativo.
   `codigo` e chave e IMUTAVEL na edicao (Inv. 12). Desativar e soft, nunca DELETE.
   Recusa nomeada para codigo repetido, grupo desconhecido e natureza invalida.
2. Policy de INSERT e UPDATE, grant minimo.
3. Seed de 3 categorias: ifood, obra da casa, obra da loja.
4. Tela: `+ Nova categoria`. Escolha o lugar e diga por que.
5. Assercoes fin3:.

Atencao: 9 grupos contra 7 tokens de trilho, com colisao ja assumida entre Marketing
e Vida separada por icone (C5). Grupo novo NAO entra nesta entrega: as 3 categorias
cabem em grupo existente.
```

### P-R6

```
Frase da entrega: o sistema avisa quando o extrato importado nao fecha com o
saldo do banco.

Contexto medido: fin_importacao.saldo_final_informado recebe o LEDGERBAL do OFX e
NENHUMA RPC compara com a soma dos movimentos. Herdado do v67, ainda aberto.

Tarefa, vertical:
1. RPC de leitura fin_conferir_saldo(p_importacao_id?): compara
   saldo_final_informado com a soma dos movimentos da conta ate periodo_fim.
   Devolve {ok, msg, esperado, apurado, diferenca, fecha}.
2. Tela: na sub-view Importar, apos importar, linha declarando se fechou.
   Quando nao fechar, --morno, nunca --erro.
3. Assercoes fin3:.

Responda antes de codar: o apurado considera movimento manual (fin_lancar) e
movimento arquivado? Proponha e justifique; eu decido.
```

### P-W2-CONTRAPARTE

```
Frase da entrega: cada linha sabe de quem veio ou para quem foi.

Tarefa, vertical:
1. Coluna fin_movimento.contraparte text null.
2. Extracao na importacao: nome normalizado da descricao. O extrato usa ' - ' como
   separador e o nome vem no segundo trecho; 'Aplicação RDB' e 'Resgate RDB' nao tem
   separador. Trate os dois formatos e diga quais linhas ficaram sem contraparte.
3. Backfill das linhas existentes, em migration IDEMPOTENTE: a regra de extracao pode
   mudar depois e o backfill precisa poder rodar de novo sem duplicar nada.
4. Tela: contraparte visivel na linha de Movimentos, e agrupamento por contraparte
   no filtro.
5. Assercoes fin3:.

NAO construa saldo por contraparte. F4: janela corta ciclo e inventa saldo, e com
menos de 3 meses de base esse numero mente. Esse erro ja foi cometido neste projeto.
```

### P-R5

```
Frase da entrega: da para julgar as linhas sem dominio do maior valor para o menor,
em lote, numa sessao so.

Contexto medido: 131 linhas sem dominio, R$ 77.942 de movimento bruto.
25 contrapartes cobrem 96,6% do valor.

Tarefa, vertical:
1. fin_movimentos ganha p_ordem, com `valor_abs_desc` alem da ordem por data.
   Ganha filtro por categoria_codigo e por procedencia.
2. Coluna fin_movimento.regra_id uuid null, preenchida por fn_fin_aplicar_regras
   quando a regra classificar. Motor UNICO, nao duplique (C1).
3. Tela: seletor de ordenacao, filtro de categoria, e chip com o padrao da regra
   que pegou, na linha classificada por regra.
4. Detalhe da categoria: clicar na categoria da Visao abre as linhas dela.
5. Assercoes fin3:.

Meta desta entrega, medida por fin_cobertura depois: valor bruto julgado acima de 95%.
```

---

## 7. Bloco 3, voce ve onde gastou

### P-W3-PESSOAL

```
Frase da entrega: eu abro o Financeiro e vejo, em cinco segundos, onde gastei
dinheiro pessoal este mes.

Leia F3 do CONTRATO.md: com base abaixo de 95% julgada, cada bloco mostra
`base incompleta: N% julgado` NO LUGAR do numero.

Tarefa, vertical:
1. RPC fin_pessoal(p_ini, p_fim). Devolve:
   - total do periodo, media dos 3 periodos anteriores, delta
   - lista por categoria pessoal: valor, pct, delta vs media de 3
   - top 5 contrapartes, com valor e contagem
   - serie mensal dos ultimos 6 meses
   - pct_julgado da janela
   Regras de janela iguais as do fin_painel (Inv. 10, delta null quando nao ha base).
2. A sub-view Visão passa a abrir com o seletor em Pessoal.
3. Blocos: Gastei / Onde foi / Para quem foi / Mudou este mes / 6 meses.
   'Mudou este mes' tem no maximo 3 frases, geradas de REGRA, nao texto fixo.
4. A serie de 6 meses so aparece com 2 ou mais periodos. Com 1, escreva
   `primeira leitura` em vez de desenhar uma linha de um ponto so.
5. Assercoes fin3:.

As 11 categorias pessoais ja existem: moradia, mercado, familia, alimentacao_fora,
transporte, saude, educacao, lazer, assinatura, vestuario, outro_pessoal.
Nao crie categoria nesta entrega.

Restricao dura (C5): zero token de cor novo, barra de magnitude num tom so, e a
entrega passa por prova_grafico.py, prova_trilho.py e prova_atmosfera.py.
Se o desenho exigir paleta nova, o desenho esta errado.
```

### P-W3-AGENTE1

```
Frase da entrega: depois de importar, o sistema me entrega um lote de propostas
e eu aprovo em um clique.

Leia F1 e F2 do CONTRATO.md antes de comecar.

Tarefa, vertical:
1. Tabela fin_proposta: movimento_ids[], tipo, categoria_codigo, dominio, contraparte,
   valor_movido, justificativa, estado (pendente/aceita/recusada/ajustada), respondido_em.
2. RPC que gera propostas para as linhas sem dominio da ultima importacao:
   - agrupa por contraparte;
   - par que se anula em ate 5% sobre TODA a base (F4): propoe repasse;
   - categoria por semelhanca com o ja classificado;
   - DOMINIO so quando a mesma contraparte ja foi classificada pelo dono no mesmo
     dominio 3 vezes ou mais (F2). Caso contrario dominio null. Sem excecao.
3. RPC fin_proposta_responder: aceitar, ajustar ou recusar, em lote.
   Recusa fica registrada e a mesma proposta nao volta no ciclo seguinte (F1).
4. Tela: lote ordenado por valor_movido desc, com o valor que cada proposta move.
5. Assercoes fin3:, incluindo uma que PROVE que contraparte nova nunca recebe dominio.

O agente nunca grava dominio direto. Se a sua implementacao permitir isso em
qualquer caminho, ela esta errada.
```

---

## 8. Bloco 4, o sistema propoe e cobra

### P-W4-META

```
Frase da entrega: o sistema me diz quanto preciso receber este mes para fechar
saudavel, e quanto falta.

Leia F3 do CONTRATO.md: com base abaixo de 95% julgada, o bloco diz o que falta
julgar em vez de mostrar alvo falso.

Tarefa, vertical:
1. Tabelas:
   fin_meta      (retirada_maxima, vigente_desde)
   fin_provisao  (rotulo, tipo, valor, prazo, dia_do_mes, acumulado, dominio,
                  prioridade, ativo)
   tipo em: valor_fixo_mensal, percentual_da_receita, alvo_com_prazo.
2. RPC da meta reversa:
   necessidade = custo fixo + retirada planejada + provisoes do mes
   falta = necessidade - receita ja recebida no mes
   RECEITA aqui EXCLUI repasse, resgate e transferencia interna.
   Se incluir qualquer um deles, esta errado.
3. Custo fixo: mediana das saidas dominio='empresa' recorrentes, fora compra_aparelho.
   Proponha a definicao de 'recorrente' e diga qual escolheu.
4. Tela: bloco Meta Saudavel com `Faltam R$ X em N dias` e barra por provisao.
5. Assercoes fin3:.
```

### P-W4-AGENTES

```
Frase da entrega: dia 1 eu recebo a leitura do mes e as propostas de meta e provisao,
e toda semana o vigia me avisa do que saiu da linha.

Leia F1, F2 e F3 do CONTRATO.md.

AGENTE 2, dia 1, em pg_cron (a instancia ja roda a cadencia do CRM):
1. Leitura do mes, 4 a 6 linhas geradas de REGRA: receita real, repasse, gasto pessoal
   por categoria, o que mudou contra a media, o que exige atencao.
2. Propostas, gravadas em fin_proposta:
   - meta de retirada por CAPACIDADE, nunca por habito:
     capacidade = receita media - custo fixo medio - provisoes propostas
     habito < capacidade  -> propoe o habito
     habito > capacidade  -> propoe a CAPACIDADE e mostra o corte em reais
     capacidade negativa  -> NAO propoe meta. Declara que o mes nao fecha e que o
                             problema e receita ou custo fixo, nao gasto pessoal
   - provisao de imposto: aliquota efetiva medida nas saidas da categoria imposto.
     Se nao houver nenhuma saida de imposto, proponha faixa marcada
     `confirmar com contador`. NAO invente aliquota.
   - reserva de operacao: N meses de custo fixo, default 3.
3. MODO declarado em toda proposta:
   base < 95% julgada -> BLOQUEADO, nao propoe nada, diz o que falta julgar (F3)
   1 a 2 meses        -> PROVISORIO, dizendo que 1 mes nao e padrao
   3+ meses           -> media movel
   6+ meses           -> sazonalidade e provisao de prazo

AGENTE 3, semanal, em pg_cron:
4. Tabela fin_alerta e os 8 alertas, cada um com limiar, piso em reais e silencio
   minimo. Alerta ja disparado dentro do silencio nao repete.
   1 categoria pessoal >30% acima da media de 3m, piso R$100, silencio 30d
   2 passou da meta de retirada, silencio 7d
   3 assinatura nova (recorrente de contraparte inedita), piso R$20, uma vez
   4 provisao do mes nao separada, silencio 7d
   5 meta reversa em risco (falta >30% com <7 dias), silencio 3d
   6 importacao nao fecha com o saldo (diferenca > R$1,00), por importacao
   7 linha > R$500 sem dominio ha > 3 dias, silencio 3d
   8 base caiu abaixo de 95% julgada em valor, silencio 3d
5. Tela: bloco de alertas na Visao. Canal externo NAO entra: WhatsApp bloqueado
   por decisao, nao por codigo.
6. Assercoes fin3:, incluindo uma que prove o caso `capacidade negativa nao propoe meta`
   e uma que prove o modo BLOQUEADO.
```

---

## 9. Sequencia de execucao

```
Bloco 0   P-ESTRUTURA

Bloco 1   P-R0
          P-W1-COBERTURA
          P-W1-REPASSE
          P-R1
          P-R2
          P-AUDITA

Bloco 2   P-R5b        (proposta de regras)
          VOCE          (criar as regras e julgar, 40 a 60 min, no app)
          P-R3
          P-R4
          P-R6
          P-W2-CONTRAPARTE
          P-R5

          >>> PORTAO: fin_cobertura >= 95%, defeitos visiveis = 0,
              git igual ao banco. Se reprovar, o bloco 3 nao comeca. <<<

Bloco 3   P-W3-PESSOAL
          P-W3-AGENTE1
          P-AUDITA

Bloco 4   P-W4-META
          P-W4-AGENTES
          P-AUDITA
```

**Antes do bloco 1:** baixar os OFX dos ultimos 6 meses e importar. O dedupe por
`hash_dedupe` e `fitid` torna periodo sobreposto seguro (D-d). Isso e o que tira a
espera de calendario do bloco 3 (media de 3 meses) e do bloco 4 (modo Medio).

---

## 10. Cancelados

| Prompt | Motivo |
|---|---|
| `P-W1-CAPITAL` | D-q: nao existe aporte de investidor. Nao criar categoria de aporte, coluna natureza_capital nem view de saldo por contraparte |

---

## 11. Historico de revisao

| Rev | Data | Mudanca |
|---|---|---|
| 1 | 27/08/2026 | Consolida os prompts dos dois documentos anteriores num arquivo so. Cancela P-W1-CAPITAL. P-R0 vira condicional (o estado da divida mudou desde 26/08). Adiciona P-ESTRUTURA. Todos os prompts de bloco 3 e 4 passam a citar F1, F2, F3 e F4 |
