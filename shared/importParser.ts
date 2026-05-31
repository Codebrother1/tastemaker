/**
 * StyleLab — bulk import parser.
 *
 * Pure functions that turn a single uploaded text payload into a list of
 * candidate clip rows. Three formats are supported:
 *
 *   1. csv      — generic CSV with header row. Recognised columns:
 *                   content (required), source_title, source_author,
 *                   source_url, source_location, source_type, labels.
 *                 'labels' may be a `;`-separated or `,`-separated string.
 *
 *   2. readwise — Readwise's standard "Highlights" CSV export. Columns of
 *                 interest: Highlight, Book Title, Book Author, Amazon Book
 *                 ID, URL, Location, Note. Source type is inferred from the
 *                 row's "Category" column (book / article / tweet /
 *                 podcast / supplemental). Falls back to "book".
 *
 *   3. twitter  — Twitter (X) data export. Accepts either the bare JSON
 *                 array (`tweets.json`) or the official `tweets.js` form
 *                 which wraps the array in `window.YTD.tweets.part0 = [...]`.
 *                 Each entry's `tweet.full_text` becomes the clip content.
 *                 Retweets are dropped.
 *
 * The parser never throws on malformed rows; it returns a `skipped` count
 * with reasons so the UI can surface a preview before the user confirms.
 */
import { SOURCE_TYPES, type ImportFormat, type SourceType } from "./stylelab";

export type ParsedClip = {
  content: string;
  sourceType: SourceType;
  sourceTitle?: string | null;
  sourceAuthor?: string | null;
  sourceUrl?: string | null;
  sourceLocation?: string | null;
  labels?: string[];
};

export type ParseResult = {
  format: ImportFormat;
  clips: ParsedClip[];
  skipped: Array<{ row: number; reason: string }>;
};

// ───────────────────────── format detection ─────────────────────────

/**
 * Cheap heuristic detector. The UI also lets the user override.
 *
 * - `tweets.js`/`tweets.json`-style payloads are detected by either a
 *   `window.YTD` prefix or by parsing as JSON and finding `tweet.full_text`.
 * - Readwise CSVs are detected by their distinctive header row.
 * - Anything else with at least one comma in the header line is treated as
 *   generic CSV.
 */
export function detectFormat(text: string, filename?: string): ImportFormat | null {
  const trimmed = text.trim();
  const lower = (filename ?? "").toLowerCase();

  if (lower.endsWith(".json") || lower.endsWith(".js") || lower.includes("tweets")) {
    if (looksLikeTwitter(trimmed)) return "twitter";
  }
  if (looksLikeTwitter(trimmed)) return "twitter";

  // Header-row heuristics for CSV.
  const firstLine = trimmed.split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
  if (firstLine.includes("highlight") && firstLine.includes("book title")) {
    return "readwise";
  }
  if (firstLine.includes(",")) return "csv";
  return null;
}

function looksLikeTwitter(text: string): boolean {
  if (text.startsWith("window.YTD")) return true;
  // Try JSON-parsing the first chunk.
  const head = text.slice(0, 4096);
  if (!head.startsWith("[") && !head.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(head);
    if (Array.isArray(parsed)) {
      return parsed.some(
        (e) => e && typeof e === "object" && (e.tweet || e.full_text)
      );
    }
  } catch {
    // partial JSON — fine
  }
  return /"full_text"\s*:/.test(head);
}

// ───────────────────────────── public API ─────────────────────────────

export function parseImport(
  text: string,
  format: ImportFormat
): ParseResult {
  switch (format) {
    case "twitter":
      return parseTwitter(text);
    case "readwise":
      return parseReadwise(text);
    case "csv":
      return parseGenericCsv(text);
  }
}

// ───────────────────────────── Twitter ─────────────────────────────

function parseTwitter(text: string): ParseResult {
  const skipped: ParseResult["skipped"] = [];
  let body = text.trim();

  // Strip `window.YTD.tweets.partN = ` prefix if present.
  const eq = body.indexOf("=");
  if (body.startsWith("window.YTD") && eq > 0) {
    body = body.slice(eq + 1).trim();
  }
  // Trailing semicolons from JS exports.
  if (body.endsWith(";")) body = body.slice(0, -1);

  let arr: any[] = [];
  try {
    const parsed = JSON.parse(body);
    arr = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return {
      format: "twitter",
      clips: [],
      skipped: [{ row: 0, reason: `Invalid JSON: ${(e as Error).message}` }],
    };
  }

  const clips: ParsedClip[] = [];
  arr.forEach((entry, i) => {
    const t = entry?.tweet ?? entry;
    const text: string | undefined = t?.full_text ?? t?.text;
    if (!text || typeof text !== "string") {
      skipped.push({ row: i + 1, reason: "Missing tweet text" });
      return;
    }
    if (text.startsWith("RT @")) {
      skipped.push({ row: i + 1, reason: "Retweet skipped" });
      return;
    }
    const id = t?.id_str ?? t?.id;
    const url = id ? `https://twitter.com/i/web/status/${id}` : null;
    clips.push({
      content: text,
      sourceType: "tweet",
      sourceUrl: url,
    });
  });
  return { format: "twitter", clips, skipped };
}

