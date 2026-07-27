import { describe, expect, it } from "vitest";
import { parseAdSpendCsv } from "./ad-spend";

describe("ad spend CSV", () => {
  it("imports stable facts without inferring causality", () => {
    const parsed = parseAdSpendCsv(
      "data;kanał;kampania;koszt;waluta;wynik;kod/utm\n2026-01-02;Meta;Zima;123,45;PLN;4;ZIMA26",
      "meta.csv",
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.records[0]).toMatchObject({
      channel: "Meta",
      campaign: "Zima",
      cost: 123.45,
      result: 4,
      codeOrUtm: "ZIMA26",
    });
  });

  it("quarantines malformed rows", () => {
    const parsed = parseAdSpendCsv("data,kanał,kampania,koszt\nx,Meta,Zima,-2", "bad.csv");
    expect(parsed.records).toEqual([]);
    expect(parsed.errors).toHaveLength(1);
  });
});
