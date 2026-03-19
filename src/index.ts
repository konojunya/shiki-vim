/**
 * shiki-vim
 *
 * A vim-like lightweight code editor React component powered by Shiki.
 *
 * @example
 * ```tsx
 * import ShikiVim from 'shiki-vim'
 * import 'shiki-vim/styles.css'
 *
 * <ShikiVim
 *   content={code}
 *   highlighter={highlighter}
 *   lang="typescript"
 *   theme="vitesse-dark"
 * />
 * ```
 */

// Default export: メインコンポーネント
export { default } from "./ShikiVim";

// Named exports: 型定義
export type {
  ShikiVimProps,
  CursorPosition,
  VimMode,
  VimAction,
  VimContext,
} from "./types";

// Named exports: hooks（カスタム利用向け）
export { useVimEngine } from "./hooks/useVimEngine";
export type { VimEngineOptions, VimEngineState } from "./hooks/useVimEngine";
export { useShikiTokens } from "./hooks/useShikiTokens";
export type { ShikiTokenResult } from "./hooks/useShikiTokens";

// Named exports: コアモジュール（テスト・拡張向け）
export { TextBuffer } from "./core/buffer";
export { processKeystroke, createInitialContext, parseCursorPosition } from "./core/vim-state";
