// as of July 2026
export default taxRates = {
  PAYE_BANDS: [
    { upTo: 24000, rate: 0.1 },
    { upTo: 32333, rate: 0.25 },
    { upTo: 500000, rate: 0.3 },
    { upTo: 800000, rate: 0.325 },
    { upTo: Infinity, rate: 0.35 },
  ],
  PERSONAL_RELIEF: 2400,
  NSSF_TIER1_CEILING: 9000,
  NSSF_TIER1_RATE: 0.06,
  NSSF_TIER2_CEILING: 108000,
  NSSF_TIER2_RATE: 0.06,
  NSSF_MAX_TOTAL: 6480,
  SHIF_RATE: 0.0275,
  AHL_RATE: 0.015,
};
