#!/usr/bin/env node
// exam.js の自己テスト（Phase 3b タスク1）
// 実行: node tools/selftest_exam.mjs
// シード乱数で200回生成し、構成・重複・誤答肢の健全性・全字カバー可能性を機械検証。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  EXAM_SPEC, buildExam, scoreExam, mulberry32, displayReading,
} from '../js/exam.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = f => JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));
const kanji = load('kanji-g1.json').kanji;
const sentences = load('sentences-g1.json').sentences;
const readings = load('exam-readings-g1.json').readings;
const data = { kanji, sentences, readings };
const byChar = Object.fromEntries(kanji.map(k => [k.char, k]));

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (detail ? '  → ' + detail : '')); }
}

const N = 200;
const problems = [];
const seenChars = new Set();

for (let i = 0; i < N; i++) {
  const rng = mulberry32(1000 + i);
  const exam = buildExam(data, rng);
  const qs = exam.questions;
  const types = { yomi: 0, kaki: 0, kakusuu: 0 };
  const charsUsed = new Set();
  const sentUsed = new Set();
  for (const q of qs) {
    types[q.type]++;
    if (charsUsed.has(q.char)) problems.push(`run${i}: 字の重複 ${q.char}`);
    charsUsed.add(q.char);
    seenChars.add(q.char);
    if (q.sentenceId) {
      if (sentUsed.has(q.sentenceId)) problems.push(`run${i}: 文の重複 ${q.sentenceId}`);
      sentUsed.add(q.sentenceId);
    }
    if (q.type === 'yomi') {
      if (q.choices.length !== 3 || new Set(q.choices).size !== 3) {
        problems.push(`run${i}: よみ肢が3択でない/重複 ${q.choices}`);
      }
      const correct = q.choices[q.answerIndex];
      const own = new Set([...byChar[q.char].readings.on, ...byChar[q.char].readings.kun]
        .map(displayReading));
      for (const c of q.choices) {
        if (c !== correct && own.has(c)) {
          problems.push(`run${i}: 誤答肢「${c}」が ${q.char} の正しい読みと衝突`);
        }
      }
    }
    if (q.type === 'kakusuu') {
      if (q.choices.length !== 3 || new Set(q.choices).size !== 3) {
        problems.push(`run${i}: かくすう肢が3択でない/重複 ${q.choices}`);
      }
      if (q.choices[q.answerIndex] !== byChar[q.char].strokeCount) {
        problems.push(`run${i}: かくすう正解が画数と不一致 ${q.char}`);
      }
      if (q.choices.some(v => v < 1)) problems.push(`run${i}: かくすう肢に0以下 ${q.choices}`);
    }
  }
  if (types.yomi !== EXAM_SPEC.yomi || types.kaki !== EXAM_SPEC.kaki || types.kakusuu !== EXAM_SPEC.kakusuu) {
    problems.push(`run${i}: 構成が ${JSON.stringify(types)}`);
  }
}

console.log(`テスト: ${N}回生成`);
check('30問構成（よみ10/かき14/かくすう6）がすべての回で成立', problems.filter(p => p.includes('構成')).length === 0);
check('同一テスト内で字・文の重複なし', problems.filter(p => p.includes('重複')).length === 0);
check('誤答肢が正解・対象字の読みと衝突しない', problems.filter(p => p.includes('衝突')).length === 0);
check('3択の成立（よみ・かくすう）', problems.filter(p => p.includes('3択')).length === 0);
check(`全80字が出題されうる（${N}回で ${seenChars.size}/80 字出現）`, seenChars.size === 80);
if (problems.length) problems.slice(0, 10).forEach(p => console.log('    !', p));

// 採点の検証
{
  const rng = mulberry32(42);
  const exam = buildExam(data, rng);
  const allRight = exam.questions.map(q =>
    q.type === 'kaki' ? { verdict: 'ok' } : { chosenIndex: q.answerIndex });
  const r1 = scoreExam(exam.questions, allRight);
  check('全問正解で150点・合格', r1.score === 150 && r1.passed && r1.wrong.length === 0);

  const allWrong = exam.questions.map(q =>
    q.type === 'kaki' ? { verdict: 'ng' } : { chosenIndex: (q.answerIndex + 1) % 3 });
  const r2 = scoreExam(exam.questions, allWrong);
  check('全問不正解で0点・不合格・間違い30字', r2.score === 0 && !r2.passed && r2.wrong.length === 30);

  const sixWrong = exam.questions.map((q, i) => {
    if (i < 6) return q.type === 'kaki' ? { verdict: 'close' } : { chosenIndex: (q.answerIndex + 1) % 3 };
    return q.type === 'kaki' ? { verdict: 'ok' } : { chosenIndex: q.answerIndex };
  });
  const r3 = scoreExam(exam.questions, sixWrong);
  check('6問おとすと120点でぎりぎり合格', r3.score === 120 && r3.passed && r3.wrong.length === 6);
}

console.log(`\n結果: ${pass} ok / ${fail} NG`);
process.exit(fail ? 1 : 0);
