/**
 * vim-state.ts
 *
 * Core of Vim state management.
 * Initializes state and dispatches keystrokes to the appropriate mode handler.
 *
 * Each mode's processing is split into its own file:
 * - normal-mode.ts: Normal mode
 * - insert-mode.ts: Insert mode
 * - visual-mode.ts: Visual mode
 * - command-line-mode.ts: Command-line mode (:, /, ?)
 */

import type { CursorPosition, VimContext, VimAction } from "../types";
import type { TextBuffer } from "./buffer";
import { processNormalMode } from "./normal-mode";
import { processInsertMode } from "./insert-mode";
import { processVisualMode } from "./visual-mode";
import { processCommandLineMode } from "./command-line-mode";

/** Modifier-only keys that should be ignored */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key);
}

/** Return value of processKeystroke */
export interface KeystrokeResult {
  newCtx: VimContext;
  actions: VimAction[];
}

/**
 * Generate the initial VimContext value.
 * Called once when the component mounts.
 */
export function createInitialContext(
  cursor: CursorPosition,
  opts?: { indentStyle?: "space" | "tab"; indentWidth?: number },
): VimContext {
  return {
    mode: "normal",
    phase: "idle",
    count: 0,
    operator: null,
    cursor,
    visualAnchor: null,
    register: "",
    registers: {},
    selectedRegister: null,
    commandBuffer: "",
    commandType: null,
    lastSearch: "",
    searchDirection: "forward",
    charCommand: null,
    lastCharSearch: null,
    textObjectModifier: null,
    lastChange: [],
    pendingChange: [],
    blockInsert: null,
    statusMessage: "",
    indentStyle: opts?.indentStyle ?? "space",
    indentWidth: opts?.indentWidth ?? 2,
    viewportTopLine: 0,
    viewportHeight: 50,
  };
}

/**
 * Parse a cursor position string ("1:1" format, 1-based)
 * into an internal 0-based CursorPosition.
 */
export function parseCursorPosition(pos: string): CursorPosition {
  const parts = pos.split(":");
  const line = Math.max(0, (Number.parseInt(parts[0], 10) || 1) - 1);
  const col = Math.max(0, (Number.parseInt(parts[1], 10) || 1) - 1);
  return { line, col };
}

/**
 * Main keystroke processing dispatcher.
 *
 * Delegates processing to the corresponding mode handler based on the current mode.
 * Each mode handler returns a new context and a list of actions.
 *
 * @param key - The value of KeyboardEvent.key
 * @param ctx - The current Vim context
 * @param buffer - The text buffer
 * @param ctrlKey - Whether the Ctrl key is pressed
 * @param readOnly - Read-only mode
 */
export function processKeystroke(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean = false,
  readOnly: boolean = false,
): KeystrokeResult {
  // Ignore modifier-only keys (Shift, Control, Alt, Meta).
  // These fire as separate keydown events and must not reset state (e.g. count).
  if (isModifierKey(key)) {
    return { newCtx: ctx, actions: [] };
  }

  // --- Dot repeat: replay the last change ---
  if (key === "." && ctx.mode === "normal" && ctx.phase === "idle" && ctx.lastChange.length > 0) {
    return replayLastChange(ctx, buffer, readOnly);
  }

  const result = processKeystrokeInner(key, ctx, buffer, ctrlKey, readOnly);
  return trackChange(key, ctx, result);
}

/**
 * Inner keystroke dispatcher (without change tracking).
 */
function processKeystrokeInner(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean,
  readOnly: boolean,
): KeystrokeResult {
  switch (ctx.mode) {
    case "normal":
      return processNormalMode(key, ctx, buffer, ctrlKey, readOnly);
    case "insert":
      // readOnly: should not reach insert mode, but force return to normal mode as a safety measure
      if (readOnly) {
        return {
          newCtx: {
            ...ctx,
            mode: "normal",
            phase: "idle",
            count: 0,
            operator: null,
            statusMessage: "",
          },
          actions: [{ type: "mode-change", mode: "normal" }],
        };
      }
      return processInsertMode(key, ctx, buffer, ctrlKey);
    case "visual":
    case "visual-line":
    case "visual-block":
      return processVisualMode(key, ctx, buffer, ctrlKey, readOnly);
    case "command-line":
      return processCommandLineMode(key, ctx, buffer);
    default:
      return { newCtx: ctx, actions: [] };
  }
}

