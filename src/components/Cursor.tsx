/**
 * Cursor.tsx
 *
 * カーソルコンポーネント。
 * モードに応じて異なる形状で表示する:
 * - ノーマルモード: ブロックカーソル（1文字分の幅）
 * - インサートモード: ラインカーソル（縦棒）
 * - ビジュアルモード: ブロックカーソル
 *
 * カーソル位置はCSS変数で制御し、
 * monospaceフォントの `ch` / `lh` 単位で計算する。
 */

import type { CursorPosition, VimMode } from "../types";

export interface CursorProps {
  /** カーソル位置（0-based） */
  position: CursorPosition;
  /** 現在のVimモード */
  mode: VimMode;
  /** 行番号を表示しているか */
  showLineNumbers: boolean;
  /** 行番号のガター幅（ch単位） */
  gutterWidth: number;
}

/**
 * エディタのカーソルを描画する。
 *
 * absolute positioning でオーバーレイとして表示。
 * left / top は行番号ガター分のオフセットを考慮して計算。
 */
export function Cursor({
  position,
  mode,
  showLineNumbers,
  gutterWidth,
}: CursorProps) {
  // カーソルの形状をモードに応じて決定
  const cursorClass = getCursorClass(mode);

  // ガターオフセット（行番号表示時のみ）
  // gutterWidth ch + 1ch の padding
  const gutterOffset = showLineNumbers ? gutterWidth + 1 : 0;

  return (
    <div
      className={`sv-cursor ${cursorClass}`}
      style={{
        // CSS変数でカーソル位置を設定
        // ch 単位: monospaceフォントの「0」の幅を基準
        ["--cursor-col" as string]: position.col + gutterOffset,
        ["--cursor-line" as string]: position.line,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * モードに応じたカーソルCSSクラスを返す。
 */
function getCursorClass(mode: VimMode): string {
  switch (mode) {
    case "insert":
      return "sv-cursor-line";
    case "normal":
    case "visual":
    case "visual-line":
    case "visual-block":
      return "sv-cursor-block";
    case "command-line":
      return "sv-cursor-block";
    default:
      return "sv-cursor-block";
  }
}
