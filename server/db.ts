import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  clipAnnotations,
  clipCollections,
  clipReflections,
  clips,
  collections,
  draftReviews,
  styleGuideVersions,
  styleRules,
  tastePatterns,
  users,
  type Clip,
  type ClipAnnotation,
  type ClipAnnotationData,
  type ClipReflection,
  type Collection,
  type DraftReview,
  type DraftScores,
  type DraftSuggestion,
  type InsertClip,
  type InsertClipAnnotation,
  type InsertClipReflection,
  type InsertCollection,
  type InsertDraftReview,
  type InsertStyleGuideVersion,
  type InsertStyleRule,
  type InsertTastePattern,
  type InsertUser,
  type StyleGuideArtifacts,
  type StyleGuideVersion,
  type StyleRule,
  type TastePattern,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

// ───────────────────────────── Users ─────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ───────────────────────────── Clips ─────────────────────────────

export type ClipFilter = {
  userId: number;
  includeDeleted?: boolean;
  search?: string;
  sourceType?: string;
  collectionId?: number;
  label?: string;
  limit?: number;
};

export async function listClips(filter: ClipFilter): Promise<Clip[]> {
  const db = await requireDb();
  const conditions = [eq(clips.userId, filter.userId)];
  if (!filter.includeDeleted) conditions.push(isNull(clips.deletedAt));
  if (filter.sourceType) conditions.push(eq(clips.sourceType, filter.sourceType as Clip["sourceType"]));
  if (filter.search) {
    const term = `%${filter.search}%`;
    conditions.push(
      sql`(${clips.content} LIKE ${term} OR ${clips.sourceTitle} LIKE ${term} OR ${clips.sourceAuthor} LIKE ${term})`
    );
  }

  let rows: Clip[];
  if (filter.collectionId) {
    rows = (await db
      .select({
        id: clips.id,
        userId: clips.userId,
        content: clips.content,
        sourceType: clips.sourceType,
        sourceTitle: clips.sourceTitle,
        sourceAuthor: clips.sourceAuthor,
        sourceUrl: clips.sourceUrl,
        sourceLocation: clips.sourceLocation,
        labels: clips.labels,
        capturedFrom: clips.capturedFrom,
        imageKey: clips.imageKey,
        deletedAt: clips.deletedAt,
        createdAt: clips.createdAt,
        updatedAt: clips.updatedAt,
      })
      .from(clips)
      .innerJoin(clipCollections, eq(clipCollections.clipId, clips.id))
      .where(and(...conditions, eq(clipCollections.collectionId, filter.collectionId)))
      .orderBy(desc(clips.createdAt))
      .limit(filter.limit ?? 200)) as Clip[];
  } else {
    rows = (await db
      .select()
      .from(clips)
      .where(and(...conditions))
      .orderBy(desc(clips.createdAt))
      .limit(filter.limit ?? 200)) as Clip[];
  }

  if (filter.label) {
    rows = rows.filter((c) => Array.isArray(c.labels) && c.labels.includes(filter.label!));
  }
  return rows;
}

export async function getClip(userId: number, clipId: number, includeDeleted = false) {
  const db = await requireDb();
  const conditions = [eq(clips.id, clipId), eq(clips.userId, userId)];
  if (!includeDeleted) conditions.push(isNull(clips.deletedAt));
  const result = await db.select().from(clips).where(and(...conditions)).limit(1);
  return result[0];
}

export async function getClipsByIds(userId: number, ids: number[]) {
  if (ids.length === 0) return [] as Clip[];
  const db = await requireDb();
  const placeholders = ids.map((id) => sql`${id}`);
  const rows = await db
    .select()
    .from(clips)
    .where(
      and(
        eq(clips.userId, userId),
        sql`${clips.id} IN (${sql.join(placeholders, sql`, `)})`
      )
    );
  return rows as Clip[];
}

export async function createClip(input: InsertClip): Promise<number> {
  const db = await requireDb();
  const result = await db.insert(clips).values(input);
  // mysql2 returns insertId on the first element
  // @ts-expect-error driver result typing
  return Number(result[0]?.insertId ?? result.insertId ?? 0);
}

