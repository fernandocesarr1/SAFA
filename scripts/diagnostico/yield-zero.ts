/**
 * O `Percentual_Dividend_Yield_Mes` zerado do Informe Mensal é distribuição
 * zero de verdade, ou campo não preenchido?
 *
 *   node scripts/diagnostico/yield-zero.ts
 *
 * A pergunta importa porque 50 dos 55 fundos que caem da lista principal por
 * "renda indisponível" caem com zero, não com ausência. Se o zero for real, o
 * fundo não distribuiu e isso é informação. Se for preenchimento omitido, a
 * triagem está descartando fundo bom por defeito de leitura.
 *
 * O teste decisivo é confrontar com o informe TRIMESTRAL, que publica
 * `Rendimentos_Declarados` por outro caminho: fundo com yield mensal zerado e
 * rendimento trimestral positivo denuncia campo não preenchido.
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
} from "../../lib/coleta/cvm/trimestral.ts";

const anos = [2023, 2024, 2025, 2026];

const complementos = [];
const trimestrais = [];
for (const ano of anos) {
  try {
    const arq = await baixarArquivo(urlInformeMensal(ano), { timeoutMs: 300_000 });
    const a = extrairArquivos(arq.conteudo).find((c) => ARQUIVOS.complemento.test(c.nome));
    if (a) complementos.push(...parseComplemento(a.conteudo.toString("latin1")));
    console.error(`mensal ${ano}: ok`);
  } catch (e) {
    console.error(`mensal ${ano}: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const arq = await baixarArquivo(urlInformeTrimestral(ano), { timeoutMs: 300_000 });
    const a = extrairArquivos(arq.conteudo).find((c) =>
      ARQUIVOS_TRIMESTRAL.resultado.test(c.nome),
    );
    if (a) {
      trimestrais.push(...desacumularPorExercicio(parseResultado(a.conteudo.toString("latin1"))));
    }
    console.error(`trimestral ${ano}: ok`);
  } catch (e) {
    console.error(`trimestral ${ano}: ${e instanceof Error ? e.message : e}`);
  }
}

console.log(`competências mensais ....... ${complementos.length}`);
console.log(`resultados trimestrais ..... ${trimestrais.length}`);

let nulo = 0;
let zero = 0;
let positivo = 0;
for (const c of complementos) {
  if (c.dividendYieldMes === null) nulo += 1;
  else if (c.dividendYieldMes === 0) zero += 1;
  else positivo += 1;
}
const total = complementos.length || 1;
const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
console.log(`\ndividend yield mensal, por competência:`);
console.log(`  nulo ..... ${String(nulo).padStart(6)}  ${pct(nulo)}`);
console.log(`  zero ..... ${String(zero).padStart(6)}  ${pct(zero)}`);
console.log(`  positivo . ${String(positivo).padStart(6)}  ${pct(positivo)}`);

// Perfil por fundo: quem nunca publicou yield positivo?
type Perfil = { zeros: number; positivos: number; nulos: number };
const porFundo = new Map<string, Perfil>();
for (const c of complementos) {
  const p = porFundo.get(c.cnpj) ?? { zeros: 0, positivos: 0, nulos: 0 };
  if (c.dividendYieldMes === null) p.nulos += 1;
  else if (c.dividendYieldMes === 0) p.zeros += 1;
  else p.positivos += 1;
  porFundo.set(c.cnpj, p);
}
const semNenhumPositivo = [...porFundo].filter(([, p]) => p.positivos === 0);
console.log(`\nfundos no informe mensal ... ${porFundo.size}`);
console.log(`  nunca publicaram yield > 0 . ${semNenhumPositivo.length}`);

// O confronto que decide: rendimento trimestral positivo com yield mensal zerado.
const rendaTriPorCnpj = new Map<string, number>();
for (const r of trimestrais) {
  const v = r.rendimentosDeclarados;
  if (v !== null && v > 0) {
    rendaTriPorCnpj.set(r.cnpj, (rendaTriPorCnpj.get(r.cnpj) ?? 0) + v);
  }
}

const contradizem = semNenhumPositivo.filter(([cnpj]) => rendaTriPorCnpj.has(cnpj));
console.log(
  `\nDESSES, com rendimento declarado > 0 no trimestral: ${contradizem.length}`,
);
console.log(
  contradizem.length > 0
    ? "  -> o zero mensal é campo não preenchido, não distribuição zero"
    : "  -> nenhuma contradição: o zero mensal se sustenta",
);

for (const [cnpj, p] of contradizem.slice(0, 20)) {
  console.log(
    `  ${cnpj}  mensal: ${p.zeros} zeros, ${p.nulos} nulos  ` +
      `trimestral: R$ ${(rendaTriPorCnpj.get(cnpj) ?? 0).toLocaleString("pt-BR")}`,
  );
}
