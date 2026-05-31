# StyleLab — Instruction Manual

> A private studio for capturing the writing you admire and turning your taste into a living style guide.

This manual covers how to use StyleLab day to day, what every feature does, how to maintain it, and how to upgrade or extend it without breaking the data model or the artifacts you generate.

---

## 1. What StyleLab Is

StyleLab is an internal, single-user web application that turns admired writing into a personal style system. It implements a five-step loop: **Capture → Reflect → Analyze → Compile → Apply**. The end goal is not just analysis — it is producing portable artifacts (`STYLE_GUIDE.md`, `SKILL.md`, `style_profile.json`, Claude/ChatGPT instructions) that you can paste into any assistant or use as a rubric for editing your own drafts.

The application is structured around six pages: **Capture, Library, Collections, Analyze, Style Guide, and Draft Coach**, each accessible from the left sidebar.

## 2. The Five-Step Loop

| Step | Page | What you do | What StyleLab does |
|---|---|---|---|
| 1. Capture | `/capture` | Paste a sentence, paragraph, tweet, book excerpt, or upload a screenshot. | Saves it as a clip with source metadata; runs OCR on screenshots. |
| 2. Reflect | `/capture` (after save) | Answer **"What made you save this?"** | Stores your answer as a taste signal alongside the clip. |
| 3. Analyze | `/analyze` | Select clips and run pattern synthesis. | Detects 3–7 recurring style patterns with evidence cited by clip ID, then converts patterns into actionable rules. |
| 4. Compile | `/style-guide` | Click *Regenerate*. | Produces a versioned `STYLE_GUIDE.md`, `SKILL.md`, `style_profile.json`, and Claude/ChatGPT instructions. Older versions are automatically retained. |
| 5. Apply | `/draft-coach` | Paste a draft of your own writing. | Scores the draft on six dimensions (concreteness, implication, rhythm, tone, compression, originality) and returns rule-linked revision suggestions. |

## 3. Page-by-Page Usage

### 3.1 Capture (`/capture`)
- Paste any text into the **clip body**, then add source type (`sentence`, `tweet`, `paragraph`, `book`, `article`, `other`), title, author, URL, and labels.
- Use the **screenshot uploader** to extract text from a photo or screenshot via vision OCR. Review the extracted text before saving.
- After saving, you are prompted with the exact wording **"What made you save this?"** — your answer becomes the reflection attached to that clip.

### 3.2 Library (`/library`)
- Browse every captured clip with full-text search (across content, title, author).
- Filter by **source type**, **label**, or **collection**.
- Open a clip's detail panel to view its reflection, AI annotation (tone, syntax, imagery, rhythm, rhetorical moves, dominant effect), associated collections, and edit metadata.
- **Soft delete** a clip from the detail panel; it is recoverable from the *Trashed* filter via *Restore*. Clips are never hard-deleted.
- **Bulk import** (added v0.3.0). Click **Import** in the page header to bring in highlights from outside StyleLab. Three formats are supported and auto-detected:
  - **CSV** — a `content` column is required; optional columns: `source_title`, `source_author`, `source_url`, `source_location`, `source_type`, `labels` (semicolon-separated).
  - **Readwise CSV** — the standard Readwise export. The `Category` column is mapped onto StyleLab source types (`book`, `article`, `tweet`, `other`).
  - **Twitter / X archive** — the `tweets.js` or `tweets.json` file from your X data download. Retweets are skipped automatically and the source URL is reconstructed.
  Imports are dry-run first: a preview shows the format StyleLab locked onto, the number of clips that will be inserted, the first eight rows, and any rows skipped (with reasons). Nothing is written until you click **Import N clips**. Import cap is **1,000 rows per run** — split larger files. Imported clips are tagged with `capturedFrom = "import"` so you can filter them later if you want.
- **Recent imports strip** (added v0.4.0). Above the search bar Library shows the last five non-dry-run imports for your account: format, filename, inserted/skipped/truncated counts, timestamp. Re-importing the same file is no longer silent — you'll see it in the list.

### 3.3 Collections (`/collections`)
- Create a collection labeled by **kind** (`project`, `author`, `theme`, `purpose`, `other`).
- Add clips to a collection from the Library detail panel; remove them from either side.

### 3.4 Analyze (`/analyze`)
- Select two or more clips (up to 40), then click **Synthesize patterns**. StyleLab returns recurring style patterns, each tied to specific clip IDs as evidence.
- For each pattern, click **Generate rules** to produce 1–3 actionable rules (positive instruction, avoidance guidance, revision guidance, evidence citations).
- Patterns and rules can be deleted; rules can be toggled active/inactive.

