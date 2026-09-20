```python
import streamlit as st
from google import genai
from pypdf import PdfReader
import pandas as pd
import json
import re
import math


# ============================================================
# FORGE — FINANCIAL INTELLIGENCE ENGINE
# Browser/UI layer: Streamlit
# AI: Google Gemini
# PDF extraction: pypdf
# Calculations: Python
# ============================================================


# ------------------------------------------------------------
# 1. PAGE CONFIGURATION
# ------------------------------------------------------------

st.set_page_config(
    page_title="FORGE — Financial Intelligence Engine",
    page_icon="◆",
    layout="wide",
    initial_sidebar_state="expanded"
)


# ------------------------------------------------------------
# 2. PROFESSIONAL DARK UI
# ------------------------------------------------------------

st.markdown(
    """
    <style>
        .stApp {
            background-color: #0b0c0d;
            color: #e5e7eb;
        }

        section[data-testid="stSidebar"] {
            background-color: #121416;
            border-right: 1px solid #292d31;
        }

        h1, h2, h3, h4 {
            color: #e5e7eb !important;
            font-weight: 600 !important;
        }

        p, li, label {
            color: #a4a8ae !important;
        }

        .metric-card {
            background: #151719;
            border: 1px solid #292d31;
            border-radius: 8px;
            padding: 16px;
            min-height: 105px;
        }

        .source-card {
            background: #111315;
            border: 1px solid #292d31;
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 10px;
        }

        .warning-card {
            background: #171514;
            border: 1px solid #3b3430;
            border-radius: 8px;
            padding: 15px;
        }

        .success-card {
            background: #131615;
            border: 1px solid #29322f;
            border-radius: 8px;
            padding: 15px;
        }

        .small-muted {
            color: #777c83;
            font-size: 0.85rem;
        }

        hr {
            border-color: #292d31;
        }

        [data-testid="stMetric"] {
            background-color: #151719;
            border: 1px solid #292d31;
            padding: 14px;
            border-radius: 8px;
        }

        [data-testid="stMetricLabel"] {
            color: #8d9299 !important;
        }

        [data-testid="stMetricValue"] {
            color: #e5e7eb !important;
        }
    </style>
    """,
    unsafe_allow_html=True
)


# ------------------------------------------------------------
# 3. HEADER / SIDEBAR
# ------------------------------------------------------------

st.sidebar.title("FORGE ENGINE")
st.sidebar.caption("Financial Intelligence Interface")

api_key = st.sidebar.text_input(
    "Gemini API Key",
    type="password",
    help="Required to run the AI extraction and analysis."
)

uploaded_file = st.sidebar.file_uploader(
    "Upload SEC Form 10-K",
    type=["pdf"]
)

st.sidebar.markdown("---")

st.sidebar.caption(
    "FORGE analyzes the uploaded filing only. "
    "It does not use sample financial values."
)

st.title("FORGE — Financial Intelligence Engine")
st.caption(
    "Convert unstructured 10-K filings into structured financial data, "
    "calculated ratios, source references and investor-oriented analysis."
)

st.markdown("---")


# ------------------------------------------------------------
# 4. SAFE NUMERIC HELPERS
# ------------------------------------------------------------

def clean_number(value):
    """
    Convert common financial-number formats into Python floats.

    Handles:
        1,234
        $1,234
        (1,234)
        -1,234
        12.4
        N/A
        None
    """

    if value is None:
        return None

    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return None
        return float(value)

    text = str(value).strip()

    if not text:
        return None

    if text.upper() in {
        "N/A",
        "NA",
        "NONE",
        "NULL",
        "NOT AVAILABLE",
        "NOT REPORTED",
        "MISSING"
    }:
        return None

    negative = False

    if text.startswith("(") and text.endswith(")"):
        negative = True
        text = text[1:-1]

    text = (
        text
        .replace("$", "")
        .replace("€", "")
        .replace("£", "")
        .replace(",", "")
        .replace("%", "")
        .strip()
    )

    try:
        number = float(text)
        return -number if negative else number
    except ValueError:
        return None


def safe_divide(a, b):
    """Return None instead of producing an invalid ratio."""
    if a is None or b is None:
        return None

    if b == 0:
        return None

    return a / b


def format_money(value, currency="USD", scale=1):
    """
    Format a normalized monetary value.

    The internal calculations use actual currency units.
    """

    if value is None:
        return "N/A"

    symbols = {
        "USD": "$",
        "EUR": "€",
        "GBP": "£",
        "INR": "₹"
    }

    symbol = symbols.get(currency.upper(), currency + " ")

    if abs(value) >= 1_000_000_000:
        return f"{symbol}{value / 1_000_000_000:,.2f}B"

    if abs(value) >= 1_000_000:
        return f"{symbol}{value / 1_000_000:,.2f}M"

    if abs(value) >= 1_000:
        return f"{symbol}{value / 1_000:,.2f}K"

    return f"{symbol}{value:,.2f}"


def format_ratio(value):
    if value is None:
        return "N/A"
    return f"{value:.2f}x"


def format_percent(value):
    if value is None:
        return "N/A"
    return f"{value:.2f}%"


# ------------------------------------------------------------
# 5. PDF EXTRACTION
# ------------------------------------------------------------

def extract_pdf_text(uploaded_pdf):
    """
    Extract ALL readable pages from the PDF.

    Page numbers are explicitly retained so the AI can cite
    source locations.
    """

    reader = PdfReader(uploaded_pdf)

    pages = []
    total_pages = len(reader.pages)

    for index, page in enumerate(reader.pages, start=1):

        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""

        page_text = page_text.strip()

        if page_text:
            pages.append(
                f"\n--- PAGE {index} ---\n{page_text}\n"
            )

    full_text = "\n".join(pages)

    return full_text, total_pages, len(pages)


# ------------------------------------------------------------
# 6. IDENTIFY RELEVANT FINANCIAL PAGES
# ------------------------------------------------------------

def extract_relevant_sections(full_text):
    """
    Keep the complete extracted text available, but prioritize
    pages that contain financially important sections.

    This is NOT based on a single fixed 10-K template.
    Different companies and filings organize their reports differently.
    """

    keywords = [
        "consolidated balance sheets",
        "consolidated statements of operations",
        "statements of operations",
        "statements of income",
        "statements of cash flows",
        "cash flows",
        "balance sheets",
        "income statements",
        "revenue",
        "net income",
        "gross profit",
        "current assets",
        "current liabilities",
        "long-term debt",
        "total debt",
        "stockholders' equity",
        "shareholders' equity",
        "liquidity",
        "going concern",
        "material uncertainty",
        "independent registered public accounting firm",
        "auditor"
    ]

    pages = re.split(r"--- PAGE (\d+) ---", full_text)

    relevant_pages = []

    # pages structure:
    # ["", page_number, page_text, page_number, page_text, ...]

    for i in range(1, len(pages), 2):

        page_number = pages[i]
        page_text = pages[i + 1]

        lower_text = page_text.lower()

        if any(keyword in lower_text for keyword in keywords):
            relevant_pages.append(
                f"--- PAGE {page_number} ---\n{page_text}"
            )

    return "\n".join(relevant_pages)


# ------------------------------------------------------------
# 7. GEMINI EXTRACTION PROMPT
# ------------------------------------------------------------

def build_extraction_prompt(relevant_text):

    return f"""
You are FORGE's financial-document extraction engine.

You are analyzing ONE uploaded SEC Form 10-K.

IMPORTANT:
- Extract facts from the supplied filing only.
- Do not invent, estimate, interpolate or guess financial values.
- Every number must correspond to something actually present in the filing.
- Every financial figure must retain its fiscal year.
- Identify the reporting currency.
- Identify whether the filing reports figures in units, thousands, millions or billions.
- Preserve negative numbers.
- Parentheses normally indicate negative values.
- If a value genuinely cannot be established from the supplied filing, use null.
- Do NOT use 0 to represent missing data.
- Do not assume that all 10-K filings use the same table layout.
- The supplied filing is the source. Any example 10-K structure should be treated only as an example of possible filing organization, NOT as a universal template for every 10-K.
- Different companies may place the same information in different sections, tables, pages or formats.

FISCAL YEAR RULE:
Determine the company's actual fiscal-year-end from the filing.
Do not assume that the fiscal year ends on December 31.
Do not assume that the first numeric column is the latest fiscal year.
Explicitly map each value to its correct fiscal year.

UNIT RULE:
If the statement says:
"$ in millions"
"$ in thousands"
"$ in billions"
or another scale,
capture that scale explicitly.

SOURCE RULE:
For each important financial value, provide the page number where the value was found.
Use the page number included in the supplied text markers such as "--- PAGE 87 ---".

RETURN ONLY VALID JSON.

Required JSON structure:

{{
  "company_name": null,
  "form_type": "10-K",
  "fiscal_year_end": null,
  "currency": null,
  "reporting_scale": "units | thousands | millions | billions | unknown",

  "fiscal_years": [],

  "financials": {{
    "revenue": {{
      "values": [],
      "source": []
    }},
    "cost_of_revenue": {{
      "values": [],
      "source": []
    }},
    "gross_profit": {{
      "values": [],
      "source": []
    }},
    "operating_income": {{
      "values": [],
      "source": []
    }},
    "net_income": {{
      "values": [],
      "source": []
    }},
    "current_assets": {{
      "values": [],
      "source": []
    }},
    "current_liabilities": {{
      "values": [],
      "source": []
    }},
    "total_assets": {{
      "values": [],
      "source": []
    }},
    "total_liabilities": {{
      "values": [],
      "source": []
    }},
    "total_debt": {{
      "values": [],
      "source": []
    }},
    "shareholders_equity": {{
      "values": [],
      "source": []
    }},
    "operating_cash_flow": {{
      "values": [],
      "source": []
    }},
    "capital_expenditures": {{
      "values": [],
      "source": []
    }}
  }},

  "auditor": {{
    "name": null,
    "opinion_type": null,
    "going_concern_disclosure": null,
    "going_concern_source_page": null
  }},

  "liquidity": {{
    "explicit_liquidity_concern": null,
    "source_pages": []
  }},

  "notes": []
}}

For "values", use objects in this form:

{{
  "fiscal_year": "2025",
  "value": 12345.0,
  "source_page": 87,
  "source_label": "Revenue"
}}

If unavailable:

{{
  "fiscal_year": "2025",
  "value": null,
  "source_page": null,
  "source_label": null
}}

DOCUMENT CONTENT:

{relevant_text}
"""


# ------------------------------------------------------------
# 8. CLEAN GEMINI JSON
# ------------------------------------------------------------

def extract_json_from_response(text):

    if not text:
        raise ValueError("Gemini returned an empty response.")

    text = text.strip()

    # Remove markdown fences if Gemini adds them.
    text = re.sub(r"^```json\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:

        # Attempt to locate the outer JSON object.
        start = text.find("{")
        end = text.rfind("}")

        if start >= 0 and end > start:
            candidate = text[start:end + 1]
            return json.loads(candidate)

        raise ValueError(
            "Gemini returned text that could not be parsed as JSON."
        )


