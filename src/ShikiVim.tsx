/**
 * ShikiVim.tsx
 *
 * メインのReactコンポーネント。
 * Shikiによるシンタックスハイライトと、Vim風のキーボード操作を提供する。
 *
 * 使い方:
 * ```tsx
 * import ShikiVim from 'shiki-vim'
 * import 'shiki-vim/styles.css'
 * import { createHighlighter } from 'shiki'
 *
 * const highlighter = await createHighlighter({
 *   themes: ['vitesse-dark'],
 *   langs: ['typescript'],
 * })
 *
 * <ShikiVim
 *   content={code}
 *   highlighter={highlighter}
 *   lang="typescript"
 *   theme="vitesse-dark"
 *   onSave={(content) => console.log('saved', content)}
 * />
 * ```
 */

import { useRef, useCallback, useMemo } from "react";
import type { ShikiVimProps, CursorPosition } from "./types";
import { useShikiTokens } from "./hooks/useShikiTokens";
import { useVimEngine } from "./hooks/useVimEngine";
import { Line } from "./components/Line";
import { Cursor } from "./components/Cursor";
import { StatusLine } from "./components/StatusLine";

/**
 * ShikiVim エディタコンポーネント。
 *
 * Shikiのハイライターでコードを表示し、
 * Vim風のキーバインドで操作できるエディタ。
 */
export default function ShikiVim({
  content: initialContent,
  highlighter,
  lang,
  theme,
  shikiOptions,
  cursorPosition = "1:1",
  onChange,
  onYank,
  onSave,
  onModeChange,
  className,
  readOnly = false,
  showLineNumbers = true,
}: ShikiVimProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const codeAreaRef = useRef<HTMLDivElement>(null);

  // --- Vimエンジン ---
  const engine = useVimEngine({
    content: initialContent,
    cursorPosition,
    readOnly,
    onChange,
    onYank,
    onSave,
    onModeChange,
  });

  // --- Shikiトークナイゼーション ---
  const { tokenLines, bgColor, fgColor } = useShikiTokens(
    highlighter,
    engine.content,
    lang,
    theme,
    shikiOptions,
  );

  // --- 行番号ガターの幅を計算 ---
  const totalLines = tokenLines.length;
  const gutterWidth = String(totalLines).length;

  // --- ビジュアル選択範囲の計算 ---
  const selectionInfo = useMemo(() => {
    return computeSelectionInfo(
      engine.mode,
      engine.visualAnchor,
      engine.cursor,
      totalLines,
    );
  }, [engine.mode, engine.visualAnchor, engine.cursor, totalLines]);

  // --- スクロール処理（Ctrl-U/D） ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      engine.handleKeyDown(e);

      // Ctrl-U/D のスクロール処理
      if (e.ctrlKey && (e.key === "u" || e.key === "d")) {
        if (codeAreaRef.current) {
          const areaHeight = codeAreaRef.current.clientHeight;
          const lineHeight = parseFloat(
            getComputedStyle(codeAreaRef.current).lineHeight,
          );
          const visibleLines = Math.floor(areaHeight / lineHeight);
          engine.handleScroll(
            e.key === "u" ? "up" : "down",
            visibleLines,
          );
        }
      }
    },
    [engine],
  );

  return (
    <div
      ref={containerRef}
      className={`sv-container${className ? ` ${className}` : ""}`}
      style={{
        backgroundColor: bgColor,
        color: fgColor,
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="textbox"
      aria-label="Code editor"
      aria-multiline="true"
      aria-readonly={readOnly}
    >
      {/* コードエリア */}
      <div ref={codeAreaRef} className="sv-code-area">
        {/* カーソル（オーバーレイ） */}
        <Cursor
          position={engine.cursor}
          mode={engine.mode}
          showLineNumbers={showLineNumbers}
          gutterWidth={gutterWidth}
        />

        {/* 各行のレンダリング */}
        {tokenLines.map((tokens, lineIndex) => (
          <Line
            key={lineIndex}
            lineIndex={lineIndex}
            tokens={tokens}
            showLineNumbers={showLineNumbers}
            totalLines={totalLines}
            isSelected={selectionInfo.isLineSelected(lineIndex)}
            selectionStartCol={selectionInfo.getSelectionStartCol(lineIndex)}
            selectionEndCol={selectionInfo.getSelectionEndCol(lineIndex)}
          />
        ))}
      </div>

      {/* ステータスライン */}
      <StatusLine
        mode={engine.mode}
        cursor={engine.cursor}
        statusMessage={engine.statusMessage}
        commandLine={engine.commandLine}
        totalLines={totalLines}
      />
    </div>
  );
}

// =====================
// ビジュアル選択ヘルパー
// =====================

interface SelectionInfo {
  isLineSelected: (lineIndex: number) => boolean;
  getSelectionStartCol: (lineIndex: number) => number | undefined;
  getSelectionEndCol: (lineIndex: number) => number | undefined;
}

/**
 * ビジュアルモードの選択範囲情報を計算する。
 *
 * visual:      文字単位選択（アンカーからカーソルまで）
 * visual-line: 行単位選択（アンカー行からカーソル行まで）
 */
function computeSelectionInfo(
  mode: string,
  anchor: CursorPosition | null,
  cursor: CursorPosition,
  _totalLines: number,
): SelectionInfo {
  // ビジュアルモードでない場合は選択なし
  if ((mode !== "visual" && mode !== "visual-line") || !anchor) {
    return {
      isLineSelected: () => false,
      getSelectionStartCol: () => undefined,
      getSelectionEndCol: () => undefined,
    };
  }

  // 選択範囲の正規化（start <= end）
  const startLine = Math.min(anchor.line, cursor.line);
  const endLine = Math.max(anchor.line, cursor.line);
  const startPos =
    anchor.line < cursor.line ||
    (anchor.line === cursor.line && anchor.col <= cursor.col)
      ? anchor
      : cursor;
  const endPos =
    anchor.line < cursor.line ||
    (anchor.line === cursor.line && anchor.col <= cursor.col)
      ? cursor
      : anchor;

  if (mode === "visual-line") {
    return {
      isLineSelected: (lineIndex) =>
        lineIndex >= startLine && lineIndex <= endLine,
      getSelectionStartCol: () => undefined,
      getSelectionEndCol: () => undefined,
    };
  }

  // visual (文字単位)
  return {
    isLineSelected: (lineIndex) =>
      lineIndex >= startLine && lineIndex <= endLine,
    getSelectionStartCol: (lineIndex) => {
      if (lineIndex < startLine || lineIndex > endLine) return undefined;
      if (lineIndex === startPos.line) return startPos.col;
      return 0;
    },
    getSelectionEndCol: (lineIndex) => {
      if (lineIndex < startLine || lineIndex > endLine) return undefined;
      if (lineIndex === endPos.line) return endPos.col + 1;
      // 中間行は行末まで
      return Infinity;
    },
  };
}
