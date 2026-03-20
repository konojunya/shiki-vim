/**
 * normal-mode.ts
 *
 * Normal mode keystroke processing.
 *
 * Normal mode is Vim's default mode and handles:
 * - Count prefixes (3j, 5dw, etc.)
 * - Operators (d, y, c) -> transition to operator-pending state
 * - Motions (h, j, k, l, w, e, b, etc.)
 * - Transition to insert mode (i, a, o, I, A, O)
 * - Edit commands (x, p, P, r, J)
 * - Transition to visual mode (v, V)
 * - Transition to command-line / search (:, /, ?)
 * - Undo / redo (u, Ctrl-R)
 * - g prefix commands (gg)
 * - Character-pending commands (f, F, t, T, r)
 */

import type { VimContext, VimAction, CursorPosition } from "../types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./vim-state";
import {
  isCountKey,
  isOperator,
  isCharCommand,
  getEffectiveCount,
  isCountExplicit,
  modeChange,
  accumulateCount,
  resetContext,
} from "./key-utils";
import { handleCtrlKey } from "./ctrl-keys";
import { resolveMotion } from "./motion-resolver";
import { executeOperatorOnRange, executeLineOperator } from "./operators";
import { handleCharPending } from "./char-pending";
import { motionGG } from "./motions";
import { searchInBuffer } from "./search";

/**
 * Main handler for normal mode.
 * Receives a keystroke and returns state transitions and actions.
 */
export function processNormalMode(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean,
  readOnly: boolean = false,
): KeystrokeResult {
  // --- g prefix pending ---
  if (ctx.phase === "g-pending") {
    return handleGPending(key, ctx, buffer);
  }

  // --- Character pending (f, F, t, T, r) ---
  if (ctx.phase === "char-pending") {
    return handleCharPending(key, ctx, buffer);
  }

  // --- Ctrl key combinations ---
  if (ctrlKey) {
    return handleCtrlKey(key, ctx, buffer, readOnly);
  }

  // --- readOnly: block mutating operations ---
  if (readOnly && ctx.phase === "idle") {
    // prettier-ignore
    const mutatingKeys = new Set([
      "i", "a", "o", "I", "A", "O",  // insert entry
      "x", "p", "P",                   // edit commands
      "d", "c",                         // mutating operators (y is allowed)
      "J",                              // join lines
      "u",                              // undo
      "r",                              // replace char
      ":",                              // ex commands
    ]);
    if (mutatingKeys.has(key)) {
      return { newCtx: resetContext(ctx), actions: [] };
    }
  }

  // --- Count input ---
  if (isCountKey(key, ctx)) {
    return accumulateCount(key, ctx);
  }

  // --- Key processing during operator-pending ---
  if (ctx.phase === "operator-pending" && ctx.operator) {
    return handleOperatorPending(key, ctx, buffer);
  }

  // --- Start operator ---
  if (isOperator(key)) {
    return {
      newCtx: {
        ...ctx,
        operator: key,
        phase: "operator-pending",
        statusMessage: key,
      },
      actions: [],
    };
  }

  // --- Motion ---
  const motionResult = tryMotion(key, ctx, buffer);
  if (motionResult) return motionResult;

  // --- g prefix ---
  if (key === "g") {
    return {
      newCtx: { ...ctx, phase: "g-pending" },
      actions: [],
    };
  }

  // --- Character-pending commands ---
  if (isCharCommand(key)) {
    return {
      newCtx: { ...ctx, phase: "char-pending", charCommand: key },
      actions: [],
    };
  }

  // --- Insert mode entry ---
  const insertResult = tryInsertEntry(key, ctx, buffer);
  if (insertResult) return insertResult;

  // --- Edit commands ---
  const editResult = tryEditCommand(key, ctx, buffer);
  if (editResult) return editResult;

  // --- undo ---
  if (key === "u") {
    return handleUndo(ctx, buffer);
  }

  // --- Visual mode ---
  if (key === "v") {
    return {
      newCtx: {
        ...ctx,
        mode: "visual",
        phase: "idle",
        count: 0,
        visualAnchor: { ...ctx.cursor },
        statusMessage: "-- VISUAL --",
      },
      actions: [{ type: "mode-change", mode: "visual" }],
    };
  }
  if (key === "V") {
    return {
      newCtx: {
        ...ctx,
        mode: "visual-line",
        phase: "idle",
        count: 0,
        visualAnchor: { ...ctx.cursor },
        statusMessage: "-- VISUAL LINE --",
      },
      actions: [{ type: "mode-change", mode: "visual-line" }],
    };
  }

  // --- Command-line / search ---
  if (key === ":" || key === "/" || key === "?") {
    return enterCommandLine(key as ":" | "/" | "?", ctx);
  }

  // --- n / N: repeat search ---
  if (key === "n" || key === "N") {
    return handleSearchRepeat(key, ctx, buffer);
  }

  // --- J: join lines ---
  if (key === "J") {
    return handleJoinLines(ctx, buffer);
  }

  // --- Unmatched key -> reset ---
  return {
    newCtx: resetContext(ctx),
    actions: [],
  };
}