# ------------------------------------------------------------
# 9. FIND VALUE FOR A PARTICULAR FISCAL YEAR
# ------------------------------------------------------------

def get_year_value(metric_object, fiscal_year):
    if not metric_object:
        return None

    values = metric_object.get("values", [])

    for item in values:

        if not isinstance(item, dict):
            continue

        item_year = str(item.get("fiscal_year", "")).strip()

        if item_year == str(fiscal_year):
            return clean_number(item.get("value"))

    return None


# ------------------------------------------------------------
# 10. NORMALIZE MONETARY VALUES
# ------------------------------------------------------------

def scale_multiplier(scale):
    if not scale:
        return 1

    scale = scale.lower().strip()

    if "billion" in scale:
        return 1_000_000_000

    if "million" in scale:
        return 1_000_000

    if "thousand" in scale:
        return 1_000

    return 1


def normalize_financials(data):

    multiplier = scale_multiplier(
        data.get("reporting_scale", "units")
    )

    fiscal_years = data.get("fiscal_years", [])

    # Sort newest first when years are numeric.
    try:
        fiscal_years = sorted(
            fiscal_years,
            key=lambda x: int(str(x)),
            reverse=True
        )
    except Exception:
        pass

    financials = data.get("financials", {})

    normalized = {}

    monetary_metrics = [
        "revenue",
        "cost_of_revenue",
        "gross_profit",
        "operating_income",
        "net_income",
        "current_assets",
        "current_liabilities",
        "total_assets",
        "total_liabilities",
        "total_debt",
        "shareholders_equity",
        "operating_cash_flow",
        "capital_expenditures"
    ]

    for metric in monetary_metrics:

        normalized[metric] = {}

        for year in fiscal_years:

            raw_value = get_year_value(
                financials.get(metric),
                year
            )

            if raw_value is None:
                normalized[metric][str(year)] = None
            else:
                normalized[metric][str(year)] = (
                    raw_value * multiplier
                )

    return fiscal_years, normalized


