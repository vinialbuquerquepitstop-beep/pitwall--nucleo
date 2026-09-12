# Handoff calculadora Pit Wall v15 — a tela Alimentar

12/09/2026, noite. Substitui o `handoff_calculadora_pitwall_v14.md` como topo da
linha. O v14 segue valendo para as provas de banco; o v13 para a secao 8 (o que
nao foi provado).

Linguagem: prosa sem acento, sem cedilha, sem travessao (convencao do `CLAUDE.md`).

---

## 1. Arranque

1. `CLAUDE.md` (a suite agora tem DOZE comandos).
2. `docs/calculadora/PROCESSO.md` (secao 5 ganhou a prova nova e o teste de mutacao).
3. O plano, secao **2.3**, bloco "A TELA ENTREGUE", com o que a execucao contradisse.
4. Este arquivo.

---

## 2. O que entrou

| Arquivo | O que e |
|---|---|
| `public/calc/alimentar/index.html` | a tela, arquivo sozinho como as duas calcs |
| `public/calc/index.html` | um link na aba Catalogo: `Alimentar preços: colar lista de fornecedor →` |
| `ferramentas/prova_alimentar.py` | 76 assercoes, Chrome headless contra stub |

**Zero mudanca de banco.** A tela le as tabelas `calc_*` (a RLS filtra tenant e
papel) e escreve SO pelas cinco RPCs que ja existiam: `calc_carga_abrir`,
`calc_pendencia_resolver`, `calc_catalogo_criar`, `calc_carga_aprovar`,
`calc_carga_descartar`. O contrato de cada uma foi lido no corpo VIVO antes de
escrever a tela (md5 do resolver `456d9bc97d532235f8bc8c7445f51b2a`).

A pagina, de cima para baixo:

1. **Colar** a lista ou escolher o `_chat.txt`. Mostra as datas das mensagens ao
   colar. Com uma leitura em andamento, a caixa some: uma lista por vez, e a
   anterior se aprova ou descarta (D6: a lista bruta nao fica esquecida no banco).
2. **O que a leitura achou:** `casaram X de Y linhas (Z%)`, `N linhas não
   entraram`, descartes por motivo com exemplo, fornecedores reconhecidos,
   aviso de **custo velho** acima de 7 dias, e o `fornecedor_conferir`:
   `suspeita_alta` vira card vermelho com confirmacao.
3. **Pendências**, abertas primeiro e fornecedor antes de tudo, cada uma com os
   verbos que a RPC aceita para aquele tipo:

   | tipo | verbos |
   |---|---|
   | fornecedor | apontar, criar, nunca ler este fornecedor, deixar fora |
   | modelo | apontar, criar (com categoria), nunca e preco, deixar fora |
   | cor | apontar, nunca e preco, deixar fora |
   | condicao | dizer a condicao (so as ATIVAS), deixar fora |
   | preco | deixar fora |

   Apontar, criar e descartar dizem "vale para toda lista futura, desfazer ainda
   nao existe". Recusa do banco aparece no card, sem o prefixo da funcao.
4. **O que o sistema aprendeu** (D19): "desta lista" e "tudo", do mais novo para
   o mais antigo, regra pelo MOTIVO, vazio com frase.
5. **Conferir e aprovar:** novos, subiram, cairam, sumiram, iguais; tabela das
   variacoes acima de 15%; fornecedores sem lista nova com a data do custo
   antigo. O botao so acende com as travas (secao 3).

---

## 3. As obrigacoes, uma por uma

| Origem | Obrigacao | Onde |
|---|---|---|
| D16 | "Nunca mais ler preço deste fornecedor, em nenhuma lista", com `ignorar` ao lado | form de descartar fornecedor |
| v13 sec. 9 | o descarte amarra a GRAFIA | "Vale para o cabeçalho escrito exatamente `X`. Se ele aparecer escrito de outro jeito, a pendência volta." |
| v12 obr. 2 | a decisao GRAVADA manda | estado de cada card sai de `calc_pendencia.decisao`; ignorada segue respondivel |
| v12 obr. 3 | `n_linhas` congelado | "2 linhas na 1ª leitura" |
| D14 | sugestao da lista anterior pre-selecionada, nada entra sem confirmar | botao ja marcado + "Confirmar condição" |
| 2.4a ter | quase-igual e pergunta, nao erro | "É a mesma pessoa: apontar" / "É outro fornecedor: criar mesmo assim" (manda `confirmar_novo`) |
| D19 1 a 5 | filtro, motivo, data da linha, vazio com frase, duas visoes | secao do aprendido |
| D10 | `fornecedor_conferir` dificil de ignorar | card vermelho e trava no aprovar |
| plano 2.3 | cobertura medida, linhas fora, descarte contado, custo velho | passo 2 |