// =====================
// Internal handlers
// =====================

/**
 * Key processing after g prefix.
 * gg -> move to the beginning of the file
 */
function handleGPending(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (key === "g") {
    const count = ctx.count > 0 ? ctx.count : null;
    const result = motionGG(ctx.cursor, buffer, count);

    // If in operator-pending state, execute the operator
    if (ctx.operator) {
      buffer.saveUndoPoint(ctx.cursor);
      const opResult = executeOperatorOnRange(
        ctx.operator,
        result.range,
        buffer,
        ctx.cursor,
      );
      return {
        newCtx: {
          ...resetContext(ctx),
          mode: opResult.newMode,
          cursor: opResult.newCursor,
          register: opResult.yankedText,
        },
        actions: [
          ...opResult.actions,
          { type: "cursor-move", position: opResult.newCursor },
          ...(opResult.newMode !== ctx.mode
            ? [{ type: "mode-change" as const, mode: opResult.newMode }]
            : []),
        ],
      };
    }

    return {
      newCtx: {
        ...resetContext(ctx),
        cursor: result.cursor,
      },
      actions: [{ type: "cursor-move", position: result.cursor }],
    };
  }

  // Unknown g command -> reset
  return {
    newCtx: resetContext(ctx),
    actions: [],
  };
}

/**
 * Key processing during operator-pending state.
 * Waits for a motion or count after the operator.
 */
function handleOperatorPending(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  // Count input
  if (isCountKey(key, ctx)) {
    return accumulateCount(key, ctx);
  }

  // Same operator key -> line operation (dd, yy, cc)
  if (key === ctx.operator) {
    buffer.saveUndoPoint(ctx.cursor);
    const count = getEffectiveCount(ctx);
    const result = executeLineOperator(ctx.operator!, ctx.cursor, count, buffer);

    return {
      newCtx: {
        ...resetContext(ctx),
        mode: result.newMode,
        cursor: result.newCursor,
        register: result.yankedText,
      },
      actions: [
        ...result.actions,
        { type: "cursor-move", position: result.newCursor },
        ...(result.newMode !== ctx.mode
          ? [{ type: "mode-change" as const, mode: result.newMode }]
          : []),
      ],
    };
  }

  // Character-pending commands (e.g., df{char})
  if (isCharCommand(key) && key !== "r") {
    return {
      newCtx: { ...ctx, phase: "char-pending", charCommand: key },
      actions: [],
    };
  }

  // g prefix (e.g., dgg)
  if (key === "g") {
    return {
      newCtx: { ...ctx, phase: "g-pending" },
      actions: [],
    };
  }

  // Motion
  const count = getEffectiveCount(ctx);
  const countExplicit = isCountExplicit(ctx);
  const motion = resolveMotion(key, ctx.cursor, buffer, count, countExplicit);

  if (motion) {
    buffer.saveUndoPoint(ctx.cursor);
    const result = executeOperatorOnRange(
      ctx.operator!,
      motion.range,
      buffer,
      ctx.cursor,
    );

    return {
      newCtx: {
        ...resetContext(ctx),
        mode: result.newMode,
        cursor: result.newCursor,
        register: result.yankedText,
      },
      actions: [
        ...result.actions,
        { type: "cursor-move", position: result.newCursor },
        ...(result.newMode !== ctx.mode
          ? [{ type: "mode-change" as const, mode: result.newMode }]
          : []),
      ],
    };
  }

  // Invalid key -> cancel operator
  return {
    newCtx: resetContext(ctx),
    actions: [],
  };
}

/**
 * Attempt to resolve and execute a motion.
 * Returns null if no motion matches.
 */
