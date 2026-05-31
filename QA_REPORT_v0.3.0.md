# StyleLab QA Report — v0.3.0

**Date:** 2026-05-31
**Build:** post-v0.2.0 follow-ups
**Scope:** Three feature additions (bulk import, inline rule-aware revision, manual annotation refresh) and the test/documentation updates that accompany them.

## 1. Goal

The v0.2.0 close-out note suggested three follow-up features. v0.3.0 implements all three without altering the v0.1.0 capture / library / analyse / compile / apply loop or the v0.2.0 ownership and accessibility hardening.

## 2. What changed

### 2.1 Library bulk import
- New shared parser at `shared/importParser.ts` covering generic CSV, Readwise CSV, and Twitter / X archive (`tweets.js` / `tweets.json`). Dependency-free.
- New `clips.bulkImport` tRPC procedure with a `dryRun` flag, a 1,000-row cap, and per-row skip reasons.
- New `bulkCreateClips` helper in `server/db.ts` performing a single batched insert. **Note:** this is a single insert call rather than an explicit transaction. A partial insert is non-corrupting (each row is independent and tagged `capturedFrom = "import"`), and the procedure already returns counts and skip reasons. We accept this trade-off; revisit if MySQL ever returns a partial-success error in practice.
- New Library `Import` button + dialog with file picker, paste fallback, format auto-detect, and dry-run preview before write.

### 2.2 Inline rule-aware revision in Draft Coach
- `DRAFT_SCHEMA` and the `reviewDraft` helper now require `proposedRewrite` per suggestion. The model is instructed to stay within ~20% of the excerpt's length and produce a drop-in rewrite.
- New `client/src/lib/wordDiff.ts` LCS util, used to render side-by-side word-level diffs (red strike-through removals, green-highlighted additions).
- Apply / Applied / Why interactions on each suggestion. Up to 20 applies stacked into an undo history surfaced as `Undo last apply` in the page header.

### 2.3 Manual annotation refresh tied to active style guide
- `clip_annotations` schema gains `styleGuideVersionId` and `updatedAt` columns (migration `drizzle/0002_boring_echo.sql` applied to the project DB).
- New `clips.refreshAnnotations` mutation walks clips whose annotation is missing or whose `styleGuideVersionId` differs from the currently active version, then re-annotates up to 50 in a single sweep.
- New `Refresh annotations` button on the Style Guide page header. Toast summarises refreshed / failed / remaining counts.
- **Deliberate scope cut:** the sweep is manual-only. We did *not* auto-trigger it on `styleGuide.regenerate` because a 50-clip LLM sweep firing silently after every regenerate would surprise the user with cost. Re-evaluate in v0.4 if a cheaper hash-only mode is added.

## 3. Tests

| File | Tests | Notes |
|---|---|---|
| `server/auth.logout.test.ts` | 1 | Unchanged from v0.2.0 |
| `server/styleCompiler.test.ts` | 8 | Unchanged from v0.2.0 |
| `server/routers.behavior.test.ts` | 13 | Was 10 — added 3 covering `clips.bulkImport`, `clips.refreshAnnotations` (3 paths: re-annotates, no-op when nothing stale, respects limit), and `draft.review` propagating `proposedRewrite` end-to-end |
| `server/import.parser.test.ts` | 10 | New — format detection, CSV quoting / embedded newlines, Readwise category mapping, Twitter retweet skipping, invalid JSON handling |
| `server/wordDiff.test.ts` | 5 | New — tokenisation preserves whitespace; equal / insert / remove / substitute alignment |
| **Total** | **37** | All passing |

`pnpm exec tsc --noEmit` reports zero TypeScript errors. Dev server is running cleanly.

## 4. What was *not* changed (verified)

- Reflection prompt wording is still exactly **"What made you save this?"** (covered by `styleCompiler.test.ts` and the unchanged Capture page).
- Export filenames remain exact: `STYLE_GUIDE.md`, `SKILL.md`, `style_profile.json`.
- Soft-delete is still the only delete path for clips. Bulk import only inserts; it never touches existing rows.
- v0.2.0 ownership invariants (collections.addClip / removeClip / clips.list({collectionId}) / deleteCollection) are preserved and still tested.

## 5. Known follow-ups (deferred, not blocking)

- An auto-sweep variant that *only* refreshes annotations whose hash of (clip text + active rule set) actually changed, so it can run silently without LLM cost when nothing meaningful changed.
- A streaming "review draft" experience so the writer sees scores and suggestions populate as the model emits them, instead of waiting for the full response.
- An audit log of bulk imports (file name, row count, time) per user, surfaced on the Library page.

## 6. Verdict

The three v0.2.0 close-out items are implemented, tested, documented, and shipped without regressing the v0.1.0 / v0.2.0 contracts. Safe to checkpoint as v0.3.0.
