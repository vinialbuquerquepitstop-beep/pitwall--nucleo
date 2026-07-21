# Spec: estruturacao do Pitscare (cuidado pos-venda)

Data: 21/07/2026. Estrutura conversada e aprovada pelo dono nesta sessao.

Nota de linguagem: a PROSA deste documento segue a convencao do CLAUDE.md (sem acento,
sem cedilha, sem travessao). Os SCRIPTS de mensagem sao produto (texto que vai pro
cliente), entao aparecem em portugues correto, com acentuacao, e nao devem ser
"limpos". Valores reais do sistema (codigos, perfis, passos, nomes de campo) aparecem
com seus caracteres exatos.

Estado desta obra: **desenho + scripts prontos para leitura. NADA foi escrito no banco
ainda.** O passo de gravar em `dicionario_scripts` depende do Supabase, que estava com
o MCP sem autorizacao nesta sessao.

---

## 1. O que e o Pitscare (definido pelo dono, nesta ordem)

Pitscare e a camada de **cuidado pos-venda** da Pitstop, construida POR CIMA do que ja
existe, nao um motor novo. Decisoes tomadas na conversa:

1. **Dominio:** pos-venda / cuidado com quem ja comprou.
2. **Quem entra:** TODO cliente que comprou, passado e futuro. Sem selecao, sem
   criterio de valor. Comprou com a Pitstop = e Pitscare.
3. **Consequencia da decisao 2:** como todo comprador entra, `pitscare` e coextensivo
   com o perfil `comprou`. Nao e subconjunto. Nao precisa de coluna nova no banco: quem
   tem `perfil = comprou` e Pitscare. A palavra "Pitscare" e a roupa de comunidade que a
   aba `pos-venda` veste.
4. **Fila:** o Pitscare NAO reordena a fila e NAO ultrapassa lead nem comprador novo.
   O beneficio de reconhecimento e visual (cor distinta), nao passe livre. Rejeitada a
   ideia de prioridade que fura fila ("prioridade pra todos = prioridade pra ninguem").
5. **Cor distinta:** adiada pelo dono ("posteriormente"). Quando entrar, e cor de
   IDENTIDADE (eixo Trilho), com as regras duras do sistema (ver secao 4).
6. **Gestao de beneficio / pontos / niveis:** NAO construir agora (invariante 17).

## 2. Onde o Pitscare pousa no que ja existe

O perfil `comprou` ja tem cadencia propria de 6 passos (fonte: `cadencia_regra`, e a
regua em `regua-cadencia.md`), e ja existe a aba `pos-venda` no front expondo o fluxo.
O perfil `comprou` nao freia por resposta, nao esfria e nao transiciona, de proposito.

Os 6 passos (rotulo exato e offset incremental em dias):

| Passo | Rotulo | Offset |
|---|---|---|
| P1 | `P1 · D1 pos-venda` | 1 |
| P2 | `P2 · D7 tudo certo?` | 6 |
| P3 | `P3 · D30` | 23 |
| P4 | `P4 · D90` | 60 |
| P5 | `P5 · D180 upgrade?` | 90 |
| P6 | `P6 · D365 upgrade` | 185 |

O Pitscare **reescreve os scripts** desses 6 passos com voz de cuidado e apresentacao de
comunidade. Nao muda a regua, nao muda os offsets, nao muda o schema.

## 3. As tres camadas do Pitscare

| Camada | Decisao | Quando |
|---|---|---|
| Entrada | todo `comprou` e Pitscare, passado e futuro, automatico, sem coluna nova | ja |
| Fila | NAO reordena, nao ultrapassa lead/comprador novo | ja (por omissao) |
| Mensagem / comunidade | scripts de apresentacao + cuidado na cadencia `comprou` | esta obra (secao 5) |
| Cor distinta | identidade medida + icone, keyed por `codigo` | adiado pelo dono |
| Upgrade | gancho `P5 · D180` / `P6 · D365` ja existe; beneficio real de estoque e operacao | quando quiser turbinar |
| Gestao de beneficio / pontos | nao construir | invariante 17 |

## 4. Regras a respeitar quando a COR entrar (adiada)

Cor de cliente Pitscare e identidade (quem sou), no mesmo eixo dos Trilhos:

- **Se mede, nao se escolhe no olho.** Alvo 3:1 contra branco, provado por
  `python ferramentas/prova_trilho.py`.
- **Sempre com icone.** Matiz sozinho nao separa (colisoes de luminancia 1.14 a 1.44);
  o icone carrega a distincao. Cor sem icone e regressao, e o harness reprova.
