# Handoff calculadora Pit Wall v16 — a primeira lista real, e os tres defeitos que ela achou

12/09/2026, noite. Substitui o v15 como topo da linha.

Linguagem: prosa sem acento, sem cedilha, sem travessao (convencao do `CLAUDE.md`).

---

## 1. O que aconteceu, em ordem

1. **O dono escolheu o `.zip` do export.** A tela lia o zip como texto, os bytes viravam
   caractere nulo, e `calc_carga_abrir` voltou 400 `unsupported Unicode escape sequence`
   (22P05) duas vezes. Nada gravado. A segunda tentativa foi no site publicado, que
   ainda nao tinha a correcao (medido pelo `referer` do log).
2. **Pelo preview, a lista leu:** carga `43c964ff`, 76 lidas, 35 casaram (46,1%), um
   fornecedor (MP Imports). O dono viu no passo 4 os aparelhos "por 100".
3. **A causa, medida linha a linha:** a MP escreve `🔋94% à 100%` numa linha propria.
   `calc_preco` pegava o 100. E o outlier (preco acima de 1,6x o menor da combinacao)
   EXPULSOU os `R$` verdadeiros como fora de faixa: as 31 linhas `R$` foram para
   duvidoso, e 35 de 35 produtos sairam entre R$ 90 e R$ 100. A cobertura era a bateria.
4. **O dono nao aprovou.** A carga foi descartada pela RPC depois do conserto (lista
   apagada, D6). A tabela da calc segue a de 17/08/2026.

## 2. Os consertos

| Defeito | Onde | Prova |
|---|---|---|
| bateria, horario e prazo lidos como preco | `supabase/migrations/20260912_calc_preco_nao_le_porcentagem.sql`, aplicada pelo `base` | secao P e fixture G: **120 assercoes** (62 + 34 + 24), 0 falhas |
| `.zip` lido como texto | tela: le o zip (prefere `_chat.txt`, ignora `__MACOSX`), UTF-16, recusa binario antes do banco | `prova_alimentar.py` |
| export em ingles (mes/dia) | tela: descarta a leitura com mes > 12 ou no futuro; empate, AM/PM decide; sem sinal, dia/mes | `prova_alimentar.py` |
| 35 quedas misturadas nas variacoes | tela: queda de mais da metade em card vermelho com confirmacao propria | `prova_alimentar.py` |

**Pre-prova antes de aplicar** (PROCESSO 5.4), em bloco revertido contra a lista real:
**40 lidas, 40 casaram (100%)**, 35 produtos da MP com menor preco R$ 1.599,99, nenhum
abaixo de R$ 500; helpers antigos intactos. Conferido depois que reverteu (md5 antigo).

**Aplicada pelo `base`:** md5 `623a0b5a...` -> `f3f891db7e99144fb3ff11a0e4c12539`, ACL
`{postgres=X/postgres}`, uma so funcao, fumaca 40/40/0, advisors 9 sem entrante. A
lacuna que ele apontou (`garantia 12 meses 4.299`) foi medida depois: 4299.

**`prova_alimentar.py`: 102 assercoes**, estavel. Os testes de ARQUIVO e DATA rodam no
Node com as funcoes extraidas do HTML real: no Chrome com `--virtual-time-budget`, ate um
`.txt` de 100 bytes travava em `file.arrayBuffer()` (4 de 4 rodadas, com a tela certa), e
`--timeout` nao segura o dump. Mutacoes: 16, todas reprovadas, e duas escaparam primeiro
(o `__MACOSX` e o AM/PM nao tinham caso na fixture) ate a fixture ganhar o caso.

## 3. Registros honestos

- **A rodada do leitor nao foi byte a byte o gerado:** encurtei o `declare` e o texto de
  tres mensagens de falha da secao E ao colar. As condicoes sao identicas. Laco e
  catalogo foram verbatim.
- **As provas de banco nao rodaram contra o `calc_preco` antigo** para ver a secao P
  reprovar. O defeito foi medido na fixture G no leitor antigo (os dois produtos a 100),
  em bloco revertido, antes de escrever as assercoes.
- **Gravei dois caracteres de controle literais** (NUL, U+FFFD) no HTML e na prova ao
  escrever a checagem deles. Pego ao revisar, trocados por escape, e agora ha assercao
  estatica de que o arquivo da tela nao tem nenhum dos dois.

## 4. O que segue aberto

- **O outlier so olha para cima.** Qualquer preco baixo errado que ainda nao conhecemos
  expulsa o preco certo do mesmo jeito. Proteger no LEITOR e decisao do dono: pendencia
  de `preco` so aceita `ignorar`, entao uma promocao real ficaria sem caminho. A tela ja
  destaca a queda forte; a trava no leitor espera essa decisao.
- **O portao do Bloco 2 (D7) segue sem medida.** O dono precisa ler a lista de novo.
- Commit local; **push aguardando o ok do dono** (inclui a correcao do zip, `091c889`).
- Tudo da secao 6 do v15.

## 5. O proximo passo

1. O dono le a lista de novo (preview `http://localhost:8788/calc/alimentar/`, ou o
   site depois do push) e **para antes de responder pendencia**.
2. A Torre le a primeira leitura no banco e passa a mesma lista pela skill (D7).
3. Decisao do dono: guarda contra preco baixo no leitor, e com que saida para promocao.
