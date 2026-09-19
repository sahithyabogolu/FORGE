/* USD billions unless noted. Values are rounded from company annual reports. */

const FORGE_DATA = {
  apple: {
    name: "Apple Inc.",
    ticker: "AAPL",
    description: "Consumer technology, devices, services and software.",
    source:
      "Apple Forms 10-K for fiscal years ended September 2020–2024; amounts rounded to the nearest $0.1bn.",
    years: [2020, 2021, 2022, 2023, 2024],
    financials: {
      revenue: [274.5, 365.8, 394.3, 383.3, 391.0],
      grossProfit: [104.96, 152.84, 170.78, 169.15, 180.68],
      netIncome: [57.41, 94.68, 99.80, 97.00, 93.74],
      operatingCashFlow: [80.67, 104.04, 122.15, 110.54, 118.25],
      currentAssets: [143.7, 134.8, 135.4, 143.6, 152.99],
      currentLiabilities: [105.4, 125.5, 153.98, 145.3, 176.4],
      totalDebt: [112.4, 124.7, 120.1, 111.1, 106.6],
      equity: [65.3, 63.1, 50.7, 62.1, 57.0]
    }
  },

  microsoft: {
    name: "Microsoft Corporation",
    ticker: "MSFT",
    description:
      "Enterprise software, cloud infrastructure, devices and gaming.",
    source:
      "Microsoft Forms 10-K for fiscal years ended June 2020–2024; amounts rounded to the nearest $0.1bn.",
    years: [2020, 2021, 2022, 2023, 2024],
    financials: {
      revenue: [143.0, 168.1, 198.3, 211.9, 245.1],
      grossProfit: [96.9, 115.9, 135.6, 146.1, 171.0],
      netIncome: [44.3, 61.3, 72.7, 72.4, 88.3],
      operatingCashFlow: [60.7, 76.7, 89.0, 87.6, 118.5],
      currentAssets: [181.9, 184.4, 169.7, 184.3, 159.7],
      currentLiabilities: [72.3, 88.7, 95.1, 104.1, 125.3],
      totalDebt: [63.3, 67.6, 59.6, 47.2, 45.3],
      equity: [118.3, 141.0, 166.5, 206.2, 268.5]
    }
  },

  amazon: {
    name: "Amazon.com, Inc.",
    ticker: "AMZN",
    description:
      "E-commerce, cloud computing, advertising and digital services.",
    source:
      "Amazon Forms 10-K for fiscal years ended December 2020–2024; amounts rounded to the nearest $0.1bn.",
    years: [2020, 2021, 2022, 2023, 2024],
    financials: {
      revenue: [386.1, 469.8, 514.0, 574.8, 638.0],
      grossProfit: [152.8, 197.5, 225.2, 270.0, 311.7],
      netIncome: [21.3, 33.4, -2.7, 30.4, 59.2],
      operatingCashFlow: [66.1, 46.3, 46.8, 84.9, 115.9],
      currentAssets: [132.7, 161.6, 146.8, 172.4, 190.9],
      currentLiabilities: [126.4, 142.3, 155.4, 164.9, 179.0],
      totalDebt: [48.7, 50.4, 67.2, 67.2, 52.6],
      equity: [93.4, 138.2, 146.0, 201.9, 246.6]
    }
  }
};
