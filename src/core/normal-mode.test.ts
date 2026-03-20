/**
 * normal-mode.test.ts
 *
 * Integration tests for normal mode.
 * Comprehensively verifies behavior of counts, operators, motions,
 * mode transitions, editing commands, etc. through processKeystroke.
 */

import { describe, it, expect } from "vitest";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "./vim-state";
import { TextBuffer } from "./buffer";

// =====================
// Helper functions
// =====================

/** Create a VimContext for testing */
function createTestContext(
  cursor: CursorPosition,
  overrides?: Partial<VimContext>,
): VimContext {
  return {
    ...createInitialContext(cursor),
    ...overrides,
  };
}

/** Process multiple keys in sequence and return the final state */
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
// Tests
// =====================

describe("Normal mode", () => {
  // ---------------------------------------------------
  // Count prefix
  // ---------------------------------------------------
  describe("Count prefix", () => {
    it("moves 3 lines down with 3j", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4\nline5");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["3", "j"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 3, col: 0 });
    });

    it("moves 5 lines up with 5k (clamped when not enough lines)", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 2, col: 0 });
      const { ctx: result } = pressKeys(["5", "k"], ctx, buffer);
      expect(result.cursor.line).toBe(0);
    });

    it("moves 2 columns right with 2l", () => {
      const buffer = new TextBuffer("abcdef");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["2", "l"], ctx, buffer);
      expect(result.cursor.col).toBe(2);
    });

    it("moves 5 words forward with 5w", () => {
      const buffer = new TextBuffer("one two three four five six seven");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["5", "w"], ctx, buffer);
      // 5w: one->two->three->four->five->six start
      expect(result.cursor.col).toBe(24);
    });

    it("interprets count 0 as move to beginning of line (when no count entered)", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["0"], ctx, buffer);
      expect(result.cursor.col).toBe(0);
    });

    it("correctly processes a two-digit count like 10j", () => {
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
  // Operator + motion
  // ---------------------------------------------------
  describe("Operator + motion", () => {
    it("deletes one word with dw", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["d", "w"], ctx, buffer);
      expect(buffer.getContent()).toBe("world");
      expect(result.cursor.col).toBe(0);
    });

    it("deletes to end of line with d$", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["d", "$"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(4);
    });

    it("deletes to beginning of line with d0", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      pressKeys(["d", "0"], ctx, buffer);
      expect(buffer.getContent()).toBe(" world");
    });

    it("deletes from cursor line to end of file with dG", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 1, col: 0 });
      pressKeys(["d", "G"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1");
    });

    it("deletes from cursor line to beginning of file with dgg", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 2, col: 0 });
      pressKeys(["d", "g", "g"], ctx, buffer);
      expect(buffer.getContent()).toBe("line4");
    });

    it("yanks one word with yw (buffer unchanged)", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["y", "w"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(result.register).toBe("hello ");
    });

    it("changes one word and enters insert mode with cw", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["c", "w"], ctx, buffer);
      expect(buffer.getContent()).toBe("world");
      expect(result.mode).toBe("insert");
    });
  });

  // ---------------------------------------------------
  // Double operators (line-wise operations)
  // ---------------------------------------------------
  describe("Double operators (dd, yy, cc)", () => {
    it("deletes the current line with dd", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["d", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline3");
      expect(result.register).toBe("line2\n");
      expect(result.cursor.line).toBe(1);
    });

    it("yanks the current line with yy (buffer unchanged)", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["y", "y"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.register).toBe("line2\n");
    });

    it("clears the current line and enters insert mode with cc", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["c", "c"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.register).toBe("line2\n");
      // cc deletes the line and inserts an empty line
      expect(buffer.getLine(1)).toBe("");
    });
  });

  // ---------------------------------------------------
  // Count + operator
  // ---------------------------------------------------
  describe("Count + operator", () => {
    it("deletes 3 lines with 3dd", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4\nline5");
      const ctx = createTestContext({ line: 1, col: 0 });
      pressKeys(["3", "d", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline5");
    });

    it("yanks 2 lines with 2yy", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["2", "y", "y"], ctx, buffer);
      expect(result.register).toBe("line1\nline2\n");
      expect(buffer.getContent()).toBe("line1\nline2\nline3\nline4");
    });

    it("clamps 2dd near the last line", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 2, col: 0 });
      pressKeys(["2", "d", "d"], ctx, buffer);
      // Only 1 line from line 2, so only line3 is deleted
      expect(buffer.getContent()).toBe("line1\nline2");
    });
  });

  // ---------------------------------------------------
  // x (character deletion)
  // ---------------------------------------------------
  describe("x command (character deletion)", () => {
    it("deletes the character under the cursor with x", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["x"], ctx, buffer);
      expect(buffer.getContent()).toBe("ello");
      expect(result.register).toBe("h");
    });

    it("adjusts cursor when pressing x at end of line", () => {
      const buffer = new TextBuffer("abc");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["x"], ctx, buffer);
      expect(buffer.getContent()).toBe("ab");
      expect(result.cursor.col).toBe(1);
    });

    it("does nothing when pressing x on an empty line", () => {
      const buffer = new TextBuffer("");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["x"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
      expect(result.cursor.col).toBe(0);
    });

    it("deletes 3 characters with 3x", () => {
      const buffer = new TextBuffer("abcdef");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["3", "x"], ctx, buffer);
      expect(buffer.getContent()).toBe("def");
    });
  });

  // ---------------------------------------------------
  // p / P (paste)
  // ---------------------------------------------------
  describe("p / P command (paste)", () => {
    it("pastes character-wise after the cursor with p", () => {
      const buffer = new TextBuffer("hllo");
      const ctx = createTestContext({ line: 0, col: 0 }, { register: "e" });
      const { ctx: result } = pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(1);
    });

    it("pastes character-wise before the cursor with P", () => {
      const buffer = new TextBuffer("hllo");
      const ctx = createTestContext({ line: 0, col: 1 }, { register: "e" });
      const { ctx: result } = pressKeys(["P"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(1);
    });

    it("pastes line-wise on the next line with p", () => {
      const buffer = new TextBuffer("line1\nline3");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { register: "line2\n" },
      );
      const { ctx: result } = pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("pastes line-wise above the current line with P", () => {
      const buffer = new TextBuffer("line1\nline3");
      const ctx = createTestContext(
        { line: 1, col: 0 },
        { register: "line2\n" },
      );
      const { ctx: result } = pressKeys(["P"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("does nothing with p when register is empty", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { register: "" });
      pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
    });

    it("pastes multi-line register line-wise with p and keeps buffer lines in sync", () => {
      const buffer = new TextBuffer("above\nbelow");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { register: "line1\nline2\nline3\n" },
      );
      const { ctx: result } = pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("above\nline1\nline2\nline3\nbelow");
      expect(buffer.getLineCount()).toBe(5);
      expect(result.cursor).toEqual({ line: 1, col: 0 });
      // dd on the pasted line should delete exactly that line
      const { ctx: afterDd } = pressKeys(["d", "d"], result, buffer);
      expect(buffer.getContent()).toBe("above\nline2\nline3\nbelow");
      expect(afterDd.cursor).toEqual({ line: 1, col: 0 });
    });

    it("pastes multi-line register line-wise with P and keeps buffer lines in sync", () => {
      const buffer = new TextBuffer("above\nbelow");
      const ctx = createTestContext(
        { line: 1, col: 0 },
        { register: "line1\nline2\n" },
      );
      const { ctx: result } = pressKeys(["P"], ctx, buffer);
      expect(buffer.getContent()).toBe("above\nline1\nline2\nbelow");
      expect(buffer.getLineCount()).toBe(4);
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });
  });

  // ---------------------------------------------------
  // D (delete to end of line)
  // ---------------------------------------------------
  describe("D command (delete to end of line)", () => {
    it("deletes from cursor to end of line with D", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["D"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.register).toBe(" world");
      expect(result.cursor.col).toBe(4);
    });

    it("deletes entire line content with D at column 0", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["D"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
      expect(result.register).toBe("hello world");
    });

    it("deletes last character with D at end of line", () => {
      const buffer = new TextBuffer("abc");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["D"], ctx, buffer);
      expect(buffer.getContent()).toBe("ab");
      expect(result.register).toBe("c");
    });

    it("does not affect other lines with D", () => {
      const buffer = new TextBuffer("hello world\nsecond line");
      const ctx = createTestContext({ line: 0, col: 5 });
      pressKeys(["D"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello\nsecond line");
    });
  });

  // ---------------------------------------------------
  // C (change to end of line)
  // ---------------------------------------------------
  describe("C command (change to end of line)", () => {
    it("deletes from cursor to end of line and enters insert mode with C", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["C"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.mode).toBe("insert");
      expect(result.register).toBe(" world");
      expect(result.cursor.col).toBe(5);
    });

    it("changes entire line content with C at column 0", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["C"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
      expect(result.mode).toBe("insert");
    });
  });

  // ---------------------------------------------------
  // u (undo)
  // ---------------------------------------------------
  describe("u command (undo)", () => {
    it("undoes the previous change with u", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      // First delete the line with dd
      const { ctx: afterDelete } = pressKeys(["d", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
      // undo
      const { ctx: afterUndo } = pressKeys(["u"], afterDelete, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(afterUndo.cursor).toEqual({ line: 0, col: 0 });
    });

    it("displays a message when the undo stack is empty", () => {
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
  // Mode transition (to insert mode)
  // ---------------------------------------------------
  describe("Transition to insert mode", () => {
    it("enters insert mode with i (cursor stays in place)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["i"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor.col).toBe(2);
    });

    it("moves cursor one position right and enters insert mode with a", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["a"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor.col).toBe(3);
    });

    it("moves to the first non-whitespace character and enters insert mode with I", () => {
      const buffer = new TextBuffer("  hello");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["I"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor.col).toBe(2);
    });

    it("moves to end of line and enters insert mode with A", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["A"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor.col).toBe(5);
    });

    it("inserts a blank line below and enters insert mode with o", () => {
      const buffer = new TextBuffer("line1\nline2");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["o"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
      expect(buffer.getContent()).toBe("line1\n\nline2");
    });

    it("inserts a blank line above and enters insert mode with O", () => {
      const buffer = new TextBuffer("line1\nline2");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["O"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
      expect(buffer.getContent()).toBe("line1\n\nline2");
    });
  });

  // ---------------------------------------------------
  // v / V (transition to visual mode)
  // ---------------------------------------------------
  describe("Transition to visual mode", () => {
    it("enters visual mode with v", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["v"], ctx, buffer);
      expect(result.mode).toBe("visual");
      expect(result.visualAnchor).toEqual({ line: 0, col: 2 });
    });

    it("enters visual-line mode with V", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["V"], ctx, buffer);
      expect(result.mode).toBe("visual-line");
      expect(result.visualAnchor).toEqual({ line: 0, col: 0 });
    });
  });

  // ---------------------------------------------------
  // J (join lines)
  // ---------------------------------------------------
  describe("J command (join lines)", () => {
    it("joins the current line with the next line using a space with J", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["J"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(result.cursor.col).toBe(5);
    });

    it("strips leading whitespace from the next line when joining with J", () => {
      const buffer = new TextBuffer("hello\n  world");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["J"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
    });

    it("does nothing when pressing J on the last line", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 1, col: 0 });
      pressKeys(["J"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello\nworld");
    });
  });

  // ---------------------------------------------------
  // g prefix (gg)
  // ---------------------------------------------------
  describe("g prefix commands", () => {
    it("moves to the beginning of the file with gg", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 2, col: 3 });
      const { ctx: result } = pressKeys(["g", "g"], ctx, buffer);
      expect(result.cursor.line).toBe(0);
    });

    it("moves to line 3 with 3gg", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["3", "g", "g"], ctx, buffer);
      expect(result.cursor.line).toBe(2);
    });

    it("moves to the end of the file with G", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["G"], ctx, buffer);
      expect(result.cursor.line).toBe(2);
    });

    it("resets on unknown g command", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["g", "x"], ctx, buffer);
      expect(result.phase).toBe("idle");
    });
  });

  // ---------------------------------------------------
  // f / F / t / T (character search)
  // ---------------------------------------------------
  describe("f / F / t / T commands (in-line character search)", () => {
    it("moves cursor to the position of 'o' with fo", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["f", "o"], ctx, buffer);
      expect(result.cursor.col).toBe(4);
    });

    it("searches backward for 'o' with Fo", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 7 });
      const { ctx: result } = pressKeys(["F", "o"], ctx, buffer);
      expect(result.cursor.col).toBe(4);
    });

    it("moves to just before 'o' with to", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["t", "o"], ctx, buffer);
      expect(result.cursor.col).toBe(3);
    });

    it("moves to just after 'o' backward with To", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 7 });
      const { ctx: result } = pressKeys(["T", "o"], ctx, buffer);
      expect(result.cursor.col).toBe(5);
    });
  });

  // ---------------------------------------------------
  // r (single character replacement)
  // ---------------------------------------------------
  describe("r command (single character replacement)", () => {
    it("replaces the character under the cursor with 'x' using rx", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["r", "x"], ctx, buffer);
      expect(buffer.getContent()).toBe("xello");
    });

    it("does nothing when pressing r on an empty line", () => {
      const buffer = new TextBuffer("");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["r", "x"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
    });
  });

  // ---------------------------------------------------
  // n / N (search repeat)
  // ---------------------------------------------------
  describe("n / N commands (repeat search)", () => {
    it("repeats forward search with n", () => {
      const buffer = new TextBuffer("foo bar foo baz foo");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { lastSearch: "foo", searchDirection: "forward" },
      );
      const { ctx: result } = pressKeys(["n"], ctx, buffer);
      expect(result.cursor.col).toBe(8);
    });

    it("reverses search direction with N", () => {
      const buffer = new TextBuffer("foo bar foo baz foo");
      const ctx = createTestContext(
        { line: 0, col: 8 },
        { lastSearch: "foo", searchDirection: "forward" },
      );
      const { ctx: result } = pressKeys(["N"], ctx, buffer);
      expect(result.cursor.col).toBe(0);
    });

    it("does nothing with n when lastSearch is empty", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { lastSearch: "" });
      const { ctx: result } = pressKeys(["n"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 0, col: 0 });
    });

    it("displays a status message when the pattern is not found", () => {
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
  // Command-line / search mode transition
  // ---------------------------------------------------
  describe("Command-line / search transition", () => {
    it("enters command-line mode with :", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys([":"], ctx, buffer);
      expect(result.mode).toBe("command-line");
      expect(result.commandType).toBe(":");
    });

    it("enters forward search mode with /", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["/"], ctx, buffer);
      expect(result.mode).toBe("command-line");
      expect(result.commandType).toBe("/");
      expect(result.searchDirection).toBe("forward");
    });

    it("enters backward search mode with ?", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["?"], ctx, buffer);
      expect(result.mode).toBe("command-line");
      expect(result.commandType).toBe("?");
      expect(result.searchDirection).toBe("backward");
    });
  });

  // ---------------------------------------------------
  // Ctrl key combinations
  // ---------------------------------------------------
  describe("Ctrl key combinations", () => {
    it("redoes with Ctrl-R", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      // dd -> undo -> redo
      const { ctx: afterDd } = pressKeys(["d", "d"], ctx, buffer);
      const { ctx: afterUndo } = pressKeys(["u"], afterDd, buffer);
      expect(buffer.getContent()).toBe("hello");
      const result = processKeystroke("r", afterUndo, buffer, true);
      expect(buffer.getContent()).toBe("");
    });

    it("displays a message when Ctrl-R redo stack is empty", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const result = processKeystroke("r", ctx, buffer, true);
      expect(result.newCtx.statusMessage).toBe(
        "Already at newest change",
      );
    });
  });

  // ---------------------------------------------------
  // Special behavior during operator-pending
  // ---------------------------------------------------
  describe("Operator pending", () => {
    it("cancels operator on invalid key", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["d", "z"], ctx, buffer);
      expect(result.phase).toBe("idle");
      expect(result.operator).toBeNull();
    });

    it("operator + character search motion works with dfa", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["d", "f", "o"], ctx, buffer);
      expect(buffer.getContent()).toBe(" world");
    });
  });

  // ---------------------------------------------------
  // Reset on unmatched key
  // ---------------------------------------------------
  describe("Unknown key", () => {
    it("resets context on unrecognized key", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { count: 5 });
      const { ctx: result } = pressKeys(["z"], ctx, buffer);
      expect(result.count).toBe(0);
      expect(result.phase).toBe("idle");
    });
  });

  // ---------------------------------------------------
  // readOnly mode
  // ---------------------------------------------------
  describe("readOnly mode", () => {
    /** Helper to process multiple keys in readOnly mode */
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

    it("cannot enter insert mode with i, a, o, I, A, O", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      for (const key of ["i", "a", "o", "I", "A", "O"]) {
        const result = processKeystroke(key, ctx, buffer, false, true);
        expect(result.newCtx.mode).toBe("normal");
      }
    });

    it("blocks d, c operators", () => {
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

    it("allows y operator", () => {
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

    it("blocks x, p, P", () => {
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

    it("blocks J (join lines)", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("J", ctx, buffer, false, true);
      expect(buffer.getContent()).toBe("hello\nworld");
      expect(result.newCtx.mode).toBe("normal");
    });

    it("blocks u (undo)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("u", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("normal");
    });

    it("blocks r (replace)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("r", ctx, buffer, false, true);
      expect(buffer.getContent()).toBe("hello");
    });

    it("blocks Ctrl-R (redo)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("r", ctx, buffer, true, true);
      expect(result.newCtx.mode).toBe("normal");
    });

    it("blocks : (ex command)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke(":", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("normal");
    });

    it("allows motions (h, j, k, l, w, e, b)", () => {
      const buffer = new TextBuffer("hello world\nsecond line");
      const ctx = createTestContext({ line: 0, col: 0 });

      // w: next word
      const r1 = processKeystroke("w", ctx, buffer, false, true);
      expect(r1.newCtx.cursor.col).toBe(6);

      // j: next line
      const r2 = processKeystroke("j", ctx, buffer, false, true);
      expect(r2.newCtx.cursor.line).toBe(1);
    });

    it("allows / (search)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("/", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("command-line");
      expect(result.newCtx.commandType).toBe("/");
    });

    it("allows v, V (visual mode)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const r1 = processKeystroke("v", ctx, buffer, false, true);
      expect(r1.newCtx.mode).toBe("visual");

      const r2 = processKeystroke("V", ctx, buffer, false, true);
      expect(r2.newCtx.mode).toBe("visual-line");
    });

    it("blocks d, x, c in visual mode", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { mode: "visual", visualAnchor: { line: 0, col: 0 } },
      );

      // Move cursor to create a selection
      const { ctx: afterMotion } = pressKeysReadOnly(["w"], ctx, buffer);

      for (const key of ["d", "x", "c"]) {
        const result = processKeystroke(key, afterMotion, buffer, false, true);
        expect(buffer.getContent()).toBe("hello world");
      }
    });

    it("allows y in visual mode", () => {
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

    it("forces back to normal mode when in insert mode", () => {
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
