# FORGE — Financial Intelligence Engine

**Turn financial filings into structured financial insight.**

FORGE is a browser-based financial analysis platform designed to transform structured 10-K financial data into understandable financial metrics, trends, risk indicators, and investor-focused observations.

The project is built as a lightweight static web application that can be hosted directly through GitHub Pages.

## What FORGE Does

FORGE takes financial statement data and converts it into:

- Revenue and profitability analysis
- Gross and net margins
- Operating cash flow analysis
- Liquidity analysis
- Debt-to-equity analysis
- Cash conversion analysis
- Historical financial trends
- Financial risk indicators
- Going-concern indicators
- Structured investor observations
- Financial statistics and methodology

The application distinguishes between **reported financial figures** and **metrics calculated by FORGE**.

## How It Works

```text
10-K / Financial Data
        ↓
Data Normalisation
        ↓
FORGE Calculation Engine
        ↓
Financial Metrics
        ↓
Trend Analysis
        ↓
Risk Indicators
        ↓
Investor Analysis
```

All calculations are performed directly in the browser.

## Technology

FORGE is intentionally built without a backend or complicated development stack.

- HTML5
- CSS3
- Vanilla JavaScript
- GitHub Pages
- Browser-side calculations
- Bundled financial dataset

No Node.js, database, authentication server, or API key is required for the presentation version.

## Data Architecture

The presentation version uses a curated dataset bundled with the application.

This approach avoids relying on direct browser-side requests to external financial APIs and makes the application more reliable when demonstrated through GitHub Pages.

The underlying financial information is intended to be based on company filings and structured financial data. FORGE then performs its own calculations using documented formulas.

## Key Calculations

### Gross Margin

```text
Gross Profit ÷ Revenue × 100
```

### Net Margin

```text
Net Income ÷ Revenue × 100
```

### Current Ratio

```text
Current Assets ÷ Current Liabilities
```

### Debt-to-Equity

```text
Total Debt ÷ Shareholders' Equity
```

For FORGE, total debt is defined as short-term borrowings plus long-term debt where those components are available.

### Cash Conversion

```text
Operating Cash Flow ÷ Net Income × 100
```

### Percentage-Point Change

Margin changes are presented in percentage points rather than incorrectly treating them as percentage changes.

For example:

```text
40% → 42% = +2 percentage points
```

## Investor Analysis

FORGE does not produce a simplistic BUY or SELL recommendation.

Instead, it identifies and explains financial observations such as:

1. Revenue trajectory
2. Profitability
3. Cash generation
4. Liquidity
5. Leverage
6. Earnings-to-cash conversion
7. Margin pressure
8. Capital structure
9. Going-concern indicators
10. Key financial observations

The purpose is to help users understand the financial information rather than replace professional investment judgment.

## Risk Analysis

FORGE evaluates individual financial indicators rather than assigning an arbitrary overall risk score.

Examples include:

- Liquidity requiring attention
- Increasing leverage
- Weakening margins
- Operating cash flow below net income
- Declining profitability
- Potential going-concern indicators

Each indicator is accompanied by an explanation based on the underlying financial data.

## Current Scope

The current version is a **static academic project and functional base model**, rather than a production financial-data platform.

Its architecture can be expanded in the future to support:

- Automated SEC/EDGAR data retrieval
- Broader company coverage
- Direct 10-K document ingestion
- XBRL parsing
- Automated filing extraction
- More advanced financial analysis
- Natural-language processing
- Larger historical datasets
- Backend data services
- Automated report generation

## Limitations

Because FORGE is intentionally deployed as a static GitHub Pages application, the presentation version does not depend on a live backend or direct SEC API requests.

The bundled dataset is therefore limited to the companies and financial periods included with the project.

This is an architectural choice made to ensure reliable demonstration and reproducible calculations.

## Project Structure

```text
FORGE/
│
├── index.html     # Application structure
├── style.css      # Interface and visual design
├── app.js         # Application logic and calculations
├── data.js        # Financial dataset
└── README.md      # Project documentation
```

## Design

FORGE uses a restrained dark interface designed around:

- Near-black backgrounds
- Charcoal panels
- Grey borders
- Off-white typography
- Minimal visual noise
- Data-focused layouts

The interface is designed to prioritise financial information rather than decorative elements.

## Authors

**Sahithya & Yukti**

## Project Status

**Academic project — functional static base model**

FORGE demonstrates how financial statement data can be transformed into structured financial analysis using only client-side web technologies.

It is intended as a foundation that could be developed into a substantially more capable financial intelligence platform with live data infrastructure and additional computational resources.
