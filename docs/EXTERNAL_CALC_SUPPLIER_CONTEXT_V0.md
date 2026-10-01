# EXTERNAL CALC — SUPPLIER CONTEXT V0

Status: PROPOSTA IMPLEMENTÁVEL
Objetivo: registrar fornecedores e fornecer contexto mínimo persistente para a IA Advisor interpretar listas com menos atrito.

## Princípio

A IA Advisor continua sendo responsável pela interpretação da lista.

A camada de fornecedor NÃO:
- cria parser específico por fornecedor;
- treina o Interpreter em silêncio;
- exige revisão estrutural complexa;
- transforma o usuário em operador de benchmark.

A camada de fornecedor apenas:
1. identifica o fornecedor;
2. guarda dados comerciais básicos;
3. guarda contexto curto e editável para a IA Advisor;
4. reapresenta esse contexto nas próximas listas do mesmo fornecedor.

## UX V0

### Cadastro rápido

Campos:
- nome (obrigatório)
- telefone/WhatsApp (opcional)
- endereço (opcional)
- cidade (opcional)
- observação (opcional)
- contexto_para_ia (opcional)

Exemplo de contexto_para_ia:

> Usa PM para Pro Max. Lista normalmente é atacado. Quando aparecer Anatel, manter como variante distinta.

### Uso

Fluxo principal:

Fornecedor -> Colar lista -> IA Advisor interpreta -> resultado

Quando necessário:

Resultado -> corrigir contexto do fornecedor -> reinterpretar

Não existe gate obrigatório de “calibração concluída”.

## Modelo mínimo

Supplier {
  supplier_id
  owner_user_id
  name
  phone
  address
  city
  notes
  ai_context
  created_at
  updated_at
}

SupplierListSource {
  source_id
  supplier_id
  analysis_id
  received_at
}

## Contrato com a IA Advisor

Ao interpretar uma lista vinculada a fornecedor, a IA recebe:

1. conteúdo bruto da lista;
2. supplier_id;
3. nome do fornecedor;
4. ai_context;
5. metadados relevantes já conhecidos.

O ai_context é CONTEXTO, não autoridade.

Regras:
- não substituir evidência explícita da lista;
- não inventar preço, capacidade, condição ou cor;
- em conflito entre lista e contexto, prevalece a lista;
- ambiguidade material deve ser exposta;
- correções recorrentes podem gerar sugestão de atualização do ai_context, mas nunca alteração automática.

## Separação de responsabilidades

IA Advisor
= interpreta e explica.

Supplier Context
= memória operacional curta do fornecedor.

Interpreter
= infraestrutura determinística e normalização de apoio.

C01-C05
= continuam sendo contratos funcionais do produto; Supplier Context não duplica regras.

## Slice V0

Entregar somente:

1. CRUD mínimo de fornecedor.
2. Seleção/criação rápida de fornecedor antes de colar a lista.
3. Campo “Contexto para IA”.
4. supplier_id associado à lista/análise.
5. IA Advisor recebe o contexto junto com a lista.
6. possibilidade de editar contexto e reinterpretar.

Fora do V0:
- score de fornecedor;
- estados NOVO/CALIBRADO/ESTÁVEL;
- treinamento automático;
- drift detection;
- benchmark por fornecedor;
- regras específicas compiladas no Interpreter;
- automação de contato/WhatsApp.

## Critério de sucesso

Um fornecedor novo deve poder ser cadastrado e usado em menos de 30 segundos.

Após o cadastro, uma nova lista desse fornecedor deve exigir apenas:

selecionar fornecedor -> colar lista -> interpretar.

Se o usuário precisar compreender fixtures, schemas, benchmarks ou contratos internos, o slice falhou em simplicidade.
