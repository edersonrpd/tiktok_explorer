/**
 * Extrato financeiro do pedido, no formato crédito × débito.
 *
 * MOTIVAÇÃO: o bloco de pagamento cru (`sub_total`, `shipping_fee`,
 * `total_amount`…) responde "quanto o comprador pagou", mas não responde a
 * pergunta que o vendedor faz: "quanto sobra para mim?". O HUB oficial
 * mostra um extrato com crédito, débito e líquido; aqui reproduzimos essa
 * leitura a partir do JSON do pedido, mostrando de qual campo veio cada
 * linha — o que o HUB não mostra e é o que permite conferir a integração.
 *
 * LIMITE IMPORTANTE (não é bug): **comissões e taxas de venda não existem
 * no Get Order Detail**. Elas vivem no extrato financeiro
 * (`/finance/202501/orders/{order_id}/statement_transactions` e afins).
 * Por isso o valor entra aqui como informação do usuário — percentual ou
 * valor — e sai sempre marcado como estimativa.
 *
 * FRETE COM ETIQUETA DO TIKTOK (`shipping_type: "TIKTOK"`): o comprador
 * paga o frete com desconto, o TikTok banca o restante e paga a
 * transportadora. O vendedor não fica com esse dinheiro — ele aparece como
 * crédito (o comprador pagou) e volta como débito (repassado ao envio),
 * fechando em zero. É assim que o extrato oficial fecha o mesmo pedido.
 */

import type { Order, OrderLineItem, OrderPayment } from "../types/tiktok";
import {
  addMoney,
  moneyEquals,
  moneyOrZero,
  parseMoney,
  percentOf,
  subtractMoney,
  ZERO,
  type Money,
} from "./money";

/* ------------------------------------------------------------------ */
/* Quanto o comprador pagou — a conta que fecha com `total_amount`      */
/* ------------------------------------------------------------------ */

export interface AmountRow {
  label: string;
  amount: Money;
  /** Campo do JSON de onde o valor veio, para conferência. */
  field: string;
  note?: string;
  sign: "plus" | "minus";
}

export interface BreakdownSection {
  title: string;
  rows: AmountRow[];
  /** Resultado da soma das linhas acima. */
  computed: Money;
  /** Valor que a API já devolve pronto, quando existe. */
  reported?: Money;
  reportedField?: string;
  reportedLabel: string;
  /** `false` quando o somatório diverge do campo devolvido pela API. */
  matches: boolean;
}

export interface BuyerBreakdown {
  sections: BreakdownSection[];
  computedTotal: Money;
  reportedTotal?: Money;
  totalMatches: boolean;
}

function section(
  title: string,
  rows: Array<AmountRow | undefined>,
  reportedLabel: string,
  reported: Money | undefined,
  reportedField: string,
): BreakdownSection {
  const present = rows.filter((row): row is AmountRow => row !== undefined);
  const computed = present.reduce(
    (total, row) => (row.sign === "plus" ? total + row.amount : total - row.amount),
    ZERO,
  );

  return {
    title,
    rows: present,
    computed,
    reported,
    reportedField,
    reportedLabel,
    matches: reported === undefined || moneyEquals(computed, reported),
  };
}

/** Só vira linha o campo que a API mandou — ausente é diferente de zero. */
function row(
  label: string,
  raw: string | undefined,
  field: string,
  sign: "plus" | "minus",
  note?: string,
): AmountRow | undefined {
  const amount = parseMoney(raw);
  if (amount === undefined) return undefined;
  return { label, amount, field, sign, note };
}

/** Preço de tabela dos itens: campo próprio quando existe, senão soma das linhas. */
export function itemsBeforeDiscount(payment: OrderPayment | undefined, items: OrderLineItem[]): Money {
  const reported = parseMoney(payment?.original_total_product_price);
  if (reported !== undefined) return reported;

  const summed = items.reduce((total, item) => addMoney(total, parseMoney(item.original_price)), ZERO);
  if (summed !== ZERO) return summed;

  return moneyOrZero(payment?.sub_total);
}

