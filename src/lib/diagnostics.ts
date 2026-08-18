import type { Product, Sku } from "../types/tiktok";

/**
 * Verificações automáticas sobre o JSON do produto, focadas nas
 * inconsistências de cadastro que atrapalham o de-para com o ERP.
 * Funções puras: recebem o Product e devolvem a lista de alertas.
 */

export type Severity = "critical" | "warning" | "info";

export interface DiagnosticAlert {
  severity: Severity;
  title: string;
  detail: string;
}

const LOW_STOCK_THRESHOLD = 5;

/** Nomes de atributo de variação que representam cor. */
const COLOR_ATTRIBUTE_NAMES = ["color", "colour", "cor"];

function skuLabel(sku: Sku): string {
  const attrs = (sku.sales_attributes ?? [])
    .map((a) => a.value_name)
    .filter((v): v is string => v !== undefined && v !== "");
  if (attrs.length > 0) return attrs.join(" / ");
  return sku.seller_sku !== undefined && sku.seller_sku !== "" ? sku.seller_sku : sku.id;
}

function totalStock(sku: Sku): number {
  return (sku.inventory ?? []).reduce((sum, inv) => sum + (inv.quantity ?? 0), 0);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

export function runDiagnostics(product: Product): DiagnosticAlert[] {
  const alerts: DiagnosticAlert[] = [];
  const skus = product.skus ?? [];

  // 1. external_product_id apontando para o seller_sku de UMA variação específica.
  const externalId = product.external_product_id;
  if (externalId !== undefined && externalId !== "" && skus.length > 1) {
    const matching = skus.filter((s) => s.seller_sku === externalId);
    if (matching.length === 1) {
      const match = matching[0];
      alerts.push({
        severity: "warning",
        title: "external_product_id aponta para uma variação específica",
        detail:
          `O código no nível do produto (${externalId}) é igual ao seller_sku da variação ` +
          `"${match !== undefined ? skuLabel(match) : externalId}", mas o produto tem ${skus.length} variações. ` +
          "Isso gera ambiguidade no de-para com o ERP — o campo confiável é skus[].seller_sku.",
      });
    }
  }

  // 2. Estoque zero ou muito baixo por variação.
  for (const sku of skus) {
    const stock = totalStock(sku);
    if (stock === 0) {
      alerts.push({
        severity: "info",
        title: `Variação "${skuLabel(sku)}" sem estoque`,
        detail: "Estoque total zerado — a variação não está vendável até repor.",
      });
    } else if (stock <= LOW_STOCK_THRESHOLD) {
      alerts.push({
        severity: "info",
        title: `Variação "${skuLabel(sku)}" com estoque baixo (${stock} un.)`,
        detail: `Estoque igual ou abaixo de ${LOW_STOCK_THRESHOLD} unidades — risco de ruptura em breve.`,
      });
    }
  }

  // 3. seller_sku vazio ou duplicado.
  const emptySellers = skus.filter((s) => s.seller_sku === undefined || s.seller_sku === "");
  if (emptySellers.length > 0) {
    alerts.push({
      severity: "critical",
      title: `${emptySellers.length} variação(ões) sem seller_sku`,
      detail:
        "Sem seller_sku não há como cruzar a variação com o cadastro do ERP. " +
        `Afetadas: ${emptySellers.map(skuLabel).join("; ")}.`,
    });
  }
  const bySeller = new Map<string, Sku[]>();
  for (const sku of skus) {
    if (sku.seller_sku !== undefined && sku.seller_sku !== "") {
      const list = bySeller.get(sku.seller_sku) ?? [];
      list.push(sku);
      bySeller.set(sku.seller_sku, list);
    }
  }
  for (const [seller, list] of bySeller) {
    if (list.length > 1) {
      alerts.push({
        severity: "critical",
        title: `seller_sku duplicado: ${seller}`,
        detail:
          `${list.length} variações compartilham o mesmo seller_sku (${list.map(skuLabel).join("; ")}). ` +
          "O de-para com o ERP fica ambíguo e integrações de estoque/preço podem gravar na variação errada.",
      });
    }
  }

  // 4. Preços divergentes entre variações.
  const prices = new Set<string>();
  for (const sku of skus) {
    const price = sku.price?.sale_price;
    if (price !== undefined && price !== "") prices.add(price);
  }
  if (prices.size > 1) {
    alerts.push({
      severity: "info",
      title: "Preços divergentes entre variações",
      detail:
        `Foram encontrados ${prices.size} preços distintos (${[...prices].join(", ")}). ` +
        "Pode ser intencional (tamanhos/kits diferentes), mas confira se não é erro de cadastro.",
    });
  }

  // 5. EAN ausente em alguma variação.
  const withoutEan = skus.filter(
    (s) => s.identifier_code?.code === undefined || s.identifier_code.code === "",
  );
  if (withoutEan.length > 0 && skus.length > 0) {
    alerts.push({
      severity: "warning",
      title: `${withoutEan.length} de ${skus.length} variação(ões) sem EAN`,
      detail:
        `Sem código identificador (EAN/GTIN): ${withoutEan.map(skuLabel).join("; ")}. ` +
        "Dificulta o cruzamento por código de barras e pode limitar a exposição do anúncio.",
    });
  }

  // 6. Descrição escrita para uma cor específica em produto multicolor.
  const colorNames = new Set<string>();
  for (const sku of skus) {
    for (const attr of sku.sales_attributes ?? []) {
      const attrName = (attr.name ?? "").toLowerCase();
      if (COLOR_ATTRIBUTE_NAMES.includes(attrName) && attr.value_name !== undefined && attr.value_name !== "") {
        colorNames.add(attr.value_name);
      }
    }
  }
  if (colorNames.size > 1 && product.description !== undefined) {
    const descriptionText = stripHtml(product.description).toLowerCase();
    const mentioned = [...colorNames].filter((c) => descriptionText.includes(c.toLowerCase()));
    if (mentioned.length > 0 && mentioned.length < colorNames.size) {
      alerts.push({
        severity: "warning",
        title: `Descrição menciona apenas a(s) cor(es): ${mentioned.join(", ")}`,
        detail:
          `O produto tem ${colorNames.size} cores (${[...colorNames].join(", ")}), mas a descrição cita só ` +
          `${mentioned.join(", ")}. Provavelmente foi escrita para uma variação específica e pode confundir o comprador das demais.`,
      });
    }
  }

  return alerts;
}
