// 화성특례시 투자유치 — 시장의 열 질문. 정적 JS(서버 없음 · GitHub Pages 용). 데이터는 code/28_export_web.R 이 만든 data/*.json 만 읽는다(구간값 배포판).
// 질문 순서가 곧 논리다 — 화성이 가진 투자 생태계(①) → 기업 투자 4유형: 관내 유입·관내 재투자·관외 유출·재환입(②~⑤) → 그 결과인 세수(추정)와 양질의 일자리(⑥) → 실행 과제(⑦). 지면 규칙: 답 한 줄 → 근거 → 조작 · 「안(案)」·「추정」·「대리」는 답 옆에 적는다.
const $ = s => document.querySelector(s), fmt = (v, d = 0) => v == null || Number.isNaN(+v) ? "–" : (+v).toLocaleString("ko-KR", { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (a, b) => b ? Math.round(100 * a / b) : 0, esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const D = {};
for (const n of ["firms", "outflow", "trade", "kosis", "power", "succ", "meta", "eco", "content", "cluster", "flows", "tax"]) D[n] = await fetch(`data/${n}.json`).then(r => r.ok ? r.json() : null).catch(() => null);
const EMD_GJ = await fetch("data/emd_stats.geojson").then(r => r.ok ? r.json() : null).catch(() => null), PTS_GJ = null;   // 행정동 경계(code/28 이 data/ 에 둔다)
const C = D.content, E = D.eco, M = D.meta, P = C.POLICY;
$("#built").textContent = `스냅숏 ${M.built_at} · KoDATA ${fmt(M.kodata_all)}사 · DART 매핑 ${fmt(M.map_n)}사 · ${String(M.fx_note).replace(/\s*\(.*\)\s*$/, "")}`;

// ── 공용: 표(정렬·검색·행수) · 막대 ──────────────────────────────────────────
function table(rows, cols, { search = true, limit = 200, height } = {}) {
  const id = "t" + Math.random().toString(36).slice(2, 8); let sortK = null, asc = false, q = "";
  const isNum = k => rows.some(r => typeof r[k] === "number");
  const render = () => {
    let rs = rows.filter(r => !q || cols.some(c => String(r[c.k] ?? "").toLowerCase().includes(q)));
    if (sortK) rs = [...rs].sort((a, b) => { const x = a[sortK], y = b[sortK]; if (x == null) return 1; if (y == null) return -1; return (typeof x === "number" ? x - y : String(x).localeCompare(String(y), "ko")) * (asc ? 1 : -1); });
    const body = rs.slice(0, limit).map(r => "<tr>" + cols.map(c => `<td class="${isNum(c.k) ? "num" : ""}">${c.f ? c.f(r[c.k], r) : isNum(c.k) ? fmt(r[c.k], c.d ?? 0) : esc(r[c.k])}</td>`).join("") + "</tr>").join("");
    $(`#${id} tbody`).innerHTML = body; $(`#${id}-n`).textContent = `${fmt(rs.length)}행${rs.length > limit ? ` (${limit}행까지 표시)` : ""}`;
    $(`#${id} thead`).querySelectorAll("th").forEach(th => th.textContent = th.dataset.k === sortK ? `${th.dataset.nm} ${asc ? "▲" : "▼"}` : th.dataset.nm);
  };
  setTimeout(() => { $(`#${id} thead`).querySelectorAll("th").forEach(th => th.onclick = () => { asc = sortK === th.dataset.k ? !asc : false; sortK = th.dataset.k; render(); });
    if (search) $(`#${id}-q`).oninput = e => { q = e.target.value.trim().toLowerCase(); render(); }; render(); });
  return `<div class="tools">${search ? `<input type="search" id="${id}-q" placeholder="검색">` : ""}<span class="k" id="${id}-n"></span></div>
    <div class="tw" ${height ? `style="max-height:${height}"` : ""}><table class="t" id="${id}"><thead><tr>${cols.map(c => `<th data-k="${c.k}" data-nm="${esc(c.nm ?? c.k)}" class="${isNum(c.k) ? "num" : ""}">${esc(c.nm ?? c.k)}</th>`).join("")}</tr></thead><tbody></tbody></table></div>`;
}
const autoCols = rows => Object.keys(rows[0] || {}).map(k => ({ k, nm: k }));
function plot(id, traces, layout = {}) { setTimeout(() => Plotly.newPlot(id, traces, { margin: { l: 60, r: 20, t: 40, b: 60 }, font: { family: "Pretendard Variable, Pretendard, Apple SD Gothic Neo, sans-serif", size: 12, color: "#374151" }, paper_bgcolor: "#fff", plot_bgcolor: "#fff", showlegend: false, ...layout }, { displayModeBar: false, responsive: true })); return `<div id="${id}" class="plot"></div>`; }
const bar = (id, x, y, colors, extra = {}) => plot(id, [{ type: "bar", x, y, marker: { color: colors }, text: y.map(v => fmt(v)), textposition: "outside", hovertemplate: "%{x}<br>%{y:,.0f}<extra></extra>" }], { yaxis: { range: [Math.min(0, ...y), Math.max(...y) * 1.18] }, ...extra });
const hbar = (id, y, x, colors, extra = {}) => plot(id, [{ type: "bar", orientation: "h", x, y, marker: { color: colors }, text: x.map(v => fmt(v)), textposition: "outside", hovertemplate: "%{y}<br>%{x:,.0f}<extra></extra>" }], { margin: { l: 180, r: 60, t: 10, b: 40 }, yaxis: { autorange: "reversed" }, ...extra });
// 답 상자 — 개조식. items: 굵은 항목(결론) · notes: 작은 항목(정의·출처·한계)
const answer = (items, notes) => `<div class="answer"><ul class="ans">${[].concat(items).map(t => `<li>${t}</li>`).join("")}</ul>${notes ? `<ul class="ans k">${[].concat(notes).map(t => `<li>${t}</li>`).join("")}</ul>` : ""}</div>`;
const kpi = items => `<div class="kpi">${items.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("")}</div>`;
const chain = cur => `<div class="chain">${["① 생태계", "①b 집적", "② 유입", "③ 재투자", "④ 유출", "⑤ 재환입", "⑥ 세수·고용", "⑦ 실행 과제", "⑧ 공간 분포", "⑨ 기업 데이터"].map((s, i) => `<span class="${i + 1 === cur ? "on" : ""}">${s}</span>`).join("→")}</div>`;
const sum = (a, f = x => x) => a.reduce((s, r) => s + (+f(r) || 0), 0);
// 국민연금 인당 월 고지액(만원) → 연봉 추정(만원). 고지액 = 기준소득월액 × 보험료율(사업장+근로자). 2026-01 부터 9.5%(연금개혁 · 매년 0.5%p↑). 상한(기준소득월액 약 650만원)에 걸린 고임금 사업장은 과소.
const NPS_RATE = 0.095, salary = g => g == null ? null : Math.round(g / NPS_RATE * 12), salaryStr = g => g == null ? "–" : `${(salary(g) / 1e4).toFixed(1)}억`.replace(/^0\.(\d)억$/, (m, d) => `${d}천만`), won = v => v >= 1e4 ? `${(v / 1e4).toFixed(2)}억` : `${fmt(v)}만`;

// ── 인센티브 시산 — app_strategy/R/data.R simulate() 와 같은 식 ─────────────────
function simulate(iv = P.IV, emp = P.EMP, cap = true) {
  const s = D.firms.filter(r => r.억 != null && r.emp_last != null && r.억 >= iv && r.emp_last >= emp);
  let fac = 0, job = 0, hitF = 0, hitE = 0;
  for (const r of s) { const f0 = r.억 * P.RATE, e0 = Math.max(r.emp_last - emp, 0) * P.PAY_MON * P.MONTHS / 1e8; const f = cap ? Math.min(f0, P.CAP_FAC) : f0, e = cap ? Math.min(e0, P.CAP_EMP) : e0; r.지원_시설 = f; r.지원_고용 = e; fac += f; job += e; if (f0 > P.CAP_FAC) hitF++; if (e0 > P.CAP_EMP) hitE++; }
  return { n: s.length, fac, job, tot: fac + job, hitF, hitE, df: s.sort((a, b) => b.억 - a.억) };
}


// ── 해답 블록 — 대상(수치) → 할 일 → 지표. 수치는 스냅숏, 처방은 보고서 12편 결론. 문안은 개조식 ─────────────────────
const sol = (title, lead, items) => `<section class="sol"><h2>해답 — ${title}</h2><ul class="lead">${[].concat(lead).map(t => `<li>${t}</li>`).join("")}</ul><div class="solgrid">${items.map((it, i) => `<div class="solcard ${it.cls || ""}"><div class="n">${i + 1}</div><h3>${it.t}</h3><p><b>대상</b> ${it.who}</p><p><b>할 일</b> ${it.do}</p><p><b>지표</b> ${it.kpi}</p></div>`).join("")}</div></section>`;
const pwGrowth = () => { const pw = D.power.trend, y0 = Math.min(...pw.map(r => r.연도)), y1 = Math.max(...pw.map(r => r.연도)), g = c => { const a = pw.find(r => r.시군구 === c && r.연도 === y0)?.TWh10, b = pw.find(r => r.시군구 === c && r.연도 === y1)?.TWh10; return a && b ? Math.round(100 * (b / a - 1)) : null; }; return { y0, y1, hs: g("화성시"), pt: g("평택시") }; };   // 2021 원자료가 10월 파일이라 연간이 아니다 → 세 해 모두 1~10월 누계로 견준다(검증 2026-09-19 ①)
function sol4(g) {
  const os = Object.fromEntries(E.action.outflow_sum.map(r => [r.갈래, r])), p = pwGrowth();
  return sol("관외 유출 — 유형별 대응", [`힘을 쓸 곳: 수도권 내 ${fmt(os["수도권 내"]?.억)}억(${os["수도권 내"]?.기업}사)`, "해외 = 생산기지 전략 · 지방 = 국비 보조금 경쟁 → 시가 되돌리기 어려움", `공통 원인: 용지 · 전력(${p.y0}→${p.y1} +${p.hs}% vs 평택 +${p.pt}%) · 인허가`], [
    { t: "수도권 내 — 협상", cls: "hot", who: `${os["수도권 내"]?.건}건 ${fmt(os["수도권 내"]?.억)}억 · ${os["수도권 내"]?.기업}사(용인·수원·성남·평택)`, do: "공시 전 발굴(재투자 MOU) · 부지·전력·인허가 동시 점검 · 관내 대안 부지(H-테크노밸리·동탄) · 착공 후 선지급", kpi: "관내 전환 건수 · 협약 후 12개월 내 착수 비율" },
    { t: "해외 — 남길 층 확보", who: `${os["해외"]?.건}건 ${fmt(os["해외"]?.억)}억 · ${os["해외"]?.기업}사(미국·베트남·중국)`, do: "협력사·재제조·R&D 층 관내 잔류 조건 협의 · 해외 법인 국내 조달률 · 본사·연구소 잔류", kpi: "관내 고용 유지율 · 관내 조달률" },
    { t: "지방 — 단가 경쟁 회피", who: `${os["지방"]?.건}건 ${fmt(os["지방"]?.억)}억 · ${os["지방"]?.기업}사(대구·창원·김제)`, do: "국비 보조금과 경쟁하지 않음 · 앵커 인접·인력·계통 상품화 · 이전 뒤 R&D·본사 기능 관내 유지", kpi: "관내 잔류 기능 수" },
    { t: "원인 셋 — 용지 · 전력 · 인허가", who: `공업지역 86필지 37.7km² · 전력 +${p.hs}%(계통 포화) · 인허가 소요일 미측`, do: "산업용지 재고·분양가 실측 · 증설 예정 기업 명단으로 계통 증설 요청 · 인허가·계통·용수 동시 점검(나주 방식)", kpi: "착공까지 달 수 · 계통 확보 MW · 용지 공급 면적" }]);
}
function sol5(g, po, os) {
  return sol("재환입 — 감지 · 대안 · 잠금 · 승계", [`먼저 만날 상대: 수도권 내 유출 ${os.기업}사 · 본사 관내·공장 관외 ${po.length}사`, `지킬 고용: 65세 이상 대표 ${fmt(D.succ.n65)}사 · ${fmt(D.succ.emp65)}명`, "공시 이후 대응은 늦음 → 공시 전 접촉"], [
    { t: "감지", cls: "hot", who: `수도권 내 ${os.기업}사 · 공장 관외 ${po.length}사 · 최근 2년 설비투자가 빨라진 ${E.action.capacity.length}사`, do: "담당자 분기 면담 · 국민연금 가입자 비율·공시·채용 공고로 이전 징후 확인", kpi: "공시 전 접촉 비율 · 징후→면담 일수" },
    { t: "대안", who: "부지·전력·인허가 걸린 기업", do: "동시 점검 회의 · 관내 대안 부지 제시 · 계통 확보 요청 · 총액 상한 안 선지급", kpi: "대안 제시 건수 · 수락률" },
    { t: "잠금", who: "관내 재투자 합의 기업", do: "재투자 MOU → 협약 관문 → 12개월 내 착수 · 이행 단계 매년 집계 · 환수 조건", kpi: "관내 전환 건수·금액 · 12개월 내 착수 비율" },
    { t: "승계", who: `65세↑ 대표 ${fmt(D.succ.n65)}사 · 고용 ${fmt(D.succ.emp65)}명(제조 ${fmt(D.succ.n65_mfg)}사 ${fmt(D.succ.emp65_mfg)}명)`, do: "대표자 생년 정식 항목 → 상담·중개 → 조건부 법인 전환(+스마트공장) → 유치 정책과 한 묶음", kpi: "나이 확인율 · 승계 완료 수 · 전환 후 고용 유지율" }]);
}
// ── 투자 흐름 지도 — 화성 → 투자예정지 곡선(굵기 = 금액) · 색 = 유형 · Plotly geo(외부 타일 없음 · 나라 경계는 plotly 내장) ─────
const FLOWCOL = { "화성 관내": "#1baf7a", "수도권 내": "#2a78d6", "지방": "#B7791F", "해외": "#9F1239" };
function arc(o, d, k = .18, n = 40) {   // 두 점 사이 곡선 — 중점에서 수직으로 k 만큼 부풀린 2차 베지어
  const mx = (o[0] + d[0]) / 2, my = (o[1] + d[1]) / 2, dx = d[0] - o[0], dy = d[1] - o[1], L = Math.hypot(dx, dy) || 1, cx = mx - dy / L * L * k, cy = my + dx / L * L * k, lon = [], lat = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t; lon.push(a * o[0] + b * cx + c * d[0]); lat.push(a * o[1] + b * cy + c * d[1]); } return { lon, lat };
}
function flowMap(id, scope) {   // scope: "world" | "kr"
  const F = D.flows; if (!F) return; const o = F.origin, rows = F.flows.filter(r => r.lon != null && (scope === "world" ? r.갈래 === "해외" : r.갈래 !== "해외"));
  const maxE = Math.max(...rows.map(r => r.억)), traces = [];
  for (const r of rows.filter(r => r.갈래 !== "화성 관내")) { const a = arc(o, [r.lon, r.lat], .10);
    traces.push({ type: "scattergeo", mode: "lines", lon: a.lon, lat: a.lat, line: { width: 1 + 7 * Math.sqrt(r.억 / maxE), color: FLOWCOL[r.갈래] }, opacity: .75, hoverinfo: "skip", showlegend: false }); }
  for (const g of Object.keys(FLOWCOL)) { const rs = rows.filter(r => r.갈래 === g); if (!rs.length) continue;
    traces.push({ type: "scattergeo", mode: "markers+text", name: g, lon: rs.map(r => r.lon), lat: rs.map(r => r.lat), text: rs.map(r => r.억 >= (scope === "world" ? 300 : 1000) ? `${r.지역} ${fmt(r.억)}억` : ""), textposition: "top right", textfont: { size: 11, color: "#111827" },
      marker: { size: rs.map(r => 6 + 26 * Math.sqrt(r.억 / maxE)), color: FLOWCOL[g], opacity: .85, line: { color: "#fff", width: 1 } }, hovertext: rs.map(r => `${r.지역}<br>${fmt(r.억)}억 · ${r.건}건 · ${r.기업}사`), hoverinfo: "text" }); }
  traces.push({ type: "scattergeo", mode: "markers+text", name: "화성", lon: [o[0]], lat: [o[1]], text: ["화성"], textposition: "bottom center", textfont: { size: 12, color: "#111827" }, marker: { size: 14, symbol: "star", color: "#111827", line: { color: "#fff", width: 1.5 } }, hoverinfo: "text", hovertext: ["화성특례시 — 출발점"], showlegend: false });
  const geo = scope === "world" ? { projection: { type: "natural earth" }, lonaxis: { range: [-135, 155] }, lataxis: { range: [-12, 66] }, showcountries: true, countrycolor: "#D1D5DB", showland: true, landcolor: "#F5F6F8", showocean: true, oceancolor: "#ffffff", showframe: false, coastlinecolor: "#c9c7be", bgcolor: "#fff" }
    : { scope: "asia", resolution: 50, lonaxis: { range: [125.4, 130.2] }, lataxis: { range: [32.9, 38.7] }, showcountries: true, countrycolor: "#c9c7be", showland: true, landcolor: "#F5F6F8", showocean: true, oceancolor: "#ffffff", showframe: false, coastlinecolor: "#c9c7be", bgcolor: "#fff" };
  Plotly.newPlot(id, traces, { geo, margin: { l: 0, r: 0, t: 0, b: 0 }, legend: { orientation: "h", x: 0, y: 0, bgcolor: "rgba(255,255,255,.7)" }, font: { family: "Pretendard Variable, Pretendard, Apple SD Gothic Neo, sans-serif", size: 12, color: "#374151" }, paper_bgcolor: "#fff" }, { displayModeBar: false, responsive: true });
}

// ── 질문 열둘 ─────────────────────────────────────────────────────────────────
const flowOf = () => { const g = {}; for (const r of D.outflow) { if (r.억 == null) continue; g[r.갈래] ??= { 건: 0, 억: 0, 기업: new Set() }; g[r.갈래].건++; g[r.갈래].억 += r.억; g[r.갈래].기업.add(r.corp_name); } return g; };   // 금액 없는 건은 세지 않는다 — eco.outflow_sum 과 같은 자
const isEquity = r => r.invest_type === "타법인출자";   // 지분형(주식 취득) — 공장 이전이 아니다
const Q = [
{ id: "eco", n: "①", t: "투자 생태계", q: "집적 · 인력 · 전력 · 부지 · 조례 — 강점과 제약", render() {
  const K = D.kosis, tot = Object.fromEntries(K.total.map(r => [r.ITM_ID, r])), ind = K.ind.sort((a, b) => b.값_T02 - a.값_T02), F = C.FACTORS, p = pwGrowth();
  return chain(1) + answer([`<b>제조업 시군구 1위 넷</b> — 종사자 ${fmt(tot.T02.값)}명 · 사업체 ${fmt(tot.T01.값)}곳 · 부가가치 ${fmt(tot.T06.값 / 1e6, 1)}조 · 설비자산 ${fmt(tot.T07.값 / 1e6, 1)}조`,
    `<b>유리</b> — 집적 · 인력·본사 기능(입지 요인 ●●●)`, `<b>제약</b> — 전력 ${fmt(D.power.top.find(r => r.시군구 === "화성시").TWh, 1)}TWh 전국 2위, ${p.y0}→${p.y1} +${p.hs}%(평택 +${p.pt}% · 1~10월 누계 기준) · 부지 · 지가`],
    [`KOSIS 광업제조업조사 ${K.Y1}(종사자 10명↑) · 순위 = 값을 공개한 시군구 중 · 한전 시군구 판매량`, "중요도(●) = KDI·국토연·대한상의 조사 종합 판단(데이터 아님)"]) +
  kpi([[fmt(M.kodata_all), "KoDATA 정상영업 기업"], [fmt(M.map_n), "DART 감사보고서 법인"], [fmt(sum(E.ind, r => r.n_가입자)), `국민연금 가입자 · 제조 · ${E.M1}`], [won(salary(E.med_wage)) + "원", `제조 사업장 연봉 · 가입자 가중평균(사업장 중위 ${won(salary(E.med_wage_site))}원 · 추정)`], [fmt(sum(E.ind, r => r.증분_조), 1) + "조", `설비자산 증분 ${K.Y0}→${K.Y1}`]]) +
  `<h2>입지 결정 요인 × 화성 여건</h2><div class="grid"><div class="card"><table class="t">${F.map(r => `<tr><td><b>${r.요인}</b></td><td class="dots">${"●".repeat(r.중요도)}${"○".repeat(3 - r.중요도)}</td><td class="${r.여건 === "유리" ? "" : "red"}"><b>${r.여건}</b></td><td class="k">${r.근거}</td><td class="k">${r.영역}</td></tr>`).join("")}</table></div>
  <div class="card"><h3>전력 사용량 추이(TWh · 1~10월 누계)</h3>${plot("p1c", [...new Set(D.power.trend.map(r => r.시군구))].map(c => ({ type: "scatter", mode: "lines+markers", name: c, x: D.power.trend.filter(r => r.시군구 === c).map(r => r.연도), y: D.power.trend.filter(r => r.시군구 === c).map(r => Math.round(r.TWh10 * 100) / 100), line: { width: c === "화성시" ? 3 : 1.5 } })), { showlegend: true, legend: { orientation: "h" }, yaxis: { title: "TWh(1~10월)" } })}<div class="k">2021 원자료가 10월 파일이라 세 해를 같은 자(1~10월 누계)로 — 2025 연간은 ${fmt(D.power.top.find(r => r.시군구 === "화성시").TWh, 1)}TWh</div></div></div>
  <h2>산업군별 종사자 · 전국 순위 · 산업 구분</h2><div class="grid"><div class="card">${hbar("p1a", ind.slice(0, 15).map(r => r.산업), ind.slice(0, 15).map(r => r.값_T02), ind.slice(0, 15).map(r => C.PAL.gal[r.갈래] || "#D1D5DB"))}<div class="k">색 = 산업 구분 · 파랑 A 거점 · 초록 B 소재·부품 1위 · 보라 C 확산 후보 · 적 D 부재</div></div>
  <div class="card"><h3>산업군 × 네 자 — KOSIS · KoDATA · 국민연금 · DART</h3>${(() => { const rk2 = Object.fromEntries(K.ind.map(r => [r.mid, r.순위_T02])); return table(E.ind.map(r => ({ ...r, 종사자순위: rk2[r.mid] ?? null, 연봉: r.n_인당고지_만 ? salary(r.n_인당고지_만) : null })), [{ k: "산업" }, { k: "갈래", nm: "구분" }, { k: "k_종사자", nm: "종사자" }, { k: "종사자순위", nm: "종사자 순위" }, { k: "자산_조", nm: "설비자산(조)", d: 1 }, { k: "전국순위", nm: "설비자산 순위" }, { k: "증분_조", nm: `${K.Y0}→${K.Y1} 증분(조)`, d: 1 }, { k: "기업", nm: "KoDATA 기업" }, { k: "n_가입자", nm: "연금 가입자" }, { k: "연봉", nm: "추정 연봉(만)" }, { k: "n_300", nm: "300명↑" }], { height: "380px" }); })()}<div class="k">순위 = KOSIS 값을 공개한 시군구 중(업종별 41~53곳은 비공개) · 「–」 = 비공개(X)·해당 없음 · 구분(A~D)은 설비자산 순위로 매겼다</div></div></div>
  <h2>KDI 요인 여섯 × 화성</h2>${table(C.KDI, autoCols(C.KDI), { search: false })}
`; } },

{ id: "cluster", n: "①b", t: "업종 집적", q: "행정동 입지계수(LQ) · 동종 근접도", render() {
  const CL = D.cluster; if (!CL) return chain(2) + answer("cluster.json 없음 — Rscript code/30_cluster_space.R");
  const G = CL.ind.filter(r => r.level === "그룹"), U = CL.ind.filter(r => r.level === "업종"), mfg = U.filter(r => r.대분류 === "C"), bunch = U.filter(r => r.뭉침), gb = G.filter(r => r.집중);
  const gOpts = CL.groups.map(g => { const r = G.find(x => x.mid === g.id); return `<option value="${g.id}" ${g.id === "G5" ? "selected" : ""}>${g.nm} (${fmt(r?.n)}사${r?.n_pts ? " · 점 " + r.n_pts : ""})</option>`; }).join("");
  return chain(2) + answer([`<b>그룹 11</b> — 행정동 집중 ${gb.length}(${gb.map(r => r.산업.split("(")[0]).join(" · ")}) · 세부 업종 ${U.length} 중 집중 ${U.filter(r => r.집중).length} · 근접 집적 ${bunch.length}`, `<b>의약품 → 향남</b>(2km 안 동종 근접 ${bunch.find(r => r.mid === "C21")?.배율 ?? "–"}배) · <b>종이 → 마도</b> · <b>기계·금속 → 정남·팔탄</b> · <b>전자·정밀·지식서비스 → 동탄</b>`, "그룹마다 자리가 다름 → 유치 표적도 자리별로"],
    [`층 1: 업종코드·행정동 있는 ${fmt(CL.N)}사(모집단 ${fmt(M.kodata_all)} 중 · 업종코드 없는 개인사업자 4.0만은 빠진다) · 30사 미만 단위는 판정 없음 · <b>LQ(Location Quotient · 입지계수)</b> = 그 업종이 동 안에서 차지하는 비중 ÷ 시 전체에서 차지하는 비중 — 1이면 시 평균 · 2면 시 평균의 두 배로 몰려 있다 · 집중 = 집중비(단위 HHI ÷ 전체 HHI) 1.5↑ 또는 상위 3동 45%↑`, `층 2: 법인 ${fmt(CL.n_pts)}사 좌표(개인사업자 제외 · 기업명 없음) · 근접 집적 = 2km 안 이웃 중 동종 비율 ÷ 전체 비율 2↑ · 점 15↑`, "그룹 = 정책 단위(잠정) · 1군 국가첨단전략 = 반도체·전자·정밀 · 전기·이차전지 · 바이오·의약·화학"]) +
  `<div class="tools"><b>그룹</b> <select id="cl-grp">${gOpts}</select> <b>세부 업종</b> <select id="cl-mid"></select> <span class="k">행정동 색 = LQ(입지계수 · 진할수록 그 업종이 시 평균보다 몰려 있음) · 점 = 법인 사업장 · <span style="color:#9F1239">붉은 점</span> = DART 매핑 법인(이름·구간값 표시)</span></div>
  <div class="grid"><div class="card" style="grid-column:1/-1"><div id="p_cl_map" class="plot" style="height:560px"></div></div></div>
  <div class="grid"><div class="card"><h3 id="cl-ttl">행정동별 — 기업 · 종업원 · LQ(입지계수)</h3><div id="cl-tbl"></div></div></div>
  <h2>그룹 11 — 어디에 얼마나</h2>${table(G, [{ k: "산업", nm: "그룹" }, { k: "n", nm: "기업" }, { k: "emp", nm: "종업원(기재)" }, { k: "집중비", d: 2 }, { k: "top3", nm: "상위 3동 %", d: 1 }, { k: "top_dong", nm: "1위 동" }, { k: "top_share", nm: "1위 %", d: 1 }, { k: "top_lq_dong", nm: "LQ 최고 동" }, { k: "top_lq", nm: "LQ", d: 2 }, { k: "n_pts", nm: "점" }, { k: "배율", nm: "동종 근접 배율(2km)", d: 1 }, { k: "집중", f: v => v ? "집중" : "" }, { k: "근접 집적", f: v => v ? "근접 집적" : "" }], { search: false })}
  <h2>그룹 구성(잠정)</h2><table class="t">${CL.groups.map(g => `<tr><td><b>${g.nm}</b></td><td class="k">${[].concat(g.mids).map(m => m === "나머지" ? "나머지 전부(음식·숙박·교육·보건·개인서비스·금융·농업 등)" : `${m} ${U.find(r => r.mid === m)?.산업 ?? ""}`).join(" · ")}</td></tr>`).join("")}</table>
  <h2>세부 업종 ${U.length}개</h2>${table(U.map(r => ({ ...r, 그룹명: CL.groups.find(g => g.id === r.그룹)?.nm })), [{ k: "그룹명", nm: "그룹" }, { k: "산업" }, { k: "n", nm: "기업" }, { k: "emp", nm: "종업원(기재)" }, { k: "집중비", d: 2 }, { k: "top3", nm: "상위 3동 %", d: 1 }, { k: "top_dong", nm: "1위 동" }, { k: "top_share", nm: "1위 %", d: 1 }, { k: "top_lq_dong", nm: "LQ 최고 동" }, { k: "top_lq", nm: "LQ", d: 2 }, { k: "n_pts", nm: "점" }, { k: "nn_same_km", nm: "동종 최근접 km", d: 2 }, { k: "nn_any_km", nm: "아무 최근접 km", d: 2 }, { k: "배율", nm: "동종 근접 배율(2km)", d: 1 }, { k: "집중", f: v => v ? "집중" : "" }, { k: "근접 집적", f: v => v ? "근접 집적" : "" }], { height: "460px" })}
  <h2>읽는 법</h2><ul class="bul">${CL.rules.map(r => r.replace(/^LQ = /, "<b>LQ(Location Quotient · 입지계수)</b> = ")).map(r => `<li>${r}</li>`).join("")}<li>기업 수 적은 동은 LQ 가 튐(동탄8동 의약품 3.6 = 몇 사 차이) → 기업 수와 같이 봄</li><li>좌표 = 법인 전수(개인사업자 제외) · 종업원 = 기재 기업 합</li></ul>`; },
  async after() {
    const CL = D.cluster; if (!CL || !EMD_GJ) return;
    const dongN = Object.fromEntries(CL.dongs.map(d => [d.dong, d.n_d]));
    // 점 — data/points.geojson(법인 전수 지오코딩 · 기업명 없음 · 좌표 소수 4자리). 없으면 DART 매핑 점(3d)으로
    const PTS = (await fetch("data/points.geojson").then(r => r.ok ? r.json() : null).catch(() => null)) || PTS_GJ; const ALLP = PTS?.features || [];
    const nmOf = Object.fromEntries(CL.ind.map(r => [r.mid, r.산업]));
    const fillMid = () => { const gid = $("#cl-grp").value, subs = CL.ind.filter(r => r.level === "업종" && r.그룹 === gid).sort((a, b) => b.n - a.n);
      $("#cl-mid").innerHTML = `<option value="${gid}">그룹 전체</option>` + subs.map(r => `<option value="${r.mid}">${r.산업} (${fmt(r.n)}사${r.n_pts ? " · 점 " + r.n_pts : ""})</option>`).join(""); };
    const draw = () => { const mid = $("#cl-mid").value, ind = CL.ind.find(r => r.mid === mid), rows = CL.dong_ind.filter(r => r.mid === mid);
      const byD = Object.fromEntries(rows.map(r => [r.dong, r])), locs = EMD_GJ.features.map(f => f.properties.dong);
      const z = locs.map(d => byD[d]?.lq ?? 0), txt = locs.map(d => `${d}<br>기업 ${fmt(byD[d]?.n ?? 0)}사 · LQ ${fmt(byD[d]?.lq ?? 0, 2)}<br>동 전체 ${fmt(dongN[d])}사`);
      const gm = CL.groups.find(g => g.id === mid), pts = ALLP.filter(f => gm ? (f.properties.grp ? f.properties.grp === mid : (gm.mids === "나머지" ? !CL.groups.some(g => g.mids !== "나머지" && g.mids.includes(f.properties.mid)) : gm.mids.includes(f.properties.mid))) : f.properties.mid === mid);
      const traces = [{ type: "choropleth", geojson: EMD_GJ, featureidkey: "properties.dong", locations: locs, z, text: txt, hoverinfo: "text", colorscale: [[0, "#F5F6F8"], [.5, "#E4A9B5"], [1, "#9F1239"]], zmin: 0, zmax: Math.max(2, ...z), marker: { line: { color: "#111827", width: .6 } }, colorbar: { title: "LQ", thickness: 10, len: .5 } }];
      if (pts.length) traces.push({ type: "scattergeo", lon: pts.map(f => f.geometry.coordinates[0]), lat: pts.map(f => f.geometry.coordinates[1]), mode: "markers", text: pts.map(f => { const p = f.properties; return p.n ? `<b>${p.n}</b><br>${nmOf[p.mid] || p.mid} · ${p.dong || ""}<br>종업원 ${p.emp ?? "–"}(구간) · 설비투자 ${p.cap ? fmt(p.cap) + "억" : "–"} · ${p.g || ""}${p.chg != null ? " · 5년 " + (p.chg > 0 ? "+" : "") + p.chg : ""}` : `${nmOf[p.mid] || p.mid}<br>${p.dong || ""} · 법인(비공개 명단)`; }), hoverinfo: "text",
        marker: { size: pts.map(f => f.properties.n ? (pts.length > 3000 ? 5 : 8) : (pts.length > 3000 ? 3 : pts.length > 800 ? 4 : 6)), color: pts.map(f => f.properties.n ? "#9F1239" : "#1E40AF"), opacity: pts.length > 3000 ? .5 : .7, line: { color: "#fff", width: pts.length > 800 ? 0 : .6 } } });
      Plotly.react("p_cl_map", traces, { geo: { fitbounds: "locations", visible: false, projection: { type: "mercator" } }, margin: { l: 0, r: 0, t: 0, b: 0 }, height: 560, showlegend: false, paper_bgcolor: "#fff" }, { displayModeBar: false, responsive: true });
      $("#cl-ttl").textContent = `${ind.산업} — ${fmt(ind.n)}사 · 점 ${fmt(pts.length)} · 상위 3동 ${ind.top3}% · 집중비 ${ind.집중비}${ind.배율 ? " · 동종 근접 배율 " + ind.배율 : ""}`;
      $("#cl-tbl").innerHTML = table(rows.map(r => ({ ...r, share: Math.round(1000 * r.n / ind.n) / 10 })).sort((a, b) => b.n - a.n), [{ k: "dong", nm: "행정동" }, { k: "n", nm: "기업" }, { k: "share", nm: "비중 %", d: 1 }, { k: "emp", nm: "종업원(기재)" }, { k: "lq", nm: "LQ", d: 2 }], { search: false, height: "340px" }); };
    $("#cl-grp").onchange = () => { fillMid(); draw(); }; $("#cl-mid").onchange = draw; fillMid(); draw();
  } },

{ id: "inflow", n: "②", t: "관내 유입", q: "관외 본사 사업장 · 외자 · 관외 기업", render() {
  const inD = E.action.inflow_dart, tg = D.trade.groups.sort((a, b) => b.수입억달러 - a.수입억달러), byHq = {}; for (const r of D.firms.filter(r => r.갈래 === "C 본사 관외")) byHq[r.본점시도] = (byHq[r.본점시도] || 0) + 1;
  const hqs = Object.entries(byHq).sort((a, b) => b[1] - a[1]);
  const bs = E.action.inflow_site || [], bsC = bs.filter(r => r.판정 === "관외 본사").length;
  return chain(3) + answer([`<b>1차 후보</b> — 본사 관외·사업장 관내 ${M.n_C}사(설비투자 확보 ${inD.length}사 · 전사 누적 설비투자 ${fmt(sum(inD, r => r.설비투자_억))}억)`, `<b>관외 본사의 화성 사업장</b> — KoDATA 명단 밖 국민연금 사업장 중 DART 본점 주소로 확인 ${bsC}곳 + 지점 추정 ${bs.length - bsC}곳 = ${bs.length}곳(기아 AutoLand·쿠팡 동탄 등)`, `<b>외자 표적</b> — 수입 ${fmt(D.trade.총수입, 0)}억달러의 ${fmt(D.trade.장비몫, 0)}% = 반도체 장비 3사(관내) · 협력사`, `최근 2년 협약 ${M.mou_2y}`],
    ["C 갈래 = KoDATA 주소(화성) ≠ DART 본점 주소 · 설비투자 = 감사보고서 전사 누적(화성분 분리 불가)", "관외 본사 사업장 = 국민연금 사업장명 → DART 회사 → 본점 주소(code/36) · 매출·세수는 별도 손익 기반 추정 · 표는 구간값", "관세청 HS6 2025 · 화성 신고 기준"]) +
  `<div class="grid"><div class="card"><h3>관외 본사 ${M.n_C}사 — 본사 시도</h3>${bar("p2a", hqs.map(h => h[0]), hqs.map(h => h[1]), hqs.map(() => "#C2410C"))}</div>
  <div class="card"><h3>수입 품목군 — 유치 표적 · 국산화 수요(억달러)</h3>${hbar("p2b", tg.map(r => r.군), tg.map(r => Math.round(r.수입억달러 * 10) / 10), tg.map(r => C.PAL.judge[r.판정] || "#D1D5DB"))}<div class="k">색 = 판정 · 보라 유치 · 초록 국산화 · 파랑 국산화·유치 · 적 대체 불가</div></div></div>
  <h2>본사 관외 · 관내 사업장 ${inD.length}사 — 설비투자 확보(C 갈래 ${M.n_C}사 중)</h2>${table(inD, [{ k: "기업명" }, { k: "산업" }, { k: "본점" }, { k: "관내사업장", nm: "관내 사업장(읍면동)" }, { k: "종업원", nm: "종업원(구간)" }, { k: "설비투자_억", nm: "전사 누적 설비투자(억)" }], { height: "360px" })}
  <h2>관외 본사 · 화성 사업장 ${bs.length}곳 — 국민연금 × DART(code/36) · 구간값</h2>${table(bs, [{ k: "사업장명" }, { k: "업종" }, { k: "읍면동" }, { k: "본점", nm: "본점 시군" }, { k: "판정" }, { k: "가입자수", nm: "화성 가입자(구간)" }, { k: "전사직원", nm: "전사 직원(구간)" }, { k: "매출_억", nm: "매출(억 · 구간)" }, { k: "연화성세수_억", nm: "연 화성 세수(억 · 추정 구간)" }], { height: "400px" })}<div class="k">세수 = 법인지방소득세 화성분(법인세비용 ÷ 11 × 화성 가입자 비중) + 주민세 종업원분 · 지점 추정 = 사업자번호 85 · ⑧b 3D 에 같은 목록</div>
  <h2>외자유치 — 거점 사례 · 유치 트랙</h2><div class="grid"><div class="card">${table(C.FOREIGN_CASES, autoCols(C.FOREIGN_CASES), { search: false })}</div><div class="card">${table(C.FOREIGN_TRACK, autoCols(C.FOREIGN_TRACK), { search: false })}</div></div>
  <h2>수입 상위 품목 40 — 완성 장비 유치 · 모듈·부분품 국산화</h2>${table(D.trade.imports, [{ k: "품목" }, { k: "군" }, { k: "판정" }, { k: "수입억달러", nm: "수입(억$)", d: 1 }, { k: "증감억달러", nm: "증감", d: 1 }, { k: "경기내비중", nm: "경기 내 비중%", d: 0 }], { height: "340px" })}`; } },

{ id: "self", n: "③", t: "관내 재투자", q: "관내 기업 증설 · 요건 시산", render() {
  const g = flowOf(), s0 = simulate(), inv = E.action.invest_in, grow = {}; for (const r of D.firms) if (r.성장갈래) grow[r.성장갈래] = (grow[r.성장갈래] || 0) + 1;
  return chain(4) + answer([`<b>관내 투자 공시</b> ${fmt(g["화성 관내"]?.억)}억 · ${g["화성 관내"]?.건}건 · ${g["화성 관내"]?.기업.size}사`, `<b>요건 충족</b>(투자 ${P.IV}억 且 고용 ${P.EMP}명) ${s0.n}사 · 설비투자 누적 ${fmt(E.sim.capex_sum)}억 · 근접 ${M.n_near}사`, `<b>집행</b> ${M.exec}억 — 요건 충족 기업 대상`],
    ["설비투자 = 감사보고서 전사 누적(관외 공장 포함) · 종업원 = 구간 대표값", `성장 유형 = 종업원 2개년↑ ${fmt(sum(Object.values(grow)))}사만 판정`]) +
  `<div class="tools"><b>요건 시산</b> 투자 ≥ <input type="range" id="iv" min="0" max="2000" step="50" value="${P.IV}"><span class="num" id="iv-v">${P.IV}</span>억 &nbsp; 고용 ≥ <input type="range" id="em" min="0" max="1500" step="25" value="${P.EMP}"><span class="num" id="em-v">${P.EMP}</span>명 &nbsp; <button id="cap" class="on">상한 적용(시설 ${P.CAP_FAC}억 · 고용 ${P.CAP_EMP}억)</button></div>
  <div id="sim"></div>
  <div class="grid"><div class="card"><h3>성장 유형 — 종업원 2개년↑ 기업의 설비투자·고용 방향</h3>${bar("p3a", Object.keys(grow), Object.values(grow), ["#047857", "#1E40AF", "#B45309", "#9CA3AF"])}</div>
  <div class="card"><h3>관내 투자 공시 ${inv.length}건</h3>${table(inv, [{ k: "기업명" }, { k: "유형" }, { k: "억" }, { k: "공시일" }, { k: "산업" }], { search: false, height: "300px" })}</div></div>
  <h2>투자·고용 동반 증가 ${E.action.capacity.length}사 — 설비투자 2023~25 > 2020~22 且 5년 고용 증가(본사 관내)</h2>${table(E.action.capacity, [{ k: "기업명" }, { k: "산업" }, { k: "종업원", nm: "종업원(구간)" }, { k: "고용증감5y", nm: "5년 고용(±50)" }, { k: "설비투자_억", nm: "누적(억)" }, { k: "연평균_억", nm: "연평균(억)" }, { k: "후반배", nm: "2023~25 ÷ 2020~22(배)", d: 1 }], { height: "340px" })}<div class="k">증가 폭 조건이 없다 — 1원만 커도 든다(누적 100억 미만이 절반) · 「여력」이 아니라 「방향」이다</div>`; },
  after() {
    const run = () => { const iv = +$("#iv").value, em = +$("#em").value, cap = $("#cap").classList.contains("on"), s = simulate(iv, em, cap);
      $("#iv-v").textContent = iv; $("#em-v").textContent = em;
      const dflt = iv === P.IV && em === P.EMP, tot = dflt ? (cap ? M.cost_cap : M.cost_free) : s.tot;   // 기본 요건은 정확값(code/24 meta) · 슬라이더를 움직이면 구간값 시산(검증 2026-09-19 ③: 1,641 vs 1,671)
      $("#sim").innerHTML = kpi([[fmt(s.n) + "사", "요건 충족"], [fmt(s.fac) + "억", "시설투자 보조 " + P.RATE * 100 + "%" + (dflt ? "(구간값)" : "")], [fmt(s.job) + "억", "고용 보조 · 초과 1인 70만×36개월" + (dflt ? "(구간값)" : "")], [fmt(tot) + "억", `소요 합계 · 기금 ${fmt(P.FUND)}억의 ${pct(tot, P.FUND)}% · ${dflt ? "정확값(정본)" : "구간값 시산"}`], [cap ? `${s.hitF} · ${s.hitE}` : "–", "상한 도달 기업 · 시설 · 고용(구간값)"]]) +
        table(s.df, [{ k: "기업명" }, { k: "산업" }, { k: "갈래", nm: "구분" }, { k: "고용구간" }, { k: "억", nm: "설비투자 누적(억)" }, { k: "지원_시설", nm: "시설 지원(억)", d: 1 }, { k: "지원_고용", nm: "고용 지원(억)", d: 1 }, { k: "성장갈래", nm: "성장 유형" }], { height: "320px" }); };
    $("#iv").oninput = run; $("#em").oninput = run; $("#cap").onclick = () => { $("#cap").classList.toggle("on"); run(); }; run(); } },

{ id: "outflow", n: "④", t: "관외 유출", q: "수도권 · 지방 · 해외", render() {
  const g = flowOf(), order = ["수도권 내", "지방", "해외"], out = order.reduce((s, k) => s + (g[k]?.억 || 0), 0), outN = E.action.outflow.length;
  const yr = {}; for (const r of D.outflow) { const y = String(r.rcept_dt).slice(0, 4); yr[y] ??= { 관내: 0, 관외: 0 }; yr[y][r.갈래 === "화성 관내" ? "관내" : "관외"] += r.억 || 0; } const ys = Object.keys(yr).sort();
  const eq = D.outflow.filter(r => r.갈래 !== "화성 관내" && r.억 != null && isEquity(r)), fac = D.outflow.filter(r => r.갈래 !== "화성 관내" && r.억 != null && !isEquity(r)), eqS = sum(eq, r => r.억), facS = sum(fac, r => r.억);
  return chain(5) + answer([`<b>관외·해외</b> ${fmt(out)}억 · ${outN}사 · ${order.reduce((s, k) => s + (g[k]?.건 || 0), 0)}건 — 수도권 내 ${fmt(g["수도권 내"]?.억)} · 해외 ${fmt(g["해외"]?.억)} · 지방 ${fmt(g["지방"]?.억)}`, `<b>설비형</b>(신규시설·유형자산 취득) ${fmt(facS)}억 · ${fac.length}건 — 공장·설비가 밖으로 · 원인은 용지 · 전력 · 계통 | <b>지분형</b>(타법인 출자 = 주식 취득) ${fmt(eqS)}억 · ${eq.length}건 — 공장 이전이 아니다`, `<b>관내</b> ${fmt(g["화성 관내"]?.억)}억`],
    [`DART 투자 공시 · 상장 110사 · 2021~2026.8 · 투자예정지 기준 ${D.outflow.length}건(정정은 마지막 것만 · 접수년 = 마지막 정정년) · 금액 = 공시 항목명 뒤의 수 · 타법인출자 좌표 = 발행회사 소재지`, "해외 = 생산기지 전략 · 지방 = 국비 보조금 경쟁 · 외감 비상장 2,281사의 유출은 공시가 없어 안 보인다"]) +
  `<div class="grid"><div class="card" style="grid-column:1/-1"><h3>투자 흐름 — 해외(미국 · 베트남 · 중국 · 일본 · 인도네시아) · 선 굵기 = 금액 · 원 = 지역 합계</h3><div id="p4m_w" class="plot" style="height:400px"></div></div></div>
  <div class="grid2"><div class="card"><h3>투자 흐름 — 국내 · 수도권(청) · 지방(황)</h3><div id="p4m_kr" class="plot" style="height:640px"></div></div><div class="stack">
  <div class="card"><h3>투자 공시 금액 — 유형별(억)</h3>${bar("p4a", ["화성 관내", ...order], ["화성 관내", ...order].map(k => Math.round(g[k]?.억 || 0)), ["화성 관내", ...order].map(k => C.PAL.flow[k]))}</div>
  <div class="card"><h3>연도별 — 관내 vs 관외·해외(억)</h3>${plot("p4b", [{ type: "bar", name: "관내", x: ys, y: ys.map(y => Math.round(yr[y].관내)), marker: { color: C.PAL.flow["화성 관내"] } }, { type: "bar", name: "관외·해외", x: ys, y: ys.map(y => Math.round(yr[y].관외)), marker: { color: "#9F1239" } }], { barmode: "stack", showlegend: true, legend: { orientation: "h" } })}</div></div></div>
  ${sol4(g)}<h2>유형별 대응</h2>${table(C.OUTFLOW_RESP, autoCols(C.OUTFLOW_RESP), { search: false })}
  <h2>기업별 관외 투자 ${E.action.outflow.length}사</h2>${table(E.action.outflow, [{ k: "기업명" }, { k: "갈래", nm: "구분" }, { k: "건" }, { k: "억" }, { k: "지역" }, { k: "최근" }], { height: "360px" })}
  <h2>공시 ${D.outflow.length}건</h2>${table(D.outflow, [{ k: "corp_name", nm: "기업" }, { k: "invest_type", nm: "유형" }, { k: "갈래", nm: "구분" }, { k: "지역" }, { k: "억" }, { k: "rcept_dt", nm: "공시일" }], { height: "340px" })}`; },
  after() { flowMap("p4m_kr", "kr"); flowMap("p4m_w", "world"); } },

{ id: "return", n: "⑤", t: "재환입", q: "회귀 유도 · 고용 보전", render() {
  const g = flowOf(), poAll = E.action.plant_out, po = poAll.filter(r => r.판정 === "관외 사업장 확인"), sudo = E.action.outflow.filter(r => r.갈래 === "수도권 내"), os = E.action.outflow_sum.find(r => r.갈래 === "수도권 내");
  return chain(6) + answer([`<b>협상 영역</b> — 수도권 내 ${fmt(os.억)}억 · ${os.건}건 · ${os.기업}사(수도권 내로만 나간 곳은 ${sudo.length}사)`, `<b>되돌릴 후보</b> — 본사 관내·공장 관외 ${po.length}사(전국 국민연금에 화성 밖 사업장 등록 확인 · 비율만 낮은 ${poAll.length - po.length}사는 미확인)`, `<b>지킬 고용</b> — 65세↑ 대표 ${fmt(D.succ.n65)}사 · ${fmt(D.succ.emp65)}명`],
    ["네 축 중 「유출 방지·관내 유도」 · 「본사 관내·공장 관외」 = KoDATA 종업원 100명↑ 제조 법인 중 화성 가입자 ÷ 종업원 ≤ 50% 且 전국 국민연금 파일에 같은 기업의 화성 밖 사업장(code/38 · 이름·사업자번호 결합) — 미확인은 사업장명이 다르거나 종업원 수가 부풀었을 수 있다"]) +
  sol5(g, po, os) + `<div class="grid"><div class="card"><h3>수도권 내로만 나간 기업 ${sudo.length}사(복수 지역 제외)</h3>${table(sudo, [{ k: "기업명" }, { k: "건" }, { k: "억" }, { k: "지역" }, { k: "최근" }], { search: false, height: "360px" })}</div>
  <div class="card"><h3>본사 관내 · 공장 관외 ${poAll.length}사 — 관외 사업장 확인 ${po.length} · 미확인 ${poAll.length - po.length}</h3>${table(poAll, [{ k: "기업명" }, { k: "업종" }, { k: "판정" }, { k: "KoDATA종업원", nm: "종업원(구간)" }, { k: "화성가입자" }, { k: "관내비율", nm: "관내 비율%" }, { k: "관외사업장", nm: "관외 사업장" }, { k: "관외시군", nm: "관외 시군" }, { k: "설비투자_억", nm: "설비투자(억)" }], { search: false, height: "360px" })}</div></div>
  <h2>승계 — 대표 연령대별 고용</h2><div class="grid"><div class="card">${bar("p5a", D.succ.age.map(r => r.대), D.succ.age.map(r => r.고용), D.succ.age.map(r => /^[678]/.test(r.대) ? "#9F1239" : "#9CA3AF"))}<div class="k">고용(명) · 대표 나이 확인 ${fmt(D.succ.n_age)}사 · 65세↑ 제조 ${fmt(D.succ.n65_mfg)}사 ${fmt(D.succ.emp65_mfg)}명</div></div><div class="card">${table(C.SUCC_ACTION, autoCols(C.SUCC_ACTION), { search: false })}</div></div>`; } },

{ id: "jobs", n: "⑥", t: "세수·고용 효과", q: "고용 · 연봉 · 세수(추정) · 지원 1건이 만드는 것", render() {
  // 2026-09-19 다시 씀 — 검토(tech_document/2026-09-19_세수고용효과-페이지-검토.md): 세금과공과는 세수가 아니고, 회수는 총량이 아니라 증분으로 잰다. 수치는 data/tax.json(code/37) + eco.json
  const T = D.tax, X = T.elig, W = T.wage, tier = E.tier.sort((a, b) => b.n_인당고지_만 - a.n_인당고지_만), big = E.big, bt = E.big_t;
  const t1 = tier.filter(r => r.차등.startsWith("1군")), wAvg = a => sum(a, r => r.n_인당고지_만 * r.n_가입자) / Math.max(1, sum(a, r => r.n_가입자)), sal1 = salary(wAvg(t1)), salAll = salary(wAvg(tier));
  const payroll = Math.round(X.emp_exact * W.mean_mfg / 1e4), capV = W.cap_month * NPS_RATE / 1e4, capped = v => v >= capV * 0.97;
  const u1 = T.units[0], u2 = T.units[1];
  return chain(7) + answer([`<b>요건 충족 ${X.n}사</b> — 고용 ${fmt(X.emp_exact)}명 · 국민연금으로 이은 ${X.nps_n}사의 자체 가중평균 연봉 ${won(X.own_wage)}원(제조 전체 평균 ${won(W.mean_mfg)}원) → <b>연 임금 약 ${fmt(X.own_payroll)}억</b>(고지 기반 · 상한 ${X.own_cap_n}사는 하한)`,
      `<b>이들이 화성시에 내는 세금(추정) 연 ${fmt(X.hs_total_yr)}억</b> = 법인지방소득세 화성분 ${fmt(X.hs_yr)}억 + 주민세 종업원분 ${fmt(X.res_yr)}억 · 법인세+법인지방소득세(국세 포함) 연평균 ${fmt(X.tax_yr)}억 × 3 = ${fmt(X.tax3_annualized)}억(${X.n_tax}사 · 2023~25 결산이 3년 다 있는 곳은 ${X.yrs_dist["3"] || 0}사) · 재산세·취득세는 없다`,
      `<b>지원의 효과는 총량이 아니라 한 건의 증분으로 잰다</b> — 요건 충족 중위 한 건: 지원 ${fmt(u1.건당지원)}억 ↔ 고용 +${fmt(u1.건당고용)}명 · 연 지방세 ${u1.건당지방세}억(회수 ${fmt(u1.회수년)}년) · 대웅바이오 규모 한 건: ${fmt(u2.건당지원)}억 ↔ +${fmt(u2.건당고용)}명 · ${u2.건당지방세}억(${fmt(u2.회수년)}년). <b>세수로는 돌아오지 않고 고용으로 돌아온다</b> — 다만 자릿수는 세수로 지켜야 한다(상한)`],
    [`「요건 충족」은 <b>누적</b> 설비투자 200억↑·종업원 100명↑이다 — 한 해 200억↑ 투자는 ${X.n_single200}사, 최근 3년 합 200억↑ ${X.n_3y200}사, 누적으로만 넘는 곳 ${X.n_cum_only}사(공시 햇수 중위 ${X.yrs_med}년) · 비제조 ${X.n_nonmfg}사 포함`,
     `연봉 = 국민연금 인당 월 고지액 ÷ ${NPS_RATE * 100}%(${W.M1} · 사업장+근로자) × 12 · 기준소득월액 상한 ${fmt(W.cap_month / 1e4)}만원 → 연봉 ${fmt(W.cap_salary)}만 위는 안 보인다(≥ 표시) · 고지에 소급·정산 섞임`,
     `세수 = KoDATA 법인세비용·DART 감사보고서 추정(2023~25 · 법인지방소득세 = 1/11 · 본점 갈래 안분) + 국민연금 가입자 × 급여 × 0.5% · <b>납부액이 아니다</b> · 고용은 정확값 합(배포판 표는 구간값)`]) +
  kpi([[won(W.mean_mfg) + "원", "제조 사업장 연봉 · 가입자 가중평균"], [won(W.med_site_mfg_10) + "원", "제조 사업장 연봉 · 사업장 중위(10명↑)"], [won(sal1) + "원", "1군(국가첨단전략) 가입자 가중평균"], [fmt(W.big_emp) + "명", `300명↑ 사업장 ${W.big_n}곳 가입자 · ${W.M1}`], [`${W.big_cap_n}곳 · ${fmt(W.big_cap_emp)}명`, `300명↑ 중 상한에 걸린 곳(연봉 ≥ ${fmt(W.cap_salary)}만)`]]) +
  `<h2>세수 — 같은 ${X.n}사를 어떤 자로 재느냐</h2><div class="grid"><div class="card"><h3>회수 연수가 자에 따라 갈린다 (누적 소급 가상 지원 ${fmt(X.tier_cum)}억 ÷ 연간)</h3>${table(T.recover, [{ k: "자" }, { k: "연간", nm: "연간(억)" }, { k: "회수년", nm: "회수(년)", d: 1 }], { search: false })}
    <div class="k">${fmt(X.tier_cum)}억은 요건 충족 ${X.n}사의 <b>누적</b> 설비투자 ${fmt(X.capex_cum)}억(기업마다 1~17년치)에 군별 배율 10·7·5%·상한을 소급한 가상값이다. 최근 3년 capex ${fmt(X.cap3)}억(${X.n_cap3}사) 기준이면 ${fmt(X.tier3)}억 · <b>연 ${fmt(X.tier3_yr)}억</b>. 총량끼리의 회수는 참고일 뿐 — 효과는 아래 「한 건」으로 본다.</div></div>
  <div class="card"><h3>군별 — 요건 충족 기업</h3>${table(T.by_tier, [{ k: "군" }, { k: "기업" }, { k: "종업원" }, { k: "설비투자3", nm: "설비투자 3년(억)" }, { k: "법인세3", nm: "법인세+지방소득세 3년(억)" }, { k: "연화성", nm: "화성 몫 연(억)" }, { k: "차등3년", nm: "차등 지원 3년 capex 기준(억)" }], { search: false })}</div></div>
  <h2>지원 1건이 만드는 것 — 두 단위 × 가동률 (기금 ${fmt(T.fund)}억)</h2><div class="grid"><div class="card">${table(T.scn, [{ k: "단위" }, { k: "시나리오" }, { k: "가동률", f: v => pct(v, 1) + "%" }, { k: "협약", nm: "협약(건)" }, { k: "가동", nm: "가동(건)" }, { k: "신규고용", nm: "신규 고용(명)" }, { k: "연지방세", nm: "연 법인지방소득세(억)" }, { k: "회수년", nm: "세수로 기금 회수(년)" }], { search: false })}
    <div class="k">건당 지원·고용·세수는 같은 기업에서 뽑았다(요건 충족 관내 기업의 중위 / 대웅바이오 산정례: 투자 ${fmt(T.dw.invest)}억 · 지원 ${fmt(T.dw.new)}억). 가동률 ${pct(T.jb.recent, 1)}%·${pct(T.jb.longrun, 1)}%는 전북 민선8기·장기 실적. 작은 건을 많이 하는 쪽이 고용은 크고, 세수 회수는 어떤 기업을 성사시키느냐가 정한다 — <a href="#action">⑦ 실행 과제</a>와 시장 보고(mayor-incentive)가 같은 수치다.</div></div>
  <div class="card"><h3>산업군별 — 요건 충족 기업의 세수(추정)</h3>${table(T.by_mid.map(r => ({ ...r, 연봉: salary((tier.find(t => t.mid === r.mid) || {}).n_인당고지_만) })), [{ k: "산업" }, { k: "군" }, { k: "기업" }, { k: "종업원" }, { k: "연봉", nm: "연봉(만)" }, { k: "설비투자3", nm: "설비 3년(억)" }, { k: "법인세3", nm: "법인세 3년(억)" }, { k: "연화성", nm: "화성 몫 연(억)", d: 1 }, { k: "인당_만", nm: "인당 화성 세수(만)" }], { search: false, height: "360px" })}</div></div>
  <h2>연봉 — 산업군별 · 300명 이상 사업장 ${big.length}곳(국민연금 공개자료 · 법인·기관)</h2>
  <div class="grid"><div class="card"><h3>산업군별 연봉(만원 · 가입자 가중평균)</h3>${hbar("p7a", tier.map(r => r.산업), tier.map(r => salary(r.n_인당고지_만)), tier.map(r => r.차등.startsWith("1군") ? "#1E40AF" : r.차등.startsWith("2군") ? "#B45309" : "#9CA3AF"))}<div class="k">파랑 1군 · 금 2군 · 회 3군 · 제조 전체 가중평균 ${won(W.mean_mfg)}원 · 사업장 중위 ${won(W.med_site_mfg_10)}원</div></div>
  <div class="card">${bar("p7b", bt.map(r => r.군), bt.map(r => r.가입자), bt.map(r => r.군 === "1군" ? "#1E40AF" : r.군 === "2군" ? "#B45309" : "#9CA3AF"))}<div class="k">군별 가입자(명) · 사업장 ${bt.map(r => `${r.군} ${r.사업장}`).join(" · ")}</div></div></div>
  <div class="card">${table(big.map(r => ({ ...r, 연봉: (capped(r.인당고지_만) ? "≥ " : "") + fmt(salary(r.인당고지_만)), 임금총액: Math.round(r.가입자수 * salary(r.인당고지_만) / 1e4) })), [{ k: "사업장명" }, { k: "산업군" }, { k: "구" }, { k: "가입자수" }, { k: "연봉", nm: "추정 연봉(만)" }, { k: "임금총액", nm: "연 임금(억 · 하한)" }, { k: "본사" }], { height: "360px" })}<div class="k">≥ = 국민연금 상한에 걸려 실제 연봉은 이보다 높다(${W.big_cap_names.join(" · ")}) · 임금총액도 하한</div></div>`; } },

{ id: "action", n: "⑦", t: "실행 과제", q: "과제 12 · 담당 · 시한 · 완료 기준", render() {
  const os = E.action.outflow_sum.find(r => r.갈래 === "수도권 내"), po = E.action.plant_out.filter(r => r.판정 === "관외 사업장 확인").length, inD = E.action.inflow_dart.length, cap = E.action.capacity.length, s0 = simulate(), tot = E.elig_tot[0], bsN = (E.action.inflow_site || []).length;
  const A = [
    { w: 0, c: 0, t: "기업별 담당자 지정", what: `요건 충족 ${s0.n}사 · 근접 ${M.n_near}사 · 본사 관외(설비투자 확보) ${inD}사 · 관외 본사 화성 사업장 ${bsN}곳 · 수도권 내 유출 ${os.기업}사 · 공장 관외(확인) ${po}사 — 1기업 1담당`, who: "투자유치 주관 부서(잠정)", out: "담당자 배정표(기업·담당·첫 연락일)", done: "명단 100% 배정 · 첫 연락 30일 안", why: `집행 ${M.exec}억 · 협약 ${M.mou_2y}`, ref: ["jobs"] },
    { w: 0, c: 0, t: "수도권 내 유출 기업 면담", what: `${os.건}건 ${fmt(os.억)}억 · ${os.기업}사 — 투자 계획 · 나간 이유(용지·전력·인허가) 청취`, who: "담당자 + 부서장", out: "면담 기록 · 관내 대안 요청 목록", done: `${os.기업}사 전부 접촉 · 대안 요청 건수`, why: "협상 가능한 유일한 유형 · 공시 후 대응 불가", ref: ["outflow", "return"] },
    { w: 0, c: 0, t: "투자 4유형 계기판 첫 기록", what: "관내 유입 · 관내 재투자 · 관외 유출 · 재환입 — 현재값 표 1장 · 매년 같은 칸", who: "투자유치 주관 부서", out: "계기판 1장(관내 유입 · 관내 재투자 · 관외 유출 · 재환입)", done: "네 칸 값 기록 · 다음 기록일 지정", why: "성과를 셀 자 없음", ref: ["jobs"] },
    { w: 0, c: 0, t: "미측 수치 3개 요청", what: "인허가 실제 소요일 · 산업용지 재고·분양가 · 용수·폐수 여유 용량", who: "인허가·도시계획·상하수도 부서(잠정)", out: "수치 3개 + 출처", done: "대시보드 「미측」 셋 → 값", why: "유출 원인 셋 중 둘이 데이터 없음", ref: ["outflow"] },
    { w: 1, c: 1, t: "부지·전력·인허가 동시 점검 회의 상설", what: "투자 상담 건마다 부지·계통·인허가·용수 한자리 점검(나주 방식)", who: "투자유치 + 도시계획 + 인허가 + 한전 협의(잠정)", out: "회의록 · 병목 목록", done: "월 1회 · 상담→회의 7일 안", why: "기업의 기준 = 착공 시점", ref: ["outflow"] },
    { w: 1, c: 1, t: "계통 증설 요청", what: `요건 충족 ${s0.n}사 + 투자·고용 동반 증가 ${cap}사 증설 계획 → MW 합산 → 한전 요청`, who: "투자유치 주관 + 에너지 담당(잠정)", out: "요청서(기업·MW·시기)", done: "요청 MW · 회신 · 확보 MW", why: "전력 +31%(평택 +212%) · 계통 포화", ref: ["eco"] },
    { w: 1, c: 1, t: "장비 3사 협력사 동반 입주 IR", what: `수입 ${fmt(D.trade.장비몫, 0)}% 장비 3사 + 표적 품목군(검사·계측·광학·특수가스) 협력사 초청`, who: "투자유치 주관 + 산업 담당(잠정)", out: "후보 협력사 목록 · IR 1회", done: "후보 20사↑ · 후속 면담 5사", why: "집적(●●●) = 최상위 요인", ref: ["inflow"] },
    { w: 1, c: 1, t: "본사 이전 트랙 설계", what: `본사 관외·사업장 관내 ${M.n_C}사(설비투자 확보 ${inD}사 우선) + 관외 본사 화성 사업장 ${bsN}곳(기아·쿠팡 등) — 연구소 요건 ½ · 협약 관문`, who: "투자유치 주관 부서", out: "트랙 안 · 첫 협약 후보 10사", done: "첫 협약 1건", why: "인력·본사 기능(●●●) · 정주 = 본사 기능", ref: ["inflow"] },
    { w: 2, c: 1, t: "조례·규칙 개정안", what: "총액 상한 조문 · 착공 후 선지급 · 사후관리 기간 · 연 1회 이행 보고 · 12개월 내 착수 지표 · 기업별 담당자", who: "투자유치 주관 + 법무(잠정)", out: "개정안 · 12곳 대조표", done: "의회 제출", why: "다섯 요소 중 화성 1개 · 「且 100명」 최엄격", ref: ["jobs"] },
    { w: 2, c: 2, t: "차등 지원 안 예산 검증", what: `일률 5% ${fmt(tot.현행_억)}억 → 차등 ${fmt(tot.차등_억)}억(요건 충족 45사의 누적 투자 1~17년치에 소급한 가상값 · 최근 3년 설비투자 기준이면 연 ${fmt(D.tax?.elig?.tier3_yr)}억) · 1군 상한 300억`, who: "투자유치 + 예산 부서(잠정)", out: "검증 보고(연차별 소요·재원)", done: "안(案) → 확정안 또는 수정안", why: "1군 = 임금 높은 산업군 · 성과 = 양질의 일자리", ref: ["jobs"] },
    { w: 2, c: 1, t: "승계 창구 개설", what: `KoDATA 대표자 생년 정식 항목 요청 · 65세↑ 대표 ${fmt(D.succ.n65)}사(고용 ${fmt(D.succ.emp65)}명) 상담·중개`, who: "기업지원 담당(잠정)", out: "나이 확인 명단 · 상담 창구", done: "나이 확인율 · 상담 건수 · 승계 완료 수", why: "유치 없이도 잃는 일자리 66,026명", ref: ["return"] },
    { w: 3, c: 2, t: "AI 전환 트랙 신설", what: "관내 법인 전수(법인등록번호 33,084사 · ⑨ 깔때기) — 투자 20억↑ 또는 인력 10명↑ · 고용 유지 조건 · 기초 스마트공장", who: "투자유치 + 산업 담당 + 예산(잠정)", out: "트랙 안 · 예산 요구서", done: "다음 예산 반영", why: "AI = 기존 공장 전환(데이터센터 유치 아님)", ref: ["self"] }];
  const W = ["30일 안", "분기 안", "연내", "다음 예산"], CC = ["비용 없음", "인력·회의", "예산"];
  const nm = Object.fromEntries(Q.map(q => [q.id, q.n]));
  const card = (a, i) => `<div class="act c${a.c}"><div class="n">${i + 1}</div><h3>${a.t}</h3><p><b>무엇을</b> ${a.what}</p><p><b>누가</b> ${a.who}</p><p><b>산출물</b> ${a.out}</p><p><b>완료 판정</b> ${a.done}</p><p class="k"><b>왜</b> ${a.why} · 근거 ${a.ref.map(r => `<a href="#${r}">${nm[r]}</a>`).join(" ")}</p></div>`;
  return chain(8) + answer([`<b>액션 ${A.length}</b> — 30일 안 ${A.filter(a => a.w === 0).length} · 분기 안 ${A.filter(a => a.w === 1).length} · 연내 ${A.filter(a => a.w === 2).length} · 다음 예산 ${A.filter(a => a.w === 3).length}`, `<b>예산 필요</b> ${A.filter(a => a.c === 2).length}개 · <b>비용 없이 30일 안</b> ${A.filter(a => a.c === 0).length}개`],
    ["담당 = 잠정(부서명 실무 확인) · 완료 판정 = 수치 · 「왜」 = 앞 페이지(결과·원인·방안) 링크"]) +
  `<div class="legend k">왼쪽 띠: <span class="sw c0"></span>비용 없음 · <span class="sw c1"></span>인력·회의 · <span class="sw c2"></span>예산</div>` +
  W.map((w, wi) => `<h2>${w} — ${A.filter(a => a.w === wi).length}개</h2><div class="actgrid">${A.map((a, i) => a.w === wi ? card(a, i) : "").join("")}</div>`).join("") +
  `<h2>한 표로</h2><table class="t"><tr><th>#</th><th>액션</th><th>언제</th><th>비용</th><th>완료 판정</th><th>근거</th></tr>${A.map((a, i) => `<tr><td>${i + 1}</td><td><b>${a.t}</b></td><td>${W[a.w]}</td><td>${CC[a.c]}</td><td>${a.done}</td><td>${a.ref.map(r => `<a href="#${r}">${nm[r]}</a>`).join(" ")}</td></tr>`).join("")}</table>`; } },

{ id: "map", n: "⑧", t: "공간 분포", q: "투자 4유형 3D — 관내 유입 · 관내 재투자 · 관외 유출 · 재환입", render() {
  return chain(9) + answer([`<b>① 관내 유입</b> — 관외 본사 → 화성 사업장(선 · 기둥 = 설비투자)`, `<b>② 관내 재투자</b> — 요건 충족 ${E.sim.n_elig}사 · 투자·고용 동반 증가 ${E.action.capacity.length}사(요건 근접 ${M.n_near}사는 따로) · 관내 공시`, `<b>③ 관외 유출</b> — 지구본 · 화성 사업장 → 투자예정지 · 전체/세계/국내/수도권`, `<b>④ 재환입</b> — 수도권 내 → 화성 · 본사 관내·공장 관외 25사`], ["배경 OpenFreeMap · 종업원 = 구간 대표값 · 기업 = DART 매핑 법인 · 투자예정지 = 공시 · 시 경계·행정동 29"]) +
  `<div class="k" style="margin:4px 0 8px">새 창: <a href="invest-3d/index.html" target="_blank">invest-3d/index.html</a></div><iframe class="map" src="invest-3d/index.html" loading="lazy"></iframe>`; } },

{ id: "tax3d", n: "⑧b", t: "세수 3D", q: "기업이 화성시에 내는 세금을 자리에 세운다 — 이익 세금 · 사람 세금 · 삼성 · 본사 밖 사업장", render() {
  return chain(9) + answer([`<b>연 화성 세수 = 이익에 붙는 세금 + 사람에 붙는 세금</b> — 법인지방소득세(추정) + 주민세 종업원분(추정). 이익 세금은 불황이면 0, 사람 세금은 해마다 그대로`, `<b>삼성전자 한 곳(약 2,300억)이 DART 매핑 법인 전부의 합보다 크다</b> — 필지 위 파란 기둥`, `<b>본사 밖 사업장</b>(팔각 기둥) — 기아 오토랜드 화성처럼 KoDATA 명단에 없는 곳을 국민연금 사업장 + DART 로 세웠다`], ["배포판 · 기업 = DART 매핑 법인 · 종업원·매출·세수 = 구간 대표값 · 세수는 납부액이 아니라 추정 · 재산세·취득세 없음 · 건물 브이월드"]) +
  `<div class="k" style="margin:4px 0 8px">새 창: <a href="tax-3d/index.html" target="_blank">tax-3d/index.html</a></div><iframe class="map" src="tax-3d/index.html" loading="lazy"></iframe>`; } },

{ id: "trust", n: "⑨", t: "기업 데이터", q: "무엇을 모았고 · 무엇이 빠졌나", render() {
  const f = D.firms, known = f.filter(r => r.emp_last != null).length, trend = f.filter(r => r.추세가능).length, um = E.action.unmatched_sum[0], nps = C.SOURCES.find(r => r.자료.startsWith("국민연금")), cov = Object.fromEntries(C.COVERAGE.map(r => [r.단계, r.기업]));
  const rate = (a, b) => `${(100 * a / b).toFixed(1)}%`;
  // 깔때기 — json 단계(모집단·DART·설비투자·추세·요건) + 문서 단계(COVERAGE). 한 기업을 「말할 수 있는」 깊이로 갈수록 줄어든다
  // 깔때기 — 두 축이다. KoDATA 전수 축(모집단 → 종업원 관측 → 재무 → 법인 → 증감)과 DART 매핑 2,391사 안쪽 축(매핑 → 종업원 → 파싱 → 금액 → 추세 → 요건). 아래 축은 위 축의 부분집합이 아니다(판정 기준이 다르다) — 색으로 가른다
  const funK = [["KoDATA 모집단(전수)", M.kodata_all], ...C.COVERAGE.filter(r => !r.단계.startsWith("감사보고서")).map(r => [r.단계, r.기업])];
  const funD = [["DART 매핑(상장 110·외감 2,281)", M.map_n], ["종업원 확인(DART 매핑 중)", known], ["감사보고서 파싱", cov["감사보고서 파싱(1,486사 · 6,462건)"]], ["설비투자 금액 확보", M.cap_amt], ["5년 고용 추세 판정", trend], ["요건 충족(200억·100명)", M.n_elig]];
  const fun = [...funK, ...funD], funC = [ "#9CA3AF", ...funK.slice(1).map(() => C.PAL.hq["B 관내 분리"]), ...funD.map(() => C.PAL.hq["A 본사=사업장"])];
  const BR = E.branch_sum || [], brN = sum(BR, r => r.사업장), brOf = k => BR.find(r => r.판정 === k)?.사업장 ?? 0, brTxt = `관외 본사 ${fmt(brOf("관외 본사") + brOf("관외 본사 추정(지점)"))}(확인 ${fmt(brOf("관외 본사"))} · 지점 추정 ${fmt(brOf("관외 본사 추정(지점)"))}) · 비영리 ${fmt(brOf("비영리"))} · 관내 본사인데 명단에 없는 ${fmt(brOf("관내 본사(KoDATA 누락)"))} · 표기 차 ${fmt(brOf("KoDATA 기업(표기 차이 — 기업 기둥에 있음)"))} · 미확인 ${fmt(brOf("미확인"))}`;
  // 빠진 것 — json 으로 세는 넉 줄 + 문서 실측(GAPS)
  const gaps = [
    { 빠진것: "DART 매핑 안 된 법인(외감·상장 아님)", 업체수: `${fmt(cov["법인(법인등록번호)"] - M.map_n)}사 = 법인 ${fmt(cov["법인(법인등록번호)"])} − DART 매핑 ${fmt(M.map_n)}(추정)`, 왜: `DART 공시 의무는 상장·외부감사 대상만 — 법인 ${fmt(cov["법인(법인등록번호)"])} 중 매핑 ${fmt(M.map_n)}(${rate(M.map_n, cov["법인(법인등록번호)"])}) · 모집단 대비 ${rate(M.map_n, M.kodata_all)}`, 보완: "국민연금 사업장(3인↑ 법인 전부)의 가입자·고지액으로 규모만 · 설비투자는 신청주의", 기준: `스냅숏 ${M.built_at}` },
    { 빠진것: "설비투자 금액 없는 DART 매핑 법인", 업체수: `${fmt(M.map_n - M.cap_amt)}사 = ${fmt(M.map_n)} − ${fmt(M.cap_amt)} (${rate(M.map_n - M.cap_amt, M.map_n)})`, 왜: "빈손 905사(소급 기록 849 · 공시 없음 32 · 현금흐름표 미검출 22 · 감사보고서 없음 2) + 파싱됐으나 유형자산 취득 주석 없음·0 316사", 보완: "180일 뒤 재시도 · 감사보고서는 해마다 새로 나옴", 기준: `스냅숏 ${M.built_at}` },
    { 빠진것: "종업원 결측 · 5년 추세 불가(DART 매핑 중)", 업체수: `결측 ${fmt(f.length - known)}사 · 추세 가능 ${fmt(trend)}사뿐(${rate(trend, f.length)})`, 왜: "KoDATA 종업원 시계열이 성김 — 한 해만 관측된 곳이 많고, 가장 크게 채용한 기업(장비 3사)이 여기 속함", 보완: "국민연금 월별 가입자수(파일 128개월)로 대체 — 다음 일", 기준: `스냅숏 ${M.built_at}` },
    { 빠진것: "국민연금 화성 사업장 중 KoDATA 명단에 없는 곳", 업체수: `${fmt(um.사업장)} 사업장 · 가입자 ${fmt(um.가입자)}명 · 월 고지액 ${fmt(um.월고지_억)}억`, 왜: "KoDATA 는 본사 화성인 기업만 — 본사 관외의 공장·물류센터·병원·대학(기아 AutoLand·쿠팡 동탄 등) · 사업자번호 앞 6자리만 공개", 보완: `법인·10명↑ ${fmt(brN)}곳을 DART 본점 주소로 판정 — ${brTxt} · 관외 본사는 ② 표·⑧b 3D(구간값) · 매출은 국민연금에 없어 DART 별도 손익으로`, 기준: `국민연금 ${E.M1} · code/36` },
    ...C.GAPS];
  const gcols = [{ k: "빠진것", nm: "빠진 것" }, { k: "업체수" }, { k: "왜" }, { k: "보완" }, { k: "기준" }];
  return chain(10) + answer([`<b>원천 ${C.SOURCES.length}갈래</b> — KoDATA 명단 ${fmt(M.kodata_all)}사 위에 DART 감사보고서 ${fmt(M.map_n)}사(원문 9,097건) · 투자 공시 144건 · 국민연금 사업장 16,570곳 · KOSIS 광업제조업조사 · 관세청 HS6 5,613부호 · 한전 · 브이월드 · 자치법규 9곳 · KDI·국토연·대한상의 선행조사를 포개어 봤다`,
    `<b>그럼에도 빠진 기업 데이터가 있다</b> — 감사보고서는 외감 법인 ${fmt(M.map_n)}사(${rate(M.map_n, M.kodata_all)})만 · 그중 설비투자 금액은 ${fmt(M.cap_amt)}사 · 개인사업자 92,876사(72%)는 재무가 없다 · 국민연금 화성 사업장 ${fmt(um.사업장)}곳(${fmt(um.가입자)}명)은 KoDATA 명단과 못 이었다 — 법인·10명↑ ${fmt(brN)}곳을 가려 보면 ${brTxt}(code/36) · 1~2인 사업장은 어느 원천에도 없다`],
    ["기업 하나를 「말할 수 있는」 깊이는 아래 깔때기 — 큰 기업 쪽으로 치우친 표본이라 투자유치(큰 기업 찾기)엔 쓰고 소상공인 정책엔 쓰지 않는다 · 세수 = 법인지방소득세 화성분 + 주민세 종업원분(추정 · code/33·35 — 세금과공과는 세수가 아니라 2026-09-19 뺐다) · 연봉 = 국민연금 인당 고지액 ÷ 9.5% × 12(추정) · 「본사 관내·공장 관외」 = 추정 · 우대 지원 방안 = 안(案)"]) +
  kpi([[fmt(M.kodata_all), "KoDATA 모집단(사)"], [fmt(M.map_n), `DART 감사보고서 법인(사) · ${rate(M.map_n, M.kodata_all)}`], [fmt(M.cap_amt), "설비투자 금액 확보(사)"], ["16,570", "국민연금 화성 사업장(곳)"], [fmt(um.사업장), `└ KoDATA 명단 밖(곳) · ${fmt(um.가입자)}명`], ["9,097", "감사보고서 원문(건)"]]) +
  `<h2>수집한 원천 ${C.SOURCES.length}갈래 — 쓰임 · 한계</h2>${table(C.SOURCES, [{ k: "자료" }, { k: "쓰임" }, { k: "한계" }], { search: false })}
  <h2>기업 데이터 깔때기 — 모집단에서 한 기업을 말할 수 있는 깊이까지</h2><div class="grid"><div class="card"><h3>단계별 기업 수(사) · 로그 눈금</h3>${hbar("cov-h", fun.map(r => r[0]), fun.map(r => r[1]), funC, { margin: { l: 215, r: 40, t: 10, b: 30 }, xaxis: { type: "log", range: [1, Math.log10(M.kodata_all) + 1.4], showgrid: false, zeroline: false, showticklabels: false }, height: 340 })}<div class="k">회색 = 모집단 · 초록 = KoDATA 전수에서 센 단계(전수 점검 2026-09-07) · 파랑 = <b>DART 매핑 ${fmt(M.map_n)}사 안에서</b> 센 단계(위 단의 부분집합이 아니다 · 파싱 수는 수집 결과 2026-09-06 · 나머지는 스냅숏 ${M.built_at})</div></div>
  <div class="card"><h3>왜 줄어드나</h3><ul class="bul"><li>모집단의 72%가 <b>개인사업자</b> — 재무제표 공시 의무가 없다(93,419사 미보유)</li><li>DART 공시 의무는 <b>상장·외감 법인</b>만 — ${fmt(M.map_n)}사 = 상장 110 + 비상장 외감 2,281 · 12,561개 corp_code 전수 조회(누락 0)</li><li>감사보고서를 받아도 <b>현금흐름표의 유형자산 취득</b>이 없거나 0 이면 설비투자를 못 센다 — 빈손 905사</li><li>감사보고서는 <b>전사 집행액</b> — 화성 사업장분은 분리되지 않는다(공시도 48% 는 투자지 미기재)</li><li>종업원 5개년이 다 있는 기업은 소수 — 추세 판정 ${fmt(trend)}사</li></ul></div></div>
  <h2>빠진 기업 데이터 — 무엇이 · 몇 사 · 왜 · 어떻게 메우나</h2>${table(gaps, gcols, { search: false })}
  <h2>국민연금으로 본 사각 — KoDATA 명단 밖 사업장</h2><div class="grid"><div class="card"><h3>규모</h3>${kpi([[fmt(um.사업장), "사업장(곳)"], [fmt(um.가입자), "가입자(명)"], [`${fmt(um.월고지_억)}억`, "월 보험료 고지액"], [fmt(E.big_sum.reduce((s, r) => s + r.관외본사, 0)), `300명↑ 사업장 ${fmt(E.big_sum.reduce((s, r) => s + r.사업장, 0))}곳 중 KoDATA 명단 밖(곳)`]])}<div class="k">${esc(nps?.쓰임 ?? "")}</div></div>
  <div class="card"><h3>무엇이 안 보이나 · 어떻게 쓰나</h3><ul class="bul"><li>KoDATA 명단은 <b>본사 소재</b> 기준 — 본사가 서울·수원인 기업의 화성 공장·물류센터·병원·대학은 명단에 없다</li><li>국민연금 화성 사업장 ${fmt(um.전체사업장)}곳(공사현장 제외) 중 ${fmt(um.결합사업장)}곳(${rate(um.결합사업장, um.전체사업장)})은 KoDATA 와 이었고 ${fmt(um.사업장)}곳이 남았다 — 사업자번호가 앞 6자리만 공개라 번호+이름으로 잇는다</li><li>남은 곳이 다 관외 본사는 아니다 — 법인·10명↑ ${fmt(brN)}곳: ${brTxt} · <b>관외 본사 ${fmt(brOf("관외 본사") + brOf("관외 본사 추정(지점)"))}곳이 「관내 유입」의 1차 대상</b>이다(② 표 · ⑧b)</li><li>매출·설비투자는 국민연금에 없다 — 가입자수·고지액으로 규모만 가늠하고, 감사보고서(본사 관외 C 갈래 ${fmt(M.n_C)}사)로 설비투자를 본다</li><li>1~2인 법인·소규모 개인사업장은 국민연금도 KoDATA 도 비어 있다 — 메울 원천이 없다</li></ul></div></div>
  <h2>별첨 PDF ${C.PDFS.length}편 — 수치 정본</h2>${table(C.PDFS, [{ k: "구분" }, { k: "제목" }, { k: "파일" }], { search: false, height: "400px" })}
  <h2>배포판이 싣지 않는 것</h2><ul class="bul"><li>정확 종업원수·급여·연구개발비 → 종업원 7구간 대표값(25·75·150·250·400·750·1,500) · 5년 증감 ±50 반올림</li><li>개인사업자 상호·식별자 → 행정동 집계만</li><li>투자 공시 원문·상세주소 → 시군까지 · 3D 점 주소 읍면동까지</li><li>국민연금 미매칭 사업장 원명단(60곳) → 내부 대조용 · 관외 본사로 판정된 곳만 구간값으로 ②·⑧b 에</li></ul>`; } },
];

// ── 라우팅 ────────────────────────────────────────────────────────────────────
$("#nav").innerHTML = Q.map(q => `<a href="#${q.id}" data-id="${q.id}"><span class="n">${q.n}</span>${q.t}</a>`).join("");
function go() {
  const id = location.hash.slice(1) || Q[0].id, q = Q.find(x => x.id === id) || Q[0];
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.dataset.id === q.id));
  $("#page").innerHTML = `<h1>${q.n} ${q.t}<span class="q">${q.q}</span></h1>` + q.render();
  if (q.after) q.after(); window.scrollTo(0, 0); addZoom();
}
// ── 카드 확대 — 카드 좌측 하단 ⤢ → 팝업으로 옮겨 크게 본다(복제가 아니라 이동 · Plotly 인스턴스 유지 · 닫으면 제자리) ─────
let zoomHome = null;
function addZoom() { document.querySelectorAll("#page .card").forEach(c => { if (c.querySelector(":scope > .zoom")) return; const b = document.createElement("button"); b.className = "zoom"; b.title = "크게 보기"; b.textContent = "⤢"; b.onclick = () => openZoom(c); c.appendChild(b); }); }
function resizePlots(root) { root.querySelectorAll(".js-plotly-plot").forEach(p => { try { Plotly.Plots.resize(p); } catch (e) {} }); }
function openZoom(card) {
  if (zoomHome) closeZoom();
  const ph = document.createComment("zoom"); card.parentNode.insertBefore(ph, card); zoomHome = { card, ph };
  card.classList.add("big"); $("#mbody").appendChild(card); $("#modal").hidden = false; document.body.style.overflow = "hidden"; setTimeout(() => resizePlots(card), 30);
}
function closeZoom() { if (!zoomHome) return; const { card, ph } = zoomHome; card.classList.remove("big"); ph.parentNode.insertBefore(card, ph); ph.remove(); zoomHome = null; $("#modal").hidden = true; document.body.style.overflow = ""; setTimeout(() => resizePlots(card), 30); }
$("#mclose").onclick = closeZoom; $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeZoom(); }); document.addEventListener("keydown", e => { if (e.key === "Escape") closeZoom(); }); addEventListener("hashchange", closeZoom);
addEventListener("hashchange", go); go();
