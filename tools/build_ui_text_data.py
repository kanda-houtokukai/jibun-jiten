#!/usr/bin/env python3
"""UI文言データ生成スクリプト（js/texts.js のマークアップ + KANJIDIC2 → data/ui-text.json）

R1②: UI文言（種類1）の学年別表示に使う「字→学年」表を機械生成し、
texts.js に書かれた読み（{漢字|よみ}）を KANJIDIC2 の音訓と照合して検証する。
学年別の文言表は作らない（正本は texts.js のマークアップ1本）。

使い方:
    python3 tools/build_ui_text_data.py            # 生成＋検証レポート
    python3 tools/build_ui_text_data.py --check    # 検証のみ（JSONを書かない）

前提: tools/vendor/kanjidic2.xml（リポジトリにはコミットしない）

出力: data/ui-text.json
    kanjiGrades  … UI文言に登場する字のうち小学配当(1..6)の {字: 学年}（実行時はこれだけ使う）
    audit        … 検証結果（機械確認済み/未確認の読み・配当外の字・低学年候補）

読みの照合ルール（音訓の合成）:
    各字の候補 = 音読み（ひらがな化）＋ 訓読みの語幹（「.」の前）
    非先頭要素は連濁（k→g, s→z, t→d, h→b/p）を許す
    非末尾要素は促音化（ち・つ・く・き → っ）を許す
    合成で読み全体が構成できれば「機械確認済み」、できなければ「未確認」→ Chat確認事項
"""

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
VENDOR = REPO / "tools" / "vendor"
TEXTS_JS = REPO / "js" / "texts.js"
OUT = REPO / "data" / "ui-text.json"

MARKUP_RE = re.compile(r"\{([^{}|]+)\|([^{}|]+)\}")
KANJI_RE = re.compile(r"[一-鿿]")

KATA_TO_HIRA = {chr(k): chr(k - 0x60) for k in range(0x30A1, 0x30F7)}

RENDAKU = {
    "か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご",
    "さ": "ざ", "し": "じ", "す": "ず", "せ": "ぜ", "そ": "ぞ",
    "た": "だ", "ち": "ぢ", "つ": "づ", "て": "で", "と": "ど",
    "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ",
}
HANDAKU = {"は": "ぱ", "ひ": "ぴ", "ふ": "ぷ", "へ": "ぺ", "ほ": "ぽ"}
SOKUON_TAIL = set("ちつくき")


def kata_to_hira(s: str) -> str:
    return "".join(KATA_TO_HIRA.get(c, c) for c in s)


def extract_segments():
    """texts.js から {漢字|よみ} セグメントを（重複を除いて）取り出す"""
    src = TEXTS_JS.read_text(encoding="utf-8")
    # コメント行（説明中の例）と backup ブロック（保護者向け・変換対象外）は対象外
    src = "\n".join(ln for ln in src.splitlines() if not ln.lstrip().startswith("//"))
    src = re.sub(r"backup:\s*\{.*?\n  \},", "", src, flags=re.S)
    segs = []
    seen = set()
    for m in MARKUP_RE.finditer(src):
        kanji, yomi = m.group(1), m.group(2)
        if (kanji, yomi) in seen:
            continue
        seen.add((kanji, yomi))
        segs.append({"kanji": kanji, "yomi": yomi})
    # マークアップ外に漢字が残っていないか（種類1の変換漏れ検出。ただしコメント行は除く）
    body_lines = [
        ln for ln in src.splitlines()
        if not ln.lstrip().startswith("//") and "'" in ln
    ]
    stray = set()
    for ln in body_lines:
        cleaned = MARKUP_RE.sub("", ln)
        # 文字列リテラル内だけを見る（雑にクォート内を抽出）
        for lit in re.findall(r"'([^']*)'|`([^`]*)`", cleaned):
            for part in lit:
                stray.update(KANJI_RE.findall(part))
    return segs, sorted(stray)


def parse_kanjidic2(targets: set):
    """KANJIDIC2 から対象字の {char: {grade, on, kun}} を返す"""
    result = {}
    for _, elem in ET.iterparse(VENDOR / "kanjidic2.xml", events=("end",)):
        if elem.tag != "character":
            continue
        literal = elem.findtext("literal")
        if literal in targets:
            grade_text = elem.findtext("misc/grade")
            on, kun = [], []
            for r in elem.iter("reading"):
                if r.get("r_type") == "ja_on":
                    on.append(r.text)
                elif r.get("r_type") == "ja_kun":
                    kun.append(r.text)
            result[literal] = {
                "grade": int(grade_text) if grade_text else None,
                "on": on, "kun": kun,
            }
        elem.clear()
        if len(result) == len(targets):
            break
    return result


