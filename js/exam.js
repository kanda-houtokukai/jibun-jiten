// exam.js — 10きゅうレベル テストの出題生成（Phase 3b）
// DOM 非依存。ブラウザと Node の両方で動く。
//
// 構成（Chat決定・独自構成）: よみ10問(各5点)／かき14問(各5点)／かくすう6問(各5点)
// ＝30問150点・合格120点。同一テスト内で同じ字・同じ文は使わない。
// 「漢検」の語はコード・文言に使わない（CLAUDE.md）。

'use strict';

export const EXAM_SPEC = {
  yomi: 10,
  kaki: 14,
  kakusuu: 6,
  pointsPer: 5,
  fullScore: 150,
  passScore: 120,
};

// ---- 読み表記のユーティリティ ----

// KANJIDIC2 原表記 → 表示形（送り仮名ドット除去・カタカナ→ひらがな・接辞ハイフン除去）
export function displayReading(reading) {
  let s = reading.replace(/[.\-]/g, '');
  return s.replace(/[ァ-ヶ]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

// 送り仮名つき読みの語幹（字そのものの読み部分）。「う.まれる」→「う」
export function readingStem(reading) {
  return displayReading(reading.split('.')[0]);
}

// よみ問題の選択肢表示（Phase 3e・方向A）:
// 正解・誤答のすべての肢をこの1関数で整形する（語幹のみ・送り仮名なし）。
// 送り仮名は文中にひらがなで見えているため、問うのは字の部分の読みだけ。
// かき問題の空欄ヒント（readingStem）と同じ規則＝アプリ内で一貫。
// ⚠️正解との衝突除外・モーラ数の近さ判定も、必ずこの整形後の文字列で行うこと
//   （「片方だけ送り仮名付き」という不揃いを構造的に起こさないための集約）。
export function readingForChoice(reading) {
  return readingStem(reading);
}

// 送り仮名部分。「う.まれる」→「まれる」（ドットなしなら空）
export function readingOkurigana(reading) {
  const i = reading.indexOf('.');
  return i >= 0 ? reading.slice(i + 1) : '';
}

// ---- 乱数（テストで差し替え可能） ----

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// ---- 出題生成 ----

// data: { kanji: kanji-g1.jsonのkanji配列, sentences: sentences-g1.jsonのsentences配列,
//         readings: exam-readings-g1.jsonのreadingsマップ }
// rng: 0..1 を返す関数（省略時 Math.random）
export function buildExam(data, rng = Math.random) {
  const { kanji, sentences, readings } = data;
  const byChar = Object.fromEntries(kanji.map(k => [k.char, k]));
  const sentByChar = {};
  for (const s of sentences) {
    (sentByChar[s.target.char] = sentByChar[s.target.char] || []).push(s);
  }
  const chars = shuffled(Object.keys(readings), rng);
  const need = EXAM_SPEC.yomi + EXAM_SPEC.kaki + EXAM_SPEC.kakusuu;
  if (chars.length < need) throw new Error('字数が不足');

  // 全字の表示読みプール（誤答肢用）: {display, char}。整形は readingForChoice に集約
  const pool = [];
  for (const [char, sel] of Object.entries(readings)) {
    for (const r of [...sel.on, ...sel.kun]) {
      pool.push({ display: readingForChoice(r), char });
    }
  }

  const questions = [];
  let cursor = 0;

  // よみ10問
  for (let n = 0; n < EXAM_SPEC.yomi; n++) {
    const char = chars[cursor++];
    const cands = (sentByChar[char] || []).filter(s => s.use.includes('yomi'));
    const s = pick(cands, rng);
    const correct = readingForChoice(s.target.reading);
    // 対象字の全読み（整形後）と衝突する肢は除外（語幹化の字間衝突もここで落ちる）
    const own = new Set(
      [...byChar[char].readings.on, ...byChar[char].readings.kun].map(readingForChoice));
    const wrongPool = pool.filter(p =>
      p.char !== char && p.display !== correct && !own.has(p.display));
    // モーラ数（かな文字数で近似）が近いものを優先
    const ranked = shuffled(wrongPool, rng)
      .sort((a, b) => Math.abs(a.display.length - correct.length)
                    - Math.abs(b.display.length - correct.length));
    const wrongs = [];
    for (const c of ranked) {
      if (wrongs.includes(c.display)) continue;
      wrongs.push(c.display);
      if (wrongs.length === 2) break;
    }
    const choices = shuffled([correct, ...wrongs], rng);
    questions.push({
      type: 'yomi', points: EXAM_SPEC.pointsPer,
      char, sentenceId: s.id, text: s.text,
      start: s.target.start, len: s.target.len,
      okurigana: readingOkurigana(s.target.reading),
      choices, answerIndex: choices.indexOf(correct),
    });
  }

  // かき14問
  for (let n = 0; n < EXAM_SPEC.kaki; n++) {
    const char = chars[cursor++];
    const cands = (sentByChar[char] || []).filter(s => s.use.includes('kaki'));
    const s = pick(cands, rng);
    questions.push({
      type: 'kaki', points: EXAM_SPEC.pointsPer,
      char, sentenceId: s.id, text: s.text,
      start: s.target.start, len: s.target.len,
      kana: readingStem(s.target.reading),   // 空欄マスに示すよみ（字の部分のみ）
      strokeCount: byChar[char].strokeCount,
    });
  }

  // かくすう6問
  for (let n = 0; n < EXAM_SPEC.kakusuu; n++) {
    const char = chars[cursor++];
    const sc = byChar[char].strokeCount;
    // 誤答肢: 正解±1〜2 から2つ（1以上・重複なし）
    const offsets = shuffled([-2, -1, 1, 2], rng);
    const wrongs = [];
    for (const o of offsets) {
      const v = sc + o;
      if (v >= 1 && !wrongs.includes(v)) wrongs.push(v);
      if (wrongs.length === 2) break;
    }
    const choices = shuffled([sc, ...wrongs], rng);
    questions.push({
      type: 'kakusuu', points: EXAM_SPEC.pointsPer,
      char, strokeCount: sc,
      choices, answerIndex: choices.indexOf(sc),
    });
  }

  return { spec: EXAM_SPEC, questions };
}

// ---- 採点 ----
// answers[i]: よみ/かくすう = { chosenIndex } ／ かき = { verdict }（matcherの判定）
export function scoreExam(questions, answers) {
  let score = 0;
  const wrong = [];
  questions.forEach((q, i) => {
    const a = answers[i];
    let ok = false;
    if (!a) ok = false;
    else if (q.type === 'kaki') ok = a.verdict === 'ok';
    else ok = a.chosenIndex === q.answerIndex;
    if (ok) score += q.points;
    else if (!wrong.includes(q.char)) wrong.push(q.char);
  });
  return { score, wrong, passed: score >= EXAM_SPEC.passScore };
}
