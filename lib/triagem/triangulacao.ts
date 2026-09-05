/**
 * Triangulação de fundamentos: o mesmo fato, medido por fontes independentes.
 *
 * A triagem apoiava-se numa fonte só, e numa DERIVAÇÃO dentro dela — renda
 * estimada como `dividend_yield_mes × valor_patrimonial_cota` do informe da
 * CVM, com a base do yield não documentada no leiaute. Um número assim pode
 * estar errado por muito tempo sem que nada denuncie.
 *
 * Aqui o mesmo fato chega por caminhos diferentes:
 *
 * | Fato | Fonte A | Fonte B |
 * |---|---|---|
 * | renda por cota | CVM, informe mensal (derivada) | FNET, aviso estruturado (declarada) |
 * | patrimônio e cotas | CVM, informe mensal | CVM, informe trimestral |
 *
 * O objetivo NÃO é escolher a fonte "melhor". É medir a distância entre elas.
 * Fontes que concordam elevam a confiança; fontes que divergem sinalizam que
 * pelo menos uma está errada — e nesse caso o desfecho correto é suspender o
 * número, não escolher o mais conveniente.
 */

export type Fonte = "cvm_mensal" | "cvm_trimestral" | "fnet" | "b3";

export type Medida = {
  fonte: Fonte;
  valor: number;
  /** URL do documento ou arquivo. Página de índice não serve (§11). */
  url: string;
  /** Publicado pela fonte, ou derivado por nós a partir dela. */
  natureza: "publicado" | "derivado";
};

export type Concordancia =
  /** Fontes dentro da tolerância: a medida ganha confiança. */
  | { estado: "concordam"; valor: number; divergenciaRelativa: number; medidas: Medida[] }
  /** Fora da tolerância: pelo menos uma está errada. Não escolhemos. */
  | { estado: "divergem"; divergenciaRelativa: number; medidas: Medida[]; detalhe: string }
  /** Uma fonte só: utilizável, mas sem corroboração. */
  | { estado: "fonte_unica"; valor: number; medida: Medida }
  /** Nenhuma fonte. */
  | { estado: "ausente" };

/**
 * Tolerância relativa padrão.
 *
 * 5% acomoda diferença de arredondamento e de data-base entre fontes, sem
 * acomodar erro de unidade ou de cruzamento — que costumam ser de ordens de
 * grandeza, não de pontos percentuais.
 */
export const TOLERANCIA_PADRAO = 0.05;

export function confrontar(
  medidas: readonly Medida[],
  tolerancia = TOLERANCIA_PADRAO,
): Concordancia {
  const validas = medidas.filter(
    (m) => Number.isFinite(m.valor) && m.url.trim() !== "",
  );

  if (validas.length === 0) return { estado: "ausente" };
  if (validas.length === 1) {
    return { estado: "fonte_unica", valor: validas[0].valor, medida: validas[0] };
  }

  const valores = validas.map((m) => m.valor);
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const referencia = Math.abs(maior) > 0 ? Math.abs(maior) : 1;
  const divergenciaRelativa = (maior - menor) / referencia;

  if (divergenciaRelativa > tolerancia) {
    return {
      estado: "divergem",
      divergenciaRelativa,
      medidas: validas,
      detalhe:
        `${(divergenciaRelativa * 100).toFixed(1)}% de distância entre ` +
        validas
          .map((m) => `${m.fonte}=${m.valor.toPrecision(6)}`)
          .join(" e "),
    };
  }

  // Concordando, prefere-se o publicado ao derivado: mesma ordem de grandeza,
  // porém um deles não depende de suposição nossa sobre a base do cálculo.
  const publicada = validas.find((m) => m.natureza === "publicado");
  return {
    estado: "concordam",
    valor: (publicada ?? validas[0]).valor,
    divergenciaRelativa,
    medidas: validas,
  };
}

/** Só medida corroborada, ou de fonte única, alimenta cálculo. */
export function valorUtilizavel(c: Concordancia): number | null {
  if (c.estado === "concordam") return c.valor;
  if (c.estado === "fonte_unica") return c.valor;
  return null;
}

/** Rótulo curto para exibição e para o registro de sessão. */
export function descrever(c: Concordancia): string {
  switch (c.estado) {
    case "concordam":
      return `${c.medidas.length} fontes concordam (${(c.divergenciaRelativa * 100).toFixed(1)}%)`;
    case "divergem":
      return `DIVERGEM: ${c.detalhe}`;
    case "fonte_unica":
      return `fonte única (${c.medida.fonte}, ${c.medida.natureza})`;
    case "ausente":
      return "sem fonte";
  }
}

/**
 * Grau de confiança da medida, para ordenar a fila.
 *
 * Não é nota de investimento: é quanto se pode apoiar no número. Divergência
 * zera, porque um fato medido de dois jeitos incompatíveis não sustenta
 * decisão nenhuma.
 */
export function confianca(c: Concordancia): number {
  switch (c.estado) {
    case "concordam":
      return 1;
    case "fonte_unica":
      return c.medida.natureza === "publicado" ? 0.6 : 0.4;
    case "divergem":
    case "ausente":
      return 0;
  }
}
