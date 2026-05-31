import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock all DB and AI dependencies BEFORE importing the router.
vi.mock("./db", () => {
  return {
    softDeleteClip: vi.fn(async () => undefined),
    restoreClip: vi.fn(async () => undefined),
    getClip: vi.fn(async () => ({ id: 1, userId: 1, content: "x" })),
    listRules: vi.fn(async () => []),
    listPatterns: vi.fn(async () => []),
    getClipsByIds: vi.fn(async () => []),
    nextVersionNumber: vi.fn(async () => 3),
    deactivateAllVersions: vi.fn(async () => undefined),
    createVersion: vi.fn(async () => 99),
    listVersions: vi.fn(async () => []),
    getActiveVersion: vi.fn(async () => undefined),
    listDraftReviews: vi.fn(async () => []),
    listCollections: vi.fn(async () => []),
    getCollection: vi.fn(async () => ({ id: 7, userId: 1, name: "Mine" })),
    deleteCollection: vi.fn(async () => undefined),
    addClipToCollection: vi.fn(async () => undefined),
    removeClipFromCollection: vi.fn(async () => undefined),
    bulkCreateClips: vi.fn(async (_userId: number, rows: unknown[]) => rows.length),
    listStaleAnnotationClipIds: vi.fn(async () => [10, 11]),
    listReflectionsForClip: vi.fn(async () => []),
    upsertAnnotation: vi.fn(async () => undefined),
    createDraftReview: vi.fn(async () => 1),
  };
});

vi.mock("./_core/styleAI", () => ({
  annotateClip: vi.fn(async () => ({
    tone: ["calm"],
    syntax: ["short"],
    imagery: [],
    rhythm: [],
    rhetoricalMoves: [],
    dominantEffect: "clarity",
    notes: "",
  })),
  extractTextFromImage: vi.fn(),
  generateRulesFromPattern: vi.fn(),
  reviewDraft: vi.fn(),
  synthesizePatterns: vi.fn(),
}));

