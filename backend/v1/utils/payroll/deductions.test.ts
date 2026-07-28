import { calculateDeduction } from "./deductions.js";

describe("calculateDeduction", () => {
  describe("PAYE", () => {
    it("returns 0 when tax owed is fully absorbed by personal relief", () => {
      expect(calculateDeduction("PAYE", 20000)).toBe(0);
    });

    it("returns 0 exactly at the first band boundary", () => {
      expect(calculateDeduction("PAYE", 24000)).toBe(0);
    });

    it("taxes across two bands", () => {
      expect(calculateDeduction("PAYE", 32333)).toBe(2083.25);
    });

    it("taxes across three bands", () => {
      expect(calculateDeduction("PAYE", 50000)).toBe(7383.35);
    });

    it("taxes across four bands", () => {
      expect(calculateDeduction("PAYE", 150000)).toBe(37383.35);
    });

    it("taxes across all five bands including the top rate", () => {
      expect(calculateDeduction("PAYE", 900000)).toBe(274883.35);
    });

    it("returns 0 for zero gross pay", () => {
      expect(calculateDeduction("PAYE", 0)).toBe(0);
    });
  });

  describe("NSSF", () => {
    it("applies only tier 1 when gross pay is below the tier 1 ceiling", () => {
      expect(calculateDeduction("NSSF", 9000)).toBe(540);
    });

    it("applies tier 1 and tier 2 when gross pay is between the ceilings", () => {
      expect(calculateDeduction("NSSF", 20000)).toBe(1200);
    });

    it("reaches the max total exactly at the tier 2 ceiling", () => {
      expect(calculateDeduction("NSSF", 108000)).toBe(6480);
    });

    it("caps at the max total above the tier 2 ceiling", () => {
      expect(calculateDeduction("NSSF", 200000)).toBe(6480);
    });

    it("returns 0 for zero gross pay", () => {
      expect(calculateDeduction("NSSF", 0)).toBe(0);
    });
  });

  describe("SHIF", () => {
    it("applies the flat SHIF rate to gross pay", () => {
      expect(calculateDeduction("SHIF", 50000)).toBe(1375);
    });

    it("returns 0 for zero gross pay", () => {
      expect(calculateDeduction("SHIF", 0)).toBe(0);
    });
  });

  describe("AHL", () => {
    it("applies the flat AHL rate to gross pay", () => {
      expect(calculateDeduction("AHL", 50000)).toBe(750);
    });

    it("returns 0 for zero gross pay", () => {
      expect(calculateDeduction("AHL", 0)).toBe(0);
    });
  });
});
