// texts.js — 子ども向けUI文言の集約（Phase 2）
// 全文言ひらがな（小1が読める）。禁止語: ×・ざんねん・まちがい・しっぱい。
// 1ファイルに集約する理由: 後で学年別に調整するため。
// ほごしゃ向け（バックアップ等）の文言だけは漢字まじりでよい。

'use strict';

export const TEXTS = {
  appName: 'じぶんじてん',

  home: {
    today: 'きょうの 5もじ',
    dict: 'じぶんじてん',
    progress: (n) => `おぼえた じ　${n}こ ／ 80こ`,
    progressZero: 'これから 80この じを おぼえるよ',
  },

  practice: {
    counter: (i, n) => `${i}もじめ ／ ${n}もじ`,
    watchTitle: 'よみかたと かきじゅんを みてね',
    watchAgain: 'もういっかい みる',
    write: 'かいてみる！',
    traceTitle: 'うすい じを なぞって かいてね',
    airTitle: 'こんどは なにも みないで かいてね',
    strokeOf: (i, n) => `${i}かくめ ／ ${n}かく`,
    good: 'できた！',
    close: (i) => `おしい！ ${i}かくめを もういっかい`,
    watchStroke: (i) => `${i}かくめは こう かくよ`,
    rescue: 'うすい じを だしたよ。なぞって かんせい させよう',
    next: 'つぎへ',
    finishOne: 'できた！ この じは じぶんじてんに のったよ',
    sessionDone: 'きょうの れんしゅう おわり！ よく がんばったね',
    backHome: 'ホームに もどる',
    quit: 'やめる',
  },

  dict: {
    title: 'じぶんじてん',
    count: (n) => `あつまった じ　${n}こ ／ 80こ`,
    back: 'もどる',
    notYet: 'まだ れんしゅう していないよ',
    first: 'はじめて',
    best: 'ベスト',
    latest: 'さいきん',
    replay: 'さいせい',
    close: 'とじる',
  },

  exam: {
    entry: '10きゅうレベル テスト',
    entryResume: 'テストの つづきから',
    counter: (i, n) => `${i}もんめ ／ ${n}もん`,
    yomiQ: 'あかい じの よみかたは どれ？',
    kakiQ: 'あかい ところの かんじを マスに かこう',
    kakusuuQ: 'この じは なんかくで かく？',
    kakusuuUnit: (n) => `${n}かく`,
    submit: 'できた',
    redo: 'かきなおす',
    quit: 'ちゅうだん',
    quitNote: 'とちゅうまでが のこるよ。またね',
    resultTitle: 'けっかはっぴょう',
    score: (s) => `${s}てん ／ 150てん`,
    passed: 'ごうかく！おめでとう！',
    perfect: 'まんてん！すごい！',
    failed: (d) => `あと ${d}てんで ごうかく。つぎは きっと できるよ`,
    reviewList: 'もういちど れんしゅうする じ',
    noReview: 'ぜんぶ せいかい！',
    reviewNote: '「きょうの5もじ」に さきに でてくるよ',
    backHome: 'ホームに もどる',
    best: (s) => `さいこうきろく ${s}てん`,
  },

  review: {
    why: 'なんでかな？',
    look: 'ここを みてみよう',
    order: 'こっちの じゅんばん',
    fewer: 'かくが たりないよ',
    more: 'かくが おおいよ',
    legend: 'あお＝おてほん　くろ＝じぶんの じ',
    rewrite: 'もういちど かく',
    done: 'できたね',
    answerIs: (a) => `こたえは 「${a}」`,
    close: 'とじる',
  },

  // ほごしゃ向け（設定隅・漢字可）
  backup: {
    summary: '保護者の方へ（データのバックアップ）',
    note: 'れんしゅうの記録はこの端末の中だけに保存されます。書き出したファイルは大切に保管してください。',
    export: 'JSONに書き出す',
    import: 'JSONを読み込む',
    importConfirm: '読み込むと、いまの記録をファイルの内容で置きかえます。よろしいですか？',
    importDone: (n) => `${n} 字ぶんの記録を読み込みました`,
    importError: '読み込めませんでした: ',
    empty: 'まだ記録がありません',
  },
};

// 読みの表示整形（KANJIDIC2 → 子ども向け）
// 訓: 送り仮名の区切り「.」を除き、接辞形「-〜」は落とす。多くても3つ
// 音: カタカナのまま。多くても2つ
export function formatReadings(readings) {
  const kun = readings.kun
    .filter(r => !r.startsWith('-') && !r.endsWith('-'))
    .map(r => r.replace(/\./g, ''))
    .slice(0, 3);
  const on = readings.on.slice(0, 2);
  return { kun, on };
}