### 3.5 Style Guide (`/style-guide`)
- Click **Regenerate** to compile a new version from your active rules.
- A new version is saved automatically every time you regenerate. The newest is marked active; the previous active is preserved.
- Switch between versions to view their `STYLE_GUIDE.md`, `SKILL.md`, `style_profile.json`, and assistant instructions.
- Click **Activate** on any older version to make it the active one (used by the Draft Coach).
- Each artifact has *Copy* and *Download* buttons. Filenames are exact: `STYLE_GUIDE.md`, `SKILL.md`, `style_profile.json`.
- **Refresh annotations** (added v0.3.0, smarter in v0.4.0). When you activate a different style guide version, existing clip annotations were produced under a different guide and are *potentially* stale. Click **Refresh annotations** to re-annotate up to 50 stale or missing clips in one sweep. The toast tells you how many were refreshed, how many failed, and whether more are still pending — if so, just click again. The sweep is **manual on purpose**: it costs LLM calls, so it should never run silently after every Regenerate.
  - In v0.4.0 freshness is determined by a **content hash** — SHA-256 of the clip text plus the sorted list of active rule ids — not just the version id. Re-publishing the *same* style guide (same rule set, same clips) is now correctly a no-op for the sweep, so you can hit Regenerate freely without worrying about it queuing up redundant LLM calls.

### 3.6 Draft Coach (`/draft-coach`)
- Paste your draft, click **Review draft**.
- Get a six-dimension score, a one-paragraph summary, and a list of **rule-linked suggestions** with the exact excerpt and a revision proposal.
- **Streaming review** (added v0.4.0). Scores paint as soon as the model returns; the summary fills in next; suggestions arrive last. The button stays in a single `Review draft` state with a spinner. If the stream fails for any reason the page silently falls back to the non-streaming path, so review will still complete.
- Past reviews are retained on the right; click any to revisit.
- **Inline rule-aware revision** (added v0.3.0). Each suggestion now ships with a `proposedRewrite` aligned to the cited rule. The page shows a **side-by-side word diff** — removed words struck through in red, added words highlighted in green — and an **Apply rewrite** button that splices the rewrite back into your draft at the exact excerpt. Up to 20 applies are stacked in an undo history exposed as **Undo last apply** in the page header.
- Click **Why** on any suggestion to read the cited rule's `Do / Avoid / When revising` text inline, without leaving the page.
- If you have already edited the excerpt out of the draft, the Apply button is disabled with an explanation — re-run the review or edit by hand.

## 4. Hard Constraints (Do Not Change)

These are guaranteed by the test suite (`pnpm test`):

| Constraint | Where enforced |
|---|---|
| Reflection prompt wording must be exactly **"What made you save this?"** | `shared/stylelab.ts → REFLECTION_PROMPT`, asserted in `server/styleCompiler.test.ts` |
| Export filenames must be exactly `STYLE_GUIDE.md`, `SKILL.md`, `style_profile.json` | `shared/stylelab.ts → EXPORT_FILENAMES`, asserted in tests |
| Clip deletion must be soft-delete (recoverable) | `server/db.ts → softDeleteClip`, asserted in `server/routers.behavior.test.ts` |
| Style guide versioning must auto-bump on every regeneration | `server/routers.ts → styleGuide.regenerate`, asserted in tests |

If you change any of these, the tests will fail. That is intentional.

## 5. Architecture (One Page)

| Layer | Files |
|---|---|
| Schema | `drizzle/schema.ts` |
| Migrations | `drizzle/migrations/` (apply via `webdev_execute_sql`) |
| Query helpers | `server/db.ts` |
| AI prompts + JSON schemas | `server/_core/styleAI.ts` |
| Style guide compiler | `server/_core/styleCompiler.ts` |
| tRPC routers | `server/routers.ts` |
| Shared constants | `shared/stylelab.ts` |
| Pages | `client/src/pages/{Home,Capture,Library,Collections,Analyze,StyleGuide,DraftCoach}.tsx` |
| Layout / nav | `client/src/components/DashboardLayout.tsx` |
| Theme | `client/src/index.css`, `client/index.html` (Newsreader + Inter + JetBrains Mono) |

The frontend talks to the backend exclusively through tRPC; there are no REST routes to maintain.

## 6. Data Model (Brief)

| Table | Purpose |
|---|---|
| `users` | OAuth identity (Manus). |
| `clips` | Captured passages with source metadata, labels, soft-delete. |
| `clip_reflections` | Reader's reasons for saving each clip. |
| `clip_annotations` | AI-extracted tone/syntax/imagery/rhythm/moves/effect. |
| `taste_patterns` | Recurring style patterns synthesized across selected clips. |
| `style_rules` | Actionable rules with do/avoid/revise + evidence citations. |
| `style_guide_versions` | Auto-bumped versions storing all five artifacts. |
| `draft_reviews` | History of draft reviews with scores + suggestions. |
| `collections`, `clip_collections` | Grouping clips by project/author/theme/purpose. |

## 7. Running and Maintaining the App

### 7.1 Day to day
- Open the dev server URL from the project status panel.
- Sign in with the configured OAuth account.
- Use the sidebar to navigate; capture clips first, then analyze, then compile.

### 7.2 Tests
```bash
pnpm test
```
Runs the full Vitest suite. Currently 12 tests across:
- `server/styleCompiler.test.ts` — compiler output, filenames, frontmatter, JSON shape, empty-state safety, evidence selection.
- `server/routers.behavior.test.ts` — soft-delete vs hard-delete, restore, version auto-bump, deactivation.
- `server/auth.logout.test.ts` — session cookie clearing.

