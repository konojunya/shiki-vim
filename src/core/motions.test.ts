import { describe, it, expect } from "vitest";
import { TextBuffer } from "./buffer";
import {
  motionH,
  motionL,
  motionJ,
  motionK,
  motionW,
  motionE,
  motionB,
  motionZero,
  motionCaret,
  motionDollar,
  motionGG,
  motionG,
  motionFChar,
  motionFCharBack,
  motionTChar,
  motionTCharBack,
  motionMatchBracket,
} from "./motions";

// ヘルパー: 複数行文字列からTextBufferを生成する
function buf(lines: string[]): TextBuffer {
  return new TextBuffer(lines.join("\n"));
}

// カーソル位置の簡易生成ヘルパー
function cur(line: number, col: number) {
  return { line, col };
}

// ---------- motionH ----------

describe("motionH: 左移動", () => {
  it("カーソルをcount分だけ左に移動する", () => {
    const b = buf(["hello"]);
    const result = motionH(cur(0, 3), b, 1);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("count=2で2文字左に移動する", () => {
    const b = buf(["hello"]);
    const result = motionH(cur(0, 4), b, 2);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("列0でクランプされる", () => {
    const b = buf(["hello"]);
    const result = motionH(cur(0, 1), b, 5);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("既に列0の場合は移動しない", () => {
    const b = buf(["hello"]);
    const result = motionH(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("rangeが正しく設定される（linewise=false, inclusive=false）", () => {
    const b = buf(["hello"]);
    const result = motionH(cur(0, 3), b, 1);
    expect(result.range.start).toEqual(cur(0, 2));
    expect(result.range.end).toEqual(cur(0, 3));
    expect(result.range.linewise).toBe(false);
    expect(result.range.inclusive).toBe(false);
  });
});

// ---------- motionL ----------

describe("motionL: 右移動", () => {
  it("カーソルをcount分だけ右に移動する", () => {
    const b = buf(["hello"]);
    const result = motionL(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 1));
  });

  it("count=3で3文字右に移動する", () => {
    const b = buf(["hello"]);
    const result = motionL(cur(0, 0), b, 3);
    expect(result.cursor).toEqual(cur(0, 3));
  });

  it("行末でクランプされる", () => {
    const b = buf(["hello"]);
    // "hello"は長さ5、最大col=4
    const result = motionL(cur(0, 3), b, 10);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("既に行末の場合は移動しない", () => {
    const b = buf(["hi"]);
    const result = motionL(cur(0, 1), b, 1);
    expect(result.cursor).toEqual(cur(0, 1));
  });

  it("rangeが正しく設定される（linewise=false, inclusive=true）", () => {
    const b = buf(["hello"]);
    const result = motionL(cur(0, 1), b, 2);
    expect(result.range.start).toEqual(cur(0, 1));
    expect(result.range.end).toEqual(cur(0, 3));
    expect(result.range.linewise).toBe(false);
    expect(result.range.inclusive).toBe(true);
  });

  it("空行ではcol=0にクランプされる", () => {
    const b = buf([""]);
    const result = motionL(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });
});

// ---------- motionJ ----------

describe("motionJ: 下移動", () => {
  it("1行下に移動する", () => {
    const b = buf(["hello", "world"]);
    const result = motionJ(cur(0, 2), b, 1);
    expect(result.cursor).toEqual(cur(1, 2));
  });

  it("短い行に移動するとcolがクランプされる", () => {
    const b = buf(["hello world", "hi"]);
    const result = motionJ(cur(0, 8), b, 1);
    expect(result.cursor).toEqual(cur(1, 1));
  });

  it("最終行を超えない", () => {
    const b = buf(["aaa", "bbb"]);
    const result = motionJ(cur(0, 0), b, 10);
    expect(result.cursor.line).toBe(1);
  });

  it("rangeはlinewise=trueで返される", () => {
    const b = buf(["aaa", "bbb"]);
    const result = motionJ(cur(0, 0), b, 1);
    expect(result.range.linewise).toBe(true);
    expect(result.range.inclusive).toBe(true);
  });

  it("空行への移動でcolが0になる", () => {
    const b = buf(["hello", ""]);
    const result = motionJ(cur(0, 3), b, 1);
    expect(result.cursor).toEqual(cur(1, 0));
  });
});

// ---------- motionK ----------

describe("motionK: 上移動", () => {
  it("1行上に移動する", () => {
    const b = buf(["hello", "world"]);
    const result = motionK(cur(1, 2), b, 1);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("短い行に移動するとcolがクランプされる", () => {
    const b = buf(["hi", "hello world"]);
    const result = motionK(cur(1, 8), b, 1);
    expect(result.cursor).toEqual(cur(0, 1));
  });

  it("先頭行を超えない", () => {
    const b = buf(["aaa", "bbb"]);
    const result = motionK(cur(1, 0), b, 10);
    expect(result.cursor.line).toBe(0);
  });

  it("rangeはlinewise=trueで返される", () => {
    const b = buf(["aaa", "bbb"]);
    const result = motionK(cur(1, 0), b, 1);
    expect(result.range.linewise).toBe(true);
    expect(result.range.inclusive).toBe(true);
    expect(result.range.start).toEqual(cur(0, 0));
    expect(result.range.end).toEqual(cur(1, 0));
  });

  it("既に先頭行にいる場合は移動しない", () => {
    const b = buf(["hello"]);
    const result = motionK(cur(0, 2), b, 1);
    expect(result.cursor).toEqual(cur(0, 2));
  });
});

// ---------- motionW ----------

describe("motionW: 単語前方移動", () => {
  it("次の単語の先頭に移動する", () => {
    const b = buf(["hello world"]);
    const result = motionW(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 6));
  });

  it("句読点を別の単語として扱う", () => {
    const b = buf(["foo.bar"]);
    const result = motionW(cur(0, 0), b, 1);
    // "foo"の後の"."が次の単語
    expect(result.cursor).toEqual(cur(0, 3));
  });

  it("句読点から単語文字への移動", () => {
    const b = buf(["foo.bar"]);
    const result = motionW(cur(0, 3), b, 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("count=2で2単語先に移動する", () => {
    const b = buf(["one two three"]);
    const result = motionW(cur(0, 0), b, 2);
    expect(result.cursor).toEqual(cur(0, 8));
  });

  it("行末から次の行に移動する", () => {
    const b = buf(["hello", "world"]);
    const result = motionW(cur(0, 0), b, 2);
    expect(result.cursor).toEqual(cur(1, 0));
  });

  it("空行を越えて移動する", () => {
    // 2w: hello → 空行(1w) → world(2w)
    const b = buf(["hello", "", "world"]);
    const result = motionW(cur(0, 0), b, 2);
    expect(result.cursor).toEqual(cur(2, 0));
  });

  it("rangeはlinewise=false, inclusive=falseで返される", () => {
    const b = buf(["hello world"]);
    const result = motionW(cur(0, 0), b, 1);
    expect(result.range.linewise).toBe(false);
    expect(result.range.inclusive).toBe(false);
  });

  it("最終行の最終単語では移動しない", () => {
    const b = buf(["hello"]);
    const result = motionW(cur(0, 0), b, 5);
    // 最終行でこれ以上進めない場合
    expect(result.cursor.line).toBe(0);
  });
});

// ---------- motionE ----------

describe("motionE: 単語末尾移動", () => {
  it("現在の単語の末尾に移動する", () => {
    const b = buf(["hello world"]);
    const result = motionE(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("既に単語末尾にいる場合は次の単語の末尾に移動する", () => {
    const b = buf(["hello world"]);
    const result = motionE(cur(0, 4), b, 1);
    expect(result.cursor).toEqual(cur(0, 10));
  });

  it("句読点を別の単語として扱う", () => {
    const b = buf(["foo..bar"]);
    const result = motionE(cur(0, 0), b, 1);
    // "foo"の末尾
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("句読点グループの末尾に移動する", () => {
    const b = buf(["foo..bar"]);
    const result = motionE(cur(0, 2), b, 1);
    // ".."の末尾
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("行を越えて移動する", () => {
    const b = buf(["hello", "world"]);
    const result = motionE(cur(0, 4), b, 1);
    expect(result.cursor).toEqual(cur(1, 4));
  });

  it("rangeはinclusive=trueで返される", () => {
    const b = buf(["hello world"]);
    const result = motionE(cur(0, 0), b, 1);
    expect(result.range.inclusive).toBe(true);
    expect(result.range.linewise).toBe(false);
  });

  it("count=2で2つ先の単語末尾に移動する", () => {
    const b = buf(["one two three"]);
    const result = motionE(cur(0, 0), b, 2);
    expect(result.cursor).toEqual(cur(0, 6));
  });
});

// ---------- motionB ----------

describe("motionB: 単語後方移動", () => {
  it("前の単語の先頭に移動する", () => {
    const b = buf(["hello world"]);
    const result = motionB(cur(0, 8), b, 1);
    expect(result.cursor).toEqual(cur(0, 6));
  });

  it("単語先頭にいる場合はさらに前の単語に移動する", () => {
    const b = buf(["hello world"]);
    const result = motionB(cur(0, 6), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("句読点を別の単語として扱う", () => {
    const b = buf(["foo.bar"]);
    const result = motionB(cur(0, 4), b, 1);
    expect(result.cursor).toEqual(cur(0, 3));
  });

  it("行を越えて後方移動する", () => {
    const b = buf(["hello", "world"]);
    const result = motionB(cur(1, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("count=2で2単語戻る", () => {
    const b = buf(["one two three"]);
    const result = motionB(cur(0, 10), b, 2);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("先頭を超えない", () => {
    const b = buf(["hello"]);
    const result = motionB(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("rangeが正しく設定される", () => {
    const b = buf(["hello world"]);
    const result = motionB(cur(0, 8), b, 1);
    expect(result.range.start).toEqual(cur(0, 6));
    expect(result.range.end).toEqual(cur(0, 8));
    expect(result.range.linewise).toBe(false);
    expect(result.range.inclusive).toBe(false);
  });
});

// ---------- motionZero ----------

describe("motionZero: 行頭移動（0）", () => {
  it("列0に移動する", () => {
    const b = buf(["  hello"]);
    const result = motionZero(cur(0, 5), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("既に列0の場合は変わらない", () => {
    const b = buf(["hello"]);
    const result = motionZero(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("rangeが正しく設定される", () => {
    const b = buf(["hello"]);
    const result = motionZero(cur(0, 3), b, 1);
    expect(result.range.start).toEqual(cur(0, 0));
    expect(result.range.end).toEqual(cur(0, 3));
    expect(result.range.linewise).toBe(false);
    expect(result.range.inclusive).toBe(false);
  });
});

// ---------- motionCaret ----------

describe("motionCaret: 最初の非空白文字移動（^）", () => {
  it("最初の非空白文字に移動する", () => {
    const b = buf(["  hello"]);
    const result = motionCaret(cur(0, 5), b, 1);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("タブ混じりの行でも正しく動作する", () => {
    const b = buf(["\t\thello"]);
    const result = motionCaret(cur(0, 5), b, 1);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("先頭に空白がない行では列0に移動する", () => {
    const b = buf(["hello"]);
    const result = motionCaret(cur(0, 3), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("カーソルが非空白文字より前にある場合のrange", () => {
    const b = buf(["  hello"]);
    const result = motionCaret(cur(0, 0), b, 1);
    // カーソル(col=0) < 非空白(col=2) なので start=cursor, end=newCursor
    expect(result.range.start).toEqual(cur(0, 0));
    expect(result.range.end).toEqual(cur(0, 2));
    expect(result.range.inclusive).toBe(true);
  });

  it("カーソルが非空白文字より後にある場合のrange", () => {
    const b = buf(["  hello"]);
    const result = motionCaret(cur(0, 5), b, 1);
    expect(result.range.start).toEqual(cur(0, 2));
    expect(result.range.end).toEqual(cur(0, 5));
  });

  it("空行では列0に移動する", () => {
    const b = buf([""]);
    const result = motionCaret(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });
});

// ---------- motionDollar ----------

describe("motionDollar: 行末移動（$）", () => {
  it("行の最後の文字に移動する", () => {
    const b = buf(["hello"]);
    const result = motionDollar(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("既に行末にいる場合は変わらない", () => {
    const b = buf(["hello"]);
    const result = motionDollar(cur(0, 4), b, 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("空行ではcol=0になる", () => {
    const b = buf([""]);
    const result = motionDollar(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("rangeのendはlineLength（排他的終端）", () => {
    const b = buf(["hello"]);
    const result = motionDollar(cur(0, 1), b, 1);
    expect(result.range.start).toEqual(cur(0, 1));
    expect(result.range.end).toEqual(cur(0, 5));
    expect(result.range.inclusive).toBe(true);
  });

  it("1文字の行でcol=0になる", () => {
    const b = buf(["a"]);
    const result = motionDollar(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });
});

// ---------- motionGG ----------

describe("motionGG: ファイル先頭移動（gg）", () => {
  it("countなしで最初の行に移動する", () => {
    const b = buf(["  first", "second", "third"]);
    const result = motionGG(cur(2, 3), b, null);
    expect(result.cursor.line).toBe(0);
  });

  it("最初の非空白文字に移動する", () => {
    const b = buf(["  first", "second"]);
    const result = motionGG(cur(1, 0), b, null);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("countを指定するとその行に移動する（1ベース）", () => {
    const b = buf(["line1", "line2", "line3"]);
    const result = motionGG(cur(0, 0), b, 2);
    expect(result.cursor.line).toBe(1);
  });

  it("count指定時もfirstNonBlankが使われる", () => {
    const b = buf(["line1", "  line2", "line3"]);
    const result = motionGG(cur(0, 0), b, 2);
    expect(result.cursor).toEqual(cur(1, 2));
  });

  it("countが行数を超える場合はクランプされる", () => {
    const b = buf(["a", "b"]);
    const result = motionGG(cur(0, 0), b, 100);
    expect(result.cursor.line).toBe(1);
  });

  it("rangeはlinewise=trueで返される", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionGG(cur(2, 0), b, null);
    expect(result.range.linewise).toBe(true);
    expect(result.range.inclusive).toBe(true);
  });

  it("上方向に移動する場合のrangeのstart/end", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionGG(cur(2, 0), b, null);
    expect(result.range.start.line).toBe(0);
    expect(result.range.end.line).toBe(2);
  });
});

// ---------- motionG ----------

describe("motionG: ファイル末尾移動（G）", () => {
  it("countなしで最後の行に移動する", () => {
    const b = buf(["first", "second", "  third"]);
    const result = motionG(cur(0, 0), b, null);
    expect(result.cursor.line).toBe(2);
  });

  it("最後の行のfirstNonBlankに移動する", () => {
    const b = buf(["first", "  last"]);
    const result = motionG(cur(0, 0), b, null);
    expect(result.cursor).toEqual(cur(1, 2));
  });

  it("countを指定するとその行に移動する（1ベース）", () => {
    const b = buf(["line1", "line2", "line3"]);
    const result = motionG(cur(2, 0), b, 1);
    expect(result.cursor.line).toBe(0);
  });

  it("countが行数を超える場合はクランプされる", () => {
    const b = buf(["a", "b"]);
    const result = motionG(cur(0, 0), b, 100);
    expect(result.cursor.line).toBe(1);
  });

  it("rangeはlinewise=trueで返される", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionG(cur(0, 0), b, null);
    expect(result.range.linewise).toBe(true);
    expect(result.range.inclusive).toBe(true);
  });

  it("下方向に移動する場合のrangeのstart/end", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionG(cur(0, 0), b, null);
    expect(result.range.start.line).toBe(0);
    expect(result.range.end.line).toBe(2);
  });

  it("上方向に移動する場合のrangeのstart/end", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionG(cur(2, 0), b, 1);
    expect(result.range.start.line).toBe(0);
    expect(result.range.end.line).toBe(2);
  });
});

// ---------- motionFChar ----------

describe("motionFChar: 文字検索前方（f）", () => {
  it("指定文字を前方検索して移動する", () => {
    const b = buf(["hello world"]);
    const result = motionFChar(cur(0, 0), b, "o", 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("count=2で2番目の出現位置に移動する", () => {
    const b = buf(["hello world"]);
    const result = motionFChar(cur(0, 0), b, "l", 2);
    expect(result.cursor).toEqual(cur(0, 3));
  });

  it("見つからない場合はカーソルが動かない", () => {
    const b = buf(["hello"]);
    const result = motionFChar(cur(0, 0), b, "z", 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("rangeはinclusive=trueで返される", () => {
    const b = buf(["hello"]);
    const result = motionFChar(cur(0, 0), b, "l", 1);
    expect(result.range.inclusive).toBe(true);
    expect(result.range.linewise).toBe(false);
  });

  it("カーソル位置の文字はスキップされる", () => {
    const b = buf(["aaa"]);
    const result = motionFChar(cur(0, 0), b, "a", 1);
    expect(result.cursor).toEqual(cur(0, 1));
  });
});

// ---------- motionFCharBack ----------

describe("motionFCharBack: 文字検索後方（F）", () => {
  it("指定文字を後方検索して移動する", () => {
    const b = buf(["hello world"]);
    const result = motionFCharBack(cur(0, 10), b, "o", 1);
    expect(result.cursor).toEqual(cur(0, 7));
  });

  it("count=2で2番目の出現位置に移動する", () => {
    const b = buf(["hello world"]);
    const result = motionFCharBack(cur(0, 10), b, "l", 2);
    expect(result.cursor).toEqual(cur(0, 3));
  });

  it("見つからない場合はカーソルが動かない", () => {
    const b = buf(["hello"]);
    const result = motionFCharBack(cur(0, 4), b, "z", 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("rangeが正しく設定される", () => {
    const b = buf(["hello"]);
    const result = motionFCharBack(cur(0, 4), b, "e", 1);
    expect(result.range.start).toEqual(cur(0, 1));
    expect(result.range.end).toEqual(cur(0, 4));
    expect(result.range.inclusive).toBe(true);
  });
});

// ---------- motionTChar ----------

describe("motionTChar: 文字検索前方（手前で停止、t）", () => {
  it("指定文字の1つ手前に移動する", () => {
    const b = buf(["hello world"]);
    const result = motionTChar(cur(0, 0), b, "o", 1);
    expect(result.cursor).toEqual(cur(0, 3));
  });

  it("count=2で2番目の出現位置の手前に移動する", () => {
    const b = buf(["abcabc"]);
    const result = motionTChar(cur(0, 0), b, "c", 2);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("見つからない場合はカーソルが動かない", () => {
    const b = buf(["hello"]);
    const result = motionTChar(cur(0, 0), b, "z", 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("rangeのendは移動後のカーソル位置", () => {
    const b = buf(["hello"]);
    const result = motionTChar(cur(0, 0), b, "l", 1);
    expect(result.range.end).toEqual(cur(0, 1));
  });
});

// ---------- motionTCharBack ----------

describe("motionTCharBack: 文字検索後方（手前で停止、T）", () => {
  it("指定文字の1つ後ろに移動する", () => {
    const b = buf(["hello world"]);
    const result = motionTCharBack(cur(0, 10), b, "o", 1);
    expect(result.cursor).toEqual(cur(0, 8));
  });

  it("count=2で2番目の出現位置の後ろに移動する", () => {
    const b = buf(["abcabc"]);
    const result = motionTCharBack(cur(0, 5), b, "a", 2);
    expect(result.cursor).toEqual(cur(0, 1));
  });

  it("見つからない場合はカーソルが動かない", () => {
    const b = buf(["hello"]);
    const result = motionTCharBack(cur(0, 4), b, "z", 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("rangeのstartは移動後のカーソル位置", () => {
    const b = buf(["hello"]);
    const result = motionTCharBack(cur(0, 4), b, "e", 1);
    expect(result.range.start).toEqual(cur(0, 2));
  });
});

// ---------- motionMatchBracket ----------

describe("motionMatchBracket: 対応括弧移動（%）", () => {
  // 丸括弧のマッチ
  it("開き丸括弧から対応する閉じ丸括弧に移動する", () => {
    const b = buf(["(hello)"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 6));
  });

  it("閉じ丸括弧から対応する開き丸括弧に移動する", () => {
    const b = buf(["(hello)"]);
    const result = motionMatchBracket(cur(0, 6), b, 0);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // 角括弧のマッチ
  it("開き角括弧から対応する閉じ角括弧に移動する", () => {
    const b = buf(["[hello]"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 6));
  });

  it("閉じ角括弧から対応する開き角括弧に移動する", () => {
    const b = buf(["[hello]"]);
    const result = motionMatchBracket(cur(0, 6), b, 0);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // 波括弧のマッチ
  it("開き波括弧から対応する閉じ波括弧に移動する", () => {
    const b = buf(["{hello}"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 6));
  });

  it("閉じ波括弧から対応する開き波括弧に移動する", () => {
    const b = buf(["{hello}"]);
    const result = motionMatchBracket(cur(0, 6), b, 0);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // ネストされた括弧
  it("ネストされた括弧を正しくマッチする", () => {
    const b = buf(["((inner))"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 8));
  });

  it("内側のネストされた括弧をマッチする", () => {
    const b = buf(["((inner))"]);
    const result = motionMatchBracket(cur(0, 1), b, 0);
    expect(result.cursor).toEqual(cur(0, 7));
  });

  // 複数行にまたがる括弧
  it("複数行にまたがる括弧をマッチする", () => {
    const b = buf(["function {", "  body", "}"]);
    const result = motionMatchBracket(cur(0, 9), b, 0);
    expect(result.cursor).toEqual(cur(2, 0));
  });

  it("複数行の閉じ括弧から開き括弧に移動する", () => {
    const b = buf(["function {", "  body", "}"]);
    const result = motionMatchBracket(cur(2, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 9));
  });

  // カーソルが括弧でない場合
  it("カーソルが括弧でない場合は行内で最初の括弧を探す", () => {
    const b = buf(["hello (world)"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 12));
  });

  it("行に括弧がない場合はカーソルが動かない", () => {
    const b = buf(["hello world"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // マッチが見つからない場合
  it("対応する括弧がない場合はカーソルが動かない", () => {
    const b = buf(["(hello"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("rangeはinclusive=true, linewise=falseで返される", () => {
    const b = buf(["(hello)"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.range.inclusive).toBe(true);
    expect(result.range.linewise).toBe(false);
  });

  // 異なる種類の括弧が混在
  it("異なる種類の括弧が混在しても正しくマッチする", () => {
    const b = buf(["([{hello}])"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 10));
  });

  it("混在する括弧の内側のマッチ", () => {
    const b = buf(["([{hello}])"]);
    const result = motionMatchBracket(cur(0, 2), b, 0);
    expect(result.cursor).toEqual(cur(0, 8));
  });
});

// ---------- エッジケース ----------

describe("エッジケース", () => {
  // 空行に対するモーション
  it("motionH: 空行では移動しない", () => {
    const b = buf([""]);
    const result = motionH(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionL: 空行では移動しない", () => {
    const b = buf([""]);
    const result = motionL(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionDollar: 空行ではcol=0のまま", () => {
    const b = buf([""]);
    const result = motionDollar(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // 1文字の行
  it("motionH: 1文字の行でcol=0にクランプ", () => {
    const b = buf(["a"]);
    const result = motionH(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionL: 1文字の行でcol=0にクランプ", () => {
    const b = buf(["a"]);
    const result = motionL(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // 境界でのJ/K
  it("motionJ: 最終行では移動しない", () => {
    const b = buf(["only"]);
    const result = motionJ(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionK: 先頭行では移動しない", () => {
    const b = buf(["only"]);
    const result = motionK(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // 単一文字行でのW/E/B
  it("motionW: 1文字の行から次の行に移動する", () => {
    const b = buf(["a", "b"]);
    const result = motionW(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(1, 0));
  });

  it("motionE: 1文字の行で次の行の末尾に移動する", () => {
    const b = buf(["a", "bc"]);
    const result = motionE(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(1, 1));
  });

  it("motionB: 1文字の行で前の行に移動する", () => {
    const b = buf(["abc", "d"]);
    const result = motionB(cur(1, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // 空行が含まれるバッファでのGG/G
  it("motionGG: 空行を含むバッファでの移動", () => {
    const b = buf(["", "hello", ""]);
    const result = motionGG(cur(1, 3), b, null);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionG: 空行を含むバッファで最終行（空行）へ移動", () => {
    const b = buf(["hello", ""]);
    const result = motionG(cur(0, 0), b, null);
    expect(result.cursor).toEqual(cur(1, 0));
  });

  // fChar系の境界
  it("motionFChar: 行末での検索は動かない", () => {
    const b = buf(["abc"]);
    const result = motionFChar(cur(0, 2), b, "x", 1);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("motionFCharBack: 行頭での検索は動かない", () => {
    const b = buf(["abc"]);
    const result = motionFCharBack(cur(0, 0), b, "x", 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // matchBracket: 空行
  it("motionMatchBracket: 空行では動かない", () => {
    const b = buf([""]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // 大きいcount値
  it("motionJ: 大きなcount値でも最終行にクランプされる", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionJ(cur(0, 0), b, 999);
    expect(result.cursor.line).toBe(2);
  });

  it("motionK: 大きなcount値でも先頭行にクランプされる", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionK(cur(2, 0), b, 999);
    expect(result.cursor.line).toBe(0);
  });

  // 空白のみの行
  it("motionCaret: 空白のみの行ではcol=0", () => {
    const b = buf(["   "]);
    const result = motionCaret(cur(0, 2), b, 1);
    // \Sにマッチしないので0が返る
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // motionW: 複数空白を跨ぐ
  it("motionW: 連続空白を跨いで次の単語に移動する", () => {
    const b = buf(["hello    world"]);
    const result = motionW(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 9));
  });
});
