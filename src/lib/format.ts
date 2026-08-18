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
