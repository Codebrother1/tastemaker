import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, PageHeader, PageShell, ScoreBar } from "@/components/StyleLabUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { diffWords } from "@/lib/wordDiff";
import { DRAFT_DIMENSIONS } from "@shared/stylelab";
import { format } from "date-fns";
import {
  Check,
  History,
  Info,
  Loader2,
  PencilRuler,
  RotateCcw,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Suggestion = {
  ruleId: number | null;
  ruleTitle: string;
  excerpt: string;
  suggestion: string;
  proposedRewrite?: string;
  citationClipIds: number[];
};

type ReviewResult = {
  scores: Record<string, number>;
  suggestions: Suggestion[];
  summary: string;
};

export default function DraftCoach() {
  const [draft, setDraft] = useState("");
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<string[]>([]);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [streaming, setStreaming] = useState(false);
  const utils = trpc.useUtils();

  const review = trpc.draft.review.useMutation({
    onSuccess: (data: any) => {
      setResult(data as ReviewResult);
      setAppliedKeys(new Set());
      utils.draft.list.invalidate();
      toast.success("Draft reviewed");
    },
    onError: (e) => toast.error(e.message),
  });
  const historyQuery = trpc.draft.list.useQuery();
  const rulesQuery = trpc.rules.list.useQuery({ activeOnly: true });

  const onReview = async () => {
    if (draft.trim().length < 10) {
      toast.error("Paste a longer draft to review.");
      return;
    }
    setAppliedKeys(new Set());
    setResult({ scores: {}, summary: "", suggestions: [] });
    setStreaming(true);
    try {
      const res = await fetch("/api/stream/draft-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ draft }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`stream init failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let sawDone = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const evt of events) {
          const dataLine = evt
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(6));
            if (payload.type === "scores") {
              setResult((prev) => ({
                scores: payload.scores,
                summary: prev?.summary ?? "",
                suggestions: prev?.suggestions ?? [],
              }));
            } else if (payload.type === "summary") {
              setResult((prev) => ({
                scores: prev?.scores ?? {},
                summary: payload.summary,
                suggestions: prev?.suggestions ?? [],
              }));
            } else if (payload.type === "suggestions") {
              setResult((prev) => ({
                scores: prev?.scores ?? {},
                summary: prev?.summary ?? "",
                suggestions: payload.suggestions,
              }));
            } else if (payload.type === "done") {
              sawDone = true;
              utils.draft.list.invalidate();
            } else if (payload.type === "error") {
              throw new Error(payload.message ?? "Stream error");
            }
          } catch {
            // skip malformed event
          }
        }
      }
      if (!sawDone) throw new Error("Stream ended unexpectedly");
      toast.success("Draft reviewed");
    } catch (e: any) {
      // Fall back to non-streaming path on any error.
      try {
        await review.mutateAsync({ draft });
      } catch (e2: any) {
        toast.error(e2?.message ?? e?.message ?? "Review failed");
      }
    } finally {
      setStreaming(false);
    }
  };

  const pushHistory = (snapshot: string) =>
    setHistory((h) => [...h.slice(-19), snapshot]);

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const next = h[h.length - 1];
      setDraft(next);
      return h.slice(0, -1);
    });
  };

  const applySuggestion = (s: Suggestion, idx: number) => {
    if (!s.proposedRewrite || !s.proposedRewrite.trim()) {
      toast.error("No rewrite was proposed for this suggestion.");
      return;
    }
    if (!s.excerpt || !draft.includes(s.excerpt)) {
      toast.error(
        "The original excerpt is no longer present in the draft. Edit manually or re-review."
      );
      return;
    }
    pushHistory(draft);
    setDraft((d) => d.replace(s.excerpt, s.proposedRewrite!));
    setAppliedKeys((prev) => new Set(prev).add(`${idx}-${s.ruleId ?? "null"}`));
    toast.success("Rewrite applied");
  };

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="Draft Coach"
          title="Compare your draft to your taste"
          description="Paste a paragraph or full draft. StyleLab scores it across six dimensions and returns rule-linked suggestions tied to your active style guide. Click Apply on any rewrite to splice it back into your draft."
          actions={
            history.length > 0 ? (
              <Button variant="outline" onClick={undo}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Undo last apply
              </Button>
            ) : null
          }
        />

        {rulesQuery.data && rulesQuery.data.length === 0 && (
          <Card className="card-elevated p-4 mb-6 text-sm text-muted-foreground">
            You have no active style rules yet. Generate and activate rules in
            <span className="font-medium"> Analyze </span>
            so the draft coach has criteria to score against.
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-elevated p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Your draft
            </p>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Paste a paragraph or full piece…"
              className="min-h-[280px] bg-background/60 border-border resize-none focus-visible:ring-1 focus-visible:ring-primary"
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-muted-foreground font-mono">
                {draft.length.toLocaleString()} chars
              </span>
              <Button
                onClick={onReview}
                disabled={review.isPending || streaming}
              >
                {review.isPending || streaming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Review draft
              </Button>
            </div>
          </Card>

          <Card className="card-elevated p-5">
            {!result ? (
              <EmptyState
                icon={<PencilRuler className="h-6 w-6" />}
                title="Awaiting your draft"
                description="Submit a draft to see scores and revision suggestions."
              />
            ) : (
              <ResultView
                result={result}
                rules={rulesQuery.data ?? []}
                draft={draft}
                appliedKeys={appliedKeys}
                onApply={applySuggestion}
              />
            )}
          </Card>
        </div>

        <section className="mt-12 space-y-3">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <History className="h-3.5 w-3.5" /> Recent reviews
          </h2>
          {(historyQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(historyQuery.data as any[]).slice(0, 8).map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    setDraft(h.draftText);
                    setResult({
                      scores: h.scores,
                      suggestions: h.suggestions,
                      summary: h.summary,
                    });
                    setAppliedKeys(new Set());
                  }}
                  className="text-left card-elevated p-4 hover:bg-card transition-colors"
                >
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {format(new Date(h.createdAt), "MMM d, HH:mm")}
                  </p>
                  <p className="prose-clip line-clamp-3 mt-1">{h.draftText}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </PageShell>
    </DashboardLayout>
  );
}

function ResultView({
  result,
  rules,
  draft,
  appliedKeys,
  onApply,
}: {
  result: ReviewResult;
  rules: any[];
  draft: string;
  appliedKeys: Set<string>;
  onApply: (s: Suggestion, i: number) => void;
}) {
  const scores = result.scores ?? {};
  const suggestions: Suggestion[] = result.suggestions ?? [];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Summary
        </p>
        <p className="text-sm leading-relaxed">{result.summary}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">
          Scores
        </p>
        <div className="space-y-2.5">
          {DRAFT_DIMENSIONS.map((dim) => (
            <ScoreBar
              key={dim}
              label={dim}
              value={typeof scores[dim] === "number" ? scores[dim] : 0}
            />
          ))}
        </div>
      </div>
      {suggestions.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Suggestions
          </p>
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <SuggestionCard
                key={i}
                suggestion={s}
                index={i}
                rule={rules.find((r) => r.id === s.ruleId) ?? null}
                draft={draft}
                applied={appliedKeys.has(`${i}-${s.ruleId ?? "null"}`)}
                onApply={onApply}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  index,
  rule,
  draft,
  applied,
  onApply,
}: {
  suggestion: Suggestion;
  index: number;
  rule: any;
  draft: string;
  applied: boolean;
  onApply: (s: Suggestion, i: number) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const hasRewrite = !!(
    suggestion.proposedRewrite && suggestion.proposedRewrite.trim()
  );
  const excerptInDraft = !!suggestion.excerpt && draft.includes(suggestion.excerpt);
  const diff = useMemo(
    () =>
      hasRewrite
        ? diffWords(suggestion.excerpt, suggestion.proposedRewrite!)
        : null,
    [hasRewrite, suggestion.excerpt, suggestion.proposedRewrite]
  );

  return (
    <div className="border-l-2 border-primary/40 pl-3">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        {suggestion.ruleTitle && (
          <Badge
            variant="outline"
            className="text-[10px] bg-primary/5 border-primary/30"
          >
            {suggestion.ruleTitle}
          </Badge>
        )}
        {suggestion.ruleId != null && (
          <Badge variant="outline" className="font-mono text-[10px]">
            rule #{suggestion.ruleId}
          </Badge>
        )}
        {Array.isArray(suggestion.citationClipIds) &&
          suggestion.citationClipIds.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">
              cites {suggestion.citationClipIds
                .map((id: number) => `#${id}`)
                .join(", ")}
            </span>
          )}
      </div>
      <p className="text-sm leading-relaxed mb-2">{suggestion.suggestion}</p>

      {hasRewrite && diff ? (
        <div className="rounded-md border border-border bg-card/40 p-2 mb-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
                Original
              </p>
              <p className="leading-relaxed font-serif text-foreground/85">
                {diff.before.map((t, k) =>
                  t.kind === "remove" ? (
                    <span
                      key={k}
                      className="bg-red-500/15 text-red-300 line-through decoration-red-400/60"
                    >
                      {t.text}
                    </span>
                  ) : (
                    <span key={k}>{t.text}</span>
                  )
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
                Rewrite
              </p>
              <p className="leading-relaxed font-serif text-foreground">
                {diff.after.map((t, k) =>
                  t.kind === "add" ? (
                    <span
                      key={k}
                      className="bg-emerald-500/15 text-emerald-300"
                    >
                      {t.text}
                    </span>
                  ) : (
                    <span key={k}>{t.text}</span>
                  )
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Button
              size="sm"
              variant={applied ? "outline" : "default"}
              disabled={applied || !excerptInDraft}
              onClick={() => onApply(suggestion, index)}
              aria-label={
                applied
                  ? "Rewrite already applied"
                  : "Apply this rewrite to the draft"
              }
            >
              {applied ? (
                <>
                  <Check className="mr-2 h-3.5 w-3.5" />
                  Applied
                </>
              ) : (
                "Apply rewrite"
              )}
            </Button>
            {!excerptInDraft && !applied && (
              <span className="text-[10px] text-muted-foreground">
                Excerpt no longer in draft
              </span>
            )}
            {rule && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowWhy((v) => !v)}
                className="bg-card"
              >
                <Info className="mr-1.5 h-3.5 w-3.5" />
                {showWhy ? "Hide why" : "Why"}
              </Button>
            )}
          </div>
        </div>
      ) : (
        suggestion.excerpt && (
          <p className="text-sm leading-relaxed italic text-foreground/70 mb-2">
            “{suggestion.excerpt}”
          </p>
        )
      )}

      {showWhy && rule && (
        <div className="rounded-md border border-dashed border-border bg-background/40 p-3 text-xs space-y-1.5">
          <p>
            <span className="text-muted-foreground uppercase tracking-[0.14em] mr-1">
              Do
            </span>
            {rule.positiveInstruction}
          </p>
          <p>
            <span className="text-muted-foreground uppercase tracking-[0.14em] mr-1">
              Avoid
            </span>
            {rule.avoidanceGuidance}
          </p>
          <p>
            <span className="text-muted-foreground uppercase tracking-[0.14em] mr-1">
              When revising
            </span>
            {rule.revisionGuidance}
          </p>
        </div>
      )}
    </div>
  );
}
