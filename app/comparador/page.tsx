import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, GitCompareArrows, Info, Scale } from "lucide-react";

import { SafaHeader } from "@/components/safa-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFinalReport, getQueue, numberValue, type FinalAnalysisReport, type QueueItem } from "@/lib/safa-data";

export const dynamic = "force-dynamic";

type ComparatorProps = {
  searchParams?: Promise<{ a?: string; b?: string }>;
};

function normalizedChoice(value: string | undefined, fallback: string) {
  const clean = (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean || fallback;
}

function show(value: number | string | null, suffix = "") {
  const parsed = numberValue(value);
  return parsed === null ? "—" : `${parsed.toFixed(1)}${suffix}`;
}

const actionLabels: Record<string, string> = {
  buy: "Comprar",
  buy_in_tranches: "Comprar em parcelas",
  wait: "Esperar",
  avoid: "Evitar",
  increase: "Aumentar",
  hold: "Manter",
  reduce: "Reduzir",
  sell: "Vender",
  insufficient_data: "Dados insuficientes",
};

function showAction(value: string | null) {
  return value ? (actionLabels[value] ?? value) : "—";
}

function ComparisonRow({
  label,
  left,
  right,
  detail,
}: {
  label: string;
  left: string;
  right: string;
  detail?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_1.15fr_1fr] items-center border-t border-white/6 px-4 py-4 text-sm sm:px-6">
      <p className="text-center font-mono text-base text-white">{left}</p>
      <div className="px-3 text-center">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        {detail && <p className="mt-1 hidden text-[10px] leading-4 text-slate-600 sm:block">{detail}</p>}
      </div>
      <p className="text-center font-mono text-base text-white">{right}</p>
    </div>
  );
}

function Verdict({ item }: { item: QueueItem }) {
  return item.verdict_summary ? (
    <p className="text-sm leading-6 text-slate-300">{item.verdict_summary}</p>
  ) : (
    <p className="text-sm leading-6 text-slate-500">Aguardando conclusão das duas passagens.</p>
  );
}

