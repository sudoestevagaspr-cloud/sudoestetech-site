import { describe, expect, it } from "vitest";
import { diaEmBrasilia, diasEntre, ehNova, formatarData } from "@/lib/datas";

describe("diaEmBrasilia", () => {
  it("usa o dia de Brasília, não o de UTC", () => {
    // 23h de 05/12 em Brasília já é 06/12 em UTC.
    expect(diaEmBrasilia("2026-12-06T02:00:00Z")).toBe("2026-12-05");
    expect(diaEmBrasilia("2026-12-06T03:00:00Z")).toBe("2026-12-06");
  });
});

describe("formatarData", () => {
  it("mostra no formato brasileiro sem mudar o dia", () => {
    expect(formatarData("2026-12-05")).toBe("05/12/2026");
    expect(formatarData("2027-01-01")).toBe("01/01/2027");
  });
});

describe("diasEntre", () => {
  it("conta dias corridos, inclusive na virada do mês e do ano", () => {
    expect(diasEntre("2026-11-30", "2026-12-01")).toBe(1);
    expect(diasEntre("2026-12-25", "2027-01-08")).toBe(14);
    expect(diasEntre("2026-12-05", "2026-12-05")).toBe(0);
  });
});

describe("selo Nova (7 dias, decisão 20)", () => {
  const publicada = "2026-11-20T13:00:00Z"; // 20/11 às 10h em Brasília

  it("aparece do dia da publicação até o sexto dia depois", () => {
    expect(ehNova(publicada, "2026-11-20")).toBe(true);
    expect(ehNova(publicada, "2026-11-26")).toBe(true);
  });

  it("some no sétimo dia", () => {
    expect(ehNova(publicada, "2026-11-27")).toBe(false);
  });

  it("vale o dia em Brasília: publicada às 22h30 de 20/11 conta como 20/11", () => {
    expect(ehNova("2026-11-21T01:30:00Z", "2026-11-26")).toBe(true);
    expect(ehNova("2026-11-21T01:30:00Z", "2026-11-27")).toBe(false);
  });
});
