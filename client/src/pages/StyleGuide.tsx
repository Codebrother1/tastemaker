import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, PageHeader, PageShell } from "@/components/StyleLabUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { EXPORT_FILENAMES } from "@shared/stylelab";
import { format } from "date-fns";
import {
  BookMarked,
  Check,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Artifacts = {
  styleGuideMd: string;
  skillMd: string;
  styleProfileJson: string;
  claudeInstructions: string;
  chatgptInstructions: string;
};

export default function StyleGuide() {
  const utils = trpc.useUtils();
  const versionsQuery = trpc.styleGuide.listVersions.useQuery();
  const activeQuery = trpc.styleGuide.getActive.useQuery();
  const [viewingId, setViewingId] = useState<number | null>(null);
  const viewQuery = trpc.styleGuide.getVersion.useQuery(
    { id: viewingId ?? -1 },
    { enabled: viewingId != null }
  );
  const regenerate = trpc.styleGuide.regenerate.useMutation({
    onSuccess: () => {
      utils.styleGuide.listVersions.invalidate();
      utils.styleGuide.getActive.invalidate();
      toast.success("New style guide version saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const activate = trpc.styleGuide.activate.useMutation({
    onSuccess: () => {
      utils.styleGuide.listVersions.invalidate();
      utils.styleGuide.getActive.invalidate();
      toast.success("Version activated");
    },
    onError: (e) => toast.error(e.message ?? "Could not activate version"),
  });
  const refreshAnnotations = trpc.clips.refreshAnnotations.useMutation({
    onSuccess: (data) => {
      const parts: string[] = [
        `Refreshed ${data.refreshed} clip${data.refreshed === 1 ? "" : "s"}`,
      ];
      if (data.failed.length > 0)
        parts.push(`${data.failed.length} failed`);
      if (data.remaining > 0)
        parts.push(`${data.remaining} still pending — run again to continue`);
      toast.success(parts.join(" · "));
    },
    onError: (e) => toast.error(e.message ?? "Annotation refresh failed"),
  });

  const versions = (versionsQuery.data ?? []) as any[];
  const active = activeQuery.data as any;

  const viewing =
    viewingId != null
      ? (viewQuery.data as any)
      : active ?? versions[0];

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="Style Guide"
          title="Your living writing guide"
          description="Compile your active rules into portable artifacts: STYLE_GUIDE.md, SKILL.md, style_profile.json, and assistant instructions. Every regeneration creates a new version automatically."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="bg-card"
                onClick={() =>
                  refreshAnnotations.mutateAsync().catch(() => undefined)
                }
                disabled={refreshAnnotations.isPending}
                title="Re-annotate clips whose annotations are stale relative to the active style guide."
              >
                {refreshAnnotations.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh annotations
              </Button>
              <Button
                onClick={() => regenerate.mutateAsync().catch(() => undefined)}
                disabled={regenerate.isPending}
              >
                {regenerate.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Regenerate guide
              </Button>
            </div>
          }
        />

        {versions.length === 0 ? (
          <EmptyState
            icon={<BookMarked className="h-6 w-6" />}
            title="No style guide yet"
            description="Activate at least one style rule, then regenerate to create your first STYLE_GUIDE.md."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
            <aside className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Version history
              </p>
              {versions.map((v) => {
                const isActive = !!v.isActive;
                const isViewing = viewing?.id === v.id;
                return (
                  <div key={v.id} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => setViewingId(v.id)}
                    className={`w-full text-left card-elevated p-3 transition-colors ${
                      isViewing ? "ring-1 ring-primary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-serif text-base">v{v.versionNumber}</span>
                      {isActive && (
                        <Badge className="bg-primary/15 text-primary border-primary/30">
                          <Check className="h-3 w-3 mr-1" /> Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {format(new Date(v.createdAt), "MMM d, yyyy · HH:mm")}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {v.ruleCount} rule{v.ruleCount === 1 ? "" : "s"}
                    </p>
                    {v.summary && (
                      <p className="text-xs mt-1 line-clamp-2">{v.summary}</p>
                    )}
                  </button>
                  {!isActive && (
                    <button
                      type="button"
                      className="mt-1 ml-3 text-[11px] text-primary hover:underline disabled:opacity-50 inline-flex items-center gap-1"
                      disabled={
                        activate.isPending &&
                        (activate.variables as any)?.id === v.id
                      }
                      onClick={() => activate.mutate({ id: v.id })}
                    >
                      {activate.isPending &&
                        (activate.variables as any)?.id === v.id && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                      Set active
                    </button>
                  )}
                  </div>
                );
              })}
            </aside>

            <div>
              {viewing ? (
                <ArtifactViewer artifacts={viewing.artifacts as Artifacts} />
              ) : (
                <p className="text-sm text-muted-foreground">Select a version to view.</p>
              )}
            </div>
          </div>
        )}
      </PageShell>
    </DashboardLayout>
  );
}

function ArtifactViewer({ artifacts }: { artifacts: Artifacts }) {
  if (!artifacts) return null;
  const tabs = [
    {
      key: "guide",
      label: EXPORT_FILENAMES.styleGuide,
      content: artifacts.styleGuideMd ?? "",
      mime: "text/markdown",
    },
    {
      key: "skill",
      label: EXPORT_FILENAMES.skill,
      content: artifacts.skillMd ?? "",
      mime: "text/markdown",
    },
    {
      key: "profile",
      label: EXPORT_FILENAMES.styleProfile,
      content: artifacts.styleProfileJson ?? "",
      mime: "application/json",
    },
    {
      key: "claude",
      label: EXPORT_FILENAMES.claude,
      content: artifacts.claudeInstructions ?? "",
      mime: "text/markdown",
    },
    {
      key: "chatgpt",
      label: EXPORT_FILENAMES.chatgpt,
      content: artifacts.chatgptInstructions ?? "",
      mime: "text/markdown",
    },
  ];
  return (
    <Tabs defaultValue="guide">
      <TabsList className="bg-secondary/60">
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="font-mono text-xs">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.key} value={t.key}>
          <Card className="card-elevated p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="font-mono text-xs text-muted-foreground">{t.label}</span>
              <div className="flex gap-2">
                <CopyButton content={t.content} />
                <DownloadButton
                  content={t.content}
                  filename={t.label}
                  mime={t.mime}
                />
              </div>
            </div>
            <pre className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap break-words font-mono max-h-[60vh] overflow-auto">
              {t.content}
            </pre>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CopyButton({ content }: { content: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      className="bg-card"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(content);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Could not copy");
        }
      }}
    >
      {done ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
      Copy
    </Button>
  );
}

function DownloadButton({
  content,
  filename,
  mime,
}: {
  content: string;
  filename: string;
  mime: string;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="bg-card"
      onClick={() => {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download className="h-3 w-3 mr-1" />
      Download
    </Button>
  );
}
