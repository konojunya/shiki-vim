/**
 * useShikiTokens.ts
 *
 * ShikiのHighlighterインスタンスを使って、
 * コンテンツをトークン列に変換するカスタムフック。
 *
 * codeToTokens() を使い、各行のトークン（色・スタイル情報付き）を取得する。
 * テーマの背景色もここで取得する。
 */

import { useMemo } from "react";
import type { HighlighterCore, ThemedToken } from "shiki";

/** トークン列と背景色 */
export interface ShikiTokenResult {
  /** 行ごとのトークン列 */
  tokenLines: ThemedToken[][];
  /** テーマの背景色 */
  bgColor: string;
  /** テーマの前景色（デフォルトテキストカラー） */
  fgColor: string;
}

/**
 * コンテンツをShikiでトークナイズする。
 *
 * @param highlighter - Shiki Highlighter インスタンス
 * @param content - トークナイズするコンテンツ
 * @param lang - プログラミング言語
 * @param theme - カラーテーマ
 * @param extraOptions - codeToTokens に渡す追加オプション
 */
export function useShikiTokens(
  highlighter: HighlighterCore,
  content: string,
  lang: string,
  theme: string,
  extraOptions?: Record<string, unknown>,
): ShikiTokenResult {
  return useMemo(() => {
    try {
      const result = highlighter.codeToTokens(content, {
        lang,
        theme,
        ...extraOptions,
      });

      // テーマの色情報を取得
      const bgColor = result.bg ?? "#1e1e1e";
      const fgColor = result.fg ?? "#d4d4d4";

      return {
        tokenLines: result.tokens,
        bgColor,
        fgColor,
      };
    } catch {
      // フォールバック: トークナイズに失敗した場合、プレーンテキストとして表示
      const lines = content.split("\n");
      const tokenLines: ThemedToken[][] = lines.map((line) => [
        {
          content: line,
          offset: 0,
        } as ThemedToken,
      ]);

      return {
        tokenLines,
        bgColor: "#1e1e1e",
        fgColor: "#d4d4d4",
      };
    }
  }, [highlighter, content, lang, theme, extraOptions]);
}
