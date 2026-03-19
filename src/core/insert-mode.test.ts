/**
 * insert-mode.test.ts
 *
 * インサートモードの統合テスト。
 * 文字入力、Backspace、Delete、Enter、Tab、Escape の動作を検証する。
 */

import { describe, it, expect } from "vitest";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "./vim-state";
import { TextBuffer } from "./buffer";

// =====================
// ヘルパー関数
// =====================

/** インサートモードのテスト用VimContextを生成する */
function createInsertContext(
  cursor: CursorPosition,
  overrides?: Partial<VimContext>,
): VimContext {
  return {
    ...createInitialContext(cursor),
    mode: "insert",
    statusMessage: "-- INSERT --",
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

describe("インサートモード", () => {
  // ---------------------------------------------------
  // 文字入力
  // ---------------------------------------------------
  describe("文字入力", () => {
    it("1文字を挿入する", () => {
      const buffer = new TextBuffer("hllo");
      const ctx = createInsertContext({ line: 0, col: 1 });
      const { ctx: result } = pressKeys(["e"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(2);
    });

    it("複数文字を連続して挿入する", () => {
      const buffer = new TextBuffer("");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(
        ["h", "e", "l", "l", "o"],
        ctx,
        buffer,
      );
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(5);
    });

    it("行の中間に文字を挿入する", () => {
      const buffer = new TextBuffer("helo");
      const ctx = createInsertContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["l"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(3);
    });

    it("行末に文字を挿入する", () => {
      const buffer = new TextBuffer("hell");
      const ctx = createInsertContext({ line: 0, col: 4 });
      const { ctx: result } = pressKeys(["o"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(5);
    });

    it("空行に文字を挿入する", () => {
      const buffer = new TextBuffer("");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["a"], ctx, buffer);
      expect(buffer.getContent()).toBe("a");
      expect(result.cursor.col).toBe(1);
    });

    it("特殊文字（スペースなど）を挿入できる", () => {
      const buffer = new TextBuffer("helloworld");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys([" "], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(result.cursor.col).toBe(6);
    });
  });

  // ---------------------------------------------------
  // Backspace
  // ---------------------------------------------------
  describe("Backspace", () => {
    it("行の中間で1文字削除する", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 3 });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(buffer.getContent()).toBe("helo");
      expect(result.cursor.col).toBe(2);
    });

    it("行頭で Backspace を押すと前の行と結合する", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createInsertContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(buffer.getContent()).toBe("helloworld");
      expect(result.cursor).toEqual({ line: 0, col: 5 });
    });

    it("ファイル先頭（行0、列0）で Backspace を押しても何も起きない", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor).toEqual({ line: 0, col: 0 });
    });

    it("連続 Backspace で複数文字を削除する", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(
        ["Backspace", "Backspace", "Backspace"],
        ctx,
        buffer,
      );
      expect(buffer.getContent()).toBe("he");
      expect(result.cursor.col).toBe(2);
    });

    it("空行の行頭で Backspace を押すと前の行と結合する", () => {
      const buffer = new TextBuffer("hello\n");
      const ctx = createInsertContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor).toEqual({ line: 0, col: 5 });
    });
  });

  // ---------------------------------------------------
  // Delete
  // ---------------------------------------------------
  describe("Delete", () => {
    it("行の中間で1文字削除する", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["Delete"], ctx, buffer);
      expect(buffer.getContent()).toBe("helo");
      expect(result.cursor.col).toBe(2);
    });

    it("行末で Delete を押すと次の行と結合する", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["Delete"], ctx, buffer);
      expect(buffer.getContent()).toBe("helloworld");
      expect(result.cursor).toEqual({ line: 0, col: 5 });
    });

    it("最終行の末尾で Delete を押しても何も起きない", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["Delete"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(5);
    });

    it("空行で Delete を押すと次の行と結合する", () => {
      const buffer = new TextBuffer("\nhello");
      const ctx = createInsertContext({ line: 0, col: 0 });
      pressKeys(["Delete"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
    });
  });

  // ---------------------------------------------------
  // Enter（行分割）
  // ---------------------------------------------------
  describe("Enter（行分割）", () => {
    it("行の中間で Enter を押すと行が分割される", () => {
      const buffer = new TextBuffer("helloworld");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello\nworld");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("行頭で Enter を押すと空行が上に挿入される", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("\nhello");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("行末で Enter を押すと下に空行が挿入される", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello\n");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("連続 Enter で複数行を挿入する", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(
        ["Enter", "Enter"],
        ctx,
        buffer,
      );
      expect(buffer.getContent()).toBe("hello\n\n");
      expect(result.cursor).toEqual({ line: 2, col: 0 });
    });
  });

  // ---------------------------------------------------
  // Tab（インデント）
  // ---------------------------------------------------
  describe("Tab（インデント）", () => {
    it("Tab でスペース2つが挿入される", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["Tab"], ctx, buffer);
      expect(buffer.getContent()).toBe("  hello");
      expect(result.cursor.col).toBe(2);
    });

    it("行の中間で Tab を押してもスペースが挿入される", () => {
      const buffer = new TextBuffer("helloworld");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["Tab"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello  world");
      expect(result.cursor.col).toBe(7);
    });
  });

  // ---------------------------------------------------
  // Escape（ノーマルモードへ復帰）
  // ---------------------------------------------------
  describe("Escape（ノーマルモードへ復帰）", () => {
    it("Escape でノーマルモードに戻る", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 3 });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });

    it("Escape 時にカーソルが1つ左に戻る（Vimの仕様）", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 3 });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.cursor.col).toBe(2);
    });

    it("列0で Escape を押してもカーソルは0のまま", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.cursor.col).toBe(0);
    });

    it("Escape 後にステータスメッセージがクリアされる", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 3 });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.statusMessage).toBe("");
    });
  });

  // ---------------------------------------------------
  // Ctrlキー（インサートモードでは無視）
  // ---------------------------------------------------
  describe("Ctrl キー（インサートモードでは無視）", () => {
    it("Ctrl+何かは無視される", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 2 });
      const result = processKeystroke("a", ctx, buffer, true);
      expect(buffer.getContent()).toBe("hello");
      expect(result.newCtx.cursor.col).toBe(2);
    });
  });

  // ---------------------------------------------------
  // その他の特殊キー
  // ---------------------------------------------------
  describe("その他の特殊キー", () => {
    it("矢印キーなどの特殊キーは無視される", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["ArrowLeft"], ctx, buffer);
      // ArrowLeft は length > 1 のため無視される
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(2);
    });
  });
});
