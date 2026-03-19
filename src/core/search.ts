/**
 * search.ts
 *
 * バッファ内テキスト検索の実装。
 * / (前方検索) と ? (後方検索) をサポートする。
 * 検索パターンはJavaScriptの正規表現として解釈される。
 */

import type { CursorPosition } from "../types";
import type { TextBuffer } from "./buffer";

/**
 * バッファ内を検索し、最初にマッチした位置を返す。
 *
 * 検索はカーソル位置の次（前方検索）または前（後方検索）から開始し、
 * バッファの末尾（先頭）に達したらラップアラウンドする。
 *
 * @param buffer - 検索対象のテキストバッファ
 * @param pattern - 正規表現パターン文字列
 * @param cursor - 現在のカーソル位置（検索開始位置）
 * @param direction - 検索方向
 * @returns マッチした位置、見つからなければnull
 */
export function searchInBuffer(
  buffer: TextBuffer,
  pattern: string,
  cursor: CursorPosition,
  direction: "forward" | "backward",
): CursorPosition | null {
  // パターンを正規表現としてコンパイル
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "g");
  } catch {
    // 不正な正規表現の場合はnullを返す
    return null;
  }

  const lineCount = buffer.getLineCount();

  if (direction === "forward") {
    return searchForward(buffer, regex, cursor, lineCount);
  }
  return searchBackward(buffer, regex, cursor, lineCount);
}

/**
 * 前方検索（カーソルの次の位置から末尾方向へ、ラップアラウンドあり）
 */
function searchForward(
  buffer: TextBuffer,
  regex: RegExp,
  cursor: CursorPosition,
  lineCount: number,
): CursorPosition | null {
  for (let i = 0; i < lineCount; i++) {
    const lineIdx = (cursor.line + i) % lineCount;
    const line = buffer.getLine(lineIdx);

    // 最初の行はカーソルの次の位置から検索開始
    const startCol = i === 0 ? cursor.col + 1 : 0;
    const searchTarget = line.slice(startCol);

    // matchAll を使ってマッチを取得
    const matches = [...searchTarget.matchAll(regex)];
    if (matches.length > 0) {
      // 最初のマッチを返す（前方検索なので）
      return { line: lineIdx, col: startCol + matches[0].index };
    }
  }

  return null;
}

/**
 * 後方検索（カーソルの前の位置から先頭方向へ、ラップアラウンドあり）
 */
function searchBackward(
  buffer: TextBuffer,
  regex: RegExp,
  cursor: CursorPosition,
  lineCount: number,
): CursorPosition | null {
  for (let i = 0; i < lineCount; i++) {
    const lineIdx = (cursor.line - i + lineCount) % lineCount;
    const line = buffer.getLine(lineIdx);

    // その行のすべてのマッチを収集
    const allMatches = [...line.matchAll(regex)];

    // 最初の行はカーソルの前の位置までのマッチだけ
    const validMatches =
      i === 0
        ? allMatches.filter((m) => (m.index ?? 0) < cursor.col)
        : allMatches;

    if (validMatches.length > 0) {
      // 最後のマッチを返す（後方検索なので最もカーソルに近い方）
      const last = validMatches[validMatches.length - 1];
      return { line: lineIdx, col: last.index ?? 0 };
    }
  }

  return null;
}
