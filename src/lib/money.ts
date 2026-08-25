/**
 * Aritmética de dinheiro sobre os valores da API do TikTok Shop.
 *
 * A API devolve dinheiro como STRING decimal ("17.65", "13.3", "0"), e o
 * extrato do pedido é feito de somas e subtrações desses valores. Fazer
 * isso com `Number` direto acumula erro binário (0.1 + 0.2 = 0.30000000000000004)
 * e o total deixa de bater com `total_amount` por centavos — justamente a
 * conferência que a tela existe para fazer.
 *
 * Por isso todo valor vira INTEIRO em escala 4 (décimos de milésimo), e só
 * volta a decimal na formatação. Somar inteiros é exato.
 */

/** Casas decimais preservadas internamente. */
const SCALE = 4;
const FACTOR = 10 ** SCALE;

/** Valor monetário em escala 4. Sempre inteiro. */
export type Money = number;

export const ZERO: Money = 0;

/** Aceita "17.65", "13.3", "0", "-1.5". Qualquer outra coisa vira `undefined`. */
export function parseMoney(raw: string | number | undefined | null): Money | undefined {
  if (raw === undefined || raw === null) return undefined;

  const text = String(raw).trim();
  if (text === "") return undefined;

  const match = /^(-?)(\d+)(?:[.,](\d+))?$/.exec(text);
  if (match === null) return undefined;

  // Casas além da escala são descartadas (a API não usa mais que 2).
  const fraction = (match[3] ?? "").slice(0, SCALE).padEnd(SCALE, "0");
  const value = Number(match[2]) * FACTOR + Number(fraction);

  return match[1] === "-" ? -value : value;
}

/** Igual a `parseMoney`, mas ausência/valor inválido vira zero. */
export function moneyOrZero(raw: string | number | undefined | null): Money {
  return parseMoney(raw) ?? ZERO;
}

export function addMoney(...values: Array<Money | undefined>): Money {
  let total = 0;
  for (const value of values) total += value ?? 0;
  return total;
}

export function subtractMoney(from: Money, ...values: Array<Money | undefined>): Money {
  let total = from;
  for (const value of values) total -= value ?? 0;
  return total;
}

/** Percentual sobre um valor, arredondado ao centavo (meio para cima). */
export function percentOf(value: Money, percent: number): Money {
  return roundToCents((value * percent) / 100);
}

/** Arredonda ao centavo — o extrato é conferido em centavos, não em escala 4. */
export function roundToCents(value: Money): Money {
  const step = FACTOR / 100;
  return Math.round(value / step) * step;
}

export function isZero(value: Money | undefined): boolean {
  return value === undefined || value === 0;
}

/** Diferença desprezível (< 1 centavo) conta como "bate". */
export function moneyEquals(a: Money, b: Money): boolean {
  return Math.abs(a - b) < FACTOR / 100;
}

/** Valor decimal puro, sem símbolo — usado em testes e em campos de entrada. */
export function toDecimalString(value: Money, decimals = 2): string {
  const rounded = roundToCents(value) / FACTOR;
  return rounded.toFixed(decimals);
}

/**
 * Formatação para exibição. BRL sai como "R$ 17,65"; moedas que o `Intl`
 * não conhece caem no formato "17.65 XYZ" em vez de quebrar a tela.
 */
export function formatMoney(value: Money | undefined, currency: string | undefined): string {
  if (value === undefined) return "—";

  const amount = roundToCents(value) / FACTOR;

  if (currency !== undefined && currency !== "") {
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }

  return amount.toFixed(2);
}
