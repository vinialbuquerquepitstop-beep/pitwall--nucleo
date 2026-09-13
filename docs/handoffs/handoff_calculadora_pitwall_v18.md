# Handoff calculadora Pit Wall v18 — a lista completa nao cabia no tempo

12/09/2026, noite. Substitui o v17 como topo da linha.

Linguagem: prosa sem acento, sem cedilha, sem travessao (convencao do `CLAUDE.md`).

---

## 1. O defeito, medido

O dono leu pela tela a lista COMPLETA (export de grupo, 375 KB) e recebeu
`canceling statement due to statement timeout`.

| Medida | Valor |
|---|---|
| POST do `calc_carga_abrir` | 374.950 bytes, 500 com 57014 apos 9.831 ms |
| `statement_timeout` do papel `authenticated` | 8s (`anon` 3s) |
| leitor, antes | ~10 ms por linha, linear: 34 linhas 346 ms, 142 linhas 1.274 ms, 547 linhas 5.235 ms |
| trecho a trecho, 541 linhas | modelo 6.749 ms, cor 2.291 ms, regras 220 ms, limpar e preco 143 ms |

## 2. D21: a tela manda so os ultimos 7 dias

Decisao do dono, escolhida entre tres opcoes (7 dias, janela escolhida a mao, mandar tudo).
Motivo alem do tempo: mensagem de meses atras poe preco velho na conta do menor preco.

| Peca | O que faz |
|---|---|
| `recortarLista(txt, dias, hoje)` | corta pelas datas das mensagens, no formato que `datasDaLista` escolheu (dia/mes ou mes/dia). A borda (hoje menos 7) entra. Linha sem carimbo segue a mensagem de cima. Lista sem data, ou com data invalida, nao se corta |
| select `aJanela` | 7 dias (padrao), 15, 30, todas; troca antes de ler |
| frase das datas | `... Entram 2 mensagens de 05/09/2026 para cá; 1 mais antiga fica de fora.` |
| janela sem mensagem | erro na tela, nenhuma RPC |
| tempo esgotado (57014) | `A lista é grande demais para ler de uma vez (N linhas): o banco para em 8 segundos. Diminua a janela de dias ou corte a lista. Nada foi gravado.` A lista fica na caixa |

**Limite declarado:** fornecedor que mandou a tabela ha 8 dias fica fora da leitura e
aparece no passo 4 como "sem lista nova", com o custo antigo. O dono troca a janela.

**Prova:** `prova_alimentar.py` **119 assercoes** (eram 107). O cenario S1 passou a usar
datas RELATIVAS a hoje (com data fixa, o corte reprovaria a prova depois de uma semana).
Teste de mutacao em copias: borda (`>=` para `>`), mandar o texto inteiro e a mensagem do
timeout. As tres reprovam.

## 3. Leitor mais rapido, mesma saida

Migration `supabase/migrations/20260912_calc_leitor_rapido.sql`, no molde da D20: le o
`prosrc` vivo, confere o md5 `00044db7d28144a8db783bb4a8d2a4ef`, 6 trocas exatas, recria
com a mesma assinatura (`create or replace`).

- CTEs `mods` e `mtok` (tokens, capacidade e polegada dos modelos, uma vez por leitura),
  `cores_c` e `apel_c` (regex das cores prontas); `lcap`, `ltoks`, `lpol` uma vez por linha;
  a cor da linha de preco passa antes pelo filtro de `v_cores` (a mesma lista, cores e
  apelidos, que o `so_cor` ja usava).
- **Pre-prova em bloco revertido:** as 6 trocas casam 1 vez; saida jsonb IDENTICA nas 8
  fixtures (A a H), numa chamada com `p_condicoes` e `p_forn_abertos`, e num texto de 697
  linhas. Tempo do texto grande: **6.973 ms -> 3.926 ms**. md5 novo esperado
  `1baff6f9e949678d9e5c79b1f04227c0`.
