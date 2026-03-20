/**
 * useVimEngine.ts
 *
 * Main hook for the Vim engine.
 * Integrates the text buffer, Vim state, and keyboard event handling.
 *
 * This hook manages all logic for the ShikiVim component:
 * - TextBuffer management
 * - VimContext state management
 * - Keyboard event handling
 * - Callback invocation (onChange, onYank, onSave)
 * - Scroll handling
 */

import { useCallback, useRef, useState } from "react";
import type { CursorPosition, VimMode, VimAction, VimContext } from "../types";
import { TextBuffer } from "../core/buffer";
import {
  createInitialContext,
  parseCursorPosition,
  processKeystroke,
} from "../core/vim-state";

/** Options for useVimEngine */
export interface VimEngineOptions {
  /** Initial content */
  content: string;
  /** Initial cursor position ("1:1" format, 1-based) */
  cursorPosition?: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when content changes */
  onChange?: (content: string) => void;
  /** Callback when text is yanked */
  onYank?: (text: string) => void;
  /** Callback when saving */
  onSave?: (content: string) => void;
  /** Callback when mode changes */
  onModeChange?: (mode: VimMode) => void;
  /** Callback for every action emitted by the vim engine */
  onAction?: (action: VimAction, key: string) => void;
  /** Indent style: "space" or "tab" */
  indentStyle?: "space" | "tab";
  /** Number of spaces (or tab width) per indent level */
  indentWidth?: number;
}

/** Return value of useVimEngine */
export interface VimEngineState {
  /** Current content */
  content: string;
  /** Current cursor position */
  cursor: CursorPosition;
  /** Current Vim mode */
  mode: VimMode;
  /** Message displayed in the status bar */
  statusMessage: string;
  /** Selection anchor for visual mode */
  visualAnchor: CursorPosition | null;
  /** Input buffer for the command line */
  commandLine: string;
  /** Vim options set via :set commands */
  options: Record<string, boolean>;
  /** Last search pattern (for highlighting matches) */
  lastSearch: string;
  /** Keyboard event handler */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** Scroll event handler (for page scrolling) */
  handleScroll: (direction: "up" | "down", visibleLines: number, amount?: number) => void;
  /** Update the viewport info for H/M/L motions */
  updateViewport: (topLine: number, height: number) => void;
}

/**
 * Main hook for the Vim engine.
 *
 * TextBuffer is managed via ref (mutable, independent of rendering).
 * Display-related state (cursor, mode, content) is managed via state.
 */