### 7.3 Database
- Schema lives in `drizzle/schema.ts`.
- Migrations: `pnpm drizzle-kit generate`, then read the generated SQL file and apply via `webdev_execute_sql` (one statement at a time if MySQL rejects the batch).
- Never `DROP TABLE` without a backup. The application has no automatic export of clips; treat the database as the source of truth.

### 7.4 Logs
Project logs are under `.manus-logs/`:
- `devserver.log` — server / Vite output.
- `browserConsole.log` — client errors and warnings.
- `networkRequests.log` — RPC traffic.

## 8. Upgrade and Update Procedures

### 8.1 Adding a new feature
1. Update `drizzle/schema.ts` if the feature requires new tables/columns.
2. Run `pnpm drizzle-kit generate`, then apply the generated SQL via `webdev_execute_sql`.
3. Add a query helper in `server/db.ts`.
4. Add or extend a procedure in `server/routers.ts` (use `protectedProcedure`).
5. Add a page or extend an existing page in `client/src/pages/`.
6. Add a Vitest test under `server/*.test.ts`.
7. Run `pnpm test` and `webdev_check_status`.
8. Update this manual and the changelog.

### 8.2 Changing AI prompts
- Prompts and JSON schemas live in `server/_core/styleAI.ts`. Treat each prompt as a contract; if you change the schema you must also update the type in `drizzle/schema.ts` and regenerate any version that depends on it. Existing data already in the database is **not** automatically migrated — older annotations may have fewer fields.

### 8.3 Changing artifact format
- The compiler is in `server/_core/styleCompiler.ts`. Any change to filenames or output structure must be reflected in `shared/stylelab.ts` and the tests in `server/styleCompiler.test.ts`. Old versions in the database remain intact (they store the artifacts as text), so historical exports do not change retroactively.

### 8.4 Theme / typography
- Global tokens are in `client/src/index.css` (Tailwind 4 `@theme inline` blocks).
- Fonts are loaded from Google Fonts in `client/index.html` (Newsreader, Inter, JetBrains Mono).
- Never hard-code colors in components — always use the `bg-*`/`text-*` semantic tokens.

### 8.5 Dependencies
- Use `pnpm add <pkg>` and restart the dev server (`webdev_restart_server`) if the new dep doesn't auto-load.
- Avoid runtime-only dependencies; the production runtime is Node-only and 512 MiB.

## 9. Maintaining "Signal" Across Sources

> The user previously asked about maintaining signal in their Twitter input pipeline. StyleLab's library is the right place to keep that signal coherent.

Practical rules of thumb:

1. **Capture only what you would re-read.** If you would not voluntarily revisit a tweet six months from now, do not save it. The library is graded by re-readability, not novelty.
2. **Always reflect.** A clip without a reflection has half the signal value. The reflection is what teaches the analyzer your taste.
3. **Use collections, not just labels.** Labels are flat and tend to drift; collections give you sharp boundaries (e.g., *Project: Memoir*, *Author: Stegner*, *Theme: Restraint*).
4. **Re-run analysis after every ~25 new clips.** Patterns become statistically meaningful around then. Regenerate the style guide afterwards so a new version is captured.
5. **Trim, don't delete.** Soft-delete clips that no longer feel central, but keep them recoverable so the version history remains traceable.
6. **Use the Draft Coach as a feedback loop.** When the same suggestions keep appearing, that is a real pattern in your writing — take it back into Capture as a counter-example or a target.

## 10. Repository and Changelog

- Codebase lives in `/home/ubuntu/stylelab-internal/`.
- Per-version checkpoints are saved by the platform; rollback through the Management UI rather than `git reset`.
- See `CHANGELOG.md` for what shipped in each version of StyleLab itself.

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Server log shows `Cannot find module '/home/ubuntu/stylelab-internal/storage'` | A historical line from before the import path was fixed. | Compare timestamps; current import is `from "./storage"` and the dev server boot is later. |
| OCR returns garbled text | Source image is too small or low-contrast. | Re-upload a larger or higher-contrast image; you can also paste manually. |
| Patterns mention a clip ID that doesn't exist | Clip was soft-deleted after the pattern was generated. | Soft-deleted clips are still readable by ID; restore them or regenerate the pattern. |
| Style guide regeneration fails | No active rules. | Generate at least one rule via Analyze before regenerating. |
| Draft scores feel uncalibrated | Too few rules / too few clips cited. | Capture more, regenerate the style guide, then re-review the draft. |

## 12. Glossary

- **Clip** — a saved passage of admired writing.
- **Reflection** — your reason for saving a clip.
- **Annotation** — AI-extracted features of a single clip.
- **Pattern** — a recurring style trait across multiple clips, with evidence.
- **Rule** — an actionable do/avoid/revise instruction derived from a pattern.
- **Style Guide Version** — an immutable compiled bundle of all artifacts at a point in time.
- **Draft Review** — a scored, suggestion-rich review of a draft against the active style guide.
