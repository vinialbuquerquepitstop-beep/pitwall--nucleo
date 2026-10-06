# External Calc — Batch Supplier Intake V0

## Operação real

A entrada primária é um pacote ZIP contendo listas recebidas de múltiplos fornecedores.

Fluxo:

`ZIP → entradas seguras → identificar fornecedor → List Intake existente → source/supplier → C01 → catálogo/revisão`

## Regras

- V0 processa TXT e CSV dentro do ZIP.
- Não executa conteúdo do arquivo.
- ZIP aninhado é rejeitado por entrada.
- Outros formatos são ignorados e reportados.
- Máximo: 10 MB comprimido, 64 entradas, 2 MB por entrada, 24 MB descomprimido.
- ZIP64, multi-disco, entrada criptografada, path traversal e expansão acima do limite são rejeitados pelo leitor seguro existente.
- Fornecedor existente é reconhecido por telefone/nome em evidência.
- Fornecedor novo só é criado automaticamente quando o cabeçalho possui confiança >= 0,95.
- Em dúvida, o arquivo fica REVIEW_REQUIRED e não é vinculado silenciosamente.
- Cada arquivo processado usa o mesmo `processListIntakeCommand` da entrada unitária. Não existe segunda regra C01.

## Estados por arquivo

- PROCESSED
- REVIEW_REQUIRED
- SKIPPED_UNSUPPORTED
- REJECTED_NESTED_ARCHIVE
- SUPPLIER_CREATE_FAILED
- INTAKE_FAILED

## Critério de gate

PASS exige prova de:
1. fornecedor existente;
2. fornecedor novo de alta confiança;
3. fonte sem fornecedor não ser atribuída;
4. arquivo não suportado ser ignorado;
5. ZIP aninhado não ser aberto;
6. C01/list-intake existente continuar verde.
