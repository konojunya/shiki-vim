import { describe, it, expect } from "vitest";
import { TextBuffer } from "./buffer";

// ヘルパー: CursorPosition を簡潔に生成する
const cursor = (line: number, col: number) => ({ line, col });

describe("TextBuffer", () => {
  // ============================================================
  // constructor
  // ============================================================
  describe("constructor", () => {
    it("コンテンツが改行で行に分割されること", () => {
      const buf = new TextBuffer("hello\nworld\nfoo");
      expect(buf.getLineCount()).toBe(3);
      expect(buf.getLine(0)).toBe("hello");
      expect(buf.getLine(1)).toBe("world");
      expect(buf.getLine(2)).toBe("foo");
    });

    it("空文字列の場合、1行の空行になること", () => {
      const buf = new TextBuffer("");
      expect(buf.getLineCount()).toBe(1);
      expect(buf.getLine(0)).toBe("");
    });

    it("末尾に改行がある場合、最後に空行が追加されること", () => {
      const buf = new TextBuffer("hello\n");
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("hello");
      expect(buf.getLine(1)).toBe("");
    });
  });

  // ============================================================
  // getLine
  // ============================================================
  describe("getLine", () => {
    it("有効なインデックスで正しい行を返すこと", () => {
      const buf = new TextBuffer("aaa\nbbb\nccc");
      expect(buf.getLine(1)).toBe("bbb");
    });

    it("範囲外のインデックスで空文字列を返すこと", () => {
      const buf = new TextBuffer("only");
      expect(buf.getLine(999)).toBe("");
      expect(buf.getLine(-1)).toBe("");
    });
  });

  // ============================================================
  // getLineLength
  // ============================================================
  describe("getLineLength", () => {
    it("行の文字数を返すこと", () => {
      const buf = new TextBuffer("hello\nworld");
      expect(buf.getLineLength(0)).toBe(5);
      expect(buf.getLineLength(1)).toBe(5);
    });

    it("空行の場合0を返すこと", () => {
      const buf = new TextBuffer("hello\n\nworld");
      expect(buf.getLineLength(1)).toBe(0);
    });

    it("範囲外のインデックスで0を返すこと", () => {
      const buf = new TextBuffer("hello");
      expect(buf.getLineLength(100)).toBe(0);
    });
  });

  // ============================================================
  // getLineCount
  // ============================================================
  describe("getLineCount", () => {
    it("単一行のコンテンツで1を返すこと", () => {
      const buf = new TextBuffer("single line");
      expect(buf.getLineCount()).toBe(1);
    });

    it("複数行のコンテンツで正しい行数を返すこと", () => {
      const buf = new TextBuffer("a\nb\nc\nd");
      expect(buf.getLineCount()).toBe(4);
    });

    it("空文字列で1を返すこと", () => {
      const buf = new TextBuffer("");
      expect(buf.getLineCount()).toBe(1);
    });
  });

  // ============================================================
  // getContent
  // ============================================================
  describe("getContent", () => {
    it("元のコンテンツと一致すること（ラウンドトリップ）", () => {
      const original = "hello\nworld\nfoo bar";
      const buf = new TextBuffer(original);
      expect(buf.getContent()).toBe(original);
    });

    it("空文字列でもラウンドトリップが成立すること", () => {
      const buf = new TextBuffer("");
      expect(buf.getContent()).toBe("");
    });

    it("末尾改行を含むコンテンツでもラウンドトリップが成立すること", () => {
      const original = "line1\nline2\n";
      const buf = new TextBuffer(original);
      expect(buf.getContent()).toBe(original);
    });
  });

  // ============================================================
  // getLines
  // ============================================================
  describe("getLines", () => {
    it("読み取り専用の行配列を返すこと", () => {
      const buf = new TextBuffer("a\nb\nc");
      const lines = buf.getLines();
      expect(lines).toEqual(["a", "b", "c"]);
      // readonly 配列であることを型レベルで確認（実行時は同じ参照）
      expect(Array.isArray(lines)).toBe(true);
    });
  });

  // ============================================================
  // saveUndoPoint / undo
  // ============================================================
  describe("saveUndoPoint と undo", () => {
    it("undo で以前の状態とカーソル位置が復元されること", () => {
      const buf = new TextBuffer("original");
      const savedCursor = cursor(0, 3);
      buf.saveUndoPoint(savedCursor);

      // 状態を変更する
      buf.setLine(0, "modified");
      expect(buf.getContent()).toBe("modified");

      // undo を実行
      const restoredCursor = buf.undo(cursor(0, 5));
      expect(restoredCursor).toEqual(savedCursor);
      expect(buf.getContent()).toBe("original");
    });

    it("複数回の undo が LIFO 順で復元されること", () => {
      const buf = new TextBuffer("state0");

      buf.saveUndoPoint(cursor(0, 0));
      buf.setLine(0, "state1");

      buf.saveUndoPoint(cursor(0, 1));
      buf.setLine(0, "state2");

      // 最初の undo で state1 に戻る
      const c1 = buf.undo(cursor(0, 2));
      expect(c1).toEqual(cursor(0, 1));
      expect(buf.getContent()).toBe("state1");

      // 2回目の undo で state0 に戻る
      const c0 = buf.undo(cursor(0, 1));
      expect(c0).toEqual(cursor(0, 0));
      expect(buf.getContent()).toBe("state0");
    });

    it("空のスタックで undo すると null を返すこと", () => {
      const buf = new TextBuffer("hello");
      const result = buf.undo(cursor(0, 0));
      expect(result).toBeNull();
    });

    it("undo 後もコンテンツが変わらないこと（スタックが空の場合）", () => {
      const buf = new TextBuffer("unchanged");
      buf.undo(cursor(0, 0));
      expect(buf.getContent()).toBe("unchanged");
    });
  });

  // ============================================================
  // redo
  // ============================================================
  describe("redo", () => {
    it("undo 後に redo で元の状態に戻ること", () => {
      const buf = new TextBuffer("original");
      buf.saveUndoPoint(cursor(0, 0));
      buf.setLine(0, "changed");

      // undo
      buf.undo(cursor(0, 4));

      expect(buf.getContent()).toBe("original");

      // redo
      const redoCursor = buf.redo(cursor(0, 0));
      expect(redoCursor).toEqual(cursor(0, 4));
      expect(buf.getContent()).toBe("changed");
    });

    it("新しい変更後に redo スタックがクリアされること", () => {
      const buf = new TextBuffer("v1");
      buf.saveUndoPoint(cursor(0, 0));
      buf.setLine(0, "v2");

      // undo で v1 に戻す
      buf.undo(cursor(0, 1));
      expect(buf.getContent()).toBe("v1");

      // 新しい変更を行う → redo スタックがクリアされる
      buf.saveUndoPoint(cursor(0, 0));
      buf.setLine(0, "v3");

      // redo は null を返すべき
      const result = buf.redo(cursor(0, 0));
      expect(result).toBeNull();
    });

    it("空の redo スタックで redo すると null を返すこと", () => {
      const buf = new TextBuffer("hello");
      const result = buf.redo(cursor(0, 0));
      expect(result).toBeNull();
    });
  });

  // ============================================================
  // setLine
  // ============================================================
  describe("setLine", () => {
    it("指定した行の内容が更新されること", () => {
      const buf = new TextBuffer("aaa\nbbb\nccc");
      buf.setLine(1, "BBB");
      expect(buf.getLine(1)).toBe("BBB");
      // 他の行は影響を受けない
      expect(buf.getLine(0)).toBe("aaa");
      expect(buf.getLine(2)).toBe("ccc");
    });

    it("範囲外のインデックスでは何も変更されないこと", () => {
      const buf = new TextBuffer("hello");
      buf.setLine(5, "no effect");
      expect(buf.getContent()).toBe("hello");
    });

    it("負のインデックスでは何も変更されないこと", () => {
      const buf = new TextBuffer("hello");
      buf.setLine(-1, "no effect");
      expect(buf.getContent()).toBe("hello");
    });
  });

  // ============================================================
  // insertAt
  // ============================================================
  describe("insertAt", () => {
    it("行の先頭にテキストを挿入できること", () => {
      const buf = new TextBuffer("world");
      buf.insertAt(0, 0, "hello ");
      expect(buf.getLine(0)).toBe("hello world");
    });

    it("行の中間にテキストを挿入できること", () => {
      const buf = new TextBuffer("helo");
      buf.insertAt(0, 2, "l");
      expect(buf.getLine(0)).toBe("hello");
    });

    it("行の末尾にテキストを挿入できること", () => {
      const buf = new TextBuffer("hello");
      buf.insertAt(0, 5, " world");
      expect(buf.getLine(0)).toBe("hello world");
    });

    it("複数文字を一度に挿入できること", () => {
      const buf = new TextBuffer("ac");
      buf.insertAt(0, 1, "b");
      expect(buf.getLine(0)).toBe("abc");
    });
  });

  // ============================================================
  // deleteAt
  // ============================================================
  describe("deleteAt", () => {
    it("1文字を削除して返すこと", () => {
      const buf = new TextBuffer("hello");
      const deleted = buf.deleteAt(0, 1);
      expect(deleted).toBe("e");
      expect(buf.getLine(0)).toBe("hllo");
    });

    it("複数文字を削除して返すこと", () => {
      const buf = new TextBuffer("abcdef");
      const deleted = buf.deleteAt(0, 1, 3);
      expect(deleted).toBe("bcd");
      expect(buf.getLine(0)).toBe("aef");
    });

    it("行末を超える削除では行末まで削除すること", () => {
      const buf = new TextBuffer("abc");
      const deleted = buf.deleteAt(0, 1, 100);
      expect(deleted).toBe("bc");
      expect(buf.getLine(0)).toBe("a");
    });

    it("先頭から削除できること", () => {
      const buf = new TextBuffer("hello");
      const deleted = buf.deleteAt(0, 0, 2);
      expect(deleted).toBe("he");
      expect(buf.getLine(0)).toBe("llo");
    });
  });

  // ============================================================
  // deleteRange
  // ============================================================
  describe("deleteRange", () => {
    it("同じ行内の範囲を削除できること", () => {
      const buf = new TextBuffer("hello world");
      const deleted = buf.deleteRange(0, 5, 0, 11);
      expect(deleted).toBe(" world");
      expect(buf.getLine(0)).toBe("hello");
    });

    it("複数行にまたがる範囲を削除できること", () => {
      const buf = new TextBuffer("aaa\nbbb\nccc\nddd");
      const deleted = buf.deleteRange(0, 2, 2, 1);
      expect(deleted).toBe("a\nbbb\nc");
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("aacc");
      expect(buf.getLine(1)).toBe("ddd");
    });

    it("行の先頭から末尾まで削除できること（同一行）", () => {
      const buf = new TextBuffer("delete me\nkeep");
      const deleted = buf.deleteRange(0, 0, 0, 9);
      expect(deleted).toBe("delete me");
      expect(buf.getLine(0)).toBe("");
    });

    it("2行にまたがる削除で行が結合されること", () => {
      const buf = new TextBuffer("first\nsecond\nthird");
      const deleted = buf.deleteRange(0, 3, 1, 3);
      expect(deleted).toBe("st\nsec");
      expect(buf.getLine(0)).toBe("firond");
      expect(buf.getLineCount()).toBe(2);
    });
  });

  // ============================================================
  // deleteLines
  // ============================================================
  describe("deleteLines", () => {
    it("単一行を削除できること", () => {
      const buf = new TextBuffer("aaa\nbbb\nccc");
      const deleted = buf.deleteLines(1, 1);
      expect(deleted).toEqual(["bbb"]);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("aaa");
      expect(buf.getLine(1)).toBe("ccc");
    });

    it("複数行を削除できること", () => {
      const buf = new TextBuffer("a\nb\nc\nd\ne");
      const deleted = buf.deleteLines(1, 3);
      expect(deleted).toEqual(["b", "c", "d"]);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("a");
      expect(buf.getLine(1)).toBe("e");
    });

    it("末尾を超える count の場合、存在する行のみ削除すること", () => {
      const buf = new TextBuffer("x\ny\nz");
      const deleted = buf.deleteLines(1, 100);
      expect(deleted).toEqual(["y", "z"]);
      expect(buf.getLineCount()).toBe(1);
      expect(buf.getLine(0)).toBe("x");
    });

    it("先頭行を削除できること", () => {
      const buf = new TextBuffer("first\nsecond");
      const deleted = buf.deleteLines(0, 1);
      expect(deleted).toEqual(["first"]);
      expect(buf.getLineCount()).toBe(1);
      expect(buf.getLine(0)).toBe("second");
    });
  });

  // ============================================================
  // insertLine
  // ============================================================
  describe("insertLine", () => {
    it("先頭に行を挿入できること", () => {
      const buf = new TextBuffer("existing");
      buf.insertLine(0, "new first");
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("new first");
      expect(buf.getLine(1)).toBe("existing");
    });

    it("中間に行を挿入できること", () => {
      const buf = new TextBuffer("a\nc");
      buf.insertLine(1, "b");
      expect(buf.getLineCount()).toBe(3);
      expect(buf.getLine(0)).toBe("a");
      expect(buf.getLine(1)).toBe("b");
      expect(buf.getLine(2)).toBe("c");
    });

    it("末尾に行を挿入できること", () => {
      const buf = new TextBuffer("first");
      buf.insertLine(1, "second");
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("first");
      expect(buf.getLine(1)).toBe("second");
    });
  });

  // ============================================================
  // splitLine
  // ============================================================
  describe("splitLine", () => {
    it("行の先頭で分割すると空行が前に挿入されること", () => {
      const buf = new TextBuffer("hello");
      buf.splitLine(0, 0);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("");
      expect(buf.getLine(1)).toBe("hello");
    });

    it("行の中間で分割できること", () => {
      const buf = new TextBuffer("hello world");
      buf.splitLine(0, 5);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("hello");
      expect(buf.getLine(1)).toBe(" world");
    });

    it("行の末尾で分割すると空行が後に挿入されること", () => {
      const buf = new TextBuffer("hello");
      buf.splitLine(0, 5);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("hello");
      expect(buf.getLine(1)).toBe("");
    });

    it("複数行のバッファで中間行を分割できること", () => {
      const buf = new TextBuffer("aa\nbbcc\ndd");
      buf.splitLine(1, 2);
      expect(buf.getLineCount()).toBe(4);
      expect(buf.getLine(0)).toBe("aa");
      expect(buf.getLine(1)).toBe("bb");
      expect(buf.getLine(2)).toBe("cc");
      expect(buf.getLine(3)).toBe("dd");
    });
  });

  // ============================================================
  // joinLines
  // ============================================================
  describe("joinLines", () => {
    it("次の行と結合されること", () => {
      const buf = new TextBuffer("hello\nworld");
      buf.joinLines(0);
      expect(buf.getLineCount()).toBe(1);
      expect(buf.getLine(0)).toBe("helloworld");
    });

    it("最終行で joinLines を呼ぶと何も変更されないこと", () => {
      const buf = new TextBuffer("only line");
      buf.joinLines(0);
      expect(buf.getLineCount()).toBe(1);
      expect(buf.getLine(0)).toBe("only line");
    });

    it("中間行を結合できること", () => {
      const buf = new TextBuffer("a\nb\nc");
      buf.joinLines(1);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("a");
      expect(buf.getLine(1)).toBe("bc");
    });

    it("空行との結合が正しく動作すること", () => {
      const buf = new TextBuffer("hello\n\nworld");
      buf.joinLines(0);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("hello");
      expect(buf.getLine(1)).toBe("world");
    });
  });

  // ============================================================
  // replaceContent
  // ============================================================
  describe("replaceContent", () => {
    it("コンテンツ全体が置換されること", () => {
      const buf = new TextBuffer("old content\nmultiple lines");
      buf.replaceContent("new\ncontent");
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("new");
      expect(buf.getLine(1)).toBe("content");
    });

    it("空文字列で置換できること", () => {
      const buf = new TextBuffer("something");
      buf.replaceContent("");
      expect(buf.getLineCount()).toBe(1);
      expect(buf.getLine(0)).toBe("");
    });

    it("置換後に getContent が新しいコンテンツを返すこと", () => {
      const buf = new TextBuffer("before");
      const newContent = "after\nreplacement";
      buf.replaceContent(newContent);
      expect(buf.getContent()).toBe(newContent);
    });
  });

  // ============================================================
  // undo / redo の統合テスト
  // ============================================================
  describe("undo/redo の統合テスト", () => {
    it("undo → redo → undo の連続操作が正しく動作すること", () => {
      const buf = new TextBuffer("v0");
      buf.saveUndoPoint(cursor(0, 0));
      buf.setLine(0, "v1");
      buf.saveUndoPoint(cursor(0, 1));
      buf.setLine(0, "v2");

      // v2 → v1
      buf.undo(cursor(0, 2));
      expect(buf.getContent()).toBe("v1");

      // v1 → v2 (redo)
      buf.redo(cursor(0, 1));
      expect(buf.getContent()).toBe("v2");

      // v2 → v1 (undo again)
      buf.undo(cursor(0, 2));
      expect(buf.getContent()).toBe("v1");

      // v1 → v0
      buf.undo(cursor(0, 1));
      expect(buf.getContent()).toBe("v0");
    });

    it("saveUndoPoint がカーソル位置のコピーを保存すること（参照ではない）", () => {
      const buf = new TextBuffer("test");
      const mutableCursor = { line: 0, col: 5 };
      buf.saveUndoPoint(mutableCursor);

      // 元のカーソルオブジェクトを変更しても影響しない
      mutableCursor.line = 99;
      mutableCursor.col = 99;

      buf.setLine(0, "modified");
      const restored = buf.undo(cursor(0, 0));
      expect(restored).toEqual(cursor(0, 5));
    });

    it("undo が現在の状態を redo スタックに正しく保存すること", () => {
      const buf = new TextBuffer("original");
      buf.saveUndoPoint(cursor(0, 0));
      buf.setLine(0, "edited");

      // undo 時に渡すカーソル位置が redo で復元される
      const undoCursor = cursor(0, 6);
      buf.undo(undoCursor);

      const redoResult = buf.redo(cursor(0, 0));
      expect(redoResult).toEqual(undoCursor);
      expect(buf.getContent()).toBe("edited");
    });
  });
});
