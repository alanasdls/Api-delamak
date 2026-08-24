# Resultados JB API 1–7

API independente para sites legados/compatíveis que consomem apenas posições do 1º ao 7º prêmio.

## Objetivo
- Não alterar a `resultados-jb-api` usada pelo SORTE777.
- Usar a API atual somente como origem de dados.
- Preservar o payload e limitar arrays de prêmios/posições para 1º–7º.
- Manter as 12 bancas canônicas.

## Rotas
- `GET /health`
- `GET /bancas`
- `GET /resultados?banca=rio-federal`
- `GET /resultados?banca=nacional&data=2026-08-24`

## Bancas
`rio-federal`, `maluquinha`, `bahia`, `sorte-rs`, `minas-gerais`, `look-goias`, `boa-sorte-goias`, `sao-paulo`, `lotece`, `lotep`, `capital`, `nacional`.

## Deploy
1. Crie um Worker separado com nome sugerido `resultados-jb-api-1a7`.
2. Suba estes arquivos sem substituir o Worker atual do SORTE777.
3. Rode `npx wrangler deploy`.
4. Teste `/health`, `/bancas` e pelo menos duas bancas em `/resultados`.

## Importante
Esta V1.0.1 é uma camada de compatibilidade 1–7. Ela não modifica a API origem e não altera a `sorte-777-api`.
