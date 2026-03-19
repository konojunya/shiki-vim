/**
 * search.test.ts
 *
 * バッファ内検索機能のテスト。
 * 前方検索、後方検索、ラップアラウンド、正規表現エラーなどを検証する。
 */

import { describe, it, expect } from "vitest";
import { searchInBuffer } from "./search";
import { TextBuffer } from "./buffer";

// =====================
// テスト本体
// =====================

describe("検索機能", () => {
  // ---------------------------------------------------
  // 前方検索
  // ---------------------------------------------------
  describe("前方検索", () => {
    it("カーソルの次の位置から最初のマッチを見つける", () => {
      const buffer = new TextBuffer("hello world hello");
      const result = searchInBuffer(
        buffer,
        "hello",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 0, col: 12 });
    });

    it("次の行でマッチを見つける", () => {
      const buffer = new TextBuffer("foo\nbar\nbaz");
      const result = searchInBuffer(
        buffer,
        "baz",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 2, col: 0 });
    });

    it("ラップアラウンドして先頭からマッチを見つける", () => {
      const buffer = new TextBuffer("hello\nworld\nfoo");
      const result = searchInBuffer(
        buffer,
        "hello",
        { line: 1, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 0, col: 0 });
    });

    it("同じ行のカーソルより後ろでマッチする", () => {
      const buffer = new TextBuffer("foo bar foo");
      const result = searchInBuffer(
        buffer,
        "foo",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 0, col: 8 });
    });
  });

  // ---------------------------------------------------
  // 後方検索
  // ---------------------------------------------------
  describe("後方検索", () => {
    it("カーソルの前の位置から最も近いマッチを見つける", () => {
      const buffer = new TextBuffer("hello world hello");
      const result = searchInBuffer(
        buffer,
        "hello",
        { line: 0, col: 12 },
        "backward",
      );
      expect(result).toEqual({ line: 0, col: 0 });
    });

    it("前の行でマッチを見つける", () => {
      const buffer = new TextBuffer("foo\nbar\nbaz");
      const result = searchInBuffer(
        buffer,
        "foo",
        { line: 2, col: 0 },
        "backward",
      );
      expect(result).toEqual({ line: 0, col: 0 });
    });

    it("ラップアラウンドして末尾からマッチを見つける", () => {
      const buffer = new TextBuffer("foo\nbar\nhello");
      const result = searchInBuffer(
        buffer,
        "hello",
        { line: 0, col: 0 },
        "backward",
      );
      expect(result).toEqual({ line: 2, col: 0 });
    });
  });

  // ---------------------------------------------------
  // マッチなし
  // ---------------------------------------------------
  describe("マッチなし", () => {
    it("パターンが見つからない場合 null を返す", () => {
      const buffer = new TextBuffer("hello world");
      const result = searchInBuffer(
        buffer,
        "xyz",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toBeNull();
    });

    it("後方検索でもマッチなしは null を返す", () => {
      const buffer = new TextBuffer("hello world");
      const result = searchInBuffer(
        buffer,
        "xyz",
        { line: 0, col: 10 },
        "backward",
      );
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------
  // 不正な正規表現
  // ---------------------------------------------------
  describe("不正な正規表現", () => {
    it("不正な正規表現パターンは null を返す", () => {
      const buffer = new TextBuffer("hello world");
      const result = searchInBuffer(
        buffer,
        "[invalid",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------
  // 同一行上の複数マッチ
  // ---------------------------------------------------
  describe("同一行上の複数マッチ", () => {
    it("前方検索で同一行の最初のマッチを返す", () => {
      const buffer = new TextBuffer("aaa bbb aaa bbb aaa");
      const result = searchInBuffer(
        buffer,
        "bbb",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 0, col: 4 });
    });

    it("後方検索で同一行の最もカーソルに近いマッチを返す", () => {
      const buffer = new TextBuffer("aaa bbb aaa bbb aaa");
      const result = searchInBuffer(
        buffer,
        "bbb",
        { line: 0, col: 15 },
        "backward",
      );
      expect(result).toEqual({ line: 0, col: 12 });
    });
  });

  // ---------------------------------------------------
  // 正規表現パターン
  // ---------------------------------------------------
  describe("正規表現パターン", () => {
    it("正規表現パターンでマッチする", () => {
      const buffer = new TextBuffer("abc 123 def 456");
      const result = searchInBuffer(
        buffer,
        "\\d+",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 0, col: 4 });
    });

    it("複数行にまたがる検索で正規表現が機能する", () => {
      const buffer = new TextBuffer("foo\nbar123\nbaz");
      const result = searchInBuffer(
        buffer,
        "\\d+",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 1, col: 3 });
    });
  });
});
