// invest-3d — 기업투자 4유형(관내 유입 · 관내 재투자 · 관외 유출 · 재환입)을 장면 넷으로 보여 준다. 장면마다 그 유형의 기업·흐름만 지도에 올린다.
// 데이터는 code/32_build_invest3d.R 이 만든 data/invest.json(배포판 · 구간값) 만 읽는다. 3D 건물은 싣지 않는다(장면이 주인공).
const $ = id => document.getElementById(id), fmt = (v, d = 0) => v == null || Number.isNaN(+v) ? "–" : (+v).toLocaleString("ko-KR", { maximumFractionDigits: d });
const status = t => { $("status").textContent = t; };
const D = await fetch("data/invest.json").then(r => r.json()); const HS = [D.hs[0], D.hs[1]], K = D.kpi;
const [EMD, CITY] = await Promise.all(["data/emd.geojson", "data/hwaseong_boundary.geojson"].map(u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null)));   // 행정동 29 · 시 경계
const COL = { "화성 관내": "#1baf7a", "수도권 내": "#2a78d6", "지방": "#B7791F", "해외": "#9B2C2C", in: "#2a78d6", elig: "#a63d2f", near: "#B7791F", plant: "#7c3aed" };

// ── 기하 — 호(대권 · 국내는 살짝 부풀림) · 육각 기둥 ───────────────────────────
const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;
function greatCircle(a, b, n = 48) {   // 대권 보간(구면) — 세계 장면·지구본에서 자연스럽다
  const [l1, p1] = [toRad(a[0]), toRad(a[1])], [l2, p2] = [toRad(b[0]), toRad(b[1])];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2)) || 1e-9, pts = [];
  for (let i = 0; i <= n; i++) { const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2), y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2), z = A * Math.sin(p1) + B * Math.sin(p2);
    let lon = toDeg(Math.atan2(y, x)); if (pts.length) { const prev = pts[pts.length - 1][0]; while (lon - prev > 180) lon -= 360; while (prev - lon > 180) lon += 360; }   // 날짜변경선을 넘어도 이어지게(경도 연속)
    pts.push([lon, toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]); } return pts;
}
function bulge(a, b, k = .15, n = 32) {   // 국내 — 2차 베지어로 살짝 휘어 겹침을 푼다
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], cx = mx - dy * k, cy = my + dx * k, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = (1 - t) ** 2, v = 2 * (1 - t) * t, w = t * t; pts.push([u * a[0] + v * cx + w * b[0], u * a[1] + v * cy + w * b[1]]); } return pts;
}
const offset = (c, e, n) => [c[0] + e / (111320 * Math.cos(c[1] * Math.PI / 180)), c[1] + n / 110574];
const hex = (c, r) => { const ring = []; for (let i = 0; i <= 6; i++) ring.push(offset(c, r * Math.cos(i * Math.PI / 3), r * Math.sin(i * Math.PI / 3))); return ring; };
const fc = feats => ({ type: "FeatureCollection", features: feats });
const line = (pts, props) => ({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: pts } });
const col = (c, r, props) => ({ type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [hex(c, r)] } });
const pt = (c, props) => ({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: c } });

