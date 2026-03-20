/**
 * normal-mode.ts
 *
 * ノーマルモードのキーストローク処理。
 *
 * ノーマルモードはVimのデフォルトモードで、以下を処理する:
 * - カウントプレフィックス（3j, 5dw など）
 * - オペレーター（d, y, c）→ オペレーターペンディング状態へ
 * - モーション（h, j, k, l, w, e, b, etc.）
 * - インサートモードへの遷移（i, a, o, I, A, O）
 * - 編集コマンド（x, p, P, r, J）
 * - ビジュアルモードへの遷移（v, V）
 * - コマンドライン / 検索への遷移（:, /, ?）
 * - undo / redo（u, Ctrl-R）
 * - g プレフィックスコマンド（gg）
 * - 文字待ちコマンド（f, F, t, T, r）
 */

import type { VimContext, VimAction, CursorPosition } from "../types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./vim-state";
import {
  isCountKey,
  isOperator,
  isCharCommand,
  getEffectiveCount,
  isCountExplicit,
  modeChange,
  accumulateCount,
  resetContext,
} from "./key-utils";
import { handleCtrlKey } from "./ctrl-keys";
import { resolveMotion } from "./motion-resolver";
import { executeOperatorOnRange, executeLineOperator } from "./operators";
import { handleCharPending } from "./char-pending";
import { motionGG } from "./motions";
import { searchInBuffer } from "./search";

/**
 * ノーマルモードのメインハンドラ。
 * キーストロークを受け取り、状態遷移とアクションを返す。
 */
export function processNormalMode(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean,
  readOnly: boolean = false,
): KeystrokeResult {
  // --- g プレフィックスペンディング ---
  if (ctx.phase === "g-pending") {
    return handleGPending(key, ctx, buffer);
  }

  // --- 文字ペンディング (f, F, t, T, r) ---
  if (ctx.phase === "char-pending") {
    return handleCharPending(key, ctx, buffer);
  }

  // --- Ctrlキーコンビネーション ---
  if (ctrlKey) {
    return handleCtrlKey(key, ctx, buffer, readOnly);
  }

  // --- readOnly: ミューテーション操作をブロック ---
  if (readOnly && ctx.phase === "idle") {
    // prettier-ignore
    const mutatingKeys = new Set([
      "i", "a", "o", "I", "A", "O",  // insert entry
      "x", "p", "P",                   // edit commands
      "d", "c",                         // mutating operators (y is allowed)
      "J",                              // join lines
      "u",                              // undo
      "r",                              // replace char
      ":",                              // ex commands
    ]);
    if (mutatingKeys.has(key)) {
      return { newCtx: resetContext(ctx), actions: [] };
    }
  }

  // --- カウント入力 ---
  if (isCountKey(key, ctx)) {
    return accumulateCount(key, ctx);
  }

  // --- オペレーターペンディング中のキー処理 ---
  if (ctx.phase === "operator-pending" && ctx.operator) {
    return handleOperatorPending(key, ctx, buffer);
  }

  // --- オペレーター開始 ---
  if (isOperator(key)) {
    return {
      newCtx: {
        ...ctx,
        operator: key,
        phase: "operator-pending",
        statusMessage: key,
      },
      actions: [],
    };
  }

  // --- モーション ---
  const motionResult = tryMotion(key, ctx, buffer);
  if (motionResult) return motionResult;

  // --- g プレフィックス ---
  if (key === "g") {
    return {
      newCtx: { ...ctx, phase: "g-pending" },
      actions: [],
    };
  }

  // --- 文字待ちコマンド ---
  if (isCharCommand(key)) {
    return {
      newCtx: { ...ctx, phase: "char-pending", charCommand: key },
      actions: [],
    };
  }

  // --- インサートモード遷移 ---
  const insertResult = tryInsertEntry(key, ctx, buffer);
  if (insertResult) return insertResult;

  // --- 編集コマンド ---
  const editResult = tryEditCommand(key, ctx, buffer);
  if (editResult) return editResult;

  // --- undo ---
  if (key === "u") {
    return handleUndo(ctx, buffer);
  }

  // --- ビジュアルモード ---
  if (key === "v") {
    return {
      newCtx: {
        ...ctx,
        mode: "visual",
        phase: "idle",
        count: 0,
        visualAnchor: { ...ctx.cursor },
        statusMessage: "-- VISUAL --",
      },
      actions: [{ type: "mode-change", mode: "visual" }],
    };
  }
  if (key === "V") {
    return {
      newCtx: {
        ...ctx,
        mode: "visual-line",
        phase: "idle",
        count: 0,
        visualAnchor: { ...ctx.cursor },
        statusMessage: "-- VISUAL LINE --",
      },
      actions: [{ type: "mode-change", mode: "visual-line" }],
    };
  }

  // --- コマンドライン / 検索 ---
  if (key === ":" || key === "/" || key === "?") {
    return enterCommandLine(key as ":" | "/" | "?", ctx);
  }

  // --- n / N: 検索繰り返し ---
  if (key === "n" || key === "N") {
    return handleSearchRepeat(key, ctx, buffer);
  }

  // --- J: 行結合 ---
  if (key === "J") {
    return handleJoinLines(ctx, buffer);
  }

  // --- マッチしないキー → リセット ---
  return {
    newCtx: resetContext(ctx),
    actions: [],
  };
}

