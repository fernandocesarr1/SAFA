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
  ScrollText,
  ShieldAlert,
  Waypoints,
} from "lucide-react";

import { SafaHeader } from "@/components/safa-header";
import { FundAnalysisCharts } from "@/components/fund-analysis-charts";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { deepMaxScoreWeights } from "@/lib/deep-max-methodology";
import {
  getDistributions,
  getDocuments,
  getFinalReport,
  getInstrument,
  getMetrics,
  getPrices,
  getReadiness,
  getRisks,
  getSections,
  getTopTenants,
  getTriggers,
  getValuationScenarios,
  numberValue,
} from "@/lib/safa-data";

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

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const actionLabels: Record<string, string> = { wait: "Esperar", hold: "Manter", buy: "Comprar", buy_in_tranches: "Comprar em parcelas", increase: "Aumentar", reduce: "Reduzir", sell: "Vender", avoid: "Evitar" };
const metricLabels: Record<string, [string, string]> = {
  p_vp: ["P/VP", "x"], dy_12m: ["DY 12 meses", "%"], vacancy_physical: ["Vacância física", "%"],
  vacancy_financial: ["Vacância financeira", "%"], wault: ["WALE", " anos"], income_coverage: ["Cobertura do rendimento", "x"],
  recurring_income_per_share: ["Renda normalizada", "R$"], top_tenant_concentration: ["Maior locatário", "%"],
};

const profileLabels: Record<string, string> = {
  unclassified: "A classificar",
  brick_fii: "Tijolo",
  receivables_fii: "Recebíveis",
  hybrid_fii: "Híbrido",
  fof_fii: "Fundo de fundos",
  development_fii: "Desenvolvimento",
  fiagro: "Fiagro",
  infrastructure_fund: "Infraestrutura",
};