- **Chave e o `codigo`, nunca o rotulo.** E precisa ser um matiz ainda nao ocupado (ja
  ha 6 regioes semanticas + 7 trilhos no sistema).

## 5. Os scripts (19 no total)

Destino: `dicionario_scripts`, chaveados por `perfil = comprou` + `passo` + `variante`.
Convencao de variante: **Direto = 1, Consultivo = 2, Leve = 3** (rotulos
`rotulo_variante`). Servidos read-only por `sugerir_mensagem`. NADA de texto fixo no JS
(invariantes 13 e 11). As 3 variantes cumprem papeis DISTINTOS (invariante 14): Direto
vai ao ponto; Consultivo posiciona o Vini como quem entende e oferece ajuda concreta;
Leve e humano e sem pressao.

Placeholders: `{nome}` e `{modelo}`. **`{modelo}` mapeia pro campo `produto` do `lead`**
(o aparelho comprado). Confirmar no momento de gravar pra nao virar placeholder orfao.

Tom aprovado pelo dono: corporativo com humanidade, sem emoji, frase inteira, registro
premium (combina com o mundo Apple). A primeira versao (casual demais, com emoji) foi
reprovada.

Assinatura formal `Vini, da Pitstop Imports` SO no P6 (invariante 15: primeiro contato
ou reativacao apos silencio longo). P1 a P5 sao conversa ja em curso, sem assinatura.

### P1 · D1 pos-venda (apresentacao do programa)

**Direto**
> Oi {nome}, seja bem-vindo ao Pitscare. Com a sua compra, você entra no programa de cuidado da Pitstop: suporte direto comigo, prioridade nas condições de troca e acompanhamento para o seu {modelo} durar bem. Estou por aqui para o que precisar.

**Consultivo**
> Oi {nome}, seja bem-vindo ao Pitscare. A partir de agora você tem um ponto de contato direto comigo para tudo que envolver o seu {modelo}: uma dúvida de configuração, um ajuste para render mais, a hora certa de pensar numa troca. É esse acompanhamento próximo que define o programa. Se quiser, já te passo dois ajustes que aproveitam melhor o aparelho desde o primeiro dia.

**Leve**
> Oi {nome}, seja bem-vindo ao Pitscare. Para a gente, a relação não termina na entrega do {modelo}, começa nela. Como cliente Pitstop, você passa a fazer parte do nosso cuidado: estou por perto para o que precisar, sem pressa e sem cobrança. Por enquanto, é aproveitar.

### P2 · D7 tudo certo? (uma semana)

**Direto**
> Oi {nome}, uma semana de {modelo}. Está tudo funcionando como esperado, bateria, tela, desempenho? Se apareceu qualquer detalhe, me avisa que resolvo rápido.

**Consultivo**
> Oi {nome}, o {modelo} já teve uma semana de uso real, tempo suficiente para você sentir como ele se comporta no seu dia. Bateria aguentando a rotina, desempenho à altura? Se algo não convenceu, me diz que eu te ajudo a ajustar ou encaminho a solução na hora.

**Leve**
> Oi {nome}, faz uma semana do {modelo}. Passando só para saber se você está gostando e se está tudo tranquilo por aí. Qualquer coisa, é só me chamar, esse acompanhamento faz parte do Pitscare.

### P3 · D30 (um mes)

**Direto**
> Oi {nome}, um mês de {modelo}. Está tudo em ordem? Se conhecer alguém pensando em trocar de aparelho, é só me indicar, cuido da pessoa com o mesmo padrão.

**Consultivo**
> Oi {nome}, um mês de {modelo}. A essa altura você já tem uma noção clara do aparelho, então queria confirmar que ele está correspondendo ao que você esperava. E se alguém do seu círculo comentar sobre trocar de celular, será um prazer orientar essa pessoa como orientei você.

**Leve**
> Oi {nome}, um mês já de {modelo}. Espero que esteja curtindo bastante. Se está tudo certo, fico feliz, é o que a gente busca. E se pintar alguém querendo trocar de aparelho, você sabe onde me achar.

### P4 · D90 (tres meses, sem venda)

**Direto**
> Oi {nome}, três meses de {modelo}. Sem assunto comercial: está tudo em ordem com o aparelho? Seu suporte Pitscare continua aberto.

**Consultivo**
> Oi {nome}, três meses de {modelo}. Nessa fase costuma aparecer alguma dúvida de uso mais avançado ou de manutenção, então fico à disposição se quiser trocar uma ideia sobre como manter o aparelho no melhor estado. Sem agenda de venda, é cuidado mesmo.

