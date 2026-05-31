import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import {
  ANNOTATION_REFRESH_BATCH,
  COLLECTION_KINDS,
  IMPORT_FORMATS,
  IMPORT_MAX_ROWS,
  SOURCE_TYPES,
} from "@shared/stylelab";
import { detectFormat, parseImport } from "@shared/importParser";
import { z } from "zod";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import {
  annotateClip,
  extractTextFromImage,
  generateRulesFromPattern,
  reviewDraft,
  synthesizePatterns,
} from "./_core/styleAI";
import { compileStyleGuide } from "./_core/styleCompiler";
import { storagePut } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const clipInput = z.object({
  content: z.string().min(1).max(20000),
  sourceType: z.enum(SOURCE_TYPES).default("paragraph"),
  sourceTitle: z.string().max(500).optional().nullable(),
  sourceAuthor: z.string().max(255).optional().nullable(),
  sourceUrl: z.string().max(1000).optional().nullable(),
  sourceLocation: z.string().max(255).optional().nullable(),
  labels: z.array(z.string()).optional(),
  capturedFrom: z.enum(["manual", "ocr", "import"]).default("manual"),
  imageKey: z.string().optional().nullable(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  clips: router({
    list: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            sourceType: z.enum(SOURCE_TYPES).optional(),
            collectionId: z.number().int().optional(),
            label: z.string().optional(),
            includeDeleted: z.boolean().optional(),
            limit: z.number().int().min(1).max(500).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        if (input?.collectionId != null) {
          const owned = await db.getCollection(ctx.user.id, input.collectionId);
          if (!owned) throw new TRPCError({ code: "NOT_FOUND" });
        }
        return db.listClips({
          userId: ctx.user.id,
          search: input?.search,
          sourceType: input?.sourceType,
          collectionId: input?.collectionId,
          label: input?.label,
          includeDeleted: input?.includeDeleted,
          limit: input?.limit,
        });
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const clip = await db.getClip(ctx.user.id, input.id, true);
        if (!clip) throw new TRPCError({ code: "NOT_FOUND" });
        const reflections = await db.listReflectionsForClip(input.id);
        const annotation = await db.getAnnotation(input.id);
        const collections = await db.listClipCollections(input.id);
        return { clip, reflections, annotation, collections };
      }),

    create: protectedProcedure
      .input(clipInput)
      .mutation(async ({ ctx, input }) => {
        const id = await db.createClip({ ...input, userId: ctx.user.id });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number().int(), patch: clipInput.partial() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateClip(ctx.user.id, input.id, input.patch);
        return { ok: true } as const;
      }),

    softDelete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await db.softDeleteClip(ctx.user.id, input.id);
        return { ok: true } as const;
      }),

    restore: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await db.restoreClip(ctx.user.id, input.id);
        return { ok: true } as const;
      }),

    addReflection: protectedProcedure
      .input(z.object({ clipId: z.number().int(), content: z.string().min(1).max(8000) }))
      .mutation(async ({ ctx, input }) => {
        const clip = await db.getClip(ctx.user.id, input.clipId, true);
        if (!clip) throw new TRPCError({ code: "NOT_FOUND" });
        const id = await db.createReflection({
          clipId: input.clipId,
          userId: ctx.user.id,
          content: input.content,
        });
        return { id };
      }),

    annotate: protectedProcedure
      .input(z.object({ clipId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const clip = await db.getClip(ctx.user.id, input.clipId);
        if (!clip) throw new TRPCError({ code: "NOT_FOUND" });
        const reflections = await db.listReflectionsForClip(input.clipId);
        const data = await annotateClip({
          content: clip.content,
          sourceTitle: clip.sourceTitle,
          sourceAuthor: clip.sourceAuthor,
          reflection: reflections[0]?.content ?? null,
        });
        const active = await db.getActiveVersion(ctx.user.id);
        await db.upsertAnnotation({
          clipId: input.clipId,
          userId: ctx.user.id,
          data,
          model: "stylelab-default",
          styleGuideVersionId: active?.id ?? null,
        });
        return data;
      }),

    bulkImport: protectedProcedure
      .input(
        z.object({
          format: z.enum(IMPORT_FORMATS).optional(),
          text: z.string().min(1).max(10_000_000),
          filename: z.string().optional(),
          dryRun: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const detected = input.format ?? detectFormat(input.text, input.filename);
        if (!detected) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Could not detect import format. Choose CSV, Readwise, or Twitter explicitly.",
          });
        }
        const parsed = parseImport(input.text, detected);
        const skippedTooMany =
          parsed.clips.length > IMPORT_MAX_ROWS
            ? parsed.clips.length - IMPORT_MAX_ROWS
            : 0;
        const usable = parsed.clips.slice(0, IMPORT_MAX_ROWS);
        if (input.dryRun) {
          return {
            format: detected,
            previewCount: usable.length,
            skipped: parsed.skipped,
            truncated: skippedTooMany,
            preview: usable.slice(0, 8),
          } as const;
        }
        const inserted = await db.bulkCreateClips(
          ctx.user.id,
          usable.map((c) => ({
            content: c.content,
            sourceType: c.sourceType,
            sourceTitle: c.sourceTitle ?? null,
            sourceAuthor: c.sourceAuthor ?? null,
            sourceUrl: c.sourceUrl ?? null,
            sourceLocation: c.sourceLocation ?? null,
            labels: c.labels ?? [],
            capturedFrom: "import",
          }))
        );
        return {
          format: detected,
          inserted,
          skipped: parsed.skipped,
          truncated: skippedTooMany,
        } as const;
      }),

    refreshAnnotations: protectedProcedure
      .input(
        z
          .object({
            limit: z
              .number()
              .int()
              .min(1)
              .max(ANNOTATION_REFRESH_BATCH)
              .optional(),
          })
          .optional()
      )
      .mutation(async ({ ctx, input }) => {
        const active = await db.getActiveVersion(ctx.user.id);
        const limit = input?.limit ?? ANNOTATION_REFRESH_BATCH;
        const targetIds = await db.listStaleAnnotationClipIds(
          ctx.user.id,
          active?.id ?? null,
          limit
        );
        const clips = await db.getClipsByIds(ctx.user.id, targetIds);
        let refreshed = 0;
        const failed: Array<{ clipId: number; reason: string }> = [];
        for (const clip of clips) {
          try {
            const reflections = await db.listReflectionsForClip(clip.id);
            const data = await annotateClip({
              content: clip.content,
              sourceTitle: clip.sourceTitle,
              sourceAuthor: clip.sourceAuthor,
              reflection: reflections[0]?.content ?? null,
            });
            await db.upsertAnnotation({
              clipId: clip.id,
              userId: ctx.user.id,
              data,
              model: "stylelab-default",
              styleGuideVersionId: active?.id ?? null,
            });
            refreshed += 1;
          } catch (e) {
            failed.push({
              clipId: clip.id,
              reason: (e as Error).message ?? "annotation failed",
            });
          }
        }
        return {
          refreshed,
          failed,
          remaining: Math.max(0, targetIds.length - refreshed - failed.length),
          activeVersionId: active?.id ?? null,
        } as const;
      }),

    ocrFromImage: protectedProcedure
      .input(
        z.object({
          imageBase64: z.string().min(64),
          mimeType: z.string().default("image/png"),
          filename: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const buf = Buffer.from(input.imageBase64, "base64");
        const ext = input.mimeType.includes("jpeg") ? "jpg" : "png";
        const safeName = (input.filename ?? `clip-${Date.now()}`).replace(/[^a-zA-Z0-9_.-]/g, "_");
        const key = `${ctx.user.id}-clips/${Date.now()}-${safeName}.${ext}`;
        const { key: storedKey, url } = await storagePut(key, buf, input.mimeType);
        // url is a relative /manus-storage path; build absolute for vision
        const absolute = url.startsWith("http")
          ? url
          : `${process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`}${url}`;
        const text = await extractTextFromImage(absolute);
        return { text, imageKey: storedKey, imageUrl: url };
      }),
  }),

  analyze: router({
    listPatterns: protectedProcedure.query(({ ctx }) => db.listPatterns(ctx.user.id)),

    deletePattern: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await db.deletePattern(ctx.user.id, input.id);
        return { ok: true } as const;
      }),

    synthesize: protectedProcedure
      .input(z.object({ clipIds: z.array(z.number().int()).min(2).max(40) }))
      .mutation(async ({ ctx, input }) => {
        const clips = await db.getClipsByIds(ctx.user.id, input.clipIds);
        const reflectionsByClip = new Map<number, string>();
        for (const c of clips) {
          const refs = await db.listReflectionsForClip(c.id);
          if (refs[0]) reflectionsByClip.set(c.id, refs[0].content);
        }
        const synthesized = await synthesizePatterns({
          clips: clips.map((c) => ({
            id: c.id,
            content: c.content,
            reflection: reflectionsByClip.get(c.id) ?? null,
          })),
        });
        const created: Array<{ id: number; title: string }> = [];
        for (const p of synthesized) {
          const id = await db.createPattern({
            userId: ctx.user.id,
            title: p.title,
            description: p.description,
            evidenceClipIds: p.evidenceClipIds,
          });
          created.push({ id, title: p.title });
        }
        return { patterns: created };
      }),

    generateRules: protectedProcedure
      .input(z.object({ patternId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const patterns = await db.listPatterns(ctx.user.id);
        const pattern = patterns.find((p) => p.id === input.patternId);
        if (!pattern) throw new TRPCError({ code: "NOT_FOUND" });
        const evidenceClips = await db.getClipsByIds(
          ctx.user.id,
          pattern.evidenceClipIds ?? []
        );
        const generated = await generateRulesFromPattern({
          pattern: {
            title: pattern.title,
            description: pattern.description,
            evidenceClipIds: pattern.evidenceClipIds ?? [],
          },
          clips: evidenceClips.map((c) => ({ id: c.id, content: c.content })),
        });
        const created: number[] = [];
        for (const r of generated) {
          const id = await db.createRule({
            userId: ctx.user.id,
            patternId: pattern.id,
            title: r.title,
            positiveInstruction: r.positiveInstruction,
            avoidanceGuidance: r.avoidanceGuidance,
            revisionGuidance: r.revisionGuidance,
            citationClipIds: r.citationClipIds,
          });
          created.push(id);
        }
        return { ruleIds: created };
      }),
  }),

  rules: router({
    list: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(({ ctx, input }) => db.listRules(ctx.user.id, { activeOnly: input?.activeOnly })),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          patch: z
            .object({
              title: z.string().min(1).max(255),
              positiveInstruction: z.string().min(1),
              avoidanceGuidance: z.string().min(1),
              revisionGuidance: z.string().min(1),
              isActive: z.boolean(),
            })
            .partial(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateRule(ctx.user.id, input.id, input.patch);
        return { ok: true } as const;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteRule(ctx.user.id, input.id);
        return { ok: true } as const;
      }),
  }),

  styleGuide: router({
    listVersions: protectedProcedure.query(({ ctx }) => db.listVersions(ctx.user.id)),

    getActive: protectedProcedure.query(({ ctx }) => db.getActiveVersion(ctx.user.id)),

    getVersion: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const v = await db.getVersion(ctx.user.id, input.id);
        if (!v) throw new TRPCError({ code: "NOT_FOUND" });
        return v;
      }),

    activate: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await db.activateVersion(ctx.user.id, input.id);
        return { ok: true } as const;
      }),

    regenerate: protectedProcedure.mutation(async ({ ctx }) => {
      const rules = await db.listRules(ctx.user.id, { activeOnly: true });
      const patterns = await db.listPatterns(ctx.user.id);
      const citedIds = Array.from(
        new Set(
          rules.flatMap((r) => r.citationClipIds ?? []).concat(
            patterns.flatMap((p) => p.evidenceClipIds ?? [])
          )
        )
      );
      const clips = await db.getClipsByIds(ctx.user.id, citedIds);
      const ownerName = ctx.user.name?.trim() || process.env.OWNER_NAME || "User";
      const artifacts = compileStyleGuide({ ownerName, rules, patterns, citedClips: clips });
      const versionNumber = await db.nextVersionNumber(ctx.user.id);
      await db.deactivateAllVersions(ctx.user.id);
      const id = await db.createVersion({
        userId: ctx.user.id,
        versionNumber,
        ruleCount: rules.length,
        summary: `${rules.length} active rule${rules.length === 1 ? "" : "s"} across ${patterns.length} pattern${patterns.length === 1 ? "" : "s"}.`,
        artifacts,
        isActive: true,
      });
      return { id, versionNumber, ruleCount: rules.length, artifacts };
    }),
  }),

  draft: router({
    list: protectedProcedure.query(({ ctx }) => db.listDraftReviews(ctx.user.id)),

    review: protectedProcedure
      .input(z.object({ draft: z.string().min(1).max(20000) }))
      .mutation(async ({ ctx, input }) => {
        const rules = await db.listRules(ctx.user.id, { activeOnly: true });
        const citedIds = Array.from(new Set(rules.flatMap((r) => r.citationClipIds ?? [])));
        const cited = await db.getClipsByIds(ctx.user.id, citedIds);
        const result = await reviewDraft({ draft: input.draft, rules, cited });
        const active = await db.getActiveVersion(ctx.user.id);
        const id = await db.createDraftReview({
          userId: ctx.user.id,
          styleGuideVersionId: active?.id ?? null,
          draftText: input.draft,
          scores: result.scores,
          suggestions: result.suggestions,
          summary: result.summary,
        });
        return { id, ...result };
      }),
  }),

  collections: router({
    list: protectedProcedure.query(({ ctx }) => db.listCollections(ctx.user.id)),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          kind: z.enum(COLLECTION_KINDS).default("other"),
          description: z.string().max(2000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const id = await db.createCollection({
          userId: ctx.user.id,
          name: input.name,
          kind: input.kind,
          description: input.description ?? null,
        });
        return { id };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteCollection(ctx.user.id, input.id);
        return { ok: true } as const;
      }),

    addClip: protectedProcedure
      .input(z.object({ clipId: z.number().int(), collectionId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        // Verify ownership of both clip and collection.
        const [clip, coll] = await Promise.all([
          db.getClip(ctx.user.id, input.clipId, true),
          db.getCollection(ctx.user.id, input.collectionId),
        ]);
        if (!clip || !coll) throw new TRPCError({ code: "NOT_FOUND" });
        await db.addClipToCollection(input.clipId, input.collectionId);
        return { ok: true } as const;
      }),

    removeClip: protectedProcedure
      .input(z.object({ clipId: z.number().int(), collectionId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const [clip, coll] = await Promise.all([
          db.getClip(ctx.user.id, input.clipId, true),
          db.getCollection(ctx.user.id, input.collectionId),
        ]);
        if (!clip || !coll) throw new TRPCError({ code: "NOT_FOUND" });
        await db.removeClipFromCollection(input.clipId, input.collectionId);
        return { ok: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
