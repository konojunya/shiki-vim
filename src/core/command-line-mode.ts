/**
 * command-line-mode.ts
 *
 * コマンドラインモードの処理。
 * :, /, ? で開始されるコマンド入力を処理する。
 *
 * 対応コマンド:
 * - :w → 保存（onSave コールバック呼び出し）
 * - /pattern → 前方検索
 * - ?pattern → 後方検索
 *
 * TODO:
 * - :q → 終了
 * - :wq → 保存して終了
 * - :{number} → 指定行へジャンプ
 * - :s/old/new/ → 置換
 */

import type { VimContext, VimAction } from "../types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./vim-state";
import { searchInBuffer } from "./search";

/**
 * コマンドラインモードのメインハンドラ。
 */
export function processCommandLineMode(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  // --- Escape → ノーマルモードへ ---
  if (key === "Escape") {
    return exitCommandLine(ctx);
  }

  // --- Enter → コマンド実行 ---
  if (key === "Enter") {
    return executeCommand(ctx, buffer);
  }

  // --- Backspace ---
  if (key === "Backspace") {
    return handleBackspace(ctx);
  }

  // --- 文字入力 ---
  if (key.length === 1) {
    return appendChar(key, ctx);
  }

  return { newCtx: ctx, actions: [] };
}

/**
 * コマンドラインモードを抜ける。
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
 * Enter: コマンドを実行する。
 * commandType に応じて実行内容が変わる。
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
 * Ex コマンド（: で始まるコマンド）の実行。
 */
function executeExCommand(
  cmd: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const actions: VimAction[] = [];

  switch (cmd.trim()) {
    case "w":
      // :w → 保存
      actions.push({ type: "save", content: buffer.getContent() });
      break;

    // TODO: 他のexコマンドを追加
    // case "q": ...
    // case "wq": ...
    default: {
      // 数値の場合は行ジャンプ
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
 * 検索コマンド（/ または ?）の実行。
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

  // パターンが見つからなかった場合
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
 * Backspace: コマンドバッファから1文字削除。
 * バッファが空の場合はコマンドラインモードを抜ける。
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
 * コマンドバッファに1文字追加。
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
