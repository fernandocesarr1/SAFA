import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleDashed,
  Database,
  FileText,
  Gauge,
  History,
  LockKeyhole,
  Waypoints,
} from "lucide-react";

import { SafaHeader } from "@/components/safa-header";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  deepMaxDocumentMinimums,
  deepMaxSections,
  getDeepMaxSection,
} from "@/lib/deep-max-methodology";
import {
  getDocuments,
  getQueue,
  getReadiness,
  getSections,
  numberValue,
} from "@/lib/safa-data";

export const dynamic = "force-dynamic";

type OperationPageProps = {
  searchParams?: Promise<{ ticker?: string }>;
};

const completeDocumentStatuses = new Set(["complete", "unavailable"]);

function normalizedTicker(value: string | undefined, fallback: string) {
  const clean = (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean || fallback;
}

function value(value: number | string | null | undefined) {
  return numberValue(value) ?? 0;
}

function percentage(done: number, total: number) {
  return total ? Math.min(100, (done / total) * 100) : 0;
}

function PassState({ status }: { status: string | undefined }) {
  const complete = status === "complete";
  const blocked = status === "blocked";
  const active = status === "in_progress" || status === "reading";
  const label = complete ? "Concluída" : blocked ? "Bloqueada" : active ? "Em curso" : "Pendente";
  const classes = complete
    ? "border-emerald-300/20 bg-emerald-300/8 text-emerald-200"
    : blocked
      ? "border-rose-300/20 bg-rose-300/8 text-rose-200"
      : active
        ? "border-cyan-300/20 bg-cyan-300/8 text-cyan-200"
        : "border-white/10 bg-white/4 text-slate-400";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${classes}`}>{label}</span>;
}

function GateCard({
  label,
  detail,
  complete,
  icon: Icon,
}: {
  label: string;
  detail: string;
  complete: boolean;
  icon: typeof CheckCircle2;
}) {
  return (
    <div className={`rounded-xl border p-4 ${complete ? "border-emerald-300/16 bg-emerald-300/[0.045]" : "border-white/7 bg-white/[0.02]"}`}>
      <div className="flex items-start gap-3">
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${complete ? "bg-emerald-300/10 text-emerald-200" : "bg-white/5 text-slate-500"}`}>
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
        </div>
      </div>
    </div>
  );
}