// =====================
// 内部ハンドラ
// =====================

/**
 * g プレフィックス後のキー処理。
 * gg → ファイル先頭へ移動
 */
function handleGPending(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (key === "g") {
    const count = ctx.count > 0 ? ctx.count : null;
    const result = motionGG(ctx.cursor, buffer, count);

    // オペレーターペンディング中ならオペレーターを実行
    if (ctx.operator) {
      buffer.saveUndoPoint(ctx.cursor);
      const opResult = executeOperatorOnRange(
        ctx.operator,
        result.range,
        buffer,
        ctx.cursor,
      );
      return {
        newCtx: {
          ...resetContext(ctx),
          mode: opResult.newMode,
          cursor: opResult.newCursor,
          register: opResult.yankedText,
        },
        actions: [
          ...opResult.actions,
          { type: "cursor-move", position: opResult.newCursor },
          ...(opResult.newMode !== ctx.mode
            ? [{ type: "mode-change" as const, mode: opResult.newMode }]
            : []),
        ],
      };
    }

    return {
      newCtx: {
        ...resetContext(ctx),
        cursor: result.cursor,
      },
      actions: [{ type: "cursor-move", position: result.cursor }],
    };
  }

  // 未知の g コマンド → リセット
  return {
    newCtx: resetContext(ctx),
    actions: [],
  };
}

/**
 * オペレーターペンディング中のキー処理。
 * オペレーターの後にモーションやカウントが来るのを待つ。
 */
function handleOperatorPending(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  // カウント入力
  if (isCountKey(key, ctx)) {
    return accumulateCount(key, ctx);
  }

  // 同じオペレーターキー → 行操作（dd, yy, cc）
  if (key === ctx.operator) {
    buffer.saveUndoPoint(ctx.cursor);
    const count = getEffectiveCount(ctx);
    const result = executeLineOperator(ctx.operator!, ctx.cursor, count, buffer);

    return {
      newCtx: {
        ...resetContext(ctx),
        mode: result.newMode,
        cursor: result.newCursor,
        register: result.yankedText,
      },
      actions: [
        ...result.actions,
        { type: "cursor-move", position: result.newCursor },
        ...(result.newMode !== ctx.mode
          ? [{ type: "mode-change" as const, mode: result.newMode }]
          : []),
      ],
    };
  }

  // 文字待ちコマンド（df{char} など）
  if (isCharCommand(key) && key !== "r") {
    return {
      newCtx: { ...ctx, phase: "char-pending", charCommand: key },
      actions: [],
    };
  }

  // g プレフィックス（dgg など）
  if (key === "g") {
    return {
      newCtx: { ...ctx, phase: "g-pending" },
      actions: [],
    };
  }

  // モーション
  const count = getEffectiveCount(ctx);
  const countExplicit = isCountExplicit(ctx);
  const motion = resolveMotion(key, ctx.cursor, buffer, count, countExplicit);

  if (motion) {
    buffer.saveUndoPoint(ctx.cursor);
    const result = executeOperatorOnRange(
      ctx.operator!,
      motion.range,
      buffer,
      ctx.cursor,
    );

    return {
      newCtx: {
        ...resetContext(ctx),
        mode: result.newMode,
        cursor: result.newCursor,
        register: result.yankedText,
      },
      actions: [
        ...result.actions,
        { type: "cursor-move", position: result.newCursor },
        ...(result.newMode !== ctx.mode
          ? [{ type: "mode-change" as const, mode: result.newMode }]
          : []),
      ],
    };
  }

  // 無効なキー → オペレーターキャンセル
  return {
    newCtx: resetContext(ctx),
    actions: [],
  };
}

