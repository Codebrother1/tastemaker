/**
 * Server-Sent Events endpoint for streaming Draft Coach reviews.
 *
 * The streaming experience is incremental UX over the same review content
 * the non-streaming `trpc.draft.review` mutation produces. We do NOT call a
 * separate streaming model — we fan out the existing `reviewDraft` result in
 * three chunks (`scores`, `summary`, then `suggestions`) so the page paints
 * useful information within ~1s of the model returning, instead of waiting
 * for the full payload to flush. The frontend falls back to the non-stream
 * tRPC path on any failure.
 *
 * Persistence is performed at the end of the stream so a single review row
 * is written, matching the non-streaming path.
 */
import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";
import * as db from "../db";
import { reviewDraft } from "./styleAI";

type StreamChunk =
  | { type: "scores"; scores: unknown }
  | { type: "summary"; summary: string }
  | { type: "suggestions"; suggestions: unknown[] }
  | { type: "done"; reviewId: number }
  | { type: "error"; message: string };

function send(res: Response, payload: StreamChunk) {
  // SSE framing: `event:` + JSON `data:` + blank line.
  res.write(`event: ${payload.type}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function registerDraftStreamRoute(app: Express) {
  app.post("/api/stream/draft-review", async (req: Request, res: Response) => {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const draft = typeof req.body?.draft === "string" ? req.body.draft : "";
    if (!draft || draft.length < 1 || draft.length > 20_000) {
      res.status(400).json({ error: "Invalid draft length" });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    try {
      const rules = await db.listRules(user.id, { activeOnly: true });
      const citedIds = Array.from(
        new Set(rules.flatMap((r) => r.citationClipIds ?? []))
      );
      const cited = await db.getClipsByIds(user.id, citedIds);
      const result = await reviewDraft({ draft, rules, cited });

      // Stagger chunks so the UI can paint in order. The waits are tiny;
      // they exist to give the client time to render scores before the
      // suggestions list arrives, which feels much faster than a single
      // payload.
      send(res, { type: "scores", scores: result.scores });
      await new Promise((r) => setTimeout(r, 30));
      send(res, { type: "summary", summary: result.summary });
      await new Promise((r) => setTimeout(r, 30));
      send(res, { type: "suggestions", suggestions: result.suggestions });

      const active = await db.getActiveVersion(user.id);
      const reviewId = await db.createDraftReview({
        userId: user.id,
        styleGuideVersionId: active?.id ?? null,
        draftText: draft,
        scores: result.scores,
        suggestions: result.suggestions,
        summary: result.summary,
      });
      send(res, { type: "done", reviewId });
      res.end();
    } catch (e) {
      const message = (e as Error).message ?? "Stream failed";
      try {
        send(res, { type: "error", message });
        res.end();
      } catch {
        // socket already torn down; nothing useful to do.
      }
    }
  });
}
