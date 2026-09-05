/**
 * Mensal derivado × trimestral declarado: a divergência é real ou é defeito de
 * anualização?
 *
 *   node scripts/diagnostico/renda-fontes.ts
 *
 * Ligar o resgate pelo trimestral fez o confronto passar a acontecer de fato, e
 * 68 fundos passaram a divergir. Antes de aceitar ou recusar esse número,
 * importa saber se a razão entre as duas medidas se concentra em algum valor:
 *
 * - razão ≈ 3        -> a mediana mensal exclui meses zerados e superestima
 *                       quem não paga todo mês;
 * - razão ≈ 4 ou 1/4 -> erro de anualização do trimestre;
 * - razão espalhada  -> divergência real entre as fontes.
 *
 * Também mede a distância temporal entre o trimestre escolhido e a competência
 * alvo: trimestre velho comparado com mês atual produz conflito falso.
 *
 * Não escreve no banco.
 */

import { baixarArquivo } from "../../lib/coleta/download.ts";
import { extrairArquivos } from "../../lib/coleta/zip.ts";
import { ARQUIVOS, urlInformeMensal } from "../../lib/coleta/cvm/layout.ts";
import { parseComplemento } from "../../lib/coleta/cvm/parser.ts";
import {
  ARQUIVOS_TRIMESTRAL,
  desacumularPorExercicio,
  parseResultado,
  urlInformeTrimestral,
  type ResultadoTrimestral,
} from "../../lib/coleta/cvm/trimestral.ts";
import { rendaAnualizadaDaJanela, rendaTrimestralAnualizada } from "../../lib/triagem/renda.ts";

const anos = [2023, 2024, 2025, 2026];

const complementos = [];
const trimestrais: ResultadoTrimestral[] = [];
for (const ano of anos) {
  try {
    const arq = await baixarArquivo(urlInformeMensal(ano), { timeoutMs: 300_000 });
    const a = extrairArquivos(arq.conteudo).find((c) => ARQUIVOS.complemento.test(c.nome));
    if (a) complementos.push(...parseComplemento(a.conteudo.toString("latin1")));
  } catch (e) {
    console.error(`mensal ${ano}: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const arq = await baixarArquivo(urlInformeTrimestral(ano), { timeoutMs: 300_000 });
    const a = extrairArquivos(arq.conteudo).find((c) =>
      ARQUIVOS_TRIMESTRAL.resultado.test(c.nome),
    );
    if (a) {
      trimestrais.push(
        ...desacumularPorExercicio(parseResultado(a.conteudo.toString("latin1"))),
      );
    }
  } catch (e) {
    console.error(`trimestral ${ano}: ${e instanceof Error ? e.message : e}`);
  }
}
console.error(`mensais=${complementos.length} trimestrais=${trimestrais.length}`);

const porCnpj = new Map<string, typeof complementos>();
for (const c of complementos) {
  const l = porCnpj.get(c.cnpj) ?? [];
  l.push(c);
  porCnpj.set(c.cnpj, l);
}

const razoes: number[] = [];
const distancias: number[] = [];
let semTrimestral = 0;
let semMensal = 0;

for (const [cnpj, lista] of porCnpj) {
  lista.sort((a, b) => (a.dataReferencia < b.dataReferencia ? -1 : 1));
  const janela = lista.slice(-3);
  if (janela.length < 3) continue;
  const fim = janela[janela.length - 1];

  const mensal = rendaAnualizadaDaJanela(janela);
  const tri = rendaTrimestralAnualizada(trimestrais, cnpj, fim.dataReferencia, fim.cotasEmitidas);

  if (!mensal.ok) { semMensal += 1; continue; }
  if (tri === null) { semTrimestral += 1; continue; }

  razoes.push(mensal.valor / tri);

  const doFundo = trimestrais.filter((r) => r.cnpj === cnpj);
  if (doFundo.length > 0) {
    const alvo = Date.parse(`${fim.dataReferencia}T00:00:00Z`);
    const perto = doFundo.reduce((m, r) =>
      Math.abs(Date.parse(`${r.dataReferencia}T00:00:00Z`) - alvo) <
      Math.abs(Date.parse(`${m.dataReferencia}T00:00:00Z`) - alvo)
        ? r
        : m,
    );
    distancias.push(
      Math.round(
        Math.abs(Date.parse(`${perto.dataReferencia}T00:00:00Z`) - alvo) / 86_400_000 / 30,
      ),
    );
  }
}

console.log(`fundos com as duas medidas ..... ${razoes.length}`);
console.log(`  só mensal (sem trimestral) ... ${semTrimestral}`);
console.log(`  sem mensal utilizável ........ ${semMensal}`);

razoes.sort((a, b) => a - b);
const q = (p: number) => razoes[Math.floor(razoes.length * p)] ?? NaN;
console.log(`\nrazão mensal/trimestral:`);
for (const [rot, v] of [["p10", q(0.1)], ["p25", q(0.25)], ["mediana", q(0.5)], ["p75", q(0.75)], ["p90", q(0.9)]] as const) {
  console.log(`  ${String(rot).padEnd(8)} ${Number(v).toFixed(3)}`);
}

const faixas: [string, (r: number) => boolean][] = [
  ["dentro de 5% (concordam)", (r) => Math.abs(r - 1) <= 0.05],
  ["entre 5% e 25%", (r) => Math.abs(r - 1) > 0.05 && Math.abs(r - 1) <= 0.25],
  ["perto de 3x", (r) => r >= 2.5 && r <= 3.5],
  ["perto de 4x", (r) => r >= 3.5 && r <= 4.5],
  ["perto de 1/3", (r) => r >= 0.28 && r <= 0.4],
  ["perto de 1/4", (r) => r >= 0.22 && r <= 0.28],
];
console.log(`\ndistribuição:`);
for (const [rot, teste] of faixas) {
  const n = razoes.filter(teste).length;
  console.log(`  ${rot.padEnd(26)} ${String(n).padStart(5)}  ${((n / razoes.length) * 100).toFixed(1)}%`);
}

distancias.sort((a, b) => a - b);
const dq = (p: number) => distancias[Math.floor(distancias.length * p)] ?? NaN;
console.log(`\ndistância em meses até o trimestre usado:`);
console.log(`  mediana ${dq(0.5)}   p75 ${dq(0.75)}   p90 ${dq(0.9)}   máx ${distancias[distancias.length - 1]}`);