export function buildBuyerBreakdown(order: Order): BuyerBreakdown {
  const payment = order.payment;
  const items = order.line_items ?? [];
  const base = itemsBeforeDiscount(payment, items);

  const itemsSection = section(
    "Itens",
    [
      {
        label: "Itens antes dos descontos",
        amount: base,
        field: payment?.original_total_product_price !== undefined
          ? "original_total_product_price"
          : "soma de line_items[].original_price",
        sign: "plus",
      },
      row("Desconto do vendedor nos itens", payment?.seller_discount, "seller_discount", "minus"),
      row("Desconto do TikTok Shop nos itens", payment?.platform_discount, "platform_discount", "minus"),
    ],
    "Subtotal dos itens",
    parseMoney(payment?.sub_total),
    "sub_total",
  );

  const shippingSection = section(
    "Frete",
    [
      row("Frete original", payment?.original_shipping_fee, "original_shipping_fee", "plus"),
      row(
        "Desconto do TikTok Shop no frete",
        payment?.shipping_fee_platform_discount,
        "shipping_fee_platform_discount",
        "minus",
        "Subsídio da plataforma — o comprador não paga, e o vendedor também não.",
      ),
      row(
        "Desconto do vendedor no frete",
        payment?.shipping_fee_seller_discount,
        "shipping_fee_seller_discount",
        "minus",
        "Bancado pelo vendedor: sai do que ele recebe.",
      ),
      row(
        "Desconto cofinanciado no frete",
        payment?.shipping_fee_cofunded_discount,
        "shipping_fee_cofunded_discount",
        "minus",
      ),
    ],
    "Frete cobrado do comprador",
    parseMoney(payment?.shipping_fee),
    "shipping_fee",
  );

  const extraRows = [
    row("Taxa de serviço do comprador", payment?.buyer_service_fee, "buyer_service_fee", "plus"),
    row("Taxa de pedido pequeno", payment?.small_order_fee, "small_order_fee", "plus"),
    row("Taxa de entrega no varejo", payment?.retail_delivery_fee, "retail_delivery_fee", "plus"),
    row("Taxa de manuseio", payment?.handling_fee, "handling_fee", "plus"),
    row("Seguro do frete", payment?.shipping_insurance_fee, "shipping_insurance_fee", "plus"),
    row("Seguro do item", payment?.item_insurance_fee, "item_insurance_fee", "plus"),
    row("Impostos", payment?.tax, "tax", "plus"),
  ].filter((entry): entry is AmountRow => entry !== undefined && entry.amount !== ZERO);

  const sections = [itemsSection, shippingSection];
  if (extraRows.length > 0) {
    sections.push(section("Taxas e impostos", extraRows, "Total de taxas", undefined, ""));
  }

  const extrasTotal = extraRows.reduce((total, entry) => addMoney(total, entry.amount), ZERO);
  const computedTotal = addMoney(
    itemsSection.reported ?? itemsSection.computed,
    shippingSection.reported ?? shippingSection.computed,
    extrasTotal,
  );
  const reportedTotal = parseMoney(payment?.total_amount);

  return {
    sections,
    computedTotal,
    reportedTotal,
    totalMatches: reportedTotal === undefined || moneyEquals(computedTotal, reportedTotal),
  };
}

/* ------------------------------------------------------------------ */
/* Quem pagou o frete                                                   */
/* ------------------------------------------------------------------ */

export interface ShippingFunding {
  /** Frete cheio da transportadora. */
  original: Money;
  buyer: Money;
  platform: Money;
  seller: Money;
  cofunded: Money;
  /** Etiqueta do TikTok: a plataforma contrata e paga o envio. */
  byPlatform: boolean;
  /** Valor cru de `shipping_type`, para exibir sem inventar rótulo. */
  shippingType: string | undefined;
  /** `true` quando o frete cheio bate com a soma de quem paga o quê. */
  matches: boolean;
  provider: string | undefined;
}

export function buildShippingFunding(order: Order): ShippingFunding {
  const payment = order.payment;
  const buyer = moneyOrZero(payment?.shipping_fee);
  const platform = moneyOrZero(payment?.shipping_fee_platform_discount);
  const seller = moneyOrZero(payment?.shipping_fee_seller_discount);
  const cofunded = moneyOrZero(payment?.shipping_fee_cofunded_discount);
  const original = parseMoney(payment?.original_shipping_fee) ?? addMoney(buyer, platform, seller, cofunded);

  return {
    original,
    buyer,
    platform,
    seller,
    cofunded,
    byPlatform: order.shipping_type === "TIKTOK",
    shippingType: order.shipping_type,
    matches: moneyEquals(original, addMoney(buyer, platform, seller, cofunded)),
    provider: order.shipping_provider,
  };
}

/* ------------------------------------------------------------------ */
/* Extrato do vendedor — crédito × débito                               */
/* ------------------------------------------------------------------ */

export interface StatementLine {
  label: string;
  amount: Money;
  side: "credit" | "debit";
  /** Campo do JSON, ou de onde mais o valor veio. */
  field: string;
  note?: string;
  /** Valor que não vem do pedido: informado pelo usuário. */
  estimated?: boolean;
}

export interface SellerStatement {
  lines: StatementLine[];
  credit: Money;
  debit: Money;
  net: Money;
  /** `false` quando as comissões não foram informadas — o líquido é um teto. */
  feeKnown: boolean;
  shipping: ShippingFunding;
}

/**
 * Monta o extrato. `fee` é o total de comissões e taxas de venda, que o
 * usuário informa (ver `parseFeeInput`) porque o pedido não traz esse dado.
 */
