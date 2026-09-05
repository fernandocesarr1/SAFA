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
import {
  ARQUIVOS_TRIMESTRAL,
  concentracaoMaiorInquilino,
  desacumularPorExercicio,
  parseContratos,
  parseInquilinos,
  parseResultado,
  urlInformeTrimestral,
} from "../../lib/coleta/cvm/trimestral.ts";

// Anos a considerar. Vários, porque desconto é distância do topo e o topo
// costuma estar em outro ano-calendário: uma janela de 12 meses só enxerga o
// saldo do período e daria como "estável" um fundo que despencou antes dela.
// Quatro anos por padrão. A avaliação exata exige 36 meses de histórico, e
// uma janela de três anos-calendário nunca os alcança: coletar 2024–2026 em
// setembro de 2026 dá 33 meses, e a lista principal sairia vazia por
// construção — não por falta de fundos maduros.
const anoAtual = new Date().getUTCFullYear();
const anos = (
  process.argv[2]
    ? process.argv.slice(2).map(Number)
    : [anoAtual - 3, anoAtual - 2, anoAtual - 1, anoAtual]
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

console.log("\n[3/4] Informe Trimestral da CVM (segunda fonte de renda)...");
const contratosTrimestrais = [];
const resultadosTrimestrais = [];
const inquilinos = [];
for (const ano of anos) {
  try {
    const arq = await baixarArquivo(urlInformeTrimestral(ano), { timeoutMs: 300_000 });
    const csvs = extrairArquivos(arq.conteudo);
    const achar = (re: RegExp) => {
      const a = csvs.find((c) => re.test(c.nome));
      if (!a) throw new Error(`arquivo ausente: ${re}`);
      return a.conteudo.toString("latin1");
    };
    contratosTrimestrais.push(...parseContratos(achar(ARQUIVOS_TRIMESTRAL.complemento)));
    inquilinos.push(...parseInquilinos(achar(ARQUIVOS_TRIMESTRAL.inquilino)));
    // desacumula: Rendimentos_Declarados é acumulado no exercício
    resultadosTrimestrais.push(
      ...desacumularPorExercicio(parseResultado(achar(ARQUIVOS_TRIMESTRAL.resultado))),
    );
    console.log(`      ${ano}: sha256 ${arq.hashSha256.slice(0, 12)}…`);
  } catch (erro) {
    console.log(
      `      ${ano}: indisponível (${erro instanceof Error ? erro.message : erro})`,
    );
  }
}
const concentracaoPorFundo = concentracaoMaiorInquilino(inquilinos);
console.log(
  `      total: ${resultadosTrimestrais.length} resultados · ${concentracaoPorFundo.size} fundos com concentração medida`,
);

console.log("\n[4/4] Cruzamento e decomposição...");
const triagem = montarPreRanking({
  cotacoesPorTicker: porTicker(cotacoes),
  cadastro,
  complementos,
  ativoPassivo,
  contratosTrimestrais,
  concentracaoPorFundo,
  resultadosTrimestrais,
});

const limite = Number(process.env.SAFA_TOP ?? 25);
const topo = Number.isFinite(limite) ? limite : 25;
const largura = { t: 8, s: 22 };

function imprimirFila(titulo: string, itens: typeof triagem.principal): void {
  const resumo = resumir(itens);
  console.log(`\n${"=".repeat(78)}`);
  console.log(`${titulo} — ${resumo.total} fundos`);
  console.log("=".repeat(78));

  for (const [classe, n] of Object.entries(resumo.porClasse).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${String(n).padStart(4)}  ${classe}`);
  }

  console.log(`\n  candidatos a desconto: ${resumo.candidatos.length}`);
  if (resumo.candidatos.length === 0) return;

  console.log(
    `\n  ${"TICKER".padEnd(largura.t)} ${"SEGMENTO".padEnd(largura.s)} ${"PRIOR".padStart(7)} ${"QUEDA".padStart(7)} ${"P/VP".padStart(6)}  ${"MESES".padStart(5)}  OBSERVAÇÃO`,
  );
  for (const item of resumo.candidatos.slice(0, topo)) {
    const queda = item.decomposicao
      ? `${(Math.expm1(item.decomposicao.variacaoPreco) * 100).toFixed(1)}%`
      : "—";
    const meses = `${item.maturidade.mesesPreco}/${item.maturidade.mesesRendimento}`;
    console.log(
      `  ${item.ticker.padEnd(largura.t)} ${(item.segmento ?? "—").slice(0, largura.s).padEnd(largura.s)} ` +
        `${(item.classificacao?.prioridade ?? 0).toFixed(2).padStart(7)} ${queda.padStart(7)} ` +
        `${(item.precoSobreVp?.toFixed(2) ?? "—").padStart(6)}  ${meses.padStart(5)}  ` +
        `${item.motivoAcompanhamento ?? item.classificacao?.justificativa ?? ""}`,
    );
  }
}

console.log(
  `      ${triagem.principal.length} na principal · ${triagem.acompanhamento.length} em acompanhamento · ${triagem.excluidos.length} excluídos`,
);

imprimirFila("LISTA PRINCIPAL · histórico completo (36 meses de preço e rendimento)", triagem.principal);
imprimirFila("LISTA DE ACOMPANHAMENTO · comprável e negociado, sem histórico exato", triagem.acompanhamento);

// Motivos de acompanhamento agregados: um motivo dominante costuma ser defeito
// de cruzamento, não falta de dado.
const motivos = new Map<string, number>();
for (const i of triagem.acompanhamento) {
  if (!i.motivoAcompanhamento) continue;
  const chave = i.motivoAcompanhamento
    .replace(/\d+/g, "N")
    .replace(/ISIN \S+/, "ISIN X");
  motivos.set(chave, (motivos.get(chave) ?? 0) + 1);
}
if (motivos.size > 0) {
  console.log("\n=== por que estão em acompanhamento ===");
  for (const [motivo, n] of [...motivos.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${motivo}`);
  }
}

const porExclusao = new Map<string, number>();
for (const x of triagem.excluidos) {
  porExclusao.set(x.motivo, (porExclusao.get(x.motivo) ?? 0) + 1);
}
console.log("\n=== excluídos das listas ===");
for (const [motivo, n] of [...porExclusao.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${motivo}`);
}

const pendentes = [...triagem.principal, ...triagem.acompanhamento]
  .filter((c) => c.classificacao?.classe === "candidato_desconto")
  .flatMap((c) => c.classificacao?.pendencias ?? []);
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
