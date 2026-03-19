/**
 * operators.ts
 *
 * Vimのオペレーター（d, y, c）の実行ロジック。
 *
 * オペレーターはモーションと組み合わせて使われる:
 *   d + w → 単語を削除
 *   y + $ → 行末までヤンク
 *   c + c → 行全体を変更
 *
 * ここでは実際のバッファ操作とアクション生成を担当する。
 */

import type { CursorPosition, VimAction, VimMode, Operator } from "../types";
import type { TextBuffer } from "./buffer";
import type { MotionRange } from "./motions";

/** オペレーター実行結果 */
export interface OperatorResult {
  /** 実行後のアクション一覧 */
  actions: VimAction[];
  /** 操作後のカーソル位置 */
  newCursor: CursorPosition;
  /** 操作後のモード（cの場合insertになる） */
  newMode: VimMode;
  /** ヤンクされたテキスト */
  yankedText: string;
}

/**
 * モーション範囲に対してオペレーターを実行する。
 *
 * linewise な場合は行単位で操作、そうでなければ文字単位で操作する。
 * 'c' オペレーターの場合、削除後にinsertモードに遷移する。
 */
export function executeOperatorOnRange(
  operator: Operator,
  range: MotionRange,
  buffer: TextBuffer,
  cursor: CursorPosition,
): OperatorResult {
  if (range.linewise) {
    return executeLinewiseOperator(operator, range, buffer, cursor);
  }
  return executeCharwiseOperator(operator, range, buffer, cursor);
}

/**
 * 行単位のオペレーター実行。
 * dd, yy, cc や、j/k モーションとの組み合わせで使われる。
 */
function executeLinewiseOperator(
  operator: Operator,
  range: MotionRange,
  buffer: TextBuffer,
  _cursor: CursorPosition,
): OperatorResult {
  const startLine = Math.min(range.start.line, range.end.line);
  const endLine = Math.max(range.start.line, range.end.line);
  const lineCount = endLine - startLine + 1;

  // ヤンク対象のテキストを取得（末尾に改行を付けて行単位であることを示す）
  const deletedLines = buffer
    .getLines()
    .slice(startLine, endLine + 1)
    .join("\n");
  const yankedText = deletedLines + "\n";

  const actions: VimAction[] = [{ type: "yank", text: yankedText }];

  // y（ヤンク）は削除しない
  if (operator === "y") {
    return {
      actions,
      newCursor: { line: startLine, col: 0 },
      newMode: "normal",
      yankedText,
    };
  }

  // d / c は行を削除する
  buffer.deleteLines(startLine, lineCount);

  // バッファが空になった場合、空行を挿入
  if (buffer.getLineCount() === 0) {
    buffer.insertLine(0, "");
  }

  const newLine = Math.min(startLine, buffer.getLineCount() - 1);

  if (operator === "c") {
    // c (change): 削除した位置に空行を挿入してinsertモードへ
    buffer.insertLine(newLine, "");
    actions.push({ type: "content-change", content: buffer.getContent() });
    return {
      actions,
      newCursor: { line: newLine, col: 0 },
      newMode: "insert",
      yankedText,
    };
  }

  // d (delete)
  actions.push({ type: "content-change", content: buffer.getContent() });
  return {
    actions,
    newCursor: { line: newLine, col: 0 },
    newMode: "normal",
    yankedText,
  };
}

/**
 * 文字単位のオペレーター実行。
 * dw, cw, y$ など、文字範囲での操作。
 */
function executeCharwiseOperator(
  operator: Operator,
  range: MotionRange,
  buffer: TextBuffer,
  _cursor: CursorPosition,
): OperatorResult {
  // start と end の順序を正規化
  let start = range.start;
  let end = range.end;

  if (
    start.line > end.line ||
    (start.line === end.line && start.col > end.col)
  ) {
    [start, end] = [end, start];
  }

  // inclusive の場合、end.col を1つ進める（deleteRangeは排他的）
  const endCol = range.inclusive ? end.col + 1 : end.col;

  // ヤンク対象のテキストを取得
  const yankedText = getTextInRange(buffer, start, { line: end.line, col: endCol });

  const actions: VimAction[] = [{ type: "yank", text: yankedText }];

  // y（ヤンク）は削除しない
  if (operator === "y") {
    return {
      actions,
      newCursor: { ...start },
      newMode: "normal",
      yankedText,
    };
  }

  // d / c は範囲を削除する
  buffer.deleteRange(start.line, start.col, end.line, endCol);
  actions.push({ type: "content-change", content: buffer.getContent() });

  // カーソル位置を計算
  const newCursor = {
    line: start.line,
    col: operator === "c"
      ? start.col
      : Math.min(start.col, Math.max(0, buffer.getLineLength(start.line) - 1)),
  };

  return {
    actions,
    newCursor,
    newMode: operator === "c" ? "insert" : "normal",
    yankedText,
  };
}

/**
 * バッファから指定範囲のテキストを取得する（非破壊）
 */
function getTextInRange(
  buffer: TextBuffer,
  start: CursorPosition,
  end: CursorPosition,
): string {
  if (start.line === end.line) {
    return buffer.getLine(start.line).slice(start.col, end.col);
  }

  const lines: string[] = [];
  lines.push(buffer.getLine(start.line).slice(start.col));
  for (let i = start.line + 1; i < end.line; i++) {
    lines.push(buffer.getLine(i));
  }
  lines.push(buffer.getLine(end.line).slice(0, end.col));
  return lines.join("\n");
}

/**
 * 行単位オペレーターを実行する（dd, yy, cc）。
 * count に応じて複数行を対象とする。
 */
export function executeLineOperator(
  operator: Operator,
  cursor: CursorPosition,
  count: number,
  buffer: TextBuffer,
): OperatorResult {
  const startLine = cursor.line;
  const endLine = Math.min(startLine + count - 1, buffer.getLineCount() - 1);

  const range: MotionRange = {
    start: { line: startLine, col: 0 },
    end: { line: endLine, col: 0 },
    linewise: true,
    inclusive: true,
  };

  return executeOperatorOnRange(operator, range, buffer, cursor);
}
