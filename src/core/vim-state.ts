/**
 * vim-state.ts
 *
 * Vimの状態管理の中核。
 * 状態の初期化と、キーストロークを受けて適切なモードハンドラに委譲するディスパッチャ。
 *
 * 各モードの処理は個別ファイルに分割されている:
 * - normal-mode.ts: ノーマルモード
 * - insert-mode.ts: インサートモード
 * - visual-mode.ts: ビジュアルモード
 * - command-line-mode.ts: コマンドラインモード（:, /, ?）
 */

import type { CursorPosition, VimContext, VimAction } from "../types";
import type { TextBuffer } from "./buffer";
import { processNormalMode } from "./normal-mode";
import { processInsertMode } from "./insert-mode";
import { processVisualMode } from "./visual-mode";
import { processCommandLineMode } from "./command-line-mode";

/** processKeystroke の返り値 */
export interface KeystrokeResult {
  newCtx: VimContext;
  actions: VimAction[];
}

/**
 * VimContextの初期値を生成する。
 * コンポーネントのマウント時に1回だけ呼ばれる。
 */
export function createInitialContext(cursor: CursorPosition): VimContext {
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
    statusMessage: "",
  };
}

/**
 * カーソルポジション文字列（"1:1" 形式、1-based）を
 * 内部の0-based CursorPosition にパースする。
 */
export function parseCursorPosition(pos: string): CursorPosition {
  const parts = pos.split(":");
  const line = Math.max(0, (Number.parseInt(parts[0], 10) || 1) - 1);
  const col = Math.max(0, (Number.parseInt(parts[1], 10) || 1) - 1);
  return { line, col };
}

/**
 * メインのキーストローク処理ディスパッチャ。
 *
 * 現在のモードに応じて、対応するモードハンドラに処理を委譲する。
 * 各モードハンドラは新しいコンテキストとアクションリストを返す。
 *
 * @param key - KeyboardEvent.key の値
 * @param ctx - 現在のVimコンテキスト
 * @param buffer - テキストバッファ
 * @param ctrlKey - Ctrlキーが押されているか
 * @param readOnly - 読み取り専用モード
 */
export function processKeystroke(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean = false,
  readOnly: boolean = false,
): KeystrokeResult {
  switch (ctx.mode) {
    case "normal":
      return processNormalMode(key, ctx, buffer, ctrlKey, readOnly);
    case "insert":
      // readOnly: insertモードに到達すべきではないが安全のため強制的にnormalへ戻す
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
      return processVisualMode(key, ctx, buffer, ctrlKey, readOnly);
    case "command-line":
      return processCommandLineMode(key, ctx, buffer);
    default:
      return { newCtx: ctx, actions: [] };
  }
}
