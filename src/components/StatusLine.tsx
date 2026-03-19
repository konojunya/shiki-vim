/**
 * StatusLine.tsx
 *
 * エディタ下部のステータスラインコンポーネント。
 * Vimのステータスバーを模した表示:
 *
 * [モード表示]                    [カーソル位置]
 * -- INSERT --                   12:34
 *
 * コマンドラインモード時はコマンド入力を表示:
 * :w
 * /search_pattern
 */

import type { CursorPosition, VimMode } from "../types";

export interface StatusLineProps {
  /** 現在のVimモード */
  mode: VimMode;
  /** カーソル位置（0-based） */
  cursor: CursorPosition;
  /** ステータスメッセージ（モード表示やエラーメッセージ） */
  statusMessage: string;
  /** コマンドライン入力（: や / の後の入力） */
  commandLine: string;
  /** 全体の行数 */
  totalLines: number;
}

/**
 * ステータスラインの描画。
 */
export function StatusLine({
  mode,
  cursor,
  statusMessage,
  commandLine,
  totalLines,
}: StatusLineProps) {
  // コマンドラインモード時はコマンド入力を表示
  if (mode === "command-line" && commandLine) {
    return (
      <div className="sv-statusline">
        <span className="sv-statusline-left">
          <span className="sv-command-input">{commandLine}</span>
          <span className="sv-command-cursor">▋</span>
        </span>
        <span className="sv-statusline-right">
          {formatCursorPosition(cursor, totalLines)}
        </span>
      </div>
    );
  }

  return (
    <div className="sv-statusline">
      <span className="sv-statusline-left">
        {/* モード表示 */}
        {statusMessage && (
          <span className={`sv-mode-indicator sv-mode-${mode}`}>
            {statusMessage}
          </span>
        )}
      </span>
      <span className="sv-statusline-right">
        {formatCursorPosition(cursor, totalLines)}
      </span>
    </div>
  );
}

/**
 * カーソル位置を "行:列" 形式でフォーマット（1-based）。
 * ファイル内の位置パーセンテージも表示。
 */
function formatCursorPosition(
  cursor: CursorPosition,
  totalLines: number,
): string {
  const line = cursor.line + 1;
  const col = cursor.col + 1;
  const percentage =
    totalLines <= 1
      ? "All"
      : cursor.line === 0
        ? "Top"
        : cursor.line >= totalLines - 1
          ? "Bot"
          : `${Math.round((cursor.line / (totalLines - 1)) * 100)}%`;

  return `${line}:${col}    ${percentage}`;
}
