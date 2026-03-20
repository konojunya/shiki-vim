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

import { useRef, useCallback, useMemo, useEffect } from "react";
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
  autoFocus = false,
  indentStyle,
  indentWidth,
  showLineNumbers = true,
}: ShikiVimProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const codeAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) containerRef.current?.focus();
  }, [autoFocus]);

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
    indentStyle,
    indentWidth,
  });

  // --- Shiki tokenization ---
  const { tokenLines, bgColor, fgColor } = useShikiTokens(
    highlighter,
    engine.content,
    lang,
    theme,
    shikiOptions,
  );

  // --- Line numbers (prop overridden by :set number / :set nonumber) ---
  const effectiveShowLineNumbers =
    engine.options.number !== undefined ? engine.options.number : showLineNumbers;

  // --- Calculate gutter width for line numbers ---
  const totalLines = tokenLines.length;
  const gutterWidth = String(totalLines).length;

  // --- Calculate visual column (accounting for tab width) ---
  const visualCol = useMemo(() => {
    const lines = engine.content.split("\n");
    const line = lines[engine.cursor.line] ?? "";
    const tabSize = 4;
    let col = 0;
    for (let i = 0; i < engine.cursor.col && i < line.length; i++) {
      if (line[i] === "\t") {
        col += tabSize - (col % tabSize);
      } else {
        col++;
      }
    }
    return col;
  }, [engine.content, engine.cursor.line, engine.cursor.col]);

  // --- Calculate search match positions per line ---
  // Only highlights while actively typing a search (/ or ?).
  // Clears when returning to normal mode.
  const searchMatchesByLine = useMemo(() => {
    if (!engine.commandLine || !(engine.commandLine.startsWith("/") || engine.commandLine.startsWith("?"))) {
      return {};
    }
    const pattern = engine.commandLine.slice(1);
    if (!pattern) return {};
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, "gi");
    } catch {
      return {};
    }
    const lines = engine.content.split("\n");
    const result: Record<number, [number, number][]> = {};
    for (let i = 0; i < lines.length; i++) {
      const matches = [...lines[i].matchAll(regex)];
      if (matches.length > 0) {
        result[i] = matches.map((m) => [m.index!, m.index! + m[0].length]);
      }
    }
    return result;
  }, [engine.content, engine.commandLine]);

  // --- Calculate visual selection range ---
  const selectionInfo = useMemo(() => {
    return computeSelectionInfo(
      engine.mode,
      engine.visualAnchor,
      engine.cursor,
      totalLines,
    );
  }, [engine.mode, engine.visualAnchor, engine.cursor, totalLines]);

  // --- Scroll to keep cursor visible ---
  useEffect(() => {
    const area = codeAreaRef.current;
    if (!area) return;
    const lineHeight = parseFloat(getComputedStyle(area).lineHeight);
    if (!lineHeight) return;

    const padding = 8; // sv-code-area padding-top
    const cursorTop = engine.cursor.line * lineHeight + padding;
    const cursorBottom = cursorTop + lineHeight;

    if (cursorTop < area.scrollTop) {
      area.scrollTop = cursorTop;
    } else if (cursorBottom > area.scrollTop + area.clientHeight) {
      area.scrollTop = cursorBottom - area.clientHeight;
    }
  }, [engine.cursor.line]);

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
          visualCol={visualCol}
          mode={engine.mode}
          showLineNumbers={effectiveShowLineNumbers}
          gutterWidth={gutterWidth}
        />

        {/* Render each line */}
        {tokenLines.map((tokens, lineIndex) => (
          <Line
            key={lineIndex}
            lineIndex={lineIndex}
            tokens={tokens}
            showLineNumbers={effectiveShowLineNumbers}
            totalLines={totalLines}
            isSelected={selectionInfo.isLineSelected(lineIndex)}
            selectionStartCol={selectionInfo.getSelectionStartCol(lineIndex)}
            selectionEndCol={selectionInfo.getSelectionEndCol(lineIndex)}
            searchMatches={searchMatchesByLine[lineIndex]}
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
