import { describe, expect, it } from "vitest";
import {
  addMoney,
  formatMoney,
  moneyEquals,
  parseMoney,
  percentOf,
  toDecimalString,
} from "./money";

describe("parseMoney", () => {
  it("lê os formatos que a API devolve", () => {
    expect(toDecimalString(parseMoney("17.65")!)).toBe("17.65");
    expect(toDecimalString(parseMoney("13.3")!)).toBe("13.30");
    expect(toDecimalString(parseMoney("0")!)).toBe("0.00");
    expect(toDecimalString(parseMoney("-1.5")!)).toBe("-1.50");
  });

  it("distingue campo ausente de zero", () => {
    expect(parseMoney(undefined)).toBeUndefined();
    expect(parseMoney("")).toBeUndefined();
    expect(parseMoney("abc")).toBeUndefined();
    expect(parseMoney("0")).toBe(0);
  });
});

describe("addMoney", () => {
  it("soma sem erro binário — é o que faz o total fechar", () => {
    // 0.1 + 0.2 em ponto flutuante daria 0.30000000000000004.
    const total = addMoney(parseMoney("0.1"), parseMoney("0.2"));
    expect(toDecimalString(total)).toBe("0.30");
    expect(moneyEquals(total, parseMoney("0.3")!)).toBe(true);
  });

  it("fecha a conta do pedido de exemplo", () => {
    const total = addMoney(parseMoney("17.65"), parseMoney("1.3"));
    expect(toDecimalString(total)).toBe("18.95");
  });
});

describe("percentOf", () => {
  it("arredonda ao centavo", () => {
    // 18.95 × 36% = 6.822
    expect(toDecimalString(percentOf(parseMoney("18.95")!, 36))).toBe("6.82");
  });
});

describe("formatMoney", () => {
  it("usa o padrão brasileiro para BRL", () => {
    // O separador de milhar do Intl é um espaço não separável.
    expect(formatMoney(parseMoney("17.65")!, "BRL").replace(/ /g, " ")).toBe("R$ 17,65");
  });

  it("não quebra com código de moeda inválido", () => {
    // O Intl lança RangeError em código fora do padrão ISO de 3 letras.
    expect(formatMoney(parseMoney("17.65")!, "R$")).toBe("17.65 R$");
  });

  it("campo ausente vira travessão em vez de zero", () => {
    expect(formatMoney(undefined, "BRL")).toBe("—");
  });
});
