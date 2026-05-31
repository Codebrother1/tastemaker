# Changelog

All notable changes to StyleLab are documented here. Newer versions appear first.

## v0.3.0 — Bulk import, inline rewrites, annotation refresh (2026-05-31)

The v0.3.0 release adds the three follow-up features from the v0.2.0 close-out note. Each one was scoped so that nothing about the existing capture / library / analyse loop changes; you simply have new ways to feed clips in, new ways to act on Draft Coach feedback, and a way to keep annotations in sync with your active style guide.

### Added — Library bulk import
- New `Import` button on the Library page header, beside `New clip`.
- A single dialog accepts three formats: generic CSV (`content` plus optional metadata columns), Readwise CSV exports, and Twitter / X archive files (`tweets.js` or `tweets.json`). Format is auto-detected from filename and content; the user can override.
- The flow is dry-run first: the parser previews the first eight rows, the format it locked onto, the count of skipped rows with reasons, and any rows beyond the 1,000-row import cap. Nothing is written until the user clicks `Import N clips`.
- Imported clips have `capturedFrom = "import"` so they are distinguishable from manual / OCR captures in the database.
- New shared parser at `shared/importParser.ts` is dependency-free and unit-tested.

### Added — Inline rule-aware revision in Draft Coach
- The draft review schema now requires a `proposedRewrite` per suggestion. The model is instructed to keep the rewrite within roughly 20% of the excerpt's length and to be a drop-in substitution.
- Each suggestion now renders a side-by-side word-level diff (red strike-through for removed words, green highlight for added words) using the new `client/src/lib/wordDiff.ts` LCS util.
- An `Apply rewrite` button splices the rewrite into the draft textarea at the matching excerpt. Applies are stacked into an undo history (up to 20 deep) surfaced as `Undo last apply` in the page header.
- A `Why` toggle reveals the cited rule's `Do / Avoid / When revising` text inline so the writer doesn't have to navigate away.
- An applied suggestion shows a green check and `Applied` state. If the excerpt has already been edited away from the original, the apply button is disabled with an explanation.

### Added — Annotation refresh tied to the active style guide
- New `clip_annotations.styleGuideVersionId` column tracks which guide produced each annotation. New `clip_annotations.updatedAt` for downstream tooling.
- New `clips.refreshAnnotations` mutation finds clips whose annotation is missing or was produced under a different style guide version (vs. the currently active one), then re-annotates up to 50 in a single sweep. The result reports `refreshed`, `failed`, and `remaining` counts.
- New `Refresh annotations` button on the Style Guide page header. The toast summarises the sweep and tells you whether to run it again.
- Existing one-off `clips.annotate` mutation now also stamps the active version id, so newly annotated clips never look stale immediately after creation.

### Schema migration
- `drizzle/0002_boring_echo.sql` adds the two new columns to `clip_annotations`. Applied to the project database. Existing rows have `styleGuideVersionId IS NULL`, which the sweep correctly treats as stale relative to any currently active version.

### Tested
- 34 Vitest tests across 5 files (was 16). New tests:
  - 10 import-parser tests covering format detection, CSV quoting / embedded newlines, Readwise category-to-source-type inference, and Twitter retweet skipping.
  - 5 word-diff tests covering tokenisation, equal / insert / remove / substitute alignment.
  - `clips.bulkImport` with real parsing, `dryRun` not writing, and per-row scoping to the caller.
  - `clips.refreshAnnotations` re-annotates each stale clip and stamps the active version id.
- `pnpm exec tsc --noEmit` reports zero errors.

### Unchanged hard constraints
- Reflection prompt wording remains exactly **“What made you save this?”**.
- Soft-delete is still the only delete path for clips. Bulk import only inserts; it never touches existing rows.

## v0.2.0 — QA Pass (2026-05-31)

A targeted quality pass over every page and procedure following the v0.1.0 build. No new features; the loop and visual identity are unchanged. The focus was contract correctness, ownership safety, mutation UX, and accessibility on icon-only controls.

### Fixed — Frontend
- **Style Guide artifact contract**: the page rendered fields named `styleGuideMarkdown` etc., but the server emits `styleGuideMd`, `skillMd`, `styleProfileJson`, `claudeInstructions`, `chatgptInstructions`. The viewer now uses the real schema keys, so all five export tabs render content and the JSON profile is no longer double-stringified.
- **Draft Coach suggestion fields**: the page expected `rule`, `quote`, `revision`, but the server returns `ruleTitle`, `excerpt`, `suggestion`, `citationClipIds`. Renames applied so badges, citations, and the suggestion text all populate.
- **Library edit dialog**: state syncing on `editing` change had been written inside `useMemo`, which is a side-effect anti-pattern. Replaced with `useEffect` to avoid render-phase setState and missed updates when re-opening the dialog on a different clip.
- **Mutation UX**: per-item pending spinners and error toasts were added to Collections delete, Analyze pattern remove / rule delete / rule activate-toggle, and Style Guide “Set active”. Buttons now correctly disable while their own row is in flight, instead of disabling globally.
- **Accessibility on icon-only buttons**: added `aria-label` and `type="button"` to the Collections delete trash icon and the Library remove-from-collection “×” badge button.

