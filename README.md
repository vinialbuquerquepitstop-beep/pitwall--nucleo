# Pit Wall 2.0 (Nucleo) - frontend

Frontend do Pit Wall da Pitstop Imports, servido como arquivo estatico pelo
Cloudflare Worker `flat-resonance-09ba`.

URL no ar: https://flat-resonance-09ba.pitstopimports.workers.dev

## Estrutura

```
/
├── wrangler.jsonc      config do deploy (nome do Worker, pasta de assets)
├── public/
│   ├── index.html      estrutura; aponta pra app.css e app.js
│   ├── app.css         estilo (tokens da referencia visual v3)
│   └── app.js          logica
└── README.md
```

Regra: TODO arquivo que o app serve vive em `public/`. O `wrangler.jsonc` e o
`README.md` ficam na raiz e nao vao pro ar.

Os tres arquivos sao um conjunto: `app.css` sozinho quebra o app. Deploy vai
com os tres (ou com os que mudaram, mas sempre na mesma leva).

## Como isso deploya

Este repo esta conectado ao Cloudflare via Workers Builds. Cada commit na
branch principal dispara um deploy automatico. Voce nao roda comando nenhum:
so commita o arquivo novo aqui e o Cloudflare sobe.

## Setup unico (so na primeira vez)

1. Criar este repositorio no GitHub (privado).
2. Subir os tres arquivos preservando a pasta `public/`.
3. No Cloudflare: Workers & Pages, abrir `flat-resonance-09ba`, aba Settings,
   secao Build, conectar este repositorio do GitHub.
   - Build command: deixar vazio (nao ha build, e HTML puro).
   - Deploy command: manter o padrao (`npx wrangler deploy`).
4. Salvar. O primeiro deploy roda sozinho.

## Deploy do dia a dia

Empurrar pra branch `main` E o deploy. Nao existe staging: o que sobe, sobe pro
dono no meio do atendimento. Combinar horario antes.

1. Commitar a mudanca (arquivo completo, nunca pedaco: fragmento ja corrompeu
   este projeto no passado).
2. `git push origin main`. O Cloudflare deploya em seguida.
3. Conferir que o Worker vivo serve o arquivo novo, comparando o md5 do que
   esta no ar com o do repo. "Empurrei" nao e o mesmo que "esta no ar".

## Rede de seguranca

- Cada commit e um backup permanente com historico e diff. E daqui que se
  recupera qualquer versao antiga.
- O Cloudflare tambem guarda as versoes deployadas. Se um deploy sair ruim:
  Workers & Pages, `flat-resonance-09ba`, aba Deployments, tres pontos na
  versao boa anterior, Rollback. Volta em dois cliques.
