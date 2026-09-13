# Handoff calculadora Pit Wall v17 — D20 no ar, e a primeira medida do portao

12/09/2026, noite (a migration da D20 tem version 20260913000802, ja 13/09 em UTC).
Substitui o v16 como topo da linha.

Linguagem: prosa sem acento, sem cedilha, sem travessao (convencao do `CLAUDE.md`).

---

## 1. D20: o preco muito abaixo da tabela vira pergunta

Decisao do dono, citada: *"sim, o preco muito abaixo vira pergunta"*.

| Peca | O que faz |
|---|---|
| `privado.calc_parse_v2` | CTE `referencia` (menor preco da tabela gravada por modelo e condicao) e `pilha2`: preco x fator do outlier abaixo da referencia vira pergunta `abaixo da tabela: forn · modelo · cond · cor · R$ x` e sai do `minimo` do outlier. Argumento novo `p_precos_ok text[]` (DROP + CREATE). Contador `n_preco_confirmado`. |
| `privado.calc_reprocessar` | passa as confirmadas (`decisao = 'confirmar'`) a cada releitura; resumo com `n_preco_confirmado` |
| `public.calc_pendencia_resolver` | verbo `confirmar`, so em pergunta `abaixo da tabela: %`; T3 vale para ele |
| `calc_pendencia_decisao_ck` | + `confirmar` |
| tela | botao "O preço está certo" so nessa pergunta, aviso de que quase sempre e leitura errada, "preço confirmado (só esta lista)", desfazer por "Deixar fora desta lista" |

**Como a migration foi feita:** ela le o `prosrc` vivo, confere o md5 medido e troca
trechos exatos (cada troca exige 1 ocorrencia, senao nada e aplicado). O corpo de 37 KB
nao foi transcrito. Pre-prova em bloco revertido: fixtures A, B, D identicas; o R$ 300
virou pergunta e o R$ 4.100 entrou; confirmar e ignorar pelas RPCs; descartar e confirmar
outra pergunta recusados. Dois erros meus pegos na revisao ANTES de rodar: prefixo `E` em
segmento de continuacao de string e `%%` num `raise`.

**Aplicada pelo `base`:** md5 novos (leitor `00044db7d28144a8db783bb4a8d2a4ef`, releitura
`cadbd2e2ab7c18fe2e061873772c5d00`, resolver `c9d0c78f167b0d93290de37489fd6e67`), ACL
certa, sem sobrecarga, fumaca identica ao esperado e revertida (tabela 494), advisors 9.

**Limite declarado:** preco baixo CONFIRMADO entra no calculo do outlier como qualquer
outro, entao uma promocao real confirmada pode fazer os precos normais do mesmo modelo, na
mesma lista, sairem como outlier. E o comportamento que ja existia.

## 2. Provas

- **Banco: 125 assercoes, 0 falhas** (62 + 34 + 29), as tres VERBATIM dos gerados. Secao Q
  (5 assercoes, fixture H) com a tabela gravada SINTETICA dentro de subtransacao, para nao
  depender do preco real do dia. R13 atualizada para a assinatura nova.
- **Tela: `prova_alimentar.py` 107 assercoes** (+5 da D20).
- Producao intacta depois das tres rodadas (2 cargas, a do dono intacta, nada aprendido).

## 3. O portao D7, primeira medida

O dono leu de novo a lista da MP (carga `ea8cebc4`, 20:47 de Sao Paulo, DEPOIS do conserto
da bateria e ANTES da D20; a D20 nao teria o que pegar nela).

| | tela | skill (regras aplicadas a mao) |
|---|---|---|
| linhas lidas | 40 | 40 |
| casaram | 40 | 40 |
| descartadas | 0 | 0 |
| preco ou cor divergente | | 0 de 40 |

Os 35 modelos conferidos um a um, inclusive `$R$2.899,99`, `$2.949,99` sem o R, dois precos
por modelo (17 256GB, 14 Pro Max 256/128GB, 14 Pro 128GB, 13 128GB) e "Com garantia Apple"
(segue Seminovo: CPO pela skill e lacrado em caixa branca).

**O que isto NAO e:** o portao do plano e a carga do MES inteira. Foi uma lista, de um
fornecedor, num formato so. Falta medir os outros fornecedores.

## 4. Estado ao fechar

- Carga `ea8cebc4` em **rascunho, sem aprovar**: 35 produtos da MP, precos conferidos. O
  dono pode aprovar pela tela.
- Commit local; push pendente do ok do dono (a tela com o botao da D20).

## 5. O proximo passo

1. Push da tela (botao "O preço está certo").
2. O dono aprova a MP pela tela, se quiser.
3. As listas dos outros fornecedores pela tela, para completar o portao D7.
4. Depois: a 2.4c (desfazer) e o isolamento vendedor/tenant da secao G.
