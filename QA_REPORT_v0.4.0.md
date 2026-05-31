# StyleLab v0.4.0 — QA Report

**Build:** 2026-05-31 · single Node process on the Manus webdev runtime · TypeScript strict mode · 40/40 vitest passing.

## Scope

This release ships the three follow-ups that were proposed at the close of v0.3.0:

1. A per-user **bulk import audit log** so re-imports of the same file are visible.
2. **Streaming Draft Coach review** that paints scores → summary → suggestions incrementally instead of after a single 5–15 s wait.
3. **Hash-based annotation freshness** so re-publishing the same style guide doesn't queue up redundant LLM calls during the manual refresh sweep.

The shape of the app is unchanged. No existing pages were rewritten. No existing tRPC procedure broke its contract.

## What was added

### Schema

- **New column** `clip_annotations.contentHash text` — SHA-256 of `clip.content` joined with the sorted list of active rule ids.
- **New table** `import_audits(id, userId, format, filename, inserted, skipped, truncated, createdAt)` — one row per non-dry-run bulk import.
- Migration: `drizzle/0003_tranquil_valkyrie.sql`. Applied. No backfill required.

### Server

| File | Change |
|---|---|
| `server/_core/styleAI.ts` | New `computeAnnotationInputHash(content, ruleIds)` helper using `node:crypto` |
| `server/db.ts` | New helpers `bulkCreateClips` (already in v0.3.0) augmented with `createImportAudit`, `listImportAudits`; `listStaleAnnotationClipIds` rewritten to take `Map<clipId, expectedHash>`; `upsertAnnotation` accepts `contentHash` |
| `server/routers.ts` | New procedure `clips.listImports` (query); `clips.bulkImport` writes an `import_audits` row on real inserts; `clips.annotate` and `clips.refreshAnnotations` compute and persist `contentHash`; refresh sweep uses the hash map |
| `server/_core/draftStream.ts` | New SSE endpoint `POST /api/stream/draft-review`; auths via `sdk.authenticateRequest`; reuses `reviewDraft` and writes a single `draft_reviews` row at `done` |
| `server/_core/index.ts` | Registers the SSE route alongside trpc, oauth, storage |

### Client

| File | Change |
|---|---|
| `client/src/pages/Library.tsx` | New `Recent imports` strip rendered above the filter bar; invalidates on successful import |
| `client/src/pages/DraftCoach.tsx` | `onReview` now consumes the SSE endpoint and falls back to `trpc.draft.review` mutation on any stream error |

## Tests

`pnpm test` — **5 files / 40 tests / 40 passing.** Up from 37 in v0.3.0.

New tests in `server/routers.behavior.test.ts`:

| Behavior | Asserts |
|---|---|
| `clips.bulkImport` audit | A real import writes a `createImportAudit` row with `userId`, `format`, `filename`, `inserted`, `skipped`, `truncated` |
| `clips.bulkImport` dry-run | A dry-run does **not** write an audit row |
| `clips.listImports` | Forwards `(userId, limit)` to `db.listImportAudits` |
| `clips.refreshAnnotations` hash map | The refresh sweep passes a populated `Map<number, string>` to `listStaleAnnotationClipIds` and different clip text yields different hashes |

Existing test suites are unchanged and still passing: `server/wordDiff.test.ts` (5), `server/import.parser.test.ts` (10), `server/styleCompiler.test.ts` (8), `server/auth.logout.test.ts` (1), `server/routers.behavior.test.ts` (16).

`pnpm exec tsc` reports zero errors.

## Manual smoke test plan

1. **Imports audit** — Import any small CSV via Library → Import → Import 1 clip. The page should show a new entry under `Recent imports` with format `Generic CSV`, the filename, `1 in`, and a fresh timestamp. Reload the page; the strip persists.
2. **Streaming review** — Activate at least one rule. Open Draft Coach, paste a paragraph, click `Review draft`. The score bars should populate first (within ~1–2 s of the model returning), the summary next, then the suggestion cards. Network tab should show a single `POST /api/stream/draft-review` request with `Content-Type: text/event-stream`.
3. **Stream fallback** — Temporarily block the SSE endpoint in DevTools. Click `Review draft` again. The toast should still resolve to `Draft reviewed` and the result panel should populate (this exercises the trpc fallback).
4. **Refresh sweep idempotency** — On Style Guide click `Regenerate` twice in a row without changing rules or clips. After the first sweep, the second `Refresh annotations` should report `0 refreshed`, because every clip's `contentHash` matches the expected hash.

## Deliberate scope cuts

- **Streaming intentionally fans out one model call**, not multiple. The bottleneck for the user is the blank-screen wait, not next-token latency. Real token streaming would double LLM cost for a UX win the user can't perceive once scores arrive in 1 s.
- **Refresh sweep stays manual.** The hash work makes auto-refresh-on-regenerate technically safer (no spurious LLM calls), but auto-running 50 LLM calls without explicit consent is still the wrong default for an internal-cost tool. Re-evaluate in v0.5 if a user explicitly asks for it.
- **Audit log retention is unbounded.** It's effectively self-limiting (each import is one row) and the strip caps at 5. If it ever becomes noisy we can add a `deletedAt` and a "clear history" action.

## Risks and follow-ups

- The SSE endpoint authenticates with `sdk.authenticateRequest`, the same path tRPC uses, so behind the same Manus session cookie. No new auth surface.
- The audit row is written **after** `bulkCreateClips` returns. If the audit insert fails, the user still gets their clips and a success toast — they just won't see the strip update. This is the right ordering: the actual data write is the contract; the audit is observability.
- The hash helper is intentionally cheap and synchronous. If we ever store rule *content* (not just ids) the hash should incorporate that too, otherwise editing a rule's wording without changing its id will be invisible to the freshness check. Captured as a v0.5 candidate.
