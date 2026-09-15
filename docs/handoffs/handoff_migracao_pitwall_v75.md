# Handoff migracao v75 - Fila Operacional v2, Fatia 5 integrada

Data: 15/09/2026. Linha: migracao / CRM. Substitui o `handoff_migracao_pitwall_v74.md` como topo desta linha.

Linguagem: prosa sem acento, sem cedilha, sem travessao.

## 1. Estado fechado desta sessao

A Fatia 5 da Fila Operacional v2, `Modo Proximo`, foi implementada, provada e integrada ao `main`.

| Ref | Hash |
|---|---|
| `main` imediatamente antes da Fatia 5 | `f60524ce53b38e7550c276622bc75b366c03c95a` |
| branch final da Fatia 5 | `5963f7b78f66fb4fc58149c08e4fc64015048b4a` |
| commit de produto na branch | `f2699dbbc62fdbd7378024e5b74bb4b75ab9eb20` |
| merge real no `main` | `99e7d68e1c2888867022162e52df279b343db7a0` |

O merge `99e7d68` tem dois pais: `f60524c` e `5963f7b`.

A arvore do merge e exatamente a arvore final da branch que passou pelas provas.

Nao houve migration, alteracao de schema, nova RPC ou escrita de dado de producao nesta fatia.

## 2. O que a Fatia 5 entrega

A fila agora funciona como rotina sequencial de execucao.

Quando o operador conclui uma acao de resultado dentro da aba Fila:

1. a base e relida;
2. a fila operacional e recalculada inteira;
3. a ordenacao existente continua sendo aplicada;
4. o primeiro card valido da nova fila vira o proximo item operacional;
5. esse card recebe destaque discreto e foco;
6. a operacao pode continuar sem escolher manualmente a ordem a cada lead.

O comportamento foi implementado como acelerador da fila existente, sem criar uma segunda regra de prioridade.

## 3. Contrato de prioridade preservado

O Modo Proximo nao possui algoritmo proprio de ordenacao.

A ordem continua vindo de `vOperacional`, que combina comercial e pos-venda e aplica `cmpVer`.

Depois de cada desfecho na Fila, o frontend chama o reload completo existente e escolhe o primeiro card ja renderizado pela ordem soberana da fila.

Isso evita divergencia entre:

- a ordem visual;
- a ordem usada pelo Modo Proximo;
- comercial e pos-venda;
- prioridade, valor em jogo, vencimento e nome.

## 4. Mudanca funcional

Foram adicionados dois comportamentos ao frontend:

- `filaSelecionarProximo(focar)`: limpa qualquer selecao anterior, marca o primeiro card da fila como `modo-proximo` e, quando solicitado, faz scroll e foco;
- `modoProximo(id)`: limpa cache de sugestao do lead concluido, relê a base inteira com `B(true)` e depois foca o primeiro item valido da fila recalculada.

`aposAcao` agora usa `modoProximo` apenas quando a acao ocorreu na aba `fila`.

As demais abas continuam usando a atualizacao localizada anterior com `trocarCard`, preservando o comportamento existente fora do Modo Proximo.

Ao abrir ou renderizar a fila, o primeiro item ja nasce marcado como proximo, mas sem scroll automatico.

## 5. Mudanca visual

O primeiro item operacional recebe a classe `modo-proximo`.

O destaque usa apenas:

- borda com `--accent-linha`;
- halo discreto com `--accent-tint`;
- outline de foco com `--accent`.

Nao foi criado novo componente, painel ou dashboard.

## 6. Arquivos persistentes da Fatia 5

O diff final contra o `main` anterior ficou restrito a:

- `public/app.js`;
- `public/app.css`;
- `ferramentas/prova_fila_operacional_v2_fatia5.js`.

O patch e o workflow temporarios usados para aplicar e provar a mudanca foram removidos antes do merge.

## 7. Validacao tecnica

Runner final: GitHub Actions `34932115442`.

Resultados:

- `validar.py`: TUDO PASSOU;
- `prova_fila_operacional_v2.js`: 30 OK, 0 falhas;
- `prova_fila_operacional_v2_fatia3.js`: 10 OK, 0 falhas;
- `prova_fila_operacional_v2_fatia4.js`: 10 OK, 0 falhas;
- `prova_fila_operacional_v2_fatia5.js`: 10 OK, 0 falhas;
- `git diff --check`: passou;
- escopo do produto no runner: somente `public/app.js` e `public/app.css`.

A prova da Fatia 5 trava explicitamente:

- existencia do Modo Proximo como comportamento proprio;
- reload completo da fila depois de desfecho;
- proximo item vindo da primeira posicao da fila renderizada;
- ordem soberana continuando na fila existente;
- desfechos da Fila entrando no Modo Proximo;
- outras abas preservando atualizacao localizada;
- primeiro item marcado ao abrir a fila;
- foco sem registrar toque ou disparar mensagem;
- estado visual discreto;
- nenhuma regra nova de prioridade.

## 8. Invariantes preservados

Continuam valendo:

- abrir WhatsApp nao registra toque;
- toque e resposta sao fatos diferentes;
- nenhuma mensagem comercial foi duplicada no frontend;
- `sugerir_mensagem` continua sendo a fonte unica da copy;
- historico continua append-only;
- nenhuma escrita direta de lead foi introduzida;
- canal e consentimento continuam guardas do WhatsApp;
- `Fechou` nao converte sem venda registrada;
- o Modo Proximo nao cria prioridade paralela;
- nenhuma RPC nova foi criada.

## 9. Proximo passo oficial

A proxima fatia do processo e a **Fatia 6 - Indicadores de execucao**.

Objetivo:

- medir comportamento operacional real da fila;
- definir fonte e significado de cada indicador;
- incluir apenas numeros que mudem uma decisao operacional.

Indicadores minimos candidatos definidos no processo:

- tarefas validas para hoje;
- atrasados reais;
- concluidos hoje;
- sem canal;
- taxa de execucao da fila;
- tempo ate primeiro toque;
- respostas por toque;
- pos-venda devido x executado.

Antes de implementar, medir quais desses numeros ja podem ser derivados com seguranca dos fatos existentes e quais exigem contrato adicional.

Nao antecipar alertas da Fatia 7 nesta etapa.

## 10. Aberto paralelo

Continua separado o defeito visual mobile preexistente registrado nos handoffs anteriores.

Ele nao foi causado nem tratado pela Fatia 5.

Tambem seguem fora desta fatia as revisoes paralelas de consentimento, venda sem WhatsApp e repescagem por evento.

## 11. Veredito

Fatia 5 fechada no codigo e integrada ao `main`.

A fila agora consegue conduzir uma sessao sequencial: conclui o item atual, recalcula a ordem e coloca o proximo item valido em foco sem inventar prioridade, contato ou evento.

Proxima entrega: **Fatia 6 - Indicadores de execucao**.
