# RESULTADOS JB API — V1.0.6 PRIORIDADE FONTE COMPLETA POR BANCA

API independente da SORTE777 para consumo por outros sites.

## Regras

- Bahia regular: preserva 1º ao 10º reais da fonte; nunca calcula 6º–10º.
- Na Bahia regular, candidatas da mesma data e horário são comparadas mesmo quando os códigos de extração diferem entre fontes.
- A candidata com posições 1–10 sequenciais completas tem prioridade absoluta.
- Se nenhuma fonte daquele horário tiver 1º–10º, retorna a melhor cobertura disponível e marca `completo_1a10: false`.
- Maluca Bahia permanece separada e não herda a regra da Bahia regular.
- Bancas compatíveis: 1º–5º da fonte, 6º por soma, 7º por produto/penúltima centena.
- Federal regular: 7º usa os números originais de 5 dígitos da CAIXA quando necessário e validado.
- Canônicos V3 preservados.

## Rotas

- `GET /health`
- `GET /bancas`
- `GET /canonicos`
- `GET /resultados?banca=<codigo>&data=AAAA-MM-DD`
- `GET /resultados?banca=<codigo>&data=AAAA-MM-DD&debug=1`

## Segurança de dados

A V1.0.6 não fabrica 6º–10º da Bahia. A prioridade de fonte só escolhe dados reais disponíveis na origem.

A API do SORTE777 não é alterada por este projeto.
