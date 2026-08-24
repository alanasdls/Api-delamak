const VERSAO = "1.0.6";
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


const BICHOS = [
  null,
  "Avestruz", "Águia", "Burro", "Borboleta", "Cachorro",
  "Cabra", "Carneiro", "Camelo", "Cobra", "Coelho",
  "Cavalo", "Elefante", "Galo", "Gato", "Jacaré",
  "Leão", "Macaco", "Porco", "Pavão", "Peru",
  "Touro", "Tigre", "Urso", "Veado", "Vaca",
];

function grupoDaDezena(dezenaRaw) {
  const d = Number(String(dezenaRaw ?? "").replace(/\D/g, "").slice(-2));
  if (!Number.isInteger(d) || d < 0 || d > 99) return null;
  if (d === 0) return 25;
  return Math.floor((d - 1) / 4) + 1;
}

function premioDerivado(posicao, valor, largura, regra, extras = {}) {
  const texto = String(Math.trunc(Math.abs(Number(valor) || 0))).padStart(largura, "0").slice(-largura);
  const dezena = texto.slice(-2).padStart(2, "0");
  const centena = texto.slice(-3).padStart(3, "0");
  const grupo = grupoDaDezena(dezena);
  return {
    posicao,
    milhar: texto,
    centena,
    dezena,
    ...(grupo ? { grupo, bicho: BICHOS[grupo] } : {}),
    origem: "calculado",
    regra_calculo: regra,
    ...extras,
  };
}

function calcularSexto(primeirosCinco) {
  if (!Array.isArray(primeirosCinco) || primeirosCinco.length < 5) return null;
  const nums = primeirosCinco.slice(0, 5).map((p) => Number(String(p.milhar || "").replace(/\D/g, "")));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const soma = nums.reduce((a, b) => a + b, 0);
  return premioDerivado(6, soma % 10000, 4, "SOMA_1_A_5_ULTIMOS_4", { soma_1_a_5: soma });
}

