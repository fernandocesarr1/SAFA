import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("keeps the Deep Max v2 methodology exhaustive, weighted and non-duplicated", async () => {
  const { deepMaxSections, deepMaxDocumentMinimums, deepMaxScoreWeights, deepMaxSegmentOverlays } = await vite.ssrLoadModule(
    "/lib/deep-max-methodology.ts",
  );
  const codes = deepMaxSections.map((section) => section.code);

  assert.equal(deepMaxSections.length, 16);
  assert.equal(new Set(codes).size, 16);
  assert.equal(deepMaxSections.reduce((total, section) => total + section.criteria.length, 0), 80);
  assert.ok(Object.values(deepMaxSegmentOverlays).every((overlay) => overlay.criteria.length === 5));
  assert.equal(deepMaxScoreWeights.reduce((total, dimension) => total + dimension.weight, 0), 1);
  assert.deepEqual(deepMaxScoreWeights.map(({ code, weight }) => [code, weight]), [
    ["income", 0.25],
    ["quality", 0.2],
    ["balance", 0.2],
    ["management", 0.15],
    ["value", 0.15],
    ["technical", 0.05],
  ]);
  assert.deepEqual(deepMaxDocumentMinimums, {
    managementReports: 6,
    uniqueManagementCompetencies: 6,
    financialStatements: 3,
    auditedFinancialYears: 3,
    regulations: 1,
    distributions: 36,
    classifiedDistributions: 36,
    pricePoints: 750,
    priceHistoryYears: 3,
    universalMetrics: 32,
    valuationScenarios: 3,
    valuationAssumptions: 12,
    risks: 5,
    thesisTriggers: 3,
  });
});

test("keeps database-level completion guards in the canonical schema", async () => {
  const base = await readFile(path.join(root, "supabase/schema.sql"), "utf8");
  const patch = await readFile(path.join(root, "supabase/deep_max_v2.sql"), "utf8");
  const schema = `${base}\n${patch}`;

  assert.match(schema, /create view public\.v_analysis_readiness/i);
  assert.match(schema, /validate_analysis_run_completion/i);
  assert.match(schema, /first_pass_pages_reviewed/i);
  assert.match(schema, /second_pass_omissions/i);
  assert.match(schema, /analysis_criterion_reviews/i);
  assert.match(schema, /fund_properties/i);
  assert.match(schema, /fund_tenants/i);
  assert.match(schema, /fund_leases/i);
  assert.match(schema, /debt_obligations/i);
  assert.match(schema, /valuation_scenarios/i);
  assert.match(schema, /risk_register/i);
  assert.match(schema, /thesis_triggers/i);
  assert.match(schema, /price_count >= 750/i);
  assert.match(schema, /classified_distribution_count >= 36/i);
  assert.match(schema, /new\.income_score \* 0\.25/i);
  assert.match(schema, /analysis_runs_one_active_idx/i);
  assert.match(schema, /somente analise Deep Max integralmente concluida entra no ranking/i);
});
