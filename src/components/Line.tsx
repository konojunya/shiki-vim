/**
 * Line.tsx
 *
 * エディタの1行を描画するコンポーネント。
 * Shikiのトークン列を受け取り、色付きのspanとしてレンダリングする。
 *
 * ビジュアルモードの選択ハイライトもここで処理する。
 */

import type { ThemedToken } from "shiki";

export interface LineProps {
  /** 行番号（0-based） */
  lineIndex: number;
  /** この行のShikiトークン列 */
  tokens: ThemedToken[];
  /** 行番号を表示するか */
  showLineNumbers: boolean;
  /** 全体の行数（行番号の桁数計算用） */
  totalLines: number;
  /** この行が選択されているか（ビジュアルモード用） */
  isSelected: boolean;
  /** 行内の選択開始カラム（文字単位選択用） */
  selectionStartCol?: number;
  /** 行内の選択終了カラム（文字単位選択用） */
  selectionEndCol?: number;
}

/**
 * エディタの1行を描画する。
 *
 * 行番号 + トークン列で構成される。
 * 空行には非表示のスペースを入れて高さを維持する。
 */
export function Line({
  lineIndex,
  tokens,
  showLineNumbers,
  totalLines,
  isSelected,
  selectionStartCol,
  selectionEndCol,
}: LineProps) {
  // 行番号の桁数を計算（全行で揃えるため）
  const gutterWidth = String(totalLines).length;

  return (
    <div
      className="sv-line"
      data-line={lineIndex}
    >
      {/* 行番号ガター */}
      {showLineNumbers && (
        <span
          className="sv-line-number"
          style={{ minWidth: `${gutterWidth + 1}ch` }}
        >
          {lineIndex + 1}
        </span>
      )}

      {/* 行コンテンツ */}
      <span className="sv-line-content">
        {tokens.length === 0 || (tokens.length === 1 && tokens[0].content === "") ? (
          // 空行: 高さ維持のために不可視文字を入れる
          <span>{"\n"}</span>
        ) : (
          renderTokens(tokens, isSelected, selectionStartCol, selectionEndCol)
        )}
      </span>
    </div>
  );
}

/**
 * トークン列をspanとしてレンダリングする。
 * 選択状態がある場合は、選択範囲のスタイルを適用する。
 */
function renderTokens(
  tokens: ThemedToken[],
  isSelected: boolean,
  selectionStartCol?: number,
  selectionEndCol?: number,
): React.ReactNode[] {
  // 行全体が選択されている場合（visual-line モード）
  if (isSelected && selectionStartCol === undefined) {
    return tokens.map((token, i) => (
      <span
        key={i}
        className="sv-token sv-selected"
        style={{ color: token.color }}
      >
        {token.content}
      </span>
    ));
  }

  // 文字単位選択がない場合は通常描画
  if (selectionStartCol === undefined || selectionEndCol === undefined) {
    return tokens.map((token, i) => (
      <span
        key={i}
        className="sv-token"
        style={{ color: token.color }}
      >
        {token.content}
      </span>
    ));
  }

  // 文字単位の選択あり: トークンを分割してハイライト
  return renderTokensWithSelection(tokens, selectionStartCol, selectionEndCol);
}

/**
 * 文字単位選択がある場合のトークンレンダリング。
 * トークンの境界と選択範囲の境界が一致しない場合、
 * トークンを分割して選択部分にクラスを付与する。
 */
function renderTokensWithSelection(
  tokens: ThemedToken[],
  selStart: number,
  selEnd: number,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let col = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenStart = col;
    const tokenEnd = col + token.content.length;

    // トークンが選択範囲と重ならない場合
    if (tokenEnd <= selStart || tokenStart >= selEnd) {
      result.push(
        <span key={`${i}`} className="sv-token" style={{ color: token.color }}>
          {token.content}
        </span>,
      );
    }
    // トークン全体が選択範囲内の場合
    else if (tokenStart >= selStart && tokenEnd <= selEnd) {
      result.push(
        <span
          key={`${i}`}
          className="sv-token sv-selected"
          style={{ color: token.color }}
        >
          {token.content}
        </span>,
      );
    }
    // トークンが選択範囲と部分的に重なる場合 → 分割
    else {
      const parts = splitTokenBySelection(
        token,
        tokenStart,
        selStart,
        selEnd,
      );
      parts.forEach((part, j) => {
        result.push(
          <span
            key={`${i}-${j}`}
            className={`sv-token${part.selected ? " sv-selected" : ""}`}
            style={{ color: token.color }}
          >
            {part.content}
          </span>,
        );
      });
    }

    col = tokenEnd;
  }

  return result;
}

/**
 * トークンを選択範囲で分割する。
 */
function splitTokenBySelection(
  token: ThemedToken,
  tokenStart: number,
  selStart: number,
  selEnd: number,
): { content: string; selected: boolean }[] {
  const parts: { content: string; selected: boolean }[] = [];
  const text = token.content;
  const relSelStart = Math.max(0, selStart - tokenStart);
  const relSelEnd = Math.min(text.length, selEnd - tokenStart);

  // 選択前の部分
  if (relSelStart > 0) {
    parts.push({ content: text.slice(0, relSelStart), selected: false });
  }

  // 選択部分
  if (relSelEnd > relSelStart) {
    parts.push({
      content: text.slice(relSelStart, relSelEnd),
      selected: true,
    });
  }

  // 選択後の部分
  if (relSelEnd < text.length) {
    parts.push({ content: text.slice(relSelEnd), selected: false });
  }

  return parts;
}