### Fixed — Backend
- **Cross-user collection mutations** were possible because `addClipToCollection` and `removeClipFromCollection` accepted any `(clipId, collectionId)` pair without verifying both belonged to the caller. The router now verifies ownership of *both* via the new `db.getCollection(userId, id)` helper before any mutation.
- **`clips.list({ collectionId })`** now verifies that the requested collection is owned by the caller before joining.
- **`db.deleteCollection(userId, id)`** previously deleted `clip_collections` rows by `collectionId` *before* the userId-scoped delete on `collections`. Reordered: ownership is checked first, and the function silently no-ops when the caller does not own the collection.

### Tested
- 16 Vitest tests across 3 files (was 12). New tests:
  - `collections.delete` is scoped by userId at the router boundary.
  - `collections.addClip` rejects when the collection is not owned by the caller.
  - `collections.addClip` rejects when the clip is not owned by the caller.
  - `collections.addClip` succeeds when both are owned, and links via `db.addClipToCollection`.
- `pnpm exec tsc --noEmit` reports zero errors. Dev server is healthy.

### Unchanged hard constraints
- Reflection prompt wording remains exactly **“What made you save this?”**.
- Export filenames remain exactly `STYLE_GUIDE.md`, `SKILL.md`, `style_profile.json` (plus `claude_instructions.md`, `chatgpt_instructions.md`).
- Clip deletion is soft and recoverable.
- Style guide versioning is auto-bumped on every regeneration.

## v0.1.0 — Initial Build (2026-05-31)

First end-to-end release of StyleLab as a private writing-style studio. Implements the full **Capture → Reflect → Analyze → Compile → Apply** loop with versioned artifacts and draft coaching.

### Added
- **Capture page** (`/capture`) with paste, source metadata, labels, and screenshot OCR via vision LLM.
- **Reflection step** with the exact prompt **"What made you save this?"** captured immediately after each clip is saved.
- **Library page** (`/library`) with full-text search, source-type / label / collection filters, soft-delete + restore, an editable detail panel, and inline labels/collections management.
- **Collections page** (`/collections`) with create/delete and per-collection clip lists, kinded by project/author/theme/purpose.
- **Analyze page** (`/analyze`) for selecting clips, synthesizing recurring patterns with evidence-by-clip-ID, and converting patterns into evidence-backed style rules (do / avoid / revise).
- **Style Guide page** (`/style-guide`) compiling `STYLE_GUIDE.md`, `SKILL.md`, `style_profile.json`, Claude instructions, and ChatGPT instructions. Auto-versioning on every regeneration; previous versions are retained and can be activated.
- **Draft Coach page** (`/draft-coach`) scoring a pasted draft on six dimensions (concreteness, implication, rhythm, tone, compression, originality) with rule-linked suggestions and review history.
- **AI integrations** wired through `invokeLLM` with structured JSON schemas for clip annotation, pattern synthesis, rule generation, and draft review; OCR via vision input.
- **Style compiler** (`server/_core/styleCompiler.ts`) producing all five artifacts deterministically from active rules.
- **Database schema** for clips, reflections, annotations, taste patterns, style rules, style guide versions, draft reviews, collections, and clip-collections, applied via Drizzle migrations.
- **Elegant editorial theme**: warm ivory + ink palette, bronze accent, Newsreader (serif), Inter (UI), JetBrains Mono (mono).
- **Instruction Manual** (`INSTRUCTION_MANUAL.md`) covering usage, architecture, upgrades, signal hygiene, and troubleshooting.

### Tested
- 12 Vitest tests across 3 files:
  - `server/styleCompiler.test.ts` — exact filenames, frontmatter, JSON shape, evidence selection, empty-state safety.
  - `server/routers.behavior.test.ts` — soft-delete (recoverable), restore, version auto-bump, deactivation of older versions.
  - `server/auth.logout.test.ts` — session cookie clearing.

### Hard Constraints (verified by tests)
- Reflection prompt wording is exactly **"What made you save this?"**
- Export filenames are exactly `STYLE_GUIDE.md`, `SKILL.md`, `style_profile.json`.
- Clip deletion is soft, never hard.
- Style guide versioning auto-bumps on every regeneration.

### Known Follow-ups
- Bulk import (CSV / Readwise / Twitter export) not yet supported.
- Annotation back-fill for clips captured before AI annotation was wired runs lazily on first view.
- No browser extension yet for one-click capture from the web.
