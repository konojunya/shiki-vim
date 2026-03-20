/**
 * insert-mode.ts
 *
 * Insert mode keystroke processing.
 *
 * Insert mode handles normal text input:
 * - Character input: Insert a character into the buffer
 * - Backspace: Delete the previous character (join with previous line at line start)
 * - Delete: Delete the next character (join with next line at line end)
 * - Enter: Split the line and create a new line
 * - Tab: Insert two spaces (TODO: make indent width configurable)
 * - Escape: Return to normal mode
 */

import type { VimContext } from "../types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./vim-state";

/**
 * Main handler for insert mode.
 */
export function processInsertMode(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean,
): KeystrokeResult {
  // --- Escape -> return to normal mode ---
  if (key === "Escape") {
    return handleEscape(ctx);
  }

  // --- Ctrl key combinations ---
  if (ctrlKey) {
    // In insert mode, Ctrl key combinations are generally ignored
    // TODO: Ctrl-W (delete word), Ctrl-U (delete to beginning of line), etc.
    return { newCtx: ctx, actions: [] };
  }

  // --- Backspace ---
  if (key === "Backspace") {
    return handleBackspace(ctx, buffer);
  }

  // --- Delete ---
  if (key === "Delete") {
    return handleDelete(ctx, buffer);
  }

  // --- Enter ---
  if (key === "Enter") {
    return handleEnter(ctx, buffer);
  }

  // --- Tab ---
  if (key === "Tab") {
    return handleTab(ctx, buffer);
  }

  // --- Normal character input ---
  if (key.length === 1) {
    return handleCharInput(key, ctx, buffer);
  }

  // --- Other keys (arrow keys, etc.) are ignored ---
  return { newCtx: ctx, actions: [] };
}

/**
 * Escape: Transition from insert mode to normal mode.
 * Move the cursor one position to the left (Vim behavior).
 */
function handleEscape(ctx: VimContext): KeystrokeResult {
  const col = Math.max(0, ctx.cursor.col - 1);
  const newCursor = { line: ctx.cursor.line, col };

  return {
    newCtx: {
      ...ctx,
      mode: "normal",
      phase: "idle",
      count: 0,
      operator: null,
      cursor: newCursor,
      statusMessage: "",
    },
    actions: [
      { type: "cursor-move", position: newCursor },
      { type: "mode-change", mode: "normal" },
    ],
  };
}

/**
 * Backspace: Delete the character before the cursor.
 * At the beginning of a line, join with the previous line.
 */
function handleBackspace(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  // At the beginning of a line
  if (ctx.cursor.col === 0) {
    // Do nothing at the start of the first line
    if (ctx.cursor.line === 0) {
      return { newCtx: ctx, actions: [] };
    }

    // Join with the previous line
    const prevLineLen = buffer.getLineLength(ctx.cursor.line - 1);
    buffer.joinLines(ctx.cursor.line - 1);
    const newCursor = { line: ctx.cursor.line - 1, col: prevLineLen };

    return {
      newCtx: { ...ctx, cursor: newCursor },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: newCursor },
      ],
    };
  }

  // Normal Backspace: delete one character
  buffer.deleteAt(ctx.cursor.line, ctx.cursor.col - 1);
  const newCursor = { line: ctx.cursor.line, col: ctx.cursor.col - 1 };

  return {
    newCtx: { ...ctx, cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * Delete: Delete the character at the cursor position.
 * At the end of a line, join with the next line.
 */
function handleDelete(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  // At the end of a line
  if (ctx.cursor.col >= buffer.getLineLength(ctx.cursor.line)) {
    // Do nothing at the end of the last line
    if (ctx.cursor.line >= buffer.getLineCount() - 1) {
      return { newCtx: ctx, actions: [] };
    }

    // Join with the next line
    buffer.joinLines(ctx.cursor.line);
  } else {
    // Normal Delete: delete one character
    buffer.deleteAt(ctx.cursor.line, ctx.cursor.col);
  }

  return {
    newCtx: ctx,
    actions: [{ type: "content-change", content: buffer.getContent() }],
  };
}

/**
 * Enter: Split the line at the current cursor position.
 */
function handleEnter(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  buffer.splitLine(ctx.cursor.line, ctx.cursor.col);
  const newCursor = { line: ctx.cursor.line + 1, col: 0 };

  return {
    newCtx: { ...ctx, cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * Tab: Insert indentation based on context settings.
 */
function handleTab(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const indent =
    ctx.indentStyle === "tab" ? "\t" : " ".repeat(ctx.indentWidth);
  buffer.insertAt(ctx.cursor.line, ctx.cursor.col, indent);
  const newCursor = {
    line: ctx.cursor.line,
    col: ctx.cursor.col + indent.length,
  };

  return {
    newCtx: { ...ctx, cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * Normal character input: Insert one character at the cursor position.
 */
function handleCharInput(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  buffer.insertAt(ctx.cursor.line, ctx.cursor.col, key);
  const newCursor = {
    line: ctx.cursor.line,
    col: ctx.cursor.col + 1,
  };

  return {
    newCtx: { ...ctx, cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}
