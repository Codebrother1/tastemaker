import { describe, expect, it } from "vitest";

// We import the diff util through a relative path because vitest config maps
// the `@/` alias to the project's client folder. The util is pure TS.
import { diffWords, tokenize } from "../client/src/lib/wordDiff";

describe("wordDiff.tokenize", () => {
  it("preserves whitespace as its own tokens", () => {
    expect(tokenize("a  b\nc")).toEqual(["a", "  ", "b", "\n", "c"]);
  });
});

describe("wordDiff.diffWords", () => {
  it("flags identical strings as all equal", () => {
    const { before, after } = diffWords("hello world", "hello world");
    expect(before.every((t) => t.kind === "equal")).toBe(true);
    expect(after.every((t) => t.kind === "equal")).toBe(true);
  });

  it("identifies an inserted word", () => {
    const { before, after } = diffWords("the cat sat", "the small cat sat");
    const adds = after.filter((t) => t.kind === "add").map((t) => t.text.trim());
    expect(adds).toContain("small");
    expect(before.every((t) => t.kind !== "add")).toBe(true);
  });

  it("identifies a removed word", () => {
    const { before, after } = diffWords(
      "very strong opinion",
      "strong opinion"
    );
    const removes = before
      .filter((t) => t.kind === "remove")
      .map((t) => t.text.trim());
    expect(removes).toContain("very");
    expect(after.every((t) => t.kind !== "remove")).toBe(true);
  });

  it("supports a substitution (remove + add)", () => {
    const { before, after } = diffWords("the quick fox", "the lazy fox");
    expect(
      before.some((t) => t.kind === "remove" && t.text.includes("quick"))
    ).toBe(true);
    expect(
      after.some((t) => t.kind === "add" && t.text.includes("lazy"))
    ).toBe(true);
  });
});
