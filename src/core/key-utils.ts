/**
 * key-utils.ts
 *
 * キーストローク処理に関するユーティリティ関数。
 * カウント判定、オペレーター判定、モード遷移のヘルパーなど。
 */

import type {
  VimContext,
  VimAction,
  VimMode,
  Operator,
  CharCommand,
} from "../types";
import type { KeystrokeResult } from "./vim-state";

/**
 * キーがカウント入力かどうかを判定する。
 * - 1-9 は常にカウント
 * - 0 はカウントが既に入力されている場合のみカウント（それ以外は行頭移動）
 */
export function isCountKey(key: string, ctx: VimContext): boolean {
  if (key >= "1" && key <= "9") return true;
  if (key === "0" && ctx.count > 0) return true;
  return false;
}

/**
 * キーがオペレーターかどうかを判定する。
 * d: delete, y: yank, c: change
 */
export function isOperator(key: string): key is Operator {
  return key === "d" || key === "y" || key === "c";
}

/**
 * キーが文字待ちコマンドかどうかを判定する。
 * f: 前方文字検索, F: 後方文字検索
 * t: 前方文字検索（手前）, T: 後方文字検索（手前）
 * r: 1文字置換
 */
export function isCharCommand(key: string): key is CharCommand {
  return (
    key === "f" || key === "F" || key === "t" || key === "T" || key === "r"
  );
}

/**
 * カウント値を取得する。0の場合は1として扱う。
 * Vimではカウント未指定は暗黙的に1回。
 */
export function getEffectiveCount(ctx: VimContext): number {
  return Math.max(1, ctx.count);
}

/**
 * カウントが明示的に指定されたかどうか。
 * gg と G の挙動を分けるために必要。
 * - gg: カウントなし → ファイル先頭、カウントあり → 指定行へ
 * - G: カウントなし → ファイル末尾、カウントあり → 指定行へ
 */
export function isCountExplicit(ctx: VimContext): boolean {
  return ctx.count > 0;
}

/**
 * モード遷移用のヘルパー。
 * モードに応じたステータスメッセージも設定する。
 */
export function modeChange(
  ctx: VimContext,
  mode: VimMode,
): KeystrokeResult {
  const statusMessage = getModeStatusMessage(mode);

  return {
    newCtx: {
      ...ctx,
      mode,
      phase: "idle",
      count: 0,
      operator: null,
      statusMessage,
    },
    actions: [{ type: "mode-change", mode }],
  };
}

/**
 * モードに対応するステータスメッセージを取得する。
 */
export function getModeStatusMessage(mode: VimMode): string {
  switch (mode) {
    case "insert":
      return "-- INSERT --";
    case "visual":
      return "-- VISUAL --";
    case "visual-line":
      return "-- VISUAL LINE --";
    case "visual-block":
      return "-- VISUAL BLOCK --";
    default:
      return "";
  }
}

/**
 * カウントを蓄積する。
 * 例: count=3 のとき key="2" → count=32
 */
export function accumulateCount(
  key: string,
  ctx: VimContext,
): KeystrokeResult {
  const newCount = ctx.count * 10 + Number.parseInt(key, 10);
  return {
    newCtx: { ...ctx, count: newCount },
    actions: [],
  };
}

/**
 * コンテキストをリセットする（コマンドが完了または無効になったとき）。
 */
export function resetContext(ctx: VimContext): VimContext {
  return {
    ...ctx,
    phase: "idle",
    count: 0,
    operator: null,
    charCommand: null,
    statusMessage: "",
  };
}