/**
 * モーションの解決と実行を試みる。
 * モーションにマッチしなければnullを返す。
 */
function tryMotion(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult | null {
  const count = getEffectiveCount(ctx);
  const countExplicit = isCountExplicit(ctx);
  const motion = resolveMotion(key, ctx.cursor, buffer, count, countExplicit);

  if (!motion) return null;

  return {
    newCtx: {
      ...resetContext(ctx),
      cursor: motion.cursor,
    },
    actions: [{ type: "cursor-move", position: motion.cursor }],
  };
}

/**
 * インサートモードへの遷移を試みる。
 * i, a, I, A, o, O をハンドルする。
 */
function tryInsertEntry(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult | null {
  switch (key) {
    case "i":
      return modeChange(ctx, "insert");

    case "a": {
      // カーソルを1つ右へ（行末を超えない）
      const col = Math.min(
        ctx.cursor.col + 1,
        buffer.getLineLength(ctx.cursor.line),
      );
      return modeChange(
        { ...ctx, cursor: { ...ctx.cursor, col } },
        "insert",
      );
    }

    case "I": {
      // 行の最初の非空白文字へ移動してinsert
      const lineText = buffer.getLine(ctx.cursor.line);
      const col = lineText.match(/\S/)?.index ?? 0;
      return modeChange(
        { ...ctx, cursor: { ...ctx.cursor, col } },
        "insert",
      );
    }

    case "A": {
      // 行末へ移動してinsert
      const col = buffer.getLineLength(ctx.cursor.line);
      return modeChange(
        { ...ctx, cursor: { ...ctx.cursor, col } },
        "insert",
      );
    }

    case "o": {
      // 現在行の下に空行を挿入してinsert
      buffer.saveUndoPoint(ctx.cursor);
      buffer.insertLine(ctx.cursor.line + 1, "");
      const newCursor = { line: ctx.cursor.line + 1, col: 0 };
      return {
        newCtx: {
          ...resetContext(ctx),
          mode: "insert",
          cursor: newCursor,
          statusMessage: "-- INSERT --",
        },
        actions: [
          { type: "content-change", content: buffer.getContent() },
          { type: "cursor-move", position: newCursor },
          { type: "mode-change", mode: "insert" },
        ],
      };
    }

    case "O": {
      // 現在行の上に空行を挿入してinsert
      buffer.saveUndoPoint(ctx.cursor);
      buffer.insertLine(ctx.cursor.line, "");
      const newCursor = { line: ctx.cursor.line, col: 0 };
      return {
        newCtx: {
          ...resetContext(ctx),
          mode: "insert",
          cursor: newCursor,
          statusMessage: "-- INSERT --",
        },
        actions: [
          { type: "content-change", content: buffer.getContent() },
          { type: "cursor-move", position: newCursor },
          { type: "mode-change", mode: "insert" },
        ],
      };
    }

    default:
      return null;
  }
}

/**
 * 編集コマンド（x, p, P）を試みる。
 */
function tryEditCommand(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult | null {
  const count = getEffectiveCount(ctx);

  switch (key) {
    case "x":
      return handleDeleteChar(ctx, buffer, count);
    case "p":
      return handlePasteAfter(ctx, buffer, count);
    case "P":
      return handlePasteBefore(ctx, buffer, count);
    default:
      return null;
  }
}

/**
 * x: カーソル下の文字を削除
 */
function handleDeleteChar(
  ctx: VimContext,
  buffer: TextBuffer,
  count: number,
): KeystrokeResult {
  if (buffer.getLineLength(ctx.cursor.line) === 0) {
    return { newCtx: ctx, actions: [] };
  }

  buffer.saveUndoPoint(ctx.cursor);
  const deleted = buffer.deleteAt(ctx.cursor.line, ctx.cursor.col, count);
  const maxCol = Math.max(0, buffer.getLineLength(ctx.cursor.line) - 1);
  const newCursor = {
    line: ctx.cursor.line,
    col: Math.min(ctx.cursor.col, maxCol),
  };

  return {
    newCtx: {
      ...resetContext(ctx),
      register: deleted,
      cursor: newCursor,
    },
    actions: [
      { type: "yank", text: deleted },
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * p: カーソルの後ろにペースト
 */
function handlePasteAfter(
  ctx: VimContext,
  buffer: TextBuffer,
  count: number,
): KeystrokeResult {
  if (!ctx.register) return { newCtx: ctx, actions: [] };

  buffer.saveUndoPoint(ctx.cursor);

  // 行単位のペースト（レジスタが改行で終わる場合）
  if (ctx.register.endsWith("\n")) {
    const text = ctx.register.slice(0, -1);
    for (let i = 0; i < count; i++) {
      buffer.insertLine(ctx.cursor.line + 1, text);
    }
    const newCursor = { line: ctx.cursor.line + 1, col: 0 };
    return {
      newCtx: { ...resetContext(ctx), cursor: newCursor },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: newCursor },
      ],
    };
  }

  // 文字単位のペースト
  const col = ctx.cursor.col + 1;
  for (let i = 0; i < count; i++) {
    buffer.insertAt(ctx.cursor.line, col, ctx.register);
  }
  const newCursor = {
    line: ctx.cursor.line,
    col: col + ctx.register.length * count - 1,
  };
  return {
    newCtx: { ...resetContext(ctx), cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * P: カーソルの前にペースト
 */
function handlePasteBefore(
  ctx: VimContext,
  buffer: TextBuffer,
  count: number,
): KeystrokeResult {
  if (!ctx.register) return { newCtx: ctx, actions: [] };

  buffer.saveUndoPoint(ctx.cursor);

  if (ctx.register.endsWith("\n")) {
    const text = ctx.register.slice(0, -1);
    for (let i = 0; i < count; i++) {
      buffer.insertLine(ctx.cursor.line, text);
    }
    const newCursor = { line: ctx.cursor.line, col: 0 };
    return {
      newCtx: { ...resetContext(ctx), cursor: newCursor },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: newCursor },
      ],
    };
  }

  for (let i = 0; i < count; i++) {
    buffer.insertAt(ctx.cursor.line, ctx.cursor.col, ctx.register);
  }
  const newCursor = {
    line: ctx.cursor.line,
    col: ctx.cursor.col + ctx.register.length * count - 1,
  };
  return {
    newCtx: { ...resetContext(ctx), cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * u: undo
 */
function handleUndo(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const restored = buffer.undo(ctx.cursor);

  if (restored) {
    return {
      newCtx: { ...resetContext(ctx), cursor: restored },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: restored },
      ],
    };
  }

  return {
    newCtx: { ...ctx, count: 0, statusMessage: "Already at oldest change" },
    actions: [
      { type: "status-message", message: "Already at oldest change" },
    ],
  };
}

/**
 * コマンドライン / 検索モードへ遷移
 */
function enterCommandLine(
  type: ":" | "/" | "?",
  ctx: VimContext,
): KeystrokeResult {
  return {
    newCtx: {
      ...ctx,
      mode: "command-line",
      commandType: type,
      commandBuffer: "",
      statusMessage: type,
      ...(type !== ":" && {
        searchDirection: type === "/" ? ("forward" as const) : ("backward" as const),
      }),
    },
    actions: [],
  };
}

/**
 * n / N: 前回の検索を繰り返す
 */
function handleSearchRepeat(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (!ctx.lastSearch) {
    return { newCtx: ctx, actions: [] };
  }

  // N は検索方向を反転
  const direction =
    key === "n"
      ? ctx.searchDirection
      : ctx.searchDirection === "forward"
        ? ("backward" as const)
        : ("forward" as const);

  const found = searchInBuffer(buffer, ctx.lastSearch, ctx.cursor, direction);

  if (found) {
    return {
      newCtx: { ...resetContext(ctx), cursor: found },
      actions: [{ type: "cursor-move", position: found }],
    };
  }

  return {
    newCtx: {
      ...ctx,
      count: 0,
      statusMessage: `Pattern not found: ${ctx.lastSearch}`,
    },
    actions: [
      {
        type: "status-message",
        message: `Pattern not found: ${ctx.lastSearch}`,
      },
    ],
  };
}

/**
 * J: 現在行と次の行を結合
 */
function handleJoinLines(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (ctx.cursor.line >= buffer.getLineCount() - 1) {
    return { newCtx: ctx, actions: [] };
  }

  buffer.saveUndoPoint(ctx.cursor);

  const currentLen = buffer.getLineLength(ctx.cursor.line);
  const nextLine = buffer.getLine(ctx.cursor.line + 1).trimStart();

  buffer.setLine(
    ctx.cursor.line,
    buffer.getLine(ctx.cursor.line) + " " + nextLine,
  );
  buffer.deleteLines(ctx.cursor.line + 1, 1);

  const newCursor = { line: ctx.cursor.line, col: currentLen };

  return {
    newCtx: { ...resetContext(ctx), cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}