export default async function FundPage({ params }: FundPageProps) {
  const { ticker } = await params;
  const instrument = await getInstrument(ticker);
  if (!instrument) notFound();

  const [sections, documents, readiness, metrics, scenarios, risks, triggers, prices, distributions, tenants, finalReport] = await Promise.all([
    getSections(instrument.analysis_run_id),
    getDocuments(instrument.analysis_run_id),
    getReadiness(instrument.analysis_run_id),
    getMetrics(instrument.analysis_run_id),
    getValuationScenarios(instrument.analysis_run_id),
    getRisks(instrument.analysis_run_id),
    getTriggers(instrument.analysis_run_id),
    getPrices(instrument.instrument_id),
    getDistributions(instrument.analysis_run_id),
    getTopTenants(instrument.analysis_run_id),
    getFinalReport(instrument.analysis_run_id),
  ]);
  const firstComplete = readiness?.first_sections_complete ?? sections.filter((section) => section.first_pass_status === "complete").length;
  const secondComplete = readiness?.second_sections_complete ?? sections.filter((section) => section.second_pass_status === "complete").length;
  const criterionTotal = readiness?.criterion_total ?? 80;
  const firstCriteria = readiness?.first_criteria_complete ?? 0;
  const secondCriteria = readiness?.second_criteria_complete ?? 0;
  const firstPages = readiness?.first_pages_reviewed ?? documents.reduce((sum, document) => sum + (document.first_pass_pages_reviewed ?? 0), 0);
  const secondPages = readiness?.second_pages_reviewed ?? documents.reduce((sum, document) => sum + (document.second_pass_pages_reviewed ?? 0), 0);
  const pagesTotal = readiness?.pages_total ?? documents.reduce((sum, document) => sum + (document.pages_total ?? 0), 0);
  const coverage = numberValue(instrument.coverage_pct) ?? 0;
  const dimensionScores = [
    [deepMaxScoreWeights[0], instrument.income_score],
    [deepMaxScoreWeights[1], instrument.quality_score],
    [deepMaxScoreWeights[2], instrument.balance_cash_score],
    [deepMaxScoreWeights[3], instrument.management_governance_score],
    [deepMaxScoreWeights[4], instrument.value_margin_score],
    [deepMaxScoreWeights[5], instrument.technical_liquidity_score],
  ] as const;

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
                <Badge variant="outline" className="border-white/10 bg-white/4 text-slate-300">Deep Max v2.1</Badge>
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
              <p className="mt-3 text-xs leading-5 text-slate-500">Notas permanecem bloqueadas até todos os critérios, dados e fontes passarem pela dupla revisão.</p>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <Card className="gap-3 border-white/8 bg-[#0b1826] py-5 shadow-none">
            <CardContent className="px-5">
              <p className="flex items-center gap-2 text-xs text-slate-500"><Waypoints className="size-3.5 text-cyan-300" /> Perfil metodológico</p>
              <p className="mt-2 text-base font-medium text-white">{profileLabels[instrument.analysis_profile] ?? instrument.analysis_profile}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {instrument.analysis_profile_status === "verified"
                  ? "Perfil verificado; os critérios específicos podem ser aplicados."
                  : "Pendente de verificação documental. Notas, veredito e conclusão permanecem bloqueados."}
              </p>
            </CardContent>
          </Card>
        </section>

        {finalReport?.status === "complete" ? (
          <article id="relatorio-final" className="mb-6 overflow-hidden rounded-2xl border border-teal-300/15 bg-[#0b1826] shadow-xl shadow-black/10">
            <header className="border-b border-white/8 bg-[linear-gradient(135deg,rgba(20,184,166,.10),rgba(11,24,38,0)_65%)] p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-teal-300/25 bg-teal-300/8 text-teal-100"><ScrollText className="mr-1 size-3.5" /> Relatório qualitativo final</Badge>
                <Badge variant="outline" className="border-white/10 bg-white/4 text-slate-400">{finalReport.version}</Badge>
              </div>
              <h2 className="mt-5 font-serif text-3xl text-white sm:text-4xl">{finalReport.title}</h2>
              <p className="mt-5 max-w-5xl text-base leading-8 text-slate-200">{finalReport.executive_summary}</p>
            </header>

            <div className="p-6 sm:p-8">
              <section className="rounded-xl border border-teal-300/15 bg-teal-300/[0.045] p-5 sm:p-6">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-300/70">Conclusão da análise</p>
                <p className="mt-3 text-sm leading-7 text-teal-50/90">{finalReport.final_conclusion}</p>
              </section>

              <div className="mt-8 grid gap-x-10 gap-y-8 xl:grid-cols-2">
                {finalReport.sections.map((section, index) => (
                  <section key={section.code} className="border-t border-white/8 pt-5">
                    <div className="flex items-start gap-4">
                      <span className="font-mono text-xs text-teal-300/50">{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <h3 className="text-base font-semibold text-white">{section.title}</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-300">{section.content}</p>
                      </div>
                    </div>
                  </section>
                ))}
              </div>

              <div className="mt-10 grid gap-4 lg:grid-cols-3">
                <section className="rounded-xl border border-emerald-300/12 bg-emerald-300/[0.035] p-5">
                  <h3 className="text-sm font-semibold text-emerald-100">Forças da tese</h3>
                  <ul className="mt-4 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-300">{finalReport.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
                <section className="rounded-xl border border-amber-300/12 bg-amber-300/[0.035] p-5">
                  <h3 className="text-sm font-semibold text-amber-100">Fragilidades</h3>
                  <ul className="mt-4 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-300">{finalReport.weaknesses.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
                <section className="rounded-xl border border-cyan-300/12 bg-cyan-300/[0.035] p-5">
                  <h3 className="text-sm font-semibold text-cyan-100">Condições para investir</h3>
                  <ul className="mt-4 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-300">{finalReport.conditions_to_invest.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
              </div>

              {finalReport.limitations.length ? (
                <section className="mt-4 rounded-xl border border-white/7 bg-white/[0.02] p-5">
                  <h3 className="text-sm font-semibold text-white">Limitações e pontos não públicos</h3>
                  <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-400">{finalReport.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
              ) : null}
            </div>
          </article>
        ) : instrument.status === "completed" ? (
          <section className="mb-6 flex gap-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.045] p-5 text-sm leading-6 text-rose-100/90">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
            A análise quantitativa existe, mas o relatório qualitativo final ainda não foi concluído. O fundo não deve ser considerado integralmente analisado.
          </section>
        ) : null}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
          {dimensionScores.map(([dimension, scoreValue]) => (
            <Card key={dimension.code} className="gap-2 border-white/8 bg-[#0b1826] py-5 shadow-none">
              <CardContent className="px-5">
                <p className="text-xs text-slate-500">{dimension.label}</p>
                <p className="mt-1 font-mono text-2xl text-white">{showScore(scoreValue)}</p>
                <p className="mt-1 text-[11px] text-slate-600">peso {Math.round(dimension.weight * 100)}%</p>
              </CardContent>
            </Card>
          ))}
          <Card className="gap-2 border-teal-300/15 bg-teal-300/[0.045] py-5 shadow-none">
            <CardContent className="px-5">
              <p className="text-xs text-teal-200/70">Nota ponderada</p>
              <p className="mt-1 font-mono text-2xl text-white">{showScore(instrument.weighted_score)}</p>
              <p className="mt-1 text-[11px] text-slate-600">não avaliado ≠ zero</p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-white/8 bg-[#0b1826] shadow-none">
            <CardHeader>
              <CardTitle className="text-white">Veredito</CardTitle>
              <CardDescription className="text-slate-400">Conclusão de qualidade, preço e prioridade de aporte.</CardDescription>
            </CardHeader>
            <CardContent>
              {instrument.verdict_summary ? (
                <div className="space-y-4">
                  <p className="text-sm leading-7 text-slate-200">{instrument.verdict_summary}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/7 bg-white/[0.02] p-4"><p className="text-xs text-slate-500">Dinheiro novo</p><p className="mt-1 text-sm font-medium text-white">{actionLabels[instrument.action_new_money ?? ""] ?? "—"}</p></div>
                    <div className="rounded-xl border border-white/7 bg-white/[0.02] p-4"><p className="text-xs text-slate-500">Cotista atual</p><p className="mt-1 text-sm font-medium text-white">{actionLabels[instrument.action_existing_holder ?? ""] ?? "—"}</p></div>
                  </div>
                </div>
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
              <div>
                <div className="mb-2 flex justify-between text-xs text-slate-400"><span>Critérios — 1ª / 2ª</span><span>{firstCriteria}/{criterionTotal} · {secondCriteria}/{criterionTotal}</span></div>
                <Progress value={criterionTotal ? (secondCriteria / criterionTotal) * 100 : 0} className="h-1.5 bg-slate-800 [&_[data-slot=progress-indicator]]:bg-teal-300" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/7 bg-white/[0.02] px-3 py-2 text-xs">
                <span className="text-slate-400">Páginas — 1ª / 2ª</span>
                <span className="font-mono text-white">{firstPages}/{pagesTotal || "—"} · {secondPages}/{pagesTotal || "—"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/7 bg-white/[0.02] px-3 py-2 text-xs">
                <span className="text-slate-400">Prontidão do banco</span>
                <span className="font-medium text-white">{readiness?.completion_ready ? "completa" : readiness?.research_exhausted ? "dados insuficientes" : "bloqueada"}</span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-300/70">Escopo completo</p>
              <h2 className="mt-1 text-xl font-semibold text-white">16 blocos e {criterionTotal} critérios da análise</h2>
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
                      <details className="group mt-4 text-xs leading-5 text-slate-400">
                        <summary className="cursor-pointer list-none text-teal-200/80">Abrir análise completa</summary>
                        <p className="mt-3 whitespace-pre-line">{section.narrative}</p>
                        {Array.isArray(section.findings) && section.findings.length > 0 ? <ul className="mt-3 list-disc space-y-1 pl-4">{section.findings.map((finding, findingIndex) => <li key={findingIndex}>{String(finding)}</li>)}</ul> : null}
                      </details>
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
                      <div>{document.source_url ? <a href={document.source_url} target="_blank" rel="noreferrer" className="text-white hover:text-teal-200">{document.title}</a> : <p className="text-white">{document.title}</p>}<p className="mt-1 text-xs text-slate-500">{document.competence_date ?? "sem competência"}</p></div>
                      <span className="font-mono text-xs text-slate-400">{document.first_pass_pages_reviewed ?? 0}/{document.pages_total ?? "—"} · {document.second_pass_pages_reviewed ?? 0}/{document.pages_total ?? "—"}</span>
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
              <CardTitle className="text-white">Números fundamentais</CardTitle>
              <CardDescription className="text-slate-400">Data de corte {instrument.as_of_date ?? "—"}; números reconciliados com fontes oficiais.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Preço de corte", instrument.current_price === null ? null : money.format(Number(instrument.current_price))],
                  ["Valor justo base", instrument.fair_value_base === null ? null : money.format(Number(instrument.fair_value_base))],
                  ["Renda sustentável", instrument.sustainable_income_per_share === null ? null : money.format(Number(instrument.sustainable_income_per_share))],
                  ["Risco / confiança", `${showScore(instrument.risk_score)} / ${showScore(instrument.confidence_score)}`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-white/7 bg-white/[0.02] p-4">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-2 font-mono text-base text-white">{value ?? "—"}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {metrics.filter((metric) => metricLabels[metric.metric_code]).map((metric) => {
                  const [label, unit] = metricLabels[metric.metric_code];
                  const value = numberValue(metric.value_numeric);
                  return <div key={metric.metric_code} className="rounded-xl border border-white/7 bg-white/[0.02] p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-mono text-sm text-white">{value === null ? metric.value_text ?? "—" : unit === "R$" ? money.format(value) : `${percent.format(value)}${unit}`}</p></div>;
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        {scenarios.length ? <section className="mb-6">
          <div className="mb-4"><p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-300/70">Valuation independente</p><h2 className="mt-1 text-xl font-semibold text-white">Três cenários e contramodelo patrimonial</h2></div>
          <div className="grid gap-4 lg:grid-cols-3">{scenarios.map((scenario) => <Card key={scenario.scenario_code} className={`border-white/8 bg-[#0b1826] shadow-none ${scenario.scenario_code === "base" ? "ring-1 ring-teal-300/30" : ""}`}><CardHeader><CardTitle className="capitalize text-white">{scenario.scenario_code === "pessimistic" ? "Pessimista" : scenario.scenario_code === "optimistic" ? "Otimista" : "Base"}</CardTitle><CardDescription className="text-slate-400">Probabilidade julgada: {percent.format(Number(scenario.probability_pct ?? 0))}%</CardDescription></CardHeader><CardContent className="space-y-3"><p className="font-mono text-3xl text-white">{money.format(Number(scenario.fair_value_per_share))}</p><div className="grid grid-cols-2 gap-2 text-xs"><div><p className="text-slate-500">Renda/mês</p><p className="mt-1 text-white">{money.format(Number(scenario.expected_income_per_share ?? 0))}</p></div><div><p className="text-slate-500">Retorno 12m</p><p className="mt-1 text-white">{percent.format(Number(scenario.expected_total_return_pct ?? 0))}%</p></div></div><p className="text-xs leading-5 text-slate-400">{scenario.notes}</p><p className="text-[11px] text-slate-600">Contramodelo: {scenario.counter_model_method} → {scenario.counter_model_value_per_share ? money.format(Number(scenario.counter_model_value_per_share)) : "—"}</p></CardContent></Card>)}</div>
        </section> : null}

        {prices.length && distributions.length ? <section className="mb-6"><FundAnalysisCharts prices={prices} distributions={distributions} /></section> : null}

        <section className="mb-6 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <Card className="border-white/8 bg-[#0b1826] shadow-none"><CardHeader><CardTitle className="text-white">Riscos e testes de estresse</CardTitle><CardDescription className="text-slate-400">Ordenados por impacto e probabilidade; nenhum risco foi compensado silenciosamente por uma qualidade.</CardDescription></CardHeader><CardContent className="space-y-3">{risks.map((risk) => <details key={risk.risk_code} className="rounded-xl border border-white/7 bg-white/[0.02] p-4"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-4"><span className="text-sm font-medium text-white">{risk.category}</span><span className="font-mono text-xs text-amber-200">P{risk.probability_score} · I{risk.impact_score}</span></div><p className="mt-2 text-xs leading-5 text-slate-400">{risk.description}</p></summary><div className="mt-3 space-y-2 border-t border-white/7 pt-3 text-xs leading-5 text-slate-400"><p><span className="text-slate-200">Sinais:</span> {risk.warning_signals}</p><p><span className="text-slate-200">Mitigadores:</span> {risk.mitigants}</p><p><span className="text-slate-200">Estresse:</span> {risk.stress_test_result}</p></div></details>)}</CardContent></Card>
          <div className="space-y-5"><Card className="border-white/8 bg-[#0b1826] shadow-none"><CardHeader><CardTitle className="text-white">Gatilhos da tese</CardTitle></CardHeader><CardContent className="space-y-2">{triggers.map((trigger) => <div key={trigger.trigger_code} className="rounded-lg border border-white/7 bg-white/[0.02] p-3"><p className="text-[11px] uppercase tracking-wide text-teal-300/70">{trigger.trigger_type}</p><p className="mt-1 text-xs leading-5 text-slate-300">{trigger.description}</p></div>)}</CardContent></Card><Card className="border-white/8 bg-[#0b1826] shadow-none"><CardHeader><CardTitle className="text-white">Maiores locatários</CardTitle></CardHeader><CardContent className="space-y-2">{tenants.map((tenant) => <div key={tenant.name} className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-300">{tenant.name}</span><span className="font-mono text-white">{percent.format(Number(tenant.revenue_share_pct ?? 0))}%</span></div>)}</CardContent></Card></div>
        </section>
      </main>
    </div>
  );
}
