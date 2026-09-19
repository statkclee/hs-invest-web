// 화성특례시 세수 3D — MapLibre GL JS + OpenFreeMap + Mapterhorn + 브이월드 건물(hwaseong-3d 링크) + 기업 세수 기둥 + 행정동 슬래브 + 삼성 캠퍼스.
// kodata/app_3d/app.js(3D 기업 탐색)의 뼈대를 세수용으로 다시 썼다(매싱은 뺐다). 수치는 code/02_build_data.R 이 만든 data/ 만 읽는다.
import { addTopography } from "./topography.mjs";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const $ = id => document.getElementById(id), status = t => { $("status").textContent = t; };
window.addEventListener("error", e => status("JS 오류: " + e.message + " (" + (e.filename || "").split("/").pop() + ":" + e.lineno + ")"));   // 조용히 멎지 않게 — 상태 줄에 띄운다
window.addEventListener("unhandledrejection", e => status("JS 오류(비동기): " + (e.reason?.message || e.reason)));
const fmt = (v, d) => v == null ? "–" : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : Number.isInteger(v) ? String(v) : v.toFixed(d ?? (v < 10 ? 1 : 0));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const offset = (o, e, n) => [o[0] + e / (111320 * Math.cos(o[1] * Math.PI / 180)), o[1] + n / 110574];

// 기둥 높이 자(제곱근). s = 1 단위당 m. 연 세수 10억 ≈ 130m · 100억 ≈ 400m · 매출 1,000억 ≈ 250m · 종업원 100명 ≈ 110m
const FH = {
  yr_hs: { nm: "연 화성 세수(억)", d: "법인지방소득세 화성분 연평균 + 주민세 종업원분 — 화성시에 실제로 떨어지는 몫", f: p => p.yr_hs, s: 40 },
  tax3:  { nm: "법인세+지방소득세 3년(억)", d: "2023~25 결산 3년 합(국세 포함 · 법인 전체) — 이익의 크기", f: p => p.tax3, s: 12 },
  res:   { nm: "주민세 종업원분(억/yr)", d: "국민연금 화성 가입자 × 급여 × 0.5% — 이익이 없어도 남는 세금", f: p => p.res, s: 90 },
  sales: { nm: "매출(억)", d: "KoDATA 최근 결산년 매출", f: p => p.sales, s: 8 },
  emp:   { nm: "종업원(명)", d: "KoDATA 종업원수(없으면 5개년 시트 마지막 값)", f: p => p.emp, s: 11 },
  cap3:  { nm: "설비투자 3년(억)", d: "DART 감사보고서 유형자산 취득 2023~25 합(정본)", f: p => p.cap3, s: 10 },
  chg:   { nm: "5년 고용 증감(명)", d: "종업원 5개년 첫해→끝해 차이 · 감소는 회색", f: p => p.chg == null ? null : Math.abs(p.chg), s: 14 } };
const MIN_H = 10;
const GRPCOL = { "미래전략·국가첨단": "#1D4ED8", "그 밖의 제조업": "#7aa7f0", "서비스·도매 등": "#2F7A4F", "부동산·금융·건설": "#9B9A92" };
const GCOL = { A: "#1D4ED8", B: "#C9A227", C: "#a63d2f", "미": "#9B9A92" };
const LEG = { grp: "파랑 미래전략·국가첨단(반도체·의약·전기·기계·자동차) · 연파랑 그 밖 제조 · 녹 서비스·도매 · 회 부동산·금융·건설",
  g: "파랑 A 본사=사업장 · 금 B 관내 분리 · 적 C 본사 관외(안분) · 회 미확인", dens: "연 화성 세수 ÷ 매출 — 옅음 0 → 진한 적 1% 이상(같은 매출로 세금을 많이 내는 곳)",
  mix: "적 이익 세금이 큼(화성분 연평균 > 종업원분) · 녹 고용 세금이 큼 · 회 둘 다 0" };
const METRICS = [
  { k: "yr_hs", nm: "연 화성 세수 합(억)", d: "기업별 연 화성 세수(화성분 연평균 + 종업원분)의 행정동 합 — 좌표 없는 기업도 KoDATA 행정동으로 든다" },
  { k: "tax3", nm: "법인세+지방소득세 3년 합(억)", d: "세금 추정이 있는 기업의 3년 합" }, { k: "res", nm: "주민세 종업원분 합(억/yr)", d: "면세점 초과 기업의 합" },
  { k: "n_tax", nm: "세금 추정 기업 수(사)", d: "3년 합이 0 을 넘는 기업" }, { k: "emp", nm: "종업원 합(명)", d: "기재 기업만" }, { k: "sales", nm: "매출 합(억)", d: "기재 기업만" },
  { k: "cap3", nm: "설비투자 3년 합(억)", d: "DART 감사보고서 capex 정본" } ];

const [EMD, FIRMS, SAM, META, BR] = await Promise.all(["data/emd_stats.geojson", "data/firms.geojson", "data/samsung.geojson", "data/meta.json", "data/branches.geojson"]
  .map(u => fetch(u).then(r => r.ok ? r.json() : { type: "FeatureCollection", features: [] }).catch(() => ({ type: "FeatureCollection", features: [] }))));