// ── 지도 ──────────────────────────────────────────────────────────────────
const map = new maplibregl.Map({ container: "map", style: "https://tiles.openfreemap.org/styles/liberty", center: HS, zoom: 8, pitch: 45, maxPitch: 80, attributionControl: { compact: true } });
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
const EMPTY = fc([]);
map.on("load", () => {
  // 화살촉 — 색깔별 삼각형 이미지(흰 테두리)를 만들어 두고 선 끝 조금 앞에 방위각으로 돌려 놓는다
  for (const [k, c] of Object.entries(COL)) { const cv = document.createElement("canvas"); cv.width = cv.height = 40; const cx = cv.getContext("2d");
    cx.beginPath(); cx.moveTo(20, 3); cx.lineTo(36, 36); cx.lineTo(20, 27); cx.lineTo(4, 36); cx.closePath(); cx.fillStyle = c; cx.fill(); cx.lineWidth = 2.5; cx.strokeStyle = "#fff"; cx.stroke();
    map.addImage("arrow-" + k, cx.getImageData(0, 0, 40, 40), { pixelRatio: 2 }); }
  map.addSource("heads", { type: "geojson", data: EMPTY });
  map.addSource("arcs", { type: "geojson", data: EMPTY }); map.addSource("cols", { type: "geojson", data: EMPTY }); map.addSource("pts", { type: "geojson", data: EMPTY }); map.addSource("hs", { type: "geojson", data: fc([pt(HS, { n: "화성특례시" })]) });
  // 경계 — 시 경계(굵은 먹선) · 행정동 29(가는 선 + 이름, 줌 9.5 부터)
  if (EMD) { map.addSource("emd", { type: "geojson", data: EMD });
    map.addLayer({ id: "emd-fill", type: "fill", source: "emd", minzoom: 8, paint: { "fill-color": "#a63d2f", "fill-opacity": .04 } });
    map.addLayer({ id: "emd-line", type: "line", source: "emd", minzoom: 8, paint: { "line-color": "#6B7280", "line-width": ["interpolate", ["linear"], ["zoom"], 8, .4, 12, 1.2], "line-opacity": .8, "line-dasharray": [2, 1.5] } });
    map.addLayer({ id: "emd-label", type: "symbol", source: "emd", minzoom: 9.5, layout: { "text-field": ["get", "dong"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-allow-overlap": false }, paint: { "text-color": "#4A5568", "text-halo-color": "#fffff8", "text-halo-width": 1.2 } }); }
  if (CITY) { map.addSource("city", { type: "geojson", data: CITY });
    map.addLayer({ id: "city-glow", type: "line", source: "city", paint: { "line-color": "#a63d2f", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 10], "line-opacity": .15, "line-blur": 3 } });
    map.addLayer({ id: "city-line", type: "line", source: "city", paint: { "line-color": "#262624", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 12, 2.5], "line-opacity": .9 } }); }
  map.addLayer({ id: "arcs-glow", type: "line", source: "arcs", paint: { "line-color": ["get", "color"], "line-width": ["*", 2.6, ["get", "w"]], "line-opacity": .18, "line-blur": 4 }, layout: { "line-cap": "round" } });
  map.addLayer({ id: "arcs", type: "line", source: "arcs", paint: { "line-color": ["get", "color"], "line-width": ["get", "w"], "line-opacity": .85 }, layout: { "line-cap": "round" } });
  map.addLayer({ id: "cols", type: "fill-extrusion", source: "cols", paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0, "fill-extrusion-opacity": .9, "fill-extrusion-vertical-gradient": true } });
  map.addLayer({ id: "pts-halo", type: "circle", source: "pts", paint: { "circle-radius": ["*", 1.9, ["get", "r"]], "circle-color": ["get", "color"], "circle-opacity": .18 } });
  map.addLayer({ id: "pts", type: "circle", source: "pts", paint: { "circle-radius": ["get", "r"], "circle-color": ["get", "color"], "circle-stroke-color": "#fff", "circle-stroke-width": 1, "circle-opacity": .9 } });
  map.addLayer({ id: "pts-label", type: "symbol", source: "pts", filter: ["has", "label"], layout: { "text-field": ["get", "label"], "text-size": 11, "text-offset": [0, 1.2], "text-anchor": "top", "text-font": ["Noto Sans Regular"], "text-allow-overlap": false }, paint: { "text-color": "#262624", "text-halo-color": "#fffff8", "text-halo-width": 1.2 } });
  map.addLayer({ id: "heads", type: "symbol", source: "heads", layout: { "icon-image": ["get", "icon"], "icon-size": ["get", "sz"], "icon-rotate": ["get", "bearing"], "icon-rotation-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true }, paint: { "icon-opacity": .95 } });
  map.addLayer({ id: "hs", type: "symbol", source: "hs", layout: { "text-field": "★ 화성", "text-size": 14, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true }, paint: { "text-color": "#262624", "text-halo-color": "#fffff8", "text-halo-width": 2 } });
  show(location.hash.slice(1) || "inflow");
});
// 선 + 화살촉 — 선의 마지막 두 점으로 방위각을 잰다(북 = 0 · 시계 방향)
function setArcs(features) {
  map.getSource("arcs").setData(fc(features));
  const key = Object.fromEntries(Object.entries(COL).map(([k, c]) => [c, k]));
  map.getSource("heads").setData(fc(features.map(f => { const c = f.geometry.coordinates, n = c.length, p = c[n - 4], q = c[n - 3];   // 끝점보다 조금 앞 — 도착 원 밑에 묻히지 않게
    const b = Math.atan2((q[0] - p[0]) * Math.cos(q[1] * Math.PI / 180), q[1] - p[1]) * 180 / Math.PI;
    return pt(q, { icon: "arrow-" + (key[f.properties.color] || "in"), bearing: b, sz: .55 + f.properties.w * .09 }); })));
}
const setProj = globe => { try { map.setProjection({ type: globe ? "globe" : "mercator" }); } catch (e) {} };
const fly = (o, ms = 1400) => map.flyTo({ duration: ms, essential: true, ...o });

// ── 장면 ──────────────────────────────────────────────────────────────────
const S = D.sites, sitesC = S.filter(s => s.g === "C 본사 관외" && s.hq_lon != null);
const listRow = (rows, f, onclick) => { const L = $("list"); L.innerHTML = ""; rows.forEach((r, i) => { const d = document.createElement("div"); d.innerHTML = f(r); d.onclick = () => { L.querySelectorAll("div").forEach(x => x.classList.remove("sel")); d.classList.add("sel"); onclick(r); }; L.appendChild(d); }); };
const answer = (items, notes) => { $("answer").innerHTML = `<ul>${items.map(t => `<li>${t}</li>`).join("")}${(notes || []).map(t => `<li class="k">${t}</li>`).join("")}</ul>`; };
const kpi = items => { $("kpi").innerHTML = items.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join(""); };
const legend = html => { $("legend").innerHTML = html; }, ctl = html => { $("ctl").innerHTML = html; };
const sw = c => `<span class="sw" style="background:${c}"></span>`;
const scale = (v, max, lo, hi) => lo + (hi - lo) * Math.sqrt(Math.max(0, v || 0) / Math.max(1, max));

const SCENES = {
  inflow() {   // ① 관내 유입 — 관외 본사 → 관내 사업장 호 · 사업장 기둥(설비투자)
    setProj(false);
    const maxC = Math.max(...sitesC.map(s => s.cap || 0));
    setArcs((sitesC.map(s => line(bulge([s.hq_lon, s.hq_lat], [s.lon, s.lat], .12), { color: COL.in, w: scale(s.cap, maxC, 1, 5) }))));
    map.getSource("cols").setData(fc(sitesC.map(s => col([s.lon, s.lat], 60, { color: COL.in, h: 60 + scale(s.cap, maxC, 0, 1500), n: s.n, t: `${s.n}<br>본사 ${s.hq} · 사업장 ${s.dong || ""}<br>설비투자 ${s.cap ? fmt(s.cap) + "억" : "–"} · 종업원 ${s.emp ?? "–"}(구간)` }))));
    const hqs = {}; sitesC.forEach(s => { hqs[s.hq] ??= { n: 0, c: [s.hq_lon, s.hq_lat] }; hqs[s.hq].n++; });
    map.getSource("pts").setData(fc(Object.entries(hqs).map(([k, v]) => pt(v.c, { color: COL.in, r: 3 + Math.sqrt(v.n) * 2, label: v.n >= 5 ? `${k} ${v.n}` : "", t: `${k}<br>본사 ${v.n}사 → 화성 사업장` }))));
    answer([`<b>본사 관외 · 사업장 관내 ${fmt(K.n_C)}사</b> — 본사 이전·증설 1차 후보`, `DART 확인 ${fmt(D.inflow_dart.length)}사 · 전사 설비투자 ${fmt(D.inflow_dart.reduce((s, r) => s + (r.설비투자_억 || 0), 0))}억`, `외자 표적 = 수입 ${fmt(K.총수입)}억달러의 ${K.장비몫}% 반도체 장비 3사(관내)`], ["선 = 본사(점) → 화성 사업장(기둥) · 기둥 높이 = 설비투자 누적 · 점 크기 = 그 시군의 본사 수"]);
    kpi([[fmt(K.n_C), "본사 관외 사업장 관내"], [fmt(D.inflow_dart.length), "DART 확인"], [K.mou_2y, "최근 2년 협약"]]);
    legend(`${sw(COL.in)}본사 → 관내 사업장`); ctl(`<button data-v="kr" class="on">전국</button><button data-v="sudo">수도권</button><button data-v="hs">화성</button>`);
    listRow(D.inflow_dart.sort((a, b) => (b.설비투자_억 || 0) - (a.설비투자_억 || 0)), r => `<span>${r.기업명} <span class="k">${r.산업} · ${r.본점}</span></span><span class="num">${fmt(r.설비투자_억)}억</span>`, r => { if (r.lon) fly({ center: [r.lon, r.lat], zoom: 13.5, pitch: 60 }); });
    fly({ center: [127.3, 36.9], zoom: 6.6, pitch: 45, bearing: -8 });
  },
  reinvest() {   // ② 관내 재투자 — 요건 충족(적) · 여력(황) 기둥 · 관내 공시(녹) 점
    setProj(false);
    const E = D.elig.filter(r => r.lon), Cp = D.capacity.filter(r => r.lon && !E.some(e => e.기업명 === r.기업명)), I = D.invest_in.filter(r => r.lon), maxC = Math.max(...E.map(r => r.설비투자_억 || 0));
    setArcs([]);
    map.getSource("cols").setData(fc([...E.map(r => col([r.lon, r.lat], 90, { color: COL.elig, h: 100 + scale(r.설비투자_억, maxC, 0, 2500), t: `${r.기업명} · 요건 충족(${r.군})<br>${r.산업} · 설비투자 ${fmt(r.설비투자_억)}억 · 종업원 ${r.종업원}(구간)` })),
      ...Cp.map(r => col([r.lon, r.lat], 70, { color: COL.near, h: 60 + scale(r.설비투자_억, maxC, 0, 1500), t: `${r.기업명} · 후반기 투자 ${r.후반배}배<br>${r.산업} · 누적 ${fmt(r.설비투자_억)}억 · 5년 고용 ${r.고용증감5y > 0 ? "+" : ""}${r.고용증감5y}` }))]));
    map.getSource("pts").setData(fc(I.map(r => pt([r.lon, r.lat], { color: COL["화성 관내"], r: 6 + Math.sqrt(r.억) / 3, label: `${r.기업명} ${fmt(r.억)}억`, t: `${r.기업명} · 관내 투자 공시<br>${r.유형} ${fmt(r.억)}억 · ${r.공시일}` }))));
    answer([`<b>요건 충족 ${fmt(K.n_elig)}사</b>(투자 200억 且 고용 100명) · 설비투자 누적 ${fmt(K.capex_sum)}억 · 근접 ${fmt(K.n_near)}사`, `관내 투자 공시 ${D.invest_in.length}건 ${fmt(D.invest_in.reduce((s, r) => s + r.억, 0))}억`, `집행 ${K.exec}억 — 요건 충족 기업 대상`], ["적 기둥 = 요건 충족(높이 = 설비투자) · 황 기둥 = 후반기 투자 증가(여력) · 녹 점 = 관내 투자 공시"]);
    kpi([[fmt(K.n_elig), "요건 충족"], [fmt(K.capex_sum) + "억", "설비투자 누적"], [fmt(K.n_near), "근접"], [K.exec + "억", "집행"]]);
    legend(`${sw(COL.elig)}요건 충족 ${sw(COL.near)}투자 여력 ${sw(COL["화성 관내"])}관내 공시`); ctl(`<button data-v="hs" class="on">화성 전경</button><button data-v="dongtan">동탄</button><button data-v="hyangnam">향남</button>`);
    listRow(D.elig.sort((a, b) => b.설비투자_억 - a.설비투자_억), r => `<span>${r.기업명} <span class="k">${r.산업} · ${r.군}</span></span><span class="num">${fmt(r.설비투자_억)}억</span>`, r => { if (r.lon) fly({ center: [r.lon, r.lat], zoom: 13.5, pitch: 60 }); });
    fly({ center: [126.95, 37.17], zoom: 10.3, pitch: 55, bearing: -12 });
  },
  outflow(view = "all") {   // ③ 관외 유출 — 전체 · 세계(해외만) · 국내(수도권+지방) · 수도권(수도권 내만). 선택한 것만 올린다
    const SEL = { all: r => true, world: r => r.갈래 === "해외", kr: r => r.갈래 !== "해외", sudo: r => r.갈래 === "수도권 내" }[view] || (() => true);
    const globe = view === "all" || view === "world"; setProj(globe);
    const O = D.outflow.filter(r => r.갈래 !== "화성 관내" && r.d_lon != null && SEL(r)), maxE = Math.max(1, ...D.outflow.filter(r => r.갈래 !== "화성 관내").map(r => r.억 || 0));
    const agg = {}; O.forEach(r => { const k = r.corp_name + "|" + r.지역; agg[k] ??= { ...r, 억: 0, 건: 0 }; agg[k].억 += r.억 || 0; agg[k].건++; }); const A = Object.values(agg);
    setArcs((A.map(r => line(globe ? greatCircle([r.s_lon, r.s_lat], [r.d_lon, r.d_lat]) : bulge([r.s_lon, r.s_lat], [r.d_lon, r.d_lat], .18), { color: COL[r.갈래], w: scale(r.억, maxE, 1, 7) }))));
    map.getSource("cols").setData(EMPTY);
    const dest = {}; A.forEach(r => { dest[r.지역] ??= { c: [r.d_lon, r.d_lat], 억: 0, n: new Set(), g: r.갈래 }; dest[r.지역].억 += r.억; dest[r.지역].n.add(r.corp_name); });
    const labelMin = { all: 500, world: 300, kr: 700, sudo: 300 }[view];
    map.getSource("pts").setData(fc(Object.entries(dest).map(([k, v]) => pt(v.c, { color: COL[v.g], r: 4 + Math.sqrt(v.억 / 40), label: v.억 >= labelMin ? `${k} ${fmt(v.억)}억` : "", t: `${k}<br>${fmt(v.억)}억 · ${v.n.size}사` }))));
    const os = Object.fromEntries(K.outflow_sum.map(r => [r.갈래, r])), tot = A.reduce((s, r) => s + r.억, 0), nf = new Set(A.map(r => r.corp_name)).size;
    const ttl = { all: "관외·해외 전체", world: "해외", kr: "국내(수도권 내 · 지방)", sudo: "수도권 내" }[view];
    answer([`<b>${ttl} ${fmt(tot)}억 · ${nf}사 · ${A.reduce((s, r) => s + r.건, 0)}건</b>`, `전체 — 수도권 내 ${fmt(os["수도권 내"]?.억)} · 해외 ${fmt(os["해외"]?.억)} · 지방 ${fmt(os["지방"]?.억)}`, "원인: 용지 · 전력 · 계통 — 유형별 대응 상이"], ["선 = 화성 사업장 → 투자예정지 · 굵기 = 금액 · 점 = 지역 합계 · 사업장을 못 이은 공시는 화성 중심에서 출발"]);
    kpi([[fmt(os["수도권 내"]?.억) + "억", `수도권 내 ${os["수도권 내"]?.기업}사`], [fmt(os["해외"]?.억) + "억", `해외 ${os["해외"]?.기업}사`], [fmt(os["지방"]?.억) + "억", `지방 ${os["지방"]?.기업}사`]]);
    legend(`${sw(COL["수도권 내"])}수도권 내 ${sw(COL["지방"])}지방 ${sw(COL["해외"])}해외`);
    ctl(["all", "world", "kr", "sudo"].map(v => `<button data-v="${v}" class="${v === view ? "on" : ""}">${{ all: "전체", world: "세계", kr: "국내", sudo: "수도권" }[v]}</button>`).join(""));
    listRow(A.sort((a, b) => b.억 - a.억), r => `<span>${r.corp_name} <span class="k">→ ${r.지역} · ${r.갈래}</span></span><span class="num">${fmt(r.억)}억</span>`, r => fly({ center: [(r.s_lon + r.d_lon) / 2, (r.s_lat + r.d_lat) / 2], zoom: r.갈래 === "해외" ? 2.5 : 7.5, pitch: r.갈래 === "해외" ? 0 : 40 }));
    if (globe) fly({ center: [170, 32], zoom: 1.55, pitch: 0, bearing: 0 }); else if (view === "sudo") fly(VIEWS.sudo); else fly(VIEWS.kr);
  },
  return(view = "all") {   // ④ 재환입 — 전체 · 회귀 대상(수도권 내 → 화성 선) · 공장 관외(기둥). 선택한 것만 올린다
    setProj(false);
    const O = D.outflow.filter(r => r.갈래 === "수도권 내" && r.d_lon != null), maxE = Math.max(1, ...O.map(r => r.억 || 0));
    const agg = {}; O.forEach(r => { const k = r.corp_name + "|" + r.지역; agg[k] ??= { ...r, 억: 0, 건: 0 }; agg[k].억 += r.억 || 0; agg[k].건++; }); const A = Object.values(agg), P = D.plant_out.filter(r => r.lon);
    const showArc = view !== "plant", showPlant = view !== "arc";
    setArcs(showArc ? A.map(r => line(bulge([r.d_lon, r.d_lat], [r.s_lon, r.s_lat], .18), { color: COL["수도권 내"], w: scale(r.억, maxE, 1.5, 7) })) : []);   // 방향을 뒤집는다 — 되돌리는 그림
    map.getSource("cols").setData(fc(showPlant ? P.map(r => col([r.lon, r.lat], 80, { color: COL.plant, h: 200 + (100 - (r.관내비율 || 0)) * 12, t: `${r.기업명} · 본사 관내 · 공장 관외<br>${r.업종}<br>관내 가입자 비율 ${r.관내비율}% · 종업원 ${r.KoDATA종업원}(구간)` })) : []));
    const dest = {}; A.forEach(r => { dest[r.지역] ??= { c: [r.d_lon, r.d_lat], 억: 0, n: new Set() }; dest[r.지역].억 += r.억; dest[r.지역].n.add(r.corp_name); });
    map.getSource("pts").setData(fc(showArc ? Object.entries(dest).map(([k, v]) => pt(v.c, { color: COL["수도권 내"], r: 4 + Math.sqrt(v.억 / 40), label: v.억 >= 500 ? `${k} ${fmt(v.억)}억` : "", t: `${k}<br>${fmt(v.억)}억 · ${v.n.size}사 — 협상 영역` })) : []));
    const os = K.outflow_sum.find(r => r.갈래 === "수도권 내");
    answer([`<b>회귀 대상</b> — 수도권 내 유출 ${fmt(os.억)}억 · ${os.건}건 · ${os.기업}사(협상 영역)`, `<b>공장 관외</b> — 본사 관내 · 공장 관외 ${D.plant_out.length}사(관내 가입자 비율 낮은 순)`, `<b>지킬 고용</b> — 65세↑ 대표 ${fmt(K.succ.n65)}사 · ${fmt(K.succ.emp65)}명`], ["선 = 투자예정지 → 화성(되돌리는 방향) · 보라 기둥 = 본사 관내·공장 관외(높을수록 관내 비율 낮음) · 「본사 관내·공장 관외」 = 국민연금 가입자 비율 추정"]);
    kpi([[fmt(os.억) + "억", "수도권 내 협상 영역"], [fmt(os.기업), "기업"], [fmt(D.plant_out.length), "공장 관외"], [fmt(K.succ.emp65), "65세↑ 대표 고용"]]);
    legend(`${sw(COL["수도권 내"])}수도권 내 → 화성 ${sw(COL.plant)}본사 관내 · 공장 관외`);
    ctl(["all", "arc", "plant"].map(v => `<button data-v="${v}" class="${v === view ? "on" : ""}">${{ all: "전체", arc: "회귀 대상(수도권 유출)", plant: "공장 관외" }[v]}</button>`).join(""));
    const rows = [...(showArc ? A.sort((a, b) => b.억 - a.억).map(r => ({ ...r, kind: "out" })) : []), ...(showPlant ? D.plant_out.map(r => ({ ...r, kind: "plant" })) : [])];
    listRow(rows, r => r.kind === "out" ? `<span>${r.corp_name} <span class="k">${r.지역}</span></span><span class="num">${fmt(r.억)}억</span>` : `<span>${r.기업명} <span class="k">공장 관외 · ${r.업종}</span></span><span class="num">관내 ${r.관내비율}%</span>`,
      r => r.kind === "out" ? fly({ center: [(r.s_lon + r.d_lon) / 2, (r.s_lat + r.d_lat) / 2], zoom: 9, pitch: 45 }) : (r.lon && fly({ center: [r.lon, r.lat], zoom: 13.5, pitch: 60 })));
    fly(view === "plant" ? VIEWS.hs : { center: [127.05, 37.3], zoom: 8.6, pitch: 50, bearing: -10 });
  },
  capacity(view = "all") {   // ⑤ 투자 여력 발굴 — 관내 업체 중 다음 투자가 가까운 곳. 공개 가능한 신호 넷(구간값)만 쓴다
    setProj(false);
    const capa = Object.fromEntries(D.capacity.map(r => [r.기업명, r]));
    const rows = D.sites.map(s => { const c = capa[s.n];
      const sig = { 투자가속: !!c && c.후반배 >= 1.5, 성장: s.grow === "둘 다 는다" || s.grow === "투자만 는다", 요건근접: (s.cap >= 100 && s.cap < 200) || (s.emp === 75 && s.cap >= 200), 고용증가: (s.chg || 0) >= 100 };   // 증감은 ±50 반올림 구간값 — +50 은 잡음이라 +100 부터
      const score = (sig.투자가속 ? 2 : 0) + (sig.성장 ? 1 : 0) + (sig.요건근접 ? 1 : 0) + (sig.고용증가 ? 1 : 0);
      return { ...s, c, sig, score, 신호: Object.entries(sig).filter(([k, v]) => v).map(([k]) => k).join(" · ") }; }).filter(r => r.score >= 2);   // 1점(신호 하나)은 잡음 — 둘 이상 겹친 곳만
    const SEL = { all: r => true, fast: r => r.sig.투자가속, grow: r => r.sig.성장, near: r => r.sig.요건근접, hire: r => r.sig.고용증가 }[view] || (() => true);
    const R = rows.filter(SEL).sort((a, b) => b.score - a.score || (b.cap || 0) - (a.cap || 0)), maxC = Math.max(1, ...R.map(r => r.cap || 0));
    const colOf = r => r.score >= 3 ? COL.elig : COL.near;
    setArcs([]); map.getSource("pts").setData(EMPTY);
    map.getSource("cols").setData(fc(R.map(r => col([r.lon, r.lat], 70, { color: colOf(r), h: 80 + 250 * r.score + scale(r.cap, maxC, 0, 900), t: `${r.n} · 여력 ${r.score}점<br>${r.ind} · ${r.dong || ""}<br>${r.신호}<br>설비투자 누적 ${r.cap ? fmt(r.cap) + "억" : "–"} · 종업원 ${r.emp ?? "–"}(구간) · 5년 ${r.chg == null ? "–" : (r.chg > 0 ? "+" : "") + r.chg}${r.c ? " · 후반 " + r.c.후반배 + "배" : ""}` }))));
    answer([`<b>투자 여력 ${rows.length}사</b>(신호 2개↑ 겹침) — 3점↑ ${rows.filter(r => r.score >= 3).length} · 2점 ${rows.filter(r => r.score === 2).length}`, `신호 — 후반기 설비투자 1.5배↑(×2) · 성장 유형(둘 다·투자만) · 요건 근접(투자 100~200억 또는 고용 50~99) · 5년 고용 +100↑`, "내부판(Shiny 감지 탭) = 국민연금 월별 가입자·채용·R&D 까지 8신호 · 여기는 공개 가능한 넷"],
      ["적 = 3점↑ · 황 = 2점 · 높이 = 점수 + 설비투자 · 종업원·증감 = 구간 대표값"]);
    kpi([[fmt(rows.filter(r => r.score >= 3).length), "3점↑ 지금 만난다"], [fmt(rows.filter(r => r.score === 2).length), "2점 분기 안"], [fmt(D.capacity.length), "후반기 투자 증가"], [fmt(rows.filter(r => r.sig.요건근접).length), "요건 근접"]]);
    legend(`${sw(COL.elig)}3점↑ ${sw(COL.near)}2점`);
    ctl(["all", "fast", "grow", "near", "hire"].map(v => `<button data-v="${v}" class="${v === view ? "on" : ""}">${{ all: "전체", fast: "투자 가속", grow: "성장 유형", near: "요건 근접", hire: "고용 증가" }[v]}</button>`).join(""));
    listRow(R, r => `<span>${r.n} <span class="k">${r.ind} · ${r.신호}</span></span><span class="num">${r.score}점${r.cap ? " · " + fmt(r.cap) + "억" : ""}</span>`, r => fly({ center: [r.lon, r.lat], zoom: 13.5, pitch: 60 }));
    fly(VIEWS.hs);
  }
};
const VIEWS = { kr: { center: [127.5, 36.4], zoom: 6.6, pitch: 45, bearing: -8 }, sudo: { center: [127.05, 37.35], zoom: 8.8, pitch: 50, bearing: -10 }, hs: { center: [126.95, 37.17], zoom: 10.3, pitch: 55, bearing: -12 }, dongtan: { center: [127.1, 37.2], zoom: 13, pitch: 60, bearing: -20 }, hyangnam: { center: [126.92, 37.13], zoom: 13, pitch: 60, bearing: -15 }, world: null };
let cur = null;
function show(id) { if (!SCENES[id]) id = "inflow"; cur = id; document.querySelectorAll("#scenes button").forEach(b => b.classList.toggle("on", b.dataset.s === id)); SCENES[id](); location.hash = id; status(document.querySelector("#scenes button.on b")?.textContent || id); }
document.querySelectorAll("#scenes button").forEach(b => b.onclick = () => show(b.dataset.s));
$("ctl").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const v = b.dataset.v;
  if (cur === "outflow") return SCENES.outflow(v);
  if (cur === "return") return SCENES.return(v);
  if (cur === "capacity") return SCENES.capacity(v);
  $("ctl").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); if (VIEWS[v]) fly(VIEWS[v]); });
addEventListener("hashchange", () => { const id = location.hash.slice(1); if (id && id !== cur) show(id); });

// ── 툴팁 ──────────────────────────────────────────────────────────────────
const tip = $("tip");
map.on("mousemove", e => { const f = map.queryRenderedFeatures(e.point, { layers: ["cols", "pts"] })[0]; if (!f || !f.properties.t) { tip.style.display = "none"; map.getCanvas().style.cursor = ""; return; }
  tip.innerHTML = f.properties.t; tip.style.display = "block"; tip.style.left = (e.point.x + 14) + "px"; tip.style.top = (e.point.y + 14) + "px"; map.getCanvas().style.cursor = "pointer"; });
map.on("error", e => { if (e.error && /projection/i.test(e.error.message || "")) status("지구본 투영을 지원하지 않는 브라우저 — 평면으로 보여 준다"); });
