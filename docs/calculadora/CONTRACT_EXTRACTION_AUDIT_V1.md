# CONTRACT EXTRACTION AUDIT V1

Data: 17/09/2026
Branch: `feat/calculadora-interpretador-contracts-v1`
Objetivo: separar o que pertence ao Interpreter Core do que pertence ao Pitwall Adapter e a operacao da Calculadora.

## 1. Regra de classificacao

Cada responsabilidade atual foi classificada em uma das tres camadas:

- `CORE`: interpretacao pura e portavel;
- `ADAPTER`: traduz entre o Core e a infraestrutura Pitwall;
- `OPERATION`: regra operacional/financeira/UI que nao pertence ao interpretador.

Nenhuma mudanca operacional foi aplicada nesta fatia.

---

## 2. Acoplamentos medidos no estado atual

### 2.1 Assinatura do parser

O leitor vivo culmina em:

```text
privado.calc_parse_v2(
  p_tenant uuid,
  p_texto text,
  p_condicoes jsonb,
  p_forn_abertos text[],
  p_precos_ok text[]
) -> jsonb
```

Problema arquitetural:

- `p_tenant` mistura isolamento/persistencia com interpretacao;
- `p_condicoes`, `p_forn_abertos` e `p_precos_ok` misturam respostas humanas e estado operacional com o contrato do motor;
- o resultado JSON atual e moldado para `calc_carga_abrir`, nao para um consumidor generico.

Destino:

```text
p_texto         -> RawDocument.content
p_tenant        -> sai do Core; adapter monta KnowledgeSnapshot
p_condicoes     -> policy/local resolution overlay fora do Core persistente
p_forn_abertos  -> local resolution / approved context overlay
p_precos_ok     -> validation policy / local resolution overlay
```

### 2.2 `calc_carga_abrir`

Hoje a RPC:

1. resolve tenant/papel;
2. chama parser;
3. le `calc_dados` anterior;
4. preserva fornecedores sem lista nova;
5. cria carga;
6. grava `texto_bruto`;
7. converte `pendencias` em linhas de `calc_pendencia`.

Classificacao:

| Responsabilidade | Camada futura |
|---|---|
| autenticar papel dono | OPERATION |
| obter tenant | ADAPTER/OPERATION |
| montar conhecimento do tenant | ADAPTER |
| interpretar texto | CORE |
| preservar custo antigo de fornecedor ausente | OPERATION |
| criar rascunho | OPERATION |
| persistir texto bruto | OPERATION |
| converter ambiguidades em pendencias | ADAPTER |

Conclusao: `calc_carga_abrir` nao deve virar o Core. Ela deve futuramente chamar o Core por uma porta estavel.

### 2.3 `calc_pendencia_resolver` / releitura

Hoje a resolucao humana pode:

- criar alias;
- criar regra de descarte;
- registrar decisao;
- reler o texto bruto inteiro.

No desenho novo:

```text
human decision
   -> Pitwall Adapter/Operation
   -> atualiza catalogo/regra/local overlay
   -> gera novo KnowledgeSnapshot
   -> chama interpret() novamente
```

O Core nao conhece o verbo operacional `apontar`, `criar`, `definir`, `descartar` ou `ignorar`.
Ele conhece apenas:

- knowledge recebido;
- local resolutions recebidas;
- resultado/ambiguidades/propostas devolvidas.

### 2.4 Catalogo atual

O dicionario atual mistura:

- ontologia de produto;
- aliases;
- fornecedores/pracas;
- categorias;
- condicoes;
- formato final do blob de custo;
- regras de margem e derivacao de venda.

Separacao futura:

```text
KnowledgeSnapshot
  entities
  aliases
  semantic_rules
  supplier_profiles

DomainSchema
  campos
  tipos
  obrigatoriedade
  validadores
  roles estruturais

Pitwall Operation
  margem
  menor custo
  blob calc_dados
  consultor
  aprovacao
```

Margem nunca entra no Core.

### 2.5 Helpers atuais

Helpers como `calc_capacidade`, `calc_preco` e partes de `calc_parse_v2` sao candidatos a migrar para modulos puros do Core.

Mas a migration de 14/09 mostra que os helpers atuais ainda carregam conhecimento de dominio hardcoded:

- modelos iPhone 11-17;
- tokens `air/pro/max/plus/mini/xr/xs/se`;
- tamanhos de Watch;
- familias Garmin especificas;
- familias Apple/JBL.

Esses comportamentos precisam ser divididos em:

1. regra estrutural generica;
2. conhecimento fornecido por `DomainSchema`/`KnowledgeSnapshot`.

Exemplo:

```text
"numero imediatamente apos token de modelo pode ser capacidade"
```

pode ser regra estrutural.

Mas:

```text
64/128/256/512 sao capacidades validas para este dominio
```

