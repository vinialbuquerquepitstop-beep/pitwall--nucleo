# Handoff Migracao Pit Wall (Nucleo) v34

Substitui a v33. Data: 21/07/2026.

Sessao curta, de DESENHO, nao de codigo. Estruturou o **Pitscare** (cuidado
pos-venda) em conversa e deixou 19 scripts prontos para leitura. **Nada foi gravado
no banco.** O v33 segue valendo para tudo que nao for Pitscare.

---

## 1. Headline: o Pitscare foi estruturado no papel, e e mais barato do que parecia

O dono pediu "estruturaremos o pitscare". A palavra nunca tinha aparecido no projeto
(conferido: zero ocorrencia no repo). Em conversa, definiu-se que **Pitscare e a camada
de cuidado pos-venda por cima do que ja existe**, nao um motor novo e nao um sistema de
chamado/garantia.

O achado que barateou tudo: como o dono decidiu que **todo comprador entra** (passado e
futuro, sem selecao), o Pitscare fica **coextensivo com o perfil `comprou`**. Nao e
subconjunto. **Nao precisa de coluna nova no banco:** quem tem `perfil = comprou` e
Pitscare. "Pitscare" e a roupa de comunidade que a aba `pos-venda` ja existente veste.

Entrega desta sessao, versionada:
`docs/superpowers/specs/2026-07-21-pitscare-estruturacao.md` (commit `5a67fd5`).

---

## 2. Decisoes do dono (em ordem, como foram tomadas)

1. **Dominio:** pos-venda / cuidado com quem ja comprou. Recusado enquadrar como
   ticket de garantia/assistencia (seria objeto novo com estado e SLA; nao e o pedido).
2. **Quem entra:** TODO comprador, sem criterio de valor nem selecao manual.
3. **Grandfathering:** compradores ANTIGOS tambem entram, nao so os novos. "Daqui em
   diante" vale para o arranque do programa, nao para separar cliente velho de novo
   (o inverso disso fideliza ao contrario).
4. **Fila:** Pitscare **NAO reordena a fila** e nao ultrapassa lead nem comprador novo.
   Rejeitada a prioridade que fura fila, pelo argumento "prioridade pra todos =
   prioridade pra ninguem". O reconhecimento e visual, nao de posicao.
5. **Cor distinta:** adiada pelo dono ("posteriormente"). Quando entrar, e cor de
   IDENTIDADE (eixo Trilho): medida (`prova_trilho.py`, alvo 3:1), com icone
   obrigatorio, chaveada por `codigo`, em matiz ainda livre.
6. **Tom das mensagens:** corporativo COM humanidade, sem emoji, frase inteira,
   registro premium. A primeira leva (casual, com emoji) foi REPROVADA pelo dono e
   reescrita.
7. **P1 apresenta o programa:** o cliente precisa entender o que e o Pitscare no
   primeiro toque, nao so ouvir o nome.
8. **P6 (1 ano):** "feliz aniversario de iPhone" + gancho de upgrade. P5 aprovado sem
   mudanca.
9. **Nao construir agora:** gestao de beneficio, pontos, niveis (invariante 17).

---

## 3. Os 19 scripts

Prontos no spec, secao 5. Destino: `dicionario_scripts`, chaveados por
`perfil = comprou` + `passo` + `variante` (Direto=1, Consultivo=2, Leve=3). As 3
variantes cumprem papeis distintos (invariante 14). Servidos read-only por
`sugerir_mensagem`, sem texto fixo no JS (invariantes 13 e 11).

- 6 passos (`P1 · D1 pos-venda` a `P6 · D365 upgrade`) x 3 variantes = 18.
- +1: **P6 generico de reserva**, porque "aniversario de iPhone" quebra para quem
  comprou MacBook/AirPods. Qual disparar (por tipo de `produto`) fica pra implementacao.

Assinatura formal `Vini, da Pitstop Imports` SO no P6 (invariante 15). Placeholders
`{nome}` e `{modelo}`; **`{modelo}` mapeia pro campo `produto` do `lead`** (confirmar no
momento de gravar).

---

## 4. O que NAO foi feito, e por que

- **Banco intocado.** O MCP do Supabase estava **sem autorizacao** nesta sessao (o passo
  2 do arranque, "verificar o estado vivo do banco", nao pode ser cumprido). Nenhuma
  leitura ao vivo, nenhuma escrita. Tudo no spec vem do modelo de dados documentado e da
  regua, nao de leitura viva. **Reautorizar via /mcp em sessao interativa** antes de
  qualquer gravacao.
- **Nenhuma tela.** Esta sessao e desenho + texto. A fatia palpavel proposta (nao feita)
  esta na secao 6 do spec.

---

## 5. Proximos passos (herda a lista da secao 6 do spec)

1. Reautorizar o MCP do Supabase.
2. Conferir o que ja existe em `dicionario_scripts` no perfil `comprou` (passo 0 =
   fallback, e passos 1 a 6) para nao sobrescrever. Hoje a tabela tem ~126 linhas.
3. Gravar os 19 scripts via `apply_migration` (lida com acento e payload grande,
   transacional). Refazer REVOKE/GRANT se recriar funcao.
4. Confirmar mapeamento `{modelo}` -> `produto` e que a aba `pos-venda` renderiza a
   mensagem sugerida via `sugerir_mensagem`.
5. **Fatia palpavel sugerida:** a aba `pos-venda` mostrando o P1 (boas-vindas) sugerido
   para um comprador real, pra o dono ler o tom no sistema rodando, antes de completar o
   resto.
6. Cor distinta do Pitscare: so quando o dono retomar; seguir as regras da secao 4 do
   spec.

---

## 6. Pendencias

Todas as da v33 (secao 9) seguem abertas: 401 da Edge Function sem log, fidelidade do
`index.ts`, calibrar meta de captacao, ligar captacao -> lead, dashboard antes da view,
`registrar_nota` sem uso, aba padrao Fila/Hoje, Leaked Password Protection, monolito
morto no Desktop, token do GitHub em texto puro, legado Estrategia/Metricas/Evolucao,
`contItem` codigo morto, `LEIA-ME.md` afirmando que nao ha node.

Nova desta sessao:

| # | Item | Nota |
|---|---|---|
| 17 | Gravar os 19 scripts do Pitscare no banco | Bloqueado ate reautorizar Supabase |
| 18 | Regra de qual P6 disparar (iPhone x generico) | Por tipo de `produto`, na implementacao |
| 19 | Cor de identidade do Pitscare | Adiada pelo dono; regras no spec secao 4 |

---

## 7. Invariantes reforcados nesta sessao (nada novo, so alcance)

- **A chave e o `codigo`, nunca o rotulo:** Pitscare = `comprou`, e "Pitscare" e display.
- **Cor de identidade se mede** (a cor futura do Pitscare passa por `prova_trilho.py`).
- **Assinatura formal so em primeiro contato / silencio longo** (invariante 15): P6 leva,
  P1 a P5 nao.
- **Sugestao de mensagem e a unica fonte de texto, read-only** (invariantes 13 e 11): os
  scripts vao pro `dicionario_scripts`, nunca pro JS.
- **Nao erguer superficie cara antes de precisar** (invariante 17): sem gestao de
  beneficio/pontos.
