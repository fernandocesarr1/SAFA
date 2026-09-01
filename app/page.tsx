import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleDashed,
  Database,
  FileSearch,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { SafaHeader } from "@/components/safa-header";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCurrentRanking, getQueue, getUniverseStats, numberValue } from "@/lib/safa-data";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<{ q?: string }>;
};

function score(value: number | string | null) {
  const parsed = numberValue(value);
  return parsed === null ? "—" : parsed.toFixed(1);
}

export default async function Home({ searchParams }: HomeProps) {
  const params = (await searchParams) ?? {};
  const query = (params.q ?? "").trim().toUpperCase();
  const [queue, ranking, universe] = await Promise.all([getQueue(), getCurrentRanking(), getUniverseStats()]);
  const filteredQueue = query
    ? queue.filter((item) => item.ticker.includes(query) || item.name?.toUpperCase().includes(query))
    : queue;
  const completed = universe.fii_completed;
  const active = queue.filter((item) => item.status && !["backlog", "completed"].includes(item.status)).length;
  const overallProgress = universe.fii_registered ? (completed / universe.fii_registered) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <SafaHeader />

      <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="mb-6 grid gap-5 xl:grid-cols-[1.55fr_0.8fr]">
          <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(135deg,rgba(15,31,49,.96),rgba(7,21,34,.92))] p-6 shadow-2xl shadow-black/20 sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-teal-400/8 blur-3xl" />
            <div className="relative">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-teal-300/25 bg-teal-300/8 text-teal-100">
                  <Sparkles className="size-3" /> Deep Max v2
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">
                  FIIs · universo prioritário
                </Badge>
              </div>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-teal-300/80">Central de decisão</p>
              <h1 className="max-w-3xl font-serif text-3xl leading-tight text-white sm:text-4xl lg:text-5xl">
                Analisar cada fundo até esgotá-lo. Depois, comparar com honestidade.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                O SAFA começa pelos fundos escolhidos para pesquisa, separando qualidade, renda sustentável, preço e risco. Nenhum fundo recebe veredito final antes da leitura documental e das duas passagens críticas.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="bg-teal-300 text-[#06121d] hover:bg-teal-200">
                  <Link href={queue[0] ? `/operacao?ticker=${queue[0].ticker}` : "/#fila"}>
                    Abrir central de análise <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-white/12 bg-white/4 text-white hover:bg-white/8">
                  <Link href="/comparador">Abrir comparador</Link>
                </Button>
              </div>
            </div>
          </div>

          <Card className="border-white/8 bg-[#0c1928] shadow-xl shadow-black/10">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4 text-base text-white">
                Cobertura do universo
                <span className="font-mono text-2xl text-teal-200">{completed}/{universe.fii_registered}</span>
              </CardTitle>
              <CardDescription className="text-slate-400">Somente análises concluídas entram no ranking definitivo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Progress value={overallProgress} className="h-2.5 bg-slate-800 [&_[data-slot=progress-indicator]]:bg-teal-300" />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/7 bg-white/[0.025] p-4">
                  <p className="text-xs text-slate-500">Em análise</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{active}</p>
                </div>
                <div className="rounded-xl border border-white/7 bg-white/[0.025] p-4">
                  <p className="text-xs text-slate-500">Elegibilidade verificada</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{universe.fii_retail_verified}/{universe.fii_registered}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-amber-300/12 bg-amber-300/[0.045] p-4 text-sm leading-6 text-amber-100/90">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-300" />
                O perfil metodológico de cada novo fundo será verificado antes das notas; recebíveis, tijolo, híbridos e infraestrutura não usam uma régua indevida.
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Critérios por análise", value: "80 + 5", detail: "universais mais overlay do segmento", icon: FileSearch },
            { label: "Passagens obrigatórias", value: "2", detail: "construção e contestação", icon: BookOpenCheck },
            { label: "Escopos controlados", value: "17", detail: "9 documentais e 8 estruturados", icon: Database },
            { label: "Ranking vigente", value: ranking.length ? String(ranking.length) : "—", detail: ranking.length ? "fundos classificados" : "aguardando análises completas", icon: CheckCircle2 },
          ].map(({ label, value, detail, icon: Icon }) => (
            <Card key={label} className="gap-3 border-white/8 bg-[#0b1826] py-5 shadow-none">
              <CardContent className="flex items-start justify-between gap-4 px-5">
                <div>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
                </div>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-300/8 text-teal-200">
                  <Icon className="size-4" />
                </span>
              </CardContent>
            </Card>
          ))}
        </section>

        <section id="fila" className="scroll-mt-24 overflow-hidden rounded-2xl border border-white/8 bg-[#0b1826] shadow-xl shadow-black/10">
          <div className="flex flex-col gap-4 border-b border-white/7 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-300/70">Trabalho atual</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Fila priorizada Deep Max</h2>
              <p className="mt-1 text-sm text-slate-400">Os fundos escolhidos entram primeiro; nenhuma conclusão provisória aparece como definitiva.</p>
            </div>
            <form className="relative w-full sm:w-72" action="/" method="get">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Buscar ticker"
                aria-label="Buscar fundo por ticker"
                className="h-10 w-full rounded-lg border border-white/10 bg-[#07131f] pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/10"
              />
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="bg-white/[0.02] text-left text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-6 py-3">Fila</th>
                  <th className="px-4 py-3">FII</th>
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3">Cobertura</th>
                  <th className="px-4 py-3 text-center">Qualidade</th>
                  <th className="px-4 py-3 text-center">Renda</th>
                  <th className="px-4 py-3 text-center">Nota ponderada</th>
                  <th className="px-6 py-3 text-right">Ficha</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.map((item) => {
                  const coverage = numberValue(item.coverage_pct) ?? 0;
                  return (
                    <tr key={item.ticker} className="border-t border-white/6 transition hover:bg-white/[0.025]">
                      <td className="px-6 py-4 font-mono text-slate-500">{String(item.queue_position ?? "—").padStart(2, "0")}</td>
                      <td className="px-4 py-4">
                        <Link href={`/fundos/${item.ticker}`} className="font-semibold text-white hover:text-teal-200">
                          {item.ticker}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.analysis_profile_status === "verified"
                            ? item.segment ?? "Perfil verificado"
                            : "Perfil metodológico a verificar"}
                        </p>
                      </td>
                      <td className="px-4 py-4"><StatusPill status={item.status} /></td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Progress value={coverage} className="h-1.5 w-24 bg-slate-800 [&_[data-slot=progress-indicator]]:bg-teal-300" />
                          <span className="w-10 font-mono text-xs text-slate-400">{coverage.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-mono text-slate-300">{score(item.quality_score)}</td>
                      <td className="px-4 py-4 text-center font-mono text-slate-300">{score(item.income_score)}</td>
                      <td className="px-4 py-4 text-center font-mono text-slate-300">{score(item.weighted_score)}</td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/fundos/${item.ticker}`} className="inline-flex items-center gap-1 text-xs font-medium text-teal-200 hover:text-teal-100">
                          Abrir <ArrowRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!filteredQueue.length && (
                  <tr>
                    <td colSpan={8} className="px-6 py-14 text-center text-slate-400">
                      Nenhum ticker encontrado para “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <Card className="border-white/8 bg-[#0b1826] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><CircleDashed className="size-4 text-teal-300" /> Regra para concluir um FII</CardTitle>
              <CardDescription className="text-slate-400">O veredito pontuável só é liberado quando todos os controles estiverem satisfeitos.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                "80 critérios + overlay revistos duas vezes",
                "6 competências e 3 exercícios auditados",
                "36 rendas classificadas e 750 pregões",
                "Valuation, contramodelo, riscos e falsificadores",
              ].map((text) => (
                <div key={text} className="flex gap-3 rounded-xl border border-white/7 bg-white/[0.02] p-4 text-sm leading-6 text-slate-300">
                  <span className="mt-1 size-2 shrink-0 rounded-full border border-teal-300/70" /> {text}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/8 bg-[#0b1826] shadow-none">
            <CardHeader>
              <CardTitle className="text-white">Comparação sem falsa precisão</CardTitle>
              <CardDescription className="text-slate-400">Qualidade e oportunidade são classificações diferentes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-slate-300">
              <p>O ranking geral será formado apenas por fundos concluídos na mesma metodologia e atualizados para uma data de corte comparável.</p>
              <p className="rounded-xl border border-white/7 bg-white/[0.02] p-4 text-slate-400">Enquanto não houver análise completa, a ausência de nota significa “não avaliado” — nunca zero.</p>
              <Button asChild variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/6">
                <Link href="/metodologia">Ver metodologia e pesos <ArrowRight /></Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