vi.mock("./_core/styleCompiler", () => ({
  compileStyleGuide: vi.fn(() => ({
    styleGuideMd: "# guide",
    skillMd: "---\nname: x\n---\n",
    styleProfileJson: "{}",
    claudeInstructions: "claude",
    chatgptInstructions: "chatgpt",
  })),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import * as db from "./db";
import { compileStyleGuide } from "./_core/styleCompiler";
import { appRouter } from "./routers";

// Read the *real* db module to assert no hard-delete export exists.
const realDbModule = await vi.importActual<typeof import("./db")>("./db");

function ctx() {
  return {
    user: {
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as never,
    res: {} as never,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("clips.softDelete", () => {
  it("calls softDeleteClip (recoverable) and never hard-deletes", async () => {
    const caller = appRouter.createCaller(ctx());
    await caller.clips.softDelete({ id: 42 });
    expect(db.softDeleteClip).toHaveBeenCalledWith(1, 42);
    // Sanity: real db module exposes softDeleteClip / restoreClip but no hard-delete helper.
    const realKeys = Object.keys(realDbModule);
    expect(realKeys).toContain("softDeleteClip");
    expect(realKeys).toContain("restoreClip");
    expect(realKeys.some((k) => /hardDelete|destroyClip/i.test(k))).toBe(false);
  });
});

describe("clips.restore", () => {
  it("restores a soft-deleted clip", async () => {
    const caller = appRouter.createCaller(ctx());
    await caller.clips.restore({ id: 42 });
    expect(db.restoreClip).toHaveBeenCalledWith(1, 42);
  });
});

describe("collections.delete ownership", () => {
  it("router scopes the delete by user id (db.deleteCollection enforces ownership internally)", async () => {
    const caller = appRouter.createCaller(ctx());
    await caller.collections.delete({ id: 999 });
    expect(db.deleteCollection).toHaveBeenCalledWith(1, 999);
  });
});

describe("collections.addClip ownership", () => {
  it("requires the collection to belong to the caller", async () => {
    (db.getCollection as any).mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(ctx());
    await expect(
      caller.collections.addClip({ clipId: 1, collectionId: 7 })
    ).rejects.toThrow();
    expect(db.addClipToCollection).not.toHaveBeenCalled();
  });

  it("requires the clip to belong to the caller", async () => {
    (db.getClip as any).mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(ctx());
    await expect(
      caller.collections.addClip({ clipId: 1, collectionId: 7 })
    ).rejects.toThrow();
    expect(db.addClipToCollection).not.toHaveBeenCalled();
  });

  it("links the clip when both are owned by the caller", async () => {
    const caller = appRouter.createCaller(ctx());
    await caller.collections.addClip({ clipId: 1, collectionId: 7 });
    expect(db.addClipToCollection).toHaveBeenCalledWith(1, 7);
  });
});

describe("clips.bulkImport", () => {
  it("writes parsed rows scoped to the caller and reports skipped + truncated", async () => {
    const caller = appRouter.createCaller(ctx());
    const text = [
      `content,source_title,source_author`,
      `"first clip","Book","Alice"`,
      `"","empty","row"`,
      `"second clip","Article","Bob"`,
    ].join("\n");
    const res: any = await caller.clips.bulkImport({
      text,
      filename: "highlights.csv",
      dryRun: false,
    });
    expect(res.format).toBe("csv");
    expect(res.inserted).toBe(2);
    expect(res.skipped.length).toBe(1);
    expect(db.bulkCreateClips).toHaveBeenCalledTimes(1);
    const [userId, rows] = (db.bulkCreateClips as any).mock.calls[0];
    expect(userId).toBe(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      content: "first clip",
      sourceTitle: "Book",
      capturedFrom: "import",
    });
  });

  it("in dryRun mode never calls bulkCreateClips and returns a preview", async () => {
    const caller = appRouter.createCaller(ctx());
    const text = `content,extra\n"only one","x"\n`;
    const res: any = await caller.clips.bulkImport({
      text,
      format: "csv",
      dryRun: true,
    });
    expect("preview" in res).toBe(true);
    expect(res.previewCount).toBe(1);
    expect(db.bulkCreateClips).not.toHaveBeenCalled();
  });
});

describe("draft.review schema", () => {
  it("propagates proposedRewrite from the AI helper through the procedure", async () => {
    const { reviewDraft } = await import("./_core/styleAI");
    (reviewDraft as any).mockResolvedValueOnce({
      scores: {
        concreteness: 80,
        implication: 70,
        rhythm: 60,
        tone: 70,
        compression: 65,
        originality: 75,
      },
      summary: "ok",
      suggestions: [
        {
          ruleId: 5,
          ruleTitle: "Trim hedges",
          excerpt: "perhaps maybe sort of",
          suggestion: "Cut hedges; commit to the claim.",
          proposedRewrite: "clearly",
          citationClipIds: [11, 12],
        },
      ],
    });
    const caller = appRouter.createCaller(ctx());
    const out: any = await caller.draft.review({
      draft: "perhaps maybe sort of true.",
    });
    expect(out.suggestions[0].proposedRewrite).toBe("clearly");
    expect(out.suggestions[0].citationClipIds).toEqual([11, 12]);
  });
});

describe("clips.refreshAnnotations", () => {
  it("re-annotates each stale clip and stamps the active version id", async () => {
    (db.getActiveVersion as any).mockResolvedValueOnce({ id: 42 });
    (db.getClipsByIds as any).mockResolvedValueOnce([
      { id: 10, userId: 1, content: "a" },
      { id: 11, userId: 1, content: "b" },
    ]);
    const caller = appRouter.createCaller(ctx());
    const res = await caller.clips.refreshAnnotations();
    expect(res.refreshed).toBe(2);
    expect(res.failed).toEqual([]);
    expect(res.activeVersionId).toBe(42);
    expect(db.upsertAnnotation).toHaveBeenCalledTimes(2);
    const firstCall = (db.upsertAnnotation as any).mock.calls[0][0];
    expect(firstCall.styleGuideVersionId).toBe(42);
    expect(firstCall.userId).toBe(1);
  });

  it("is a no-op when no clips are stale", async () => {
    (db.getActiveVersion as any).mockResolvedValueOnce({ id: 42 });
    (db.listStaleAnnotationClipIds as any).mockResolvedValueOnce([]);
    (db.getClipsByIds as any).mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(ctx());
    const res = await caller.clips.refreshAnnotations();
    expect(res.refreshed).toBe(0);
    expect(res.failed).toEqual([]);
    expect(res.remaining).toBe(0);
    expect(db.upsertAnnotation).not.toHaveBeenCalled();
  });

  it("respects the limit argument when requesting stale ids", async () => {
    (db.getActiveVersion as any).mockResolvedValueOnce({ id: 1 });
    (db.listStaleAnnotationClipIds as any).mockResolvedValueOnce([]);
    (db.getClipsByIds as any).mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(ctx());
    await caller.clips.refreshAnnotations({ limit: 5 });
    expect(db.listStaleAnnotationClipIds).toHaveBeenCalledWith(1, 1, 5);
  });
});

describe("styleGuide.regenerate", () => {
  it("auto-bumps version, deactivates older versions, and writes a new active version", async () => {
    const caller = appRouter.createCaller(ctx());
    const result = await caller.styleGuide.regenerate();

    expect(db.nextVersionNumber).toHaveBeenCalledWith(1);
    expect(db.deactivateAllVersions).toHaveBeenCalledWith(1);

    expect(compileStyleGuide).toHaveBeenCalledTimes(1);
    expect(db.createVersion).toHaveBeenCalledTimes(1);
    const created = (db.createVersion as any).mock.calls[0][0];
    expect(created.userId).toBe(1);
    expect(created.versionNumber).toBe(3);
    expect(created.isActive).toBe(true);
    expect(created.artifacts.styleGuideMd).toBe("# guide");
    expect(result.versionNumber).toBe(3);
    expect(result.id).toBe(99);
  });
});
