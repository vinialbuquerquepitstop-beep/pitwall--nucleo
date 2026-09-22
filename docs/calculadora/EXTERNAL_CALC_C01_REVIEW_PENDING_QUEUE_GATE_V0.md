# EXTERNAL CALC — C01 REVIEW PENDING QUEUE GATE V0

Data: 22/09/2026
Status: IMPLEMENTATION CANDIDATE

## Problema observado no roundtrip live

O HumanReview era persistido corretamente, mas apos recarregar a Screen 03 o mesmo candidate reaparecia.

Causa:
- `extcalc_review_candidate` e imutavel por contrato;
- `listPendingCandidates()` lia diretamente todos os rows desse store;
- a leitura nao excluia candidates que ja possuíam `extcalc_human_review`.

## Correcao

A fila passa a ser uma projecao de pendencia:

```text
review candidate
MINUS
human review correspondente
=
fila pendente
```

Nova RPC:

`extcalc_list_pending_review_candidates_v0(p_limit)`

Ela:
- deriva tenant e papel pelo JWT;
- aceita somente papel `dono`;
- faz anti-join com `extcalc_human_review`;
- considera `original_offer_revision` quando uma review material produz nova revision;
- preserva `extcalc_review_candidate` sem UPDATE/DELETE;
- nao executa regra C01-C05.

O repository usa essa RPC apenas para `listPendingCandidates`.
`loadCandidate` continua carregando o candidate imutavel para a Review Authority.

## Gate

PASS quando:

1. candidato sem HumanReview aparece;
2. candidato com HumanReview correspondente nao aparece;
3. EDIT material reconhece a revision original;
4. tenant/papel continuam server-derived;
5. zero service_role;
6. zero regra C01-C05 nova;
7. candidate store permanece imutavel;
8. API de review existente continua verde;
9. roundtrip live, apos deploy, permanece vazio depois de reload.

## Evidencia que originou o gate

No roundtrip live de 22/09/2026:
- candidate foi lido no Preview autenticado;
- ACCEPT foi persistido em `extcalc_human_review`;
- C01 final foi persistido em `extcalc_offer_revision`;
- depois de reload, o candidate reapareceu.

A falha e de projecao da fila, nao de Auth, CORS, C01 Review Authority ou persistencia do resultado.
