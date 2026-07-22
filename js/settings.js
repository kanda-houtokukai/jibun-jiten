// settings.js — 学年設定（R1）
// 保存先は store.js の meta ストア（キー追加のみ。DBのスキーマ版は上げない＝R1指示書§5-1）。
// 学年は「表示の基準」であって学習データの絞り込みではない。
// 学年を変えても書いた字・履歴には一切触れない（このモジュールは meta の1キーしか読み書きしない）。
//
// rubyEnabled: ルビON/OFFの器だけ先に切る（R1指示書§2-2）。UIは出さない。OFF対応はR5以降。

'use strict';

export const SETTINGS_KEY = 'settings';
export const GRADE_MIN = 1;
export const GRADE_MAX = 6;

// 純ロジック（DOM・IndexedDB非依存）。壊れた保存値が来ても安全な形に正規化する
export function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const grade = Number.isInteger(s.grade) && s.grade >= GRADE_MIN && s.grade <= GRADE_MAX
    ? s.grade
    : null;                                  // null = 未設定（初回選択画面を出す）
  return { grade, rubyEnabled: s.rubyEnabled !== false };  // 既定は常時ルビON
}

export async function loadSettings(store) {
  return normalizeSettings(await store.metaGet(SETTINGS_KEY));
}

export async function saveSettings(store, settings) {
  const s = normalizeSettings(settings);
  await store.metaSet(SETTINGS_KEY, s);
  return s;
}
