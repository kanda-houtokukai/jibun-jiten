// ruby.js — UI文言（種類1）の学年別 漢字/かな＋ルビ機構（R1②）
//
// 文言の正本は js/texts.js の「{漢字|よみ}」マークアップ1本。ここは見え方だけを決める:
//   ・3年生以上: セグメント内の全字が「選んだ学年までに習う字」→ 漢字＋ルビ／それ以外 → よみ（かな）
//   ・1〜2年生: かなが既定。許可リスト（Chat承認・現状は空）にある字だけ漢字＋ルビ
//   ・小学校配当外の字（kanjiGrades に無い字）→ 常にかな
//   ・学年未設定（grade=null）→ すべてかな（初回の学年選択画面が最も読みやすい形）
//
// 判定はセグメント単位（texts.js の粒度: 訓＋送り仮名は1字ずつ・熟語は語ごと）。
// 語の中での交ぜ書きはしない。
//
// 純ロジック（DOM非依存）。tools/selftest_ruby.mjs から検証できる。

'use strict';

const state = {
  kanjiGrades: {},           // {字: 1..6}（小学配当のみ。配当外の字は載らない）
  lowGradeAllow: new Set(),  // 1〜2年生で漢字にしてよい字（⚠️中身はChatが決める。承認まで空）
  grade: null,               // 表示学年（null=未設定）
  rubyEnabled: true,         // R1では常にtrue（OFFのUIはR5以降）
};

export function configureRuby({ kanjiGrades, lowGradeAllow, grade, rubyEnabled } = {}) {
  if (kanjiGrades) state.kanjiGrades = kanjiGrades;
  if (lowGradeAllow) state.lowGradeAllow = new Set(lowGradeAllow);
  if (grade !== undefined) state.grade = grade;
  if (rubyEnabled !== undefined) state.rubyEnabled = rubyEnabled !== false;
}

export function setRenderGrade(grade) { state.grade = grade; }
export function getRenderGrade() { return state.grade; }

// 「{漢字|よみ}」を [{text}] / [{kanji, ruby}] のセグメント列に分解
export function parseRuby(str) {
  const segs = [];
  const re = /\{([^{}|]+)\|([^{}|]+)\}/g;
  let last = 0, m;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) segs.push({ text: str.slice(last, m.index) });
    segs.push({ kanji: m[1], ruby: m[2] });
    last = m.index + m[0].length;
  }
  if (last < str.length) segs.push({ text: str.slice(last) });
  return segs;
}

// このセグメントを漢字で見せてよいか（学年ルール・セグメント単位）
export function useKanji(kanji, grade = state.grade) {
  if (grade == null) return false;
  for (const c of kanji) {
    const g = state.kanjiGrades[c];
    if (!g || g > grade) return false;               // 配当外・上の学年 → かな
    if (grade <= 2 && !state.lowGradeAllow.has(c)) return false;  // 低学年は許可リストのみ
  }
  return true;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// HTML出力（<ruby>漢字<rt>よみ</rt></ruby>）。テキスト部はエスケープする
export function rubyHTML(str) {
  let out = '';
  for (const seg of parseRuby(String(str))) {
    if (seg.text !== undefined) { out += esc(seg.text); continue; }
    if (useKanji(seg.kanji)) {
      out += state.rubyEnabled
        ? `<ruby>${esc(seg.kanji)}<rt>${esc(seg.ruby)}</rt></ruby>`
        : esc(seg.kanji);
    } else {
      out += esc(seg.ruby);
    }
  }
  return out;
}

// プレーン文字列出力（alert/confirm・title 等タグが使えない場所用）
export function rubyPlain(str) {
  let out = '';
  for (const seg of parseRuby(String(str))) {
    out += seg.text !== undefined ? seg.text : (useKanji(seg.kanji) ? seg.kanji : seg.ruby);
  }
  return out;
}
