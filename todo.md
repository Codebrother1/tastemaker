# StyleLab — Project TODO

A private internal tool for capturing admired writing, analyzing style patterns, and compiling a personal style guide.

## Core Features

- [x] Database schema: clips, reflections, annotations, patterns, style_rules, style_guide_versions, draft_reviews, collections, clip_collections
- [x] Schema migrations applied via webdev_execute_sql
- [x] Query helpers in server/db.ts for all entities
- [x] tRPC routers split by feature area (clips, annotations, analyze, styleGuide, draft, collections)
- [x] Dashboard layout with 5 primary sections: Capture, Library, Analyze, Style Guide, Draft Coach

### 1. Clip Capture Inbox
- [x] Paste form supporting sentence/tweet/paragraph/book/article excerpts
- [x] Source metadata fields: title, author, URL, source type, page/location
- [x] Save creates a clip row owned by the user

### 2. Reflection Capture
- [x] After saving a clip, app prompts with EXACT text: "What made you save this?"
- [x] Reflection stored in clip_reflections linked to clip_id

### 3. Image / OCR Clip Capture
- [x] Upload image (screenshot / book photo) via storage helper
- [x] Vision LLM extracts text from the image
- [x] Extracted text pre-fills the clip form for confirmation/save

### 4. Clip Library
- [x] List view with search (full-text on content, source title/author)
- [x] Filter by label, source type, collection, soft-deleted state
- [x] Edit clip metadata and content
- [x] Soft delete (deletedAt), restore, and exclude from default views
- [x] Clip detail page with reflection, annotation, source, labels, collections

### 5. AI-Powered Clip Annotation
- [x] AI annotation using built-in LLM (manual trigger from detail)
- [x] Structured JSON per clip: tone, syntax, imagery, rhythm, rhetoricalMoves, dominantEffect
- [x] Re-run annotation manually from clip detail

### 6. Taste Pattern Analysis
- [x] Select multiple clips from Library
- [x] AI synthesizes recurring patterns with evidence (clipIds)
- [x] Patterns stored linked to user; clip evidence references kept

### 7. Evidence-Backed Style Rule Generation
- [x] Convert selected patterns into actionable style rules
- [x] Each rule has: positiveInstruction, avoidanceGuidance, revisionGuidance, citations[clipId]
- [x] Rules can be activated/deactivated and deleted

### 8. Export Compiler
- [x] Generate STYLE_GUIDE.md (exact filename)
- [x] Generate SKILL.md (exact filename)
- [x] Generate style_profile.json (exact filename)
- [x] Generate Claude assistant instructions
- [x] Generate ChatGPT assistant instructions
- [x] Download buttons in UI for each artifact

### 9. Style Guide Version History
- [x] Each compile auto-saves a new style_guide_versions row (no manual save)
- [x] List versions with timestamp, rule count, summary
- [x] View and activate any previous version

### 10. Draft Coach
- [x] Paste a draft, run scoring against active style guide
- [x] Dimensions: concreteness, implication, rhythm, tone, compression, originality (0–100)
- [x] Rule-linked revision suggestions returned with citations
- [x] Save reviews to history

### 11. Labels & Collections
- [x] Free-form labels on clips (string array)
- [x] Named collections (project / author / theme / purpose)
- [x] Many-to-many link between clips and collections

### 12. Dashboard Layout
- [x] DashboardLayout sidebar with: Capture, Library, Analyze, Style Guide, Draft Coach
- [x] Polished, elegant theming (typography, spacing, motion)

## Constraints
- [x] Reflection prompt wording exactly: "What made you save this?"
- [x] Export filenames exactly: STYLE_GUIDE.md, SKILL.md, style_profile.json
- [x] Style guide versioning automatic on every regeneration
- [x] Clip deletion is soft-delete (recoverable), not permanent

## Quality
- [x] Vitest tests for compiler, exact prompt/filenames, soft delete behavior
- [x] No TypeScript errors
- [x] Run all tests (12 passing)
- [x] Instruction manual and changelog written (INSTRUCTION_MANUAL.md, CHANGELOG.md)

## v0.2.0 — QA Audit

- [x] Audit server: routers.ts (all procedures, error handling, ownership checks)
- [x] Audit server: db.ts query helpers (consistency, null handling)
- [x] Audit server: styleAI.ts (JSON schemas, error fallbacks)
- [x] Audit server: styleCompiler.ts (artifact correctness)
- [x] Audit shared/stylelab.ts and drizzle/schema.ts
- [x] Audit Home.tsx (signed-out + signed-in states)
- [x] Audit DashboardLayout.tsx (navigation, active states, signed-out fallback)
- [x] Audit Capture.tsx (form validation, OCR, reflection step, loading/error states)
- [x] Audit Library.tsx (search/filter, edit, soft-delete, restore, detail sheet)
- [x] Audit Collections.tsx (create, delete, empty states)
- [x] Audit Analyze.tsx (clip selection, pattern run, rule generation)
- [x] Audit StyleGuide.tsx (regenerate, version switch, copy/download)
- [x] Audit DraftCoach.tsx (review run, history, suggestions)
- [x] Verify every button has loading + disabled state and toast feedback
- [x] Verify every link/route exists and is reachable
- [x] Verify accessibility: labels, focus rings, keyboard nav
- [x] Run pnpm tsc --noEmit and pnpm test; fix anything broken
- [x] Write QA report and changelog v0.2.0

### v0.2.0 — Bugs found and fixed
- [x] StyleGuide.tsx: corrected artifact key contract to match server schema (styleGuideMd, skillMd, styleProfileJson, claudeInstructions, chatgptInstructions)
- [x] DraftCoach.tsx: aligned suggestion field names to server schema (ruleTitle, excerpt, suggestion, citationClipIds)
- [x] Library.tsx EditClipDialog: replaced setState-in-useMemo with useEffect (proper side-effect pattern)
- [x] Server: collections.addClip/removeClip now verify both clip and collection ownership
- [x] Server: clips.list with collectionId verifies collection ownership before query
- [x] Tests: added 3 vitest tests covering collection ownership enforcement (15/15 passing)
