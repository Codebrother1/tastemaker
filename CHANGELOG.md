# Changelog

All notable changes to StyleLab are documented here. Newer versions appear first.

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
