/**
 * useVimEngine.ts
 *
 * Vimエンジンのメインフック。
 * テキストバッファ、Vim状態、キーボードイベント処理を統合する。
 *
 * このフックがShikiVimコンポーネントの全ロジックを管理する:
 * - TextBuffer の管理
 * - VimContext の状態管理
 * - キーボードイベントのハンドリング
 * - コールバック（onChange, onYank, onSave）の呼び出し
 * - スクロール処理
 */

import { useCallback, useRef, useState } from "react";
import type { CursorPosition, VimMode, VimAction, VimContext } from "../types";
import { TextBuffer } from "../core/buffer";
import {
  createInitialContext,
  parseCursorPosition,
  processKeystroke,
} from "../core/vim-state";

/** useVimEngine のオプション */
export interface VimEngineOptions {
  /** 初期コンテンツ */
  content: string;
  /** 初期カーソル位置（"1:1" 形式、1-based） */
  cursorPosition?: string;
  /** 読み取り専用モード */
  readOnly?: boolean;
  /** コンテンツ変更時のコールバック */
  onChange?: (content: string) => void;
  /** ヤンク時のコールバック */
  onYank?: (text: string) => void;
  /** 保存時のコールバック */
  onSave?: (content: string) => void;
  /** モード変更時のコールバック */
  onModeChange?: (mode: VimMode) => void;
}

/** useVimEngine の返り値 */
export interface VimEngineState {
  /** 現在のコンテンツ */
  content: string;
  /** 現在のカーソル位置 */
  cursor: CursorPosition;
  /** 現在のVimモード */
  mode: VimMode;
  /** ステータスバーに表示するメッセージ */
  statusMessage: string;
  /** ビジュアルモードの選択アンカー */
  visualAnchor: CursorPosition | null;
  /** コマンドラインの入力バッファ */
  commandLine: string;
  /** キーボードイベントハンドラ */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** スクロールイベントハンドラ（半ページスクロール用） */
  handleScroll: (direction: "up" | "down", visibleLines: number) => void;
}

/**
 * Vimエンジンのメインフック。
 *
 * TextBufferはrefで管理（ミュータブル、レンダリングとは独立）。
 * 表示に関わる状態（カーソル、モード、コンテンツ）はstateで管理。
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
  } = options;

  // TextBuffer は ref で管理（頻繁なミューテーションがあるため）
  const bufferRef = useRef<TextBuffer>(new TextBuffer(initialContent));

  // VimContext も ref で管理（パーサーの中間状態はレンダリング不要）
  const ctxRef = useRef<VimContext>(
    createInitialContext(parseCursorPosition(cursorPosition)),
  );

  // 表示に関わる状態
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

  /**
   * アクションリストを処理し、Reactの状態とコールバックを更新する。
   */
  const processActions = useCallback(
    (actions: VimAction[], newCtx: VimContext) => {
      for (const action of actions) {
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
            // statusMessage は ctx から設定される
            break;

          case "scroll":
            // スクロールはコンポーネント側で処理
            break;

          case "noop":
            break;
        }
      }

      // VimContext から常に同期する状態
      setStatusMessage(newCtx.statusMessage);
      setVisualAnchor(newCtx.visualAnchor);
      setCommandLine(
        newCtx.commandType
          ? newCtx.commandType + newCtx.commandBuffer
          : "",
      );
    },
    [onChange, onYank, onSave, onModeChange],
  );

  /**
   * キーボードイベントハンドラ。
   * KeyboardEvent を受け取り、Vimエンジンに渡す。
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // IME入力中は無視
      if (e.nativeEvent.isComposing) return;

      // ブラウザのデフォルト動作を防ぐ
      // Ctrl-R（リロード）、Ctrl-D（ブックマーク）などの衝突を防止
      const shouldPrevent = shouldPreventDefault(e);
      if (shouldPrevent) {
        e.preventDefault();
      }

      // Vimエンジンにキーストロークを渡す（readOnlyフラグで書き込み操作をブロック）
      const { newCtx, actions } = processKeystroke(
        e.key,
        ctxRef.current,
        bufferRef.current,
        e.ctrlKey,
        readOnly,
      );

      // コンテキストを更新
      ctxRef.current = newCtx;

      // アクションを処理
      processActions(actions, newCtx);
    },
    [readOnly, processActions],
  );

  /**
   * スクロールハンドラ（Ctrl-U/D 用）。
   * コンポーネントから可視行数を受け取り、カーソルとスクロール位置を更新する。
   */
  const handleScroll = useCallback(
    (direction: "up" | "down", visibleLines: number) => {
      const halfPage = Math.max(1, Math.floor(visibleLines / 2));
      const buffer = bufferRef.current;
      const ctx = ctxRef.current;

      const newLine =
        direction === "up"
          ? Math.max(0, ctx.cursor.line - halfPage)
          : Math.min(buffer.getLineCount() - 1, ctx.cursor.line + halfPage);

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

  return {
    content,
    cursor,
    mode,
    statusMessage,
    visualAnchor,
    commandLine,
    handleKeyDown,
    handleScroll,
  };
}

/**
 * ブラウザのデフォルト動作を防ぐべきかを判定する。
 *
 * Vimエディタとして機能するためには、以下のキーのデフォルト動作を防ぐ必要がある:
 * - Ctrl-R（ブラウザリロード → Vimのリドゥ）
 * - Ctrl-D（ブックマーク追加 → Vimの半ページ下スクロール）
 * - Ctrl-U（ソース表示 → Vimの半ページ上スクロール）
 * - Tab（フォーカス移動 → インデント）
 * - Escape（ダイアログ閉じ → モード切替）
 * - /（クイックサーチ → Vim検索）
 * - 通常の文字キー（入力ではなくVimコマンドとして処理）
 */
function shouldPreventDefault(e: React.KeyboardEvent): boolean {
  // Ctrlキーコンビネーション
  if (e.ctrlKey) {
    const ctrlKeys = ["r", "d", "u"];
    if (ctrlKeys.includes(e.key)) return true;
  }

  // 特殊キー
  if (e.key === "Tab" || e.key === "Escape") return true;

  // 検索キー（ブラウザのクイックサーチを防ぐ）
  if (e.key === "/") return true;

  return false;
}
