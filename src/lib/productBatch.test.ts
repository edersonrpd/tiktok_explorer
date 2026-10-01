import { describe, expect, it, vi } from "vitest";
import type { Product } from "../types/tiktok";
import type { FetchFailure, FetchResult } from "./api";
import {
  describeFailure,
  isTransient,
  parseBatchInput,
  runBatch,
  type BatchItem,
} from "./productBatch";

const NOW = 1_787_082_700;

function signed(id: string, ts = NOW - 10, version = "202309"): string {
  return `https://open-api.tiktokglobalshop.com/product/${version}/products/${id}?shop_cipher=ROW_x&app_key=k&timestamp=${ts}&sign=s${id}`;
}

describe("parseBatchInput", () => {
  it("lê uma URL por linha e extrai o ID do anúncio", () => {
    const { items, problems } = parseBatchInput(`${signed("111")}\n\n${signed("222")}\n`, NOW);
    expect(problems).toEqual([]);
    expect(items.map((i) => i.productId)).toEqual(["111", "222"]);
    expect(items.map((i) => i.line)).toEqual([1, 3]);
  });

  it("mantém path + query intactos para enviar", () => {
    const { items } = parseBatchInput(signed("111"), NOW);
    expect(items[0]?.normalized.pathWithQuery).toBe(
      `/product/202309/products/111?shop_cipher=ROW_x&app_key=k&timestamp=${NOW - 10}&sign=s111`,
    );
  });

  it("conta repetidos e fica com a primeira ocorrência", () => {
    const { items, duplicates } = parseBatchInput(`${signed("111")}\n${signed("111")}`, NOW);
    expect(items).toHaveLength(1);
    expect(duplicates).toBe(1);
  });

  it("recusa linha que não é detalhe de anúncio", () => {
    const order = `/order/202507/orders?ids=1&shop_cipher=a&app_key=b&timestamp=${NOW}&sign=s`;
    const { items, problems } = parseBatchInput(`${order}\n${signed("111")}`, NOW);
    expect(items).toHaveLength(1);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ line: 1 });
  });

  it("recusa a URL da busca no meio do lote (search não é um ID)", () => {
    const search = `/product/202502/products/search?page_size=100&shop_cipher=a&app_key=b&timestamp=${NOW}&sign=s`;
    const { items, problems } = parseBatchInput(search, NOW);
    expect(items).toEqual([]);
    expect(problems).toHaveLength(1);
  });

  it("recusa URL sem parâmetros de assinatura", () => {
    const { problems } = parseBatchInput("/product/202309/products/111", NOW);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.line).toBe(1);
  });

  it("marca assinatura expirada sem bloquear o item", () => {
    const { items, problems } = parseBatchInput(signed("111", NOW - 600), NOW);
    expect(problems).toEqual([]);
    expect(items[0]?.expired).toBe(true);
  });
});

function item(id: string): BatchItem {
  return parseBatchInput(signed(id), NOW).items[0] as BatchItem;
}

function ok(id: string): FetchResult<Product> {
  return {
    kind: "ok",
    response: { code: 0, message: "Success", request_id: "r" },
    data: { id },
  };
}

const NETWORK: FetchFailure = { kind: "network-error", message: "boom" };
const BAD_SIGN: FetchFailure = {
  kind: "api-error",
  httpStatus: 200,
  response: { code: 106001, message: "invalid sign", request_id: "r1" },
};

describe("runBatch", () => {
  it("devolve os resultados na ordem da entrada, não na de chegada", async () => {
    const items = ["1", "2", "3", "4"].map(item);
    // O primeiro demora mais que os outros.
    const fetchOne = async (i: BatchItem) => {
      await new Promise((r) => setTimeout(r, i.productId === "1" ? 20 : 1));
      return ok(i.productId);
    };
    const outcomes = await runBatch(items, fetchOne, { concurrency: 3 });
    expect(outcomes.map((o) => o.item.productId)).toEqual(["1", "2", "3", "4"]);
    expect(outcomes.every((o) => o.ok)).toBe(true);
  });

  it("nunca passa do limite de chamadas simultâneas", async () => {
    const items = Array.from({ length: 10 }, (_, i) => item(String(i + 1)));
    let inFlight = 0;
    let peak = 0;
    const fetchOne = async (i: BatchItem) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight -= 1;
      return ok(i.productId);
    };
    await runBatch(items, fetchOne, { concurrency: 3 });
    expect(peak).toBe(3);
  });

  it("repete falha transitória e para quando dá certo", async () => {
    const fetchOne = vi
      .fn<(i: BatchItem) => Promise<FetchResult<Product>>>()
      .mockResolvedValueOnce(NETWORK)
      .mockResolvedValueOnce(ok("1"));
    const sleep = vi.fn(async () => undefined);
    const outcomes = await runBatch([item("1")], fetchOne, { sleep });
    expect(fetchOne).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(outcomes[0]?.ok).toBe(true);
  });

  it("não repete assinatura inválida", async () => {
    const fetchOne = vi.fn(async () => BAD_SIGN as FetchResult<Product>);
    const outcomes = await runBatch([item("1")], fetchOne, { sleep: async () => undefined });
    expect(fetchOne).toHaveBeenCalledTimes(1);
    expect(outcomes[0]).toMatchObject({ ok: false });
  });

  it("desiste depois das tentativas extras", async () => {
    const fetchOne = vi.fn(async () => NETWORK as FetchResult<Product>);
    const outcomes = await runBatch([item("1")], fetchOne, {
      retries: 2,
      sleep: async () => undefined,
    });
    expect(fetchOne).toHaveBeenCalledTimes(3);
    expect(outcomes[0]?.ok).toBe(false);
  });

  it("para de iniciar itens quando interrompido", async () => {
    const controller = new AbortController();
    const items = Array.from({ length: 6 }, (_, i) => item(String(i + 1)));
    const fetchOne = async (i: BatchItem) => {
      if (i.productId === "2") controller.abort();
      return ok(i.productId);
    };
    const outcomes = await runBatch(items, fetchOne, { concurrency: 1, signal: controller.signal });
    expect(outcomes.map((o) => o.item.productId)).toEqual(["1", "2"]);
  });

  it("informa o progresso", async () => {
    const seen: number[] = [];
    await runBatch(["1", "2", "3"].map(item), async (i) => ok(i.productId), {
      concurrency: 1,
      onProgress: (done) => seen.push(done),
    });
    expect(seen).toEqual([1, 2, 3]);
  });
});

describe("falhas", () => {
  it("só rede, 429 e 5xx são transitórias", () => {
    expect(isTransient(NETWORK)).toBe(true);
    expect(isTransient({ kind: "http-error", httpStatus: 503, bodyText: "" })).toBe(true);
    expect(isTransient({ kind: "http-error", httpStatus: 404, bodyText: "" })).toBe(false);
    expect(isTransient(BAD_SIGN)).toBe(false);
  });

  it("descreve a falha de API com o request_id", () => {
    expect(describeFailure(BAD_SIGN)).toContain("r1");
    expect(describeFailure(BAD_SIGN)).toContain("106001");
  });
});
