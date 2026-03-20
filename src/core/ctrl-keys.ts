/**
 * ctrl-keys.ts
 *
 * Ctrlキーとの組み合わせコマンドの処理。
 * - Ctrl-R: リドゥ
 * - Ctrl-U: 半ページ上スクロール
 * - Ctrl-D: 半ページ下スクロール
 */

import type { VimContext, VimAction } from "../types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./vim-state";

/**
 * Ctrlキーコンビネーションを処理する。
 * ノーマルモード・ビジュアルモードの両方から呼ばれる共通処理。
 */
export function handleCtrlKey(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  readOnly: boolean = false,
): KeystrokeResult {
  switch (key) {
    case "r":
      // readOnly: redo をブロック
      if (readOnly) return { newCtx: ctx, actions: [] };
      return handleCtrlR(ctx, buffer);
    case "u":
      return handleCtrlU(ctx);
    case "d":
      return handleCtrlD(ctx);
    default:
      return { newCtx: ctx, actions: [] };
  }
}

/**
 * Ctrl-R: リドゥ
 * 直前のundoを取り消す。
 */
function handleCtrlR(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const restored = buffer.redo(ctx.cursor);

  if (restored) {
    return {
      newCtx: { ...ctx, cursor: restored, count: 0, statusMessage: "" },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: restored },
      ],
    };
  }

  return {
    newCtx: { ...ctx, count: 0, statusMessage: "Already at newest change" },
    actions: [
      { type: "status-message", message: "Already at newest change" },
    ],
  };
}

/**
 * Ctrl-U: 半ページ上スクロール
 * 実際のスクロール量はコンポーネント側で計算する。
 */
function handleCtrlU(ctx: VimContext): KeystrokeResult {
  return {
    newCtx: { ...ctx, count: 0, statusMessage: "" },
    actions: [{ type: "scroll", direction: "up", amount: 0.5 }],
  };
}

/**
 * Ctrl-D: 半ページ下スクロール
 */
function handleCtrlD(ctx: VimContext): KeystrokeResult {
  return {
    newCtx: { ...ctx, count: 0, statusMessage: "" },
    actions: [{ type: "scroll", direction: "down", amount: 0.5 }],
  };
}
