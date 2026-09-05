/**
 * Diagnóstico do cruzamento por ISIN entre COTAHIST (B3) e o cadastro da CVM.
 *
 * Não altera nada e não escreve no banco. Baixa as duas fontes, grava um
 * extrato compacto em `--dump <arquivo>` e imprime a anatomia das falhas.
 *
 *   node scripts/diagnostico/isin.ts --dump extrato.json
 *   node scripts/diagnostico/isin.ts --ler extrato.json
 *
 * O extrato existe para que a análise possa ser refeita sem baixar de novo
 * ~1 GB de arquivo — e para que o número afirmado tenha de onde ser conferido.
 */

import { readFileSync, writeFileSync } from "node:fs";

import { coletarAnoCotahist, porTicker } from "../../lib/coleta/cotahist/coletor.ts";
import { baixarArquivo } from "../../lib/coleta/download.ts";
import { extrairArquivos } from "../../lib/coleta/zip.ts";
import { ARQUIVOS, urlInformeMensal } from "../../lib/coleta/cvm/layout.ts";
import { parseGeral } from "../../lib/coleta/cvm/parser.ts";

type Extrato = {
  anos: number[];
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

function arg(nome: string): string | null {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const anos = [2023, 2024, 2025, 2026];
const destino = arg("--dump");
const origem = arg("--ler");

async function coletar(): Promise<Extrato> {
  const cotacoes = [];
  for (const ano of anos) {
    try {
      const p = await coletarAnoCotahist(ano, { timeoutMs: 600_000 });
      if (p.lote.status === "validated") cotacoes.push(...p.cotacoes);
      console.error(`cotahist ${ano}: ok`);
    } catch (e) {
      console.error(`cotahist ${ano}: ${e instanceof Error ? e.message : e}`);
    }
  }

  const cadastro = [];
  for (const ano of anos) {
    try {
      const arq = await baixarArquivo(urlInformeMensal(ano), { timeoutMs: 300_000 });
      const a = extrairArquivos(arq.conteudo).find((c) => ARQUIVOS.geral.test(c.nome));
      if (!a) throw new Error("arquivo geral ausente no ZIP");
      cadastro.push(...parseGeral(a.conteudo.toString("latin1")));
      console.error(`cvm ${ano}: ok`);
    } catch (e) {
      console.error(`cvm ${ano}: ${e instanceof Error ? e.message : e}`);
    }
  }

  const series = porTicker(cotacoes);
  const isinsPorTicker = new Map<string, Set<string>>();
  for (const c of cotacoes) {
    const k = (c.codigoIsin ?? "").trim().toUpperCase();
    if (!k) continue;
    const s = isinsPorTicker.get(c.ticker) ?? new Set<string>();
    s.add(k);
    isinsPorTicker.set(c.ticker, s);
  }

  return {
    anos,
    tickers: [...series].map(([ticker, serie]) => ({
      ticker,
      isinUltimo: (serie[serie.length - 1]?.codigoIsin ?? "").trim().toUpperCase(),
      isins: [...(isinsPorTicker.get(ticker) ?? [])],
      pregoes: serie.length,
      nomeResumido: serie[serie.length - 1]?.nomeResumido ?? "",
    })),
    cadastro: cadastro.map((c) => ({
      cnpj: c.cnpj,
      isin: c.isin,
      nome: c.nome,
      dataReferencia: c.dataReferencia,
      publicoAlvo: c.publicoAlvo,
    })),
  };
}

const extrato: Extrato = origem
  ? (JSON.parse(readFileSync(origem, "utf8")) as Extrato)
  : await coletar();

if (destino) {
  writeFileSync(destino, JSON.stringify(extrato));
  console.error(`extrato gravado em ${destino}`);
}

// ---------------------------------------------------------------- análise ---

const norm = (s: string) => s.trim().toUpperCase();

/** Índice exato, como o pré-ranking faz hoje. */
const porIsin = new Map<string, (typeof extrato.cadastro)[number]>();
for (const c of extrato.cadastro) {
  const k = norm(c.isin);
  if (!k || k === "0") continue;
  const at = porIsin.get(k);
  if (!at || c.dataReferencia > at.dataReferencia) porIsin.set(k, c);
}

/**
 * Índice por PREFIXO: `BR` + as 4 letras do emissor + o tipo de papel.
 * O sufixo do ISIN numera a emissão; o prefixo identifica o fundo.
 */
const prefixo = (isin: string) => norm(isin).slice(0, 9);
const porPrefixo = new Map<string, (typeof extrato.cadastro)[number][]>();
for (const c of extrato.cadastro) {
  const k = prefixo(c.isin);
  if (k.length < 9 || norm(c.isin) === "0") continue;
  const lista = porPrefixo.get(k) ?? [];
  lista.push(c);
  porPrefixo.set(k, lista);
}

const cnpjsSemIsin = new Set(
  extrato.cadastro.filter((c) => !norm(c.isin) || norm(c.isin) === "0").map((c) => c.cnpj),
);
const cnpjsComIsin = new Set(
  extrato.cadastro.filter((c) => norm(c.isin) && norm(c.isin) !== "0").map((c) => c.cnpj),
);

console.log(`anos ................................ ${extrato.anos.join(", ")}`);
console.log(`tickers no COTAHIST ................. ${extrato.tickers.length}`);
console.log(`registros de cadastro ............... ${extrato.cadastro.length}`);
console.log(`ISINs exatos distintos .............. ${porIsin.size}`);
console.log(`prefixos distintos .................. ${porPrefixo.size}`);
console.log(`CNPJs só com ISIN vazio ou "0" ...... ${[...cnpjsSemIsin].filter((c) => !cnpjsComIsin.has(c)).length}`);

/** ISIN de direito de subscrição / recibo: `D` seguido de `M` no miolo. */
const ehDireito = (isin: string) => /^BR[A-Z0-9]{4}D\d{2}M\d{2}$/.test(norm(isin));

const falhas = extrato.tickers.filter(
  (t) => t.pregoes > 0 && !t.isins.some((i) => porIsin.has(i)),
);

const direitos = falhas.filter((f) => f.isins.every(ehDireito));
const papeis = falhas.filter((f) => !f.isins.every(ehDireito));
const recuperaveis = papeis.filter((f) => f.isins.some((i) => porPrefixo.has(prefixo(i))));
const ausentes = papeis.filter((f) => !f.isins.some((i) => porPrefixo.has(prefixo(i))));

console.log(`\nFALHAS DE CRUZAMENTO ................ ${falhas.length}`);
console.log(`  direitos de subscrição / recibos .. ${direitos.length}  (não são o fundo)`);
console.log(`  cotas de fundo .................... ${papeis.length}`);
console.log(`    recuperáveis pelo prefixo ....... ${recuperaveis.length}`);
console.log(`    sem nada no cadastro ............ ${ausentes.length}`);

console.log(`\n--- recuperáveis: o cadastro tem o fundo com OUTRO sufixo de ISIN ---`);
console.log(`${"TICKER".padEnd(8)} ${"ISIN B3".padEnd(13)} ${"ISIN CVM".padEnd(13)} PREGOES  NOME`);
for (const f of recuperaveis.slice(0, 30)) {
  const i = f.isins.find((x) => porPrefixo.has(prefixo(x))) ?? "";
  const cands = porPrefixo.get(prefixo(i)) ?? [];
  const c = cands.reduce((a, b) => (b.dataReferencia > a.dataReferencia ? b : a));
  console.log(
    `${f.ticker.padEnd(8)} ${i.padEnd(13)} ${norm(c.isin).padEnd(13)} ${String(f.pregoes).padStart(7)}  ${c.nome.slice(0, 44)}`,
  );
}

console.log(`\n--- sem correspondência nenhuma (amostra) ---`);
for (const f of ausentes.slice(0, 25)) {
  console.log(`${f.ticker.padEnd(8)} ${f.isinUltimo.padEnd(13)} ${String(f.pregoes).padStart(7)} pregões`);
}
