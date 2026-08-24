const VERSAO = "1.0.3";
// Códigos canônicos alinhados ao catálogo V3 do projeto.
const BANCAS = [
  ["rio-federal", "Rio / Federal", "RIO_FEDERAL"],
  ["maluquinha", "Maluquinha RJ", "MALUQUINHA_RJ"],
  ["bahia", "Bahia / Maluca", "BAHIA"],
  ["sorte-rs", "Sorte — Rio Grande do Sul", "SORTE_RS"],
  ["minas-gerais", "Minas Gerais", "MINAS_GERAIS"],
  ["look-goias", "Look / Goiás", "LOOK_GOIAS"],
  ["boa-sorte-goias", "Boa Sorte — Goiás", "BOA_SORTE_GOIAS"],
  ["sao-paulo", "São Paulo", "SAO_PAULO"],
  ["lotece", "Lotece", "LOTECE"],
  ["lotep", "Lotep", "LOTEP_PB"],
  ["capital", "Capital", "CAPITAL"],
  ["nacional", "Loteria Nacional", "NACIONAL"],
].map(([codigo, nome, loteria_canonica]) => ({ codigo, nome, loteria_canonica }));

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

function origemBase(env) {
  return String(env.ORIGEM_URL || "https://resultados-jb-api.alanasdls.workers.dev").replace(/\/$/, "");
}

function normalizarData(v) {
  const s = String(v || "").trim();
  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
  const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mBr) return `${mBr[3]}-${mBr[2]}-${mBr[1]}`;
  return null;
}