export default async function OperationPage({ searchParams }: OperationPageProps) {
  const params = (await searchParams) ?? {};
  const queue = await getQueue();
  if (!queue.length) return null;

  const ticker = normalizedTicker(params.ticker, queue[0].ticker);
  const selected = queue.find((item) => item.ticker === ticker) ?? queue[0];
  const [sections, documents, readiness] = await Promise.all([
    getSections(selected.analysis_run_id),
    getDocuments(selected.analysis_run_id),
    getReadiness(selected.analysis_run_id),
  ]);

  const sectionTotal = readiness ? value(readiness.section_total) : sections.length;
  const firstSections = readiness
    ? value(readiness.first_sections_complete)
    : sections.filter((section) => section.first_pass_status === "complete").length;
  const secondSections = readiness
    ? value(readiness.second_sections_complete)
    : sections.filter((section) => section.second_pass_status === "complete").length;
  const criterionTotal = readiness ? value(readiness.criterion_total) : deepMaxSections.length * 5;
  const firstCriteria = readiness ? value(readiness.first_criteria_complete) : 0;
  const secondCriteria = readiness ? value(readiness.second_criteria_complete) : 0;
  const documentScopeTotal = readiness ? value(readiness.document_scope_total) : 9;
  const documentScopes = readiness ? value(readiness.document_scopes_complete) : 0;
  const dataScopeTotal = readiness ? value(readiness.data_scope_total) : 8;
  const dataScopes = readiness ? value(readiness.data_scopes_complete) : 0;
  const documentsTotal = readiness ? value(readiness.documents_total) : documents.length;
  const firstDocuments = readiness
    ? value(readiness.first_documents_complete)
    : documents.filter((document) => completeDocumentStatuses.has(document.first_pass_status ?? "pending")).length;
  const secondDocuments = readiness
    ? value(readiness.second_documents_complete)
    : documents.filter((document) => completeDocumentStatuses.has(document.second_pass_status ?? "pending")).length;
  const managementReports = readiness
    ? value(readiness.management_reports)
    : documents.filter((document) => document.document_type === "management_report").length;
  const managementCompetencies = readiness ? value(readiness.management_unique_competencies) : 0;
  const auditedYears = readiness ? value(readiness.audited_financial_years) : 0;
  const regulations = readiness
    ? value(readiness.regulations)
    : documents.filter((document) => document.document_type === "regulation").length;
  const distributions = readiness ? value(readiness.distribution_count) : 0;
  const classifiedDistributions = readiness ? value(readiness.classified_distribution_count) : 0;
  const distributionSpan = readiness ? value(readiness.distribution_span_days) : 0;
  const prices = readiness ? value(readiness.price_count) : 0;
  const priceSpan = readiness ? value(readiness.price_span_days) : 0;
  const requiredMetrics = readiness ? value(readiness.required_metric_count) : deepMaxDocumentMinimums.universalMetrics;
  const verifiedMetrics = readiness ? value(readiness.verified_required_metric_count) : 0;
  const propertyCount = readiness ? value(readiness.property_count) : 0;
  const tenantCount = readiness ? value(readiness.tenant_count) : 0;
  const leaseCount = readiness ? value(readiness.lease_count) : 0;
  const debtCount = readiness ? value(readiness.debt_count) : 0;
  const scenarioCount = readiness ? value(readiness.valuation_scenario_count) : 0;
  const assumptionCount = readiness ? value(readiness.valuation_assumption_count) : 0;
  const counterModelCount = readiness ? value(readiness.counter_model_count) : 0;
  const riskCount = readiness ? value(readiness.risk_count) : 0;
  const triggerTypeCount = readiness ? value(readiness.thesis_trigger_type_count) : 0;
  const pagesTotal = readiness ? value(readiness.pages_total) : documents.reduce((sum, document) => sum + (document.pages_total ?? 0), 0);
  const firstPages = readiness ? value(readiness.first_pages_reviewed) : documents.reduce((sum, document) => sum + (document.first_pass_pages_reviewed ?? 0), 0);
  const secondPages = readiness ? value(readiness.second_pages_reviewed) : documents.reduce((sum, document) => sum + (document.second_pass_pages_reviewed ?? 0), 0);

  const eligibilityComplete = Boolean(readiness?.eligibility_ready);
  const scopesComplete =
    documentScopeTotal === 9 && documentScopes === documentScopeTotal &&
    dataScopeTotal === 8 && dataScopes === dataScopeTotal;
  const documentsCatalogued =
    managementCompetencies >= deepMaxDocumentMinimums.uniqueManagementCompetencies &&
    auditedYears >= deepMaxDocumentMinimums.auditedFinancialYears &&
    regulations >= deepMaxDocumentMinimums.regulations;
  const documentPassesComplete =
    documentsTotal > 0 &&
    firstDocuments === documentsTotal &&
    secondDocuments === documentsTotal &&
    (pagesTotal === 0 || (firstPages >= pagesTotal && secondPages >= pagesTotal));
  const historyComplete =
    distributions >= deepMaxDocumentMinimums.distributions &&
    classifiedDistributions >= deepMaxDocumentMinimums.classifiedDistributions &&
    distributionSpan >= 1035;
  const pricesComplete = prices >= deepMaxDocumentMinimums.pricePoints && priceSpan >= 1090;
  const metricsComplete = requiredMetrics >= deepMaxDocumentMinimums.universalMetrics && verifiedMetrics === requiredMetrics;
  const firstPassComplete = sectionTotal === deepMaxSections.length && firstSections === sectionTotal;
  const secondPassComplete = sectionTotal === deepMaxSections.length && secondSections === sectionTotal;
  const criteriaComplete = criterionTotal >= 80 && firstCriteria === criterionTotal && secondCriteria === criterionTotal;
  const structuredComplete =
    propertyCount > 0 && tenantCount > 0 && leaseCount > 0 &&
    (debtCount > 0 || Boolean(readiness?.debt_scope_not_applicable)) &&
    scenarioCount === deepMaxDocumentMinimums.valuationScenarios &&
    assumptionCount >= deepMaxDocumentMinimums.valuationAssumptions &&
    counterModelCount >= 1 && riskCount >= deepMaxDocumentMinimums.risks &&
    triggerTypeCount >= deepMaxDocumentMinimums.thesisTriggers;
  const finalFieldsComplete =
    selected.verdict !== null &&
    selected.quality_score !== null &&
    selected.income_score !== null &&
    selected.balance_cash_score !== null &&
    selected.management_governance_score !== null &&
    selected.value_margin_score !== null &&
    selected.technical_liquidity_score !== null &&
    selected.weighted_score !== null &&
    selected.risk_score !== null &&
    selected.confidence_score !== null &&
    selected.action_new_money !== null &&
    selected.action_existing_holder !== null;
  const profileComplete = selected.analysis_profile_status === "verified" && selected.analysis_profile !== "unclassified";

  const gates = [
    {
      label: "Perfil metodológico verificado",
      detail: profileComplete
        ? `Perfil ${selected.analysis_profile} confirmado por fonte e data.`
        : "Primeiro, confirmar se o fundo é tijolo, recebíveis, híbrido, desenvolvimento, agro ou infraestrutura.",
      complete: profileComplete,
      icon: Waypoints,
    },
    {
      label: "Acesso do investidor comum verificado",
      detail: eligibilityComplete ? "Mercado, regulador, público-alvo e recência confirmados." : "Faltam duas fontes e verificação recente de elegibilidade.",
      complete: eligibilityComplete,
      icon: CheckCircle2,
    },
    {
      label: "Catálogos de escopo esgotados",
      detail: `${documentScopes}/${documentScopeTotal} escopos documentais · ${dataScopes}/${dataScopeTotal} escopos estruturados`,
      complete: scopesComplete,
      icon: FileText,
    },
    {
      label: "Histórico documental mínimo",
      detail: `${managementCompetencies}/6 competências gerenciais · ${auditedYears}/3 exercícios auditados · ${regulations}/1 regulamento · ${managementReports} relatórios catalogados`,
      complete: documentsCatalogued,
      icon: BookOpenCheck,
    },
    {
      label: "Documentos lidos duas vezes",
      detail: `${firstDocuments}/${documentsTotal} na primeira leitura · ${secondDocuments}/${documentsTotal} na releitura · ${firstPages}/${pagesTotal || "—"} e ${secondPages}/${pagesTotal || "—"} páginas`,
      complete: documentPassesComplete,
      icon: FileText,
    },
    {
      label: "Históricos quantitativos suficientes",
      detail: `${classifiedDistributions}/36 distribuições classificadas · ${prices}/750 pregões · ${verifiedMetrics}/${requiredMetrics} métricas verificadas`,
      complete: historyComplete && pricesComplete && metricsComplete,
      icon: History,
    },
    {
      label: "Primeira passagem integral",
      detail: `${firstSections}/${sectionTotal || deepMaxSections.length} áreas · ${firstCriteria}/${criterionTotal} critérios`,
      complete: firstPassComplete && firstCriteria === criterionTotal,
      icon: Database,
    },
    {
      label: "Segunda passagem crítica",
      detail: `${secondSections}/${sectionTotal || deepMaxSections.length} áreas · ${secondCriteria}/${criterionTotal} critérios`,
      complete: secondPassComplete && criteriaComplete,
      icon: Gauge,
    },
    {
      label: "Dados específicos do perfil e contramodelo",
      detail: profileComplete
        ? `${propertyCount} imóveis · ${tenantCount} locatários · ${leaseCount} contratos · ${scenarioCount}/3 cenários · ${assumptionCount}/12 premissas · ${riskCount}/5 riscos`
        : "A régua estruturada correta só é ativada após a classificação metodológica.",
      complete: profileComplete && structuredComplete,
      icon: Database,
    },
    {
      label: "Veredito e notas liberados",
      detail: finalFieldsComplete ? "Conclusão preenchida após todos os bloqueios." : "Permanece bloqueado até o esgotamento das etapas anteriores.",
      complete: profileComplete && finalFieldsComplete && Boolean(readiness?.completion_ready),
      icon: LockKeyhole,
    },
  ];
  const gatesComplete = gates.filter((gate) => gate.complete).length;
  const operationalReadiness = percentage(gatesComplete, gates.length);

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <SafaHeader />
      <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="mb-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-2xl border border-white/8 bg-[linear-gradient(135deg,rgba(15,31,49,.97),rgba(7,21,34,.94))] p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-teal-300/25 bg-teal-300/8 text-teal-100">Central operacional</Badge>
                  <StatusPill status={selected.status} />
                  <Badge variant="outline" className="border-white/10 bg-white/4 text-slate-300">Fila #{selected.queue_position ?? "—"}</Badge>
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-300/75">Análise ativa</p>
                <h1 className="mt-2 font-serif text-4xl text-white sm:text-5xl">{selected.ticker}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  Controle de esgotamento da análise Deep Max. A fila indica ordem de trabalho, não qualidade nem recomendação.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline" className="border-white/12 bg-white/4 text-white hover:bg-white/8">
                  <Link href={`/fundos/${selected.ticker}`}>Abrir ficha pública</Link>
                </Button>
                <Button asChild className="bg-teal-300 text-[#06121d] hover:bg-teal-200">
                  <Link href={`/comparador?a=${selected.ticker}&b=${queue.find((item) => item.ticker !== selected.ticker)?.ticker ?? selected.ticker}`}>
                    Comparar <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <Card className="border-white/8 bg-[#0b1826] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base text-white">
                Prontidão operacional
                <span className="font-mono text-2xl text-teal-200">{operationalReadiness.toFixed(0)}%</span>
              </CardTitle>
              <CardDescription className="text-slate-400">{gatesComplete}/{gates.length} bloqueios satisfeitos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Progress value={operationalReadiness} className="h-2.5 bg-slate-800 [&_[data-slot=progress-indicator]]:bg-teal-300" />
              <form method="get" action="/operacao" className="grid gap-2">
                <label htmlFor="ticker" className="text-xs text-slate-500">Fundo na mesa</label>
                <div className="flex gap-2">
                  <select id="ticker" name="ticker" defaultValue={selected.ticker} className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#07131f] px-3 text-sm text-white outline-none focus:border-teal-300/40">
                    {queue.map((item) => <option key={item.ticker} value={item.ticker}>{item.ticker}</option>)}
                  </select>
                  <Button type="submit" variant="outline" className="border-white/12 bg-white/4 text-white hover:bg-white/8">Abrir</Button>
                </div>
              </form>
              <div className="flex gap-3 rounded-xl border border-amber-300/12 bg-amber-300/[0.045] p-4 text-xs leading-5 text-amber-100/90">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
                {!profileComplete
                  ? "Perfil metodológico pendente. O banco bloqueia notas e veredito até a classificação ser confirmada com fonte e data."
                  : readiness?.research_exhausted && !readiness.completion_ready
                  ? "A pesquisa foi esgotada, mas há evidência crítica indisponível: só é permitida a conclusão sem notas como dados insuficientes."
                  : readiness?.completion_ready
                    ? "Todos os bloqueios estão satisfeitos; notas e veredito podem ser registrados para esta data-base."
                    : "Ausência de dado não vira zero nem média presumida. O bloqueio permanece aberto até a pesquisa ser esgotada."}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-6">
          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-300/70">Bloqueios de conclusão</p>
            <h2 className="mt-1 text-xl font-semibold text-white">O que ainda impede o veredito</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {gates.map((gate) => <GateCard key={gate.label} {...gate} />)}
          </div>
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border border-white/8 bg-[#0b1826]">
          <div className="border-b border-white/7 px-5 py-5 sm:px-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-300/70">Comparativo Deep Max</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Matriz de esgotamento</h2>
            <p className="mt-1 text-sm text-slate-400">As duas colunas representam trabalhos diferentes: construir a tese e depois tentar refutá-la.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-white/[0.02] text-left text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-6 py-3">Área</th>
                  <th className="px-4 py-3">Escopo obrigatório</th>
                  <th className="px-4 py-3">Primeira passagem</th>
                  <th className="px-4 py-3">Segunda passagem</th>
                  <th className="px-6 py-3 text-center">Nota</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section, index) => {
                  const definition = getDeepMaxSection(section.section_code);
                  return (
                    <tr key={section.id} className="border-t border-white/6 align-top">
                      <td className="px-6 py-4">
                        <div className="flex gap-3">
                          <span className="mt-0.5 font-mono text-xs text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                          <div>
                            <p className="font-medium text-white">{section.title}</p>
                            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{definition?.purpose}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <details className="group max-w-md">
                          <summary className="cursor-pointer list-none text-xs font-medium text-teal-200 hover:text-teal-100">
                            {definition?.criteria.length ?? 0} verificações obrigatórias
                          </summary>
                          <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
                            {definition?.criteria.map((criterion) => <li key={criterion} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-teal-300/60" />{criterion}</li>)}
                          </ul>
                        </details>
                      </td>
                      <td className="px-4 py-4"><PassState status={section.first_pass_status} /></td>
                      <td className="px-4 py-4"><PassState status={section.second_pass_status} /></td>
                      <td className="px-6 py-4 text-center font-mono text-slate-300">{section.score === null ? "—" : value(section.score).toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#0b1826]">
          <div className="flex flex-col gap-3 border-b border-white/7 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-300/70">Controle página por página</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Documentos da análise</h2>
              <p className="mt-1 text-sm text-slate-400">A URL é apenas referência; o SAFA guarda conclusões e contagens, não cópias dos arquivos públicos.</p>
            </div>
            <p className="font-mono text-xs text-slate-500">{documentsTotal} documentos · {pagesTotal || 0} páginas</p>
          </div>

          {documents.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-white/[0.02] text-left text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Documento</th>
                    <th className="px-4 py-3">Competência</th>
                    <th className="px-4 py-3">Páginas</th>
                    <th className="px-4 py-3">1ª leitura</th>
                    <th className="px-6 py-3">2ª leitura</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id} className="border-t border-white/6">
                      <td className="px-6 py-4">
                        {document.source_url ? <a href={document.source_url} target="_blank" rel="noreferrer" className="font-medium text-white hover:text-teal-200">{document.title}</a> : <p className="font-medium text-white">{document.title}</p>}
                        <p className="mt-1 text-xs text-slate-500">{document.document_type}</p>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-400">{document.competence_date ?? "—"}</td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-400">{document.pages_total ?? "—"}</td>
                      <td className="px-4 py-4"><PassState status={document.first_pass_status} /></td>
                      <td className="px-6 py-4"><PassState status={document.second_pass_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid place-items-center px-6 py-14 text-center">
              <CircleDashed className="size-8 text-slate-600" />
              <p className="mt-4 text-sm font-medium text-white">Nenhum documento cadastrado</p>
              <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">O primeiro avanço real do {selected.ticker} será registrar os seis relatórios gerenciais mais recentes e o restante do escopo obrigatório.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
