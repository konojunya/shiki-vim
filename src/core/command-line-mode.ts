/**
 * command-line-mode.ts
 *
 * Command-line mode processing.
 * Handles command input initiated by :, /, or ?.
 *
 * Supported commands:
 * - :w -> Save (invokes onSave callback)
 * - /pattern -> Forward search
 * - ?pattern -> Backward search
 *
 * TODO:
 * - :q -> Quit
 * - :wq -> Save and quit
 * - :{number} -> Jump to specified line
 * - :s/old/new/ -> Substitution
 */

import type { VimContext, VimAction } from "../types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./vim-state";
import { searchInBuffer } from "./search";

/**
 * Main handler for command-line mode.
 */
export function processCommandLineMode(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  // --- Escape -> return to normal mode ---
  if (key === "Escape") {
    return exitCommandLine(ctx);
  }

  // --- Enter -> execute command ---
  if (key === "Enter") {
    return executeCommand(ctx, buffer);
  }

  // --- Backspace ---
  if (key === "Backspace") {
    return handleBackspace(ctx);
  }

  // --- Character input ---
  if (key.length === 1) {
    return appendChar(key, ctx);
  }

  return { newCtx: ctx, actions: [] };
}

/**
 * Exit command-line mode.
 */
function exitCommandLine(ctx: VimContext): KeystrokeResult {
  return {
    newCtx: {
      ...ctx,
      mode: "normal",
      commandBuffer: "",
      commandType: null,
      statusMessage: "",
    },
    actions: [{ type: "mode-change", mode: "normal" }],
  };
}

/**
 * Enter: Execute the command.
 * Execution behavior depends on the commandType.
 */
function executeCommand(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const cmd = ctx.commandBuffer;

  if (ctx.commandType === ":") {
    return executeExCommand(cmd, ctx, buffer);
  }

  if (ctx.commandType === "/" || ctx.commandType === "?") {
    return executeSearch(cmd, ctx, buffer);
  }

  return exitCommandLine(ctx);
}

/**
 * Execute an Ex command (a command starting with :).
 */
function executeExCommand(
  cmd: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const actions: VimAction[] = [];

  switch (cmd.trim()) {
    case "w":
      // :w -> save
      actions.push({ type: "save", content: buffer.getContent() });
      break;

    case "set number":
    case "set nu":
      actions.push({ type: "set-option", option: "number", value: true });
      break;

    case "set nonumber":
    case "set nonu":
      actions.push({ type: "set-option", option: "number", value: false });
      break;

    default: {
      // If numeric, jump to that line
      const lineNum = Number.parseInt(cmd.trim(), 10);
      if (!Number.isNaN(lineNum)) {
        const targetLine = Math.max(
          0,
          Math.min(lineNum - 1, buffer.getLineCount() - 1),
        );
        const newCursor = { line: targetLine, col: 0 };
        return {
          newCtx: {
            ...ctx,
            mode: "normal",
            commandBuffer: "",
            commandType: null,
            cursor: newCursor,
            statusMessage: "",
          },
          actions: [
            { type: "mode-change", mode: "normal" },
            { type: "cursor-move", position: newCursor },
          ],
        };
      }
      break;
    }
  }

  return {
    newCtx: {
      ...ctx,
      mode: "normal",
      commandBuffer: "",
      commandType: null,
      statusMessage: "",
    },
    actions: [{ type: "mode-change", mode: "normal" }, ...actions],
  };
}

/**
 * Execute a search command (/ or ?).
 */
function executeSearch(
  pattern: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (!pattern) {
    return exitCommandLine(ctx);
  }

  const direction =
    ctx.commandType === "/" ? "forward" : "backward";

  const found = searchInBuffer(buffer, pattern, ctx.cursor, direction as "forward" | "backward");

  if (found) {
    return {
      newCtx: {
        ...ctx,
        mode: "normal",
        commandBuffer: "",
        commandType: null,
        lastSearch: pattern,
        searchDirection: direction as "forward" | "backward",
        cursor: found,
        statusMessage: "",
      },
      actions: [
        { type: "mode-change", mode: "normal" },
        { type: "cursor-move", position: found },
      ],
    };
  }

  // Pattern not found
  return {
    newCtx: {
      ...ctx,
      mode: "normal",
      commandBuffer: "",
      commandType: null,
      lastSearch: pattern,
      searchDirection: direction as "forward" | "backward",
      statusMessage: `Pattern not found: ${pattern}`,
    },
    actions: [
      { type: "mode-change", mode: "normal" },
      { type: "status-message", message: `Pattern not found: ${pattern}` },
    ],
  };
}

/**
 * Backspace: Delete one character from the command buffer.
 * If the buffer is empty, exit command-line mode.
 */
function handleBackspace(ctx: VimContext): KeystrokeResult {
  if (ctx.commandBuffer.length === 0) {
    return exitCommandLine(ctx);
  }

  const newBuffer = ctx.commandBuffer.slice(0, -1);
  return {
    newCtx: {
      ...ctx,
      commandBuffer: newBuffer,
      statusMessage: (ctx.commandType ?? "") + newBuffer,
    },
    actions: [],
  };
}

/**
 * Append one character to the command buffer.
 */
function appendChar(key: string, ctx: VimContext): KeystrokeResult {
  const newBuffer = ctx.commandBuffer + key;
  return {
    newCtx: {
      ...ctx,
      commandBuffer: newBuffer,
      statusMessage: (ctx.commandType ?? "") + newBuffer,
    },
    actions: [],
  };
}
