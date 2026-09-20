import streamlit as st
import google.generativeai as genai
from pypdf import PdfReader

# 1. Configured Page Settings & Dark Theming Elements
st.set_page_config(page_title="FORGE — Financial Intelligence Engine", layout="wide")

st.markdown("""
    <style>
    .main { background-color: #0c0d0e; color: #e4e6eb; }
    div[data-testid="stSidebar"] { background-color: #16181a; border-right: 1px solid #2b2e31; }
    h1, h2, h3 { color: #e4e6eb; font-family: sans-serif; }
    .stTextInput th, .stMarkdown p { color: #90949c; }
    </style>
""", unsafe_allow_html=True)

# 2. Sidebar Workspace Control
st.sidebar.title("FORGE ENGINE")
st.sidebar.caption("Financial Intelligence Interface")

api_key = st.sidebar.text_input("Enter Google Gemini API Key:", type="password")
uploaded_file = st.sidebar.file_uploader("Upload 10-K Filing (PDF Format)", type=["pdf"])

st.title("FORGE — Financial Intelligence Engine")
st.caption("Turn unstructured financial filings into structured financial insight.")

# 3. Primary Execution Thread
if uploaded_file and api_key:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    with st.spinner("FORGE Engine: Extracting and parsing document vectors..."):
        reader = PdfReader(uploaded_file)
        raw_text = ""
        max_pages = min(40, len(reader))
        for i in range(max_pages):
            raw_text += reader.pages[i].extract_text()
            
    st.success(f"Successfully parsed {max_pages} pages of financial records.")
    
    analysis_prompt = f"""
    You are an elite financial calculation engine designed to parse 10-K filings. 
    Analyze the following extracted financial report text and return the output precisely matching these criteria.
    Do not guess figures. If a data item is missing, explicitly note it.

    1. Extract these raw figures for the two most recent years available (e.g., 2024 and 2023):
       - Total Revenue
       - Cost of Goods Sold (COGS)
       - Gross Profit
       - Net Income
       - Current Assets
       - Current Liabilities
       - Short-term Debt / Borrowings
       - Long-term Debt
       - Shareholders' Equity
       - Operating Cash Flow

    2. Explicitly compute these exact metrics using these formulas:
       - Gross Margin: (Gross Profit / Revenue) * 100
       - Net Margin: (Net Income / Revenue) * 100
       - Current Ratio: Current Assets / Current Liabilities
       - Debt-to-Equity: (Short-term Debt + Long-term Debt) / Shareholders' Equity
       - Cash Conversion: (Operating Cash Flow / Net Income) * 100
       *Note: Show margin changes explicitly in "percentage points (pp)", not percentages.

    3. Provide Risk Indicators: State whether liquidity, leverage, or margin pressures are tracking dangerous vectors.
    4. Provide Brief Investor Observations covering structural revenue trajectories and structural adjustments.

    Extracted 10-K Data Content:
    {raw_text[:75000]}
    """
    
    with st.spinner("FORGE Calculation Matrix: Engineering financial insights..."):
        try:
            response = model.generate_content(analysis_prompt)
            st.subheader("📊 Engine Insights & Analysis Dashboard")
            st.write(response.text)
        except Exception as e:
            st.error(f"Engine Processing Error: {str(e)}")
else:
    st.info("⚡ System Idle: Provide your free Gemini API Key and drag a 10-K PDF file into the sidebar to fire up the analyzer.")
