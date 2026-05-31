# Changelog

All notable changes to StyleLab are documented here. Newer versions appear first.

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