$("meta-date").textContent = "데이터 " + (META.built || "").slice(0, 10);
$("n-firms").textContent = FIRMS.features.length.toLocaleString(); $("n-br").textContent = BR.features.length.toLocaleString();
const centroid = g => { const ring = (g.type === "MultiPolygon" ? g.coordinates.reduce((a, b) => a[0][0].length >= b[0][0].length ? a : b) : g.coordinates)[0]; return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]; };
const dongCenter = Object.fromEntries(EMD.features.map(f => [f.properties.dong, centroid(f.geometry)]));
const SAMP = SAM.features[0]?.properties || {}, SAMC = SAMP.c || [127.07, 37.21];
const VIEWS = { city: { center: [126.93, 37.17], zoom: 10.3, pitch: 50, bearing: -10 }, 동탄: { center: [127.105, 37.195], zoom: 13.2, pitch: 58, bearing: -20 }, samsung: { center: SAMC, zoom: 13.6, pitch: 60, bearing: -30 } };
for (const d of ["향남읍", "팔탄면", "마도면", "장안면"]) VIEWS[d] = { center: dongCenter[d], zoom: 13.4, pitch: 56, bearing: -15 };

// ── 기업 기둥: 점 → 육각 기둥(반지름 35m). 같은 주소는 60° 씩 45m 비킨다 ──
const hexAt = (c, r = 35) => { const ring = []; for (let i = 0; i <= 6; i++) ring.push(offset(c, r * Math.cos(i * Math.PI / 3), r * Math.sin(i * Math.PI / 3))); return ring; };
const seen = {}; FIRMS.features.forEach(f => { const k = f.geometry.coordinates.join(","); const n = seen[k] = (seen[k] || 0) + 1; let c = f.geometry.coordinates;
  if (n > 1) c = offset(c, 45 * Math.ceil((n - 1) / 6) * Math.cos((n - 1) * Math.PI / 3), 45 * Math.ceil((n - 1) / 6) * Math.sin((n - 1) * Math.PI / 3)); f.properties.c = c; });
let fh = "yr_hs", fc = "grp", gFilter = "all", grpFilter = "all", taxMin = 0, empMin = 0, query = "", firmsOn = true, samOn = true, brOn = true, selId = null;
// ── 본사 밖 사업장(kodata/code/36 → code/03): 국민연금 화성 사업장 중 KoDATA 밖 법인. 팔각 기둥(반지름 45m)·적갈색. 같은 자(연 화성 세수)로 세운다 ──
const octAt = (c, r = 45) => { const ring = []; for (let i = 0; i <= 8; i++) ring.push(offset(c, r * Math.cos(i * Math.PI / 4), r * Math.sin(i * Math.PI / 4))); return ring; };
BR.features.forEach((f, i) => { f.properties.c = f.geometry.coordinates; f.properties.id = "br" + i; f.properties.isBr = true; });
if (SAM.features.length) BR.features.unshift({ type: "Feature", geometry: { type: "Point", coordinates: SAMC }, properties: { id: "samsung", isBr: true, isSam: true, n: SAMP.n, ind: "반도체 제조업", kind: "관외 본사(본점 일괄 등록 — 국민연금에 없음)", hq: "경기 수원시", emp: SAMP.emp, emp_all: null, share: null,
  res: SAMP.res, lis: SAMP.lis_2026, yr_hs: (SAMP.lis_2026 || 0) + (SAMP.res || 0), prop: SAMP.prop, sales: null, ctax: null, dong: "반월동", addr: "반월동 948 · 석우동 25", loc: "parcel", c: SAMC } });   // 삼성 캠퍼스 — 이 층의 첫 줄(보고서 값)
