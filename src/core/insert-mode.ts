/**
 * insert-mode.ts
 *
 * インサートモードのキーストローク処理。
 *
 * インサートモードでは通常のテキスト入力を処理する:
 * - 文字入力: バッファに文字を挿入
 * - Backspace: 前の文字を削除（行頭ではprevious lineと結合）
 * - Delete: 次の文字を削除（行末ではnext lineと結合）
 * - Enter: 行を分割して新しい行を作成
 * - Tab: スペース2つを挿入（TODO: 設定可能にする）
 * - Escape: ノーマルモードに戻る
 */

import type { VimContext } from "../types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./vim-state";

/**
 * インサートモードのメインハンドラ。
 */
export function processInsertMode(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean,
): KeystrokeResult {
  // --- Escape → ノーマルモードへ ---
  if (key === "Escape") {
    return handleEscape(ctx);
  }

  // --- Ctrlキーコンビネーション ---
  if (ctrlKey) {
    // インサートモードではCtrlキーは基本的に無視
    // TODO: Ctrl-W (単語削除), Ctrl-U (行頭まで削除) など
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

  // --- 通常の文字入力 ---
  if (key.length === 1) {
    return handleCharInput(key, ctx, buffer);
  }

  // --- その他のキー（矢印キーなど）は無視 ---
  return { newCtx: ctx, actions: [] };
}

/**
 * Escape: インサートモードからノーマルモードへ。
 * カーソルを1つ左に戻す（Vimの仕様）。
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
 * Backspace: カーソル前の文字を削除。
 * 行頭の場合は前の行と結合する。
 */
function handleBackspace(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  // 行頭の場合
  if (ctx.cursor.col === 0) {
    // 1行目の先頭では何もしない
    if (ctx.cursor.line === 0) {
      return { newCtx: ctx, actions: [] };
    }

    // 前の行と結合
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

  // 通常のBackspace: 1文字削除
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
 * Delete: カーソル位置の文字を削除。
 * 行末の場合は次の行と結合する。
 */
function handleDelete(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  // 行末の場合
  if (ctx.cursor.col >= buffer.getLineLength(ctx.cursor.line)) {
    // 最終行の末尾では何もしない
    if (ctx.cursor.line >= buffer.getLineCount() - 1) {
      return { newCtx: ctx, actions: [] };
    }

    // 次の行と結合
    buffer.joinLines(ctx.cursor.line);
  } else {
    // 通常のDelete: 1文字削除
    buffer.deleteAt(ctx.cursor.line, ctx.cursor.col);
  }

  return {
    newCtx: ctx,
    actions: [{ type: "content-change", content: buffer.getContent() }],
  };
}

/**
 * Enter: 現在のカーソル位置で行を分割する。
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
 * Tab: スペース2つを挿入する。
 * TODO: インデント幅を設定可能にする
 */
function handleTab(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const indent = "  "; // 2 spaces
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
 * 通常の文字入力: カーソル位置に1文字挿入する。
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
