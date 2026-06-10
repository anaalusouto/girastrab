const DEFAULTS = { P0: 80, g: 0.05, d: 0.4, e1: 0.0003, e2: -0.12, e3: 18, k: 1.2 };

const FIELDS = [
  { key: "P0", label: "Preço-base de mercado (R$/un)", hint: "Quanto o mercado paga sem marketing e com produção baixa", step: 1 },
  { key: "g", label: "Queda de preço por unidade extra", hint: "Quanto o preço cai a cada unidade a mais ofertada", step: 0.01 },
  { key: "d", label: "Ganho de preço por marketing", hint: "Quanto a marca eleva o preço por ponto de esforço de marketing", step: 0.05 },
  { key: "e3", label: "Custo marginal base (R$/un)", hint: "Custo de produzir cada unidade no início da escala", step: 1 },
  { key: "e2", label: "Coeficiente quadrático de custo", hint: "Negativo: ganho de eficiência inicial (curva em S)", step: 0.01 },
  { key: "e1", label: "Coeficiente cúbico de custo", hint: "Penalidade de escalar demais (gargalo de capacidade)", step: 0.0001 },
  { key: "k", label: "Custo de escalar marketing", hint: "Quanto fica mais caro ampliar o alcance", step: 0.1 },
];

const brl = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const num = (v, d = 0) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

function buildFields() {
  const box = $("#fields");
  box.innerHTML = "";
  FIELDS.forEach((f) => {
    const wrap = el("div", "field");
    wrap.innerHTML = `
      <label for="${f.key}">${f.label}</label>
      <span class="hint">${f.hint}</span>
      <input id="${f.key}" type="number" step="${f.step}" value="${DEFAULTS[f.key]}" />`;
    box.appendChild(wrap);
  });
}

function readParams() {
  const p = {};
  FIELDS.forEach((f) => {
    const raw = $("#" + f.key).value;
    p[f.key] = raw === "" ? 0 : Number(raw);
  });
  return p;
}

function resetParams() {
  FIELDS.forEach((f) => {
    $("#" + f.key).value = DEFAULTS[f.key];
  });
}

async function run() {
  const btn = $("#run-btn");
  btn.disabled = true;
  btn.textContent = "Calculando…";
  const params = readParams();
  try {
    const res = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      let detail = `Erro ${res.status}`;
      try {
        const body = await res.json();
        if (body && body.detail) detail = body.detail;
      } catch (_) {}
      throw new Error(detail);
    }
    const data = await res.json();
    renderResults(data, params);
  } catch (e) {
    renderError(e instanceof Error ? e.message : "Falha ao calcular.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Calcular ponto ótimo";
  }
}

function renderError(msg) {
  const r = $("#results");
  r.innerHTML = "";
  const card = el("div", "card");
  card.appendChild(el("h2", null, "Recomendação"));
  card.appendChild(el("div", "error-box", msg));
  r.appendChild(card);
}

