/**
 * motion-resolver.ts
 *
 * キー文字列からモーション関数へのマッピング。
 * motions.ts の個別モーション関数を統合し、
 * キー1つから適切なモーションを解決する。
 */

import type { CursorPosition } from "../types";
import type { TextBuffer } from "./buffer";
import type { MotionResult } from "./motions";
import {
  motionH,
  motionJ,
  motionK,
  motionL,
  motionW,
  motionE,
  motionB,
  motionZero,
  motionCaret,
  motionDollar,
  motionG,
  motionMatchBracket,
} from "./motions";

/**
 * キー文字列を解決してモーション結果を返す。
 *
 * @param key - KeyboardEvent.key の値
 * @param cursor - 現在のカーソル位置
 * @param buffer - テキストバッファ
 * @param count - 実行回数
 * @param countExplicit - カウントが明示的に指定されたか
 * @returns モーション結果、またはマッチしなければnull
 */
export function resolveMotion(
  key: string,
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
  countExplicit: boolean,
): MotionResult | null {
  switch (key) {
    // --- 基本移動 ---
    case "h":
    case "ArrowLeft":
      return motionH(cursor, buffer, count);

    case "j":
    case "ArrowDown":
      return motionJ(cursor, buffer, count);

    case "k":
    case "ArrowUp":
      return motionK(cursor, buffer, count);

    case "l":
    case "ArrowRight":
      return motionL(cursor, buffer, count);

    // --- ワード移動 ---
    case "w":
      return motionW(cursor, buffer, count);

    case "e":
      return motionE(cursor, buffer, count);

    case "b":
      return motionB(cursor, buffer, count);

    // --- 行内移動 ---
    case "0":
      return motionZero(cursor, buffer, count);

    case "^":
      return motionCaret(cursor, buffer, count);

    case "$":
      return motionDollar(cursor, buffer, count);

    // --- ファイル内移動 ---
    case "G":
      // G: カウント指定あり → 指定行、なし → ファイル末尾
      return motionG(cursor, buffer, countExplicit ? count : null);

    // --- ブラケットマッチ ---
    case "%":
      return motionMatchBracket(cursor, buffer, count);

    default:
      return null;
  }
}
