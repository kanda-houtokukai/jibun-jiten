// matcher.js — 照合エンジン v1（Phase 1b）
// DOM 非依存の独立モジュール。ブラウザ(<script type="module">)と Node の両方で動く。
//
// 座標系: すべて KanjiVG の 109×109 viewBox 空間で比較する。
//   - 模範: kanji-g1.json の strokes[].path（SVG path文字列）を実行時に
//     等間隔リサンプリングする（ビルド時生成にしない理由: データ容量への
//     影響ゼロ・1026字でも追加バイトなし。パスは M/C/c/S/s のみで純JSで
//     決定的にサンプリングできる）
//   - ユーザー: マス内の正規化座標(0..1)を 109 倍して同じ空間に写す
//     （マス全体 = 109×109。このスケール合わせを固定とする）
//
// 比較は画単位・筆順どおり（i番目の画は i番目の模範画とだけ比べる）。

'use strict';

// 重み・しきい値は必ずここにまとめる（調整ページから上書きされる）
export const DEFAULT_CONFIG = {
  samplePoints: 24,   // 1画あたりのリサンプリング点数（指示書の16〜32から24を採用）
  distNorm: 20,       // 平均距離がこの値(109座標系)で距離スコアが0になる
  dirWeight: 0.35,    // 方向スコアの重み（距離は 1-dirWeight）
  passScore: 60,      // この点以上で画が合格
  floorScore: 35,     // これ未満の画が1つでもあれば字全体が×
  maxCloseStrokes: 2, // 「おしい」扱いにできる不合格画数の上限（超えると×）
  dirOkCos: 0.5,      // 始点→終点方向の余弦がこれ以上なら「向きOK」
};

// ---- SVGパス解析（KanjiVGで使われる M/m/C/c/S/s のみ対応）----

function parsePath(d) {
  const tokens = d.match(/[MmCcSs]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) throw new Error('パスを解析できない: ' + d);
  const segs = []; // {p0, c1, c2, p1} の3次ベジェ列
  let i = 0;
  let cur = { x: 0, y: 0 };
  let start = null;
  let prevC2 = null;
  let cmd = null;
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    if (/[MmCcSs]/.test(tokens[i])) cmd = tokens[i++];
    switch (cmd) {
      case 'M': cur = { x: num(), y: num() }; start = cur; prevC2 = null; cmd = 'L'; break;
      case 'm': cur = { x: cur.x + num(), y: cur.y + num() }; start = cur; prevC2 = null; cmd = 'l'; break;
      case 'C': case 'c': {
        const rel = cmd === 'c';
        const bx = rel ? cur.x : 0, by = rel ? cur.y : 0;
        const c1 = { x: bx + num(), y: by + num() };
        const c2 = { x: bx + num(), y: by + num() };
        const p1 = { x: bx + num(), y: by + num() };
        segs.push({ p0: cur, c1, c2, p1 });
        prevC2 = c2; cur = p1; break;
      }
      case 'S': case 's': {
        const rel = cmd === 's';
        const bx = rel ? cur.x : 0, by = rel ? cur.y : 0;
        // 直前の第2制御点を現在点で鏡映(直前が曲線でなければ現在点)
        const c1 = prevC2
          ? { x: 2 * cur.x - prevC2.x, y: 2 * cur.y - prevC2.y }
          : { x: cur.x, y: cur.y };
        const c2 = { x: bx + num(), y: by + num() };
        const p1 = { x: bx + num(), y: by + num() };
        segs.push({ p0: cur, c1, c2, p1 });
        prevC2 = c2; cur = p1; break;
      }
      default:
        throw new Error('未対応のパスコマンド: ' + cmd + ' in ' + d);
    }
  }
  return segs;
}

function cubicAt(seg, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
  return {
    x: a * seg.p0.x + b * seg.c1.x + c * seg.c2.x + e * seg.p1.x,
    y: a * seg.p0.y + b * seg.c1.y + c * seg.c2.y + e * seg.p1.y,
  };
}

// ---- リサンプリング ----