export function buildSellerStatement(order: Order, fee: Money | undefined): SellerStatement {
  const payment = order.payment;
  const items = order.line_items ?? [];
  const shipping = buildShippingFunding(order);
  const lines: StatementLine[] = [];

  lines.push({
    label: "Subtotal de itens antes dos descontos",
    amount: itemsBeforeDiscount(payment, items),
    side: "credit",
    field: "original_total_product_price",
  });

  lines.push({
    label: "Desconto do TikTok Shop sobre os itens",
    amount: moneyOrZero(payment?.platform_discount),
    side: "credit",
    field: "platform_discount",
    note: "Promoção bancada pela plataforma: o comprador paga menos e o TikTok reembolsa o vendedor.",
  });

  lines.push({
    label: "Desconto do vendedor sobre os itens",
    amount: moneyOrZero(payment?.seller_discount),
    side: "debit",
    field: "seller_discount",
  });

  lines.push({
    label: "Frete pago pelo comprador",
    amount: shipping.buyer,
    side: "credit",
    field: "shipping_fee",
  });

  if (shipping.byPlatform) {
    // Etiqueta do TikTok: o frete entra e sai — quem paga a transportadora
    // é a plataforma, com o que cobrou do comprador mais o subsídio dela.
    lines.push({
      label: "Frete repassado ao envio do TikTok",
      amount: shipping.buyer,
      side: "debit",
      field: "shipping_type: TIKTOK",
      note: `Envio contratado pela plataforma${shipping.provider !== undefined ? ` (${shipping.provider})` : ""}: o frete cobrado do comprador não fica com o vendedor.`,
    });
  } else {
    lines.push({
      label: "Desconto do TikTok Shop no frete",
      amount: shipping.platform,
      side: "credit",
      field: "shipping_fee_platform_discount",
      note: "Subsídio de frete reembolsado ao vendedor quando o envio é por conta dele.",
    });
  }

  lines.push({
    label: "Desconto do vendedor no frete",
    amount: shipping.seller,
    side: "debit",
    field: "shipping_fee_seller_discount",
  });

  const buyerFees = addMoney(
    parseMoney(payment?.buyer_service_fee),
    parseMoney(payment?.small_order_fee),
    parseMoney(payment?.retail_delivery_fee),
  );
  if (buyerFees !== ZERO) {
    lines.push({
      label: "Taxas cobradas do comprador retidas pela plataforma",
      amount: buyerFees,
      side: "debit",
      field: "buyer_service_fee + small_order_fee + retail_delivery_fee",
      note: "Entram no total pago pelo comprador, mas ficam com a plataforma.",
    });
  }

  lines.push({
    label: "Comissões e taxas de venda",
    amount: fee ?? ZERO,
    side: "debit",
    field: "não vem no Get Order Detail",
    note: "Informe o percentual ou o valor: o pedido não carrega comissão. O número oficial está no extrato financeiro (Finance API).",
    estimated: true,
  });

  const credit = lines
    .filter((line) => line.side === "credit")
    .reduce((total, line) => addMoney(total, line.amount), ZERO);
  const debit = lines
    .filter((line) => line.side === "debit")
    .reduce((total, line) => addMoney(total, line.amount), ZERO);

  return { lines, credit, debit, net: subtractMoney(credit, debit), feeKnown: fee !== undefined, shipping };
}

/* ------------------------------------------------------------------ */
/* Entrada das comissões: "6,82" ou "36%"                               */
/* ------------------------------------------------------------------ */

export type FeeInput =
  | { kind: "empty" }
  | { kind: "amount"; amount: Money }
  | { kind: "rate"; percent: number; amount: Money }
  | { kind: "invalid"; reason: string };

/**
 * Lê o campo de comissões. Aceita valor absoluto ("6,82") ou percentual
 * ("36%"), este último aplicado sobre `base` — o total pago pelo comprador,
 * que é a base usada nos extratos do TikTok Shop.
 */
export function parseFeeInput(raw: string, base: Money): FeeInput {
  const text = raw.trim();
  if (text === "") return { kind: "empty" };

  if (text.endsWith("%")) {
    const percentText = text.slice(0, -1).trim().replace(",", ".");
    const percent = Number(percentText);
    if (percentText === "" || !Number.isFinite(percent) || percent < 0) {
      return { kind: "invalid", reason: "Percentual inválido. Exemplo: 36%" };
    }
    return { kind: "rate", percent, amount: percentOf(base, percent) };
  }

  const amount = parseMoney(text.replace(/^R\$\s*/i, ""));
  if (amount === undefined || amount < 0) {
    return { kind: "invalid", reason: "Use um valor (6,82) ou um percentual (36%)." };
  }
  return { kind: "amount", amount };
}

/** Percentual efetivo do valor informado sobre a base, para exibição. */
export function effectiveRate(amount: Money, base: Money): number | undefined {
  if (base === ZERO) return undefined;
  return (amount / base) * 100;
}
