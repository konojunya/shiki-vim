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
    commandBuffer: "",
    commandType: null,
    lastSearch: "",
    searchDirection: "forward",
    charCommand: null,
    lastCharSearch: null,
    textObjectModifier: null,
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