// 折れ線を弧長基準で n 点の等間隔列にする
export function resamplePoints(points, n) {
  const pts = points.filter((p, i) =>
    i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
  if (pts.length === 0) throw new Error('点が空');
  if (pts.length === 1) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = cum[cum.length - 1];
  const out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const segLen = cum[j + 1] - cum[j];
    const t = segLen > 0 ? (target - cum[j]) / segLen : 0;
    out.push({
      x: pts[j].x + (pts[j + 1].x - pts[j].x) * t,
      y: pts[j].y + (pts[j + 1].y - pts[j].y) * t,
    });
  }
  return out;
}

// SVGパス文字列 → n点の等間隔座標列（109×109空間）
export function samplePath(d, n) {
  const segs = parsePath(d);
  const poly = [segs[0].p0];
  const STEPS = 32; // ベジェ1本あたりの平坦化分割数
  for (const seg of segs) {
    for (let s = 1; s <= STEPS; s++) poly.push(cubicAt(seg, s / STEPS));
  }
  return resamplePoints(poly, n);
}

// 模範1字ぶんの全画を座標列へ（rec = kanji-g1.json の1レコード）
export function templateStrokes(rec, n) {
  return rec.strokes.map(s => samplePath(s.path, n));
}

// ユーザーストローク（0..1正規化のマス座標）→ 109空間
export function userStrokeTo109(points) {
  return points.map(p => ({ x: p.x * 109, y: p.y * 109 }));
}

// ---- スコアリング ----

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// 1画のスコア。userPts/tmplPts はどちらも109空間の座標列（点数不問・内部で揃える）
export function scoreStroke(userPts, tmplPts, config) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const n = cfg.samplePoints;
  const u = resamplePoints(userPts, n);
  const t = resamplePoints(tmplPts, n);
  // 対応点間の平均距離
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.hypot(u[i].x - t[i].x, u[i].y - t[i].y);
  const dist = sum / n;
  const distScore = clamp01(1 - dist / cfg.distNorm);
  // 始点→終点の方向一致（余弦）。ほぼ点のストロークは方向不定として0
  const uv = { x: u[n - 1].x - u[0].x, y: u[n - 1].y - u[0].y };
  const tv = { x: t[n - 1].x - t[0].x, y: t[n - 1].y - t[0].y };
  const ul = Math.hypot(uv.x, uv.y), tl = Math.hypot(tv.x, tv.y);
  let dirCos = 0;
  if (ul > 2 && tl > 0) dirCos = (uv.x * tv.x + uv.y * tv.y) / (ul * tl);
  const dirScore = clamp01(dirCos);
  const score = Math.round(100 * ((1 - cfg.dirWeight) * distScore + cfg.dirWeight * dirScore));
  return {
    score,
    dist: Math.round(dist * 10) / 10,
    dirCos: Math.round(dirCos * 100) / 100,
    dirOk: dirCos >= cfg.dirOkCos,
  };
}

// ---- 字全体の判定 ----
// userStrokes: [[{x,y}...], ...] 0..1正規化のマス座標
// rec: kanji-g1.json の1レコード
// 返り値 verdict: 'ok' | 'close' | 'ng' | 'too-few' | 'too-many'
export function matchKanji(userStrokes, rec, config) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const tmpl = templateStrokes(rec, cfg.samplePoints);
  const perStroke = [];
  const m = Math.min(userStrokes.length, tmpl.length);
  for (let i = 0; i < m; i++) {
    perStroke.push(scoreStroke(userStrokeTo109(userStrokes[i]), tmpl[i], cfg));
  }
  if (userStrokes.length > tmpl.length) {
    return { verdict: 'too-many', expected: tmpl.length, got: userStrokes.length, perStroke, failing: [] };
  }
  if (userStrokes.length < tmpl.length) {
    return { verdict: 'too-few', expected: tmpl.length, got: userStrokes.length, perStroke, failing: [] };
  }
  const failing = [];
  let hasFloor = false;
  perStroke.forEach((s, i) => {
    if (s.score < cfg.passScore) failing.push(i);
    if (s.score < cfg.floorScore) hasFloor = true;
  });
  let verdict = 'ok';
  if (failing.length > 0) {
    verdict = (hasFloor || failing.length > cfg.maxCloseStrokes) ? 'ng' : 'close';
  }
  return { verdict, expected: tmpl.length, got: userStrokes.length, perStroke, failing };
}
