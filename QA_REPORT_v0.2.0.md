# StyleLab — QA Report v0.2.0

**Date:** 2026-05-31
**Scope:** Targeted quality audit of every page and procedure shipped in v0.1.0. No feature additions; only correctness, safety, mutation UX, and accessibility.

---

## Methodology

Each page was re-read end-to-end against its tRPC contract; each tRPC procedure was re-read against its database helper and against the schema in `drizzle/schema.ts`. The unit-test suite was used to lock in regressions where a contract or ownership rule was tightened.

---

## Bugs found and fixed

### Frontend contract drift

| # | File | Symptom | Fix |
| - | --- | --- | --- |
| 1 | `client/src/pages/StyleGuide.tsx` | Render fell through to empty `<pre>` blocks because the page used field names like `styleGuideMarkdown`, `skillMarkdown`, `styleProfile` (object) etc. | Aligned to the real `StyleGuideArtifacts` shape: `styleGuideMd`, `skillMd`, `styleProfileJson` (string), `claudeInstructions`, `chatgptInstructions`. |
| 2 | `client/src/pages/DraftCoach.tsx` | Suggestion rows showed empty text because the page expected `rule`, `quote`, `revision`. | Renamed to backend keys `ruleTitle`, `excerpt`, `suggestion`, `citationClipIds`. |
| 3 | `client/src/pages/Library.tsx` (`EditClipDialog`) | Dialog state for the second-and-onward clip opened was stale; setState was being called inside `useMemo`. | Replaced with `useEffect([editing])`. Imported `useEffect` accordingly. |

### Mutation UX

| # | File | Issue | Fix |
| - | --- | --- | --- |
| 4 | `Collections.tsx` | Delete trash icon had no pending state and no error toast. | Per-row spinner (`Loader2` swap), `disabled` only when *that* id is in flight, `onError` toast. |
| 5 | `Analyze.tsx` | `deletePattern`, `deleteRule`, `updateRule` had silent success and no per-row pending. | Per-row spinners and `toast.message` / `toast.error` on each. |
| 6 | `StyleGuide.tsx` | `activate` had no `onError` handler and disabled *all* "Set active" buttons during any in-flight activation. | Added `onError` toast and gated the disabled state to the matching id. |

### Accessibility

| # | File | Issue | Fix |
| - | --- | --- | --- |
| 7 | `Collections.tsx` | Trash icon was a bare `<button>` with no accessible name. | Added `type="button"` and `aria-label={``Delete collection ${name}``}`. |
| 8 | `Library.tsx` | Collection-remove "×" inside a `<Badge>` had no accessible name. | Added `type="button"` and `aria-label="Remove from collection"`. |

### Backend ownership

| # | File | Issue | Fix |
| - | --- | --- | --- |
| 9 | `server/routers.ts` (`collections.addClip` / `removeClip`) | The router verified the clip belonged to the caller but never verified the collection. A user could attach their own clip to another user's collection. | Added a parallel `getCollection(userId, collectionId)` ownership check; both must resolve before mutation. |
| 10 | `server/routers.ts` (`clips.list`) | When the client passed `collectionId`, the join was performed without verifying the collection belonged to the caller. | Added an upfront `getCollection` ownership check; throws `NOT_FOUND` if the collection is not the user's. |
| 11 | `server/db.ts` (`deleteCollection`) | The helper deleted `clip_collections` rows by `collectionId` *before* the userId-scoped delete on `collections`, so a forged collection id could wipe link-table rows belonging to other users (the `collections` row would not be deleted, but the link rows would be gone). | Reordered: call `getCollection` first; if not owned, return silently. |

A new helper `db.getCollection(userId, id)` was introduced to support the three checks above.

---

## Test results

```
Test Files  3 passed (3)
     Tests  16 passed (16)
```

New tests added in `server/routers.behavior.test.ts`:

1. `collections.delete` — calls `db.deleteCollection` with `(userId, id)`, confirming router-level userId scoping.
2. `collections.addClip` rejects when `getCollection` returns undefined (foreign collection).
3. `collections.addClip` rejects when `getClip` returns undefined (foreign clip).
4. `collections.addClip` succeeds when both are owned and forwards `(clipId, collectionId)` to `db.addClipToCollection`.

Other suites are untouched and still green:

- `server/styleCompiler.test.ts` — 8 tests (exact filenames, frontmatter, JSON shape, evidence selection, empty-state safety).
- `server/auth.logout.test.ts` — 1 test (cookie clearing).

`pnpm exec tsc --noEmit`: 0 errors.

---

## Hard constraints — re-verified

- Reflection prompt wording is still exactly **"What made you save this?"** (`shared/stylelab.ts`, asserted in `styleCompiler.test.ts`).
- Export filenames are still exactly `STYLE_GUIDE.md`, `SKILL.md`, `style_profile.json` (plus `claude_instructions.md`, `chatgpt_instructions.md`).
- Clip deletion remains soft (no `hardDeleteClip` / `destroyClip` exists; covered by behavior test).
- Style guide versions auto-bump on every regeneration; older versions are deactivated atomically (covered by behavior test).

---

## Items deliberately not changed in this pass

- The signed-out hero, the dashboard layout shell, and all editorial typography decisions remain as shipped in v0.1.0 — this pass was not a redesign.
- Bulk import (CSV / Readwise / Twitter export), browser-extension capture, and lazy back-fill of annotations remain v0.1.0 follow-ups.
