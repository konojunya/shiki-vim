/**
 * ShikiVim.tsx
 *
 * Main React component.
 * Provides syntax highlighting via Shiki and Vim-like keyboard operations.
 *
 * Usage:
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
 * ShikiVim editor component.
 *
 * Displays code using Shiki's highlighter
 * with Vim-like keybindings for editing.
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
  onAction,
  className,
  readOnly = false,
  showLineNumbers = true,
}: ShikiVimProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const codeAreaRef = useRef<HTMLDivElement>(null);

  // --- Vim engine ---
  const engine = useVimEngine({
    content: initialContent,
    cursorPosition,
    readOnly,
    onChange,
    onYank,
    onSave,
    onModeChange,
    onAction,
  });

  // --- Shiki tokenization ---
  const { tokenLines, bgColor, fgColor } = useShikiTokens(
    highlighter,
    engine.content,
    lang,
    theme,
    shikiOptions,
  );

  // --- Calculate gutter width for line numbers ---
  const totalLines = tokenLines.length;
  const gutterWidth = String(totalLines).length;

  // --- Calculate visual selection range ---
  const selectionInfo = useMemo(() => {
    return computeSelectionInfo(
      engine.mode,
      engine.visualAnchor,
      engine.cursor,
      totalLines,
    );
  }, [engine.mode, engine.visualAnchor, engine.cursor, totalLines]);

  // --- Scroll handling (Ctrl-U/D) ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      engine.handleKeyDown(e);

      // Scroll handling for Ctrl-U/D
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
      {/* Code area */}
      <div ref={codeAreaRef} className="sv-code-area">
        {/* Cursor (overlay) */}
        <Cursor
          position={engine.cursor}
          mode={engine.mode}
          showLineNumbers={showLineNumbers}
          gutterWidth={gutterWidth}
        />

        {/* Render each line */}
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

      {/* Status line */}
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
// Visual selection helpers
// =====================

interface SelectionInfo {
  isLineSelected: (lineIndex: number) => boolean;
  getSelectionStartCol: (lineIndex: number) => number | undefined;
  getSelectionEndCol: (lineIndex: number) => number | undefined;
}

/**
 * Compute selection range information for visual mode.
 *
 * visual:      Character-wise selection (from anchor to cursor)
 * visual-line: Line-wise selection (from anchor line to cursor line)
 */
function computeSelectionInfo(
  mode: string,
  anchor: CursorPosition | null,
  cursor: CursorPosition,
  _totalLines: number,
): SelectionInfo {
  // No selection if not in visual mode
  if ((mode !== "visual" && mode !== "visual-line") || !anchor) {
    return {
      isLineSelected: () => false,
      getSelectionStartCol: () => undefined,
      getSelectionEndCol: () => undefined,
    };
  }

  // Normalize selection range (start <= end)
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

  // visual (character-wise)
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
      // Middle lines extend to end of line
      return Infinity;
    },
  };
}
