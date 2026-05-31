/**
 * Tiny word-level diff used by the Draft Coach revision panel.
 *
 * Returns parallel token arrays for the original and the rewrite, each
 * tagged with its kind ("equal" | "remove" | "add"). The implementation is
 * an LCS in O(n × m); n and m are bounded by the suggestion excerpt length,
 * which the model is told to keep small, so the cost is negligible in
 * practice.
 *
 * We tokenise on whitespace boundaries while preserving runs of whitespace
 * as their own tokens — that means the rendered diff keeps original
 * spacing/line breaks instead of collapsing them.
 */

export type DiffKind = "equal" | "remove" | "add";
export type DiffToken = { kind: DiffKind; text: string };

export function tokenize(text: string): string[] {
  // Split into alternating word / whitespace runs.
  const out: string[] = [];
  const re = /(\s+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function diffWords(a: string, b: string): {
  before: DiffToken[];
  after: DiffToken[];
} {
  const A = tokenize(a);
  const B = tokenize(b);
  const n = A.length;
  const m = B.length;
  // LCS length matrix.
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (A[i] === B[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const before: DiffToken[] = [];
  const after: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      before.push({ kind: "equal", text: A[i] });
      after.push({ kind: "equal", text: B[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      before.push({ kind: "remove", text: A[i] });
      i++;
    } else {
      after.push({ kind: "add", text: B[j] });
      j++;
    }
  }
  while (i < n) {
    before.push({ kind: "remove", text: A[i++] });
  }
  while (j < m) {
    after.push({ kind: "add", text: B[j++] });
  }
  return { before, after };
}