const BRCOL = { "관외 본사": "#a63d2f", "관외 본사 추정(지점)": "#c96b56", "관내 본사(KoDATA 누락)": "#C9A227", "비영리": "#9B9A92", "미확인": "#d9a99d" };
const brVal = p => ({ yr_hs: p.yr_hs, res: p.res, sales: p.sales, emp: p.emp, tax3: null, cap3: null, chg: null })[fh];
const brVisible = () => brOn ? BR.features.filter(f => { const p = f.properties; return (p.yr_hs ?? 0) >= taxMin && (p.emp ?? 0) >= empMin && (grpFilter === "all") && (gFilter === "all") && (!query || (p.n + " " + (p.ind || "") + " " + (p.dong || "") + " " + (p.hq || "")).toLowerCase().includes(query)); }) : [];
function brGeo() { return { type: "FeatureCollection", features: brVisible().filter(f => !f.properties.isSam).map(f => { const p = f.properties, v = brVal(p); return { type: "Feature", properties: { ...p, h: v == null || v <= 0 ? MIN_H : MIN_H + Math.sqrt(v) * FH[fh].s }, geometry: { type: "Polygon", coordinates: [octAt(p.c)] } }; }) }; }
const visible = () => FIRMS.features.filter(f => { const p = f.properties; return (gFilter === "all" || p.g === gFilter) && (grpFilter === "all" || p.grp === grpFilter) && (p.yr_hs ?? 0) >= taxMin && (p.emp ?? 0) >= empMin && (!query || (p.n + " " + (p.ind || "") + " " + (p.dong || "")).toLowerCase().includes(query)); });
function firmGeo() {
  const H = FH[fh];
  return { type: "FeatureCollection", features: visible().map(f => { const p = f.properties, v = H.f(p);
    return { type: "Feature", properties: { ...p, h: v == null || v <= 0 ? MIN_H : MIN_H + Math.sqrt(v) * H.s, neg: fh === "chg" && (p.chg ?? 0) < 0, dens: p.sales > 0 ? (p.yr_hs ?? 0) / p.sales : 0 }, geometry: { type: "Polygon", coordinates: [hexAt(p.c)] } }; }) };
}
function firmColor() {
  const base = fc === "g" ? ["match", ["get", "g"], ...Object.entries(GCOL).flat(), "#9B9A92"]
    : fc === "dens" ? ["interpolate", ["linear"], ["get", "dens"], 0, "#E4E2DA", .002, "#e8b4a6", .005, "#c96b56", .01, "#a63d2f"]
    : fc === "mix" ? ["case", ["all", ["<=", ["coalesce", ["get", "yr_hs"], 0], 0]], "#c9c7be", [">", ["/", ["coalesce", ["get", "hs3"], 0], ["coalesce", ["get", "yrs"], 1]], ["coalesce", ["get", "res"], 0]], "#a63d2f", "#2F7A4F"]
    : ["match", ["get", "grp"], ...Object.entries(GRPCOL).flat(), "#9B9A92"];
  return ["case", ["get", "neg"], "#c9c7be", base];
}
// 삼성 캠퍼스 기둥 — 2026 실측 법인지방소득세 + 종업원분 + 재산세(같은 연 세수 자)
// 삼성 기둥 — 같은 자(법인지방소득세 + 종업원분). 재산세는 기업 기둥에 없으므로 여기서도 뺀다(카드에만)
function samGeo() { const v = (SAMP.lis_2026 || 0) + (SAMP.res || 0); return { type: "FeatureCollection", features: samOn && SAM.features.length ? [{ type: "Feature", properties: { n: SAMP.n, h: MIN_H + Math.sqrt(fh === "res" ? SAMP.res : fh === "emp" ? SAMP.emp : fh === "yr_hs" ? v : 0) * (FH[fh === "emp" ? "emp" : fh === "res" ? "res" : "yr_hs"].s), v }, geometry: { type: "Polygon", coordinates: [hexAt(SAMC, 120)] }}] : [] }; }

const map = new maplibregl.Map({ container: "map", style: STYLE, ...VIEWS.city, maxPitch: 75, maxZoom: 19, maxBounds: [[126.2, 36.8], [127.5, 37.5]], attributionControl: { compact: true } });
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
let topo, cur = METRICS[0], emdOn = true, vwOn = true;

