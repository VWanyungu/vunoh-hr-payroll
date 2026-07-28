import taxRates from "../config/taxRate.js";

export type DeductionType = "PAYE" | "NSSF" | "SHIF" | "AHL";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculatePaye(grossPay: number): number {
  let tax = 0;
  let lowerBound = 0;

  for (const band of taxRates.PAYE_BANDS) {
    if (grossPay <= lowerBound) break;
    const taxableInBand = Math.min(grossPay, band.upTo) - lowerBound;
    tax += taxableInBand * band.rate;
    lowerBound = band.upTo;
  }

  if (tax - taxRates.PERSONAL_RELIEF <= 0) {
    return round2(0);
  }

  return round2(tax - taxRates.PERSONAL_RELIEF);
}

function calculateNssf(grossPay: number): number {
  // Tier 1: 6% of the first 9,000
  let tier1 = 0;
  if (grossPay <= taxRates.NSSF_TIER1_CEILING) {
    tier1 = grossPay * taxRates.NSSF_TIER1_RATE;
  } else {
    tier1 = taxRates.NSSF_TIER1_CEILING * taxRates.NSSF_TIER1_RATE;
  }

  // Tier 2: 6% of everything between 9,000 and 108,000
  let tier2 = 0;
  if (grossPay > taxRates.NSSF_TIER1_CEILING) {
    let tier2Amount = grossPay - taxRates.NSSF_TIER1_CEILING;

    // don't let tier 2 go above the tier 2 ceiling
    const tier2MaxAmount =
      taxRates.NSSF_TIER2_CEILING - taxRates.NSSF_TIER1_CEILING;
    if (tier2Amount > tier2MaxAmount) {
      tier2Amount = tier2MaxAmount;
    }

    tier2 = tier2Amount * taxRates.NSSF_TIER2_RATE;
  }

  let total = tier1 + tier2;

  // total NSSF can never go above the max cap
  if (total > taxRates.NSSF_MAX_TOTAL) {
    total = taxRates.NSSF_MAX_TOTAL;
  }

  return round2(total);
}

export function calculateDeduction(
  deductionType: DeductionType,
  grossPay: number,
): number {
  switch (deductionType) {
    case "PAYE":
      return calculatePaye(grossPay);
    case "NSSF":
      return calculateNssf(grossPay);
    case "SHIF":
      return round2(grossPay * taxRates.SHIF_RATE);
    case "AHL":
      return round2(grossPay * taxRates.AHL_RATE);
  }
}