function renderResults(data, params) {
  const o = data.optimum;
  const isMax = data.classification === "maximo_local";
  const r = $("#results");
  r.innerHTML = "";

  // card 1: recomendacao + stats
  const c1 = el("div", "card");
  c1.appendChild(el("h2", null, "Recomendação"));
  const verdict = el(
    "span",
    "verdict" + (isMax ? "" : " warn"),
    isMax
      ? "● Máximo confirmado pela Hessiana"
      : "● Ponto não é máximo · revise os parâmetros"
  );
  c1.appendChild(verdict);
  const grid = el("div", "stat-grid");
  grid.innerHTML = `
    <div class="stat">
      <div class="k">Produzir por mês</div>
      <div class="v">${num(o.Q, 0)}</div>
      <div class="sub">unidades</div>
    </div>
    <div class="stat">
      <div class="k">Investir em marketing</div>
      <div class="v">${brl(o.marketing_cost)}</div>
      <div class="sub">orçamento mensal</div>
    </div>
    <div class="stat">
      <div class="k">Preço recomendado</div>
      <div class="v">${brl(o.price)}</div>
      <div class="sub">por unidade</div>
    </div>
    <div class="stat highlight">
      <div class="k">Lucro mensal</div>
      <div class="v">${brl(o.profit)}</div>
      <div class="sub">receita ${brl(o.revenue)} · custos ${brl(o.production_cost + o.marketing_cost)}</div>
    </div>`;
  c1.appendChild(grid);
  r.appendChild(c1);

  const c2 = el("div", "card");
  c2.appendChild(el("h2", null, "Lucro em função da produção"));
  c2.appendChild(profitCurve(params, o.Q));
  c2.appendChild(
    el(
      "p",
      "chart-caption",
      "Curva ao longo do marketing ótimo M*(Q). O ponto âmbar marca a produção que zera o gradiente."
    )
  );
  r.appendChild(c2);

  const c3 = el("div", "card");
  c3.appendChild(el("h2", null, "Como a solução foi obtida"));
  const ol = el("ol", "steps");
  data.explanation.forEach((s) => ol.appendChild(el("li", null, s)));
  c3.appendChild(ol);
  r.appendChild(c3);

  const c4 = el("div", "card");
  c4.appendChild(el("h2", null, "Sensibilidade · impacto no lucro de +1% em cada parâmetro"));
  c4.appendChild(sensitivity(data.sensitivity));
  r.appendChild(c4);
}

function profitCurve(params, qStar) {
  const { P0, g, d, e1, e2, e3, k } = params;
  const profitAt = (Q) => {
    const M = (d * Q) / (2 * k);
    return (P0 - g * Q + d * M) * Q - (e1 * Q ** 3 + e2 * Q ** 2 + e3 * Q) - k * M ** 2;
  };
  const W = 560, H = 220, P = 8;
  const qMax = Math.max(qStar * 1.9, 10);
  const N = 120;
  const xs = [], ys = [];
  for (let i = 0; i <= N; i++) {
    const Q = (qMax * i) / N;
    xs.push(Q);
    ys.push(profitAt(Q));
  }
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys);
  const sx = (Q) => P + ((W - 2 * P) * Q) / qMax;
  const sy = (v) => H - P - ((H - 2 * P) * (v - yMin)) / (yMax - yMin || 1);
  const pts = xs.map((Q, i) => `${sx(Q).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join(" ");
  const ox = sx(qStar), oy = sy(profitAt(qStar)), yZero = sy(0);

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Curva de lucro");
  svg.innerHTML = `
    <line x1="${P}" y1="${yZero}" x2="${W - P}" y2="${yZero}" stroke="#e4e6ea" stroke-width="1" />
    <polyline points="${pts}" fill="none" stroke="#15191e" stroke-width="2" />
    <line x1="${ox}" y1="${P}" x2="${ox}" y2="${H - P}" stroke="#e2682a" stroke-width="1" stroke-dasharray="4 4" />
    <circle cx="${ox}" cy="${oy}" r="5.5" fill="#e2682a" stroke="#fff" stroke-width="2" />`;
  return svg;
}

function sensitivity(items) {
  const max = Math.max(...items.map((i) => Math.abs(i.profit_pct_change ?? 0)), 0.01);
  const box = el("div");
  items.forEach((i) => {
    const v = i.profit_pct_change ?? 0;
    const w = (Math.abs(v) / max) * 50;
    const pos = v >= 0;
    const color = pos ? "#1f7a6b" : "#b3261e";
    const row = el("div", "sens-row");
    row.innerHTML = `
      <span>${i.label}</span>
      <span class="bar-track">
        <span class="bar-mid"></span>
        <span class="bar-fill" style="left:${pos ? 50 : 50 - w}%;width:${w}%;background:${color}"></span>
      </span>
      <span class="val" style="color:${color}">${v >= 0 ? "+" : ""}${v.toFixed(2)}%</span>`;
    box.appendChild(row);
  });
  return box;
}

buildFields();
$("#run-btn").addEventListener("click", run);
$("#reset-btn").addEventListener("click", resetParams);
