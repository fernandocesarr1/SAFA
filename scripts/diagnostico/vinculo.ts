/**
 * Mede o vínculo B3 ↔ CVM sobre o mercado inteiro, usando `lib/triagem/vinculo.ts`
 * — o mesmo código que a triagem usa, não uma reimplementação.
 *
 *   node scripts/diagnostico/vinculo.ts <extrato.json>
 *
 * O extrato vem de `scripts/diagnostico/isin.ts --dump`. Não baixa nada e não
 * escreve no banco.
 */

import { readFileSync } from "node:fs";

import type { CadastroFundo } from "../../lib/coleta/cvm/parser.ts";
import {
  classificarPapel,
  montarIndiceCadastro,
  vincular,
  type MetodoVinculo,
} from "../../lib/triagem/vinculo.ts";

type Extrato = {
  tickers: {
    ticker: string;
    isinUltimo: string;
    isins: string[];
    pregoes: number;
    nomeResumido: string;
  }[];
  cadastro: {
    cnpj: string;
    isin: string;
    nome: string;
    dataReferencia: string;
    publicoAlvo: string;
  }[];
};

const caminho = process.argv[2];
if (!caminho) {
  console.error("uso: node scripts/diagnostico/vinculo.ts <extrato.json>");
  process.exit(1);
}

const e = JSON.parse(readFileSync(caminho, "utf8")) as Extrato;

const cadastro: CadastroFundo[] = e.cadastro.map((c) => ({
  cnpj: c.cnpj,
  dataReferencia: c.dataReferencia,
  nome: c.nome,
  isin: c.isin,
  segmento: "",
  mandato: "",
  tipoGestao: "",
  publicoAlvo: c.publicoAlvo,
  negociadoEmBolsa: true,
  administrador: "",
}));

const indice = montarIndiceCadastro(cadastro);

const porMetodo = new Map<MetodoVinculo, typeof e.tickers>();
const direitos: typeof e.tickers = [];
const falhas: { t: (typeof e.tickers)[number]; motivo: string }[] = [];

for (const t of e.tickers) {
  if (t.pregoes === 0) continue;
  if (classificarPapel(t.isins) === "direito") {
    direitos.push(t);
    continue;
  }
  const v = vincular(indice, { isins: t.isins, nomeResumido: t.nomeResumido });
  if (v.vinculado) {
    const lista = porMetodo.get(v.metodo) ?? [];
    lista.push(t);
    porMetodo.set(v.metodo, lista);
  } else {
    falhas.push({ t, motivo: v.motivo });
  }
}

const total = e.tickers.filter((t) => t.pregoes > 0).length;
const vinculados = [...porMetodo.values()].reduce((s, l) => s + l.length, 0);

console.log(`papéis no COTAHIST .................. ${total}`);
console.log(`direitos de subscrição / recibos .... ${direitos.length}`);
console.log(`cotas de fundo ...................... ${total - direitos.length}`);
console.log(`  vinculadas ........................ ${vinculados}`);
for (const m of ["isin_exato", "isin_prefixo", "nome_resumido"] as const) {
  console.log(`    ${m.padEnd(15)} ................ ${porMetodo.get(m)?.length ?? 0}`);
}
console.log(`  ainda sem vínculo ................. ${falhas.length}`);

for (const m of ["isin_prefixo", "nome_resumido"] as const) {
  const lista = porMetodo.get(m) ?? [];
  if (lista.length === 0) continue;
  console.log(`\n--- ${m}: conferir na mão (até 30) ---`);
  for (const t of lista.slice(0, 30)) {
    const v = vincular(indice, { isins: t.isins, nomeResumido: t.nomeResumido });
    if (!v.vinculado) continue;
    console.log(
      `${t.ticker.padEnd(8)} ${String(t.pregoes).padStart(4)}p  ` +
        `"${t.nomeResumido.trim()}"`.padEnd(18) +
        ` -> ${v.cadastro.nome.slice(0, 46)}`,
    );
  }
}

console.log(`\n--- sem vínculo, por motivo ---`);
const porMotivo = new Map<string, number>();
for (const f of falhas) {
  const chave = f.motivo.replace(/"[^"]*"/g, '"X"').replace(/\b[A-Z0-9]{12}\b/g, "ISIN");
  porMotivo.set(chave, (porMotivo.get(chave) ?? 0) + 1);
}
for (const [motivo, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${motivo}`);
}

console.log(`\n--- sem vínculo, os mais negociados ---`);
for (const f of falhas.sort((a, b) => b.t.pregoes - a.t.pregoes).slice(0, 25)) {
  console.log(
    `${f.t.ticker.padEnd(8)} ${String(f.t.pregoes).padStart(4)}p  ` +
      `${f.t.isinUltimo.padEnd(13)} "${f.t.nomeResumido.trim()}"`,
  );
}
