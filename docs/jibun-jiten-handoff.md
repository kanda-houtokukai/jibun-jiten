# じぶん字典 台帳（handoff）

最終更新: 2026-07-18（初期化）

---

## ═══ 現在地サマリ ═══（毎セッション冒頭にここだけ読む）

### 今どこ
- **Phase 1b 合格（2026-07-19 実機検証OK）**。照合エンジンv1（js/matcher.js）としきい値は初期設定値のまま暫定確定
- 本番稼働中: 書き味プロトタイプ index.html(v0.2) ／ 80字ビューア viewer.html(v0.1) ／ 調整ページ match-test.html(v0.1) ／ data/kanji-g1.json（確定データ）
- 次は **Phase 2（おぼえる＋じぶん字典）**。指示書あり（docs/jibun-jiten-phase2-指示書.md）。ここで初の子ども向け製品画面・署名機能が形になる

### 直近の決定（詳細と理由は決定事項リスト＝正本）
- [DECISION] 芯 =「書いた字を捨てない」（じぶん字典 / 成長リプレイ / にがて印刷）
- [DECISION] Web(PWA)先行・GitHub Pages・IndexedDB＋JSONバックアップ・完全無料広告なし
- [DECISION] 判定は照合型（KanjiVG）。筆順画数＝厳格 / 字形とめはね＝寛容
- [DECISION] データは3層＋関係。級は構成漢字の最大学年から計算（人力級付けゼロ）
- [DECISION] 3本柱（おぼえる/ためす/もどってくる）以外は作らない。外付けごほうび禁止

### 次の一手
0. ~~GitHub名義~~／~~タスク0~~／~~Phase 0~~／~~Phase 1a~~／~~Phase 1b 照合エンジンv1~~（合格）
1. **Phase 2 着手（おぼえる＋じぶん字典・Fable 5 推奨）**。指示書: docs/jibun-jiten-phase2-指示書.md
2. 未解決のまま: 学年配当読みへの絞り込み（現状は KANJIDIC2 全読み）

### 生きている注意
- GitHub名義は現状維持で確定（将来リネーム可）。もう論点ではない
- 「漢検」は登録商標。名称・UI文言に使わない
- KanjiVG = CC BY-SA 3.0。派生データ公開＋クレジット ⚠️公開前に原文最終確認
- 部首は漢検要覧準拠が採点基準 → データ入手未解決（Phase 4ブロッカー）
- 例文・熟語は自前生成（既存問題集の流用は著作権NG）
- ★Phase 0の教訓: iOSは低電力時にrAFを抑制する → 表示ロジックをrAF依存にしない。この設計方針はPhase 1以降も踏襲する
- 読みは KANJIDIC2 の全読みを収録中。「小1で習う読み」への絞り込みは未解決（Phase 2 以降で扱う）
- KANJIDIC2 のライセンスは CC BY-SA **4.0**（3.0ではない。原文確認済み・NOTICE.md に転記済み）
- **しきい値は大人の書きで暫定確定**（distNorm:20 / dirWeight:0.35 / passScore:60 / floorScore:35 / maxCloseStrokes:2）。子どもの実書きで再調整余地あり

### ファイルの地図（正本）
| ファイル | 役割 |
|---|---|
| jibun-jiten-決定事項リスト.md | 全決定の正本（種） |
| jibun-jiten-handoff.md | この台帳（引き継ぎの入口は常にここ1本） |
| jibun-jiten-phase0-指示書.md | Phase 0 の Code 向け指示書（完了） |
| jibun-jiten-phase1a-指示書.md | Phase 1a の Code 向け指示書（検収済み） |
| jibun-jiten-phase1b-指示書.md | Phase 1b の Code 向け指示書 |
| CLAUDE.md | Code が自動で読む案件ルール（リポジトリ直下） |
| data/kanji-g1.json | 10級80字の確定データ（承認なし編集禁止） |
| tools/build_kanji_data.py | 字テーブル生成スクリプト（1026字拡張時に再実行） |
| viewer.html / index.html | 検収用80字ビューア ／ 書き味プロトタイプ |
| NOTICE.md | データ出典・ライセンス表記（KanjiVG 3.0 / KANJIDIC2 4.0） |

---

