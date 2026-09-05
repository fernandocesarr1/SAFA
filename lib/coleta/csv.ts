/**
 * Leitor de CSV para os dados abertos da CVM.
 *
 * Os arquivos da CVM usam ponto e vírgula, aspas opcionais e vêm em latin1.
 * Números usam vírgula decimal. Nada disso é adivinhado em tempo de execução:
 * é declarado aqui e falha alto quando o arquivo não corresponde.
 */

export type LinhaCsv = Record<string, string>;

export class CsvInvalido extends Error {}

/** Divide respeitando aspas duplas, com "" como escape. */
function dividirLinha(linha: string, separador: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i += 1;
        } else {
          dentroDeAspas = false;
        }
      } else {
        atual += c;
      }
      continue;
    }
    if (c === '"') {
      dentroDeAspas = true;
    } else if (c === separador) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((v) => v.trim());
}

export type OpcoesCsv = {
  separador?: string;
  /** Colunas que precisam existir. Ausência é erro, não silêncio. */
  colunasObrigatorias?: readonly string[];
};

export function parseCsv(texto: string, opcoes: OpcoesCsv = {}): LinhaCsv[] {
  const { separador = ";", colunasObrigatorias = [] } = opcoes;

  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (linhas.length === 0) throw new CsvInvalido("arquivo vazio");

  const cabecalho = dividirLinha(linhas[0], separador);

  const faltando = colunasObrigatorias.filter((c) => !cabecalho.includes(c));
  if (faltando.length > 0) {
    throw new CsvInvalido(
      `colunas ausentes: ${faltando.join(", ")}. Encontradas: ${cabecalho.join(", ")}`,
    );
  }

  const registros: LinhaCsv[] = [];
  for (let i = 1; i < linhas.length; i += 1) {
    const valores = dividirLinha(linhas[i], separador);
    if (valores.length !== cabecalho.length) continue; // linha defeituosa não vira registro
    const registro: LinhaCsv = {};
    for (let j = 0; j < cabecalho.length; j += 1) {
      registro[cabecalho[j]] = valores[j];
    }
    registros.push(registro);
  }
  return registros;
}

/**
 * Converte número de CSV público, detectando o formato.
 *
 * Não dá para assumir vírgula decimal: o Informe Mensal de FII da CVM usa
 * **ponto** decimal e nenhum separador de milhar (`173.93928738435`,
 * `487055921.63`). Assumir formato brasileiro aqui multiplicava os valores por
 * potências de dez sem erro nenhum aparecer — foi o que aconteceu na primeira
 * versão, e só foi visto porque o número saiu absurdo na inspeção.
 *
 * Regra:
 * - vírgula e ponto  -> o ÚLTIMO que aparece é o decimal, o outro é milhar
 * - só vírgula       -> vírgula é decimal
 * - só ponto         -> ponto é decimal
 *
 * Devolve `null` para vazio ou inválido — nunca zero, que seria dado inventado
 * se passasse adiante (§12).
 */
export function numeroCsv(valor: string | undefined): number | null {
  if (valor === undefined) return null;
  const limpo = valor.trim();
  if (limpo === "" || limpo === "-") return null;

  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");

  let normalizado: string;
  if (temVirgula && temPonto) {
    const decimal = limpo.lastIndexOf(",") > limpo.lastIndexOf(".") ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    normalizado = limpo.split(milhar).join("").replace(decimal, ".");
  } else if (temVirgula) {
    normalizado = limpo.replace(",", ".");
  } else {
    normalizado = limpo;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}
