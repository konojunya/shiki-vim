/**
 * normal-mode.test.ts
 *
 * ノーマルモードの統合テスト。
 * processKeystroke を通して、カウント・オペレーター・モーション・
 * モード遷移・編集コマンドなどの動作を網羅的に検証する。
 */

import { describe, it, expect } from "vitest";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "./vim-state";
import { TextBuffer } from "./buffer";

// =====================
// ヘルパー関数
// =====================

/** テスト用のVimContextを生成する */
function createTestContext(
  cursor: CursorPosition,
  overrides?: Partial<VimContext>,
): VimContext {
  return {
    ...createInitialContext(cursor),
    ...overrides,
  };
}

/** 複数キーを順番に処理し、最終的な状態を返す */
function pressKeys(
  keys: string[],
  ctx: VimContext,
  buffer: TextBuffer,
): { ctx: VimContext; allActions: import("../types").VimAction[] } {
  let current = ctx;
  const allActions: import("../types").VimAction[] = [];
  for (const key of keys) {
    const result = processKeystroke(key, current, buffer);
    current = result.newCtx;
    allActions.push(...result.actions);
  }
  return { ctx: current, allActions };
}

// =====================
// テスト本体
// =====================

describe("ノーマルモード", () => {
  // ---------------------------------------------------
  // カウントプレフィックス
  // ---------------------------------------------------
  describe("カウントプレフィックス", () => {
    it("3j で3行下に移動する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4\nline5");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["3", "j"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 3, col: 0 });
    });

    it("5k で5行上に移動する（行数が足りない場合はクランプ）", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 2, col: 0 });
      const { ctx: result } = pressKeys(["5", "k"], ctx, buffer);
      expect(result.cursor.line).toBe(0);
    });

    it("2l で2列右に移動する", () => {
      const buffer = new TextBuffer("abcdef");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["2", "l"], ctx, buffer);
      expect(result.cursor.col).toBe(2);
    });

    it("5w で5単語先に移動する", () => {
      const buffer = new TextBuffer("one two three four five six seven");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["5", "w"], ctx, buffer);
      // 5w: one→two→three→four→five→six の先頭
      expect(result.cursor.col).toBe(24);
    });

    it("カウント 0 は行頭移動として解釈される（カウント未入力時）", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["0"], ctx, buffer);
      expect(result.cursor.col).toBe(0);
    });

    it("10j のような2桁カウントを正しく処理する", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join(
        "\n",
      );
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["1", "0", "j"], ctx, buffer);
      expect(result.cursor.line).toBe(10);
    });
  });

  // ---------------------------------------------------
  // オペレーター + モーション
  // ---------------------------------------------------
  describe("オペレーター + モーション", () => {
    it("dw で1単語を削除する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["d", "w"], ctx, buffer);
      expect(buffer.getContent()).toBe("world");
      expect(result.cursor.col).toBe(0);
    });

    it("d$ で行末まで削除する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["d", "$"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(4);
    });

    it("d0 で行頭まで削除する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      pressKeys(["d", "0"], ctx, buffer);
      expect(buffer.getContent()).toBe(" world");
    });

    it("dG でカーソル行からファイル末尾まで削除する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 1, col: 0 });
      pressKeys(["d", "G"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1");
    });

    it("dgg でカーソル行からファイル先頭まで削除する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 2, col: 0 });
      pressKeys(["d", "g", "g"], ctx, buffer);
      expect(buffer.getContent()).toBe("line4");
    });

    it("yw で1単語をヤンクする（バッファは変更されない）", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["y", "w"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(result.register).toBe("hello ");
    });

    it("cw で1単語を変更してインサートモードに入る", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["c", "w"], ctx, buffer);
      expect(buffer.getContent()).toBe("world");
      expect(result.mode).toBe("insert");
    });
  });

  // ---------------------------------------------------
  // ダブルオペレーター（行単位操作）
  // ---------------------------------------------------
  describe("ダブルオペレーター（dd, yy, cc）", () => {
    it("dd で現在行を削除する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["d", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline3");
      expect(result.register).toBe("line2\n");
      expect(result.cursor.line).toBe(1);
    });

    it("yy で現在行をヤンクする（バッファは変更されない）", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["y", "y"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.register).toBe("line2\n");
    });

    it("cc で現在行をクリアしてインサートモードに入る", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["c", "c"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.register).toBe("line2\n");
      // ccは行を削除して空行を挿入する
      expect(buffer.getLine(1)).toBe("");
    });
  });

  // ---------------------------------------------------
  // カウント + オペレーター
  // ---------------------------------------------------
  describe("カウント + オペレーター", () => {
    it("3dd で3行を削除する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4\nline5");
      const ctx = createTestContext({ line: 1, col: 0 });
      pressKeys(["3", "d", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline5");
    });

    it("2yy で2行をヤンクする", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["2", "y", "y"], ctx, buffer);
      expect(result.register).toBe("line1\nline2\n");
      expect(buffer.getContent()).toBe("line1\nline2\nline3\nline4");
    });

    it("2dd で最終行付近でもクランプされる", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 2, col: 0 });
      pressKeys(["2", "d", "d"], ctx, buffer);
      // 行2からは1行しかないのでline3のみ削除
      expect(buffer.getContent()).toBe("line1\nline2");
    });
  });

  // ---------------------------------------------------
  // x（文字削除）
  // ---------------------------------------------------
  describe("x コマンド（文字削除）", () => {
    it("x でカーソル下の文字を削除する", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["x"], ctx, buffer);
      expect(buffer.getContent()).toBe("ello");
      expect(result.register).toBe("h");
    });

    it("行末で x を押すとカーソルが調整される", () => {
      const buffer = new TextBuffer("abc");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["x"], ctx, buffer);
      expect(buffer.getContent()).toBe("ab");
      expect(result.cursor.col).toBe(1);
    });

    it("空行で x を押しても何も起きない", () => {
      const buffer = new TextBuffer("");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["x"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
      expect(result.cursor.col).toBe(0);
    });

    it("3x で3文字を削除する", () => {
      const buffer = new TextBuffer("abcdef");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["3", "x"], ctx, buffer);
      expect(buffer.getContent()).toBe("def");
    });
  });

  // ---------------------------------------------------
  // p / P（ペースト）
  // ---------------------------------------------------
  describe("p / P コマンド（ペースト）", () => {
    it("p で文字単位のペーストをカーソルの後に行う", () => {
      const buffer = new TextBuffer("hllo");
      const ctx = createTestContext({ line: 0, col: 0 }, { register: "e" });
      const { ctx: result } = pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(1);
    });

    it("P で文字単位のペーストをカーソルの前に行う", () => {
      const buffer = new TextBuffer("hllo");
      const ctx = createTestContext({ line: 0, col: 1 }, { register: "e" });
      const { ctx: result } = pressKeys(["P"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(1);
    });

    it("p で行単位のペーストを次の行に行う", () => {
      const buffer = new TextBuffer("line1\nline3");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { register: "line2\n" },
      );
      const { ctx: result } = pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("P で行単位のペーストを現在行の上に行う", () => {
      const buffer = new TextBuffer("line1\nline3");
      const ctx = createTestContext(
        { line: 1, col: 0 },
        { register: "line2\n" },
      );
      const { ctx: result } = pressKeys(["P"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("レジスタが空の場合 p は何もしない", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { register: "" });
      pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
    });
  });

  // ---------------------------------------------------
  // u（undo）
  // ---------------------------------------------------
  describe("u コマンド（undo）", () => {
    it("u で直前の変更を元に戻す", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      // まず dd で行を削除
      const { ctx: afterDelete } = pressKeys(["d", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
      // undo
      const { ctx: afterUndo } = pressKeys(["u"], afterDelete, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(afterUndo.cursor).toEqual({ line: 0, col: 0 });
    });

    it("undo スタックが空のときにメッセージを表示する", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result, allActions } = pressKeys(["u"], ctx, buffer);
      expect(result.statusMessage).toBe("Already at oldest change");
      expect(allActions).toContainEqual({
        type: "status-message",
        message: "Already at oldest change",
      });
    });
  });

  // ---------------------------------------------------
  // モード遷移（インサートモードへ）
  // ---------------------------------------------------
  describe("インサートモードへの遷移", () => {
    it("i でインサートモードに入る（カーソル位置そのまま）", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["i"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor.col).toBe(2);
    });

    it("a でカーソルを1つ右に移動してインサートモードに入る", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["a"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor.col).toBe(3);
    });

    it("I で行の最初の非空白文字に移動してインサートモードに入る", () => {
      const buffer = new TextBuffer("  hello");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["I"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor.col).toBe(2);
    });

    it("A で行末に移動してインサートモードに入る", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["A"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor.col).toBe(5);
    });

    it("o で次の行に空行を挿入してインサートモードに入る", () => {
      const buffer = new TextBuffer("line1\nline2");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["o"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
      expect(buffer.getContent()).toBe("line1\n\nline2");
    });

    it("O で現在行の上に空行を挿入してインサートモードに入る", () => {
      const buffer = new TextBuffer("line1\nline2");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["O"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
      expect(buffer.getContent()).toBe("line1\n\nline2");
    });
  });

  // ---------------------------------------------------
  // v / V（ビジュアルモードへの遷移）
  // ---------------------------------------------------
  describe("ビジュアルモードへの遷移", () => {
    it("v でビジュアルモードに入る", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["v"], ctx, buffer);
      expect(result.mode).toBe("visual");
      expect(result.visualAnchor).toEqual({ line: 0, col: 2 });
    });

    it("V でビジュアルラインモードに入る", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["V"], ctx, buffer);
      expect(result.mode).toBe("visual-line");
      expect(result.visualAnchor).toEqual({ line: 0, col: 0 });
    });
  });

  // ---------------------------------------------------
  // J（行結合）
  // ---------------------------------------------------
  describe("J コマンド（行結合）", () => {
    it("J で現在行と次の行をスペースで結合する", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["J"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(result.cursor.col).toBe(5);
    });

    it("J で次の行の先頭空白を除去して結合する", () => {
      const buffer = new TextBuffer("hello\n  world");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["J"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
    });

    it("最終行で J を押しても何も起きない", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 1, col: 0 });
      pressKeys(["J"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello\nworld");
    });
  });

  // ---------------------------------------------------
  // g プレフィックス（gg）
  // ---------------------------------------------------
  describe("g プレフィックスコマンド", () => {
    it("gg でファイル先頭に移動する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 2, col: 3 });
      const { ctx: result } = pressKeys(["g", "g"], ctx, buffer);
      expect(result.cursor.line).toBe(0);
    });

    it("3gg で3行目に移動する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["3", "g", "g"], ctx, buffer);
      expect(result.cursor.line).toBe(2);
    });

    it("G でファイル末尾に移動する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["G"], ctx, buffer);
      expect(result.cursor.line).toBe(2);
    });

    it("未知の g コマンドはリセットされる", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["g", "x"], ctx, buffer);
      expect(result.phase).toBe("idle");
    });
  });

  // ---------------------------------------------------
  // f / F / t / T（文字検索）
  // ---------------------------------------------------
  describe("f / F / t / T コマンド（行内文字検索）", () => {
    it("fo でカーソルを 'o' の位置に移動する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["f", "o"], ctx, buffer);
      expect(result.cursor.col).toBe(4);
    });

    it("Fo で後方に 'o' を検索する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 7 });
      const { ctx: result } = pressKeys(["F", "o"], ctx, buffer);
      expect(result.cursor.col).toBe(4);
    });

    it("to で 'o' の手前に移動する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["t", "o"], ctx, buffer);
      expect(result.cursor.col).toBe(3);
    });

    it("To で後方に 'o' の次の位置に移動する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 7 });
      const { ctx: result } = pressKeys(["T", "o"], ctx, buffer);
      expect(result.cursor.col).toBe(5);
    });
  });

  // ---------------------------------------------------
  // r（1文字置換）
  // ---------------------------------------------------
  describe("r コマンド（1文字置換）", () => {
    it("rx でカーソル下の文字を 'x' に置換する", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["r", "x"], ctx, buffer);
      expect(buffer.getContent()).toBe("xello");
    });

    it("空行で r を押しても何も起きない", () => {
      const buffer = new TextBuffer("");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["r", "x"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
    });
  });

  // ---------------------------------------------------
  // n / N（検索繰り返し）
  // ---------------------------------------------------
  describe("n / N コマンド（検索繰り返し）", () => {
    it("n で前方検索を繰り返す", () => {
      const buffer = new TextBuffer("foo bar foo baz foo");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { lastSearch: "foo", searchDirection: "forward" },
      );
      const { ctx: result } = pressKeys(["n"], ctx, buffer);
      expect(result.cursor.col).toBe(8);
    });

    it("N で検索方向を反転する", () => {
      const buffer = new TextBuffer("foo bar foo baz foo");
      const ctx = createTestContext(
        { line: 0, col: 8 },
        { lastSearch: "foo", searchDirection: "forward" },
      );
      const { ctx: result } = pressKeys(["N"], ctx, buffer);
      expect(result.cursor.col).toBe(0);
    });

    it("lastSearch が空のとき n は何もしない", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { lastSearch: "" });
      const { ctx: result } = pressKeys(["n"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 0, col: 0 });
    });

    it("パターンが見つからない場合ステータスメッセージを表示する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { lastSearch: "xyz", searchDirection: "forward" },
      );
      const { ctx: result } = pressKeys(["n"], ctx, buffer);
      expect(result.statusMessage).toBe("Pattern not found: xyz");
    });
  });

  // ---------------------------------------------------
  // コマンドライン / 検索モードへの遷移
  // ---------------------------------------------------
  describe("コマンドライン / 検索への遷移", () => {
    it(": でコマンドラインモードに入る", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys([":"], ctx, buffer);
      expect(result.mode).toBe("command-line");
      expect(result.commandType).toBe(":");
    });

    it("/ で前方検索モードに入る", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["/"], ctx, buffer);
      expect(result.mode).toBe("command-line");
      expect(result.commandType).toBe("/");
      expect(result.searchDirection).toBe("forward");
    });

    it("? で後方検索モードに入る", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["?"], ctx, buffer);
      expect(result.mode).toBe("command-line");
      expect(result.commandType).toBe("?");
      expect(result.searchDirection).toBe("backward");
    });
  });

  // ---------------------------------------------------
  // Ctrl キーコンビネーション
  // ---------------------------------------------------
  describe("Ctrl キーコンビネーション", () => {
    it("Ctrl-R でリドゥする", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      // dd → undo → redo
      const { ctx: afterDd } = pressKeys(["d", "d"], ctx, buffer);
      const { ctx: afterUndo } = pressKeys(["u"], afterDd, buffer);
      expect(buffer.getContent()).toBe("hello");
      const result = processKeystroke("r", afterUndo, buffer, true);
      expect(buffer.getContent()).toBe("");
    });

    it("Ctrl-R でリドゥスタックが空の場合メッセージを表示する", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const result = processKeystroke("r", ctx, buffer, true);
      expect(result.newCtx.statusMessage).toBe(
        "Already at newest change",
      );
    });
  });

  // ---------------------------------------------------
  // オペレーターペンディング中の特殊動作
  // ---------------------------------------------------
  describe("オペレーターペンディング", () => {
    it("無効なキーでオペレーターがキャンセルされる", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["d", "z"], ctx, buffer);
      expect(result.phase).toBe("idle");
      expect(result.operator).toBeNull();
    });

    it("dfa でオペレーター + 文字検索モーションが機能する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["d", "f", "o"], ctx, buffer);
      expect(buffer.getContent()).toBe(" world");
    });
  });

  // ---------------------------------------------------
  // マッチしないキーのリセット
  // ---------------------------------------------------
  describe("未知のキー", () => {
    it("認識されないキーはコンテキストをリセットする", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { count: 5 });
      const { ctx: result } = pressKeys(["z"], ctx, buffer);
      expect(result.count).toBe(0);
      expect(result.phase).toBe("idle");
    });
  });

  // ---------------------------------------------------
  // readOnly モード
  // ---------------------------------------------------
  describe("readOnly モード", () => {
    /** readOnly モードで複数キーを処理するヘルパー */
    function pressKeysReadOnly(
      keys: string[],
      ctx: VimContext,
      buffer: TextBuffer,
    ) {
      let current = ctx;
      const allActions: import("../types").VimAction[] = [];
      for (const key of keys) {
        const result = processKeystroke(key, current, buffer, false, true);
        current = result.newCtx;
        allActions.push(...result.actions);
      }
      return { ctx: current, allActions };
    }

    it("i, a, o, I, A, O でインサートモードに入れない", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      for (const key of ["i", "a", "o", "I", "A", "O"]) {
        const result = processKeystroke(key, ctx, buffer, false, true);
        expect(result.newCtx.mode).toBe("normal");
      }
    });

    it("d, c オペレーターがブロックされる", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });

      const { ctx: afterD } = pressKeysReadOnly(["d"], ctx, buffer);
      expect(afterD.phase).toBe("idle");
      expect(afterD.operator).toBeNull();
      expect(buffer.getContent()).toBe("hello world");

      const { ctx: afterC } = pressKeysReadOnly(["c"], ctx, buffer);
      expect(afterC.phase).toBe("idle");
      expect(afterC.operator).toBeNull();
      expect(buffer.getContent()).toBe("hello world");
    });

    it("y オペレーターは許可される", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });

      const { ctx: result, allActions } = pressKeysReadOnly(
        ["y", "w"],
        ctx,
        buffer,
      );
      expect(result.register).toBe("hello ");
      expect(allActions.some((a) => a.type === "yank")).toBe(true);
      expect(buffer.getContent()).toBe("hello world");
    });

    it("x, p, P がブロックされる", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { register: "test" },
      );

      for (const key of ["x", "p", "P"]) {
        const result = processKeystroke(key, ctx, buffer, false, true);
        expect(result.newCtx.mode).toBe("normal");
        expect(buffer.getContent()).toBe("hello");
      }
    });

    it("J (行結合) がブロックされる", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("J", ctx, buffer, false, true);
      expect(buffer.getContent()).toBe("hello\nworld");
      expect(result.newCtx.mode).toBe("normal");
    });

    it("u (undo) がブロックされる", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("u", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("normal");
    });

    it("r (replace) がブロックされる", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("r", ctx, buffer, false, true);
      expect(buffer.getContent()).toBe("hello");
    });

    it("Ctrl-R (redo) がブロックされる", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("r", ctx, buffer, true, true);
      expect(result.newCtx.mode).toBe("normal");
    });

    it(": (exコマンド) がブロックされる", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke(":", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("normal");
    });

    it("モーション (h, j, k, l, w, e, b) は許可される", () => {
      const buffer = new TextBuffer("hello world\nsecond line");
      const ctx = createTestContext({ line: 0, col: 0 });

      // w: 次の単語へ
      const r1 = processKeystroke("w", ctx, buffer, false, true);
      expect(r1.newCtx.cursor.col).toBe(6);

      // j: 次の行へ
      const r2 = processKeystroke("j", ctx, buffer, false, true);
      expect(r2.newCtx.cursor.line).toBe(1);
    });

    it("/ (検索) は許可される", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("/", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("command-line");
      expect(result.newCtx.commandType).toBe("/");
    });

    it("v, V (ビジュアルモード) は許可される", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const r1 = processKeystroke("v", ctx, buffer, false, true);
      expect(r1.newCtx.mode).toBe("visual");

      const r2 = processKeystroke("V", ctx, buffer, false, true);
      expect(r2.newCtx.mode).toBe("visual-line");
    });

    it("ビジュアルモードで d, x, c がブロックされる", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { mode: "visual", visualAnchor: { line: 0, col: 0 } },
      );

      // カーソルを動かして選択範囲を作る
      const { ctx: afterMotion } = pressKeysReadOnly(["w"], ctx, buffer);

      for (const key of ["d", "x", "c"]) {
        const result = processKeystroke(key, afterMotion, buffer, false, true);
        expect(buffer.getContent()).toBe("hello world");
      }
    });

    it("ビジュアルモードで y は許可される", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { mode: "visual", visualAnchor: { line: 0, col: 0 } },
      );

      const { ctx: afterMotion } = pressKeysReadOnly(["e"], ctx, buffer);
      const result = processKeystroke("y", afterMotion, buffer, false, true);
      expect(result.newCtx.register).toBeTruthy();
      expect(buffer.getContent()).toBe("hello world");
    });

    it("insertモードにいる場合は強制的にnormalに戻る", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext(
        { line: 0, col: 2 },
        { mode: "insert", statusMessage: "-- INSERT --" },
      );

      const result = processKeystroke("a", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("normal");
    });
  });
});
