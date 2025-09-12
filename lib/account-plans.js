export const ACCOUNT_PLANS = {
  "50": {
    label: "5K Challenge (Standard)",
    planType: "standard",
    accountSize: 5000,
    challengeTarget: 500,        // 10% of 5,000
    verificationTarget: 250,     // 5% of 5,000
    maxLoss: 500,                // 10% of 5,000
    cost: 50
  },
  "75": {
    label: "5K Challenge (Pro)",
    planType: "pro",
    accountSize: 5000,
    challengeTarget: 500,
    verificationTarget: 250,
    maxLoss: 500,
    cost: 75
  },
  "100": {
    label: "10K Challenge (Standard)",
    planType: "standard",
    accountSize: 10000,
    challengeTarget: 1000,       // 10% of 10,000
    verificationTarget: 500,     // 5% of 10,000
    maxLoss: 1000,               // 10% of 10,000
    cost: 100
  },
  "150": {
    label: "10K Challenge (Pro)",
    planType: "pro",
    accountSize: 10000,
    challengeTarget: 1000,
    verificationTarget: 500,
    maxLoss: 1000,
    cost: 150
  },
  "190": {
    label: "25K Challenge (Standard)",
    planType: "standard",
    accountSize: 25000,
    challengeTarget: 2500,       // 10% of 25,000
    verificationTarget: 1250,    // 5% of 25,000
    maxLoss: 2500,               // 10% of 25,000
    cost: 190
  },
  "285": {
    label: "25K Challenge (Pro)",
    planType: "pro",
    accountSize: 25000,
    challengeTarget: 2500,
    verificationTarget: 1250,
    maxLoss: 2500,
    cost: 285
  }
};
