import type { HighlighterCore } from "shiki";

/**
 * Cursor position (0-based internally)
 */
export interface CursorPosition {
  line: number;
  col: number;
}

/**
 * Vim modes
 */
export type VimMode =
  | "normal"
  | "insert"
  | "visual"
  | "visual-line"
  | "visual-block"
  | "command-line";

/**
 * Command parser phase
 */
export type CommandPhase =
  | "idle"
  | "operator-pending"
  | "char-pending"
  | "g-pending";

/**
 * Vim operators
 */
export type Operator = "d" | "y" | "c";

/**
 * Character-awaiting commands
 */
export type CharCommand = "f" | "F" | "t" | "T" | "r";

/**
 * Internal vim state used by the engine
 */
export interface VimContext {
  mode: VimMode;
  phase: CommandPhase;
  count: number;
  operator: Operator | null;
  cursor: CursorPosition;
  visualAnchor: CursorPosition | null;
  register: string;
  commandBuffer: string;
  commandType: ":" | "/" | "?" | null;
  lastSearch: string;
  searchDirection: "forward" | "backward";
  charCommand: CharCommand | null;
  statusMessage: string;
}

/**
 * Actions emitted by the vim engine
 */
export type VimAction =
  | { type: "cursor-move"; position: CursorPosition }
  | { type: "content-change"; content: string }
  | { type: "mode-change"; mode: VimMode }
  | { type: "yank"; text: string }
  | { type: "save"; content: string }
  | { type: "status-message"; message: string }
  | { type: "scroll"; direction: "up" | "down"; amount: number }
  | { type: "noop" };

/**
 * Undo entry
 */
export interface UndoEntry {
  lines: string[];
  cursor: CursorPosition;
}

/**
 * Props for the ShikiVim component
 */
export interface ShikiVimProps {
  /** The content to display and edit */
  content: string;
  /** Shiki highlighter instance */
  highlighter: HighlighterCore;
  /** Language for syntax highlighting */
  lang: string;
  /** Theme for syntax highlighting */
  theme: string;
  /** Additional Shiki options passed to codeToTokens */
  shikiOptions?: Record<string, unknown>;
  /** Initial cursor position in "line:col" format (1-based). Default: "1:1" */
  cursorPosition?: string;
  /** Called when content changes */
  onChange?: (content: string) => void;
  /** Called when text is yanked */
  onYank?: (text: string) => void;
  /** Called on :w command */
  onSave?: (content: string) => void;
  /** Called when mode changes */
  onModeChange?: (mode: VimMode) => void;
  /** Additional class name for the container */
  className?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Whether to show line numbers. Default: true */
  showLineNumbers?: boolean;
}
