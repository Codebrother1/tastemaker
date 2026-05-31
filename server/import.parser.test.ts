import { describe, expect, it } from "vitest";
import { detectFormat, parseCsv, parseImport } from "@shared/importParser";

describe("importParser.detectFormat", () => {
  it("detects Twitter from a window.YTD prefix", () => {
    const text = `window.YTD.tweets.part0 = [\n  { "tweet": { "id_str": "1", "full_text": "hello" } }\n]`;
    expect(detectFormat(text, "tweets.js")).toBe("twitter");
  });

  it("detects Twitter from a bare JSON array", () => {
    const text = `[{"tweet": {"id_str": "1", "full_text": "hi"}}]`;
    expect(detectFormat(text, "tweets.json")).toBe("twitter");
  });

  it("detects Readwise CSV from its header", () => {
    const text = `Highlight,Book Title,Book Author,URL,Location,Category\n"x","y","z","","",book\n`;
    expect(detectFormat(text, "readwise.csv")).toBe("readwise");
  });

  it("falls back to generic CSV on a comma header", () => {
    const text = `content,source_title,source_author\n"hello","x","y"\n`;
    expect(detectFormat(text, "highlights.csv")).toBe("csv");
  });
});

describe("importParser.parseImport — CSV", () => {
  it("parses a generic CSV with quoted commas and labels", () => {
    const text = [
      `content,source_title,source_author,labels`,
      `"A, but also B","Book","Person","tag1;tag2"`,
      `"second","T2","P2","tag3"`,
    ].join("\n");
    const res = parseImport(text, "csv");
    expect(res.clips).toHaveLength(2);
    expect(res.clips[0]).toMatchObject({
      content: "A, but also B",
      sourceTitle: "Book",
      sourceAuthor: "Person",
      labels: ["tag1", "tag2"],
    });
    expect(res.clips[1].labels).toEqual(["tag3"]);
  });

  it("skips empty rows with a reason", () => {
    const text = `content\n"abc"\n""\n"def"\n`;
    const res = parseImport(text, "csv");
    expect(res.clips).toHaveLength(2);
    expect(res.skipped.length).toBe(1);
    expect(res.skipped[0].reason).toMatch(/empty/i);
  });
});

describe("importParser.parseImport — Readwise", () => {
  it("infers source type from Category and pulls metadata", () => {
    const text = [
      `Highlight,Book Title,Book Author,URL,Location,Category`,
      `"A passage","On Writing","Stephen King","","p. 12",book`,
      `"A tweet","","Snowden","https://t.co/x","",tweets`,
    ].join("\n");
    const res = parseImport(text, "readwise");
    expect(res.clips).toHaveLength(2);
    expect(res.clips[0].sourceType).toBe("book");
    expect(res.clips[0].sourceLocation).toBe("p. 12");
    expect(res.clips[1].sourceType).toBe("tweet");
    expect(res.clips[1].sourceUrl).toBe("https://t.co/x");
  });
});

describe("importParser.parseImport — Twitter", () => {
  it("strips window.YTD prefix and skips retweets", () => {
    const body = JSON.stringify([
      { tweet: { id_str: "1", full_text: "an original thought" } },
      { tweet: { id_str: "2", full_text: "RT @other: not mine" } },
    ]);
    const text = `window.YTD.tweets.part0 = ${body};`;
    const res = parseImport(text, "twitter");
    expect(res.clips).toHaveLength(1);
    expect(res.clips[0].sourceType).toBe("tweet");
    expect(res.clips[0].content).toBe("an original thought");
    expect(res.skipped.some((s) => /retweet/i.test(s.reason))).toBe(true);
  });

  it("returns a skip reason for invalid JSON", () => {
    const res = parseImport("not json at all", "twitter");
    expect(res.clips).toEqual([]);
    expect(res.skipped[0].reason).toMatch(/invalid json/i);
  });
});

describe("importParser.parseCsv", () => {
  it("handles embedded newlines inside quoted fields", () => {
    const text = `content\n"line1\nline2"\n"line3"\n`;
    const rows = parseCsv(text);
    expect(rows).toHaveLength(3);
    expect(rows[1][0]).toBe("line1\nline2");
    expect(rows[2][0]).toBe("line3");
  });
});
