/**
 * Executa o funil de triagem sobre o universo inteiro de FIIs.
 *
 *   node --max-old-space-size=4096 scripts/triagem/executar.ts [ano]
 *
 * Baixa COTAHIST e o Informe Mensal da CVM, cruza por ISIN, decompõe a
 * variação de preço e imprime o pré-ranking. Não escreve no banco: quem decide
 * persistir é quem opera, depois de olhar o resultado.
 */

import { coletarAnoCotahist, porTicker } from "../../lib/coleta/cotahist/coletor.ts";
import { baixarArquivo } from "../../lib/coleta/download.ts";
import { extrairArquivos } from "../../lib/coleta/zip.ts";
import { ARQUIVOS, urlInformeMensal } from "../../lib/coleta/cvm/layout.ts";
import {
  parseAtivoPassivo,
  parseComplemento,
  parseGeral,
} from "../../lib/coleta/cvm/parser.ts";
import { montarPreRanking, resumir } from "../../lib/triagem/pre-ranking.ts";

// Anos a considerar. Vários, porque desconto é distância do topo e o topo
// costuma estar em outro ano-calendário: uma janela de 12 meses só enxerga o
// saldo do período e daria como "estável" um fundo que despencou antes dela.
const anos = (
  process.argv[2]
    ? process.argv.slice(2).map(Number)
    : [new Date().getUTCFullYear() - 1, new Date().getUTCFullYear()]
).filter((a) => Number.isInteger(a) && a >= 2000);

if (anos.length === 0) {
  console.error(`ano inválido: ${process.argv.slice(2).join(" ")}`);
  process.exit(1);
}

console.log(`SAFA — triagem do universo de FIIs, anos ${anos.join(", ")}\n`);

console.log("[1/3] COTAHIST da B3...");
const cotacoes = [];
const universo = new Set<string>();
for (const ano of anos) {
  try {
    const parcial = await coletarAnoCotahist(ano, { timeoutMs: 600_000 });
    if (parcial.lote.status !== "validated") {
      console.error(`      ${ano}: lote não validado:`, parcial.lote.problemas);
      continue;
    }
    cotacoes.push(...parcial.cotacoes);
    for (const t of parcial.universo) universo.add(t);
    console.log(
      `      ${ano}: ${parcial.lote.quantidadeRegistros} cotações · ` +
        `${parcial.universo.length} FIIs · sha256 ${parcial.lote.hashSha256.slice(0, 12)}…`,
    );
  } catch (erro) {
    // ano corrente pode ainda não ter arquivo anual publicado
    console.log(
      `      ${ano}: indisponível (${erro instanceof Error ? erro.message : erro})`,
    );
  }
}
if (cotacoes.length === 0) {
  console.error("      nenhuma cotação obtida");
  process.exit(1);
}
console.log(`      total: ${cotacoes.length} cotações · ${universo.size} FIIs`);

console.log("\n[2/3] Informe Mensal da CVM...");
const cadastro = [];
const complementos = [];
const ativoPassivo = [];
for (const ano of anos) {
  try {
    const arq = await baixarArquivo(urlInformeMensal(ano), { timeoutMs: 300_000 });
    const csvs = extrairArquivos(arq.conteudo);
    const acharCsv = (re: RegExp) => {
      const a = csvs.find((c) => re.test(c.nome));
      if (!a) throw new Error(`arquivo ausente no ZIP da CVM: ${re}`);
      return a.conteudo.toString("latin1");
    };
    cadastro.push(...parseGeral(acharCsv(ARQUIVOS.geral)));
    complementos.push(...parseComplemento(acharCsv(ARQUIVOS.complemento)));
    ativoPassivo.push(...parseAtivoPassivo(acharCsv(ARQUIVOS.ativoPassivo)));
    console.log(`      ${ano}: sha256 ${arq.hashSha256.slice(0, 12)}…`);
  } catch (erro) {
    console.log(
      `      ${ano}: indisponível (${erro instanceof Error ? erro.message : erro})`,
    );
  }
}
console.log(
  `      total: ${cadastro.length} registros de cadastro · ${complementos.length} complementos`,
);

console.log("\n[3/3] Cruzamento e decomposição...");
const itens = montarPreRanking({
  cotacoesPorTicker: porTicker(cotacoes),
  cadastro,
  complementos,
  ativoPassivo,
});
const resumo = resumir(itens);

console.log(`      ${resumo.total} tickers processados · ${resumo.impedidos} sem dados suficientes`);

// Por que os fundos ficaram de fora importa tanto quanto quem entrou: um
// impedimento dominante costuma ser defeito de cruzamento, não falta de dado.
const motivos = new Map<string, number>();
for (const i of itens) {
  if (!i.impedimento) continue;
  const chave = i.impedimento
    .replace(/\d+/g, "N")
    .replace(/ISIN \S+/, "ISIN X");
  motivos.set(chave, (motivos.get(chave) ?? 0) + 1);
}
if (motivos.size > 0) {
  console.log("\n=== motivos de exclusão ===");
  for (const [motivo, n] of [...motivos.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${motivo}`);
  }
}

console.log("\n=== classificação ===");
for (const [classe, n] of Object.entries(resumo.porClasse).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${classe}`);
}

console.log(`\n=== fila do Deep Max — ${resumo.candidatos.length} candidatos ===`);
const largura = { t: 8, s: 22 };
console.log(
  `  ${"TICKER".padEnd(largura.t)} ${"SEGMENTO".padEnd(largura.s)} ${"PRIOR".padStart(7)} ${"QUEDA".padStart(7)} ${"P/VP".padStart(6)}  JUSTIFICATIVA`,
);
for (const item of resumo.candidatos.slice(0, 25)) {
  const queda = item.decomposicao
    ? `${(Math.expm1(item.decomposicao.variacaoPreco) * 100).toFixed(1)}%`
    : "—";
  console.log(
    `  ${item.ticker.padEnd(largura.t)} ${(item.segmento ?? "—").slice(0, largura.s).padEnd(largura.s)} ` +
      `${(item.classificacao?.prioridade ?? 0).toFixed(2).padStart(7)} ${queda.padStart(7)} ` +
      `${(item.precoSobreVp?.toFixed(2) ?? "—").padStart(6)}  ${item.classificacao?.justificativa ?? ""}`,
  );
}

const pendentes = resumo.candidatos.flatMap((c) => c.classificacao?.pendencias ?? []);
const contagem = new Map<string, number>();
for (const p of pendentes) contagem.set(p, (contagem.get(p) ?? 0) + 1);
if (contagem.size > 0) {
  console.log("\n=== o que o Deep Max precisa verificar (não avaliável na triagem) ===");
  for (const [p, n] of [...contagem.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}×  ${p}`);
  }
}

console.log(
  "\nA triagem ordena investigação. Não é veredito, e a renda usada é derivada " +
    "do informe da CVM — o provento com fonte primária (FNET) ainda não é coletado.",
);