function tryMotion(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult | null {
  const count = getEffectiveCount(ctx);
  const countExplicit = isCountExplicit(ctx);
  const motion = resolveMotion(key, ctx.cursor, buffer, count, countExplicit);

  if (!motion) return null;

  return {
    newCtx: {
      ...resetContext(ctx),
      cursor: motion.cursor,
    },
    actions: [{ type: "cursor-move", position: motion.cursor }],
  };
}

/**
 * Attempt to transition to insert mode.
 * Handles i, a, I, A, o, O.
 */
function tryInsertEntry(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult | null {
  switch (key) {
    case "i":
      return modeChange(ctx, "insert");

    case "a": {
      // Move cursor one position to the right (do not exceed end of line)
      const col = Math.min(
        ctx.cursor.col + 1,
        buffer.getLineLength(ctx.cursor.line),
      );
      return modeChange(
        { ...ctx, cursor: { ...ctx.cursor, col } },
        "insert",
      );
    }

    case "I": {
      // Move to the first non-whitespace character on the line and enter insert
      const lineText = buffer.getLine(ctx.cursor.line);
      const col = lineText.match(/\S/)?.index ?? 0;
      return modeChange(
        { ...ctx, cursor: { ...ctx.cursor, col } },
        "insert",
      );
    }

    case "A": {
      // Move to end of line and enter insert
      const col = buffer.getLineLength(ctx.cursor.line);
      return modeChange(
        { ...ctx, cursor: { ...ctx.cursor, col } },
        "insert",
      );
    }

    case "o": {
      // Insert a blank line below the current line and enter insert
      buffer.saveUndoPoint(ctx.cursor);
      buffer.insertLine(ctx.cursor.line + 1, "");
      const newCursor = { line: ctx.cursor.line + 1, col: 0 };
      return {
        newCtx: {
          ...resetContext(ctx),
          mode: "insert",
          cursor: newCursor,
          statusMessage: "-- INSERT --",
        },
        actions: [
          { type: "content-change", content: buffer.getContent() },
          { type: "cursor-move", position: newCursor },
          { type: "mode-change", mode: "insert" },
        ],
      };
    }

    case "O": {
      // Insert a blank line above the current line and enter insert
      buffer.saveUndoPoint(ctx.cursor);
      buffer.insertLine(ctx.cursor.line, "");
      const newCursor = { line: ctx.cursor.line, col: 0 };
      return {
        newCtx: {
          ...resetContext(ctx),
          mode: "insert",
          cursor: newCursor,
          statusMessage: "-- INSERT --",
        },
        actions: [
          { type: "content-change", content: buffer.getContent() },
          { type: "cursor-move", position: newCursor },
          { type: "mode-change", mode: "insert" },
        ],
      };
    }

    default:
      return null;
  }
}

/**
 * Attempt to handle edit commands (x, p, P).
 */
function tryEditCommand(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult | null {
  const count = getEffectiveCount(ctx);

  switch (key) {
    case "x":
      return handleDeleteChar(ctx, buffer, count);
    case "p":
      return handlePasteAfter(ctx, buffer, count);
    case "P":
      return handlePasteBefore(ctx, buffer, count);
    default:
      return null;
  }
}

/**
 * x: Delete the character under the cursor
 */
function handleDeleteChar(
  ctx: VimContext,
  buffer: TextBuffer,
  count: number,
): KeystrokeResult {
  if (buffer.getLineLength(ctx.cursor.line) === 0) {
    return { newCtx: ctx, actions: [] };
  }

  buffer.saveUndoPoint(ctx.cursor);
  const deleted = buffer.deleteAt(ctx.cursor.line, ctx.cursor.col, count);
  const maxCol = Math.max(0, buffer.getLineLength(ctx.cursor.line) - 1);
  const newCursor = {
    line: ctx.cursor.line,
    col: Math.min(ctx.cursor.col, maxCol),
  };

  return {
    newCtx: {
      ...resetContext(ctx),
      register: deleted,
      cursor: newCursor,
    },
    actions: [
      { type: "yank", text: deleted },
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * p: Paste after the cursor
 */
function handlePasteAfter(
  ctx: VimContext,
  buffer: TextBuffer,
  count: number,
): KeystrokeResult {
  if (!ctx.register) return { newCtx: ctx, actions: [] };

  buffer.saveUndoPoint(ctx.cursor);

  // Line-wise paste (when the register ends with a newline)
  if (ctx.register.endsWith("\n")) {
    const lines = ctx.register.slice(0, -1).split("\n");
    for (let i = 0; i < count; i++) {
      for (let j = lines.length - 1; j >= 0; j--) {
        buffer.insertLine(ctx.cursor.line + 1, lines[j]);
      }
    }
    const newCursor = { line: ctx.cursor.line + 1, col: 0 };
    return {
      newCtx: { ...resetContext(ctx), cursor: newCursor },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: newCursor },
      ],
    };
  }

  // Character-wise paste
  const col = ctx.cursor.col + 1;
  for (let i = 0; i < count; i++) {
    buffer.insertAt(ctx.cursor.line, col, ctx.register);
  }
  const newCursor = {
    line: ctx.cursor.line,
    col: col + ctx.register.length * count - 1,
  };
  return {
    newCtx: { ...resetContext(ctx), cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * P: Paste before the cursor
 */
function handlePasteBefore(
  ctx: VimContext,
  buffer: TextBuffer,
  count: number,
): KeystrokeResult {
  if (!ctx.register) return { newCtx: ctx, actions: [] };

  buffer.saveUndoPoint(ctx.cursor);

  if (ctx.register.endsWith("\n")) {
    const lines = ctx.register.slice(0, -1).split("\n");
    for (let i = 0; i < count; i++) {
      for (let j = lines.length - 1; j >= 0; j--) {
        buffer.insertLine(ctx.cursor.line, lines[j]);
      }
    }
    const newCursor = { line: ctx.cursor.line, col: 0 };
    return {
      newCtx: { ...resetContext(ctx), cursor: newCursor },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: newCursor },
      ],
    };
  }

  for (let i = 0; i < count; i++) {
    buffer.insertAt(ctx.cursor.line, ctx.cursor.col, ctx.register);
  }
  const newCursor = {
    line: ctx.cursor.line,
    col: ctx.cursor.col + ctx.register.length * count - 1,
  };
  return {
    newCtx: { ...resetContext(ctx), cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * u: undo
 */
function handleUndo(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const restored = buffer.undo(ctx.cursor);

  if (restored) {
    return {
      newCtx: { ...resetContext(ctx), cursor: restored },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: restored },
      ],
    };
  }

  return {
    newCtx: { ...ctx, count: 0, statusMessage: "Already at oldest change" },
    actions: [
      { type: "status-message", message: "Already at oldest change" },
    ],
  };
}

/**
 * Transition to command-line / search mode
 */
function enterCommandLine(
  type: ":" | "/" | "?",
  ctx: VimContext,
): KeystrokeResult {
  return {
    newCtx: {
      ...ctx,
      mode: "command-line",
      commandType: type,
      commandBuffer: "",
      statusMessage: type,
      ...(type !== ":" && {
        searchDirection: type === "/" ? ("forward" as const) : ("backward" as const),
      }),
    },
    actions: [],
  };
}

/**
 * n / N: Repeat the last search
 */
function handleSearchRepeat(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (!ctx.lastSearch) {
    return { newCtx: ctx, actions: [] };
  }

  // N reverses the search direction
  const direction =
    key === "n"
      ? ctx.searchDirection
      : ctx.searchDirection === "forward"
        ? ("backward" as const)
        : ("forward" as const);

  const found = searchInBuffer(buffer, ctx.lastSearch, ctx.cursor, direction);

  if (found) {
    return {
      newCtx: { ...resetContext(ctx), cursor: found },
      actions: [{ type: "cursor-move", position: found }],
    };
  }

  return {
    newCtx: {
      ...ctx,
      count: 0,
      statusMessage: `Pattern not found: ${ctx.lastSearch}`,
    },
    actions: [
      {
        type: "status-message",
        message: `Pattern not found: ${ctx.lastSearch}`,
      },
    ],
  };
}

/**
 * J: Join the current line with the next line
 */
function handleJoinLines(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (ctx.cursor.line >= buffer.getLineCount() - 1) {
    return { newCtx: ctx, actions: [] };
  }

  buffer.saveUndoPoint(ctx.cursor);

  const currentLen = buffer.getLineLength(ctx.cursor.line);
  const nextLine = buffer.getLine(ctx.cursor.line + 1).trimStart();

  buffer.setLine(
    ctx.cursor.line,
    buffer.getLine(ctx.cursor.line) + " " + nextLine,
  );
  buffer.deleteLines(ctx.cursor.line + 1, 1);

  const newCursor = { line: ctx.cursor.line, col: currentLen };

  return {
    newCtx: { ...resetContext(ctx), cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}
