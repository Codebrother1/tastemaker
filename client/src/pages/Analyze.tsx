import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, PageHeader, PageShell } from "@/components/StyleLabUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  Compass,
  Loader2,
  Scale,
  Sparkles,
  Telescope,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function Analyze() {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const clipsQuery = trpc.clips.list.useQuery({ limit: 200 });
  const patternsQuery = trpc.analyze.listPatterns.useQuery();
  const rulesQuery = trpc.rules.list.useQuery();

  const synthesize = trpc.analyze.synthesize.useMutation({
    onSuccess: () => {
      utils.analyze.listPatterns.invalidate();
      toast.success("Patterns synthesized");
    },
    onError: () => toast.error("Synthesis failed"),
  });
  const generateRules = trpc.analyze.generateRules.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      toast.success("Rules generated");
    },
    onError: () => toast.error("Rule generation failed"),
  });
  const deletePattern = trpc.analyze.deletePattern.useMutation({
    onSuccess: () => {
      utils.analyze.listPatterns.invalidate();
      toast.message("Pattern removed");
    },
    onError: (e) => toast.error(e.message ?? "Could not remove pattern"),
  });
  const deleteRule = trpc.rules.delete.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      toast.message("Rule deleted");
    },
    onError: (e) => toast.error(e.message ?? "Could not delete rule"),
  });
  const updateRule = trpc.rules.update.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      toast.message("Rule updated");
    },
    onError: (e) => toast.error(e.message ?? "Could not update rule"),
  });

  const clips = (clipsQuery.data ?? []) as any[];
  const visibleClips = useMemo(() => clips.filter((c) => !c.isDeleted), [clips]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onSynthesize = async () => {
    if (selected.size < 2) {
      toast.error("Pick at least two clips to find patterns.");
      return;
    }
    await synthesize.mutateAsync({ clipIds: Array.from(selected) });
    setSelected(new Set());
  };

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="Analyze"
          title="Find the patterns in what you love"
          description="Select two or more clips and StyleLab will synthesize the recurring style moves, then convert each pattern into evidence-backed style rules."
          actions={
            <Button onClick={onSynthesize} disabled={synthesize.isPending}>
              {synthesize.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Telescope className="mr-2 h-4 w-4" />
              )}
              Synthesize patterns ({selected.size})
            </Button>
          }
        />

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Choose clips
          </h2>
          {visibleClips.length === 0 ? (
            <EmptyState
              icon={<Compass className="h-6 w-6" />}
              title="Capture more clips first"
              description="StyleLab needs at least two clips to find recurring style patterns."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleClips.map((c) => (
                <label
                  key={c.id}
                  className={`card-elevated p-4 flex gap-3 cursor-pointer transition-colors ${
                    selected.has(c.id) ? "ring-1 ring-primary bg-accent/40" : ""
                  }`}
                >
                  <Checkbox
                    checked={selected.has(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="prose-clip line-clamp-3">{c.content}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground truncate">
                      {[c.sourceAuthor, c.sourceTitle]
                        .filter(Boolean)
                        .join(" — ") || "Untitled"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12 space-y-3">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Patterns
          </h2>
          {patternsQuery.data && patternsQuery.data.length > 0 ? (
            <div className="space-y-3">
              {patternsQuery.data.map((p: any) => (
                <Card key={p.id} className="card-elevated p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-serif text-xl">{p.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {p.description}
                      </p>
                      <div className="flex gap-1 mt-3 flex-wrap">
                        {(p.evidenceClipIds ?? []).map((cid: number) => (
                          <Badge key={cid} variant="outline" className="font-mono text-[10px]">
                            clip #{cid}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={async () => {
                          setGeneratingFor(p.id);
                          await generateRules
                            .mutateAsync({ patternId: p.id })
                            .finally(() => setGeneratingFor(null));
                        }}
                        disabled={generatingFor === p.id}
                      >
                        {generatingFor === p.id ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-3 w-3" />
                        )}
                        Generate rules
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deletePattern.mutate({ id: p.id })}
                        disabled={
                          deletePattern.isPending &&
                          (deletePattern.variables as any)?.id === p.id
                        }
                      >
                        {deletePattern.isPending &&
                        (deletePattern.variables as any)?.id === p.id ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-3 w-3" />
                        )}
                        Remove
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Patterns will appear here once you synthesize them.
            </p>
          )}
        </section>

        <section className="mt-12 space-y-3">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Style rules
          </h2>
          {rulesQuery.data && rulesQuery.data.length > 0 ? (
            <div className="space-y-3">
              {rulesQuery.data.map((r: any) => (
                <Card key={r.id} className="card-elevated p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-primary" />
                        <h3 className="font-serif text-lg">{r.title}</h3>
                        {r.isActive && (
                          <Badge className="bg-primary/15 text-primary border-primary/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <Field title="Do">{r.positiveInstruction}</Field>
                      <Field title="Avoid">{r.avoidanceGuidance}</Field>
                      <Field title="When revising">{r.revisionGuidance}</Field>
                      {r.citationClipIds && r.citationClipIds.length > 0 && (
                        <div className="flex gap-1 flex-wrap pt-1">
                          {r.citationClipIds.map((cid: number) => (
                            <Badge
                              key={cid}
                              variant="outline"
                              className="font-mono text-[10px]"
                            >
                              clip #{cid}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-card"
                        onClick={() =>
                          updateRule.mutate({
                            id: r.id,
                            patch: { isActive: !r.isActive },
                          })
                        }
                        disabled={
                          updateRule.isPending &&
                          (updateRule.variables as any)?.id === r.id
                        }
                      >
                        {updateRule.isPending &&
                        (updateRule.variables as any)?.id === r.id ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : null}
                        {r.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteRule.mutate({ id: r.id })}
                        disabled={
                          deleteRule.isPending &&
                          (deleteRule.variables as any)?.id === r.id
                        }
                      >
                        {deleteRule.isPending &&
                        (deleteRule.variables as any)?.id === r.id ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-3 w-3" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate rules from a pattern to populate your style guide.
            </p>
          )}
        </section>
      </PageShell>
    </DashboardLayout>
  );
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}