# ------------------------------------------------------------
# 11. CALCULATE FINANCIAL METRICS
# ------------------------------------------------------------

def calculate_metrics(fiscal_years, financials):

    results = {}

    for index, year in enumerate(fiscal_years):

        year = str(year)

        revenue = financials["revenue"].get(year)
        cost = financials["cost_of_revenue"].get(year)
        gross_profit = financials["gross_profit"].get(year)
        operating_income = financials["operating_income"].get(year)
        net_income = financials["net_income"].get(year)
        current_assets = financials["current_assets"].get(year)
        current_liabilities = financials["current_liabilities"].get(year)
        total_debt = financials["total_debt"].get(year)
        equity = financials["shareholders_equity"].get(year)
        operating_cf = financials["operating_cash_flow"].get(year)
        capex = financials["capital_expenditures"].get(year)

        # If gross profit is not directly reported but both
        # revenue and cost of revenue are available, calculate it.
        if gross_profit is None:
            if revenue is not None and cost is not None:
                gross_profit = revenue - cost

        current_ratio = safe_divide(
            current_assets,
            current_liabilities
        )

        debt_to_equity = safe_divide(
            total_debt,
            equity
        )

        gross_margin = safe_divide(
            gross_profit,
            revenue
        )

        operating_margin = safe_divide(
            operating_income,
            revenue
        )

        net_margin = safe_divide(
            net_income,
            revenue
        )

        operating_cash_flow_margin = safe_divide(
            operating_cf,
            revenue
        )

        free_cash_flow = None

        if operating_cf is not None and capex is not None:
            free_cash_flow = operating_cf - abs(capex)

        revenue_growth = None

        # fiscal_years is newest -> oldest.
        # Therefore the next item is the previous fiscal year.
        if index + 1 < len(fiscal_years):

            previous_year = str(fiscal_years[index + 1])

            previous_revenue = financials[
                "revenue"
            ].get(previous_year)

            if previous_revenue not in (None, 0):
                revenue_growth = (
                    (revenue - previous_revenue)
                    / abs(previous_revenue)
                ) if revenue is not None else None

        results[year] = {
            "revenue": revenue,
            "gross_profit": gross_profit,
            "operating_income": operating_income,
            "net_income": net_income,
            "operating_cash_flow": operating_cf,
            "current_ratio": current_ratio,
            "debt_to_equity": debt_to_equity,
            "gross_margin": gross_margin,
            "operating_margin": operating_margin,
            "net_margin": net_margin,
            "operating_cash_flow_margin": operating_cash_flow_margin,
            "free_cash_flow": free_cash_flow,
            "revenue_growth": revenue_growth
        }

    return results