**As travas do aprovar moram na tela porque o banco nao as tem** (medido no corpo
de `calc_carga_aprovar`: pendencia aberta nao bloqueia, e `suspeita_alta` nem e
lida). O botao exige: cada bloco suspeito conferido, as pendencias abertas
aceitas, as variacoes acima de 15% conferidas, e pelo menos um preco desta lista.
Depois, um segundo clique de confirmacao.

---

## 4. A prova, e como sei que ela reprova

`python ferramentas/prova_alimentar.py` → **PASSOU, 76 assercoes, EXIT 0**.

Abre o arquivo REAL em quatro iframes (carga aberta em 360px, sem carga, papel
vendedor, sem sessao), com o supabase-js trocado por um stub que filtra por
`eq`/`neq` de verdade e registra toda chamada. Clica e le o DOM. Dados
inventados (`Loja Alfa`, `Loja Beta`, `Loja Gama`), nenhum valor real.

**Passou de primeira, e por isso foi estragada de proposito.** Com
`PROVA_ALIMENTAR_ALVO` apontando para uma copia mutada, oito mutacoes, oito
reprovacoes: aprovar sem trava, ordem com `0||9`, regra pelo padrao, D16 sem o
texto, descartar em preco, sugestao sem pre-selecao, texto sem escape, cobertura
sem percentual.

**Um defeito real a prova pegou antes de existir, na revisao:** a ordenacao
fazia `ORDEM_TIPO[tipo]||9`, e fornecedor tem ordem 0: `0||9` o mandava para o
FIM da lista, o contrario do desenho. Consertado com `in`, e a mutacao 2 e o que
impede a volta. Mesma familia do `\b` e do `calc()` colado: falha calada.

Suite inteira, EXIT 0 em todos: `validar.py`, `harness.py` (1114 passou, 0
falhou), `prova_trilho`, `prova_grafico`, `prova_atmosfera`, `prova_taxas`,
`node --check`, `prova_cpo` (39), `prova_sem_margem` (22), `prova_catalogo`
(119), `prova_alimentar` (76), `diag_mobile` nas cinco, `diag_largo` nas tres,
`diag_calc` nas tres.

---

## 5. Decisoes tomadas nesta sessao, e por que

- **Construida pela Torre, sem o `vitrine`.** O `vitrine` nao tem acesso ao banco,
  e a tela dependia de ler o corpo vivo de cinco RPCs; ele tambem ja travou nesta
  mesma calc (PROCESSO 4.2). Registrado para nao virar habito.
- **Sem `pit-guard`:** a tela nao cria caminho de escrita; as cinco RPCs e a
  barreira de papel delas ja passaram por ele nas fatias anteriores.
- **Pagina propria em `/calc/alimentar/`**, nao setima aba: a barra de abas ja
  esta no limite em 360px, e colar export de WhatsApp e tarefa de computador.
- **Uma pagina com secoes, nao wizard de quatro telas:** o dono precisa ver a
  cobertura mudar enquanto responde, e isso so da com as duas na mesma tela.

---

## 6. O que NAO foi provado, e as dividas

- **Nada rodou contra o banco de verdade.** A tela nunca abriu carga real. O
  preview local (secao 7) usa sessao e banco de PRODUCAO.
- **O portao do Bloco 2 (D7) nao foi medido:** a mesma lista pelos dois caminhos.
- **"N linhas nao entraram, com a lista":** so o numero; a lista linha a linha
  exige o leitor devolve-la no `resumo`.
- **Travas do aprovar so na tela.** Quem chamar a RPC por fora pula as tres.
  Candidata a migration: `calc_carga_aprovar` recusar `suspeita_alta` sem
  confirmacao gravada.
- **Re-render apaga o que foi digitado em outro formulario aberto.** Abrir um
  segundo verbo com o primeiro preenchido perde o texto do primeiro.
- **Upload grande:** nao medido com export real de muitos MB.
- Tudo da secao 8 do v13 segue aberto.

---

## 7. O proximo passo: o portao e do dono

1. **Conferir a tela no preview local** (servidor em `http://localhost:8788`,
   abrir `http://localhost:8788/calc/alimentar/`). Banco de PRODUCAO: "Ler a
   lista" grava uma carga em rascunho (se descarta pela propria tela), e
   "Aprovar" troca a tabela da calculadora.
2. Push (e o deploy), so depois do ok dele.
3. **O portao:** a lista real do mes pela tela, sozinho, e a mesma lista pelo
   caminho da skill, comparando `casou / lidas / descartadas` (D7). Consulta de
   registro na secao 2.3 do plano.
4. Depois: a trava de `suspeita_alta` no banco, a 2.4c (desfazer) e o
   isolamento vendedor/tenant da secao G.
