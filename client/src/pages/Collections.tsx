import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, PageHeader, PageShell } from "@/components/StyleLabUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { COLLECTION_KINDS, type CollectionKind } from "@shared/stylelab";
import { format } from "date-fns";
import {
  FolderPlus,
  FolderTree,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Collections() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<CollectionKind>("project");
  const [activeId, setActiveId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const collectionsQuery = trpc.collections.list.useQuery();
  const create = trpc.collections.create.useMutation({
    onSuccess: () => {
      utils.collections.list.invalidate();
      toast.success("Collection created");
      setOpen(false);
      setName("");
      setDescription("");
      setKind("project");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.collections.delete.useMutation({
    onSuccess: () => {
      utils.collections.list.invalidate();
      toast.message("Collection deleted");
      setActiveId(null);
    },
  });
  const memberClipsQuery = trpc.clips.list.useQuery(
    { collectionId: activeId ?? -1, limit: 200 },
    { enabled: activeId != null }
  );

  const collections = (collectionsQuery.data ?? []) as any[];

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="Collections"
          title="Group clips by purpose"
          description="Organize your library by project, author, theme, or any frame that helps you study your taste in context."
          actions={
            <Button onClick={() => setOpen(true)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New collection
            </Button>
          }
        />

        {collections.length === 0 ? (
          <EmptyState
            icon={<FolderTree className="h-6 w-6" />}
            title="No collections yet"
            description="Create your first collection to group clips for a specific essay, author study, or thematic exploration."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New collection
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((c) => (
              <Card
                key={c.id}
                className={`card-elevated p-5 cursor-pointer hover:bg-card transition-colors ${
                  activeId === c.id ? "ring-1 ring-primary" : ""
                }`}
                onClick={() =>
                  setActiveId((cur) => (cur === c.id ? null : c.id))
                }
              >
                <div className="flex items-start justify-between mb-2">
                  <Badge
                    variant="outline"
                    className="capitalize bg-secondary/60"
                  >
                    {c.kind}
                  </Badge>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this collection?")) {
                        remove.mutate({ id: c.id });
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <h3 className="font-serif text-xl mb-1">{c.name}</h3>
                {c.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {c.description}
                  </p>
                )}
                <p className="text-[11px] mt-3 text-muted-foreground font-mono">
                  {format(new Date(c.createdAt), "MMM d, yyyy")}
                </p>
              </Card>
            ))}
          </div>
        )}

        {activeId != null && (
          <section className="mt-10">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Clips in this collection
            </p>
            {memberClipsQuery.isLoading ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading…
              </div>
            ) : (memberClipsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No clips in this collection yet. Add clips from the Library
                detail panel.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(memberClipsQuery.data as any[]).map((c) => (
                  <Link key={c.id} href={`/library`}>
                    <Card className="card-elevated p-4 hover:bg-card transition-colors cursor-pointer">
                      <p className="prose-clip line-clamp-4">{c.content}</p>
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        {[c.sourceAuthor, c.sourceTitle]
                          .filter(Boolean)
                          .join(" — ") || "Untitled source"}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">
                New collection
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Name
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                  placeholder="Memoir study, opening lines, etc."
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Kind
                </Label>
                <Select
                  value={kind}
                  onValueChange={(v) => setKind(v as CollectionKind)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLLECTION_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Description (optional)
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={create.isPending || name.trim().length === 0}
                onClick={() =>
                  create.mutate({ name, kind, description: description || undefined })
                }
              >
                {create.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageShell>
    </DashboardLayout>
  );
}
