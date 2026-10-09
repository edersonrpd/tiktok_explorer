import type { PackageDetail } from "../types/tiktok";

/**
 * IDs de pedido de um pacote. O formato exato da resposta do Get Package
 * Detail não está no snapshot local da documentação, então lê as formas
 * conhecidas (`orders[].id`, `order_ids[]`, `order_id`), sem repetir.
 */
export function packageOrderIds(data: PackageDetail): string[] {
  const seen = new Set<string>();
  const add = (id: unknown): void => {
    if (typeof id === "string" && id !== "") seen.add(id);
  };

  for (const order of data.orders ?? []) add(order.id);
  for (const id of data.order_ids ?? []) add(id);
  add(data.order_id);

  return [...seen];
}
