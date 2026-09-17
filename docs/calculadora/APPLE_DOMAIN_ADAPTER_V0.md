# Apple Domain Adapter V0 — shadow

## Objetivo

Primeira ligação entre o Interpreter Core independente e conhecimento real versionado da Calculadora Pitwall.

Esta fatia nao substitui `calc_parse_v2`, nao escreve no banco e nao altera a Calculadora em producao. O leitor atual continua sendo a verdade operacional.

## Escopo desta V0

Apenas iPhone.

O objetivo e provar que o Core generico consegue receber conhecimento Apple por contrato, em vez de receber regras Apple no codigo do motor.

Arquivos:

- `ferramentas/interpreter-core/v1/domains/apple-iphone-v0.schema.json`
- `ferramentas/interpreter-core/v1/domains/apple-iphone-v0.knowledge.json`
- `ferramentas/interpreter-core/v1/prova_apple_domain.js`

## Fontes usadas

O adapter foi derivado somente de artefatos versionados no repositorio:

- `supabase/migrations/20260908_calc_catalogo_semente.sql`
- `supabase/migrations/20260910_calc_catalogo_apelidos_das_listas.sql`
- `ferramentas/prova_calc_catalogo.sql`

A seed atual confirma, entre outros, modelos `16e` e `17e`; por isso a informacao antiga de que eles faltavam no catalogo nao deve ser carregada para esta V0.

## Fronteira arquitetural

### Core

Continua sem saber o que e Apple ou iPhone.

Ele apenas executa:

1. extratores declarados pelo `DomainSchema`;
2. heranca de contexto;
3. resolucao contra `KnowledgeSnapshot`;
4. composicao de registro quando existe `record_trigger`;
5. abstinencia diante de entidade ausente ou ambigua.

### DomainSchema Apple

Declara nesta V0:

- como reconhecer identidade canonica de modelo iPhone;
- capacidade em GB;
- condicao;
- um conjunto inicial de cores;
- formato de preco seguro o bastante para o shadow;
- `price` como gatilho de registro;
- `model` como ancora de contexto.

### KnowledgeSnapshot Apple

Contem um subconjunto controlado do catalogo real para a prova shadow, com codigos canonicos que espelham `calc_modelo`.

Tambem contem aliases reais ou representacoes estreitas, por exemplo:

- `iPhone Air 256GB` -> `iphone_17_air_256gb`;
- forma com travessao do bloco `iPhone 13 Pro – 128GB`;
- formas selecionadas sem `GB`, como `iPhone 16 128`.

Alias estreito e deliberado: nao se deve ensinar `iPhone 16` apontando para uma capacidade especifica.

## Provas da V0

`prova_apple_domain.js` cobre:

1. linha inline canonica `iPhone 17 256GB`;
2. distincao da capacidade 512GB;
3. forma sem `GB` resolvida por alias;
4. alias `iPhone Air 256GB` -> `iPhone 17 Air 256GB`;
5. bloco CPO com modelo na linha anterior ao preco;
6. modelo desconhecido -> ambiguidade + proposta de aprendizado, sem registro;
7. valor baixo isolado nao vira preco operacional no shadow;
8. produto pode ser interpretado mesmo sob cabecalho de fornecedor desconhecido;
9. bundle permanece explicitamente sem persistencia e sem escrita de preco.

## Regra de seguranca

Nesta fase, `interpretResolved()` produz somente um candidato de interpretacao.

Mesmo quando um registro e `interpreted`, isso NAO autoriza:

- gravar custo;
- aprovar carga;
- substituir `calc_parse_v2`;
- criar alias;
- criar modelo;
- inferir fornecedor;
- calcular margem.

## Limitacoes conhecidas

- snapshot Apple ainda e propositalmente parcial;
- apenas iPhone esta coberto;
- cores e condicoes ainda sao literais, nao entidades canonicas;
- fornecedor nao faz parte desta fatia;
- precos muito baixos sao recusados pelo formato shadow, mas a politica definitiva de outlier ainda pertence a uma etapa de validacao;
- nao ha ainda comparador automatico entre `calc_parse_v2` e o novo Core;
- nao ha ainda ingestao do corpus real completo de fornecedores nesta branch.

## Gate para a proxima fatia

Esta V0 so deve avançar se:

- `prova_core.js` continuar verde;
- `prova_apple_domain.js` ficar verde;
- nenhum arquivo operacional da Calculadora tiver sido modificado.

Depois disso, a proxima fatia e o **Shadow Comparator V0**: executar os mesmos recortes de lista no leitor atual e no novo Core e medir divergencias sem promover nenhuma delas automaticamente.