export async function updateClip(userId: number, clipId: number, patch: Partial<InsertClip>) {
  const db = await requireDb();
  await db
    .update(clips)
    .set(patch)
    .where(and(eq(clips.id, clipId), eq(clips.userId, userId)));
}

export async function softDeleteClip(userId: number, clipId: number) {
  const db = await requireDb();
  await db
    .update(clips)
    .set({ deletedAt: new Date() })
    .where(and(eq(clips.id, clipId), eq(clips.userId, userId)));
}

export async function restoreClip(userId: number, clipId: number) {
  const db = await requireDb();
  await db
    .update(clips)
    .set({ deletedAt: null })
    .where(and(eq(clips.id, clipId), eq(clips.userId, userId)));
}

// ─────────────────────────── Reflections ───────────────────────────

export async function createReflection(input: InsertClipReflection): Promise<number> {
  const db = await requireDb();
  const result = await db.insert(clipReflections).values(input);
  // @ts-expect-error driver result typing
  return Number(result[0]?.insertId ?? result.insertId ?? 0);
}

export async function listReflectionsForClip(clipId: number): Promise<ClipReflection[]> {
  const db = await requireDb();
  return (await db
    .select()
    .from(clipReflections)
    .where(eq(clipReflections.clipId, clipId))
    .orderBy(desc(clipReflections.createdAt))) as ClipReflection[];
}

// ─────────────────────────── Annotations ───────────────────────────

export async function upsertAnnotation(input: InsertClipAnnotation) {
  const db = await requireDb();
  await db
    .insert(clipAnnotations)
    .values(input)
    .onDuplicateKeyUpdate({
      set: { data: input.data, model: input.model, createdAt: new Date() },
    });
}

export async function getAnnotation(clipId: number): Promise<ClipAnnotation | undefined> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(clipAnnotations)
    .where(eq(clipAnnotations.clipId, clipId))
    .limit(1);
  return rows[0] as ClipAnnotation | undefined;
}

// ───────────────────────────── Patterns ─────────────────────────────

export async function createPattern(input: InsertTastePattern): Promise<number> {
  const db = await requireDb();
  const result = await db.insert(tastePatterns).values(input);
  // @ts-expect-error driver result typing
  return Number(result[0]?.insertId ?? result.insertId ?? 0);
}

export async function listPatterns(userId: number): Promise<TastePattern[]> {
  const db = await requireDb();
  return (await db
    .select()
    .from(tastePatterns)
    .where(eq(tastePatterns.userId, userId))
    .orderBy(desc(tastePatterns.createdAt))) as TastePattern[];
}

export async function deletePattern(userId: number, id: number) {
  const db = await requireDb();
  await db
    .delete(tastePatterns)
    .where(and(eq(tastePatterns.id, id), eq(tastePatterns.userId, userId)));
}

// ───────────────────────────── Rules ─────────────────────────────

export async function createRule(input: InsertStyleRule): Promise<number> {
  const db = await requireDb();
  const result = await db.insert(styleRules).values(input);
  // @ts-expect-error driver result typing
  return Number(result[0]?.insertId ?? result.insertId ?? 0);
}

export async function listRules(userId: number, opts: { activeOnly?: boolean } = {}): Promise<StyleRule[]> {
  const db = await requireDb();
  const conditions = [eq(styleRules.userId, userId)];
  if (opts.activeOnly) conditions.push(eq(styleRules.isActive, true));
  return (await db
    .select()
    .from(styleRules)
    .where(and(...conditions))
    .orderBy(desc(styleRules.createdAt))) as StyleRule[];
}

export async function updateRule(userId: number, id: number, patch: Partial<InsertStyleRule>) {
  const db = await requireDb();
  await db
    .update(styleRules)
    .set(patch)
    .where(and(eq(styleRules.id, id), eq(styleRules.userId, userId)));
}

export async function deleteRule(userId: number, id: number) {
  const db = await requireDb();
  await db
    .delete(styleRules)
    .where(and(eq(styleRules.id, id), eq(styleRules.userId, userId)));
}

// ─────────────────────────── Style Guide Versions ───────────────────────────

