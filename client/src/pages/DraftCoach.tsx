import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, PageHeader, PageShell, ScoreBar } from "@/components/StyleLabUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { DRAFT_DIMENSIONS } from "@shared/stylelab";
import { format } from "date-fns";
import { History, Loader2, PencilRuler, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function DraftCoach() {
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const utils = trpc.useUtils();
  const review = trpc.draft.review.useMutation({
    onSuccess: (data) => {
      setResult(data);
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
    await review.mutateAsync({ draft });
  };

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="Draft Coach"
          title="Compare your draft to your taste"
          description="Paste a paragraph or full draft. StyleLab scores it across six dimensions and returns rule-linked suggestions tied to your active style guide."
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
              <Button onClick={onReview} disabled={review.isPending}>
                {review.isPending ? (
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
              <ResultView result={result} />
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

function ResultView({ result }: { result: any }) {
  const scores = result.scores ?? {};
  const suggestions: any[] = result.suggestions ?? [];
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
              <div key={i} className="border-l-2 border-primary/40 pl-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {s.ruleTitle && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-primary/5 border-primary/30"
                    >
                      {s.ruleTitle}
                    </Badge>
                  )}
                  {s.ruleId != null && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      rule #{s.ruleId}
                    </Badge>
                  )}
                  {Array.isArray(s.citationClipIds) &&
                    s.citationClipIds.length > 0 && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        cites {s.citationClipIds
                          .map((id: number) => `#${id}`)
                          .join(", ")}
                      </span>
                    )}
                </div>
                {s.excerpt && (
                  <p className="text-sm leading-relaxed italic text-foreground/70 mb-1">
                    “{s.excerpt}”
                  </p>
                )}
                <p className="text-sm leading-relaxed">{s.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
