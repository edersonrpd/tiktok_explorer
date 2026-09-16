import type { AmountBreakdown, SkuTransaction } from "../types/tiktok";

/**
 * Leitura das taxas do endpoint de liquidação
 * (/finance/202501/orders/{id}/statement_transactions).
 *
 * DOIS CUIDADOS QUE EXPLICAM O MÓDULO INTEIRO:
 *
 * 1. Os valores chegam como STRING decimal ("-2", "0.00", "13.45") e a
 *    soma precisa bater centavo a centavo com o extrato. Converter para
 *    `number` traria erro de ponto flutuante (0.1 + 0.2 = 0.30000000000000004),
 *    então a soma aqui é feita em inteiros com BigInt, alinhando as casas
 *    decimais. `Number` só aparece onde imprecisão não altera resultado:
 *    a ordenação das linhas.
 *
 * 2. As rubricas variam por região e por programa do vendedor, e o schema
 *    oficial não declara quais chegam preenchidas no Brasil. Por isso nada
 *    aqui tem lista fixa de campos: percorremos as chaves que vieram na
 *    resposta. Chave desconhecida aparece com o nome cru em vez de sumir.
 */

/** Uma rubrica do extrato: a chave crua da API, um rótulo e o valor somado. */
export interface AmountLine {
  key: string;
  label: string;
  amount: string;
}

interface Decimal {
  /** Valor em unidades inteiras na escala indicada (ex.: 13.45 → 1345n, escala 2). */
  units: bigint;
  /** Número de casas decimais. */
  scale: number;
}

const DECIMAL_PATTERN = /^[+-]?\d+(\.\d+)?$/;

/** Converte "13.45" em { units: 1345n, scale: 2 }; devolve null se não for número. */
function parseDecimal(value: string | undefined): Decimal | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "" || !DECIMAL_PATTERN.test(trimmed)) return null;

  const negative = trimmed.startsWith("-");
  const unsigned = trimmed.replace(/^[+-]/, "");
  const [intPart = "", fracPart = ""] = unsigned.split(".");
  const units = BigInt(intPart + fracPart);

  return { units: negative ? -units : units, scale: fracPart.length };
}

/** Coloca dois decimais na mesma escala, sem perder casas. */
function align(a: Decimal, b: Decimal): { a: bigint; b: bigint; scale: number } {
  const scale = Math.max(a.scale, b.scale);
  return {
    a: a.units * 10n ** BigInt(scale - a.scale),
    b: b.units * 10n ** BigInt(scale - b.scale),
    scale,
  };
}

function formatDecimal({ units, scale }: Decimal): string {
  if (scale === 0) return units.toString();

  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const intPart = digits.slice(0, digits.length - scale);
  const fracPart = digits.slice(digits.length - scale);

  return `${negative ? "-" : ""}${intPart}.${fracPart}`;
}

/** Um valor ausente, não numérico ou igual a zero (inclusive "0.00" e "-0"). */
export function isZeroAmount(value: string | undefined): boolean {
  const parsed = parseDecimal(value);
  return parsed === null || parsed.units === 0n;
}

/**
 * Soma exata de valores decimais em string. Valores ausentes ou não
 * numéricos são ignorados; sem nenhum valor válido, devolve "0".
 */
export function sumAmounts(values: Array<string | undefined>): string {
  let total: Decimal | null = null;

  for (const value of values) {
    const parsed = parseDecimal(value);
    if (parsed === null) continue;
    if (total === null) {
      total = parsed;
      continue;
    }
    const aligned = align(total, parsed);
    total = { units: aligned.a + aligned.b, scale: aligned.scale };
  }

  return total === null ? "0" : formatDecimal(total);
}

/** Igualdade numérica entre dois valores decimais ("-3" e "-3.00" são iguais). */
export function amountsEqual(a: string | undefined, b: string | undefined): boolean {
  const left = parseDecimal(a);
  const right = parseDecimal(b);
  if (left === null || right === null) return left === right;

  const aligned = align(left, right);
  return aligned.a === aligned.b;
}

/** Ordena por valor absoluto decrescente — a maior taxa primeiro. */
function byMagnitudeDesc(a: AmountLine, b: AmountLine): number {
  // Float basta aqui: erro de arredondamento muda no máximo a ordem de
  // duas rubricas praticamente iguais, nunca um valor exibido.
  return Math.abs(Number(b.amount)) - Math.abs(Number(a.amount));
}

/**
 * Soma um mesmo grupo de rubricas entre vários SKUs, devolvendo uma linha
 * por chave. O extrato traz o detalhamento por SKU; para ver o pedido
 * inteiro é preciso somar as chaves correspondentes.
 */
export function mergeBreakdowns(groups: Array<AmountBreakdown | undefined>): AmountLine[] {
  const byKey = new Map<string, Array<string | undefined>>();

  for (const group of groups) {
    if (group === undefined) continue;
    for (const [key, value] of Object.entries(group)) {
      const existing = byKey.get(key);
      if (existing === undefined) byKey.set(key, [value]);
      else existing.push(value);
    }
  }

  return [...byKey.entries()]
    .map(([key, values]) => ({ key, label: labelForAmountKey(key), amount: sumAmounts(values) }))
    .sort(byMagnitudeDesc);
}

/** Linhas de um único grupo (um SKU), no mesmo formato de `mergeBreakdowns`. */
export function breakdownLines(group: AmountBreakdown | undefined): AmountLine[] {
  return mergeBreakdowns([group]);
}

