/**
 * Tipos da triagem quantitativa.
 *
 * A triagem é o estágio que torna possível varrer o mercado inteiro: ela roda
 * sobre dados coletados programaticamente, sem leitura documental, e serve
 * apenas para ORDENAR candidatos. Ela não emite veredito e não substitui o
 * Deep Max — decide quem merece o Deep Max.
 */

/** Natureza do dado, conforme `AGENTS.md` §13. */
export type NaturezaDado =
  | "publicado"
  | "observado"
  | "calculado"
  | "estimativa"
  | "hipotese";

/**
 * Toda métrica da triagem carrega a própria linhagem. Sem `loteId` ou fonte,
 * a métrica não é comparável e não entra em ranking.
 */
export type Metrica = {
  valor: number;
  natureza: NaturezaDado;
  /** Lote que originou as entradas do cálculo (§12). */
  loteId: string | null;
  /** Entradas usadas, para reproduzir o número (§11.2). */
  entradas: Record<string, number>;
};

/**
 * Desfecho de qualquer cálculo da triagem. Ausência de dado é resultado
 * legítimo e explícito — nunca zero, média ou estimativa silenciosa.
 */
export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; motivo: "insufficient_data" | "invalid_input"; detalhe: string };

export function insuficiente<T>(detalhe: string): Resultado<T> {
  return { ok: false, motivo: "insufficient_data", detalhe };
}

export function invalido<T>(detalhe: string): Resultado<T> {
  return { ok: false, motivo: "invalid_input", detalhe };
}

export function ok<T>(valor: T): Resultado<T> {
  return { ok: true, valor };
}

/** Observação de preço já validada e com linhagem. */
export type PontoPreco = {
  /** AAAA-MM-DD */
  data: string;
  fechamento: number;
  volumeFinanceiro: number;
};

/** Distribuição paga por cota. */
export type PontoRenda = {
  /** AAAA-MM-DD — data-base de referência. */
  data: string;
  valorPorCota: number;
  /** Distribuição não recorrente não entra em renda sustentável. */
  recorrente: boolean;
};