map.on("load", () => {
  topo = addTopography(map); topo.setTheme("day");
  map.addSource("emd", { type: "geojson", data: EMD });
  map.addLayer({ id: "emd-fill", type: "fill-extrusion", source: "emd", paint: { "fill-extrusion-opacity": .55, "fill-extrusion-height": 0, "fill-extrusion-color": "#E4E2DA" } });
  map.addLayer({ id: "emd-line", type: "line", source: "emd", paint: { "line-color": "#262624", "line-width": 1, "line-opacity": .5 } });
  map.addLayer({ id: "emd-label", type: "symbol", source: "emd", layout: { "text-field": ["get", "dong"], "text-size": 12, "text-font": ["Noto Sans Regular"] }, paint: { "text-color": "#262624", "text-halo-color": "#fffff8", "text-halo-width": 1.2 } });
  map.addSource("sam", { type: "geojson", data: SAM });
  map.addLayer({ id: "sam-fill", type: "fill", source: "sam", paint: { "fill-color": "#1D4ED8", "fill-opacity": .18 } });
  map.addLayer({ id: "sam-line", type: "line", source: "sam", paint: { "line-color": "#1D4ED8", "line-width": 2.5, "line-dasharray": [3, 2] } });
  map.addSource("sam-col", { type: "geojson", data: samGeo() });
  map.addLayer({ id: "sam-col", type: "fill-extrusion", source: "sam-col", minzoom: 9, paint: { "fill-extrusion-color": "#1D4ED8", "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": .8, "fill-extrusion-vertical-gradient": true } });
  map.addSource("firms", { type: "geojson", data: firmGeo() });
  map.addLayer({ id: "firms", type: "fill-extrusion", source: "firms", minzoom: 10, paint: { "fill-extrusion-color": firmColor(), "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0, "fill-extrusion-opacity": .92, "fill-extrusion-vertical-gradient": true } });
  map.addSource("br", { type: "geojson", data: brGeo() });
  map.addLayer({ id: "br", type: "fill-extrusion", source: "br", minzoom: 10, paint: { "fill-extrusion-color": ["match", ["get", "kind"], ...Object.entries(BRCOL).flat(), "#d9a99d"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0, "fill-extrusion-opacity": .92, "fill-extrusion-vertical-gradient": true } });
  map.addSource("sel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "sel", type: "line", source: "sel", paint: { "line-color": "#f2a35b", "line-width": 4 } });
  setMetric(cur); ensureBuildings(); refreshFirms();
  status(`준비됨 — 기업 기둥 ${FIRMS.features.length.toLocaleString()}사(좌표 미확인 ${META.n_dart_missing ?? META.n_missing ?? "?"}) · 건물은 확대하면 읽는다`);
});
map.on("moveend", ensureBuildings);

// ── 브이월드 건물(hwaseong-3d 링크 data/vw) ─────────────────────────────────
const VW = new URLSearchParams(location.search).get("vw") || (location.hostname.endsWith("github.io") ? "https://statkclee.github.io/hwaseong-3d/data/" : "data/vw/");
const BIDX = await fetch(VW + "buildings_index.json").then(r => r.ok ? r.json() : null).catch(() => null);
const loadedDong = new Set(), loadingDong = new Set();
async function ensureBuildings() {
  if (!BIDX || map.getZoom() < 12.3) return;
  const b = map.getBounds(), w = b.getWest(), s = b.getSouth(), e = b.getEast(), n = b.getNorth();
  const hits = Object.entries(BIDX.dongs).filter(([d, v]) => !loadedDong.has(d) && !loadingDong.has(d) && v.bbox[0] < e && v.bbox[2] > w && v.bbox[1] < n && v.bbox[3] > s).sort((a, b2) => a[1].n - b2[1].n).slice(0, 4);
  for (const [d, v] of hits) {
    const id = "vw-" + v.file.replace(/\W/g, ""); if (map.getSource(id)) { loadedDong.add(d); continue; }
    loadingDong.add(d); status(`${d} 건물 ${v.n.toLocaleString()}동 읽는 중…`);
    try { const gj = await fetch(VW + v.file).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
      if (!map.getSource(id)) { map.addSource(id, { type: "geojson", data: gj, buffer: 8, tolerance: .5 });
        map.addLayer({ id, type: "fill-extrusion", source: id, minzoom: 12, layout: { visibility: vwOn ? "visible" : "none" }, paint: { "fill-extrusion-height": ["case", [">", ["get", "h"], 0], ["get", "h"], [">", ["get", "f"], 0], ["*", ["get", "f"], 3.2], 4], "fill-extrusion-base": 0, "fill-extrusion-opacity": .85, "fill-extrusion-vertical-gradient": true,
          "fill-extrusion-color": ["match", ["slice", ["get", "u"], 0, 2], "17", "#b39ddb", "18", "#e0c66b", "14", "#9db4e8", "02", "#d9d7cf", "#e4e2da"] } }, "emd-line"); }
      loadedDong.add(d); status(`${d} 건물 ${v.n.toLocaleString()}동 · 읽은 동 ${loadedDong.size}/29`);
    } catch (err) { status(`${d} 건물 파일을 못 읽었다(${err.message}) — data/vw 링크가 hwaseong-3d/app/data 를 가리키는지 본다`); }
    finally { loadingDong.delete(d); }
  }
  if (hits.length === 4) ensureBuildings();
}
const vwLayerIds = () => [...loadedDong].map(d => "vw-" + BIDX.dongs[d].file.replace(/\W/g, ""));
$("btn-vw").onclick = () => { vwOn = !vwOn; $("btn-vw").classList.toggle("on", vwOn); for (const id of vwLayerIds()) map.setLayoutProperty(id, "visibility", vwOn ? "visible" : "none"); };

// ── 행정동 슬래브 ───────────────────────────────────────────────────────────
const M_MAIN = ["yr_hs", "emp", "sales"];   // 본 자리 지표 3종 — 나머지는 「더 보기」
METRICS.forEach(m => { const b = document.createElement("button"); b.textContent = m.nm.replace(/\(.*?\)/, ""); b.onclick = () => setMetric(m); b.dataset.k = m.k; $(M_MAIN.includes(m.k) ? "metric-btns" : "metric-btns-more").appendChild(b); });
const NEAR = () => map.getZoom() >= 12.8;
function setMetric(m) {
  cur = m; const v = EMD.features.map(f => f.properties[m.k]).filter(x => x != null); const mn = Math.min(0, ...v), mx = Math.max(...v), rng = (mx - mn) || 1;
  // 슬래브는 줌 12.8 부터 눕힌다 — 줌 보간식으로 두어 flyTo 도중·이벤트 누락에도 확대하면 반드시 눕는다
  const hExpr = ["*", 1200, ["/", ["max", 0, ["-", ["coalesce", ["get", m.k], mn], mn]], rng]];
  map.setPaintProperty("emd-fill", "fill-extrusion-height", emdOn ? ["interpolate", ["linear"], ["zoom"], 12.6, hExpr, 12.9, 0] : 0);
  map.setPaintProperty("emd-fill", "fill-extrusion-opacity", emdOn ? ["interpolate", ["linear"], ["zoom"], 12.6, .55, 12.9, .15] : .05);
  map.setPaintProperty("emd-fill", "fill-extrusion-color", ["interpolate", ["linear"], ["coalesce", ["get", m.k], mn], mn, "#E4E2DA", mx, "#a63d2f"]);
  $("lg-name").textContent = m.nm; $("lg-min").textContent = fmt(mn); $("lg-max").textContent = fmt(mx); $("metric-desc").textContent = m.d;
  document.querySelectorAll("#metric-btns button, #metric-btns-more button").forEach(b => b.classList.toggle("on", b.dataset.k === m.k));
}
$("btn-emd").onclick = () => { emdOn = !emdOn; $("btn-emd").textContent = emdOn ? "끄기" : "켜기"; setMetric(cur); };

// ── 기업 기둥 조작 · 목록 · 합계 ──────────────────────────────────────────────
const FH_MAIN = ["yr_hs", "sales", "emp", "cap3"];   // 본 자리에 두는 높이 4종 — 나머지는 「더 보기」
Object.entries(FH).forEach(([k, h]) => { const b = document.createElement("button"); b.textContent = h.nm.replace(/\(.*?\)/, ""); b.dataset.fh = k; b.classList.toggle("on", k === fh); b.onclick = () => { fh = k; document.querySelectorAll("[data-fh]").forEach(x => x.classList.toggle("on", x.dataset.fh === k)); refreshFirms(); }; $(FH_MAIN.includes(k) ? "fh-btns" : "fh-btns-more").appendChild(b); });
function refreshFirms() {
  if (map.getSource("firms")) { map.getSource("firms").setData(firmGeo()); map.setPaintProperty("firms", "fill-extrusion-color", firmColor()); map.setLayoutProperty("firms", "visibility", firmsOn ? "visible" : "none"); }
  if (map.getSource("sam-col")) map.getSource("sam-col").setData(samGeo());
  if (map.getSource("br")) map.getSource("br").setData(brGeo());
  $("fh-desc").textContent = FH[fh].d; $("fc-legend").textContent = LEG[fc]; renderFirmList(); renderKpi();
}
document.querySelectorAll("[data-fc]").forEach(b => b.onclick = () => { fc = b.dataset.fc; document.querySelectorAll("[data-fc]").forEach(x => x.classList.toggle("on", x === b)); refreshFirms(); });
document.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { gFilter = b.dataset.g; document.querySelectorAll("[data-g]").forEach(x => x.classList.toggle("on", x === b)); refreshFirms(); });
document.querySelectorAll("[data-grp]").forEach(b => b.onclick = () => { grpFilter = b.dataset.grp; document.querySelectorAll("[data-grp]").forEach(x => x.classList.toggle("on", x === b)); refreshFirms(); });
$("tax-min").oninput = e => { taxMin = +e.target.value; $("tax-min-val").textContent = taxMin; refreshFirms(); };
$("emp-min").oninput = e => { empMin = +e.target.value; $("emp-min-val").textContent = empMin; refreshFirms(); };
$("q").oninput = e => { query = e.target.value.trim().toLowerCase(); refreshFirms(); };
$("btn-firms").onclick = () => { firmsOn = !firmsOn; $("btn-firms").classList.toggle("on", firmsOn); refreshFirms(); };
$("btn-sam").onclick = () => { samOn = !samOn; $("btn-sam").classList.toggle("on", samOn); refreshFirms(); };
$("btn-br").onclick = () => { brOn = !brOn; $("btn-br").classList.toggle("on", brOn); refreshFirms(); };
function renderFirmList() {
  const list = $("flist"); list.innerHTML = ""; const H = FH[fh];
  const val = p => p.isBr ? brVal(p) : H.f(p);
  const rows = [...visible().map(f => f.properties), ...brVisible().map(f => f.properties)].sort((a, b) => (val(b) ?? -1) - (val(a) ?? -1));
  rows.slice(0, 200).forEach(p => { const d = document.createElement("div");
    d.innerHTML = `<span>${p.isBr ? "<span style='color:#a63d2f'>▣</span> " : ""}${p.n} <span class="k">· ${(p.ind || "").slice(0, 14)} · ${p.dong || ""}${p.isBr && p.hq ? " · 본사 " + p.hq : ""}</span></span><span>${fmt(val(p))}${fh === "chg" && p.chg < 0 ? "↓" : ""}</span>`;
    d.onclick = () => p.isSam ? selectSamsung(true) : p.isBr ? selectBranch(p, true) : selectFirm(p, true); d.dataset.id = p.id; d.classList.toggle("sel", p.id === selId); list.appendChild(d); });
  $("flist-note").textContent = `${rows.length.toLocaleString()}곳 (${H.nm} 순 · 200까지 · ▣ = 본사 밖 사업장)`;
}
function renderKpi() {
  const P = visible().map(f => f.properties), sum = k => P.reduce((s, p) => s + (p[k] || 0), 0), cnt = k => P.filter(p => p[k] != null).length;
  const yr = sum("yr_hs"), hs = P.reduce((s, p) => s + (p.hs3 && p.yrs ? p.hs3 / p.yrs : 0), 0), rs = sum("res");
  $("kpi").innerHTML = [[fmt(P.length), "기업(사)"], [fmt(yr) + "억", "연 화성 세수 합"], [fmt(hs) + "억", "└ 법인지방소득세 화성분 연평균"], [fmt(rs) + "억", "└ 주민세 종업원분"],
    [fmt(sum("tax3")) + "억", `법인세+지방소득세 3년(${fmt(cnt("tax3"))}사)`], [fmt(sum("sales")) + "억", `매출 합(${fmt(cnt("sales"))}사)`], [fmt(sum("emp")) + "명", `종업원 합(${fmt(cnt("emp"))}사)`], [fmt(sum("cap3")) + "억", `설비투자 3년(${fmt(cnt("cap3"))}사)`]]
    .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  const B = brVisible().map(f => f.properties).filter(p => !p.isSam), S = brVisible().some(f => f.properties.isSam);
  const X = META.exact_pub, XB = META.exact_br, pubNote = X ? ` <span class="warn">배포판은 구간 대표값의 합이라 과대 — 정확 합계: 기업 ${fmt(X.n)}사 연 ${fmt(X.yr_hs)}억(화성분 ${fmt(X.hs_yr)} + 종업원분 ${fmt(X.res)}) · 전체 ${fmt(META.exact_all.n)}사 ${fmt(META.exact_all.yr_hs)}억 · 본사 밖 ${fmt(XB.n)}곳 ${fmt(XB.yr_hs)}억</span>` : "";
  $("kpi-note").innerHTML = `필터·검색에 걸린 기업의 합. <b>본사 밖 사업장 ${fmt(B.length)}곳</b>은 따로 — 가입자 ${fmt(B.reduce((s, p) => s + (p.emp || 0), 0))}명 · 연 화성 세수 ${fmt(B.reduce((s, p) => s + (p.yr_hs || 0), 0))}억(종업원분 ${fmt(B.reduce((s, p) => s + (p.res || 0), 0))} + 법인지방소득세 ${fmt(B.reduce((s, p) => s + (p.lis || 0), 0))} — 법인지방소득세는 DART 손익이 있는 곳만)${S ? ` · 삼성 캠퍼스 ${fmt((SAMP.lis_2026 || 0) + (SAMP.res || 0))}억은 별도(실측+추정)` : ""}.${pubNote}`;
}
function selectSamsung(fly) {
  selId = null; document.querySelectorAll("#flist div").forEach(d => d.classList.remove("sel"));
  map.getSource("sel").setData({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [hexAt(SAMC, 135)] } }] });
  $("d-title").textContent = SAMP.n; $("d-sub").textContent = "반도체 · 본점 수원 · 반월동 948 + 석우동 25";
  $("d-table").innerHTML = [["<b>연 화성 세수(2026 기준 · 기업 기둥과 같은 자)</b>", `<b>${fmt((SAMP.lis_2026 || 0) + (SAMP.res || 0))}억</b>`], ["└ 법인지방소득세 2026 납부(실측)", fmt(SAMP.lis_2026) + "억"], ["└ 주민세 종업원분(추정)", fmt(SAMP.res) + "억"], ["재산세 토지+건물(추정 · 기둥에는 안 넣음)", fmt(SAMP.prop) + "억"],
    ["법인지방소득세 2024(무이익년)", fmt(SAMP.lis_2024) + "억"], ["법인지방소득세 최고(2022)", fmt(SAMP.lis_max) + "억"], ["임직원", fmt(SAMP.emp) + "명"], ["부지", fmt(SAMP.area) + "㎡ · 공시지가 " + SAMP.land_jiga_jo + "조"], ["건물 연면적(기재분)", fmt(SAMP.gfa) + "㎡"]]
    .map(([k, v]) => `<tr><td class="k">${k}</td><td>${v}</td></tr>`).join("");
  $("d-warn").textContent = "KoDATA 명단에 없는 기업이라 다른 기둥과 자료가 다르다. 법인지방소득세는 실측, 나머지는 보고서 추정.";
  if (fly) map.flyTo({ ...VIEWS.samsung, duration: reduceMotion ? 0 : 900 });
}
function selectBranch(p, fly) {
  selId = p.id; document.querySelectorAll("#flist div").forEach(d => d.classList.toggle("sel", d.dataset.id === p.id));
  map.getSource("sel").setData({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [octAt(p.c, 58)] } }] });
  $("d-title").textContent = p.n + (p.listed ? " (상장)" : ""); $("d-sub").textContent = `${p.ind || ""} · ${p.kind}${p.hq ? " · 본사 " + p.hq : ""}${p.dart ? " · DART " + p.dart : ""} · ${p.addr || ""}`;
  $("d-table").innerHTML = [["<b>연 화성 세수(추정)</b>", `<b>${fmt(p.yr_hs)}억</b>`], ["└ 법인지방소득세 화성분", p.lis == null ? "– (DART 손익 없음)" : fmt(p.lis, 1) + "억"], ["└ 주민세 종업원분", p.res ? fmt(p.res, 1) + "억" + (p.cap ? " (기준소득 상한 → 하한값)" : "") : "면세점 이하"],
    ["별도 법인세비용" + (p.fy ? " FY" + p.fy : ""), p.ctax == null ? "–" : fmt(p.ctax) + "억 (전사)"], ["별도 매출 · 세전이익", p.sales == null ? "–" : `${fmt(p.sales)}억 · ${fmt(p.pretax)}억`],
    ["화성 가입자 ÷ 전사 가입자", p.emp_all ? `${fmt(p.emp)} ÷ ${fmt(p.emp_all)} = ${(100 * p.share).toFixed(0)}%` : fmt(p.emp) + "명 (전사 미확인)"], ["1인 연급여(국민연금 기준소득)", p.pay == null ? "–" : fmt(p.pay) + "만원"],
    ["본점 주소", p.hq_addr || "–"], ["위치 정확도", p.loc === "bldg" ? "건물(이름 일치)" : p.loc === "road" ? "도로 위 한 점(번지 없음 — 대략)" : p.loc === "parcel" ? "필지" : "법정동 중심(대략)"]]
    .map(([k, v]) => `<tr><td class="k">${k}</td><td>${v}</td></tr>`).join("");
  $("d-warn").textContent = "KoDATA 명단 밖 사업장 — 국민연금 가입자와 DART 별도 손익으로 추정. 법인지방소득세는 종업원 비율로만 안분(연면적 안분 없음).";
  if (fly) map.flyTo({ center: p.c, zoom: 15.4, pitch: 60, bearing: -25, duration: reduceMotion ? 0 : 900 });
}
function selectFirm(p, fly) {
  selId = p.id; document.querySelectorAll("#flist div").forEach(d => d.classList.toggle("sel", d.dataset.id === p.id));
  map.getSource("sel").setData({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [hexAt(p.c, 48)] } }] });
  $("d-title").textContent = p.n + (p.listed ? " (상장)" : ""); $("d-sub").textContent = `${p.ind || ""} · ${p.grp} · 본사 ${p.g}${p.hq ? " (" + p.hq + ")" : ""} · ${p.addr || ""}${p.est_yr ? " · 설립 " + p.est_yr : ""}`;
  const hsy = p.hs3 && p.yrs ? p.hs3 / p.yrs : null;
  $("d-table").innerHTML = [["<b>연 화성 세수(추정)</b>", `<b>${fmt(p.yr_hs)}억</b>`], ["└ 법인지방소득세 화성분 연평균", hsy == null ? "–" : fmt(hsy, 1) + "억" + (p.g === "C" ? " (국민연금 안분)" : "")], ["└ 주민세 종업원분", p.res ? fmt(p.res, 1) + "억" : (p.nps ? "면세점 이하" : "국민연금 결합 없음")],
    ["법인세+지방소득세 3년 합", p.tax3 == null ? "–" : `${fmt(p.tax3)}억 (${p.yrs}년${p.inc != null ? " · 22→24 " + (p.inc > 0 ? "+" : "") + fmt(p.inc) + "억" : ""})`], ["└ 법인지방소득세 추정(1/11)", p.lis3 == null ? "–" : fmt(p.lis3) + "억"],
    ["매출(최근 결산)", p.sales == null ? "–" : fmt(p.sales) + "억"], ["종업원 · 국민연금 화성 가입자", `${fmt(p.emp)}명 · ${p.nps != null ? fmt(p.nps) + "명" : "–"}`], ["5년 고용 증감", p.chg == null ? "–" : (p.chg > 0 ? "+" : "") + p.chg + "명"],
    ["설비투자 3년 · 누적", `${p.cap3 != null ? fmt(p.cap3) + "억" : "–"} · ${p.capall != null ? fmt(p.capall) + "억" : "–"}`], ["세수 밀도", p.sales > 0 && p.yr_hs ? (100 * p.yr_hs / p.sales).toFixed(2) + "% (연 화성 세수 ÷ 매출)" : "–"], ["좌표", p.gt === "road" ? "도로명" : p.gt === "parcel" ? "지번" : "길 이름(대략)"]]
    .map(([k, v]) => `<tr><td class="k">${k}</td><td>${v}</td></tr>`).join("");
  $("d-warn").textContent = p.g === "C" && !p.nps ? "본사 관외인데 국민연금 결합이 없어 화성분을 안분하지 못했다(0 으로 표시)" : p.yrs === 1 ? "세금 값이 한 해뿐이다 — 3년 합이 아니다" : "";
  if (fly) map.flyTo({ center: p.c, zoom: 15.6, pitch: 60, bearing: -25, duration: reduceMotion ? 0 : 900 });
}
map.on("click", "br", e => { const p = e.features[0].properties; selectBranch(BR.features.find(x => x.properties.id === p.id)?.properties || p, false); });
map.on("click", "firms", e => { const p = e.features[0].properties; selectFirm(FIRMS.features.find(x => x.properties.id === p.id)?.properties || p, false); });

