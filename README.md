# Resultados JB API 1–7 — V1.0.3

API independente para sites que consomem resultados do 1º ao 7º prêmio.

## V1.0.3
- Mantém a API do SORTE777 intacta.
- Consolida o payload: não expõe `fontes` brutas na resposta normal.
- Remove extrações inválidas como `TITLE`.
- Aplica filtro estrito de `data_resultado` quando `?data=AAAA-MM-DD` é informado.
- Sem `?data`, usa a data mais recente encontrada nas extrações válidas.
- Para códigos duplicados, prioriza a candidata com 7 posições; em seguida, a de maior quantidade de prêmios.
- Entrega somente posições 1–7 normalizadas.
- Informa `completo_1a7` por extração e resumo de completas/incompletas.
- Não depende de Service Binding do SORTE777; usa apenas `ORIGEM_URL` pública.

## Rotas
- `GET /health`
- `GET /bancas`
- `GET /resultados?banca=rio-federal&data=2026-08-23`
- `GET /resultados?banca=rio-federal&data=2026-08-23&debug=1`

## Bancas
`rio-federal`, `maluquinha`, `bahia`, `sorte-rs`, `minas-gerais`, `look-goias`, `boa-sorte-goias`, `sao-paulo`, `lotece`, `lotep`, `capital`, `nacional`.

## Observação
A V1.0.3 é uma camada consolidada 1–7 sobre a API origem atual. Ela não modifica a API origem e não altera a `sorte-777-api`.


## V1.0.3 — Códigos canônicos V3
- Expõe `loteria_canonica` nas 12 bancas, no topo de `/resultados` e em cada extração.
- Nova rota `GET /canonicos`.
- Usa exclusivamente os códigos confirmados da V3.
- Não inventa `grade_canonica`; o código/horário da extração de origem é preservado até integração do catálogo exato de grades V3.
