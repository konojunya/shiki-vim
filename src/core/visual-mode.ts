/**
 * visual-mode.ts
 *
 * Visual mode (v, V) keystroke processing.
 *
 * In visual mode:
 * - The range is defined by the anchor (selection start) and cursor (selection end)
 * - Motions move the cursor, expanding/shrinking the selection
 * - Operators (d, y, c, x) act on the selected range
 * - Escape returns to normal mode
 * - v / V toggles between selection modes
 *
 * visual:      Character-wise selection
 * visual-line: Line-wise selection
 */

import type { CursorPosition, VimContext, Operator } from "../types";
import type { TextBuffer } from "./buffer";
import type { MotionResult, MotionRange } from "./motions";
import type { KeystrokeResult } from "./vim-state";
import {
  isCountKey,
  getEffectiveCount,
  isCountExplicit,
  resetContext,
} from "./key-utils";
import { handleCtrlKey } from "./ctrl-keys";
import { resolveMotion } from "./motion-resolver";
import { executeOperatorOnRange } from "./operators";
import { motionGG } from "./motions";

/**
 * Main handler for visual mode.
 */
export function processVisualMode(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean,
  readOnly: boolean = false,
): KeystrokeResult {
  // --- Escape -> return to normal mode ---
  if (key === "Escape") {
    return exitVisualMode(ctx);
  }

  // --- g-pending ---
  if (ctx.phase === "g-pending") {
    return handleGPendingInVisual(key, ctx, buffer);
  }

  // --- Ctrl key ---
  if (ctrlKey) {
    return handleCtrlKey(key, ctx, buffer);
  }

  // --- Count ---
  if (isCountKey(key, ctx)) {
    return {
      newCtx: { ...ctx, count: ctx.count * 10 + Number.parseInt(key, 10) },
      actions: [],
    };
  }

  // --- Motion ---
  const count = getEffectiveCount(ctx);
  const countExplicit = isCountExplicit(ctx);
  const motion = resolveMotion(key, ctx.cursor, buffer, count, countExplicit, ctx);
  if (motion) {
    return {
      newCtx: {
        ...ctx,
        cursor: motion.cursor,
        count: 0,
      },
      actions: [{ type: "cursor-move", position: motion.cursor }],
    };
  }

  // --- g prefix ---
  if (key === "g") {
    return {
      newCtx: { ...ctx, phase: "g-pending" },
      actions: [],
    };
  }

  // --- Operator execution ---
  if (key === "d" || key === "x" || key === "y" || key === "c") {
    // readOnly: block delete/change (y is allowed)
    if (readOnly && key !== "y") {
      return { newCtx: ctx, actions: [] };
    }
    return executeVisualOperator(key, ctx, buffer);
  }

  // --- Mode switch ---
  if (key === "v") {
    return ctx.mode === "visual"
      ? exitVisualMode(ctx)
      : switchVisualSubMode(ctx, "visual");
  }
  if (key === "V") {
    return ctx.mode === "visual-line"
      ? exitVisualMode(ctx)
      : switchVisualSubMode(ctx, "visual-line");
  }

  return { newCtx: ctx, actions: [] };
}

/**
 * Exit visual mode and return to normal mode.
 */
function exitVisualMode(ctx: VimContext): KeystrokeResult {
  return {
    newCtx: {
      ...resetContext(ctx),
      mode: "normal",
      visualAnchor: null,
    },
    actions: [{ type: "mode-change", mode: "normal" }],
  };
}

/**
 * Switch between visual sub-modes (visual <-> visual-line).
 */
function switchVisualSubMode(
  ctx: VimContext,
  mode: "visual" | "visual-line",
): KeystrokeResult {
  const statusMessage =
    mode === "visual" ? "-- VISUAL --" : "-- VISUAL LINE --";

  return {
    newCtx: { ...ctx, mode, statusMessage },
    actions: [{ type: "mode-change", mode }],
  };
}

/**
 * Handle g prefix (gg)
 */
function handleGPendingInVisual(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (key === "g") {
    const count = ctx.count > 0 ? ctx.count : null;
    const result = motionGG(ctx.cursor, buffer, count);
    return {
      newCtx: {
        ...ctx,
        phase: "idle",
        count: 0,
        cursor: result.cursor,
      },
      actions: [{ type: "cursor-move", position: result.cursor }],
    };
  }

  // Unknown g command -> reset
  return {
    newCtx: { ...ctx, phase: "idle", count: 0 },
    actions: [],
  };
}

/**
 * Execute an operator on the visual selection range.
 *
 * d / x: Delete
 * y: Yank
 * c: Change (delete and enter insert mode)
 */
function executeVisualOperator(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (!ctx.visualAnchor) {
    return { newCtx: ctx, actions: [] };
  }

  buffer.saveUndoPoint(ctx.cursor);

  // x behaves the same as d
  const operator: Operator = key === "x" ? "d" : (key as Operator);

  // Normalize the selection range (start <= end)
  const { start, end } = normalizeSelection(ctx.visualAnchor, ctx.cursor);
  const isLinewise = ctx.mode === "visual-line";

  const range: MotionRange = {
    start,
    end: isLinewise ? { line: end.line, col: 0 } : end,
    linewise: isLinewise,
    inclusive: true,
  };

  const result = executeOperatorOnRange(operator, range, buffer, ctx.cursor);

  return {
    newCtx: {
      ...resetContext(ctx),
      mode: result.newMode,
      cursor: result.newCursor,
      register: result.yankedText,
      visualAnchor: null,
      statusMessage:
        result.newMode === "insert"
          ? "-- INSERT --"
          : result.statusMessage || "",
    },
    actions: [
      ...result.actions,
      { type: "cursor-move", position: result.newCursor },
      { type: "mode-change", mode: result.newMode },
    ],
  };
}

/**
 * Normalize two cursor positions so that start <= end.
 */
function normalizeSelection(
  a: CursorPosition,
  b: CursorPosition,
): { start: CursorPosition; end: CursorPosition } {
  if (a.line < b.line || (a.line === b.line && a.col <= b.col)) {
    return { start: a, end: b };
  }
  return { start: b, end: a };
}
