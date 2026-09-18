# External Calc Frontend V1 — Rebuild

Primeira tela reconstruída do External Calc após o gate \`ARCHITECTURE ENOUGH\`.

## Autoridades

- comportamento/domínio: Functional Contracts 01–05;
- lifecycle: Execution Envelope & Lifecycle V1;
- boundary executável: Executable Contract Schemas V1;
- visual: EXTERNAL_CALC_DESIGN_SYSTEM_V1 + Stitch Visual Contract V1.

## Escopo atual

\`Analisar\`:

- entrada por texto / .txt;
- estados NOT_STARTED / RUNNING / SUCCEEDED / FAILED;
- ReviewedOffer;
- VALID / REVIEW_REQUIRED;
- inválidos;
- evidência/proveniência;
- review local de fixture;
- gate visual para habilitar Calcular posteriormente.

## Segurança

Preview isolado:

- sem Supabase;
- sem banco;
- sem escrita;
- sem segredo;
- sem tenant vindo do cliente;
- sem produção.

## Regra de integração

O frontend consome C01 por provider/boundary. Quando o Interpreter real estiver pronto, o provider fixture é substituído pelo adapter real sem redesenhar a página.
