import { invokeLLM } from "./llm";
import type {
  Clip,
  ClipAnnotationData,
  DraftScores,
  DraftSuggestion,
  StyleRule,
} from "../../drizzle/schema";

/**
 * Centralized prompt + JSON-schema layer for StyleLab.
 * Every public function here returns clean, typed data — never raw LLM strings.
 */

const ANNOTATION_SCHEMA = {
  name: "clip_annotation",
  strict: true,
  schema: {
    type: "object",
    properties: {
      tone: { type: "array", items: { type: "string" } },
      syntax: { type: "array", items: { type: "string" } },
      imagery: { type: "array", items: { type: "string" } },
      rhythm: { type: "array", items: { type: "string" } },
      rhetoricalMoves: { type: "array", items: { type: "string" } },
      dominantEffect: { type: "string" },
      notes: { type: "string" },
    },
    required: ["tone", "syntax", "imagery", "rhythm", "rhetoricalMoves", "dominantEffect", "notes"],
    additionalProperties: false,
  },
} as const;

export async function annotateClip(args: {
  content: string;
  sourceTitle?: string | null;
  sourceAuthor?: string | null;
  reflection?: string | null;
}): Promise<ClipAnnotationData> {
  const system = [
    "You are a meticulous prose analyst.",
    "Given a passage of writing the reader admires, identify what makes the prose work.",
    "Be precise, concrete, and avoid generic praise.",
    "Respond ONLY with JSON matching the supplied schema.",
  ].join(" ");

  const user = [
    `PASSAGE:\n"""${args.content}"""`,
    args.sourceTitle ? `Title: ${args.sourceTitle}` : null,
    args.sourceAuthor ? `Author: ${args.sourceAuthor}` : null,
    args.reflection ? `Reader said: ${args.reflection}` : null,
    "",
    "For each field, return 1-4 short, specific phrases:",
    "- tone: emotional register, attitude (e.g. 'restrained tenderness')",
    "- syntax: sentence shape, length, rhythm of clauses",
    "- imagery: concrete images, sensory anchors",
    "- rhythm: how the passage moves on the ear",
    "- rhetoricalMoves: turn, anaphora, juxtaposition, withholding, etc.",
    "- dominantEffect: ONE sentence on the passage's primary effect",
    "- notes: optional, anything else worth remembering",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await invokeLLM({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: ANNOTATION_SCHEMA },
  });
  const parsed = safeParse(stringifyContent(res.choices?.[0]?.message?.content));
  return normalizeAnnotation(parsed);
}

function normalizeAnnotation(raw: any): ClipAnnotationData {
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  return {
    tone: arr(raw?.tone),
    syntax: arr(raw?.syntax),
    imagery: arr(raw?.imagery),
    rhythm: arr(raw?.rhythm),
    rhetoricalMoves: arr(raw?.rhetoricalMoves),
    dominantEffect: typeof raw?.dominantEffect === "string" ? raw.dominantEffect : "",
    notes: typeof raw?.notes === "string" ? raw.notes : "",
  };
}

const PATTERNS_SCHEMA = {
  name: "taste_patterns",
  strict: true,
  schema: {
    type: "object",
    properties: {
      patterns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            evidenceClipIds: { type: "array", items: { type: "integer" } },
          },
          required: ["title", "description", "evidenceClipIds"],
          additionalProperties: false,
        },
      },
    },
    required: ["patterns"],
    additionalProperties: false,
  },
} as const;

export type SynthesizedPattern = {
  title: string;
  description: string;
  evidenceClipIds: number[];
};

