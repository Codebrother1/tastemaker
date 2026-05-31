import { describe, expect, it } from "vitest";
import { compileStyleGuide } from "./_core/styleCompiler";
import { EXPORT_FILENAMES, REFLECTION_PROMPT } from "../shared/stylelab";
import type { Clip, StyleRule, TastePattern } from "../drizzle/schema";

const baseDates = {
  createdAt: new Date("2026-05-30T12:00:00Z"),
  updatedAt: new Date("2026-05-30T12:00:00Z"),
};

function rule(over: Partial<StyleRule> = {}): StyleRule {
  return {
    id: 1,
    userId: 1,
    title: "Prefer concrete nouns",
    positiveInstruction: "Anchor every claim to a specific image.",
    avoidanceGuidance: "Do not abstract a verb when a noun will carry the weight.",
    revisionGuidance: "Replace abstractions with one concrete object.",
    citationClipIds: [10],
    isActive: true,
    sourcePatternId: null,
    ...baseDates,
    ...over,
  } as StyleRule;
}

function pattern(over: Partial<TastePattern> = {}): TastePattern {
  return {
    id: 5,
    userId: 1,
    title: "Restrained tenderness",
    description: "Quiet emotional registers held just below the line.",
    evidenceClipIds: [10, 11],
    ...baseDates,
    ...over,
  } as TastePattern;
}

function clip(over: Partial<Clip> = {}): Clip {
  return {
    id: 10,
    userId: 1,
    content: "She set the cup down without a sound and the room kept breathing.",
    sourceType: "book",
    sourceTitle: "Crossing to Safety",
    sourceAuthor: "Wallace Stegner",
    sourceUrl: null,
    labels: [],
    deletedAt: null,
    ...baseDates,
    ...over,
  } as Clip;
}

describe("compileStyleGuide", () => {
  it("produces all five artifacts", () => {
    const out = compileStyleGuide({
      ownerName: "Avery",
      rules: [rule()],
      patterns: [pattern()],
      citedClips: [clip()],
    });
    expect(typeof out.styleGuideMd).toBe("string");
    expect(typeof out.skillMd).toBe("string");
    expect(typeof out.styleProfileJson).toBe("string");
    expect(typeof out.claudeInstructions).toBe("string");
    expect(typeof out.chatgptInstructions).toBe("string");
  });

  it("STYLE_GUIDE.md contains the owner, the rule, do/avoid/revise, and the cited clip text", () => {
    const out = compileStyleGuide({
      ownerName: "Avery",
      rules: [rule()],
      patterns: [pattern()],
      citedClips: [clip()],
    });
    expect(out.styleGuideMd).toContain("# Avery's Style Guide");
    expect(out.styleGuideMd).toContain("Prefer concrete nouns");
    expect(out.styleGuideMd).toContain("**Do:**");
    expect(out.styleGuideMd).toContain("**Avoid:**");
    expect(out.styleGuideMd).toContain("**When revising:**");
    expect(out.styleGuideMd).toContain("She set the cup down");
    expect(out.styleGuideMd).toContain("Wallace Stegner");
  });

  it("SKILL.md uses YAML frontmatter and a kebab-cased name", () => {
    const out = compileStyleGuide({
      ownerName: "Jane Doe",
      rules: [rule()],
      patterns: [pattern()],
      citedClips: [clip()],
    });
    expect(out.skillMd.startsWith("---\n")).toBe(true);
    expect(out.skillMd).toContain("name: jane-doe-writing-style");
    expect(out.skillMd).toContain("# Jane Doe's Writing Style Skill");
    expect(out.skillMd).toContain("## When to use");
    expect(out.skillMd).toContain("## Output protocol");
  });

  it("style_profile.json is valid JSON and round-trips the rules + patterns", () => {
    const out = compileStyleGuide({
      ownerName: "Avery",
      rules: [rule()],
      patterns: [pattern()],
      citedClips: [clip()],
    });
    const parsed = JSON.parse(out.styleProfileJson);
    expect(parsed.owner).toBe("Avery");
    expect(parsed.rules).toHaveLength(1);
    expect(parsed.rules[0]).toMatchObject({
      title: "Prefer concrete nouns",
      citationClipIds: [10],
    });
    expect(parsed.patterns).toHaveLength(1);
    expect(parsed.patterns[0]).toMatchObject({
      title: "Restrained tenderness",
      evidenceClipIds: [10, 11],
    });
    expect(typeof parsed.generatedAt).toBe("string");
  });

  it("handles an empty rule set without throwing", () => {
    const out = compileStyleGuide({
      ownerName: "Empty",
      rules: [],
      patterns: [],
      citedClips: [],
    });
    expect(out.styleGuideMd).toContain("No active rules yet");
    expect(out.skillMd).toContain("(No rules yet");
    expect(out.claudeInstructions).toContain("(Rules not yet generated.)");
    expect(out.chatgptInstructions).toContain("(Rules not yet generated.)");
  });

  it("only quotes evidence clips that are referenced in citationClipIds", () => {
    const ruleA = rule({ id: 1, title: "Cited rule", citationClipIds: [10] });
    const ruleB = rule({ id: 2, title: "Uncited rule", citationClipIds: [] });
    const out = compileStyleGuide({
      ownerName: "Avery",
      rules: [ruleA, ruleB],
      patterns: [],
      citedClips: [clip()],
    });
    // Find the section for the uncited rule and ensure it has no Evidence block before the next rule.
    const segment = out.styleGuideMd.split("### Uncited rule")[1] ?? "";
    expect(segment.includes("**Evidence:**")).toBe(false);
  });
});

describe("StyleLab shared constants", () => {
  it("has the exact reflection prompt wording the spec requires", () => {
    expect(REFLECTION_PROMPT).toBe("What made you save this?");
  });

  it("uses the exact export filenames the spec requires", () => {
    expect(EXPORT_FILENAMES.styleGuide).toBe("STYLE_GUIDE.md");
    expect(EXPORT_FILENAMES.skill).toBe("SKILL.md");
    expect(EXPORT_FILENAMES.styleProfile).toBe("style_profile.json");
  });
});
