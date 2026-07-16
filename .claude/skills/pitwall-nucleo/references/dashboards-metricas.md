# Dashboards e metricas

E a Fase 5, FORA da janela de 2 semanas do nucleo. So depois que leitura e escrita
estao estaveis. O valor de definir as metricas cedo nao e construir o painel agora, e
moldar o schema para que a metrica seja uma query barata depois, nao um retrofit.

## Regra de construcao

Metrica vira `VIEW` no Postgres (com `security_invoker = on`, conferido em
`pg_class.reloptions`), lida pelo front. Nunca coluna materializada que envelhece. O
mesmo principio do nivel derivado: calcular na leitura.

## Metricas candidatas (o que o dono realmente decide com elas)

Volume e distribuicao:
- Leads por perfil (contagem em `lead.perfil`), foto do funil.
- Leads por status (`pendente`/`feito`/`convertido`/`lista_fria`/`cancelado`).
- Leads por origem (de onde vem quem compra x quem some).

Ritmo e resposta:
- Taxa de resposta: leads com `respondido_em` sobre leads tocados (`ultimo_toque_em`).
- Tempo medio ate a primeira resposta.
- Cadencia em andamento vs encerrada (`cadencia_estado.encerrada`).
- Leads esfriados por silencio no periodo (evento `esfriado_por_silencio`).

Conversao e dinheiro:
- Taxa de conversao: `status = convertido` sobre total, e por perfil de entrada.
- Ticket medio e total vendido (`valor_total`), separando primeira compra de recorrente
  (`qtd_compras`).
- Pipeline de oferta em aberto (`valor_oferta` de leads ainda nao convertidos).

Pos-venda e upgrade:
- Base de `comprou` elegivel a upgrade (cruzar `upgrade_entrada` com tempo desde a
  compra, ganchos P5 D180 e P6 D365).

Uso do proprio app:
- A partir de `evento_uso` (hoje vazia): frequencia de uso, telas mais acessadas. Base
  para saber se a ferramenta esta sendo usada de fato antes de pensar em SaaS.

## Estrutura do painel (quando construir)

Uma visao de topo (numeros do dia: fila de hoje, respostas, conversoes) e blocos por
tema (funil, ritmo, dinheiro). Nada de grafico bonito sem decisao atras: cada bloco
responde a uma pergunta que muda uma acao do dono. Se um numero nao muda nenhuma
decisao, ele nao entra no painel.

## Antes de construir, a banca pergunta

Este painel vai ser olhado com que frequencia? Se a resposta e "quase nunca", a Fase 5
espera. O criterio de sucesso do sistema e a operacao diaria rodar na stack nova, nao
ter dashboard. Dashboard e conforto de leitura, entra depois do nucleo firme.
