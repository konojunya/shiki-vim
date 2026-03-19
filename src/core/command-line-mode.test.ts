/**
 * command-line-mode.test.ts
 *
 * コマンドラインモードの統合テスト。
 * : コマンド、/ 前方検索、? 後方検索、Backspace、Escape を検証する。
 */

import { describe, it, expect } from "vitest";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "./vim-state";
import { TextBuffer } from "./buffer";

// =====================
// ヘルパー関数
// =====================

/** コマンドラインモードのテスト用VimContextを生成する */
function createCommandLineContext(
  cursor: CursorPosition,
  commandType: ":" | "/" | "?",
  overrides?: Partial<VimContext>,
): VimContext {
  return {
    ...createInitialContext(cursor),
    mode: "command-line",
    commandType,
    commandBuffer: "",
    statusMessage: commandType,
    ...(commandType === "/" ? { searchDirection: "forward" as const } : {}),
    ...(commandType === "?" ? { searchDirection: "backward" as const } : {}),
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

describe("コマンドラインモード", () => {
  // ---------------------------------------------------
  // :w（保存）
  // ---------------------------------------------------
  describe(":w コマンド（保存）", () => {
    it(":w で save アクションが発行される", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result, allActions } = pressKeys(
        ["w", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(allActions).toContainEqual({
        type: "save",
        content: "hello world",
      });
    });

    it(":w の後にコマンドバッファがクリアされる", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result } = pressKeys(["w", "Enter"], ctx, buffer);
      expect(result.commandBuffer).toBe("");
      expect(result.commandType).toBeNull();
    });
  });

  // ---------------------------------------------------
  // /pattern（前方検索）
  // ---------------------------------------------------
  describe("/pattern（前方検索）", () => {
    it("/foo で 'foo' を前方検索し、マッチ位置にカーソルを移動する", () => {
      const buffer = new TextBuffer("hello foo world");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, "/");
      const { ctx: result } = pressKeys(
        ["f", "o", "o", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(result.cursor).toEqual({ line: 0, col: 6 });
      expect(result.lastSearch).toBe("foo");
    });

    it("マッチしない場合ステータスメッセージを表示する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, "/");
      const { ctx: result, allActions } = pressKeys(
        ["x", "y", "z", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(result.statusMessage).toBe("Pattern not found: xyz");
      expect(result.lastSearch).toBe("xyz");
      expect(allActions).toContainEqual({
        type: "status-message",
        message: "Pattern not found: xyz",
      });
    });

    it("空パターンで Enter を押すとコマンドラインを抜けるだけ", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, "/");
      const { ctx: result } = pressKeys(["Enter"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // ?pattern（後方検索）
  // ---------------------------------------------------
  describe("?pattern（後方検索）", () => {
    it("?foo で 'foo' を後方検索する", () => {
      const buffer = new TextBuffer("foo hello foo");
      const ctx = createCommandLineContext({ line: 0, col: 10 }, "?");
      const { ctx: result } = pressKeys(
        ["f", "o", "o", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(result.cursor).toEqual({ line: 0, col: 0 });
      expect(result.searchDirection).toBe("backward");
    });

    it("後方検索でマッチしない場合メッセージを表示する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createCommandLineContext({ line: 0, col: 5 }, "?");
      const { ctx: result } = pressKeys(
        ["z", "z", "z", "Enter"],
        ctx,
        buffer,
      );
      expect(result.statusMessage).toBe("Pattern not found: zzz");
    });
  });

  // ---------------------------------------------------
  // Backspace（コマンドバッファ編集）
  // ---------------------------------------------------
  describe("Backspace（コマンドバッファ編集）", () => {
    it("Backspace でコマンドバッファの最後の文字を削除する", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":", {
        commandBuffer: "wq",
        statusMessage: ":wq",
      });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(result.commandBuffer).toBe("w");
      expect(result.statusMessage).toBe(":w");
    });

    it("コマンドバッファが空のとき Backspace でコマンドラインモードを抜ける", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":", {
        commandBuffer: "",
      });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(result.mode).toBe("normal");
      expect(result.commandType).toBeNull();
    });
  });

  // ---------------------------------------------------
  // Escape（コマンドラインモード終了）
  // ---------------------------------------------------
  describe("Escape（コマンドラインモード終了）", () => {
    it("Escape でコマンドラインモードを抜けてノーマルモードに戻る", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":", {
        commandBuffer: "some",
      });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.mode).toBe("normal");
      expect(result.commandBuffer).toBe("");
      expect(result.commandType).toBeNull();
    });

    it("検索モードでも Escape で抜けられる", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, "/", {
        commandBuffer: "pattern",
      });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // :{number}（行ジャンプ）
  // ---------------------------------------------------
  describe(":{number}（行ジャンプ）", () => {
    it(":3 で3行目（0-basedで2行目）にジャンプする", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result, allActions } = pressKeys(
        ["3", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(result.cursor).toEqual({ line: 2, col: 0 });
      expect(allActions).toContainEqual({
        type: "cursor-move",
        position: { line: 2, col: 0 },
      });
    });

    it(":1 で1行目にジャンプする", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createCommandLineContext({ line: 2, col: 3 }, ":");
      const { ctx: result } = pressKeys(["1", "Enter"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 0, col: 0 });
    });

    it("バッファの行数を超える数値はクランプされる", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result } = pressKeys(
        ["9", "9", "9", "Enter"],
        ctx,
        buffer,
      );
      expect(result.cursor.line).toBe(2); // 最終行
    });

    it(":0 は1行目にクランプされる", () => {
      const buffer = new TextBuffer("line1\nline2");
      const ctx = createCommandLineContext({ line: 1, col: 0 }, ":");
      const { ctx: result } = pressKeys(["0", "Enter"], ctx, buffer);
      expect(result.cursor.line).toBe(0);
    });
  });

  // ---------------------------------------------------
  // 文字入力
  // ---------------------------------------------------
  describe("文字入力", () => {
    it("文字入力でコマンドバッファに追加される", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result } = pressKeys(["h", "e", "l", "p"], ctx, buffer);
      expect(result.commandBuffer).toBe("help");
      expect(result.statusMessage).toBe(":help");
    });

    it("特殊キー（長いキー名）は無視される", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":", {
        commandBuffer: "test",
      });
      const { ctx: result } = pressKeys(["ArrowLeft"], ctx, buffer);
      expect(result.commandBuffer).toBe("test");
    });
  });

  // ---------------------------------------------------
  // 統合テスト：ノーマルモードから検索して戻る
  // ---------------------------------------------------
  describe("統合テスト", () => {
    it("ノーマルモードから /hello と入力して検索する一連の流れ", () => {
      const buffer = new TextBuffer("foo\nbar\nhello\nworld");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(
        ["/", "h", "e", "l", "l", "o", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(result.cursor).toEqual({ line: 2, col: 0 });
      expect(result.lastSearch).toBe("hello");
    });

    it("ノーマルモードから :5 と入力して5行目にジャンプする", () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join(
        "\n",
      );
      const buffer = new TextBuffer(lines);
      const ctx = createInitialContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys([":", "5", "Enter"], ctx, buffer);
      expect(result.mode).toBe("normal");
      expect(result.cursor).toEqual({ line: 4, col: 0 });
    });
  });
});