- **Aplicada pelo `base`:** version `20260913012008` (`calc_leitor_rapido`), md5
  `00044db7...` -> `1baff6f9e949678d9e5c79b1f04227c0` (igual ao da pre-prova), ACL
  `{postgres=X/postgres}` antes e depois, 1 funcao so (sem sobrecarga), mesma assinatura;
  fumaca 2 lidas = 2 casou + 0 + 0; advisors 9, nenhum novo.
- **Provas de banco depois, VERBATIM dos gerados:** leitor **62**, laco **34**, catalogo
  **29** = **125, 0 falhas**. Os enxugados foram regenerados e conferidos byte a byte.
- **O que NAO foi provado:** o caminho real que estourou (`calc_carga_abrir` como
  `authenticated` com a lista do dono). So o dono tem o arquivo; o passo 2 da secao 5 mede.

**Nao e 20x, e o perfil diz por que.** `track_functions` num bloco revertido, 826 linhas,
5.256 ms: `calc_parse_v2` self 2.401 ms (as consultas dentro dela), `calc_norm` 49.855
chamadas (60 por linha, 847 ms), `calc_limpar` 587 ms, `calc_preco` 504 ms,
`calc_capacidade` 314 ms, `calc_polegada` 257 ms, `calc_tokens` 232 ms. Nao sobra gargalo
unico: **375 KB nao cabem em 8s so acelerando o banco.** O proximo candidato, se precisar,
e achar quem chama `calc_norm` 60 vezes por linha.

## 3b. D22: o limite do papel sobe de 8s para 30s

Decisao do dono, 13/09/2026: *"banco cortou em 8 segundos com a lista completa. aumente"*.

**Medido antes:** a tela ja cortou para 7 dias (envio de 374.950 para **85.613 bytes**, log
de 02:40:50 UTC) e `calc_carga_abrir` ainda parou (57014, origem 9.202 ms).
`calc_carga_abrir` inteira gasta o mesmo que o leitor: 826 linhas em 5.082 ms (6,15 ms por
linha), bloco revertido. Estimativa para 86 KB: ~15 s. 30s e o dobro.

Migration `supabase/migrations/20260913_calc_timeout_authenticated_30s.sql`:
`alter role authenticated set statement_timeout = '30s'` e `notify pgrst, 'reload config'`.
Aplicada pelo `base` (version `20260913024456`): authenticated `statement_timeout=30s`, anon
(3s) e authenticator (8s, lock 8s) iguais, reload na mesma migration, advisors 9. A frase de tempo esgotado na tela diz 30 segundos;
`prova_alimentar` 119, EXIT 0.

**Custo declarado ao dono:** o limite e do PAPEL, nao da funcao. Vale para toda chamada de
todo usuario logado (dono e vendedor), em todas as telas; uma consulta presa segura a
conexao ate 30s. `anon` segue em 3s. **Por que nao na funcao:** o relogio do
`statement_timeout` e armado quando o statement de fora comeca, e o PostgREST aplica o valor
do papel antes da chamada. **Desfazer:** `alter role authenticated set statement_timeout =
'8s'; notify pgrst, 'reload config';`.

**Ainda nao provado:** a lista do dono dentro de 30s. So ele tem o arquivo.

## 4. Estado ao fechar

- Commits locais, sem push: `7732718` (D20 na tela), `d61d34f` (corte de 7 dias).
- Cargas `ea8cebc4` e `43c964ff` descartadas; tabela da calc de 17/08 (494 produtos); nada
  aprendido nesta sessao.

## 5. O proximo passo

1. O dono confere no preview (`http://localhost:8788/calc/alimentar/`) e autoriza o push.
2. O dono le a lista completa de novo, com a janela de 7 dias. Se ainda estourar, a frase
   diz quantas linhas foram; medir e decidir (janela menor, ou achar o `calc_norm`).
3. Portao D7 com a carga do mes inteira (outros fornecedores).
4. Depois: a 2.4c (desfazer) e o isolamento vendedor/tenant da secao G.
