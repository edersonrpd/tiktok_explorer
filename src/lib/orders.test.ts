import { describe, expect, it } from "vitest";
import { groupLineItems, totalUnits } from "./orders";
import type { OrderLineItem } from "../types/tiktok";

const unit = (over: Partial<OrderLineItem> & { id: string }): OrderLineItem => ({
  sku_id: "SKU1",
  product_id: "P1",
  product_name: "Camiseta",
  sku_name: "Vermelha / G",
  seller_sku: "CAM-VM-G",
  sale_price: "49.90",
  currency: "BRL",
  display_status: "TO_SHIP",
  ...over,
});

describe("groupLineItems", () => {
  it("soma unidades do mesmo SKU numa linha só", () => {
    const grouped = groupLineItems([unit({ id: "1" }), unit({ id: "2" })]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.quantity).toBe(2);
    expect(grouped[0]!.sellerSku).toBe("CAM-VM-G");
  });

  it("mantém SKUs diferentes separados", () => {
    const grouped = groupLineItems([
      unit({ id: "1" }),
      unit({ id: "2", sku_id: "SKU2", seller_sku: "CAM-AZ-M", sku_name: "Azul / M" }),
    ]);
    expect(grouped.map((g) => g.quantity)).toEqual([1, 1]);
  });

  it("marca divergência de preço entre unidades do mesmo SKU", () => {
    const grouped = groupLineItems([unit({ id: "1" }), unit({ id: "2", sale_price: "39.90" })]);
    expect(grouped[0]!.priceVaries).toBe(true);
  });

  it("acumula status distintos das unidades", () => {
    const grouped = groupLineItems([
      unit({ id: "1" }),
      unit({ id: "2", display_status: "CANCELLED" }),
    ]);
    expect(grouped[0]!.statuses).toEqual(["TO_SHIP", "CANCELLED"]);
  });

  it("agrupa por seller_sku quando não há sku_id", () => {
    const grouped = groupLineItems([
      unit({ id: "1", sku_id: undefined }),
      unit({ id: "2", sku_id: undefined }),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.quantity).toBe(2);
  });

  it("não agrupa itens sem sku_id nem seller_sku", () => {
    const grouped = groupLineItems([
      unit({ id: "1", sku_id: undefined, seller_sku: undefined }),
      unit({ id: "2", sku_id: undefined, seller_sku: undefined }),
    ]);
    expect(grouped).toHaveLength(2);
  });

  it("totalUnits conta uma unidade por linha", () => {
    expect(totalUnits([unit({ id: "1" }), unit({ id: "2" })])).toBe(2);
  });
});
