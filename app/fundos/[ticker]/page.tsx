import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CircleDashed,
  FileText,
  Gauge,
  Layers3,
  ShieldAlert,
} from "lucide-react";

import { SafaHeader } from "@/components/safa-header";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getDocuments, getInstrument, getSections, numberValue } from "@/lib/safa-data";

export const dynamic = "force-dynamic";

type FundPageProps = {
  params: Promise<{ ticker: string }>;
};

const sectionIcons: Record<string, typeof BookOpen> = {
  documentary: BookOpen,
  income: Layers3,
  risks: ShieldAlert,
  critical_review: CheckCircle2,
};

function showScore(value: number | string | null) {
  const parsed = numberValue(value);
  return parsed === null ? "—" : parsed.toFixed(1);
}

export default async function FundPage({ params }: FundPageProps) {
  const { ticker } = await params;
  const instrument = await getInstrument(ticker);
  if (!instrument) notFound();

  const [sections, documents] = await Promise.all([
    getSections(instrument.analysis_run_id),
    getDocuments(instrument.analysis_run_id),
  ]);
  const firstComplete = sections.filter((section) => section.first_pass_status === "complete").length;
  const secondComplete = sections.filter((section) => section.second_pass_status === "complete").length;
  const pagesReviewed = documents.reduce((sum, document) => sum + document.pages_reviewed, 0);
  const pagesTotal = documents.reduce((sum, document) => sum + (document.pages_total ?? 0), 0);
  const coverage = numberValue(instrument.coverage_pct) ?? 0;

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <SafaHeader />
      <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Link href="/#fila" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="size-4" /> Voltar à fila
        </Link>

        <section className="mb-6 overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(135deg,rgba(15,31,49,.97),rgba(7,21,34,.94))] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <StatusPill status={instrument.status} />
                <Badge variant="outline" className="border-white/10 bg-white/4 text-slate-300">Deep Max v1</Badge>
                <Badge variant="outline" className="border-white/10 bg-white/4 text-slate-300">Fila #{instrument.queue_position ?? "—"}</Badge>
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-300/70">Ficha integral do fundo</p>
              <h1 className="mt-2 font-serif text-4xl text-white sm:text-5xl">{instrument.ticker}</h1>
              <p className="mt-3 text-sm text-slate-400">{instrument.name ?? "Nome e segmento serão confirmados durante a análise documental."}</p>
            </div>
            <div className="w-full max-w-sm rounded-xl border border-white/8 bg-black/10 p-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-slate-400">Cobertura total</span>
                <span className="font-mono text-teal-200">{coverage.toFixed(0)}%</span>
              </div>
              <Progress value={coverage} className="h-2.5 bg-slate-800 [&_[data-slot=progress-indicator]]:bg-teal-300" />
              <p className="mt-3 text-xs leading-5 text-slate-500">A nota e o veredito permanecem bloqueados até as duas passagens terminarem.</p>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Qualidade", showScore(instrument.quality_score)],
            ["Renda", showScore(instrument.income_score)],
            ["Segurança", showScore(instrument.safety_score)],
            ["Oportunidade", showScore(instrument.opportunity_score)],
            ["Confiança", showScore(instrument.confidence_score)],
          ].map(([label, value]) => (
            <Card key={label} className="gap-2 border-white/8 bg-[#0b1826] py-5 shadow-none">
              <CardContent className="px-5">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 font-mono text-2xl text-white">{value}</p>
                <p className="mt-1 text-[11px] text-slate-600">não avaliado ≠ zero</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-white/8 bg-[#0b1826] shadow-none">
            <CardHeader>
              <CardTitle className="text-white">Veredito</CardTitle>
              <CardDescription className="text-slate-400">Conclusão de qualidade, preço e prioridade de aporte.</CardDescription>
            </CardHeader>
            <CardContent>
              {instrument.verdict_summary ? (
                <p className="text-sm leading-7 text-slate-200">{instrument.verdict_summary}</p>
              ) : (
                <div className="flex gap-3 rounded-xl border border-amber-300/12 bg-amber-300/[0.045] p-4 text-sm leading-6 text-amber-100/90">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
                  Sem veredito. Este fundo ainda não passou pela análise integral e pela revisão crítica.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/8 bg-[#0b1826] shadow-none">
            <CardHeader>
              <CardTitle className="text-white">Controles de conclusão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-xs text-slate-400"><span>Primeira passagem</span><span>{firstComplete}/{sections.length}</span></div>
                <Progress value={sections.length ? (firstComplete / sections.length) * 100 : 0} className="h-1.5 bg-slate-800 [&_[data-slot=progress-indicator]]:bg-cyan-300" />
              </div>
              <div>
                <div className="mb-2 flex justify-between text-xs text-slate-400"><span>Segunda passagem</span><span>{secondComplete}/{sections.length}</span></div>
                <Progress value={sections.length ? (secondComplete / sections.length) * 100 : 0} className="h-1.5 bg-slate-800 [&_[data-slot=progress-indicator]]:bg-violet-300" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/7 bg-white/[0.02] px-3 py-2 text-xs">
                <span className="text-slate-400">Páginas conferidas</span>
                <span className="font-mono text-white">{pagesReviewed}/{pagesTotal || "—"}</span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-300/70">Escopo completo</p>
              <h2 className="mt-1 text-xl font-semibold text-white">16 blocos da análise</h2>
            </div>
            <span className="hidden text-xs text-slate-500 sm:block">Cada bloco exige duas verificações independentes</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {sections.map((section, index) => {
              const Icon = sectionIcons[section.section_code] ?? Gauge;
              return (
                <Card key={section.section_code} className="gap-4 border-white/8 bg-[#0b1826] py-5 shadow-none">
                  <CardContent className="px-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <span className="grid size-9 place-items-center rounded-lg bg-teal-300/8 text-teal-200"><Icon className="size-4" /></span>
                      <span className="font-mono text-xs text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="min-h-10 text-sm font-medium leading-5 text-white">{section.title}</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusPill status={section.first_pass_status} className="text-[10px]" />
                      <StatusPill status={section.second_pass_status} className="text-[10px]" />
                    </div>
                    {section.narrative ? (
                      <p className="mt-4 line-clamp-3 text-xs leading-5 text-slate-400">{section.narrative}</p>
                    ) : (
                      <p className="mt-4 flex items-center gap-2 text-xs text-slate-600"><CircleDashed className="size-3" /> Aguardando pesquisa</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card className="border-white/8 bg-[#0b1826] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><FileText className="size-4 text-teal-300" /> Documentos analisados</CardTitle>
              <CardDescription className="text-slate-400">Registro leve: competência, páginas e link. Os PDFs não são armazenados.</CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length ? (
                <div className="space-y-2">
                  {documents.map((document) => (
                    <div key={document.id} className="flex items-center justify-between gap-4 rounded-lg border border-white/7 bg-white/[0.02] p-3 text-sm">
                      <div><p className="text-white">{document.title}</p><p className="mt-1 text-xs text-slate-500">{document.competence_date ?? "sem competência"}</p></div>
                      <span className="font-mono text-xs text-slate-400">{document.pages_reviewed}/{document.pages_total ?? "—"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center">
                  <FileText className="mx-auto size-6 text-slate-600" />
                  <p className="mt-3 text-sm text-slate-400">Nenhum documento catalogado ainda.</p>
                  <p className="mt-1 text-xs text-slate-600">O fundo permanece corretamente como não analisado.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/8 bg-[#0b1826] shadow-none">
            <CardHeader>
              <CardTitle className="text-white">Números, séries e gráficos</CardTitle>
              <CardDescription className="text-slate-400">Dividendos, fundamentos, preços e cenários ocuparão esta área após a coleta.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Preço atual", instrument.current_price],
                  ["Valor justo base", instrument.fair_value_base],
                  ["Renda sustentável", instrument.sustainable_income_per_share],
                  ["Data de corte", instrument.as_of_date],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-white/7 bg-white/[0.02] p-4">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-2 font-mono text-base text-white">{value ?? "—"}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-dashed border-white/10 p-6 text-center text-xs leading-5 text-slate-500">
                Gráficos não são fabricados sem série histórica verificada.
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