## ═══ 経緯アーカイブ ═══（必要なときだけ読む）

### 2026-07-18 初回設計セッション（Chat）
- 漢検公式サイトで級体系・合格基準・出題分野・採点基準を裏取り。学年＝級の1:1を骨格に採用
- 手書き技術調査: iPad Safari は 240Hz pointermove 取得可 / canvas desynchronized 有効。getCoalescedEvents 未対応・iPadOS Scribble の干渉報告あり → 議論でなく Phase 0 の実測で判定する方針に
- 競合調査: 「小学生手書き漢字ドリル1026」（テンポ＋ごほうび演出＋広告/課金）、「ひとコマ漢字」（漫画ごほうび・ペン解放）等。**全アプリが書いた字を使い捨てにしている**ことを確認 → ここを芯に
- ★級は振らず計算で出す（語の学年＝構成漢字の最大学年）。データ整備工数が一桁変わる
- ★Fable 5 昇格は設計段階では見送り（この設計の難所は賢さでなく網羅性で、出題分野は協会が公式に列挙済み）。昇格予定は Phase 1 の一括構造化
- ★署名機能の成立により Phase 0 の位置づけが「入力性能の確認」から「署名機能の生命線」に格上げ
- パーキング（未決アイデア・実装しない約束ではない）: 誤答由来のひっかけ選択肢 / 配慮版（UDフォント・読み上げ） / Capacitorアプリ化 / 賞状PDF

### 2026-07-18 Phase 0（書き味プロトタイプ）
- Code(Fable 5セッション)がタスク0（リポジトリ初期化）→タスク1（index.html 1枚）を実施。実機検証で合格 → **Web続行で確定・Flutter棚下ろし**
- 公開URL: https://kanda-houtokukai.github.io/jibun-jiten/ （v0.2稼働）
- 実装知見: ①計測表示をrAF依存にせずイベント駆動+100msスロットルへ（iOS低電力時のrAF抑制対策）②画面高さを考慮したマスサイズ（横向き時の見切れ修正）
- モデル運用: 本来Opus 4.8想定の小規模実装だったが、タスク0で文脈が温まったFable 5セッションを切らずに走り切る判断（乗り換えコスト＞Fable 5での1枚実装コスト）。Phase 1からOpus 4.8に戻す

### 2026-07-19 Phase 1a（データ基盤）
- スキーマ確定・data/kanji-g1.json（80字）・viewer.html・NOTICE.md を同一Fable 5セッションで実装 → 実機検証OK（右=ノ先・左=一先を含む）
- ソース: KanjiVG r20250816 ＋ KANJIDIC2 database_version 2026-199（原本は tools/vendor/ でgitignore・リポジトリ非コミット）
- ★KANJIDIC2 の学年フィールドが全80字で小1と一致 → 配当表の独立裏付けになった（この照合はスクリプトの機械チェックとして設置済み。1026字拡張時も自動で効く）
- ★KANJIDIC2 は CC BY-SA 4.0（3.0と混同しない）。取得日付きで NOTICE.md に原文転記
- ファイル形式: レコードは指示書スキーマどおり＋ファイル全体を { schemaVersion, grade, sources, kanji } の封筒で包む（出典同梱・将来のスキーマ移行検出用・Chat事後承認）
- ★筆順アニメの実装知見: stroke-dasharray/dashoffset 方式は round cap だと未描画ストロークの始点に点が出る → 開始まで visibility:hidden にする。transition 開始前に強制リフローを1回入れる

### 2026-07-19 Phase 1b（照合エンジンv1）
- js/matcher.js（DOM非依存・純JS）＋ match-test.html（調整ページ）＋ 自己テスト8/8 → 実機検証OK・しきい値は初期値で暫定確定
- ★模範リサンプリングは実行時変換を採用（24点/画・109座標系）。ビルド時生成だと1026字で+2MB前後になるため。パスは M/C/c/S/s のみで純JS処理可
- 方式: 画単位・筆順どおり比較。平均距離＋始点→終点方向余弦の重み付き合成0-100 → ○/おしい(対象画特定)/×/画数過不足
- 自己テスト: 模範自身=全字○ / 先頭2画交換の検出79/79字 / 画数過不足の検出OK（node tools/selftest_matcher.mjs）