# ------------------------------------------------------------
# 12. BUILD ANALYSIS PROMPT FROM VERIFIED NUMBERS
# ------------------------------------------------------------

def build_analysis_prompt(data, calculated, fiscal_years):

    company = data.get("company_name") or "the company"

    currency = data.get("currency") or "unknown"

    latest_year = (
        str(fiscal_years[0])
        if fiscal_years
        else "unknown"
    )

    latest = calculated.get(latest_year, {})

    return f"""
You are FORGE's financial analysis layer.

Analyze {company} using ONLY the verified extracted values and
Python-calculated metrics supplied below.

Do not invent financial values.
Do not change fiscal years.
Do not recalculate the supplied values differently.
Do not call a company distressed solely because it has one weak metric.
Do not claim that a going-concern disclosure exists unless the
source extraction explicitly identifies one.

This is an analytical explanation, not personalized investment advice.

COMPANY:
{company}

CURRENCY:
{currency}

FISCAL YEARS:
{fiscal_years}

LATEST FISCAL YEAR:
{latest_year}

VERIFIED/CALCULATED DATA:
{json.dumps(latest, indent=2)}

AUDITOR DATA:
{json.dumps(data.get("auditor", {}), indent=2)}

LIQUIDITY DATA:
{json.dumps(data.get("liquidity", {}), indent=2)}

Provide the following sections:

### INVESTOR ANALYSIS

Explain the company's financial position using the supplied numbers.
Discuss profitability, liquidity, leverage and cash generation where
data is available.

### RISK EVALUATION

Separate:
1. Observed financial risk indicators.
2. Explicit auditor going-concern disclosure, if any.

Do not confuse financial weakness with an auditor going-concern opinion.

### TOP 10 CRITICAL INSIGHTS

Provide exactly 10 concise factual bullet points.
Do not invent numbers.

### GOING CONCERN STATUS & STATISTICS

State:
- Whether an explicit going-concern/material-uncertainty disclosure
  was identified.
- The source page if available.
- Relevant financial indicators that may provide context.

### DATA LIMITATIONS

Clearly identify important figures that could not be extracted or
verified.

Use the actual fiscal years and never replace them with generic labels
such as "Year 1" or "Year 2".
"""


