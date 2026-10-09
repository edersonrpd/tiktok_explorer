import { describe, expect, it } from "vitest";
import { packageOrderIds } from "./packages";

describe("packageOrderIds", () => {
  it("junta orders[].id, order_ids e order_id sem repetir", () => {
    expect(
      packageOrderIds({ orders: [{ id: "1" }, { id: "2" }], order_ids: ["2", "3"], order_id: "1" }),
    ).toEqual(["1", "2", "3"]);
  });

  it("devolve vazio quando a resposta não traz pedido", () => {
    expect(packageOrderIds({})).toEqual([]);
  });
});
