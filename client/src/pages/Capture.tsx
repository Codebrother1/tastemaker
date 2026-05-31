import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, PageHeader, PageShell } from "@/components/StyleLabUI";
import { trpc } from "@/lib/trpc";
import {
  REFLECTION_PROMPT,
  SOURCE_TYPES,
  type SourceType,
} from "@shared/stylelab";
import { ImagePlus, Loader2, ScanText, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Step = "compose" | "reflect";

export default function Capture() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("compose");
  const [createdClipId, setCreatedClipId] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("paragraph");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceAuthor, setSourceAuthor] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceLocation, setSourceLocation] = useState("");
  const [labels, setLabels] = useState("");
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const createClip = trpc.clips.create.useMutation();
  const addReflection = trpc.clips.addReflection.useMutation();
  const annotate = trpc.clips.annotate.useMutation();
  const ocr = trpc.clips.ocrFromImage.useMutation();

  const reset = () => {
    setStep("compose");
    setCreatedClipId(null);
    setContent("");
    setSourceTitle("");
    setSourceAuthor("");
    setSourceUrl("");
    setSourceLocation("");
    setLabels("");
    setImageKey(null);
    setReflection("");
  };

  const onSaveClip = async () => {
    if (!content.trim()) {
      toast.error("Add some text before saving.");
      return;
    }
    try {
      const result = await createClip.mutateAsync({
        content: content.trim(),
        sourceType,
        sourceTitle: sourceTitle || null,
        sourceAuthor: sourceAuthor || null,
        sourceUrl: sourceUrl || null,
        sourceLocation: sourceLocation || null,
        labels: labels
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        capturedFrom: imageKey ? "ocr" : "manual",
        imageKey,
      });
      setCreatedClipId(result.id);
      utils.clips.list.invalidate();
      // Background-annotate, but don't block UI on it.
      annotate.mutateAsync({ clipId: result.id }).catch(() => {});
      setStep("reflect");
    } catch (e) {
      toast.error("Could not save clip.");
    }
  };

  const onSaveReflection = async () => {
    if (!createdClipId) return;
    if (!reflection.trim()) {
      toast.error("Reflections are how StyleLab learns your taste.");
      return;
    }
    try {
      await addReflection.mutateAsync({
        clipId: createdClipId,
        content: reflection.trim(),
      });
      toast.success("Clip saved with reflection.");
      utils.clips.list.invalidate();
      setLocation(`/library`);
    } catch {
      toast.error("Could not save reflection.");
    }
  };

  const onSkipReflection = () => {
    toast.message("Saved without reflection. You can add one later.");
    setLocation(`/library`);
  };

  const onUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      try {
        const res = await ocr.mutateAsync({
          imageBase64: base64,
          mimeType: file.type || "image/png",
          filename: file.name,
        });
        setContent((prev) => (prev ? `${prev}\n\n${res.text}` : res.text));
        setImageKey(res.imageKey);
        toast.success("Text extracted from image.");
      } catch {
        toast.error("OCR failed — try another image.");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="Capture"
          title="Save a piece of writing you admire"
          description="Paste a sentence, tweet, paragraph, or upload a screenshot. StyleLab will analyze the prose, then ask you what made you save it."
        />

        {step === "compose" && (
          <div className="space-y-6">
            <Card className="card-elevated p-5 space-y-5">
              <div className="grid sm:grid-cols-[1fr_220px] gap-4">
                <Field label="Passage">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={10}
                    placeholder="Paste the writing you want to keep…"
                    className="prose-clip resize-y min-h-[180px]"
                  />
                </Field>
                <div className="space-y-3">
                  <Field label="Source type">
                    <Select
                      value={sourceType}
                      onValueChange={(v) => setSourceType(v as SourceType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="space-y-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUpload(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileRef.current?.click()}
                      className="w-full bg-card"
                      disabled={ocr.isPending}
                    >
                      {ocr.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="mr-2 h-4 w-4" />
                      )}
                      {ocr.isPending ? "Extracting…" : "Upload image (OCR)"}
                    </Button>
                    {imageKey && (
                      <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <ScanText className="h-3 w-3" />
                        Image attached
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Title (book, article, post)">
                  <Input
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    placeholder="e.g. Pilgrim at Tinker Creek"
                  />
                </Field>
                <Field label="Author / handle">
                  <Input
                    value={sourceAuthor}
                    onChange={(e) => setSourceAuthor(e.target.value)}
                    placeholder="e.g. Annie Dillard"
                  />
                </Field>
                <Field label="URL (optional)">
                  <Input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </Field>
                <Field
                  label="Location"
                  hint="Page number, chapter, timestamp, etc."
                >
                  <Input
                    value={sourceLocation}
                    onChange={(e) => setSourceLocation(e.target.value)}
                    placeholder="e.g. p. 47"
                  />
                </Field>
                <Field
                  label="Labels"
                  hint="Comma separated. Examples: restraint, imagery, openings."
                >
                  <Input
                    value={labels}
                    onChange={(e) => setLabels(e.target.value)}
                    placeholder="restraint, imagery"
                  />
                </Field>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={reset}>
                  Clear
                </Button>
                <Button onClick={onSaveClip} disabled={createClip.isPending}>
                  {createClip.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save clip
                </Button>
              </div>
            </Card>
          </div>
        )}

        {step === "reflect" && (
          <Card className="card-elevated p-6 space-y-5">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">
                Reflection
              </p>
            </div>
            <h2 className="font-serif text-2xl">{REFLECTION_PROMPT}</h2>
            <p className="text-sm text-muted-foreground">
              One or two sentences is enough. The signal is in what you noticed.
            </p>
            <Textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={5}
              placeholder="The sentence withholds the verb until the last beat — it makes the image feel inevitable."
              className="prose-clip"
              autoFocus
            />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={onSkipReflection}>
                Skip for now
              </Button>
              <Button
                onClick={onSaveReflection}
                disabled={addReflection.isPending}
              >
                {addReflection.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save reflection
              </Button>
            </div>
          </Card>
        )}
      </PageShell>
    </DashboardLayout>
  );
}
