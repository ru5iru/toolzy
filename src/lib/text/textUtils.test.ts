import { describe, expect, it } from "vitest";
import { convertCase, dedupeLines, numberLines, slugify, sortLines, textStats, trimLines } from "./textUtils";

describe("convertCase", () => {
  it("handles identifier cases from mixed input", () => {
    expect(convertCase("helloWorld foo-bar", "snake")).toBe("hello_world_foo_bar");
    expect(convertCase("hello world", "camel")).toBe("helloWorld");
    expect(convertCase("hello_world", "pascal")).toBe("HelloWorld");
    expect(convertCase("HTTPServer error", "kebab")).toBe("http-server-error");
    expect(convertCase("max retries", "constant")).toBe("MAX_RETRIES");
  });
  it("converts each line separately", () => { expect(convertCase("a b\nc d", "camel")).toBe("aB\ncD"); });
  it("title and sentence case", () => {
    expect(convertCase("the QUICK fox", "title")).toBe("The Quick Fox");
    expect(convertCase("one. two! three", "sentence")).toBe("One. Two! Three");
  });
});
describe("slugify", () => { it("strips accents and symbols", () => expect(slugify("  Crème Brûlée & Co.! ")).toBe("creme-brulee-co")); });
describe("line tools", () => {
  it("sorts text and numbers", () => {
    expect(sortLines("b\nA\nc")).toBe("A\nb\nc");
    expect(sortLines("10\n9\n100", { numeric: true })).toBe("9\n10\n100");
    expect(sortLines("a\nb", { descending: true })).toBe("b\na");
  });
  it("dedupes keeping first", () => {
    expect(dedupeLines("a\nb\na\nA")).toBe("a\nb\nA");
    expect(dedupeLines("a\nA", false)).toBe("a");
  });
  it("trims and numbers", () => {
    expect(trimLines(" a \n\n b", true)).toBe("a\nb");
    expect(numberLines("x\ny")).toBe("1  x\n2  y");
  });
});
describe("textStats", () => {
  it("counts", () => {
    const s = textStats("hello world\nsecond line");
    expect(s).toMatchObject({ words: 4, lines: 2, characters: 23 });
    expect(textStats("")).toMatchObject({ words: 0, lines: 0, readingMinutes: 0 });
    expect(textStats("😀").characters).toBe(1);
  });
});
