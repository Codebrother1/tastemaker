import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, PageHeader, PageShell } from "@/components/StyleLabUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { SOURCE_TYPES, type SourceType } from "@shared/stylelab";
import { format } from "date-fns";
import {
  ArchiveRestore,
  BookOpenText,
  Loader2,
  PenLine,
  Pencil,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type ListItem = {
  id: number;
  content: string;
  sourceType: string;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  sourceUrl: string | null;
  sourceLocation: string | null;
  labels: string[] | null;
  isDeleted: boolean | null;
  createdAt: Date;
};

export default function Library() {
  const [search, setSearch] = useState("");
  const [sourceType, setSourceType] = useState<SourceType | "all">("all");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [labelFilter, setLabelFilter] = useState<string>("all");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<ListItem | null>(null);

  const utils = trpc.useUtils();
  const collectionsQuery = trpc.collections.list.useQuery();

  const listQuery = trpc.clips.list.useQuery({
    search: search || undefined,
    sourceType: sourceType === "all" ? undefined : sourceType,
    collectionId:
      collectionFilter === "all" ? undefined : Number(collectionFilter),
    label: labelFilter === "all" ? undefined : labelFilter,
    includeDeleted,
  });
  const detailQuery = trpc.clips.get.useQuery(
    { id: selectedId ?? -1 },
    { enabled: selectedId != null }
  );
  const annotateMutation = trpc.clips.annotate.useMutation({
    onSuccess: () => {
      if (selectedId != null) utils.clips.get.invalidate({ id: selectedId });
    },
  });
  const softDelete = trpc.clips.softDelete.useMutation({
    onSuccess: () => utils.clips.list.invalidate(),
  });
  const restore = trpc.clips.restore.useMutation({
    onSuccess: () => utils.clips.list.invalidate(),
  });
  const updateClip = trpc.clips.update.useMutation({
    onSuccess: () => {
      utils.clips.list.invalidate();
      if (selectedId != null) utils.clips.get.invalidate({ id: selectedId });
      toast.success("Clip updated");
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const addToCollection = trpc.collections.addClip.useMutation({
    onSuccess: () => {
      if (selectedId != null) utils.clips.get.invalidate({ id: selectedId });
      toast.success("Added to collection");
    },
  });
  const removeFromCollection = trpc.collections.removeClip.useMutation({
    onSuccess: () => {
      if (selectedId != null) utils.clips.get.invalidate({ id: selectedId });
    },
  });

  const clips = (listQuery.data as ListItem[] | undefined) ?? [];
  const items = useMemo(() => clips, [clips]);

  // Build the unique label list from current results so user can filter further.
  const allLabels = useMemo(() => {
    const set = new Set<string>();
    clips.forEach((c) => (c.labels ?? []).forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [clips]);

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="Library"
          title="Your collected writing"
          description="Search, filter, and revisit the writing you have saved. Click any clip to inspect StyleLab's analysis, manage collections, and edit metadata."
          actions={
            <Link href="/capture">
              <Button>
                <PenLine className="mr-2 h-4 w-4" />
                New clip
              </Button>
            </Link>
          }
        />

        <div className="flex flex-col lg:flex-row gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search content, source, author…"
              className="pl-9"
            />
          </div>
          <Select
            value={sourceType}
            onValueChange={(v) => setSourceType(v as SourceType | "all")}
          >
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {SOURCE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={labelFilter} onValueChange={setLabelFilter}>
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue placeholder="All labels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All labels</SelectItem>
              {allLabels.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={collectionFilter} onValueChange={setCollectionFilter}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder="All collections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All collections</SelectItem>
              {(collectionsQuery.data ?? []).map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={includeDeleted ? "default" : "outline"}
            onClick={() => setIncludeDeleted((v) => !v)}
            className={includeDeleted ? "" : "bg-card"}
          >
            <ArchiveRestore className="mr-2 h-4 w-4" />
            {includeDeleted ? "Showing archived" : "Show archived"}
          </Button>
        </div>

        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BookOpenText className="h-6 w-6" />}
            title="No clips yet"
            description="Capture a sentence, tweet, paragraph, or screenshot to begin building your taste library."
            action={
              <Link href="/capture">
                <Button>Start capturing</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="text-left card-elevated p-5 hover:bg-card transition-colors group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="capitalize border-border bg-secondary/60"
                    >
                      {c.sourceType}
                    </Badge>
                    {c.isDeleted && (
                      <Badge variant="outline" className="text-destructive">
                        archived
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {format(new Date(c.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
                <p className="prose-clip line-clamp-4">{c.content}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">
                    {[c.sourceAuthor, c.sourceTitle]
                      .filter(Boolean)
                      .join(" — ") || "Untitled source"}
                  </span>
                  {c.labels && c.labels.length > 0 && (
                    <span className="truncate ml-2">
                      {c.labels.slice(0, 3).join(" · ")}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <Sheet open={selectedId != null} onOpenChange={(o) => !o && setSelectedId(null)}>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
            {detailQuery.data ? (
              (() => {
                const { clip, reflections, annotation, collections } =
                  detailQuery.data as any;
                const collectionList = (collectionsQuery.data ?? []) as any[];
                const memberIds = new Set<number>(
                  (collections ?? []).map((c: any) => c.id)
                );
                return (
                  <>
                    <SheetHeader>
                      <SheetTitle className="font-serif text-2xl">
                        {clip.sourceTitle || "Untitled passage"}
                      </SheetTitle>
                      <SheetDescription>
                        {[clip.sourceAuthor, clip.sourceLocation]
                          .filter(Boolean)
                          .join(" · ") || "No source metadata."}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-4 space-y-5 px-1">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-card"
                          onClick={() => setEditing(clip)}
                        >
                          <Pencil className="mr-2 h-3 w-3" /> Edit clip
                        </Button>
                        {clip.sourceUrl && (
                          <a
                            href={clip.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary self-center hover:underline truncate max-w-[200px]"
                          >
                            {clip.sourceUrl}
                          </a>
                        )}
                      </div>

                      <Card className="p-4">
                        <p className="prose-clip whitespace-pre-wrap">{clip.content}</p>
                      </Card>

                      {clip.labels && clip.labels.length > 0 && (
                        <section>
                          <h3 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2 flex items-center gap-1">
                            <Tag className="h-3 w-3" /> Labels
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            {clip.labels.map((l: string) => (
                              <Badge
                                key={l}
                                variant="outline"
                                className="bg-secondary/60"
                              >
                                {l}
                              </Badge>
                            ))}
                          </div>
                        </section>
                      )}

                      <section>
                        <h3 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
                          Collections
                        </h3>
                        {collections && collections.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {collections.map((col: any) => (
                              <Badge
                                key={col.id}
                                variant="outline"
                                className="bg-primary/10 text-primary border-primary/30 pr-1"
                              >
                                {col.name}
                                <button
                                  className="ml-1 hover:text-destructive"
                                  onClick={() =>
                                    removeFromCollection.mutate({
                                      clipId: clip.id,
                                      collectionId: col.id,
                                    })
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mb-2">
                            Not in any collection.
                          </p>
                        )}
                        {collectionList.length > 0 && (
                          <Select
                            onValueChange={(v) => {
                              const id = Number(v);
                              if (!Number.isFinite(id)) return;
                              if (memberIds.has(id)) return;
                              addToCollection.mutate({
                                clipId: clip.id,
                                collectionId: id,
                              });
                            }}
                          >
                            <SelectTrigger className="bg-card">
                              <SelectValue placeholder="Add to collection…" />
                            </SelectTrigger>
                            <SelectContent>
                              {collectionList
                                .filter((c) => !memberIds.has(c.id))
                                .map((c) => (
                                  <SelectItem key={c.id} value={String(c.id)}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                        <div className="mt-2">
                          <Link href="/collections">
                            <span className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer">
                              Manage collections →
                            </span>
                          </Link>
                        </div>
                      </section>

                      {reflections.length > 0 && (
                        <section>
                          <h3 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
                            Reflections
                          </h3>
                          <div className="space-y-2">
                            {reflections.map((r: any) => (
                              <Card key={r.id} className="p-3 text-sm">
                                {r.content}
                              </Card>
                            ))}
                          </div>
                        </section>
                      )}

                      <section>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Annotation
                          </h3>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-card"
                            onClick={() =>
                              annotateMutation
                                .mutateAsync({ clipId: clip.id })
                                .then(() => toast.success("Re-analyzed"))
                                .catch(() => toast.error("Analysis failed"))
                            }
                            disabled={annotateMutation.isPending}
                          >
                            {annotateMutation.isPending ? (
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-3 w-3" />
                            )}
                            {annotation ? "Re-analyze" : "Analyze"}
                          </Button>
                        </div>
                        {annotation ? (
                          <AnnotationView data={annotation.data} />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Run analysis to extract tone, syntax, imagery, rhythm,
                            and rhetorical moves.
                          </p>
                        )}
                      </section>

                      <div className="flex justify-between pt-4 border-t border-border">
                        {clip.isDeleted ? (
                          <Button
                            variant="outline"
                            onClick={() =>
                              restore
                                .mutateAsync({ id: clip.id })
                                .then(() => toast.success("Restored"))
                            }
                          >
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                            Restore
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              softDelete
                                .mutateAsync({ id: clip.id })
                                .then(() => {
                                  toast.message("Archived");
                                  setSelectedId(null);
                                })
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Archive
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </SheetContent>
        </Sheet>

        <EditClipDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) =>
            editing && updateClip.mutate({ id: editing.id, patch })
          }
          saving={updateClip.isPending}
        />
      </PageShell>
    </DashboardLayout>
  );
}

function EditClipDialog({
  editing,
  onClose,
  onSave,
  saving,
}: {
  editing: ListItem | null;
  onClose: () => void;
  onSave: (patch: any) => void;
  saving: boolean;
}) {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [labels, setLabels] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("paragraph");

  // Sync state when "editing" changes
  useMemo(() => {
    if (editing) {
      setContent(editing.content);
      setTitle(editing.sourceTitle ?? "");
      setAuthor(editing.sourceAuthor ?? "");
      setUrl(editing.sourceUrl ?? "");
      setLocation(editing.sourceLocation ?? "");
      setLabels((editing.labels ?? []).join(", "));
      setSourceType((editing.sourceType as SourceType) ?? "paragraph");
    }
  }, [editing]);

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Edit clip</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Content
            </Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[160px] mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Source type
              </Label>
              <Select
                value={sourceType}
                onValueChange={(v) => setSourceType(v as SourceType)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Author
              </Label>
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Title
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Location / page
              </Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                URL
              </Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Labels (comma separated)
              </Label>
              <Input
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                placeholder="restraint, concrete, rhythmic"
                className="mt-1"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              const labelArr = labels
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              onSave({
                content,
                sourceType,
                sourceTitle: title || null,
                sourceAuthor: author || null,
                sourceUrl: url || null,
                sourceLocation: location || null,
                labels: labelArr,
              });
            }}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Pencil className="mr-2 h-4 w-4" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnnotationView({ data }: { data: any }) {
  if (!data || typeof data !== "object") return null;
  const groups: Array<{ title: string; key: string }> = [
    { title: "Tone", key: "tone" },
    { title: "Syntax", key: "syntax" },
    { title: "Imagery", key: "imagery" },
    { title: "Rhythm", key: "rhythm" },
    { title: "Rhetorical moves", key: "rhetoricalMoves" },
    { title: "Dominant effect", key: "dominantEffect" },
  ];
  return (
    <div className="space-y-3">
      {groups.map(({ title, key }) => {
        const value = (data as any)[key];
        if (value == null) return null;
        const text = Array.isArray(value) ? value.join(" · ") : String(value);
        return (
          <div key={key}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
              {title}
            </p>
            <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
          </div>
        );
      })}
    </div>
  );
}