function calcularSetimoComNumeros(n1, n2, origemNumeros = "MILHAR_4D") {
  const a = Number(String(n1 ?? "").replace(/\D/g, ""));
  const b = Number(String(n2 ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const produto = a * b;
  const penultimaCentena = Math.floor(produto / 1000) % 1000;
  return premioDerivado(7, penultimaCentena, 3, "PRODUTO_1_X_2_PENULTIMA_CENTENA", {
    produto_1_x_2: produto,
    base_calculo_7: origemNumeros,
  });
}

function dataBrParaIso(v) {
  return normalizarData(v);
}

async function buscarFederalCaixa(dataAlvo) {
  // Fonte primária pública da Loteria Federal. Usada apenas para recuperar os números
  // originais de 5 dígitos necessários ao cálculo tradicional do 7º prêmio da Federal.
  try {
    const r = await fetch("https://servicebus2.caixa.gov.br/portaldeloterias/api/federal", {
      headers: { accept: "application/json" },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (dataBrParaIso(j?.dataApuracao) !== dataAlvo) return null;
    const lista = Array.isArray(j?.listaDezenas) ? j.listaDezenas : [];
    if (lista.length < 5) return null;
    const numeros5d = lista.slice(0, 5).map((x) => String(x ?? "").replace(/\D/g, "").padStart(5, "0").slice(-5));
    if (numeros5d.some((x) => !/^\d{5}$/.test(x))) return null;
    return { concurso: j?.numero ?? null, data: dataAlvo, numeros5d };
  } catch {
    return null;
  }
}

function ehFederalRegular(banca, c) {
  const codigo = String(c?.codigo || "").toUpperCase();
  const nome = String(c?.nome || "").toUpperCase();
  return banca === "rio-federal" && (codigo === "FED" || nome.includes("FEDERAL"));
}

function ehMaluca(c) {
  const codigo = String(c?.codigo || "").toUpperCase();
  const nome = String(c?.nome || "").toUpperCase();
  return codigo.includes("MALUCA") || nome.includes("MALUCA");
}

function ehBahiaRegular(banca, c) {
  return banca === "bahia" && !ehMaluca(c);
}

function limitePosicaoParaOrigem(banca, ex) {
  return ehBahiaRegular(banca, ex) ? 10 : 7;
}

function completarUmASete(c, banca, federalCaixa) {
  const premios = Array.isArray(c?.premios) ? c.premios.map((p) => ({ ...p, origem: p.origem || "fonte" })) : [];
  const porPos = new Map(premios.map((p) => [p.posicao, p]));
  const primeiros = [1,2,3,4,5].map((pos) => porPos.get(pos)).filter(Boolean);
  if (primeiros.length < 5) return { premios: [...porPos.values()].sort((a,b)=>a.posicao-b.posicao), calculo: { aplicado: false, motivo: "FALTAM_1_A_5" } };

  if (!porPos.has(6)) {
    const sexto = calcularSexto(primeiros);
    if (sexto) porPos.set(6, sexto);
  }

  if (!porPos.has(7)) {
    let setimo = null;
    if (ehFederalRegular(banca, c) && federalCaixa?.numeros5d?.length >= 2) {
      // Confere se os 4 últimos dígitos da CAIXA correspondem aos 1º/2º exibidos.
      const f1 = federalCaixa.numeros5d[0].slice(-4);
      const f2 = federalCaixa.numeros5d[1].slice(-4);
      if (f1 === String(primeiros[0].milhar).padStart(4, "0").slice(-4) && f2 === String(primeiros[1].milhar).padStart(4, "0").slice(-4)) {
        setimo = calcularSetimoComNumeros(federalCaixa.numeros5d[0], federalCaixa.numeros5d[1], "FEDERAL_CAIXA_5D");
        if (setimo) setimo.concurso_federal = federalCaixa.concurso;
      }
    }
    if (!setimo && !ehFederalRegular(banca, c)) {
      setimo = calcularSetimoComNumeros(primeiros[0].milhar, primeiros[1].milhar, "MILHAR_4D");
    }
    if (setimo) porPos.set(7, setimo);
  }

  const finais = [...porPos.values()].filter((p) => p.posicao >= 1 && p.posicao <= 7).sort((a,b)=>a.posicao-b.posicao);
  const calculadas = finais.filter((p) => p.origem === "calculado").map((p) => p.posicao);
  return {
    premios: finais,
    calculo: {
      aplicado: calculadas.length > 0,
      posicoes_calculadas: calculadas,
      federal_5d_usado: calculadas.includes(7) && finais.find((p)=>p.posicao===7)?.base_calculo_7 === "FEDERAL_CAIXA_5D",
      completo_1a7: finais.length === 7 && finais.every((p, i) => p.posicao === i + 1),
    },
  };
}

function premioNormalizado(p, maxPosicao = 7) {
  if (!p || typeof p !== "object") return null;
  const posicao = Number(p.posicao ?? p.ordem ?? p.premio);
  if (!Number.isInteger(posicao) || posicao < 1 || posicao > maxPosicao) return null;
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
    origem: p.origem || "fonte",
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

function extrairCandidatas(payload, banca) {
  const fontes = Array.isArray(payload?.fontes) ? payload.fontes : [];
  const candidatas = [];
  fontes.forEach((fonte, fonteIndex) => {
    const extracoes = Array.isArray(fonte?.extracoes) ? fonte.extracoes : [];
    extracoes.forEach((ex, extracaoIndex) => {
      if (!extracaoValida(ex)) return;
      const maxPosicao = limitePosicaoParaOrigem(banca, ex);
      const premios = (Array.isArray(ex.premios) ? ex.premios : [])
        .map((p) => premioNormalizado(p, maxPosicao))
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

function coberturaSequencial(premios, alvo) {
  const pos = new Set((Array.isArray(premios) ? premios : []).map((p) => Number(p.posicao)));
  let n = 0;
  for (let i = 1; i <= alvo; i++) {
    if (!pos.has(i)) break;
    n++;
  }
  return n;
}

function scoreCandidata(c, banca) {
  const alvo = ehBahiaRegular(banca, c) ? 10 : 7;
  const cobertura = coberturaSequencial(c.premios, alvo);
  const completa = cobertura === alvo ? 1000000 : 0;
  const sequencial = cobertura * 10000;
  const quantidade = c.premios.length * 100;
  const temHorario = c.horario ? 10 : 0;
  // Em empate, prioriza a fonte mais alta na ordem original.
  return completa + sequencial + quantidade + temHorario - c.fonte_index;
}

function chaveConsolidacao(c, banca) {
  // Bahia regular pode aparecer com códigos diferentes entre fontes. A identidade
  // segura para escolher a melhor fonte é regular + horário (na mesma data).
  if (ehBahiaRegular(banca, c) && c.horario) return `BAHIA_REGULAR|${c.horario}`;
  // Malucas permanecem separadas por código para não misturar modalidades/grades.
  return c.codigo;
}

function consolidar(candidatas, dataAlvo, loteriaCanonica, banca, federalCaixa) {
  const filtradas = candidatas.filter((c) => c.data_resultado === dataAlvo);
  const selecionadas = new Map();
  for (const c of filtradas) {
    const chave = chaveConsolidacao(c, banca);
    const atual = selecionadas.get(chave);
    if (!atual || scoreCandidata(c, banca) > scoreCandidata(atual, banca)) selecionadas.set(chave, c);
  }

  return [...selecionadas.values()]
    .map((c) => {
      if (ehBahiaRegular(banca, c)) {
        const premios = [...c.premios]
          .filter((p) => p.posicao >= 1 && p.posicao <= 10)
          .sort((a, b) => a.posicao - b.posicao);
        const completo1a10 = premios.length === 10 && premios.every((p, i) => p.posicao === i + 1);
        return {
          loteria_canonica: loteriaCanonica,
          codigo: c.codigo,
          codigo_extracao_origem: c.codigo,
          nome: c.nome,
          horario: c.horario,
          data_resultado: c.data_resultado,
          faixa_premios: "1-10",
          regra_banca: "BAHIA_REGULAR_1_A_10_FONTE",
          premios,
          completo_1a10: completo1a10,
          calculo_1a7: { aplicado: false, motivo: "BAHIA_REGULAR_USA_1_A_10_DA_FONTE" },
        };
      }

      if (banca === "bahia" && ehMaluca(c)) {
        const premios = [...c.premios]
          .filter((p) => p.posicao >= 1 && p.posicao <= 7)
          .sort((a, b) => a.posicao - b.posicao);
        const completo1a7 = premios.length === 7 && premios.every((p, i) => p.posicao === i + 1);
        return {
          loteria_canonica: loteriaCanonica,
          codigo: c.codigo,
          codigo_extracao_origem: c.codigo,
          nome: c.nome,
          horario: c.horario,
          data_resultado: c.data_resultado,
          faixa_premios: "1-7",
          regra_banca: "MALUCA_BAHIA_FONTE_SEM_CALCULO_AUTOMATICO",
          premios,
          completo_1a7: completo1a7,
          calculo_1a7: { aplicado: false, motivo: "MALUCA_BAHIA_REGRA_PROPRIA_NAO_DEFINIDA" },
        };
      }

      const completada = completarUmASete(c, banca, federalCaixa);
      return {
        loteria_canonica: loteriaCanonica,
        codigo: c.codigo,
        codigo_extracao_origem: c.codigo,
        nome: c.nome,
        horario: c.horario,
        data_resultado: c.data_resultado,
        faixa_premios: "1-7",
        regra_banca: "PADRAO_1_A_7",
        premios: completada.premios,
        completo_1a7: completada.calculo.completo_1a7,
        calculo_1a7: completada.calculo,
      };
    })
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
        modo: "REGRAS_POR_BANCA_PRIORIDADE_FONTE_COMPLETA",
        independente_sorte777: true,
        origem: origemBase(env),
        total_bancas: BANCAS.length,
        contrato: "Regras por banca: Bahia regular prioriza por horário a fonte com 1º–10º completos e nunca calcula posições faltantes; demais bancas compatíveis usam 1º–7º com cálculo 6º/7º; Federal usa 5 dígitos CAIXA no 7º quando disponível; canônicos V3",
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

      const candidatas = extrairCandidatas(origem.payload, banca);
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

      const precisaFederal5d = banca === "rio-federal" && candidatas.some((c) => c.data_resultado === dataAlvo && ehFederalRegular(banca, c) && c.premios.length < 7);
      const federalCaixa = precisaFederal5d ? await buscarFederalCaixa(dataAlvo) : null;
      const extracoes = consolidar(candidatas, dataAlvo, bancaInfo.loteria_canonica, banca, federalCaixa);
      const completas1a7 = extracoes.filter((x) => x.faixa_premios === "1-7" && x.completo_1a7).length;
      const incompletas1a7 = extracoes.filter((x) => x.faixa_premios === "1-7" && !x.completo_1a7).length;
      const completas1a10 = extracoes.filter((x) => x.faixa_premios === "1-10" && x.completo_1a10).length;
      const incompletas1a10 = extracoes.filter((x) => x.faixa_premios === "1-10" && !x.completo_1a10).length;

      const resposta = {
        sucesso: true,
        versao: VERSAO,
        banca,
        loteria_canonica: bancaInfo.loteria_canonica,
        nome: origem.payload?.nome || bancaInfo.nome,
        estado: origem.payload?.estado ?? null,
        data_resultado: dataAlvo,
        atualizado_em: new Date().toISOString(),
        faixa_premios: banca === "bahia" ? "REGRAS_POR_EXTRACAO" : "1-7",
        extracoes,
        resumo: {
          total_extracoes: extracoes.length,
          completas_1a7: completas1a7,
          incompletas_1a7: incompletas1a7,
          completas_1a10: completas1a10,
          incompletas_1a10: incompletas1a10,
        },
      };

      if (url.searchParams.get("debug") === "1") {
        resposta.debug = {
          candidatas_total: candidatas.length,
          candidatas_data_alvo: candidatas.filter((x) => x.data_resultado === dataAlvo).length,
          fontes_origem_total: Array.isArray(origem.payload?.fontes) ? origem.payload.fontes.length : 0,
          observacao: "fontes brutas omitidas no payload normal; Bahia regular consolida por horário e prioriza a candidata com 1º–10º sequenciais completos",
          federal_caixa_5d_disponivel: Boolean(federalCaixa),
        };
      }

      return json(resposta);
    }

    return json({ ok: false, erro: "ROTA_NAO_ENCONTRADA", rotas: ["GET /health", "GET /bancas", "GET /resultados?banca=<codigo>&data=AAAA-MM-DD", "GET /resultados?banca=<codigo>&data=AAAA-MM-DD&debug=1"] }, 404);
  },
};
