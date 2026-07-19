#!/usr/bin/env node
// store.js 純ロジックの自己テスト（Phase 2 タスク1）
// 実行: node tools/selftest_store.mjs

import {
  SCHEMA_VERSION, applyPass, serializeExport, parseImport, roundStrokes,
} from '../js/store.js';

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (detail ? '  → ' + detail : '')); }
}

const mkAttempt = (score, at, x = 0.1) => ({
  strokes: [[{ x, y: 0.2 }, { x: x + 0.3, y: 0.5 }], [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }]],
  score, at,
});

console.log('テスト1: 3枚ルール');
{
  const a1 = mkAttempt(70, 1000, 0.11);
  const e1 = applyPass(null, a1);
  check('初合格で first=best=latest',
    e1.first.score === 70 && e1.best.score === 70 && e1.latest.score === 70);

  const a2 = mkAttempt(85, 2000, 0.22); // より高スコア
  const e2 = applyPass(e1, a2);
  check('first は不変', e2.first.at === 1000 && e2.first.score === 70);
  check('高スコアで best 更新', e2.best.score === 85 && e2.best.at === 2000);
  check('latest は常に更新', e2.latest.at === 2000);

  const a3 = mkAttempt(60, 3000, 0.33); // 低スコア
  const e3 = applyPass(e2, a3);
  check('低スコアでは best 据え置き', e3.best.score === 85 && e3.best.at === 2000);
  check('latest は低スコアでも更新', e3.latest.score === 60 && e3.latest.at === 3000);

  const a4 = mkAttempt(85, 4000, 0.44); // 同点
  const e4 = applyPass(e3, a4);
  check('同点は先取（best 据え置き）', e4.best.at === 2000);

  const strokes = [[{ x: 0.123456789, y: 0.987654321 }]];
  const r = roundStrokes(strokes);
  check('座標は4桁丸め', r[0][0].x === 0.1235 && r[0][0].y === 0.9877);
}

console.log('テスト2: export/import 往復一致');
{
  const entries = {
    '右': applyPass(null, mkAttempt(88, 1111)),
    '左': applyPass(applyPass(null, mkAttempt(70, 1000)), mkAttempt(90, 2000)),
  };
  const exported = serializeExport(entries, 9999);
  const roundTrip = parseImport(JSON.parse(JSON.stringify(exported)));
  check('往復で entries が一致', JSON.stringify(roundTrip) === JSON.stringify(entries));
  check('exportedAt / schemaVersion を含む',
    exported.exportedAt === 9999 && exported.schemaVersion === SCHEMA_VERSION);
}

console.log('テスト3: import 検証');
{
  const throws = (fn) => { try { fn(); return false; } catch { return true; } };
  check('別アプリのJSONを拒否', throws(() => parseImport({ app: 'other', schemaVersion: 1, entries: {} })));
  check('未対応 schemaVersion を拒否', throws(() => parseImport({ app: 'jibun-jiten', schemaVersion: 99, entries: {} })));
  check('壊れた entry を拒否', throws(() => parseImport({
    app: 'jibun-jiten', schemaVersion: 1,
    entries: { '右': { first: { strokes: 'x' }, best: null, latest: null } },
  })));
  check('正常JSONは通る', !throws(() => parseImport({
    app: 'jibun-jiten', schemaVersion: 1,
    entries: { '右': applyPass(null, mkAttempt(80, 1)) },
  })));
}

console.log(`\n結果: ${pass} ok / ${fail} NG`);
process.exit(fail ? 1 : 0);