export async function synthesizePatterns(args: {
  clips: Array<{ id: number; content: string; reflection?: string | null }>;
}): Promise<SynthesizedPattern[]> {
  const system = [
    "You are a literary editor trained to detect a writer's taste.",
    "Read the supplied passages and the reader's reflections.",
    "Identify 3 to 7 RECURRING style patterns the reader appears drawn to.",
    "Each pattern must cite specific clip IDs as evidence.",
    "Return ONLY JSON matching the schema.",
  ].join(" ");

  const userBlocks = args.clips
    .map((c) =>
      `CLIP ${c.id}:\n"""${c.content}"""${
        c.reflection ? `\nReflection: ${c.reflection}` : ""
      }`
    )
    .join("\n\n");

  const res = await invokeLLM({
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `${userBlocks}\n\nIdentify recurring style patterns with evidence (use the numeric clip IDs).`,
      },
    ],
    response_format: { type: "json_schema", json_schema: PATTERNS_SCHEMA },
  });
  const parsed = safeParse(stringifyContent(res.choices?.[0]?.message?.content));
  const list: SynthesizedPattern[] = Array.isArray(parsed?.patterns)
    ? parsed.patterns.map((p: any) => ({
        title: String(p?.title ?? "Untitled pattern"),
        description: String(p?.description ?? ""),
        evidenceClipIds: Array.isArray(p?.evidenceClipIds)
          ? p.evidenceClipIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [],
      }))
    : [];
  return list;
}

const RULES_SCHEMA = {
  name: "style_rules",
  strict: true,
  schema: {
    type: "object",
    properties: {
      rules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            positiveInstruction: { type: "string" },
            avoidanceGuidance: { type: "string" },
            revisionGuidance: { type: "string" },
            citationClipIds: { type: "array", items: { type: "integer" } },
          },
          required: [
            "title",
            "positiveInstruction",
            "avoidanceGuidance",
            "revisionGuidance",
            "citationClipIds",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["rules"],
    additionalProperties: false,
  },
} as const;

export type GeneratedRule = {
  title: string;
  positiveInstruction: string;
  avoidanceGuidance: string;
  revisionGuidance: string;
  citationClipIds: number[];
};

export async function generateRulesFromPattern(args: {
  pattern: { title: string; description: string; evidenceClipIds: number[] };
  clips: Array<{ id: number; content: string }>;
}): Promise<GeneratedRule[]> {
  const system = [
    "You translate observations about a writer's taste into ACTIONABLE writing rules.",
    "Each rule must be concrete enough to follow when revising a draft.",
    "Use the clips as evidence; cite their IDs in citationClipIds.",
    "Return ONLY JSON matching the schema.",
  ].join(" ");

  const evidence = args.clips
    .map((c) => `CLIP ${c.id}: """${c.content}"""`)
    .join("\n\n");

  const user = [
    `PATTERN: ${args.pattern.title}\nDESCRIPTION: ${args.pattern.description}`,
    "",
    "EVIDENCE:",
    evidence,
    "",
    "Produce 1-3 rules. Each rule has:",
    "- title: short, imperative",
    "- positiveInstruction: do this",
    "- avoidanceGuidance: don't do this",
    "- revisionGuidance: how to fix a draft that violates it",
    "- citationClipIds: ids of clips that exemplify it",
  ].join("\n");

  const res = await invokeLLM({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: RULES_SCHEMA },
  });
  const parsed = safeParse(stringifyContent(res.choices?.[0]?.message?.content));
  const list: GeneratedRule[] = Array.isArray(parsed?.rules)
    ? parsed.rules.map((r: any) => ({
        title: String(r?.title ?? "Untitled rule"),
        positiveInstruction: String(r?.positiveInstruction ?? ""),
        avoidanceGuidance: String(r?.avoidanceGuidance ?? ""),
        revisionGuidance: String(r?.revisionGuidance ?? ""),
        citationClipIds: Array.isArray(r?.citationClipIds)
          ? r.citationClipIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [],
      }))
    : [];
  return list;
}

