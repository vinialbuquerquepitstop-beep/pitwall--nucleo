# Indice mestre de handoffs do Pit Wall

Aponta o TOPO (maior N) de cada linha de dominio. A Torre atualiza este arquivo ao
fim de todo processo. Estado conferido em 28/07/2026 com `git ls-files`, nao
copiado de documento: as fontes do time citavam `migracao v41` e `seguranca v1`, e
nenhuma das duas batia com o repo.

## Linha migracao (fio historico principal)

- topo: `handoff_migracao_pitwall_v47.md` (08/08/2026, relatorio de entrega na aba
  Vendas + cadastro de motoboy com botao que despacha num toque. 6 migrations, 1
  tabela, 1 coluna, 43 assercoes novas que CLICAM. Os seis campos pedidos ja
  existiam na `venda`: a obra virou uma coluna e uma tela. Defeito da sessao: a
  suite travou calada por um `\n` mal escapado dentro da string Python do teste;
  nasce o watchdog do harness)
- anterior: `handoff_migracao_pitwall_v46.md` (05/08/2026, Fatia 1 da aba Escopo: 8
  frentes de operacao, placar com nota calculada no banco, criar/mudar
  status/travar/descartar. 3 tabelas, 6 migrations, 22 commits. Cinco defeitos
  achados e fechados na execucao, um deles uma aba que NAO ABRIA convivendo com
  cinco suites verdes. **Os numeros de prova dele envelheceram**: dizia harness
  172/3 e validar EXIT 1, e o HEAD de 08/08 media 196/8 e EXIT 0)
- 43 arquivos na pasta. O de maior versao substitui todos os anteriores.

## Linha seguranca (pit-guard)

- topo: (vazio)
- NAO existe nenhum `handoff_seguranca_pitwall_vN.md` no repo. O
  `time_agentes_pitwall.md` afirmava que a v1 existia: nao existe aqui. O primeiro
  handoff desta linha nasce `v1`.

## Linha backend (base)

- topo: (vazio). Enquanto a migracao for o fio principal, o `base` pode seguir na
  linha migracao. Quando abrir esta linha, declarar no handoff qual escolheu.

## Linha frontend (vitrine)

- topo: (vazio)

## Linha qa (bandeira)

- topo: (vazio). A bandeira nao tem Write: ela entrega o texto e a Torre grava.

## Linhas ainda sem agente proprio

`dados` (modo Painel), `devops` (modo Box) e `produto` (modo Estrategista) rodam
como MODOS da Torre ate haver volume. Quando um modo virar agente, abrir a linha
aqui.

## Regra

Ao abrir sessao: ler este indice mais o topo da linha do dominio que a tarefa
toca. Nunca confiar so no que este arquivo diz: conferir a pasta. Esta linha ja
ficou desatualizada em todo documento deste projeto que tentou fixar uma versao.
