import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FeeTaxBlock } from "./breakdown";
import { labelFrom, FEE_TAX_LABELS } from "../lib/statementLabels";
import { formatMoney, parseMoney } from "../lib/money";
import type { FeeTaxBreakdown } from "../types/tiktok";

/**
 * Este componente é o mesmo nas duas telas de finanças (extrato e a
 * liquidar), então testá-lo aqui cobre as duas de uma vez — e sem depender
 * do expansor de linha, que na renderização estática vem fechado.
 */
const label = labelFrom(FEE_TAX_LABELS);
const money = (raw: string) => formatMoney(parseMoney(raw), "BRL");

/** Tarifas de um pedido real de loja BR (586069337557206163). */
const TARIFAS_BR: FeeTaxBreakdown = {
  fee: {
    affiliate_commission_amount: "-16.08",
    affiliate_commission_before_pit_amount: "-16.08",
    pit_withheld_from_ads_commission_amount: "0",
    platform_commission_amount: "-11.35",
    sfp_service_fee_amount: "-11.35",
    transaction_fee_amount: "0",
  },
  tax: { vat_amount: "0", sales_tax_amount: "0" },
};

const render = (breakdown: FeeTaxBreakdown, total: string) =>
  renderToStaticMarkup(
    <FeeTaxBlock
      title="Tarifas e impostos"
      breakdown={breakdown}
      total={parseMoney(total)}
      totalField="est_fee_tax_amount"
      currency="BRL"
      labelFor={label}
    />,
  );

describe("FeeTaxBlock", () => {
  const html = render(TARIFAS_BR, "-44.78");

  it("fecha a conta na tela: soma das linhas + não detalhado = total", () => {
    expect(html).toContain("Soma das linhas acima");
    expect(html).toContain(money("-38.78"));
    expect(html).toContain("Cobrado sem detalhamento");
    expect(html).toContain(money("-6"));
    expect(html).toContain(money("-44.78"));
  });

  it("nomeia o campo da API no total, para procurar no JSON bruto", () => {
    expect(html).toContain("est_fee_tax_amount");
  });

  it("tira a comissão antes do IR das linhas que somam e a marca como recorte", () => {
    expect(html).toContain("Comissão de afiliado — recortes");
    expect(html).toContain("Não somam: são a mesma comissão acima");
  });

  it("omite a conferência quando as linhas fecham com o total", () => {
    // Sem diferença não há o que explicar, e o bloco extra só atrapalharia.
    const fechado = render(
      { fee: { platform_commission_amount: "-5.21", sfp_service_fee_amount: "-5.21" } },
      "-10.42",
    );
    expect(fechado).not.toContain("Cobrado sem detalhamento");
  });

  it("conta os campos zerados de fee e tax juntos", () => {
    // pit_withheld + transaction_fee + vat + sales_tax
    expect(html).toContain("+ 4 campo(s) zerado(s)");
  });
});