/**
 * Track change key sequences for dot-repeat.
 *
 * A "change" starts when:
 * - An operator is started (d, c) or a mutating command is pressed (x, ~, etc.)
 * - Insert mode is entered
 *
 * A "change" ends when:
 * - We return to normal mode idle after a buffer mutation
 *
 * During a change, all keys are accumulated in pendingChange.
 * When complete, pendingChange is saved to lastChange.
 */
function trackChange(
  key: string,
  prevCtx: VimContext,
  result: KeystrokeResult,
): KeystrokeResult {
  const newCtx = result.newCtx;
  const hasContentChange = result.actions.some(
    (a) => a.type === "content-change",
  );

  const wasInChange = prevCtx.pendingChange.length > 0;
  const prevWasNormal = prevCtx.mode === "normal";
  const nowNormalIdle = newCtx.mode === "normal" && newCtx.phase === "idle";
  const enteredInsert =
    newCtx.mode === "insert" && prevCtx.mode !== "insert";
  const enteredOperatorPending =
    newCtx.phase === "operator-pending" && prevCtx.phase === "idle";
  const enteredCharPending =
    newCtx.phase === "char-pending" && prevCtx.phase !== "char-pending";
  const enteredTextObjectPending =
    newCtx.phase === "text-object-pending" &&
    prevCtx.phase !== "text-object-pending";

  // In insert mode, keep accumulating
  if (prevCtx.mode === "insert" && newCtx.mode === "insert") {
    return {
      ...result,
      newCtx: {
        ...newCtx,
        pendingChange: [...newCtx.pendingChange, key],
      },
    };
  }

  // Returning from insert to normal -> change complete
  if (prevCtx.mode === "insert" && nowNormalIdle) {
    const change = [...prevCtx.pendingChange, key];
    return {
      ...result,
      newCtx: {
        ...newCtx,
        lastChange: change,
        pendingChange: [],
      },
    };
  }

  // Starting a change from normal: operator, char-pending, or entering insert
  if (prevWasNormal && (enteredOperatorPending || enteredCharPending || enteredInsert)) {
    // If already accumulating (e.g., ciw enters insert from operator-pending),
    // keep the existing pendingChange
    const pending = wasInChange
      ? [...prevCtx.pendingChange, key]
      : [key];
    return {
      ...result,
      newCtx: {
        ...newCtx,
        pendingChange: pending,
      },
    };
  }

  // Accumulating in operator-pending / char-pending / text-object-pending
  if (wasInChange && !nowNormalIdle) {
    return {
      ...result,
      newCtx: {
        ...newCtx,
        pendingChange: [...prevCtx.pendingChange, key],
      },
    };
  }

  // Change completed in one step from pending state back to normal
  if (wasInChange && nowNormalIdle) {
    const change = [...prevCtx.pendingChange, key];
    // Only save if there was an actual content change
    if (hasContentChange) {
      return {
        ...result,
        newCtx: {
          ...newCtx,
          lastChange: change,
          pendingChange: [],
        },
      };
    }
    // No content change (e.g., yy) -> discard pending
    return {
      ...result,
      newCtx: {
        ...newCtx,
        pendingChange: [],
      },
    };
  }

  // Immediate single-key change (x, ~, J, p, P, D)
  if (prevWasNormal && nowNormalIdle && hasContentChange) {
    // Include any count keys that were accumulated
    const countKeys = prevCtx.count > 0 ? String(prevCtx.count).split("") : [];
    return {
      ...result,
      newCtx: {
        ...newCtx,
        lastChange: [...countKeys, key],
        pendingChange: [],
      },
    };
  }

  return result;
}

/**
 * Replay the last change key sequence.
 */
function replayLastChange(
  ctx: VimContext,
  buffer: TextBuffer,
  readOnly: boolean,
): KeystrokeResult {
  let current = { ...ctx, pendingChange: [] as string[] };
  const allActions: import("../types").VimAction[] = [];

  for (const k of ctx.lastChange) {
    const ctrlKey = false; // TODO: handle Ctrl in replay if needed
    const inner = processKeystrokeInner(k, current, buffer, ctrlKey, readOnly);
    current = inner.newCtx;
    allActions.push(...inner.actions);
  }

  // Preserve lastChange (don't overwrite with the replay)
  current.lastChange = ctx.lastChange;
  current.pendingChange = [];

  return {
    newCtx: current,
    actions: allActions,
  };
}
