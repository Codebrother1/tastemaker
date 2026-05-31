/**
 * StyleLab shared constants.
 * Mirrored on server and client so user-facing strings and contracts stay aligned.
 */

export const REFLECTION_PROMPT = "What made you save this?" as const;

export const EXPORT_FILENAMES = {
  styleGuide: "STYLE_GUIDE.md",
  skill: "SKILL.md",
  styleProfile: "style_profile.json",
  claude: "claude_instructions.md",
  chatgpt: "chatgpt_instructions.md",
} as const;

export const DRAFT_DIMENSIONS = [
  "concreteness",
  "implication",
  "rhythm",
  "tone",
  "compression",
  "originality",
] as const;

export type DraftDimension = (typeof DRAFT_DIMENSIONS)[number];

export const SOURCE_TYPES = [
  "sentence",
  "tweet",
  "paragraph",
  "book",
  "article",
  "other",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const COLLECTION_KINDS = [
  "project",
  "author",
  "theme",
  "purpose",
  "other",
] as const;

export type CollectionKind = (typeof COLLECTION_KINDS)[number];
