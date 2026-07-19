// store.js — 筆跡保存（Phase 2）
// 3枚ルール: 1字につき { first, best, latest } のみ保持（容量が増え続けない）。
//   first  = 最初の合格作。以後不変
//   best   = 全画平均スコアが最高の合格作（同点は先取＝既存を維持）
//   latest = 最新の合格作。合格のたび更新
// 保存が起きるのは「そらがき合格」時のみ（じぶん字典に載る=自力で書けた証明）。
//
// 純ロジック（applyPass / serializeExport / parseImport）は DOM・IndexedDB 非依存で
// Node の自己テストから検証できる。IndexedDB 層（openStore）はブラウザ専用。
//
// ⚠️ schemaVersion を変える・既存データの形を変える改修は必ず停止して確認し、
//    マイグレーションを同梱すること（CLAUDE.md 準拠）。

'use strict';

export const SCHEMA_VERSION = 1;
export const APP_ID = 'jibun-jiten';

// ---- 純ロジック ----

// 座標を4桁に丸める（保存容量の抑制。1字3枚でも数KB台に収まる）
export function roundStrokes(strokes) {
  const r = v => Math.round(v * 10000) / 10000;
  return strokes.map(s => s.map(p => ({ x: r(p.x), y: r(p.y) })));
}

// attempt = { strokes(0..1正規化の座標列の配列), score(全画平均), at(epoch ms) }
export function applyPass(entry, attempt) {
  const a = { strokes: roundStrokes(attempt.strokes), score: attempt.score, at: attempt.at };
  if (!entry) return { first: a, best: a, latest: a };
  return {
    first: entry.first,                                   // 以後不変
    best: a.score > entry.best.score ? a : entry.best,    // 同点は既存維持
    latest: a,                                            // 常に更新
  };
}

export function serializeExport(entriesMap, exportedAt) {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    entries: entriesMap,
  };
}

function isAttempt(a) {
  return a && Array.isArray(a.strokes) && typeof a.score === 'number' && typeof a.at === 'number'
    && a.strokes.every(s => Array.isArray(s) && s.every(p => typeof p.x === 'number' && typeof p.y === 'number'));
}

// バックアップJSONの検証。不正なら Error を投げる。返り値は entries マップ
export function parseImport(obj) {
  if (!obj || obj.app !== APP_ID) throw new Error('このアプリのバックアップではありません');
  if (obj.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`対応していないバージョンです (schemaVersion=${obj.schemaVersion})`);
  }
  if (!obj.entries || typeof obj.entries !== 'object') throw new Error('entries がありません');
  for (const [char, e] of Object.entries(obj.entries)) {
    if (!isAttempt(e.first) || !isAttempt(e.best) || !isAttempt(e.latest)) {
      throw new Error(`「${char}」のデータが壊れています`);
    }
  }
  return obj.entries;
}

// ---- IndexedDB 層（ブラウザ専用）----

const DB_NAME = 'jibun-jiten';
const STORE = 'kanji'; // key = 字, value = { first, best, latest }
const META = 'meta';   // key-value（テスト進行状態・履歴・復習キュー）
const DB_VERSION = 2;  // v2: meta ストア追加（既存 kanji には触れない追加のみ）

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn, storeName = STORE) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const req = fn(store);
    // 未保存キーの get は result=undefined。リクエスト自体を返さないこと
    t.oncomplete = () => resolve(req && typeof req === 'object' && 'result' in req ? req.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export async function openStore() {
  const db = await idb();
  return {
    async get(char) {
      return tx(db, 'readonly', s => s.get(char));
    },
    async getAll() {
      // {char: entry} のマップで返す
      return new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readonly');
        const s = t.objectStore(STORE);
        const map = {};
        const cur = s.openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { map[c.key] = c.value; c.continue(); }
          else resolve(map);
        };
        cur.onerror = () => reject(cur.error);
      });
    },
    async count() {
      return tx(db, 'readonly', s => s.count());
    },
    // そらがき合格時に呼ぶ。3枚ルールを適用して保存し、更新後 entry を返す
    async recordPass(char, attempt) {
      const cur = await this.get(char);
      const next = applyPass(cur || null, attempt);
      await tx(db, 'readwrite', s => s.put(next, char));
      return next;
    },
    async exportJson(exportedAt) {
      return serializeExport(await this.getAll(), exportedAt);
    },
    // ---- meta（テスト進行状態・履歴・復習キューなどの小物置き場）----
    async metaGet(key) {
      return tx(db, 'readonly', s => s.get(key), META);
    },
    async metaSet(key, value) {
      await tx(db, 'readwrite', s => s.put(value, key), META);
    },
    async metaDelete(key) {
      await tx(db, 'readwrite', s => s.delete(key), META);
    },
    // バックアップからの復元（全置換）。呼び出し側で確認を取ってから使う
    async importJson(obj) {
      const entries = parseImport(obj);
      await tx(db, 'readwrite', s => {
        s.clear();
        for (const [char, e] of Object.entries(entries)) s.put(e, char);
        return {};
      });
      return Object.keys(entries).length;
    },
  };
}