// ───────────────────────────── Readwise ─────────────────────────────

function parseReadwise(text: string): ParseResult {
  const skipped: ParseResult["skipped"] = [];
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return {
      format: "readwise",
      clips: [],
      skipped: [{ row: 0, reason: "No data rows" }],
    };
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (key: string) => header.indexOf(key);
  const colHighlight = idx("highlight");
  const colTitle = idx("book title");
  const colAuthor = idx("book author");
  const colUrl = idx("amazon book id"); // best-effort
  const colSrcUrl = idx("url");
  const colLoc = idx("location");
  const colCategory = idx("category");
  const colNote = idx("note");
  if (colHighlight === -1) {
    return {
      format: "readwise",
      clips: [],
      skipped: [{ row: 0, reason: "No 'Highlight' column" }],
    };
  }

  const clips: ParsedClip[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const content = row[colHighlight]?.trim();
    if (!content) {
      skipped.push({ row: i + 1, reason: "Empty highlight" });
      continue;
    }
    const cat = (colCategory >= 0 ? row[colCategory] : "").toLowerCase();
    const sourceType: SourceType =
      cat.includes("tweet")
        ? "tweet"
        : cat.includes("article")
          ? "article"
          : cat.includes("book")
            ? "book"
            : "paragraph";
    const noteVal = colNote >= 0 ? row[colNote]?.trim() : "";
    clips.push({
      content,
      sourceType,
      sourceTitle: colTitle >= 0 ? safeTrim(row[colTitle]) : null,
      sourceAuthor: colAuthor >= 0 ? safeTrim(row[colAuthor]) : null,
      sourceUrl:
        (colSrcUrl >= 0 ? safeTrim(row[colSrcUrl]) : null) ||
        (colUrl >= 0 ? safeTrim(row[colUrl]) : null),
      sourceLocation: colLoc >= 0 ? safeTrim(row[colLoc]) : null,
      labels: noteVal ? [`note:${noteVal.slice(0, 60)}`] : undefined,
    });
  }
  return { format: "readwise", clips, skipped };
}

// ───────────────────────────── Generic CSV ─────────────────────────────

function parseGenericCsv(text: string): ParseResult {
  const skipped: ParseResult["skipped"] = [];
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return {
      format: "csv",
      clips: [],
      skipped: [{ row: 0, reason: "No data rows" }],
    };
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const i = header.indexOf(c);
      if (i >= 0) return i;
    }
    return -1;
  };
  const colContent = find("content", "highlight", "text", "quote");
  if (colContent === -1) {
    return {
      format: "csv",
      clips: [],
      skipped: [{ row: 0, reason: "No content/highlight/text/quote column" }],
    };
  }
  const colTitle = find("source_title", "title", "book", "book title");
  const colAuthor = find("source_author", "author");
  const colUrl = find("source_url", "url");
  const colLoc = find("source_location", "location");
  const colType = find("source_type", "type");
  const colLabels = find("labels", "tags");

  const clips: ParsedClip[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const content = row[colContent]?.trim();
    if (!content) {
      skipped.push({ row: i + 1, reason: "Empty content" });
      continue;
    }
    const rawType = colType >= 0 ? row[colType]?.trim().toLowerCase() : "";
    const sourceType: SourceType = (
      SOURCE_TYPES as readonly string[]
    ).includes(rawType)
      ? (rawType as SourceType)
      : "paragraph";
    const labelsRaw = colLabels >= 0 ? row[colLabels] : "";
    const labels = parseLabels(labelsRaw);
    clips.push({
      content,
      sourceType,
      sourceTitle: colTitle >= 0 ? safeTrim(row[colTitle]) : null,
      sourceAuthor: colAuthor >= 0 ? safeTrim(row[colAuthor]) : null,
      sourceUrl: colUrl >= 0 ? safeTrim(row[colUrl]) : null,
      sourceLocation: colLoc >= 0 ? safeTrim(row[colLoc]) : null,
      labels: labels.length > 0 ? labels : undefined,
    });
  }
  return { format: "csv", clips, skipped };
}

// ───────────────────────────── helpers ─────────────────────────────

function safeTrim(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseLabels(raw: string | undefined): string[] {
  if (!raw) return [];
  const parts = raw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set(parts));
}

/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields, embedded commas,
 * embedded newlines inside quotes, and `""` escaping. Not a complete
 * implementation but sufficient for Readwise / generic exports.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      // eat \r\n as one line break
      if (ch === "\r" && text[i + 1] === "\n") i += 2;
      else i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // flush
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop any fully-empty trailing rows.
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) {
    rows.pop();
  }
  return rows;
}