def reading_candidates(info) -> set:
    """1字ぶんの読み候補（ひらがな・語幹）"""
    cands = set()
    for r in info["on"]:
        cands.add(kata_to_hira(r.replace("-", "")))
    for r in info["kun"]:
        stem = r.replace("-", "").split(".")[0]
        if stem:
            cands.add(stem)
        # 送り仮名込みの形も候補に（「はじ.めて」→はじめて 等）
        full = r.replace("-", "").replace(".", "")
        if full:
            cands.add(full)
    cands.discard("")
    return cands


def variants(cand: str, first: bool, last: bool) -> set:
    """連濁（非先頭）・促音化（非末尾）を展開した候補"""
    out = {cand}
    if not first and cand:
        head = cand[0]
        if head in RENDAKU:
            out.add(RENDAKU[head] + cand[1:])
        if head in HANDAKU:
            out.add(HANDAKU[head] + cand[1:])
    more = set()
    if not last:
        for c in out:
            if c and c[-1] in SOKUON_TAIL and len(c) >= 2:
                more.add(c[:-1] + "っ")
    return out | more


def compose_ok(kanji: str, yomi: str, dic: dict) -> bool:
    """音訓の合成で yomi 全体が構成できるか（DFS）"""
    chars = list(kanji)
    n = len(chars)

    def dfs(idx: int, rest: str) -> bool:
        if idx == n:
            return rest == ""
        info = dic.get(chars[idx])
        if not info:
            return False
        for cand in reading_candidates(info):
            for v in variants(cand, first=(idx == 0), last=(idx == n - 1)):
                if rest.startswith(v) and dfs(idx + 1, rest[len(v):]):
                    return True
        return False

    return dfs(0, yomi)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="検証のみ（JSONを書かない）")
    args = ap.parse_args()

    segs, stray = extract_segments()
    all_chars = sorted({c for s in segs for c in KANJI_RE.findall(s["kanji"])})
    dic = parse_kanjidic2(set(all_chars))

    missing = [c for c in all_chars if c not in dic]
    if missing:
        print(f"NG KANJIDIC2 に無い字: {missing}")
        sys.exit(1)

    kanji_grades = {c: dic[c]["grade"] for c in all_chars
                    if dic[c]["grade"] and 1 <= dic[c]["grade"] <= 6}
    beyond = [c for c in all_chars if c not in kanji_grades]

    confirmed, unconfirmed = [], []
    for s in segs:
        entry = {"kanji": s["kanji"], "yomi": s["yomi"]}
        if compose_ok(s["kanji"], s["yomi"], dic):
            confirmed.append(entry)
        else:
            entry["candidates"] = {
                c: sorted(reading_candidates(dic[c])) for c in KANJI_RE.findall(s["kanji"])
            }
            unconfirmed.append(entry)

    # 低学年（1〜2年）許可リスト候補: 語の全字が2年以下のセグメント
    low_candidates = []
    for s in segs:
        chars = KANJI_RE.findall(s["kanji"])
        grades = [kanji_grades.get(c) for c in chars]
        if all(g is not None and g <= 2 for g in grades):
            low_candidates.append({
                "kanji": s["kanji"], "yomi": s["yomi"],
                "grades": {c: kanji_grades[c] for c in chars},
            })

    audit = {
        "confirmedCount": len(confirmed),
        "unconfirmedReadings": unconfirmed,   # ⚠️Chat確認事項（機械で読みを確定できない）
        "beyondElementary": beyond,           # 小学配当外 → 全学年で常にひらがな表示
        "lowGradeCandidates": low_candidates, # ⚠️低学年の漢字許可リスト候補（採否はChat）
        "strayKanjiOutsideMarkup": stray,     # マークアップ外の漢字（変換漏れ検出・0が正）
    }

    report = {
        "schemaVersion": 1,
        "source": {
            "texts": "js/texts.js の {漢字|よみ} マークアップ",
            "kanjidic2": "KANJIDIC2 (c) EDRDG, CC BY-SA 4.0, https://www.edrdg.org/",
            "generator": "tools/build_ui_text_data.py",
        },
        "kanjiGrades": kanji_grades,
        "audit": audit,
    }

    print(f"セグメント: {len(segs)} / 使用字: {len(all_chars)}")
    print(f"  読みの機械確認: 済 {len(confirmed)} ／ 未確認 {len(unconfirmed)}")
    for e in unconfirmed:
        print(f"    未確認: {e['kanji']}＝{e['yomi']}")
    print(f"  小学配当外（常にひらがな）: {''.join(beyond) or 'なし'}")
    print(f"  低学年許可リスト候補: {len(low_candidates)} 語")
    for e in low_candidates:
        gs = "・".join(f"{c}({g})" for c, g in e["grades"].items())
        print(f"    {e['kanji']}（{e['yomi']}）… {gs}")
    if stray:
        print(f"  ⚠️マークアップ外の漢字（変換漏れ？）: {''.join(stray)}")

    if args.check:
        print("（--check: JSON は書き出さない）")
        return
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"OK 書き出し: {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
