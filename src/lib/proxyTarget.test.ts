import { describe, expect, it, vi } from "vitest";
import { buildTargetUrl, proxyToTikTok } from "./proxyTarget";
import { TIKTOK_API_HOST } from "./signedUrl";

const SIGNED =
  "/product/202309/products/1736320032383141477?shop_cipher=ROW_16myjQAAAAD5rjMQTuL4qyrJEk0hdOrt&app_key=6h4meu9rp6vtm&timestamp=1787082661&sign=46d5d051";

describe("buildTargetUrl", () => {
  it("concatena o alvo ao host sem alterar a query", () => {
    const result = buildTargetUrl(SIGNED);
    expect(result).toEqual({ ok: true, url: `${TIKTOK_API_HOST}${SIGNED}` });
  });

  it("preserva caracteres percent-encoded byte a byte", () => {
    const target = "/p/1?a=%7Bx%2Fy%3D%26z%7D&sign=s";
    const result = buildTargetUrl(target);
    expect(result.ok && result.url.endsWith(target)).toBe(true);
  });

  it("recusa alvo ausente ou vazio", () => {
    expect(buildTargetUrl(undefined).ok).toBe(false);
    expect(buildTargetUrl(null).ok).toBe(false);
    expect(buildTargetUrl("").ok).toBe(false);
  });

  it("recusa alvo sem barra inicial", () => {
    expect(buildTargetUrl("product/x?sign=s").ok).toBe(false);
  });

  it("recusa alvo que tentaria apontar para outro host", () => {
    expect(buildTargetUrl("//evil.example.com/x").ok).toBe(false);
    expect(buildTargetUrl("/\\evil.example.com/x").ok).toBe(false);
    expect(buildTargetUrl("https://evil.example.com/x").ok).toBe(false);
  });

  it("recusa caracteres inválidos para header HTTP", () => {
    expect(buildTargetUrl("/p/1?a=com espaço").ok).toBe(false);
    expect(buildTargetUrl("/p/1?a=acentuação").ok).toBe(false);
  });
});

describe("proxyToTikTok", () => {
  it("encaminha o alvo intacto e repassa status e corpo do upstream", async () => {
    const fetchStub = vi.fn(
      async () =>
        new Response(JSON.stringify({ code: 0, message: "Success", request_id: "abc" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const outcome = await proxyToTikTok(
      { method: "GET", target: SIGNED, accessToken: "ROW_token" },
      fetchStub as unknown as typeof fetch,
    );

    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(`${TIKTOK_API_HOST}${SIGNED}`);
    expect(init.redirect).toBe("manual");
    expect((init.headers as Record<string, string>)["x-tts-access-token"]).toBe("ROW_token");
    expect(outcome.status).toBe(200);
    expect(JSON.parse(outcome.body)).toMatchObject({ code: 0 });
  });

  it("devolve 400 com proxy_error quando o alvo é inválido", async () => {
    const outcome = await proxyToTikTok({ method: "GET", target: "", accessToken: "t" });
    expect(outcome.status).toBe(400);
    expect(JSON.parse(outcome.body)).toMatchObject({ proxy_error: true });
  });

  it("devolve 405 para método diferente de GET", async () => {
    const outcome = await proxyToTikTok({ method: "POST", target: SIGNED, accessToken: "t" });
    expect(outcome.status).toBe(405);
  });

  it("devolve 502 quando o upstream está inalcançável", async () => {
    const failing = vi.fn(async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    });
    const outcome = await proxyToTikTok(
      { method: "GET", target: SIGNED, accessToken: "t" },
      failing as unknown as typeof fetch,
    );
    expect(outcome.status).toBe(502);
    expect(JSON.parse(outcome.body)).toMatchObject({ proxy_error: true });
  });

  it("repassa erro da API do TikTok sem interpretar", async () => {
    const fetchStub = vi.fn(
      async () =>
        new Response(JSON.stringify({ code: 106001, message: "invalid sign", request_id: "r1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const outcome = await proxyToTikTok(
      { method: "GET", target: SIGNED, accessToken: "t" },
      fetchStub as unknown as typeof fetch,
    );
    expect(JSON.parse(outcome.body)).toMatchObject({ code: 106001, request_id: "r1" });
  });
});