map.on("click", "sam-col", () => selectSamsung(false));
map.on("click", "sam-fill", e => { if (!map.queryRenderedFeatures(e.point, { layers: ["firms"] }).length) selectSamsung(false); });
// ── 패널 숨기기/보이기 — 지도만 크게 볼 때. 단축키 [ ] ─────────────────────
const togglePanel = which => { document.body.classList.toggle("hide-" + which); const hid = document.body.classList.contains("hide-" + which); $("tg-" + which).textContent = which === "head" ? (hid ? "▶" : "◀") : (hid ? "◀" : "▶"); map.resize(); };
$("tg-head").onclick = () => togglePanel("head"); $("tg-side").onclick = () => togglePanel("side");
document.addEventListener("keydown", e => { if (e.target.tagName === "INPUT") return; if (e.key === "[") togglePanel("head"); if (e.key === "]") togglePanel("side"); });

// ── 툴팁 ──────────────────────────────────────────────────────────────────
const tip = $("tip");
map.on("mousemove", e => {
  const layers = ["firms", "br", "sam-col", "sam-fill", ...vwLayerIds(), "emd-fill"].filter(id => map.getLayer(id));
  const f = map.queryRenderedFeatures(e.point, { layers })[0];
  if (!f) { tip.style.display = "none"; map.getCanvas().style.cursor = ""; return; }
  const p = f.properties; let html;
  if (f.layer.id === "firms") html = `<b>${p.n}</b>${p.listed ? " <span style='color:#C9A227'>상장</span>" : ""} · ${p.dong || ""}<br>${p.ind || ""} · ${p.grp} · 본사 ${p.g}<br><b>연 화성 세수 ${fmt(p.yr_hs)}억</b> (화성분 ${p.hs3 && p.yrs ? fmt(p.hs3 / p.yrs, 1) : "–"} + 종업원분 ${p.res ? fmt(p.res, 1) : "0"}) · 3년 세금 ${fmt(p.tax3)}억<br>매출 ${fmt(p.sales)}억 · 종업원 ${fmt(p.emp)}명 · 설비투자 3년 ${fmt(p.cap3)}억 · 5년 고용 ${p.chg == null ? "–" : (p.chg > 0 ? "+" : "") + p.chg}<br><span style="color:#f2a35b">클릭하면 오른쪽에 자세히</span>`;
  else if (f.layer.id === "br") html = `<b>▣ ${p.n}</b> · ${p.dong || ""}<br>${p.ind || ""} · ${p.kind}${p.hq ? " · 본사 " + p.hq : ""}<br><b>연 화성 세수 ${fmt(p.yr_hs)}억</b> (법인지방소득세 ${p.lis == null ? "–" : fmt(p.lis, 1)} + 종업원분 ${fmt(p.res, 1)})<br>화성 가입자 ${fmt(p.emp)}명${p.emp_all ? " / 전사 " + fmt(p.emp_all) : ""}${p.ctax != null ? " · 별도 법인세비용 " + fmt(p.ctax) + "억" : ""}<br><span style="color:#f2a35b">클릭하면 오른쪽에 자세히</span>`;
  else if (f.layer.id.startsWith("sam")) html = `<b>${SAMP.n}</b><br>법인지방소득세 2026 실측 ${fmt(SAMP.lis_2026)}억 (2024 는 0) · 종업원분 ${fmt(SAMP.res)}억 · 재산세 ${fmt(SAMP.prop)}억<br>임직원 ${fmt(SAMP.emp)}명 · 두 필지 ${fmt(SAMP.area)}㎡<br><span class="k">${SAMP.note}</span>`;
  else if (f.layer.id.startsWith("vw-")) html = `<b>${p.n || "(이름 없음)"}</b> ${p.d ? "· " + p.d : ""}<br>지상 ${p.f}층 · 연면적 ${fmt(p.a)}㎡ · 준공 ${p.y || "?"} · 용도 ${String(p.u || "").startsWith("17") ? "공장" : String(p.u || "").startsWith("18") ? "창고" : String(p.u || "").startsWith("14") ? "업무" : p.u || "–"}`;
  else html = `<b>${p.dong}</b> (${p.gu})<br>연 화성 세수 ${fmt(p.yr_hs)}억 (화성분 3년 ${fmt(p.hs3)} · 종업원분 ${fmt(p.res)}억/yr · ${fmt(p.n_res)}사)<br>법인세+지방소득세 3년 ${fmt(p.tax3)}억 (${fmt(p.n_tax)}사) · 매출 ${fmt(p.sales)}억 · 종업원 ${fmt(p.emp)}명 · 설비투자 3년 ${fmt(p.cap3)}억`;
  tip.innerHTML = html; tip.style.display = "block"; tip.style.left = (e.point.x + 14) + "px"; tip.style.top = (e.point.y + 14) + "px"; map.getCanvas().style.cursor = "pointer";
});

