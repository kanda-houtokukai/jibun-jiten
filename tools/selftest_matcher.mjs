#!/usr/bin/env node
// 照合エンジン v1 の自己テスト（Phase 1b タスク3）
// 実行: node tools/selftest_matcher.mjs
// 実機検証の前に機械で潰す3ケース＋全80字のパース網羅。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_CONFIG, templateStrokes, matchKanji,
} from '../js/matcher.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(ROOT, 'data', 'kanji-g1.json'), 'utf8'));
const byChar = Object.fromEntries(data.kanji.map(k => [k.char, k]));

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (detail ? '  → ' + detail : '')); }
}

// 模範をユーザー入力形式(0..1正規化)に変換
function templateAsUser(rec) {
  return templateStrokes(rec, DEFAULT_CONFIG.samplePoints)
    .map(pts => pts.map(p => ({ x: p.x / 109, y: p.y / 109 })));
}

// --- テスト1: 自明ケース（模範自身を入力 → 全画高スコアで○） ---
console.log('テスト1: 模範自身を入力（全80字）');
{
  let minScore = 101, badChars = [];
  for (const rec of data.kanji) {
    const res = matchKanji(templateAsUser(rec), rec);
    const lo = Math.min(...res.perStroke.map(s => s.score));
    minScore = Math.min(minScore, lo);
    if (res.verdict !== 'ok') badChars.push(rec.char + ':' + res.verdict);
  }
  check('全80字が verdict=ok', badChars.length === 0, badChars.join(','));
  check(`全画スコアが高い（最低 ${minScore} ≥ 95）`, minScore >= 95);
}

// --- テスト2: 画の順序入れ替え → 該当画が低スコア ---
console.log('テスト2: 筆順の入れ替え');
for (const char of ['右', '左']) {
  const rec = byChar[char];
  const strokes = templateAsUser(rec);
  [strokes[0], strokes[1]] = [strokes[1], strokes[0]];
  const res = matchKanji(strokes, rec);
  const s0 = res.perStroke[0], s1 = res.perStroke[1];
  check(`${char}: 1画目と2画目の交換で両画が不合格（${s0.score}, ${s1.score} < ${DEFAULT_CONFIG.passScore}）`,
    s0.score < DEFAULT_CONFIG.passScore && s1.score < DEFAULT_CONFIG.passScore);
  check(`${char}: verdict が ok でない（${res.verdict}）・対象画を特定（failing=${JSON.stringify(res.failing)}）`,
    res.verdict !== 'ok' && res.failing.includes(0) && res.failing.includes(1));
}
// 参考情報: 全字で先頭2画を交換した場合の検出率（アサートしない・分布把握用）
{
  let detected = 0, total = 0;
  for (const rec of data.kanji) {
    if (rec.strokes.length < 2) continue;
    total++;
    const strokes = templateAsUser(rec);
    [strokes[0], strokes[1]] = [strokes[1], strokes[0]];
    if (matchKanji(strokes, rec).verdict !== 'ok') detected++;
  }
  console.log(`  参考: 先頭2画交換の検出 ${detected}/${total} 字`);
}

// --- テスト3: 画数の過不足 ---
console.log('テスト3: 画数エラー');
{
  const rec = byChar['右'];
  const strokes = templateAsUser(rec);
  const fewer = matchKanji(strokes.slice(0, -1), rec);
  check(`1画欠け → too-few（expected=${fewer.expected}, got=${fewer.got}）`,
    fewer.verdict === 'too-few' && fewer.expected === 5 && fewer.got === 4);
  const extra = matchKanji([...strokes, strokes[strokes.length - 1]], rec);
  check(`1画過剰 → too-many（expected=${extra.expected}, got=${extra.got}）`,
    extra.verdict === 'too-many' && extra.got === 6);
}

console.log(`\n結果: ${pass} ok / ${fail} NG`);
process.exit(fail ? 1 : 0);
