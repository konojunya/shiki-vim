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
  | "g-pending"
  | "text-object-pending"
  | "register-pending"
  | "macro-register-pending"
  | "macro-execute-pending";

/**
 * Vim operators
 */
export type Operator = "d" | "y" | "c" | ">" | "<";

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
  /** Unnamed register (default yank/delete destination) */
  register: string;
  /** Named registers (a-z) */
  registers: Record<string, string>;
  /** Currently selected register via " prefix (null = unnamed) */
  selectedRegister: string | null;
  commandBuffer: string;
  commandType: ":" | "/" | "?" | null;
  lastSearch: string;
  searchDirection: "forward" | "backward";
  charCommand: CharCommand | null;
  /** Last f/F/t/T command and character for ; and , repeat */
  lastCharSearch: { command: "f" | "F" | "t" | "T"; char: string } | null;
  /** Text object modifier: "i" (inner) or "a" (around) */
  textObjectModifier: "i" | "a" | null;
  statusMessage: string;
  indentStyle: "space" | "tab";
  indentWidth: number;
  /** Key sequence of the last completed change (for . repeat) */
  lastChange: string[];
  /** Keys being accumulated for the current in-progress change */
  pendingChange: string[];
  /** Pending visual-block insert info (for I/A in visual-block mode) */
  blockInsert: {
    startLine: number;
    endLine: number;
    col: number;
    cursorAtInsertStart: CursorPosition;
  } | null;
  /** Register currently being recorded into (null = not recording) */
  macroRecording: string | null;
  /** Recorded macro key sequences */
  macros: Record<string, string[]>;
  /** Last executed macro register name (for @@) */
  lastMacro: string | null;
  /** First visible line in the viewport (0-based) */
  viewportTopLine: number;
  /** Number of visible lines in the viewport */
  viewportHeight: number;
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
  | { type: "set-option"; option: string; value: boolean }
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
  /** Called for every action emitted by the vim engine (useful for debugging) */
  onAction?: (action: VimAction, key: string) => void;
  /** Additional class name for the container */
  className?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Whether the editor should be focused on mount */
  autoFocus?: boolean;
  /** Indent style: "space" or "tab". Default: "space" */
  indentStyle?: "space" | "tab";
  /** Number of spaces (or tab width) per indent level. Default: 2 */
  indentWidth?: number;
  /** Whether to show line numbers. Default: true */
  showLineNumbers?: boolean;
}
