import { AlertTriangle, BookOpenCheck, CheckCircle2, Database, Scale, ShieldCheck } from "lucide-react";

import { SafaHeader } from "@/components/safa-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deepMaxDocumentMinimums,
  deepMaxDocumentScopes,
  deepMaxScoreWeights,
  deepMaxSections,
  deepMaxSegmentOverlays,
  deepMaxStructuredScopes,
} from "@/lib/deep-max-methodology";

const gates = [
  `Elegibilidade do investidor comum confirmada em fontes de mercado e regulatória`,
  `${deepMaxSections.length} seções e 80 critérios universais revisados em duas passagens`,
  `${deepMaxDocumentScopes.length} escopos documentais pesquisados e conciliados`,
  `${deepMaxDocumentMinimums.uniqueManagementCompetencies} competências gerenciais recentes e ${deepMaxDocumentMinimums.auditedFinancialYears} exercícios com notas e auditoria`,
  `${deepMaxDocumentMinimums.classifiedDistributions} distribuições classificadas em recorrente, mista ou extraordinária`,
  `${deepMaxDocumentMinimums.pricePoints} pregões cobrindo pelo menos ${deepMaxDocumentMinimums.priceHistoryYears} anos`,
  `${deepMaxDocumentMinimums.universalMetrics} métricas universais e 5 métricas específicas do segmento`,
  `Imóveis, locatários, contratos, dívidas, valuation, premissas, riscos e gatilhos estruturados`,
  `${deepMaxDocumentMinimums.valuationScenarios} cenários, ${deepMaxDocumentMinimums.valuationAssumptions} premissas e ao menos um contramodelo`,
  `Caso contrário, falsificadores e recência dos dados verificados antes da conclusão`,
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <SafaHeader />
      <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="mb-6 rounded-2xl border border-white/8 bg-[linear-gradient(135deg,rgba(15,31,49,.97),rgba(7,21,34,.94))] p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-teal-300/25 bg-teal-300/8 text-teal-100">Deep Max v2</Badge>
            <Badge variant="outline" className="border-white/10 bg-white/4 text-slate-300">régua auditável</Badge>
          </div>
          <h1 className="mt-5 max-w-4xl font-serif text-3xl text-white sm:text-5xl">O que precisa existir antes de uma nota.</h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base">
            O SAFA não considera uma análise completa porque há um relatório, um múltiplo ou uma opinião. A conclusão exige cobertura documental, dados estruturados, duas revisões, contramodelo e regras iguais para todos os fundos.
          </p>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {deepMaxScoreWeights.map((dimension) => (
            <Card key={dimension.code} className="gap-3 border-white/8 bg-[#0b1826] py-5 shadow-none">
              <CardContent className="flex items-center justify-between gap-4 px-5">
                <div>
                  <p className="text-xs text-slate-500">Dimensão comparativa</p>
                  <p className="mt-1 text-sm font-medium text-white">{dimension.label}</p>
                </div>
                <span className="font-mono text-2xl text-teal-200">{Math.round(dimension.weight * 100)}%</span>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-white/8 bg-[#0b1826] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><CheckCircle2 className="size-4 text-teal-300" /> Bloqueios obrigatórios</CardTitle>
              <CardDescription className="text-slate-400">A ausência de qualquer bloco impede nota e ranking.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {gates.map((gate, index) => (
                <div key={gate} className="flex gap-3 rounded-xl border border-white/7 bg-white/[0.02] p-4 text-sm leading-6 text-slate-300">
                  <span className="mt-0.5 font-mono text-xs text-teal-300/70">{String(index + 1).padStart(2, "0")}</span>
                  <span>{gate}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="border-white/8 bg-[#0b1826] shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><BookOpenCheck className="size-4 text-teal-300" /> Duas saídas honestas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6">
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.045] p-4 text-emerald-100/90">
                  <p className="font-medium text-emerald-100">Completa e pontuável</p>
                  <p className="mt-1">Todos os dados críticos existem, estão recentes e foram verificados. Libera seis notas, ações e ranking.</p>
                </div>
                <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-4 text-amber-100/90">
                  <p className="font-medium text-amber-100">Pesquisa esgotada, dados insuficientes</p>
                  <p className="mt-1">As fontes foram procuradas e revisadas, mas falta evidência crítica. Conclui sem notas e nunca entra no ranking.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/8 bg-[#0b1826] shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><AlertTriangle className="size-4 text-amber-300" /> O que a nota não promete</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-slate-300">
                Uma análise profunda reduz omissões; não elimina incerteza, fraude, choque macroeconômico ou mudança futura. Risco e confiança permanecem separados da nota ponderada.
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card className="border-white/8 bg-[#0b1826] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><Database className="size-4 text-teal-300" /> Escopos persistidos</CardTitle>
              <CardDescription className="text-slate-400">Nada depende de uma planilha horizontal impossível de manter.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-teal-300/70">Documentos</p>
                <ul className="space-y-2 text-xs leading-5 text-slate-400">{deepMaxDocumentScopes.map((scope) => <li key={scope}>• {scope}</li>)}</ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-teal-300/70">Dados</p>
                <ul className="space-y-2 text-xs leading-5 text-slate-400">{deepMaxStructuredScopes.map((scope) => <li key={scope}>• {scope}</li>)}</ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/8 bg-[#0b1826] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><Scale className="size-4 text-teal-300" /> Overlay por segmento</CardTitle>
              <CardDescription className="text-slate-400">A mesma régua universal recebe cinco testes próprios do negócio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(deepMaxSegmentOverlays).map(([code, overlay]) => (
                <div key={code} className="rounded-xl border border-white/7 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{overlay.label}</p>
                    <span className="font-mono text-xs text-teal-200">+{overlay.criteria.length}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{overlay.criteria.join(" · ")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <div className="mt-6 flex gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 text-xs leading-5 text-slate-400">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-300" />
          Pesos, mínimos e bloqueios ficam versionados no banco. Alterar a metodologia exige uma nova versão; resultados de versões diferentes não podem entrar no mesmo ranking.
        </div>
      </main>
    </div>
  );
}