function QualitativeDecision({ ticker, report }: { ticker: string; report: FinalAnalysisReport | null }) {
  if (!report || report.status !== "complete") {
    return <p className="p-6 text-sm leading-6 text-slate-500">Relatório qualitativo ainda não concluído.</p>;
  }

  return (
    <article className="p-6 sm:p-7">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-teal-300/70">Tese de {ticker}</p>
      <h3 className="mt-3 font-serif text-2xl text-white">Conclusão que orienta a decisão</h3>
      <p className="mt-4 text-sm leading-7 text-slate-300">{report.final_conclusion}</p>

      <div className="mt-7 grid gap-6 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
        <section>
          <p className="flex items-center gap-2 text-xs font-medium text-emerald-200"><CheckCircle2 className="size-4" /> Forças que sustentam a tese</p>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
            {report.strengths.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </section>
        <section>
          <p className="flex items-center gap-2 text-xs font-medium text-amber-200"><AlertTriangle className="size-4" /> Fragilidades que podem mudar o veredito</p>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
            {report.weaknesses.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </section>
      </div>

      <section className="mt-7 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4">
        <p className="text-xs font-medium text-cyan-100">Condições para aportar</p>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
          {report.conditions_to_invest.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
        </ul>
      </section>
    </article>
  );
}

export default async function Comparator({ searchParams }: ComparatorProps) {
  const params = (await searchParams) ?? {};
  const queue = await getQueue();
  if (!queue.length) return null;

  const tickerA = normalizedChoice(params.a, queue[0].ticker);
  const tickerB = normalizedChoice(params.b, queue[1]?.ticker ?? queue[0].ticker);
  const left = queue.find((item) => item.ticker === tickerA) ?? queue[0];
  const right = queue.find((item) => item.ticker === tickerB) ?? queue[1] ?? queue[0];
  const [leftReport, rightReport] = await Promise.all([
    getFinalReport(left.analysis_run_id),
    getFinalReport(right.analysis_run_id),
  ]);
  const leftWeighted = numberValue(left.weighted_score);
  const rightWeighted = numberValue(right.weighted_score);
  const comparisonDimensions = [
    ["renda sustentável", numberValue(left.income_score), numberValue(right.income_score)],
    ["qualidade dos ativos", numberValue(left.quality_score), numberValue(right.quality_score)],
    ["balanço e caixa", numberValue(left.balance_cash_score), numberValue(right.balance_cash_score)],
    ["gestão e governança", numberValue(left.management_governance_score), numberValue(right.management_governance_score)],
    ["valor e margem", numberValue(left.value_margin_score), numberValue(right.value_margin_score)],
    ["técnico e liquidez", numberValue(left.technical_liquidity_score), numberValue(right.technical_liquidity_score)],
  ] as const;
  const largestEdge = comparisonDimensions
    .filter(([, a, b]) => a !== null && b !== null)
    .sort((a, b) => Math.abs((b[1] ?? 0) - (b[2] ?? 0)) - Math.abs((a[1] ?? 0) - (a[2] ?? 0)))[0];
  const leader = leftWeighted !== null && rightWeighted !== null
    ? (leftWeighted >= rightWeighted ? left : right)
    : null;
  const scoreGap = leftWeighted !== null && rightWeighted !== null ? Math.abs(leftWeighted - rightWeighted) : null;

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <SafaHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="size-4" /> Voltar ao painel
        </Link>

        <section className="mb-6 rounded-2xl border border-white/8 bg-[linear-gradient(135deg,rgba(15,31,49,.97),rgba(7,21,34,.94))] p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-300/70">Comparativo Deep Max</p>
              <h1 className="mt-2 font-serif text-3xl text-white sm:text-4xl">Coloque as teses lado a lado.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">O comparador revela diferenças; ele não preenche lacunas com notas artificiais.</p>
            </div>
            <GitCompareArrows className="hidden size-10 text-teal-300/40 lg:block" />
          </div>
        </section>

        <Card className="mb-6 border-white/8 bg-[#0b1826] shadow-none">
          <CardHeader>
            <CardTitle className="text-white">Escolha dois fundos</CardTitle>
            <CardDescription className="text-slate-400">A comparação completa aparecerá conforme as análises forem concluídas.</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="get" action="/comparador" className="grid gap-4 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
              <label className="grid gap-2 text-xs text-slate-400">
                Fundo A
                <select name="a" defaultValue={left.ticker} className="h-11 rounded-lg border border-white/10 bg-[#07131f] px-3 text-sm text-white outline-none focus:border-teal-300/40">
                  {queue.map((item) => <option key={item.ticker} value={item.ticker}>{item.ticker}</option>)}
                </select>
              </label>
              <Scale className="mb-3 hidden size-4 text-slate-600 sm:block" />
              <label className="grid gap-2 text-xs text-slate-400">
                Fundo B
                <select name="b" defaultValue={right.ticker} className="h-11 rounded-lg border border-white/10 bg-[#07131f] px-3 text-sm text-white outline-none focus:border-teal-300/40">
                  {queue.map((item) => <option key={item.ticker} value={item.ticker}>{item.ticker}</option>)}
                </select>
              </label>
              <Button type="submit" className="h-11 bg-teal-300 text-[#06121d] hover:bg-teal-200">Comparar</Button>
            </form>
          </CardContent>
        </Card>

        <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#0b1826]">
          <div className="grid grid-cols-[1fr_1.15fr_1fr] items-stretch bg-white/[0.02]">
            {[left, null, right].map((item, index) => item ? (
              <div key={item.ticker} className="p-5 text-center sm:p-6">
                <StatusPill status={item.status} />
                <h2 className="mt-3 text-xl font-semibold text-white sm:text-2xl">{item.ticker}</h2>
                <Link href={`/fundos/${item.ticker}`} className="mt-2 inline-flex items-center gap-1 text-xs text-teal-200 hover:text-teal-100">Abrir ficha <ArrowRight className="size-3" /></Link>
              </div>
            ) : (
              <div key={`center-${index}`} className="grid place-items-center border-x border-white/6 px-3 text-center text-xs font-medium uppercase tracking-[0.16em] text-slate-600">Indicador</div>
            ))}
          </div>

          <ComparisonRow label="Renda sustentável · 25%" left={show(left.income_score)} right={show(right.income_score)} detail="Recorrência, cobertura e previsibilidade" />
          <ComparisonRow label="Qualidade dos ativos · 20%" left={show(left.quality_score)} right={show(right.quality_score)} detail="Imóveis, localização, concentração e obsolescência" />
          <ComparisonRow label="Balanço e caixa · 20%" left={show(left.balance_cash_score)} right={show(right.balance_cash_score)} detail="Dívida, liquidez, compromissos e resiliência" />
          <ComparisonRow label="Gestão e governança · 15%" left={show(left.management_governance_score)} right={show(right.management_governance_score)} detail="Alocação de capital, conflitos e execução" />
          <ComparisonRow label="Valor e margem · 15%" left={show(left.value_margin_score)} right={show(right.value_margin_score)} detail="Três cenários, contramodelo e preço de entrada" />
          <ComparisonRow label="Técnico e liquidez · 5%" left={show(left.technical_liquidity_score)} right={show(right.technical_liquidity_score)} detail="Histórico, volume, tendência e pontos técnicos" />
          <ComparisonRow label="Nota ponderada" left={show(left.weighted_score)} right={show(right.weighted_score)} detail="Calculada pelo banco; não pode ser digitada manualmente" />
          <ComparisonRow label="Risco" left={show(left.risk_score)} right={show(right.risk_score)} detail="Exibido separadamente; menor não é automaticamente melhor" />
          <ComparisonRow label="Confiança da análise" left={show(left.confidence_score)} right={show(right.confidence_score)} detail="Cobertura e consistência dos dados disponíveis" />
          <ComparisonRow label="Preço atual" left={show(left.current_price, "")} right={show(right.current_price, "")} />
          <ComparisonRow label="Valor justo base" left={show(left.fair_value_base, "")} right={show(right.fair_value_base, "")} />
          <ComparisonRow label="Ação para dinheiro novo" left={showAction(left.action_new_money)} right={showAction(right.action_new_money)} />
          <ComparisonRow label="Ação para cotista atual" left={showAction(left.action_existing_holder)} right={showAction(right.action_existing_holder)} />

          <div className="grid gap-0 border-t border-white/6 md:grid-cols-2">
            <div className="border-b border-white/6 p-6 md:border-b-0 md:border-r"><p className="mb-2 text-xs font-medium text-teal-300/70">Veredito de {left.ticker}</p><Verdict item={left} /></div>
            <div className="p-6"><p className="mb-2 text-xs font-medium text-teal-300/70">Veredito de {right.ticker}</p><Verdict item={right} /></div>
          </div>
        </section>

        {leader && scoreGap !== null && left.ticker !== right.ticker && (
          <section className="mt-6 rounded-2xl border border-teal-300/15 bg-[linear-gradient(135deg,rgba(20,184,166,.08),rgba(11,24,38,.96)_62%)] p-6 sm:p-7">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-teal-300/70">O que decide a comparação</p>
            <p className="mt-3 text-base leading-7 text-slate-200">
              <strong className="text-white">{leader.ticker} lidera por {scoreGap.toFixed(2)} ponto{scoreGap === 1 ? "" : "s"}</strong> na nota ponderada.
              {largestEdge ? ` A maior diferença entre os seis pilares está em ${largestEdge[0]}.` : ""}
              {` Para dinheiro novo, a conclusão é ${showAction(leader.action_new_money).toLowerCase()}; o outro fundo permanece em ${showAction(leader.ticker === left.ticker ? right.action_new_money : left.action_new_money).toLowerCase()}.`}
            </p>
          </section>
        )}

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-[#0b1826]">
          <header className="border-b border-white/8 p-6 sm:p-7">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-teal-300/70">Comparação qualitativa</p>
            <h2 className="mt-2 font-serif text-3xl text-white">Números mostram a diferença; as teses explicam por quê.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Forças, fragilidades e condições vêm do relatório final de cada fundo, depois das duas leituras integrais.</p>
          </header>
          <div className="grid divide-y divide-white/8 md:grid-cols-2 md:divide-x md:divide-y-0">
            <QualitativeDecision ticker={left.ticker} report={leftReport} />
            <QualitativeDecision ticker={right.ticker} report={rightReport} />
          </div>
        </section>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-300/12 bg-amber-300/[0.045] p-4 text-sm leading-6 text-amber-100/90">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-300" />
          Traços significam dados ainda não avaliados. O SAFA não transforma ausência de informação em nota zero ou média automática.
        </div>
      </main>
    </div>
  );
}