# ------------------------------------------------------------
# 13. APPLICATION
# ------------------------------------------------------------

if uploaded_file and api_key:

    try:

        # ----------------------------------------------------
        # PDF
        # ----------------------------------------------------

        with st.spinner(
            "FORGE: Reading and indexing the complete 10-K..."
        ):

            raw_text, total_pages, readable_pages = (
                extract_pdf_text(uploaded_file)
            )

        if readable_pages == 0:

            st.error(
                "FORGE could not extract readable text from this PDF. "
                "This may be a scanned/image-only filing."
            )

            st.stop()

        st.success(
            f"PDF processed: {total_pages} total pages, "
            f"{readable_pages} pages containing readable text."
        )

        # ----------------------------------------------------
        # RELEVANT SECTIONS
        # ----------------------------------------------------

        relevant_text = extract_relevant_sections(raw_text)

        if len(relevant_text) < 500:

            st.warning(
                "Only limited financial-section text was detected. "
                "The filing may require OCR or have an unusual structure."
            )

            relevant_text = raw_text

        # Avoid arbitrary 85,000-character truncation.
        #
        # Instead, use the relevant financial sections first.
        #
        # Gemini still has context limitations, so if an unusually
        # large filing exceeds the model context, the user is informed.
        if len(relevant_text) > 180000:

            st.warning(
                "The filing contains an unusually large amount of "
                "relevant extracted text. FORGE is prioritizing the "
                "financially relevant sections rather than blindly "
                "truncating the first pages."
            )

            relevant_text = relevant_text[:180000]

        # ----------------------------------------------------
        # GEMINI CLIENT
        # ----------------------------------------------------

        client = genai.Client(api_key=api_key)

        # ----------------------------------------------------
        # STRUCTURED EXTRACTION
        # ----------------------------------------------------

        with st.spinner(
            "FORGE: Extracting fiscal years, units, financial statements "
            "and source references..."
        ):

            extraction_prompt = build_extraction_prompt(
                relevant_text
            )

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=extraction_prompt,
                config={
                    "temperature": 0
                }
            )

            extraction_data = extract_json_from_response(
                response.text
            )

        # ----------------------------------------------------
        # BASIC VALIDATION
        # ----------------------------------------------------

        company_name = (
            extraction_data.get("company_name")
            or "Company not identified"
        )

        fiscal_years, normalized_financials = (
            normalize_financials(extraction_data)
        )

        if not fiscal_years:

            st.error(
                "FORGE could not confidently identify the filing's "
                "fiscal years. No financial dashboard was generated."
            )

            st.stop()

        # ----------------------------------------------------
        # CALCULATIONS
        # ----------------------------------------------------

        calculated = calculate_metrics(
            fiscal_years,
            normalized_financials
        )

        latest_year = str(fiscal_years[0])

        latest = calculated.get(latest_year, {})

        currency = (
            extraction_data.get("currency")
            or "USD"
        )

        scale = (
            extraction_data.get("reporting_scale")
            or "unknown"
        )

        # ----------------------------------------------------
        # SECOND AI PASS — INTERPRETATION
        # ----------------------------------------------------

        with st.spinner(
            "FORGE: Generating analysis from verified financial data..."
        ):

            analysis_prompt = build_analysis_prompt(
                extraction_data,
                calculated,
                fiscal_years
            )

            analysis_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=analysis_prompt,
                config={
                    "temperature": 0.2
                }
            )

            analysis_text = analysis_response.text

        # ----------------------------------------------------
        # COMPANY / FILING INFORMATION
        # ----------------------------------------------------

        st.subheader("Filing Overview")

        overview_col1, overview_col2, overview_col3, overview_col4 = (
            st.columns(4)
        )

        with overview_col1:
            st.metric(
                "Company",
                company_name
            )

        with overview_col2:
            st.metric(
                "Latest Fiscal Year",
                latest_year
            )

        with overview_col3:
            st.metric(
                "Currency",
                currency
            )

        with overview_col4:
            st.metric(
                "Statement Scale",
                scale.title()
            )

        st.markdown("---")

        # ----------------------------------------------------
        # FINANCIAL DASHBOARD
        # ----------------------------------------------------

        st.subheader(
            f"Core Financial Dashboard — FY{latest_year}"
        )

        c1, c2, c3, c4 = st.columns(4)

        with c1:
            st.metric(
                "Revenue",
                format_money(
                    latest.get("revenue"),
                    currency
                )
            )

        with c2:
            st.metric(
                "Gross Profit",
                format_money(
                    latest.get("gross_profit"),
                    currency
                )
            )

        with c3:
            st.metric(
                "Net Income",
                format_money(
                    latest.get("net_income"),
                    currency
                )
            )

        with c4:
            st.metric(
                "Operating Cash Flow",
                format_money(
                    latest.get("operating_cash_flow"),
                    currency
                )
            )

        c5, c6, c7, c8 = st.columns(4)

        with c5:
            st.metric(
                "Current Ratio",
                format_ratio(
                    latest.get("current_ratio")
                )
            )

        with c6:
            st.metric(
                "Debt / Equity",
                format_ratio(
                    latest.get("debt_to_equity")
                )
            )

        with c7:
            st.metric(
                "Net Margin",
                format_percent(
                    (latest.get("net_margin") * 100)
                    if latest.get("net_margin") is not None
                    else None
                )
            )

        with c8:
            st.metric(
                "Revenue Growth",
                format_percent(
                    (latest.get("revenue_growth") * 100)
                    if latest.get("revenue_growth") is not None
                    else None
                )
            )

        st.markdown("---")

        # ----------------------------------------------------
        # MULTI-YEAR TABLE
        # ----------------------------------------------------

        st.subheader("Historical Financial Comparison")

        historical_rows = []

        for year in fiscal_years:

            values = calculated.get(str(year), {})

            historical_rows.append(
                {
                    "Fiscal Year": str(year),
                    "Revenue": values.get("revenue"),
                    "Gross Profit": values.get("gross_profit"),
                    "Operating Income": values.get(
                        "operating_income"
                    ),
                    "Net Income": values.get("net_income"),
                    "Operating Cash Flow": values.get(
                        "operating_cash_flow"
                    ),
                    "Current Ratio": values.get(
                        "current_ratio"
                    ),
                    "Debt / Equity": values.get(
                        "debt_to_equity"
                    )
                }
            )

        historical_df = pd.DataFrame(
            historical_rows
        )

        display_df = historical_df.copy()

        monetary_columns = [
            "Revenue",
            "Gross Profit",
            "Operating Income",
            "Net Income",
            "Operating Cash Flow"
        ]

        for column in monetary_columns:

            display_df[column] = display_df[column].apply(
                lambda x: format_money(
                    x,
                    currency
                )
            )

        for column in [
            "Current Ratio",
            "Debt / Equity"
        ]:

            display_df[column] = display_df[column].apply(
                format_ratio
            )

        st.dataframe(
            display_df,
            use_container_width=True,
            hide_index=True
        )

        # ----------------------------------------------------
        # CHARTS
        # ----------------------------------------------------

        st.subheader("Financial Trends")

        chart_col1, chart_col2 = st.columns(2)

        chart_years = [
            str(year)
            for year in reversed(fiscal_years)
        ]

        with chart_col1:

            chart_rows = []

            for year in chart_years:

                values = calculated.get(year, {})

                chart_rows.append(
                    {
                        "Fiscal Year": year,
                        "Revenue": values.get("revenue"),
                        "Gross Profit": values.get(
                            "gross_profit"
                        ),
                        "Net Income": values.get(
                            "net_income"
                        ),
                        "Operating Cash Flow": values.get(
                            "operating_cash_flow"
                        )
                    }
                )

            financial_chart = pd.DataFrame(
                chart_rows
            )

            if not financial_chart.empty:

                financial_chart = financial_chart.set_index(
                    "Fiscal Year"
                )

                st.write("#### Profitability & Cash Generation")

                st.line_chart(
                    financial_chart
                )

        with chart_col2:

            ratio_rows = []

            for year in chart_years:

                values = calculated.get(year, {})

                ratio_rows.append(
                    {
                        "Fiscal Year": year,
                        "Current Ratio": values.get(
                            "current_ratio"
                        ),
                        "Debt / Equity": values.get(
                            "debt_to_equity"
                        )
                    }
                )

            ratio_chart = pd.DataFrame(
                ratio_rows
            )

            if not ratio_chart.empty:

                ratio_chart = ratio_chart.set_index(
                    "Fiscal Year"
                )

                st.write("#### Liquidity & Leverage")

                st.line_chart(
                    ratio_chart
                )

        st.markdown("---")

        # ----------------------------------------------------
        # AUDITOR / GOING CONCERN
        # ----------------------------------------------------

        st.subheader("Auditor & Going-Concern Review")

        auditor = extraction_data.get(
            "auditor",
            {}
        )

        going_concern = auditor.get(
            "going_concern_disclosure"
        )

        if going_concern is True:

            st.warning(
                "An explicit going-concern/material-uncertainty "
                "disclosure was identified in the extracted filing."
            )

        elif going_concern is False:

            st.success(
                "No explicit going-concern/material-uncertainty "
                "disclosure was identified in the extracted filing."
            )

        else:

            st.info(
                "FORGE could not confidently determine the "
                "going-concern disclosure status."
            )

        auditor_col1, auditor_col2 = st.columns(2)

        with auditor_col1:

            st.write("**Auditor**")

            st.write(
                auditor.get("name")
                or "Not identified"
            )

        with auditor_col2:

            st.write("**Opinion Type**")

            st.write(
                auditor.get("opinion_type")
                or "Not identified"
            )

        if auditor.get("going_concern_source_page"):

            st.caption(
                "Going-concern source page: "
                + str(
                    auditor.get(
                        "going_concern_source_page"
                    )
                )
            )

        # ----------------------------------------------------
        # AI ANALYSIS
        # ----------------------------------------------------

        st.markdown("---")

        st.subheader("Investor Analysis")

        st.markdown(
            analysis_text
        )

        # ----------------------------------------------------
        # SOURCE / TRACEABILITY
        # ----------------------------------------------------

        st.markdown("---")

        st.subheader("Source Traceability")

        st.caption(
            "Financial figures are extracted from the uploaded "
            "10-K. Page references are retained where the model "
            "could identify them."
        )

        financials = extraction_data.get(
            "financials",
            {}
        )

        source_items = [
            ("Revenue", "revenue"),
            ("Gross Profit", "gross_profit"),
            ("Net Income", "net_income"),
            ("Operating Cash Flow", "operating_cash_flow"),
            ("Current Assets", "current_assets"),
            ("Current Liabilities", "current_liabilities"),
            ("Total Debt", "total_debt"),
            ("Shareholders' Equity", "shareholders_equity")
        ]

        for label, key in source_items:

            metric = financials.get(
                key,
                {}
            )

            values = metric.get(
                "values",
                []
            )

            if values:

                for item in values:

                    if not isinstance(item, dict):
                        continue

                    value = item.get("value")
                    year = item.get("fiscal_year")
                    page = item.get("source_page")

                    if value is not None:

                        page_text = (
                            f"Page {page}"
                            if page
                            else "Page not identified"
                        )

                        st.markdown(
                            f"""
                            <div class="source-card">
                                <strong>{label}</strong>
                                <br>
                                FY{year}: {value}
                                <br>
                                <span class="small-muted">
                                    Source: {page_text}
                                </span>
                            </div>
                            """,
                            unsafe_allow_html=True
                        )

        # ----------------------------------------------------
        # LIMITATIONS
        # ----------------------------------------------------

        st.markdown("---")

        st.subheader("FORGE Limitations")

        st.info(
            """
            FORGE is a browser/cloud-based financial analysis system
            and should not be treated as a substitute for audited
            financial analysis.

            PDF text extraction can fail when a filing is scanned,
            image-based, unusually formatted, or contains complex
            multi-column tables.

            Financial values shown by FORGE are based only on figures
            that could be extracted and verified from the uploaded
            document. Missing values are not converted into zero.

            Different Form 10-K filings use different layouts,
            terminology, fiscal year-ends and reporting scales.
            Therefore, no single example 10-K should be treated as
            the universal template for all filings.
            """
        )

    except json.JSONDecodeError:

        st.error(
            "FORGE received an invalid structured response from "
            "Gemini. The filing could not be safely converted into "
            "financial data."
        )

    except Exception as e:

        st.error(
            f"FORGE processing error: {str(e)}"
        )

else:

    st.info(
        "System idle. Enter a Gemini API key and upload a Form 10-K "
        "PDF to begin analysis."
    )

    st.markdown(
        """
        ### FORGE workflow

        **1. Upload filing**  
        FORGE reads the available PDF pages.

        **2. Identify financial sections**  
        The system prioritizes statements, notes, liquidity,
        debt and auditor-related sections.

        **3. Extract structured data**  
        Fiscal years, currency, reporting scale and source pages
        are retained.

        **4. Calculate metrics**  
        Python calculates ratios and derived metrics from the
        extracted financial statement values.

        **5. Analyze**  
        Gemini interprets the verified data rather than being
        responsible for the primary numerical calculations.

        **6. Trace sources**  
        Source pages are displayed wherever they can be identified.
        """
    )
```