const DRAFT_SCHEMA = {
  name: "draft_review",
  strict: true,
  schema: {
    type: "object",
    properties: {
      scores: {
        type: "object",
        properties: {
          concreteness: { type: "integer" },
          implication: { type: "integer" },
          rhythm: { type: "integer" },
          tone: { type: "integer" },
          compression: { type: "integer" },
          originality: { type: "integer" },
        },
        required: [
          "concreteness",
          "implication",
          "rhythm",
          "tone",
          "compression",
          "originality",
        ],
        additionalProperties: false,
      },
      summary: { type: "string" },
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ruleId: { type: ["integer", "null"] },
            ruleTitle: { type: "string" },
            excerpt: { type: "string" },
            suggestion: { type: "string" },
            proposedRewrite: { type: "string" },
            citationClipIds: { type: "array", items: { type: "integer" } },
          },
          required: [
            "ruleId",
            "ruleTitle",
            "excerpt",
            "suggestion",
            "proposedRewrite",
            "citationClipIds",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["scores", "summary", "suggestions"],
    additionalProperties: false,
  },
} as const;

export type DraftReviewResult = {
  scores: DraftScores;
  summary: string;
  suggestions: DraftSuggestion[];
};

export async function reviewDraft(args: {
  draft: string;
  rules: StyleRule[];
  cited: Clip[];
}): Promise<DraftReviewResult> {
  const system = [
    "You are a writing coach scoring a draft against the writer's personal style guide.",
    "Score each dimension on 0-100. Suggest revisions tied to the supplied rules.",
    "Cite specific rule IDs when applicable. Return ONLY JSON matching the schema.",
  ].join(" ");

  const ruleText = args.rules
    .map(
      (r) =>
        `RULE ${r.id}: ${r.title}\n  + ${r.positiveInstruction}\n  - ${r.avoidanceGuidance}\n  ↻ ${r.revisionGuidance}`
    )
    .join("\n\n");
  const clipText = args.cited
    .map((c) => `CLIP ${c.id}: """${c.content}"""`)
    .join("\n\n");

  const user = [
    "STYLE RULES:",
    ruleText || "(no active rules)",
    "",
    "EVIDENCE CLIPS:",
    clipText || "(none)",
    "",
    "DRAFT:",
    `"""${args.draft}"""`,
    "",
    "Score the draft on six dimensions and produce concrete revision suggestions tied to rules.",
    "Use 'excerpt' = the literal phrase from the draft you are commenting on.",
    "Use ruleId from the RULE numbers above; use null if no rule applies.",
    "Always provide 'proposedRewrite': a concrete rewrite of the excerpt that",
    "applies the rule. The rewrite must preserve meaning, length within ~20%,",
    "and be directly substitutable for the excerpt in the draft. If you truly",
    "cannot improve the excerpt, return an empty string.",
  ].join("\n");

  const res = await invokeLLM({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: DRAFT_SCHEMA },
  });
  const parsed = safeParse(stringifyContent(res.choices?.[0]?.message?.content));
  return normalizeDraftReview(parsed);
}

function clamp(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normalizeDraftReview(raw: any): DraftReviewResult {
  const s = raw?.scores ?? {};
  const scores: DraftScores = {
    concreteness: clamp(s.concreteness),
    implication: clamp(s.implication),
    rhythm: clamp(s.rhythm),
    tone: clamp(s.tone),
    compression: clamp(s.compression),
    originality: clamp(s.originality),
  };
  const suggestions: DraftSuggestion[] = Array.isArray(raw?.suggestions)
    ? raw.suggestions.map((s: any) => ({
        ruleId: s?.ruleId === null || s?.ruleId === undefined ? null : Number(s.ruleId),
        ruleTitle: String(s?.ruleTitle ?? ""),
        excerpt: String(s?.excerpt ?? ""),
        suggestion: String(s?.suggestion ?? ""),
        proposedRewrite: typeof s?.proposedRewrite === "string" ? s.proposedRewrite : "",
        citationClipIds: Array.isArray(s?.citationClipIds)
          ? s.citationClipIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [],
      }))
    : [];
  return {
    scores,
    summary: typeof raw?.summary === "string" ? raw.summary : "",
    suggestions,
  };
}

// ─────────────────────────── OCR / Vision ───────────────────────────

export async function extractTextFromImage(imageUrl: string): Promise<string> {
  const res = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a careful transcriber. Extract the writing from this image verbatim. Preserve line breaks where meaningful. Do not summarize, paraphrase, or add commentary.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe the text in this image." },
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
        ],
      },
    ],
  });
  return stringifyContent(res.choices?.[0]?.message?.content).trim();
}

function stringifyContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    // Sometimes the model wraps JSON in ```json fences.
    const m = s.match(/```(?:json)?\s*([\s\S]+?)```/);
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch {
        return {};
      }
    }
    return {};
  }
}
