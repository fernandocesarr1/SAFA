"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CashDistribution, MarketPrice } from "@/lib/safa-data";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const month = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });

export function FundAnalysisCharts({ prices, distributions }: { prices: MarketPrice[]; distributions: CashDistribution[] }) {
  const sampledPrices = prices.filter((_, index) => index % 5 === 0 || index === prices.length - 1).map((row) => ({
    date: row.price_date,
    value: Number(row.close_price),
  }));
  const income = distributions.map((row) => ({
    date: row.reference_date,
    label: month.format(new Date(`${row.reference_date}T00:00:00Z`)),
    total: Number(row.amount_per_share),
    recurring: Number(row.recurring_amount_per_share ?? 0),
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-xl border border-white/7 bg-white/[0.02] p-4">
        <p className="mb-4 text-sm font-medium text-white">Preço — série B3</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sampledPrices}>
              <defs><linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5eead4" stopOpacity={0.35} /><stop offset="100%" stopColor="#5eead4" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="#203044" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" minTickGap={55} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(value) => String(value).slice(0, 7)} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(value) => `R$${value}`} width={48} />
              <Tooltip contentStyle={{ background: "#0b1826", border: "1px solid #203044", borderRadius: 10 }} labelStyle={{ color: "#94a3b8" }} formatter={(value) => money.format(Number(value))} />
              <Area type="monotone" dataKey="value" name="Fechamento" stroke="#5eead4" fill="url(#priceFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl border border-white/7 bg-white/[0.02] p-4">
        <p className="mb-4 text-sm font-medium text-white">Distribuições — 38 meses</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={income}>
              <CartesianGrid stroke="#203044" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" minTickGap={24} tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(value) => `R$${Number(value).toFixed(1)}`} width={45} />
              <Tooltip contentStyle={{ background: "#0b1826", border: "1px solid #203044", borderRadius: 10 }} formatter={(value) => money.format(Number(value))} />
              <Bar dataKey="total" name="Distribuído" fill="#38bdf8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="recurring" name="Recorrente estimado" fill="#5eead4" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
