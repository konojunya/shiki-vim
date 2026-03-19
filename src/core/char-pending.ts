/**
 * char-pending.ts
 *
 * 文字待ちコマンド（f, F, t, T, r）のハンドラ。
 *
 * これらのコマンドは、押された後に次の1文字を待つ:
 * - f{char}: 行内で前方に{char}を検索してジャンプ
 * - F{char}: 行内で後方に{char}を検索してジャンプ
 * - t{char}: 行内で前方に{char}の手前までジャンプ
 * - T{char}: 行内で後方に{char}の次までジャンプ
 * - r{char}: カーソル下の文字を{char}に置換
 *
 * オペレーターペンディング中の場合（df{char} など）、
 * モーション範囲にオペレーターを適用する。
 */

import type { VimContext } from "../types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./vim-state";
import { getEffectiveCount, resetContext } from "./key-utils";
import { executeOperatorOnRange } from "./operators";
import {
  motionFChar,
  motionFCharBack,
  motionTChar,
  motionTCharBack,
} from "./motions";

/**
 * 文字待ちコマンドのキー入力を処理する。
 * ctx.charCommand に待っているコマンド種類が入っている。
 */
export function handleCharPending(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const count = getEffectiveCount(ctx);

  // r（1文字置換）は特別扱い
  if (ctx.charCommand === "r") {
    return handleReplace(key, ctx, buffer);
  }

  // f, F, t, T のモーション解決
  const motion = resolveCharMotion(ctx.charCommand!, key, ctx, buffer, count);

  if (!motion) {
    // 無効な文字 → リセット
    return {
      newCtx: resetContext(ctx),
      actions: [],
    };
  }

  // オペレーターペンディング中の場合（df{char} など）
  if (ctx.operator) {
    buffer.saveUndoPoint(ctx.cursor);
    const result = executeOperatorOnRange(
      ctx.operator,
      motion.range,
      buffer,
      ctx.cursor,
    );

    return {
      newCtx: {
        ...resetContext(ctx),
        mode: result.newMode,
        cursor: result.newCursor,
        register: result.yankedText,
        statusMessage:
          result.newMode === "insert" ? "-- INSERT --" : "",
      },
      actions: [
        ...result.actions,
        { type: "cursor-move", position: result.newCursor },
        ...(result.newMode !== ctx.mode
          ? [{ type: "mode-change" as const, mode: result.newMode }]
          : []),
      ],
    };
  }

  // 単純なモーション
  return {
    newCtx: {
      ...resetContext(ctx),
      cursor: motion.cursor,
    },
    actions: [{ type: "cursor-move", position: motion.cursor }],
  };
}

/**
 * r{char}: カーソル下の1文字を置換する。
 * 行が空の場合は何もしない。
 */
function handleReplace(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (buffer.getLineLength(ctx.cursor.line) === 0) {
    return {
      newCtx: resetContext(ctx),
      actions: [],
    };
  }

  buffer.saveUndoPoint(ctx.cursor);

  const lineText = buffer.getLine(ctx.cursor.line);
  const newLine =
    lineText.slice(0, ctx.cursor.col) +
    key +
    lineText.slice(ctx.cursor.col + 1);
  buffer.setLine(ctx.cursor.line, newLine);

  return {
    newCtx: resetContext(ctx),
    actions: [{ type: "content-change", content: buffer.getContent() }],
  };
}

/**
 * charCommand と入力文字からモーション結果を解決する。
 */
function resolveCharMotion(
  command: string,
  char: string,
  ctx: VimContext,
  buffer: TextBuffer,
  count: number,
) {
  switch (command) {
    case "f":
      return motionFChar(ctx.cursor, buffer, char, count);
    case "F":
      return motionFCharBack(ctx.cursor, buffer, char, count);
    case "t":
      return motionTChar(ctx.cursor, buffer, char, count);
    case "T":
      return motionTCharBack(ctx.cursor, buffer, char, count);
    default:
      return null;
  }
}