function normalizarHorario(v) {
  const s = String(v || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function premioNormalizado(p) {
  if (!p || typeof p !== "object") return null;
  const posicao = Number(p.posicao ?? p.ordem ?? p.premio);
  if (!Number.isInteger(posicao) || posicao < 1 || posicao > 7) return null;
  const milharRaw = String(p.milhar ?? "").replace(/\D/g, "");
  if (!milharRaw) return null;
  const milhar = milharRaw.padStart(4, "0").slice(-4);
  const centena = String(p.centena ?? milhar.slice(-3)).replace(/\D/g, "").padStart(3, "0").slice(-3);
  const dezena = String(p.dezena ?? milhar.slice(-2)).replace(/\D/g, "").padStart(2, "0").slice(-2);
  const grupoNum = Number(p.grupo);
  const out = {
    posicao,
    milhar,
    centena,
    dezena,
  };
  if (Number.isInteger(grupoNum) && grupoNum >= 1 && grupoNum <= 25) out.grupo = grupoNum;
  if (p.bicho != null && String(p.bicho).trim()) out.bicho = String(p.bicho).trim();
  return out;
}

function extracaoValida(ex) {
  if (!ex || typeof ex !== "object") return false;
  const codigo = String(ex.codigo || "").trim().toUpperCase();
  if (!codigo || codigo === "TITLE") return false;
  const nome = String(ex.nome || "").trim();
  if (!nome || nome.includes("' + title + '") || nome.toLowerCase() === "title") return false;
  return true;
}

function extrairCandidatas(payload) {
  const fontes = Array.isArray(payload?.fontes) ? payload.fontes : [];
  const candidatas = [];
  fontes.forEach((fonte, fonteIndex) => {
    const extracoes = Array.isArray(fonte?.extracoes) ? fonte.extracoes : [];
    extracoes.forEach((ex, extracaoIndex) => {
      if (!extracaoValida(ex)) return;
      const premios = (Array.isArray(ex.premios) ? ex.premios : [])
        .map(premioNormalizado)
        .filter(Boolean)
        .sort((a, b) => a.posicao - b.posicao);
      const unicos = [];
      const vistos = new Set();
      for (const p of premios) {
        if (vistos.has(p.posicao)) continue;
        vistos.add(p.posicao);
        unicos.push(p);
      }
      candidatas.push({
        codigo: String(ex.codigo).trim().toUpperCase(),
        nome: String(ex.nome || ex.codigo).trim(),
        horario: normalizarHorario(ex.horario),
        data_resultado: normalizarData(ex.data_resultado),
        premios: unicos,
        fonte_id: String(fonte?.id || `fonte-${fonteIndex}`),
        fonte_index: fonteIndex,
        extracao_index: extracaoIndex,
      });
    });
  });
  return candidatas;
}

function dataMaisRecente(candidatas) {
  const datas = candidatas.map((x) => x.data_resultado).filter(Boolean).sort();
  return datas.length ? datas[datas.length - 1] : null;
}

function scoreCandidata(c) {
  const temSete = c.premios.length >= 7 ? 100000 : 0;
  const quantidade = c.premios.length * 1000;
  const temHorario = c.horario ? 100 : 0;
  // Em empate, prioriza a fonte mais antiga/alta na ordem da origem.
  return temSete + quantidade + temHorario - c.fonte_index;
}

function consolidar(candidatas, dataAlvo, loteriaCanonica) {
  const filtradas = candidatas.filter((c) => c.data_resultado === dataAlvo);
  const porCodigo = new Map();
  for (const c of filtradas) {
    const atual = porCodigo.get(c.codigo);
    if (!atual || scoreCandidata(c) > scoreCandidata(atual)) porCodigo.set(c.codigo, c);
  }

  return [...porCodigo.values()]
    .map((c) => ({
      loteria_canonica: loteriaCanonica,
      codigo: c.codigo,
      codigo_extracao_origem: c.codigo,
      nome: c.nome,
      horario: c.horario,
      data_resultado: c.data_resultado,
      premios: c.premios.slice(0, 7),
      completo_1a7: c.premios.length >= 7,
    }))
    .sort((a, b) => {
      const ha = a.horario || "99:99";
      const hb = b.horario || "99:99";
      return ha.localeCompare(hb) || a.codigo.localeCompare(b.codigo);
    });
}

async function buscarOrigem(requestUrl, env) {
  const u = new URL(requestUrl);
  const destino = new URL(origemBase(env) + "/resultados");
  for (const [k, v] of u.searchParams.entries()) {
    if (k !== "debug") destino.searchParams.append(k, v);
  }
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
        modo: "CONSOLIDADO_1_A_7",
        independente_sorte777: true,
        origem: origemBase(env),
        total_bancas: BANCAS.length,
        contrato: "payload limpo; uma extracao consolidada por codigo; data estrita; premios 1º–7º; loteria_canonica V3",
        canonicos_v3: true,
      });
    }

    if (url.pathname === "/bancas") {
      return json({ ok: true, versao: VERSAO, total: BANCAS.length, bancas: BANCAS });
    }

    if (url.pathname === "/canonicos") {
      return json({
        ok: true,
        versao: VERSAO,
        padrao: "SORTE777_V3",
        identidade_recomendada: "data + loteria_canonica + codigo_extracao_origem + horario",
        observacao: "grade_canonica V3 não é inventada nesta camada; somente códigos canônicos confirmados são expostos",
        total: BANCAS.length,
        loterias: BANCAS.map(({ codigo, nome, loteria_canonica }) => ({ banca: codigo, nome, loteria_canonica })),
      });
    }

    if (url.pathname === "/resultados") {
      const banca = String(url.searchParams.get("banca") || "").trim().toLowerCase();
      if (!banca) return json({ ok: false, erro: "BANCA_OBRIGATORIA", bancas: BANCAS.map((x) => x.codigo) }, 400);
      const bancaInfo = BANCAS.find((x) => x.codigo === banca);
      if (!bancaInfo) return json({ ok: false, erro: "BANCA_NAO_SUPORTADA", banca, bancas: BANCAS.map((x) => x.codigo) }, 404);

      const dataSolicitadaRaw = url.searchParams.get("data");
      const dataSolicitada = dataSolicitadaRaw ? normalizarData(dataSolicitadaRaw) : null;
      if (dataSolicitadaRaw && !dataSolicitada) {
        return json({ ok: false, erro: "DATA_INVALIDA", esperado: "AAAA-MM-DD", recebido: dataSolicitadaRaw }, 400);
      }

      const origem = await buscarOrigem(request.url, env);
      if (!origem.ok) {
        return json({ ok: false, versao: VERSAO, erro: "FALHA_API_ORIGEM", status_origem: origem.status, detalhe: origem.payload ?? origem.detalhe ?? null }, 502);
      }

      const candidatas = extrairCandidatas(origem.payload);
      const dataAlvo = dataSolicitada || dataMaisRecente(candidatas);
      if (!dataAlvo) {
        return json({
          sucesso: false,
          versao: VERSAO,
          banca,
          nome: bancaInfo.nome,
          erro: "SEM_DATA_RESULTADO_VALIDA",
          extracoes: [],
        }, 404);
      }

      const extracoes = consolidar(candidatas, dataAlvo, bancaInfo.loteria_canonica);
      const completas = extracoes.filter((x) => x.completo_1a7).length;
      const incompletas = extracoes.length - completas;

      const resposta = {
        sucesso: true,
        versao: VERSAO,
        banca,
        loteria_canonica: bancaInfo.loteria_canonica,
        nome: origem.payload?.nome || bancaInfo.nome,
        estado: origem.payload?.estado ?? null,
        data_resultado: dataAlvo,
        atualizado_em: new Date().toISOString(),
        faixa_premios: "1-7",
        extracoes,
        resumo: {
          total_extracoes: extracoes.length,
          completas_1a7: completas,
          incompletas_1a7: incompletas,
        },
      };

      if (url.searchParams.get("debug") === "1") {
        resposta.debug = {
          candidatas_total: candidatas.length,
          candidatas_data_alvo: candidatas.filter((x) => x.data_resultado === dataAlvo).length,
          fontes_origem_total: Array.isArray(origem.payload?.fontes) ? origem.payload.fontes.length : 0,
          observacao: "fontes brutas omitidas no payload normal",
        };
      }

      return json(resposta);
    }

    return json({ ok: false, erro: "ROTA_NAO_ENCONTRADA", rotas: ["GET /health", "GET /bancas", "GET /resultados?banca=<codigo>&data=AAAA-MM-DD", "GET /resultados?banca=<codigo>&data=AAAA-MM-DD&debug=1"] }, 404);
  },
};