pertence ao schema/conhecimento do dominio.

---

## 3. Contratos criados nesta fatia

Arquivos:

```text
docs/calculadora/contracts/v1/raw-document.schema.json
docs/calculadora/contracts/v1/domain-schema.schema.json
docs/calculadora/contracts/v1/knowledge-snapshot.schema.json
docs/calculadora/contracts/v1/interpretation-bundle.schema.json
```

### 3.1 RawDocument

Responsavel apenas por entrada e metadados da fonte.

Nao contem tenant, margem ou decisao humana.

### 3.2 DomainSchema

Declara estrutura do dominio sem acoplar fornecedor.

Serve para retirar do pipeline central listas fixas de categoria/campo.

### 3.3 KnowledgeSnapshot

Snapshot somente leitura da memoria disponivel para uma rodada.

O Core nao sabe de onde veio: Supabase, JSON, fixture ou outro banco.

### 3.4 InterpretationBundle

Saida portavel contendo:

- registros interpretados/inferidos;
- ambiguidades;
- invalidos;
- trace por campo;
- propostas de aprendizado;
- metricas e versoes.

---

## 4. Mapa de traducao do resultado atual

O resultado atual do parser possui conceitos como:

```text
produtos
cabecalhos
descartes
pendencias
cobertura
n_lidas
n_casou
n_duvidoso
n_descarte
n_pendencia
```

Mapeamento inicial:

| Atual | Core V1 |
|---|---|
| `produtos` | `records[]` |
| `cabecalhos` | `segments[]` + roles/trace |
| `descartes` | `invalid[]` ou segmento `noise`, conforme causa |
| `pendencias` | `ambiguities[]` |
| `cobertura` | derivada de `metrics` pelo consumidor |
| `n_lidas` | `metrics.n_lines` |
| `n_casou` | `metrics.n_records` + detalhe por state |
| `n_duvidoso` | `metrics.n_ambiguous` |
| `n_descarte` | `metrics.n_invalid` com causa apropriada |
| `n_pendencia` | `metrics.n_ambiguous` ou agrupamento do Adapter |

Importante: agrupamento de cem ocorrencias iguais em uma unica pendencia e uma decisao de produto do Pitwall Adapter. O Core deve preservar ocorrencias/evidencias e pode sugerir grupos, mas nao precisa reproduzir a tabela `calc_pendencia`.

---

## 5. Fronteira proposta para a primeira funcao pura

```text
interpret(request) -> InterpretationBundle
```

Request conceitual:

```json
{
  "document": { "...": "RawDocument" },
  "schema": { "...": "DomainSchema" },
  "knowledge": { "...": "KnowledgeSnapshot" },
  "policy": {
    "minimum_score": 0.0,
    "allow_inference": true,
    "local_resolutions": []
  }
}
```

A funcao nao pode:

- consultar banco;
- ler variavel de ambiente operacional;
- resolver usuario/tenant;
- escrever arquivo;
- chamar RPC;
- aprovar dado;
- calcular margem;
- atualizar memoria.

---

## 6. Primeiro recorte implementavel

A primeira implementacao nao deve tentar substituir `calc_parse_v2`.

Ela deve fazer apenas:

```text
RawDocument
 -> normalize
 -> split lines/segments
 -> structural role candidates
 -> InterpretationBundle parcial
```

Sem resolver produto ainda.

Estado esperado dos registros nessa fatia:

- nenhuma escrita;
- nenhum impacto em `calc_carga_abrir`;
- nenhuma alteracao de banco;
- execucao via fixture/CLI local;
- comparacao em shadow mode.

Isso permite provar a separacao estrutural antes de portar regras de preco/modelo/contexto.

---

## 7. Gates da proxima fatia

A proxima fatia so passa se:

1. o modulo rodar sem Supabase;
2. o modulo nao importar codigo da UI;
3. aceitar `RawDocument` valido;
4. devolver `InterpretationBundle` valido;
5. preservar `raw`/origem de cada segmento;
6. classificar estrutura sem branch por fornecedor;
7. fixtures cobrirem pelo menos texto simples, cabecalho, produto, preco isolado, nota e lixo;
8. nenhuma chamada de rede;
9. nenhum write;
10. o leitor atual permanecer intocado.

---

## 8. Decisao arquitetural desta fatia

O Interpreter Core sera extraido **por contrato primeiro, comportamento depois**.

Nao vamos portar o monolito PL/pgSQL para outra linguagem linha por linha. Isso apenas mudaria o local do acoplamento.

A ordem correta e:

```text
contratos
-> representacao intermediaria
-> estrutura
-> contexto
-> candidatos
-> resolucao por knowledge
-> validacao/abstencao
-> adapter Pitwall
```

Esta e a base para a implementacao da primeira funcao pura.
