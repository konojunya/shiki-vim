/**
 * command-line-mode.test.ts
 *
 * Integration tests for command-line mode.
 * Verifies : commands, / forward search, ? backward search, Backspace, and Escape.
 */

import { describe, it, expect } from "vitest";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "./vim-state";
import { TextBuffer } from "./buffer";

// =====================
// Helper functions
// =====================

/** Create a VimContext in command-line mode for testing */
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

describe("Command-line mode", () => {
  // ---------------------------------------------------
  // :w (save)
  // ---------------------------------------------------
  describe(":w command (save)", () => {
    it("issues a save action with :w", () => {
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

    it("clears the command buffer after :w", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result } = pressKeys(["w", "Enter"], ctx, buffer);
      expect(result.commandBuffer).toBe("");
      expect(result.commandType).toBeNull();
    });
  });

  // ---------------------------------------------------
  // /pattern (forward search)
  // ---------------------------------------------------
  describe("/pattern (forward search)", () => {
    it("searches forward for 'foo' and moves the cursor to the match position with /foo", () => {
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

    it("displays a status message when there is no match", () => {
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

    it("just exits command-line mode when pressing Enter with an empty pattern", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, "/");
      const { ctx: result } = pressKeys(["Enter"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // ?pattern (backward search)
  // ---------------------------------------------------
  describe("?pattern (backward search)", () => {
    it("searches backward for 'foo' with ?foo", () => {
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

    it("displays a message when backward search finds no match", () => {
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
  // Backspace (command buffer editing)
  // ---------------------------------------------------
  describe("Backspace (command buffer editing)", () => {
    it("deletes the last character from the command buffer with Backspace", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":", {
        commandBuffer: "wq",
        statusMessage: ":wq",
      });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(result.commandBuffer).toBe("w");
      expect(result.statusMessage).toBe(":w");
    });

    it("exits command-line mode when pressing Backspace with an empty command buffer", () => {
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
  // Escape (exit command-line mode)
  // ---------------------------------------------------
  describe("Escape (exit command-line mode)", () => {
    it("exits command-line mode and returns to normal mode with Escape", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":", {
        commandBuffer: "some",
      });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.mode).toBe("normal");
      expect(result.commandBuffer).toBe("");
      expect(result.commandType).toBeNull();
    });

    it("can exit search mode with Escape as well", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, "/", {
        commandBuffer: "pattern",
      });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // :{number} (line jump)
  // ---------------------------------------------------
  describe(":{number} (line jump)", () => {
    it("jumps to line 3 (0-based line 2) with :3", () => {
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

    it("jumps to line 1 with :1", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createCommandLineContext({ line: 2, col: 3 }, ":");
      const { ctx: result } = pressKeys(["1", "Enter"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 0, col: 0 });
    });

    it("clamps when the number exceeds the buffer line count", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result } = pressKeys(
        ["9", "9", "9", "Enter"],
        ctx,
        buffer,
      );
      expect(result.cursor.line).toBe(2); // last line
    });

    it("clamps :0 to line 1", () => {
      const buffer = new TextBuffer("line1\nline2");
      const ctx = createCommandLineContext({ line: 1, col: 0 }, ":");
      const { ctx: result } = pressKeys(["0", "Enter"], ctx, buffer);
      expect(result.cursor.line).toBe(0);
    });
  });

  // ---------------------------------------------------
  // Character input
  // ---------------------------------------------------
  describe("Character input", () => {
    it("appends characters to the command buffer", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result } = pressKeys(["h", "e", "l", "p"], ctx, buffer);
      expect(result.commandBuffer).toBe("help");
      expect(result.statusMessage).toBe(":help");
    });

    it("ignores special keys (long key names)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":", {
        commandBuffer: "test",
      });
      const { ctx: result } = pressKeys(["ArrowLeft"], ctx, buffer);
      expect(result.commandBuffer).toBe("test");
    });
  });

  // ---------------------------------------------------
  // :set number / :set nonumber
  // ---------------------------------------------------
  describe(":set number / :set nonumber", () => {
    it("emits set-option number=true with :set number", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result, allActions } = pressKeys(
        [..."set number", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(allActions).toContainEqual({
        type: "set-option",
        option: "number",
        value: true,
      });
    });

    it("emits set-option number=false with :set nonumber", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result, allActions } = pressKeys(
        [..."set nonumber", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(allActions).toContainEqual({
        type: "set-option",
        option: "number",
        value: false,
      });
    });

    it("emits set-option with short form :set nu / :set nonu", () => {
      const buffer = new TextBuffer("hello");
      const ctx1 = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { allActions: a1 } = pressKeys([..."set nu", "Enter"], ctx1, buffer);
      expect(a1).toContainEqual({ type: "set-option", option: "number", value: true });

      const ctx2 = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { allActions: a2 } = pressKeys([..."set nonu", "Enter"], ctx2, buffer);
      expect(a2).toContainEqual({ type: "set-option", option: "number", value: false });
    });
  });

  // ---------------------------------------------------
  // Integration test: search from normal mode and return
  // ---------------------------------------------------
  describe("Integration tests", () => {
    it("searches by typing /hello from normal mode end-to-end", () => {
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

    it("jumps to line 5 by typing :5 from normal mode", () => {
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
