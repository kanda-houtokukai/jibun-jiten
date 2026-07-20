// settle.js — 署名要素「定着（てい）」の演出（Phase D1）
//
// 定義: 書いている最中の線＝生乾き（薄い灰みの青）。そらがき合格の瞬間、
//   1. 沈む: 生乾きの線が濃紺 ink に沈み込み、ごくわずかに線幅が締まる
//   2. にじむ: 線の縁がほんの少し紙ににじむ（気配の量）
//   約0.4秒・後半ゆっくり。音なし・星なし。新緑は隅の小さな印まで。
//
// 実装方式: 書き終えたストロークを SVG で再描画し CSS transition で補間。
//   - 書き味への影響ゼロ（演出は書き終えた後。canvas 入力系には触らない）
//   - rAF 不使用（★台帳の教訓: iOS 低電力時の抑制）。完了通知も setTimeout
//   - にじみは feGaussianBlur でなく「太い下層線の不透明度」で表現（軽量・機種差なし）
//
// パラメータはこの SETTLE 1箇所に集約。settle-test.html のスライダーはこれを
// 上書きして調整し、確定値をここに書き戻す運用。

'use strict';

export const SETTLE = {
  ink: '#1B2A4A',        // 定着後の濃紺（デザイン言語 ink）
  wetMix: 0.62,          // 生乾きの薄さ 0=ink のまま 〜 1=ほぼ紙色。ink と #D9DEE7 の混合比
  durationMs: 400,       // 沈む時間
  easing: 'cubic-bezier(0.18, 0.62, 0.22, 1)', // 後半ゆっくり＝すっと吸い込まれて止まる
  width: 2.8,            // 線幅（109座標系。既存の書き線と同じ）
  tighten: 0.93,         // 定着で線幅が締まる比率
  bleedWidth: 1.9,       // にじみ層の線幅倍率
  bleedOpacity: 0.14,    // にじみ層の最終不透明度（「気配」の量）
  grow: true,            // 定着後、隅に小さな新緑の印をにじませる
  growColor: '#3A9D6B',
  growDelayRatio: 0.75,  // 新緑の印は沈みの終わり際に
};

const SVG_NS = 'http://www.w3.org/2000/svg';

// ink と薄め色の混合で生乾き色を作る（wetMix はスライダーで動かせる）
export function wetColor(p = SETTLE) {
  return mixHex(p.ink, '#D9DEE7', p.wetMix);
}

export function mixHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) =>
    Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// 正規化ストローク(0..1) → SVG path d（109空間）
export function strokesToD(strokes) {
  return strokes.map(s => {
    if (!s.length) return '';
    let d = `M${(s[0].x * 109).toFixed(1)},${(s[0].y * 109).toFixed(1)}`;
    if (s.length === 1) d += ' l0.01,0';
    for (let i = 1; i < s.length; i++) {
      d += ` L${(s[i].x * 109).toFixed(1)},${(s[i].y * 109).toFixed(1)}`;
    }
    return d;
  });
}

function makeLayer(svg, dList, stroke, width, opacity, mark) {
  const g = document.createElementNS(SVG_NS, 'g');
  if (mark) g.dataset.layer = mark;
  for (const d of dList) {
    if (!d) continue;
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', stroke);
    p.setAttribute('stroke-width', width);
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    if (opacity !== 1) p.setAttribute('stroke-opacity', opacity);
    g.appendChild(p);
  }
  svg.appendChild(g);
  return g;
}

// 「定着済み」の静的表示（じぶん字典・保存表示用。演出後の完成形と同一の見た目）
export function settledSvg(strokesOrD, p = SETTLE) {
  const dList = typeof strokesOrD[0] === 'string' ? strokesOrD : strokesToD(strokesOrD);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 109 109');
  makeLayer(svg, dList, p.ink, p.width * p.tighten * p.bleedWidth, p.bleedOpacity, 'bleed');
  makeLayer(svg, dList, p.ink, p.width * p.tighten, 1, 'main');
  return svg;
}

// 定着演出。host（position:relative の要素）に SVG を重ねて実行する。
// strokes: 正規化(0..1)ストローク配列 ／ 返り値: { el, finished(Promise), remove() }
export function settleOverlay(host, strokes, params) {
  const p = { ...SETTLE, ...params };
  const dList = strokesToD(strokes);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 109 109');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';

  // にじみ層（下）: ink・太い・透明 → ふわっと現れる
  const bleed = makeLayer(svg, dList, p.ink, p.width * p.bleedWidth, 1, 'bleed');
  bleed.style.opacity = '0';
  // 主線層（上）: 生乾き → ink へ沈む・わずかに締まる
  const main = makeLayer(svg, dList, wetColor(p), p.width, 1, 'main');
  // 新緑の印（隅・小さく）
  let growEls = [];
  if (p.grow) {
    for (const [r, op] of [[4.2, 0.25], [2.1, 0.9]]) {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', 100.5);
      c.setAttribute('cy', 100.5);
      c.setAttribute('r', r);
      c.setAttribute('fill', p.growColor);
      c.style.opacity = '0';
      c.dataset.finalOpacity = op;
      svg.appendChild(c);
      growEls.push(c);
    }
  }
  host.appendChild(svg);

  svg.getBoundingClientRect(); // 強制リフロー（★教訓: 開始値を確定させてから終値）

  const dur = p.durationMs;
  const ease = p.easing;
  for (const path of main.querySelectorAll('path')) {
    path.style.transition = `stroke ${dur}ms ${ease}, stroke-width ${dur}ms ${ease}`;
    path.style.stroke = p.ink;
    path.style.strokeWidth = p.width * p.tighten;
  }
  bleed.style.transition = `opacity ${dur}ms ${ease}`;
  bleed.style.opacity = String(p.bleedOpacity);
  const growDelay = Math.round(dur * p.growDelayRatio);
  for (const c of growEls) {
    c.style.transition = `opacity ${Math.round(dur * 0.6)}ms ${ease} ${growDelay}ms`;
    c.style.opacity = c.dataset.finalOpacity;
  }

  const finished = new Promise(res => setTimeout(res, dur + growDelay + 80));
  return { el: svg, finished, remove: () => svg.remove() };
}
