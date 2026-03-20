/**
 * visual-mode.ts
 *
 * ビジュアルモード (v, V) のキーストローク処理。
 *
 * ビジュアルモードでは:
 * - アンカー（選択開始位置）とカーソル（選択終了位置）で範囲を定義
 * - モーションでカーソルを移動し、選択範囲を拡大/縮小
 * - オペレーター（d, y, c, x）で選択範囲に対して操作を実行
 * - Escape でノーマルモードに戻る
 * - v / V で選択モードを切り替え
 *
 * visual:      文字単位の選択
 * visual-line: 行単位の選択
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
 * ビジュアルモードのメインハンドラ。
 */
export function processVisualMode(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean,
  readOnly: boolean = false,
): KeystrokeResult {
  // --- Escape → ノーマルモードへ ---
  if (key === "Escape") {
    return exitVisualMode(ctx);
  }

  // --- g-pending ---
  if (ctx.phase === "g-pending") {
    return handleGPendingInVisual(key, ctx, buffer);
  }

  // --- Ctrlキー ---
  if (ctrlKey) {
    return handleCtrlKey(key, ctx, buffer);
  }

  // --- カウント ---
  if (isCountKey(key, ctx)) {
    return {
      newCtx: { ...ctx, count: ctx.count * 10 + Number.parseInt(key, 10) },
      actions: [],
    };
  }

  // --- モーション ---
  const count = getEffectiveCount(ctx);
  const countExplicit = isCountExplicit(ctx);
  const motion = resolveMotion(key, ctx.cursor, buffer, count, countExplicit);
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

  // --- g プレフィックス ---
  if (key === "g") {
    return {
      newCtx: { ...ctx, phase: "g-pending" },
      actions: [],
    };
  }

  // --- オペレーター実行 ---
  if (key === "d" || key === "x" || key === "y" || key === "c") {
    // readOnly: 削除・変更をブロック（y は許可）
    if (readOnly && key !== "y") {
      return { newCtx: ctx, actions: [] };
    }
    return executeVisualOperator(key, ctx, buffer);
  }

  // --- モード切替 ---
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
 * ビジュアルモードを抜けてノーマルモードへ。
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
 * ビジュアルサブモードを切り替える (visual ↔ visual-line)。
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
 * g プレフィックスの処理 (gg)
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

  // 未知の g コマンド → リセット
  return {
    newCtx: { ...ctx, phase: "idle", count: 0 },
    actions: [],
  };
}

/**
 * ビジュアル選択範囲に対してオペレーターを実行する。
 *
 * d / x: 削除
 * y: ヤンク
 * c: 変更（削除してinsertモードへ）
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

  // x は d と同じ動作
  const operator: Operator = key === "x" ? "d" : (key as Operator);

  // 選択範囲を正規化（start <= end）
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
        result.newMode === "insert" ? "-- INSERT --" : "",
    },
    actions: [
      ...result.actions,
      { type: "cursor-move", position: result.newCursor },
      { type: "mode-change", mode: result.newMode },
    ],
  };
}

/**
 * 2つのカーソル位置を正規化して、start <= end にする。
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