**Leve**
> Oi {nome}, três meses de {modelo}. Passando sem motivo além de saber se está tudo bem com você e com o aparelho. Seu lugar no Pitscare continua de pé, hoje e sempre que precisar.

### P5 · D180 upgrade? (seis meses)

**Direto**
> Oi {nome}, seu {modelo} completou seis meses. Como Pitscare, você tem prioridade nas condições de troca: fica sabendo antes do geral. Quer que eu coloque seu perfil no radar para te avisar quando surgir algo que valha a pena?

**Consultivo**
> Oi {nome}, seu {modelo} já tem meio ano de uso. Costuma ser cedo para trocar, mas é a hora certa de começar a acompanhar o valor do seu aparelho e as condições que aparecem, para você trocar no melhor momento, não no primeiro que surge. Como Pitscare, você tem prioridade nesse radar. Quero deixar seu perfil marcado para te avisar?

**Leve** (texto aprovado pelo dono sem alteracao)
> Oi {nome}, seu {modelo} já tem seis meses de estrada. Como Pitscare, você tem prioridade quando aparece uma boa condição de troca: você fica sabendo antes. Quer que eu deixe seu perfil no radar pra te avisar se surgir algo que valha a pena? Sem compromisso nenhum.

### P6 · D365 upgrade (um ano, aniversario de iPhone, assinatura formal)

**Direto**
> Oi {nome}, hoje o seu {modelo} completa um ano. Feliz aniversário de iPhone. Esse é o momento em que a troca mais compensa: seu aparelho ainda vale bem na entrada e as novidades do ano já justificam o passo. Como Pitscare, você tem a primeira olhada antes de abrir para o geral. Posso montar uma condição para você?
>
> Vini, da Pitstop Imports

**Consultivo**
> Oi {nome}, hoje faz um ano do seu {modelo}. Feliz aniversário de iPhone. Um ano é o ponto em que vale a pena fazer as contas: o seu aparelho ainda tem um bom valor de entrada, e o que chegou desde então costuma justificar a troca. Se quiser, eu levanto quanto o seu valeria hoje e o que isso te aproxima do próximo, sem compromisso. Como Pitscare, essa análise é sua antes de todo mundo.
>
> Vini, da Pitstop Imports

**Leve**
> Oi {nome}, seu {modelo} faz um ano hoje. Feliz aniversário de iPhone. Antes de qualquer conversa de troca, queria só marcar a data e agradecer por esse ano com a Pitstop. E, se bater a vontade de renovar, você é Pitscare: tem a primeira olhada nas melhores condições antes do geral. Fico à disposição.
>
> Vini, da Pitstop Imports

**P6 generico (reserva, para quem NAO comprou iPhone: MacBook, AirPods etc.)**
> Oi {nome}, hoje faz um ano do seu {modelo}. Parabéns por esse ano juntos. Costuma ser um bom momento para avaliar uma troca: seu aparelho ainda tem valor de entrada e as novidades do ano ajudam na conta. Como Pitscare, você tem a primeira olhada antes de abrir para o geral. Posso montar uma condição para você?
>
> Vini, da Pitstop Imports

Nota sobre o P6: o dono pediu explicitamente "feliz aniversario de iPhone". Como o
Pitscare vale pra todo comprador e nem todos compram iPhone, o P6 generico e a reserva
pra nao mandar "aniversario de iPhone" pra quem comprou MacBook/AirPods. Decisao de qual
disparar (por tipo de produto) fica pra fase de implementacao.

## 6. Proximos passos (nao feitos nesta sessao)

1. **Reautorizar o MCP do Supabase** (via /mcp em sessao interativa). Sem isso nao da
   pra gravar nem conferir o banco.
2. **Conferir se ja existe script no passo 0 do `comprou`** (fallback generico) e nos
   passos 1 a 6, pra nao sobrescrever nada. `dicionario_scripts` hoje tem ~126 linhas.
3. **Gravar os 19 scripts** em `dicionario_scripts` (`apply_migration`, que lida com
   acento e payload grande). Refazer REVOKE/GRANT se recriar funcao (invariante do
   CLAUDE.md sobre ACL).
4. **Confirmar o mapeamento `{modelo}` -> `produto`** e conferir que a aba `pos-venda`
   renderiza a mensagem sugerida via `sugerir_mensagem`, read-only.
5. **Cor distinta do Pitscare:** so quando o dono retomar. Seguir a secao 4.
6. **Fatia palpavel sugerida:** a aba `pos-venda` mostrando o P1 (boas-vindas) sugerido
   para um comprador real, pra o dono ler o tom no sistema rodando, antes de completar
   o resto.
