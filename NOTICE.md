# NOTICE — データ出典とライセンス

本リポジトリの `data/` 配下の JSON は、以下の外部データから生成した派生データです。
生成スクリプトは `tools/build_kanji_data.py`。

## KanjiVG

- 出典: KanjiVG（https://kanjivg.tagaini.net ／ GitHub: https://github.com/KanjiVG/kanjivg）
- 使用バージョン: リリース r20250816（kanjivg-20250816-main.zip）
- 著作権: Copyright (C) 2009/2010/2011 Ulrich Apel.
- ライセンス: Creative Commons Attribution-Share Alike 3.0（CC BY-SA 3.0）
  https://creativecommons.org/licenses/by-sa/3.0/
- 原文（SVGファイル冒頭のヘッダより・2026-07-19取得時に確認）:
  > Copyright (C) 2009/2010/2011 Ulrich Apel.
  > This work is distributed under the conditions of the Creative Commons
  > Attribution-Share Alike 3.0 Licence.
- 本リポジトリでの利用: 各字の筆順ストローク（SVG path・画種 kvg:type）を
  `data/kanji-g*.json` の `strokes` に取り込んでいる。この派生データは
  同じ CC BY-SA 3.0 の条件で公開する。

## KANJIDIC2

- 出典: The Electronic Dictionary Research and Development Group (EDRDG)
  https://www.edrdg.org/wiki/index.php/KANJIDIC_Project
- 使用バージョン: kanjidic2.xml database_version 2026-199（date_of_creation 2026-07-18）
- 著作権: James William Breen および The Electronic Dictionary Research and
  Development Group
- ライセンス: Creative Commons Attribution-ShareAlike Licence (V4.0)（CC BY-SA 4.0）
  https://creativecommons.org/licenses/by-sa/4.0/
- 根拠（EDRDG Licence Statement https://www.edrdg.org/edrdg/licence.html ・
  2026-07-19取得時に確認）:
  > The dictionary files are made available under a Creative Commons
  > Attribution-ShareAlike Licence (V4.0).
- 本リポジトリでの利用: 読み（音・訓）・画数・部首番号（classical）を
  `data/kanji-g*.json` に取り込んでいる。この派生データは CC BY-SA 4.0 の
  条件で公開する。

## 本リポジトリの派生データについて

`data/` 配下の JSON を再利用する場合は、上記それぞれのライセンス条件
（帰属表示・同一条件での共有）に従ってください。
