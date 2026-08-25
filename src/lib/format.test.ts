import { describe, expect, it } from "vitest";
import { deadlineHint, formatAge } from "./format";

describe("formatAge", () => {
  it("passa a dias quando o prazo é longo demais para ler em horas", () => {
    expect(formatAge(30)).toBe("30s");
    expect(formatAge(90)).toBe("1 min");
    expect(formatAge(3 * 3600 + 600)).toBe("3h 10min");
    expect(formatAge(205 * 3600)).toBe("8d 13h");
  });
});

describe("deadlineHint", () => {
  const now = Date.UTC(2026, 7, 25, 12, 0, 0);

  it("mostra quanto falta para o prazo", () => {
    const hint = deadlineHint(now / 1000 + 2 * 3600, now);
    expect(hint).toEqual({ label: "faltam 2h 0min", overdue: false });
  });

  it("marca o prazo vencido", () => {
    const hint = deadlineHint(now / 1000 - 3 * 3600, now);
    expect(hint?.overdue).toBe(true);
    expect(hint?.label).toBe("vencido há 3h 0min");
  });

  it("ignora prazo ausente ou zerado", () => {
    expect(deadlineHint(undefined, now)).toBeUndefined();
    expect(deadlineHint(0, now)).toBeUndefined();
  });
});
