const VERSAO = "1.0.0";
const BANCAS = [
  ["rio-federal", "Rio / Federal"],
  ["maluquinha", "Maluquinha RJ"],
  ["bahia", "Bahia / Maluca"],
  ["sorte-rs", "Sorte — Rio Grande do Sul"],
  ["minas-gerais", "Minas Gerais"],
  ["look-goias", "Look / Goiás"],
  ["boa-sorte-goias", "Boa Sorte — Goiás"],
  ["sao-paulo", "São Paulo"],
  ["lotece", "Lotece"],
  ["lotep", "Lotep"],
  ["capital", "Capital"],
  ["nacional", "Loteria Nacional"],
].map(([codigo, nome]) => ({ codigo, nome }));

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-monitor-token",
    "cache-control": "no-store",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors() },
  });
}

function asNumeroPosicao(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pareceArrayPosicoes(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  const objs = arr.filter((x) => x && typeof x === "object" && !Array.isArray(x));
  if (objs.length !== arr.length) return false;
  let comPosicao = 0;
  for (const x of objs) {
    if (asNumeroPosicao(x.posicao) !== null || asNumeroPosicao(x.ordem) !== null || asNumeroPosicao(x.premio) !== null) {
      comPosicao++;
    }
  }
  return comPosicao >= Math.max(1, Math.ceil(arr.length * 0.6));
}

function filtrar1a7(valor, chave = "") {
  if (Array.isArray(valor)) {
    if (pareceArrayPosicoes(valor)) {
      return valor
        .filter((x) => {
          const p = asNumeroPosicao(x.posicao ?? x.ordem ?? x.premio);
          return p === null || (p >= 1 && p <= 7);
        })
        .slice(0, 7)
        .map((x) => filtrar1a7(x));
    }
    if (["premios", "posicoes"].includes(String(chave).toLowerCase())) {
      return valor.slice(0, 7).map((x) => filtrar1a7(x));
    }
    return valor.map((x) => filtrar1a7(x));
  }

  if (valor && typeof valor === "object") {
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      if (k === "total_premios" && Number(v) > 7) out[k] = 7;
      else out[k] = filtrar1a7(v, k);
    }
    return out;
  }

  return valor;
}

function origemBase(env) {
  return String(env.ORIGEM_URL || "https://resultados-jb-api.alanasdls.workers.dev").replace(/\/$/, "");
}

async function buscarOrigem(requestUrl, env) {
  const u = new URL(requestUrl);
  const destino = new URL(origemBase(env) + "/resultados");
  for (const [k, v] of u.searchParams.entries()) destino.searchParams.append(k, v);
  const r = await fetch(destino.toString(), {
    headers: { accept: "application/json" },
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  const texto = await r.text();
  let payload;
  try { payload = JSON.parse(texto); }
  catch { return { ok: false, status: r.status, erro: "ORIGEM_NAO_JSON", detalhe: texto.slice(0, 500) }; }
  if (!r.ok) return { ok: false, status: r.status, payload };
  return { ok: true, status: r.status, payload };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    const url = new URL(request.url);

    if (request.method !== "GET") return json({ ok: false, erro: "METODO_NAO_PERMITIDO" }, 405);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        servico: "resultados-jb-api-1a7",
        versao: VERSAO,
        modo: "COMPATIBILIDADE_1_A_7",
        independente_sorte777: true,
        origem: origemBase(env),
        total_bancas: BANCAS.length,
        contrato: "preserva payload da origem e limita arrays de premios/posicoes a 1º–7º",
      });
    }

    if (url.pathname === "/bancas") {
      return json({ ok: true, versao: VERSAO, total: BANCAS.length, bancas: BANCAS });
    }

    if (url.pathname === "/resultados") {
      const banca = String(url.searchParams.get("banca") || "").trim().toLowerCase();
      if (!banca) return json({ ok: false, erro: "BANCA_OBRIGATORIA", bancas: BANCAS.map((x) => x.codigo) }, 400);
      if (!BANCAS.some((x) => x.codigo === banca)) return json({ ok: false, erro: "BANCA_NAO_SUPORTADA", banca, bancas: BANCAS.map((x) => x.codigo) }, 404);

      const origem = await buscarOrigem(request.url, env);
      if (!origem.ok) {
        return json({ ok: false, versao: VERSAO, erro: "FALHA_API_ORIGEM", status_origem: origem.status, detalhe: origem.payload ?? origem.detalhe ?? null }, 502);
      }

      const filtrado = filtrar1a7(origem.payload);
      if (filtrado && typeof filtrado === "object" && !Array.isArray(filtrado)) {
        filtrado.api_compat = {
          servico: "resultados-jb-api-1a7",
          versao: VERSAO,
          faixa: "1-7",
          origem_preservada: true,
        };
      }
      return json(filtrado);
    }

    return json({ ok: false, erro: "ROTA_NAO_ENCONTRADA", rotas: ["GET /health", "GET /bancas", "GET /resultados?banca=<codigo>&data=AAAA-MM-DD"] }, 404);
  },
};
