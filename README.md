# StyleLab — Personal Writing Taste Engine

> A private studio for the writing you admire.

StyleLab is a single-user internal tool for capturing sentences, paragraphs, and screenshots that move you, analyzing the patterns in what you save, compiling a living personal style guide, and using that guide to coach your own drafts.

The goal is simple: most writers have taste before they have technique. StyleLab helps you make your taste legible — to yourself and to AI assistants — so you can close the gap faster.

---

## What it does

| Step | Page | What happens |
|---|---|---|
| 1. Capture | `/capture` | Paste text or upload a screenshot. StyleLab OCRs the image, extracts the text, and asks "What made you save this?" — your reflection is stored alongside the clip. |
| 2. Library | `/library` | Browse, search, filter, and edit every clip. Soft-delete is the only delete; nothing is ever destroyed. Bulk-import from CSV, Readwise, or Twitter/X archive. |
| 3. Analyze | `/analyze` | Select 2–40 clips and synthesize recurring style patterns. For each pattern, generate 1–3 actionable rules (positive instruction, avoidance guidance, revision guidance). |
| 4. Style Guide | `/style-guide` | Compile all active rules into a versioned style guide: a `STYLE_GUIDE.md` for humans, a `SKILL.md` for Claude Projects, a `style_profile.json`, and ready-to-paste system prompts for Claude and ChatGPT. |
| 5. Draft Coach | `/draft-coach` | Paste a draft. Get a six-dimension score, a one-paragraph summary, and rule-linked suggestions — each with a side-by-side word diff and an Apply button that splices the rewrite directly into your draft. |

---

## Goals

1. **Make taste legible.** The app forces you to articulate *why* you saved something, not just that you did. Those reflections become the raw material for rules.
2. **Close the taste-technique gap.** The style guide is a living document that grows as your library grows. It is never "done."
3. **AI-native from day one.** Every artifact the app produces (SKILL.md, style_profile.json, assistant instructions) is designed to be dropped into an AI assistant's context so the model can write *in your voice*, not a generic one.
4. **Private and owned.** This is an internal tool. One user, one database, no social features. Your taste is yours.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Tailwind 4 + shadcn/ui |
| Backend | Express 4 + tRPC 11 (end-to-end typed) |
| Database | MySQL / TiDB via Drizzle ORM |
| Auth | Manus OAuth (session cookie) |
| AI | Manus built-in LLM + Whisper (OCR via vision model) |
| Storage | Manus S3 proxy (image uploads) |
| Runtime | Node.js 22, single process, Cloud Run compatible |

---

## Version history

| Version | Date | Summary |
|---|---|---|
| v0.1.0 | 2026-05-31 | First complete build. All five pages, style guide compiler, draft coach with six-dimension scoring. 12 vitest tests. |
| v0.2.0 | 2026-05-31 | Full QA pass. Fixed artifact key contracts, suggestion field names, ownership checks on collections, per-row pending states and error toasts throughout. 16 tests. |
| v0.3.0 | 2026-05-31 | Bulk import (CSV / Readwise / Twitter archive), inline rule-aware revision with word diff and Apply/Undo, manual annotation refresh tied to active style guide version. 37 tests. |
| v0.4.0 | 2026-05-31 | Import audit log on Library, streaming Draft Coach review (SSE → scores → summary → suggestions, with mutation fallback), hash-based annotation freshness (SHA-256 of clip text + active rule ids). 40 tests. |

Full details in [CHANGELOG.md](./CHANGELOG.md).

---

## Running locally

```bash
pnpm install
pnpm dev          # starts Express + Vite on :3000
pnpm test         # vitest
pnpm exec tsc     # type-check
```

Environment variables are injected by the Manus platform. See `server/_core/env.ts` for the full list. You will need `DATABASE_URL`, `JWT_SECRET`, and the Manus OAuth credentials to run outside the platform.

---

## Project structure

```
client/src/pages/      ← Capture, Library, Collections, Analyze, StyleGuide, DraftCoach
server/routers.ts      ← all tRPC procedures
server/db.ts           ← query helpers (Drizzle)
server/_core/styleAI.ts   ← LLM prompts + JSON schemas
server/_core/styleCompiler.ts  ← artifact compilation
server/_core/draftStream.ts    ← SSE endpoint for streaming review
shared/stylelab.ts     ← constants shared between client and server
shared/importParser.ts ← dependency-free CSV / Readwise / Twitter parser
drizzle/schema.ts      ← database schema
```

---

## Instruction manual

See [INSTRUCTION_MANUAL.md](./INSTRUCTION_MANUAL.md) for a full page-by-page usage guide, hard constraints, architecture overview, and upgrade procedures.

## QA reports

- [QA_REPORT_v0.2.0.md](./QA_REPORT_v0.2.0.md)
- [QA_REPORT_v0.3.0.md](./QA_REPORT_v0.3.0.md)
- [QA_REPORT_v0.4.0.md](./QA_REPORT_v0.4.0.md)