export function useVimEngine(options: VimEngineOptions): VimEngineState {
  const {
    content: initialContent,
    cursorPosition = "1:1",
    readOnly = false,
    onChange,
    onYank,
    onSave,
    onModeChange,
    onAction,
    indentStyle,
    indentWidth,
  } = options;

  // TextBuffer is managed via ref (due to frequent mutations)
  const bufferRef = useRef<TextBuffer>(new TextBuffer(initialContent));

  // VimContext is also managed via ref (parser intermediate state does not need rendering)
  const ctxRef = useRef<VimContext>(
    createInitialContext(parseCursorPosition(cursorPosition), { indentStyle, indentWidth }),
  );

  // Display-related state
  const [content, setContent] = useState(initialContent);
  const [cursor, setCursor] = useState<CursorPosition>(
    parseCursorPosition(cursorPosition),
  );
  const [mode, setMode] = useState<VimMode>("normal");
  const [statusMessage, setStatusMessage] = useState("");
  const [visualAnchor, setVisualAnchor] = useState<CursorPosition | null>(
    null,
  );
  const [commandLine, setCommandLine] = useState("");
  const [vimOptions, setVimOptions] = useState<Record<string, boolean>>({});

  /**
   * Process the action list and update React state and callbacks.
   */
  const processActions = useCallback(
    (actions: VimAction[], newCtx: VimContext, key: string) => {
      for (const action of actions) {
        onAction?.(action, key);

        switch (action.type) {
          case "cursor-move":
            setCursor(action.position);
            break;

          case "content-change":
            setContent(action.content);
            onChange?.(action.content);
            break;

          case "mode-change":
            setMode(action.mode);
            onModeChange?.(action.mode);
            break;

          case "yank":
            onYank?.(action.text);
            break;

          case "save":
            onSave?.(action.content);
            break;

          case "status-message":
            // statusMessage is set from ctx
            break;

          case "set-option":
            setVimOptions((prev) => ({ ...prev, [action.option]: action.value }));
            break;

          case "scroll":
            // Scroll is handled on the component side
            break;

          case "noop":
            break;
        }
      }

      // State that is always synced from VimContext
      setCursor(newCtx.cursor);
      setStatusMessage(newCtx.statusMessage);
      setVisualAnchor(newCtx.visualAnchor);
      setCommandLine(
        newCtx.commandType
          ? newCtx.commandType + newCtx.commandBuffer
          : "",
      );
    },
    [onChange, onYank, onSave, onModeChange, onAction],
  );

  /**
   * Keyboard event handler.
   * Receives a KeyboardEvent and passes it to the Vim engine.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ignore during IME composition
      if (e.nativeEvent.isComposing) return;

      // Prevent browser default behavior
      // Avoid conflicts with Ctrl-R (reload), Ctrl-D (bookmark), etc.
      const shouldPrevent = shouldPreventDefault(e);
      if (shouldPrevent) {
        e.preventDefault();
      }

      // Pass the keystroke to the Vim engine (write operations are blocked by the readOnly flag)
      const { newCtx, actions } = processKeystroke(
        e.key,
        ctxRef.current,
        bufferRef.current,
        e.ctrlKey,
        readOnly,
      );

      // Update context
      ctxRef.current = newCtx;

      // Process actions
      processActions(actions, newCtx, e.key);
    },
    [readOnly, processActions],
  );

  /**
   * Scroll handler (for Ctrl-U/D/B/F).
   * @param direction - Scroll direction
   * @param visibleLines - Number of visible lines in the viewport
   * @param amount - Fraction of the page to scroll (0.5 = half, 1.0 = full)
   */
  const handleScroll = useCallback(
    (direction: "up" | "down", visibleLines: number, amount: number = 0.5) => {
      const scrollLines = Math.max(1, Math.floor(visibleLines * amount));
      const buffer = bufferRef.current;
      const ctx = ctxRef.current;

      const newLine =
        direction === "up"
          ? Math.max(0, ctx.cursor.line - scrollLines)
          : Math.min(buffer.getLineCount() - 1, ctx.cursor.line + scrollLines);

      const maxCol = Math.max(0, buffer.getLineLength(newLine) - 1);
      const newCursor = {
        line: newLine,
        col: Math.min(ctx.cursor.col, maxCol),
      };

      ctxRef.current = { ...ctx, cursor: newCursor };
      setCursor(newCursor);
    },
    [],
  );

  /**
   * Update the viewport information (called from the component on scroll/resize).
   */
  const updateViewport = useCallback(
    (topLine: number, height: number) => {
      ctxRef.current = {
        ...ctxRef.current,
        viewportTopLine: topLine,
        viewportHeight: height,
      };
    },
    [],
  );

  return {
    content,
    cursor,
    mode,
    statusMessage,
    visualAnchor,
    commandLine,
    options: vimOptions,
    lastSearch: ctxRef.current.lastSearch,
    handleKeyDown,
    handleScroll,
    updateViewport,
  };
}

/**
 * Determine whether to prevent the browser's default behavior.
 *
 * To function as a Vim editor, the default behavior of the following keys must be prevented:
 * - Ctrl-R (browser reload -> Vim redo)
 * - Ctrl-D (add bookmark -> Vim half-page scroll down)
 * - Ctrl-U (view source -> Vim half-page scroll up)
 * - Tab (focus navigation -> indent)
 * - Escape (close dialog -> mode switch)
 * - / (quick search -> Vim search)
 * - Regular character keys (processed as Vim commands instead of input)
 */
function shouldPreventDefault(e: React.KeyboardEvent): boolean {
  // Ctrl key combinations
  if (e.ctrlKey) {
    const ctrlKeys = ["r", "b", "f", "d", "u", "v"];
    if (ctrlKeys.includes(e.key)) return true;
  }

  // Special keys
  if (e.key === "Tab" || e.key === "Escape") return true;

  // Search key (prevent browser quick search)
  if (e.key === "/") return true;

  return false;
}
