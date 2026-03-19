/**
 * operators.test.ts
 *
 * オペレーター (d, y, c) の単体テストと、
 * executeOperatorOnRange / executeLineOperator の動作を検証する。
 */

import { describe, it, expect } from "vitest";
import { executeOperatorOnRange, executeLineOperator } from "./operators";
import type { MotionRange } from "./motions";
import { TextBuffer } from "./buffer";

// =====================
// テスト本体
// =====================

describe("オペレーター", () => {
  // ---------------------------------------------------
  // executeOperatorOnRange: 文字単位の delete
  // ---------------------------------------------------
  describe("executeOperatorOnRange - 文字単位 delete", () => {
    it("1単語分の範囲を削除する", () => {
      const buffer = new TextBuffer("hello world");
      // dw: w motion の end は次の単語の先頭 (col 6), inclusive: false
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 6 },
        linewise: false,
        inclusive: false,
      };
      const result = executeOperatorOnRange(
        "d",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("world");
      expect(result.newCursor.col).toBe(0);
      expect(result.newMode).toBe("normal");
      expect(result.yankedText).toBe("hello ");
    });

    it("inclusive な範囲で末尾の文字も含めて削除する", () => {
      const buffer = new TextBuffer("hello");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 2 },
        linewise: false,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "d",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("lo");
      expect(result.yankedText).toBe("hel");
    });

    it("start > end のとき正規化して処理する", () => {
      const buffer = new TextBuffer("hello");
      const range: MotionRange = {
        start: { line: 0, col: 3 },
        end: { line: 0, col: 0 },
        linewise: false,
        inclusive: false,
      };
      const result = executeOperatorOnRange(
        "d",
        range,
        buffer,
        { line: 0, col: 3 },
      );
      expect(buffer.getContent()).toBe("lo");
      expect(result.newCursor.col).toBe(0);
    });

    it("複数行にまたがる範囲を削除する", () => {
      const buffer = new TextBuffer("hello\nworld\nfoo");
      const range: MotionRange = {
        start: { line: 0, col: 3 },
        end: { line: 1, col: 3 },
        linewise: false,
        inclusive: false,
      };
      const result = executeOperatorOnRange(
        "d",
        range,
        buffer,
        { line: 0, col: 3 },
      );
      expect(buffer.getContent()).toBe("helld\nfoo");
      expect(result.yankedText).toBe("lo\nwor");
    });
  });

  // ---------------------------------------------------
  // executeOperatorOnRange: 文字単位の yank
  // ---------------------------------------------------
  describe("executeOperatorOnRange - 文字単位 yank", () => {
    it("ヤンクのみで削除しない", () => {
      const buffer = new TextBuffer("hello world");
      // yw: w motion の end は次の単語の先頭 (col 6), inclusive: false
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 6 },
        linewise: false,
        inclusive: false,
      };
      const result = executeOperatorOnRange(
        "y",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("hello world");
      expect(result.yankedText).toBe("hello ");
      expect(result.newMode).toBe("normal");
    });

    it("ヤンク後のカーソルが範囲の先頭に移動する", () => {
      const buffer = new TextBuffer("hello world");
      const range: MotionRange = {
        start: { line: 0, col: 6 },
        end: { line: 0, col: 10 },
        linewise: false,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "y",
        range,
        buffer,
        { line: 0, col: 6 },
      );
      expect(result.newCursor).toEqual({ line: 0, col: 6 });
      expect(result.yankedText).toBe("world");
    });
  });

  // ---------------------------------------------------
  // executeOperatorOnRange: 文字単位の change
  // ---------------------------------------------------
  describe("executeOperatorOnRange - 文字単位 change", () => {
    it("範囲を削除してインサートモードに遷移する", () => {
      const buffer = new TextBuffer("hello world");
      // cw: w motion の end は次の単語の先頭 (col 6), inclusive: false
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 6 },
        linewise: false,
        inclusive: false,
      };
      const result = executeOperatorOnRange(
        "c",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("world");
      expect(result.newMode).toBe("insert");
      expect(result.newCursor.col).toBe(0);
    });

    it("change のカーソルは削除範囲の先頭になる", () => {
      const buffer = new TextBuffer("hello world");
      const range: MotionRange = {
        start: { line: 0, col: 6 },
        end: { line: 0, col: 10 },
        linewise: false,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "c",
        range,
        buffer,
        { line: 0, col: 6 },
      );
      expect(result.newCursor.col).toBe(6);
    });
  });

  // ---------------------------------------------------
  // executeOperatorOnRange: 行単位操作
  // ---------------------------------------------------
  describe("executeOperatorOnRange - 行単位操作", () => {
    it("行単位 delete で行全体を削除する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 1, col: 0 },
        linewise: true,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "d",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("line3");
      expect(result.yankedText).toBe("line1\nline2\n");
    });

    it("行単位 yank はバッファを変更しない", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 1, col: 0 },
        linewise: true,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "y",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.yankedText).toBe("line1\nline2\n");
    });

    it("行単位 change で行を削除して空行を挿入しインサートモードに入る", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const range: MotionRange = {
        start: { line: 1, col: 0 },
        end: { line: 1, col: 0 },
        linewise: true,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "c",
        range,
        buffer,
        { line: 1, col: 0 },
      );
      expect(result.newMode).toBe("insert");
      expect(result.newCursor).toEqual({ line: 1, col: 0 });
      expect(buffer.getLine(1)).toBe("");
    });
  });

  // ---------------------------------------------------
  // executeLineOperator（dd, yy, cc）
  // ---------------------------------------------------
  describe("executeLineOperator", () => {
    it("dd (count=1) で1行を削除する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const result = executeLineOperator(
        "d",
        { line: 1, col: 0 },
        1,
        buffer,
      );
      expect(buffer.getContent()).toBe("line1\nline3");
      expect(result.yankedText).toBe("line2\n");
    });

    it("2dd で2行を削除する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const result = executeLineOperator(
        "d",
        { line: 1, col: 0 },
        2,
        buffer,
      );
      expect(buffer.getContent()).toBe("line1\nline4");
      expect(result.yankedText).toBe("line2\nline3\n");
    });

    it("yy で1行をヤンクする", () => {
      const buffer = new TextBuffer("line1\nline2");
      const result = executeLineOperator(
        "y",
        { line: 0, col: 0 },
        1,
        buffer,
      );
      expect(buffer.getContent()).toBe("line1\nline2");
      expect(result.yankedText).toBe("line1\n");
    });

    it("cc で行を変更する", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const result = executeLineOperator(
        "c",
        { line: 1, col: 0 },
        1,
        buffer,
      );
      expect(result.newMode).toBe("insert");
      expect(buffer.getLine(1)).toBe("");
    });
  });

  // ---------------------------------------------------
  // エッジケース
  // ---------------------------------------------------
  describe("エッジケース", () => {
    it("全行を削除するとバッファに空行が1行残る", () => {
      const buffer = new TextBuffer("only line");
      const result = executeLineOperator(
        "d",
        { line: 0, col: 0 },
        1,
        buffer,
      );
      expect(buffer.getContent()).toBe("");
      expect(buffer.getLineCount()).toBe(1);
      expect(result.newCursor.line).toBe(0);
    });

    it("カウントがバッファの行数を超えてもクランプされる", () => {
      const buffer = new TextBuffer("line1\nline2");
      const result = executeLineOperator(
        "d",
        { line: 0, col: 0 },
        100,
        buffer,
      );
      // 全行削除される
      expect(buffer.getLineCount()).toBe(1);
      expect(buffer.getContent()).toBe("");
    });

    it("空バッファに対して行単位 yank を実行する", () => {
      const buffer = new TextBuffer("");
      const result = executeLineOperator(
        "y",
        { line: 0, col: 0 },
        1,
        buffer,
      );
      expect(result.yankedText).toBe("\n");
      expect(buffer.getContent()).toBe("");
    });

    it("1行のバッファに対して文字単位 delete を実行する", () => {
      const buffer = new TextBuffer("abc");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 2 },
        linewise: false,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "d",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("");
      expect(result.newCursor.col).toBe(0);
    });
  });
});
