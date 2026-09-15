/** Helpers de formatação para exibição. */

/** Epoch em segundos → data/hora no formato brasileiro. */
export function formatEpochBR(epochSeconds: number | undefined): string {
  if (epochSeconds === undefined || epochSeconds <= 0) return "—";
  return new Date(epochSeconds * 1000).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPrice(salePrice: string | undefined, currency: string | undefined): string {
  if (salePrice === undefined || salePrice === "") return "—";
  return currency !== undefined && currency !== "" ? `${salePrice} ${currency}` : salePrice;
}

export function formatAge(ageSeconds: number): string {
  if (ageSeconds < 60) return `${ageSeconds}s`;
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}min`;
}

/**
 * Valor monetário do extrato para exibição.
 *
 * A API devolve string ("-70", "0 "); aqui vira número formatado em
 * pt-BR com o código da moeda ao lado. O código é mostrado como veio, sem
 * símbolo: um extrato pode ser GBP, USD ou BRL, e trocar por "R$" um
 * valor em outra moeda seria pior do que não formatar nada.
 */
export function formatAmount(value: number | null, currency: string | undefined): string {
  if (value === null) return "—";
  const number = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency !== undefined && currency !== "" ? `${number} ${currency}` : number;
}

/** Epoch em segundos → só a data (sem hora), formato brasileiro. */
export function formatEpochDateBR(epochSeconds: number | undefined): string {
  if (epochSeconds === undefined || epochSeconds <= 0) return "—";
  return new Date(epochSeconds * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
