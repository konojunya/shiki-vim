/**
 * visual-mode.test.ts
 *
 * ビジュアルモード（文字単位・行単位）の統合テスト。
 * 選択範囲の拡大/縮小、オペレーター実行、モード切替を検証する。
 */

import { describe, it, expect } from "vitest";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "./vim-state";
import { TextBuffer } from "./buffer";

// =====================
// ヘルパー関数
// =====================

/** ビジュアルモードのテスト用VimContextを生成する */
function createVisualContext(
  cursor: CursorPosition,
  anchor: CursorPosition,
  overrides?: Partial<VimContext>,
): VimContext {
  return {
    ...createInitialContext(cursor),
    mode: "visual",
    visualAnchor: { ...anchor },
    statusMessage: "-- VISUAL --",
    ...overrides,
  };
}

/** ビジュアルラインモードのテスト用VimContextを生成する */
function createVisualLineContext(
  cursor: CursorPosition,
  anchor: CursorPosition,
  overrides?: Partial<VimContext>,
): VimContext {
  return {
    ...createInitialContext(cursor),
    mode: "visual-line",
    visualAnchor: { ...anchor },
    statusMessage: "-- VISUAL LINE --",
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

describe("ビジュアルモード", () => {
  // ---------------------------------------------------
  // ビジュアルモードの開始と移動
  // ---------------------------------------------------
  describe("ビジュアルモードの開始とカーソル移動", () => {
    it("v でビジュアルモードに入り、アンカーが設定される", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createInitialContext({ line: 0, col: 3 });
      const { ctx: result } = pressKeys(["v"], ctx, buffer);
      expect(result.mode).toBe("visual");
      expect(result.visualAnchor).toEqual({ line: 0, col: 3 });
    });

    it("l で選択範囲を右に拡大する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 3 },
        { line: 0, col: 3 },
      );
      const { ctx: result } = pressKeys(["l", "l"], ctx, buffer);
      expect(result.cursor.col).toBe(5);
      expect(result.visualAnchor).toEqual({ line: 0, col: 3 });
    });

    it("j で選択範囲を下の行に拡大する", () => {
      const buffer = new TextBuffer("hello\nworld\nfoo");
      const ctx = createVisualContext(
        { line: 0, col: 2 },
        { line: 0, col: 2 },
      );
      const { ctx: result } = pressKeys(["j"], ctx, buffer);
      expect(result.cursor.line).toBe(1);
      expect(result.visualAnchor).toEqual({ line: 0, col: 2 });
    });

    it("h でカーソルを左に移動し選択範囲を縮小する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 5 },
        { line: 0, col: 3 },
      );
      const { ctx: result } = pressKeys(["h"], ctx, buffer);
      expect(result.cursor.col).toBe(4);
    });

    it("gg でファイル先頭に移動する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createVisualContext(
        { line: 2, col: 0 },
        { line: 2, col: 0 },
      );
      const { ctx: result } = pressKeys(["g", "g"], ctx, buffer);
      expect(result.cursor.line).toBe(0);
      expect(result.visualAnchor).toEqual({ line: 2, col: 0 });
    });
  });

  // ---------------------------------------------------
  // ビジュアルモードでのオペレーター実行
  // ---------------------------------------------------
  describe("ビジュアルモードでのオペレーター", () => {
    it("d で選択範囲を削除する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 5 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["d"], ctx, buffer);
      expect(buffer.getContent()).toBe("world");
      expect(result.mode).toBe("normal");
      expect(result.visualAnchor).toBeNull();
    });

    it("x で選択範囲を削除する（d と同じ動作）", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 5 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["x"], ctx, buffer);
      expect(buffer.getContent()).toBe("world");
      expect(result.mode).toBe("normal");
    });

    it("y で選択範囲をヤンクする（バッファは変更しない）", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 4 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["y"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(result.register).toBe("hello");
      expect(result.mode).toBe("normal");
    });

    it("c で選択範囲を削除してインサートモードに入る", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 4 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["c"], ctx, buffer);
      expect(buffer.getContent()).toBe(" world");
      expect(result.mode).toBe("insert");
    });

    it("複数行選択を d で削除する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createVisualContext(
        { line: 1, col: 2 },
        { line: 0, col: 3 },
      );
      const { ctx: result } = pressKeys(["d"], ctx, buffer);
      // line1の0-2 + line2の3以降 が削除される
      expect(result.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // ビジュアルラインモード
  // ---------------------------------------------------
  describe("ビジュアルラインモード", () => {
    it("V でビジュアルラインモードに入る", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["V"], ctx, buffer);
      expect(result.mode).toBe("visual-line");
    });

    it("ビジュアルラインモードで d すると行全体が削除される", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createVisualLineContext(
        { line: 1, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["d"], ctx, buffer);
      expect(buffer.getContent()).toBe("line3");
      expect(result.mode).toBe("normal");
      expect(result.register).toBe("line1\nline2\n");
    });

    it("ビジュアルラインモードで y すると行全体がヤンクされる", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createVisualLineContext(
        { line: 1, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["y"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.register).toBe("line1\nline2\n");
      expect(result.mode).toBe("normal");
    });

    it("ビジュアルラインモードで j を押すと選択範囲が下に拡大する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createVisualLineContext(
        { line: 0, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["j"], ctx, buffer);
      expect(result.cursor.line).toBe(1);
      expect(result.mode).toBe("visual-line");
    });
  });

  // ---------------------------------------------------
  // Escape（ビジュアルモード終了）
  // ---------------------------------------------------
  describe("Escape（ビジュアルモード終了）", () => {
    it("Escape でノーマルモードに戻る", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 5 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.mode).toBe("normal");
      expect(result.visualAnchor).toBeNull();
    });

    it("ビジュアルラインモードで Escape を押すとノーマルモードに戻る", () => {
      const buffer = new TextBuffer("line1\nline2");
      const ctx = createVisualLineContext(
        { line: 1, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // モード切替（v / V の再押下）
  // ---------------------------------------------------
  describe("モード切替", () => {
    it("ビジュアルモードで v を再度押すとノーマルモードに戻る", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createVisualContext(
        { line: 0, col: 3 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["v"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });

    it("ビジュアルモードで V を押すとビジュアルラインモードに切り替わる", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createVisualContext(
        { line: 0, col: 3 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["V"], ctx, buffer);
      expect(result.mode).toBe("visual-line");
    });

    it("ビジュアルラインモードで V を再度押すとノーマルモードに戻る", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createVisualLineContext(
        { line: 0, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["V"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });

    it("ビジュアルラインモードで v を押すとビジュアルモードに切り替わる", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createVisualLineContext(
        { line: 0, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["v"], ctx, buffer);
      expect(result.mode).toBe("visual");
    });
  });

  // ---------------------------------------------------
  // カウントプレフィックス
  // ---------------------------------------------------
  describe("カウントプレフィックス", () => {
    it("3l でカーソルを3つ右に移動する", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["3", "l"], ctx, buffer);
      expect(result.cursor.col).toBe(3);
    });
  });

  // ---------------------------------------------------
  // visualAnchor が null のエッジケース
  // ---------------------------------------------------
  describe("エッジケース", () => {
    it("visualAnchor が null のときオペレーターは何もしない", () => {
      const buffer = new TextBuffer("hello");
      const ctx: VimContext = {
        ...createInitialContext({ line: 0, col: 0 }),
        mode: "visual",
        visualAnchor: null,
      };
      const { ctx: result } = pressKeys(["d"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.mode).toBe("visual");
    });
  });
});
