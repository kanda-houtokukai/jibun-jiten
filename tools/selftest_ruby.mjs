// selftest_ruby.mjs — ルビ機構（js/ruby.js）の純ロジック自己テスト
// 実行: node tools/selftest_ruby.mjs
// ⚠️ Node ではUI表示は検証できない。表示・保存まわりはブラウザ実走を必須とする（台帳の教訓）

import { configureRuby, setRenderGrade, parseRuby, useKanji, rubyHTML, rubyPlain }
  from '../js/ruby.js';

let ok = 0, ng = 0;
function t(name, cond) {
  if (cond) { ok++; console.log(`  ok  ${name}`); }
  else { ng++; console.log(`  NG  ${name}`); }
}

// テスト用の学年表（実データの部分集合）
configureRuby({
  kanjiGrades: { '書': 2, '字': 1, '練': 3, '習': 3, '典': 4, '戻': undefined, '級': 3 },
  lowGradeAllow: [],
  grade: null,
});

console.log('テスト1: パース');
{
  const segs = parseRuby('{書|か}いた {字|じ}を');
  t('セグメント数と内容', segs.length === 4
    && segs[0].kanji === '書' && segs[0].ruby === 'か'
    && segs[1].text === 'いた ' && segs[2].kanji === '字' && segs[2].ruby === 'じ'
    && segs[3].text === 'を');
  const segs2 = parseRuby('マークアップなし');
  t('マークアップなしは素通し', segs2.length === 1 && segs2[0].text === 'マークアップなし');
}

console.log('テスト2: 学年ルール');
{
  t('学年未設定 → かな', rubyPlain('{書|か}く') === 'かく');
  setRenderGrade(3);
  t('3年生: 2年の字 → 漢字', rubyPlain('{書|か}く') === '書く');
  t('3年生: 4年の字 → かな', rubyPlain('じぶん{字典|じてん}') === 'じぶんじてん');
  t('3年生: 熟語は語単位（練習=3年+3年 → 漢字）', rubyPlain('{練習|れんしゅう}') === '練習');
  setRenderGrade(4);
  t('4年生: 字典（1年+4年）→ 漢字', rubyPlain('じぶん{字典|じてん}') === 'じぶん字典');
  t('配当外の字（戻）は常にかな', rubyPlain('{戻|もど}る') === 'もどる');
  setRenderGrade(2);
  t('低学年: 許可リスト空 → すべてかな', rubyPlain('{書|か}く {字|じ}') === 'かく じ');
  configureRuby({ lowGradeAllow: ['字'] });
  t('低学年: 許可リストの字だけ漢字', rubyPlain('{書|か}く {字|じ}') === 'かく 字');
  t('useKanji が許可リストを見る', useKanji('字') === true && useKanji('書') === false);
  configureRuby({ lowGradeAllow: [] });
}

console.log('テスト3: HTML出力');
{
  setRenderGrade(3);
  t('ルビ付きHTML', rubyHTML('{書|か}く') === '<ruby>書<rt>か</rt></ruby>く');
  t('かな側はタグなし', rubyHTML('{典|てん}') === 'てん');
  t('テキストはエスケープ', rubyHTML('<b>&{書|か}') === '&lt;b&gt;&amp;<ruby>書<rt>か</rt></ruby>');
  configureRuby({ rubyEnabled: false });
  t('rubyEnabled=false → 漢字のみ', rubyHTML('{書|か}く') === '書く');
  configureRuby({ rubyEnabled: true });
}

console.log(`\n結果: ${ok} ok / ${ng} NG`);
process.exit(ng ? 1 : 0);
