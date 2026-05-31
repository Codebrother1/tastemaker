import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clips: passages of writing the user admires.
 * Soft-deletable via deletedAt.
 */
export const clips = mysqlTable(
  "clips",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    content: text("content").notNull(),
    sourceType: mysqlEnum("sourceType", [
      "sentence",
      "tweet",
      "paragraph",
      "book",
      "article",
      "other",
    ]).default("paragraph").notNull(),
    sourceTitle: varchar("sourceTitle", { length: 500 }),
    sourceAuthor: varchar("sourceAuthor", { length: 255 }),
    sourceUrl: varchar("sourceUrl", { length: 1000 }),
    sourceLocation: varchar("sourceLocation", { length: 255 }),
    labels: json("labels").$type<string[]>().default([]),
    capturedFrom: mysqlEnum("capturedFrom", ["manual", "ocr", "import"])
      .default("manual")
      .notNull(),
    imageKey: varchar("imageKey", { length: 500 }),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userIdx: index("clips_user_idx").on(t.userId),
    deletedIdx: index("clips_deleted_idx").on(t.deletedAt),
  })
);

export type Clip = typeof clips.$inferSelect;
export type InsertClip = typeof clips.$inferInsert;

/**
 * Reflections: free-form answers to "What made you save this?"
 */
export const clipReflections = mysqlTable(
  "clip_reflections",
  {
    id: int("id").autoincrement().primaryKey(),
    clipId: int("clipId").notNull(),
    userId: int("userId").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    clipIdx: index("reflections_clip_idx").on(t.clipId),
  })
);

export type ClipReflection = typeof clipReflections.$inferSelect;
export type InsertClipReflection = typeof clipReflections.$inferInsert;

/**
 * AI-generated annotation per clip.
 * Stored as structured JSON with stable keys.
 */
export type ClipAnnotationData = {
  tone: string[];
  syntax: string[];
  imagery: string[];
  rhythm: string[];
  rhetoricalMoves: string[];
  dominantEffect: string;
  notes?: string;
};

export const clipAnnotations = mysqlTable(
  "clip_annotations",
  {
    id: int("id").autoincrement().primaryKey(),
    clipId: int("clipId").notNull(),
    userId: int("userId").notNull(),
    data: json("data").$type<ClipAnnotationData>().notNull(),
    model: varchar("model", { length: 128 }),
    /**
     * The styleGuideVersions.id that was active when this annotation was
     * produced. Null for annotations created before v0.3.0 — those count as
     * stale on the next refresh sweep.
     */
    styleGuideVersionId: int("styleGuideVersionId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    clipIdx: uniqueIndex("annotations_clip_unique").on(t.clipId),
  })
);

export type ClipAnnotation = typeof clipAnnotations.$inferSelect;
export type InsertClipAnnotation = typeof clipAnnotations.$inferInsert;

/**
 * Taste patterns: synthesized across multiple clips with citations.
 */
export const tastePatterns = mysqlTable(
  "taste_patterns",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    evidenceClipIds: json("evidenceClipIds").$type<number[]>().default([]),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userIdx: index("patterns_user_idx").on(t.userId),
  })
);

export type TastePattern = typeof tastePatterns.$inferSelect;
export type InsertTastePattern = typeof tastePatterns.$inferInsert;

/**
 * Style rules derived from patterns.
 */
export const styleRules = mysqlTable(
  "style_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    patternId: int("patternId"),
    title: varchar("title", { length: 255 }).notNull(),
    positiveInstruction: text("positiveInstruction").notNull(),
    avoidanceGuidance: text("avoidanceGuidance").notNull(),
    revisionGuidance: text("revisionGuidance").notNull(),
    citationClipIds: json("citationClipIds").$type<number[]>().default([]),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userIdx: index("rules_user_idx").on(t.userId),
  })
);

export type StyleRule = typeof styleRules.$inferSelect;
export type InsertStyleRule = typeof styleRules.$inferInsert;

/**
 * Versioned compiled style guides.
 * Auto-saved on every regeneration.
 */
export type StyleGuideArtifacts = {
  styleGuideMd: string;
  skillMd: string;
  styleProfileJson: string;
  claudeInstructions: string;
  chatgptInstructions: string;
};

export const styleGuideVersions = mysqlTable(
  "style_guide_versions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    versionNumber: int("versionNumber").notNull(),
    ruleCount: int("ruleCount").notNull(),
    summary: text("summary"),
    artifacts: json("artifacts").$type<StyleGuideArtifacts>().notNull(),
    isActive: boolean("isActive").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("guide_versions_user_idx").on(t.userId),
  })
);

export type StyleGuideVersion = typeof styleGuideVersions.$inferSelect;
export type InsertStyleGuideVersion = typeof styleGuideVersions.$inferInsert;

/**
 * Draft reviews from the Draft Coach.
 */
export type DraftScores = {
  concreteness: number;
  implication: number;
  rhythm: number;
  tone: number;
  compression: number;
  originality: number;
};

export type DraftSuggestion = {
  ruleId: number | null;
  ruleTitle: string;
  excerpt: string;
  suggestion: string;
  citationClipIds: number[];
  /**
   * Optional rewrite produced by the model that the user can apply
   * in-place. Empty string means “no rewrite proposed”.
   */
  proposedRewrite?: string;
};

export const draftReviews = mysqlTable(
  "draft_reviews",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    styleGuideVersionId: int("styleGuideVersionId"),
    draftText: text("draftText").notNull(),
    scores: json("scores").$type<DraftScores>().notNull(),
    suggestions: json("suggestions").$type<DraftSuggestion[]>().notNull(),
    summary: text("summary"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("drafts_user_idx").on(t.userId),
  })
);

export type DraftReview = typeof draftReviews.$inferSelect;
export type InsertDraftReview = typeof draftReviews.$inferInsert;

/**
 * Collections: named groupings (project, author, theme, purpose).
 */
export const collections = mysqlTable(
  "collections",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    kind: mysqlEnum("kind", ["project", "author", "theme", "purpose", "other"])
      .default("other")
      .notNull(),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userIdx: index("collections_user_idx").on(t.userId),
  })
);

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = typeof collections.$inferInsert;

export const clipCollections = mysqlTable(
  "clip_collections",
  {
    id: int("id").autoincrement().primaryKey(),
    clipId: int("clipId").notNull(),
    collectionId: int("collectionId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    pairIdx: uniqueIndex("clip_collection_pair").on(t.clipId, t.collectionId),
  })
);

export type ClipCollection = typeof clipCollections.$inferSelect;
export type InsertClipCollection = typeof clipCollections.$inferInsert;
