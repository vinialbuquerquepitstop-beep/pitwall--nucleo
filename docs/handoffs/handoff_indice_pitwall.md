# Indice mestre de handoffs do Pit Wall

Aponta o TOPO (maior N) de cada linha de dominio. A Torre atualiza este arquivo ao
fim de todo processo. Estado conferido em 28/07/2026 com `git ls-files`, nao
copiado de documento: as fontes do time citavam `migracao v41` e `seguranca v1`, e
nenhuma das duas batia com o repo.

## Linha migracao (fio historico principal)

- topo: `handoff_migracao_pitwall_v48.md` (08/08/2026, a forma do Stitch na Fila
  estava commitada ha dois dias e nunca tinha aparecido na tela: 16 regras de CSS
  penduradas num seletor que nao casava com nada, porque
  `patch_lista_data_aba.py` foi commitado e nunca rodado. As "8 falhas herdadas"
  que o v46 e o v47 dispensaram eram isso. 50 bytes + mover um botao levaram o
  harness de 239/8 para **247/0**, o primeiro zero em tres sessoes. Deploy
  conferido byte a byte no worker. Veredito item a item sobre o zip do Stitch:
  forma sim, paleta e numero inventado nao)
- anterior: `handoff_migracao_pitwall_v47.md` (08/08/2026, relatorio de entrega na
  aba Vendas + cadastro de motoboy com botao que despacha num toque. 6 migrations,
  1 tabela, 1 coluna, 43 assercoes novas que CLICAM. Os seis campos pedidos ja
  existiam na `venda`: a obra virou uma coluna e uma tela. Defeito da sessao: a
  suite travou calada por um `\n` mal escapado dentro da string Python do teste;
  nasce o watchdog do harness. **Cuidado ao ler:** ele trata as 8 vermelhas do
  harness como divida herdada, e o v48 provou que eram obra nao terminada)
- 44 arquivos na pasta. O de maior versao substitui todos os anteriores.

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