export async function nextVersionNumber(userId: number): Promise<number> {
  const db = await requireDb();
  const rows = await db
    .select({ versionNumber: styleGuideVersions.versionNumber })
    .from(styleGuideVersions)
    .where(eq(styleGuideVersions.userId, userId))
    .orderBy(desc(styleGuideVersions.versionNumber))
    .limit(1);
  return (rows[0]?.versionNumber ?? 0) + 1;
}

export async function deactivateAllVersions(userId: number) {
  const db = await requireDb();
  await db
    .update(styleGuideVersions)
    .set({ isActive: false })
    .where(eq(styleGuideVersions.userId, userId));
}

export async function createVersion(input: InsertStyleGuideVersion): Promise<number> {
  const db = await requireDb();
  const result = await db.insert(styleGuideVersions).values(input);
  // @ts-expect-error driver result typing
  return Number(result[0]?.insertId ?? result.insertId ?? 0);
}

export async function listVersions(userId: number): Promise<StyleGuideVersion[]> {
  const db = await requireDb();
  return (await db
    .select()
    .from(styleGuideVersions)
    .where(eq(styleGuideVersions.userId, userId))
    .orderBy(desc(styleGuideVersions.versionNumber))) as StyleGuideVersion[];
}

export async function getVersion(userId: number, id: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(styleGuideVersions)
    .where(and(eq(styleGuideVersions.id, id), eq(styleGuideVersions.userId, userId)))
    .limit(1);
  return rows[0] as StyleGuideVersion | undefined;
}

export async function getActiveVersion(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(styleGuideVersions)
    .where(and(eq(styleGuideVersions.userId, userId), eq(styleGuideVersions.isActive, true)))
    .orderBy(desc(styleGuideVersions.versionNumber))
    .limit(1);
  return rows[0] as StyleGuideVersion | undefined;
}

export async function activateVersion(userId: number, id: number) {
  await deactivateAllVersions(userId);
  const db = await requireDb();
  await db
    .update(styleGuideVersions)
    .set({ isActive: true })
    .where(and(eq(styleGuideVersions.id, id), eq(styleGuideVersions.userId, userId)));
}

// ─────────────────────────── Draft Reviews ───────────────────────────

export async function createDraftReview(input: InsertDraftReview): Promise<number> {
  const db = await requireDb();
  const result = await db.insert(draftReviews).values(input);
  // @ts-expect-error driver result typing
  return Number(result[0]?.insertId ?? result.insertId ?? 0);
}

export async function listDraftReviews(userId: number): Promise<DraftReview[]> {
  const db = await requireDb();
  return (await db
    .select()
    .from(draftReviews)
    .where(eq(draftReviews.userId, userId))
    .orderBy(desc(draftReviews.createdAt))
    .limit(50)) as DraftReview[];
}

// ─────────────────────────── Collections ───────────────────────────

export async function createCollection(input: InsertCollection): Promise<number> {
  const db = await requireDb();
  const result = await db.insert(collections).values(input);
  // @ts-expect-error driver result typing
  return Number(result[0]?.insertId ?? result.insertId ?? 0);
}

export async function listCollections(userId: number): Promise<Collection[]> {
  const db = await requireDb();
  return (await db
    .select()
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(desc(collections.createdAt))) as Collection[];
}

export async function deleteCollection(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(clipCollections).where(eq(clipCollections.collectionId, id));
  await db
    .delete(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)));
}

export async function addClipToCollection(clipId: number, collectionId: number) {
  const db = await requireDb();
  try {
    await db.insert(clipCollections).values({ clipId, collectionId });
  } catch (e) {
    // ignore duplicate
  }
}

export async function removeClipFromCollection(clipId: number, collectionId: number) {
  const db = await requireDb();
  await db
    .delete(clipCollections)
    .where(and(eq(clipCollections.clipId, clipId), eq(clipCollections.collectionId, collectionId)));
}

export async function listClipCollections(clipId: number) {
  const db = await requireDb();
  return await db
    .select()
    .from(clipCollections)
    .where(eq(clipCollections.clipId, clipId));
}

export type {
  Clip,
  ClipAnnotation,
  ClipAnnotationData,
  ClipReflection,
  Collection,
  DraftReview,
  DraftScores,
  DraftSuggestion,
  StyleGuideArtifacts,
  StyleGuideVersion,
  StyleRule,
  TastePattern,
};