/** Descarta as rubricas zeradas — a resposta traz dezenas delas em "0". */
export function nonZeroLines(lines: AmountLine[]): AmountLine[] {
  return lines.filter((line) => !isZeroAmount(line.amount));
}

/** Taxas e impostos do pedido inteiro, somados a partir dos SKUs. */
export function orderFeeLines(skus: SkuTransaction[]): { fees: AmountLine[]; taxes: AmountLine[] } {
  return {
    fees: mergeBreakdowns(skus.map((sku) => sku.fee_tax_breakdown?.fee)),
    taxes: mergeBreakdowns(skus.map((sku) => sku.fee_tax_breakdown?.tax)),
  };
}

/**
 * Rótulos em português das rubricas mais comuns. A lista é deliberadamente
 * incompleta: o que não estiver aqui é exibido com a chave crua
 * humanizada, e a chave da API aparece do lado na interface — melhor um
 * nome técnico do que um rótulo traduzido por adivinhação.
 *
 * A região de aplicação, quando o schema oficial a declara, vai no rótulo:
 * a mesma venda não cobra `referral_fee_amount` (US) e
 * `platform_commission_amount` (UK) ao mesmo tempo.
 */
const AMOUNT_LABELS: Record<string, string> = {
  // Comissões e taxas da plataforma
  platform_commission_amount: "Comissão da plataforma (UK)",
  referral_fee_amount: "Taxa de indicação — referral (US)",
  transaction_fee_amount: "Taxa de transação",
  dynamic_commission_amount: "Comissão dinâmica",
  fee_per_item_sold_amount: "Taxa por item vendido",
  mall_service_fee_amount: "Taxa de serviço do Mall",
  refund_administration_fee_amount: "Taxa administrativa de reembolso",
  credit_card_handling_fee_amount: "Taxa de processamento de cartão",
  sfp_service_fee_amount: "Taxa de serviço do SFP",
  flash_sales_service_fee_amount: "Taxa de serviço de flash sale",
  live_specials_fee_amount: "Taxa de ofertas em live",
  voucher_xtra_service_fee_amount: "Taxa de serviço do Voucher Xtra",
  bonus_cashback_service_fee_amount: "Taxa de serviço do bônus de cashback",
  cofunded_promotion_service_fee_amount: "Taxa de serviço de promoção cofinanciada",
  pre_order_service_fee_amount: "Taxa de serviço de pré-venda",
  campaign_resource_fee: "Taxa de recurso de campanha",
  installation_service_fee: "Taxa de serviço de instalação",
  shipping_fee_guarantee_service_fee: "Taxa de garantia de frete",
  // Afiliados / creators
  affiliate_commission_amount: "Comissão de afiliado (creator)",
  affiliate_ads_commission_amount: "Comissão de afiliado via anúncios",
  affiliate_partner_commission_amount: "Comissão de parceiro afiliado",
  affiliate_commission_amount_before_pit: "Comissão de afiliado antes do IR retido (SEA)",
  affiliate_commission_deposit: "Reserva para comissão de afiliado",
  affiliate_commission_release: "Devolução da reserva de comissão",
  cofunded_creator_bonus_amount: "Bônus cofinanciado para creator",
  external_affiliate_marketing_fee_amount: "Taxa de marketing de afiliado externo",
  tsp_commission_amount: "Comissão de TSP",
  tap_shop_ads_commission: "Comissão de anúncios Tap Shop",
  // Impostos
  vat_amount: "VAT",
  local_vat_amount: "VAT local",
  import_vat_amount: "VAT de importação",
  customs_duty_amount: "Imposto de importação",
  customs_clearance_amount: "Desembaraço aduaneiro",
  anti_dumping_duty_amount: "Taxa antidumping",
  gst_amount: "GST",
  sst_amount: "SST",
  isr_amount: "ISR — imposto de renda (MX)",
  iva_amount: "IVA (MX)",
  pit_amount: "IR retido do creator",
  // Receita
  subtotal_before_discount_amount: "Subtotal antes de descontos",
  seller_discount_amount: "Desconto do vendedor",
  seller_discount_refund_amount: "Desconto devolvido ao vendedor",
  refund_subtotal_before_discount_amount: "Subtotal reembolsado",
  cod_service_fee_amount: "Taxa de serviço COD",
  refund_cod_service_fee_amount: "Reembolso da taxa COD",
  // Frete
  actual_shipping_fee_amount: "Frete real cobrado pela transportadora",
  customer_paid_shipping_fee_amount: "Frete pago pelo comprador",
  return_shipping_fee_amount: "Frete de devolução",
  exchange_shipping_fee_amount: "Frete de troca",
  shipping_cost_discount_amount: "Incentivo de frete do TikTok",
  failed_delivery_subsidy_amount: "Subsídio por entrega falha",
  free_return_subsidy_amount: "Subsídio de devolução gratuita",
  fbt_free_shipping_fee_amount: "Frete grátis via FBT",
  fbt_fulfillment_fee_reimbursement_amount: "Reembolso de tarifa FBT (US)",
};

/** Rótulo de exibição de uma rubrica; sem tradução conhecida, humaniza a chave. */
export function labelForAmountKey(key: string): string {
  const known = AMOUNT_LABELS[key];
  if (known !== undefined) return known;

  const words = key.replace(/_amount$/, "").replace(/_/g, " ").trim();
  if (words === "") return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
