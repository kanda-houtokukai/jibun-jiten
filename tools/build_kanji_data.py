#!/usr/bin/env python3
"""字テーブル生成スクリプト（KanjiVG + KANJIDIC2 → data/kanji-g{N}.json）

再現可能性が本体: 1026字への拡張時も同じスクリプトを学年別の字リストで再実行する。
手作業で JSON を書かない。

使い方:
    python3 tools/build_kanji_data.py --grade 1 --chars tools/grade1-chars.txt

前提（tools/vendor/ に取得済みであること。リポジトリにはコミットしない）:
    - tools/vendor/kanji/           KanjiVG リリースの SVG 群（r20250816 main）
    - tools/vendor/kanjidic2.xml    EDRDG KANJIDIC2

機械チェック（1つでも落ちたら JSON を出力せず終了コード1）:
    1. 字リストが期待字数（学年ごとの配当字数）と一致し重複がない
    2. 全字に KanjiVG ファイルが存在する
    3. KANJIDIC2 の grade が指定学年と一致する（配当表との食い違い検出）
    4. strokeCount（KANJIDIC2 第1値）と KanjiVG のストローク数が一致する
    5. readings（音・訓の合計）が空でない
"""

import argparse
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
VENDOR = REPO / "tools" / "vendor"
KVG_NS = "{http://kanjivg.tagaini.net}"

# 学年→級・配当字数（決定事項リスト§5: 学年と級は1:1）
GRADE_TO_LEVEL = {1: 10, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5}
GRADE_CHAR_COUNT = {1: 80, 2: 160, 3: 200, 4: 202, 5: 193, 6: 191}


def load_chars(path: Path, grade: int, errors: list) -> list:
    chars = list(path.read_text(encoding="utf-8").strip())
    expected = GRADE_CHAR_COUNT[grade]
    if len(chars) != expected:
        errors.append(f"字リストが{len(chars)}字（期待: {expected}字）")
    if len(set(chars)) != len(chars):
        dup = sorted({c for c in chars if chars.count(c) > 1})
        errors.append(f"字リストに重複: {dup}")
    return chars


def parse_kanjivg(char: str, errors: list):
    """KanjiVG SVG から筆順どおりの [{type, path}] を返す"""
    fname = f"{ord(char):05x}.svg"
    svg_path = VENDOR / "kanji" / fname
    if not svg_path.exists():
        errors.append(f"{char}: KanjiVG ファイルなし ({fname})")
        return None
    root = ET.parse(svg_path).getroot()
    strokes = []
    # StrokePaths グループ配下の path を文書順に（文書順＝筆順が KanjiVG の仕様）
    for g in root.iter("{http://www.w3.org/2000/svg}g"):
        gid = g.get("id", "")
        if gid.startswith("kvg:StrokePaths_"):
            for p in g.iter("{http://www.w3.org/2000/svg}path"):
                strokes.append({
                    "type": p.get(f"{KVG_NS}type", ""),
                    "path": p.get("d", ""),
                })
            break
    if not strokes:
        errors.append(f"{char}: KanjiVG からストロークを抽出できない ({fname})")
        return None
    return strokes


def parse_kanjidic2(targets: set):
    """KANJIDIC2 から対象字の {char: {grade, strokeCount, radicalClassical, on, kun}} を返す"""
    result = {}
    # 15MB超のXMLなので iterparse で逐次処理
    for _, elem in ET.iterparse(VENDOR / "kanjidic2.xml", events=("end",)):
        if elem.tag != "character":
            continue
        literal = elem.findtext("literal")
        if literal in targets:
            misc = elem.find("misc")
            rad = None
            for rv in elem.findall("radical/rad_value"):
                if rv.get("rad_type") == "classical":
                    rad = int(rv.text)
                    break
            on, kun = [], []
            rm = elem.find("reading_meaning")
            if rm is not None:
                for r in rm.iter("reading"):
                    if r.get("r_type") == "ja_on":
                        on.append(r.text)
                    elif r.get("r_type") == "ja_kun":
                        kun.append(r.text)
            result[literal] = {
                "grade": int(misc.findtext("grade") or -1),
                "strokeCount": int(misc.findtext("stroke_count")),  # 第1値が正
                "radicalClassical": rad,
                "on": on,
                "kun": kun,
            }
        elem.clear()
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--grade", type=int, required=True, choices=sorted(GRADE_TO_LEVEL))
    ap.add_argument("--chars", type=Path, required=True)
    args = ap.parse_args()

    errors = []
    chars = load_chars(args.chars, args.grade, errors)
    dic = parse_kanjidic2(set(chars))

    records = []
    for char in chars:
        strokes = parse_kanjivg(char, errors)
        info = dic.get(char)
        if info is None:
            errors.append(f"{char}: KANJIDIC2 に見つからない")
            continue
        if info["grade"] != args.grade:
            errors.append(f"{char}: KANJIDIC2 の学年が {info['grade']}（期待: {args.grade}）→ 配当表との食い違いの可能性。停止して報告")
        if strokes is not None and info["strokeCount"] != len(strokes):
            errors.append(f"{char}: 画数不一致 KANJIDIC2={info['strokeCount']} KanjiVG={len(strokes)}")
        if not info["on"] and not info["kun"]:
            errors.append(f"{char}: 読みが空")
        records.append({
            "char": char,
            "grade": args.grade,
            "kenLevel": GRADE_TO_LEVEL[args.grade],
            "strokeCount": info["strokeCount"],
            "radical": {"classical": info["radicalClassical"]},
            "readings": {"on": info["on"], "kun": info["kun"]},
            "strokes": strokes or [],
        })

    if errors:
        print(f"機械チェック失敗（{len(errors)}件）:", file=sys.stderr)
        for e in errors:
            print(" -", e, file=sys.stderr)
        sys.exit(1)

    out = REPO / "data" / f"kanji-g{args.grade}.json"
    out.parent.mkdir(exist_ok=True)
    payload = {
        "schemaVersion": 1,
        "grade": args.grade,
        "kenLevel": GRADE_TO_LEVEL[args.grade],
        "sources": {
            "kanjivg": "KanjiVG r20250816 (c) Ulrich Apel, CC BY-SA 3.0, http://kanjivg.tagaini.net",
            "kanjidic2": "KANJIDIC2 (c) EDRDG, CC BY-SA 4.0, https://www.edrdg.org/",
        },
        "kanji": records,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK: {out.relative_to(REPO)} に {len(records)} 字を出力（機械チェック全通過）")


if __name__ == "__main__":
    main()