// ── 보기 · 지형 · 조명 · 투어 ──────────────────────────────────────────────
document.querySelectorAll("[data-fly]").forEach(b => b.onclick = () => { map.flyTo({ ...VIEWS[b.dataset.fly], duration: reduceMotion ? 0 : 1100 }); if (b.dataset.fly === "samsung") selectSamsung(false); });
$("btn-top").onclick = () => map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
$("btn-terrain").onclick = () => { const on = topo.toggleTerrain(); $("btn-terrain").textContent = on ? "지형 끄기" : "지형 켜기"; $("btn-terrain").classList.toggle("on", on); };
$("btn-shade").onclick = () => $("btn-shade").classList.toggle("on", topo.toggleShade());
document.querySelectorAll("[data-theme]").forEach(b => b.onclick = () => { topo.setTheme(b.dataset.theme); document.querySelectorAll("[data-theme]").forEach(x => x.classList.toggle("on", x === b)); });
let rotating = false, tourTimer = null;
function spin() { if (!rotating) return; map.rotateTo(map.getBearing() + 60, { duration: 8000, easing: t => t }); setTimeout(spin, 8000); }
$("btn-rotate").onclick = () => { rotating = !rotating; $("btn-rotate").classList.toggle("on", rotating); if (rotating) spin(); else map.stop(); };
$("btn-tour").onclick = () => { if (tourTimer) { clearTimeout(tourTimer); tourTimer = null; $("btn-tour").classList.remove("on"); return; } const seq = ["samsung", "동탄", "향남읍", "팔탄면", "장안면", "마도면", "city"]; let i = 0; $("btn-tour").classList.add("on");
  const step = () => { map.flyTo({ ...VIEWS[seq[i]], duration: reduceMotion ? 0 : 2200 }); i = (i + 1) % seq.length; tourTimer = setTimeout(step, 6000); }; step(); };
["mousedown", "wheel", "touchstart"].forEach(ev => map.getCanvas().addEventListener(ev, () => { if (tourTimer) { clearTimeout(tourTimer); tourTimer = null; $("btn-tour").classList.remove("on"); } }, { passive: true }));
map.on("error", e => { if (/mapterhorn/i.test(e.error?.url || "")) status("지형 타일을 못 받았다 — 지형을 끈다"); });
