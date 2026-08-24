# RESULTADOS JB API 1A7 — V1.0.5 REGRAS POR BANCA

API independente da SORTE777 para consumo por outros sites.

## Regras

- Bahia regular: preserva 1º ao 10º reais da fonte; não calcula 6º/7º.
- Maluca Bahia: não herda automaticamente a regra da Bahia regular nem o cálculo genérico 6º/7º. Enquanto a regra própria não estiver definida, preserva somente os prêmios recebidos da fonte.
- Bancas compatíveis: 1º–5º da fonte, 6º por soma, 7º por produto/penúltima centena.
- Federal regular: 7º usa os números originais de 5 dígitos da CAIXA quando necessário e validado.
- Canônicos V3 preservados.

## Rotas

- `GET /health`
- `GET /bancas`
- `GET /canonicos`
- `GET /resultados?banca=<codigo>&data=AAAA-MM-DD`

## Observação

A API do SORTE777 não é alterada por este projeto.
