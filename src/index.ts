/**
 * react.vim
 *
 * A vim-like lightweight code editor React component powered by Shiki.
 *
 * @example
 * ```tsx
 * import ShikiVim from 'react.vim'
 * import 'react.vim/styles.css'
 *
 * <ShikiVim
 *   content={code}
 *   highlighter={highlighter}
 *   lang="typescript"
 *   theme="vitesse-dark"
 * />
 * ```
 */

// Default export: main component
export { default } from "./ShikiVim";

// Named exports: type definitions
export type {
  ShikiVimProps,
  CursorPosition,
  VimMode,
  VimAction,
  VimContext,
} from "./types";

// Named exports: hooks (for custom usage)
export { useVimEngine } from "./hooks/useVimEngine";
export type { VimEngineOptions, VimEngineState } from "./hooks/useVimEngine";
export { useShikiTokens } from "./hooks/useShikiTokens";
export type { ShikiTokenResult } from "./hooks/useShikiTokens";

// Named exports: core modules (for testing and extension)
export { TextBuffer } from "./core/buffer";
export { processKeystroke, createInitialContext, parseCursorPosition } from "./core/vim-state";
