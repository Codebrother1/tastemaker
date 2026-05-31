import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, PageShell } from "@/components/StyleLabUI";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  ArrowUpRight,
  BookOpenText,
  Compass,
  Loader2,
  PenLine,
  PencilRuler,
  ScrollText,
} from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SignedOutHero />;
  }

  return <Dashboard />;
}

function SignedOutHero() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-serif text-sm">
            S
          </div>
          <span className="font-serif text-lg tracking-tight">StyleLab</span>
        </div>
        <a href={getLoginUrl()}>
          <Button variant="outline" className="bg-card">
            Sign in
          </Button>
        </a>
      </header>
      <main className="flex-1 grid place-items-center px-6">
        <div className="max-w-2xl text-center space-y-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Internal · Personal Style Engine
          </p>
          <h1 className="font-serif text-5xl sm:text-6xl tracking-tight leading-[1.05]">
            A private studio for the writing you admire.
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Capture sentences, paragraphs, and screenshots that move you.
            Reflect on what makes them sing. Let StyleLab synthesize the
            patterns and compile a living style guide you can use to coach your
            own drafts.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <a href={getLoginUrl()}>
              <Button size="lg">
                Enter the studio
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

function Dashboard() {
  const clipsQuery = trpc.clips.list.useQuery({ limit: 200 });
  const patternsQuery = trpc.analyze.listPatterns.useQuery();
  const rulesQuery = trpc.rules.list.useQuery();
  const versionsQuery = trpc.styleGuide.listVersions.useQuery();
  const clips = (clipsQuery.data ?? []) as any[];
  const live = clips.filter((c) => !c.isDeleted);

  const stats = [
    {
      label: "Clips",
      value: live.length,
      hint: "in your library",
      href: "/library",
      icon: <BookOpenText className="h-4 w-4" />,
    },
    {
      label: "Patterns",
      value: (patternsQuery.data ?? []).length,
      hint: "synthesized",
      href: "/analyze",
      icon: <Compass className="h-4 w-4" />,
    },
    {
      label: "Rules",
      value: (rulesQuery.data ?? []).length,
      hint: "in your guide",
      href: "/analyze",
      icon: <ScrollText className="h-4 w-4" />,
    },
    {
      label: "Versions",
      value: (versionsQuery.data ?? []).length,
      hint: "of style guide",
      href: "/style-guide",
      icon: <PencilRuler className="h-4 w-4" />,
    },
  ];

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="Studio"
          title="Build your taste, then write to it."
          description="Capture writing you admire, reflect on what makes it work, synthesize the patterns into rules, and let StyleLab compile a living style guide you can use to review drafts."
          actions={
            <Link href="/capture">
              <Button>
                <PenLine className="mr-2 h-4 w-4" />
                New clip
              </Button>
            </Link>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {stats.map((s) => (
            <Link key={s.label} href={s.href}>
              <Card className="card-elevated p-4 hover:bg-card transition-colors cursor-pointer">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  {s.icon}
                  <span className="uppercase tracking-[0.16em]">{s.label}</span>
                </div>
                <p className="font-serif text-3xl mt-2">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.hint}</p>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Step
            n={1}
            title="Capture"
            href="/capture"
            blurb="Save a sentence, tweet, paragraph, or screenshot. Each clip can carry source metadata and a reflection."
          />
          <Step
            n={2}
            title="Analyze"
            href="/analyze"
            blurb="Pick clips you love, synthesize the recurring patterns, and convert them into evidence-backed style rules."
          />
          <Step
            n={3}
            title="Compile"
            href="/style-guide"
            blurb="Regenerate STYLE_GUIDE.md, SKILL.md, style_profile.json and assistant instructions whenever your taste evolves."
          />
          <Step
            n={4}
            title="Coach"
            href="/draft-coach"
            blurb="Paste your draft and StyleLab grades it across six dimensions and offers rule-linked suggestions."
          />
        </div>
      </PageShell>
    </DashboardLayout>
  );
}

function Step({
  n,
  title,
  blurb,
  href,
}: {
  n: number;
  title: string;
  blurb: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="card-elevated p-5 hover:bg-card transition-colors cursor-pointer h-full">
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            Step {n}
          </span>
        </div>
        <h3 className="font-serif text-2xl mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{blurb}</p>
        <div className="mt-3 inline-flex items-center text-xs text-primary">
          Open
          <ArrowUpRight className="ml-1 h-3 w-3" />
        </div>
      </Card>
    </Link>
  );
}
