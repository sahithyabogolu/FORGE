import streamlit as st
import google.generativeai as genai
from pypdf import PdfReader

# 1. Page Configuration & Professional Corporate Dark Aesthetic
st.set_page_config(page_title="FORGE — Financial Intelligence Engine", layout="wide")

st.markdown("""
    <style>
    .main { background-color: #0c0d0e; color: #e4e6eb; }
    div[data-testid="stSidebar"] { background-color: #16181a; border-right: 1px solid #2b2e31; }
    h1, h2, h3, h4 { color: #e4e6eb; font-family: sans-serif; }
    .stMarkdown p, p, li { color: #90949c !important; }
    .metric-box { background-color: #16181a; padding: 15px; border-radius: 4px; border: 1px solid #2b2e31; margin-bottom: 10px; }
    .metric-val { font-size: 1.5rem; font-weight: bold; color: #e4e6eb; }
    .metric-lbl { font-size: 0.85rem; color: #90949c; }
    </style>
""", unsafe_allow_html=True)

# 2. Sidebar Application Controls
st.sidebar.title("FORGE ENGINE")
st.sidebar.caption("Financial Intelligence Interface")
api_key = st.sidebar.text_input("Enter Google Gemini API Key:", type="password")
uploaded_file = st.sidebar.file_uploader("Upload SEC Form 10-K (PDF)", type=["pdf"])

st.title("FORGE — Financial Intelligence Engine")
st.caption("Turn unstructured 10-K financial reports into structured financial insight.")
st.markdown("---")

# 3. Main Data Core Program
if uploaded_file and api_key:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    with st.spinner("FORGE Engine: Extracting and parsing document vectors..."):
        reader = PdfReader(uploaded_file)
        raw_text = ""
        # CRITICAL FIX: Safe page retrieval mapping using .pages boundary limits
        total_pages = len(reader.pages)
        max_pages = min(45, total_pages)
        
        for i in range(max_pages):
            page_content = reader.pages[i].extract_text()
            if page_content:
                raw_text += page_content
                
    if len(raw_text) < 100:
        st.error("Failed to read enough text from the PDF. Please make sure the file is not an unreadable scanned image document.")
    else:
        st.success(f"Successfully processed {max_pages} pages of financial records.")
        
        analysis_prompt = f"""
        You are an expert financial analysis engine checking a company's 10-K filing text data.
        Analyze this raw text and pull the metrics accurately. Do not extrapolate, assume, or guess any data points. If a metric is not present, mark it as 'Not Available in Extracted Pages'.
        
        Structure your final output with exactly these clean visual layout blocks:

        ### 📊 CORE NUMBERS & RATIOS
        Extract these values for the latest fiscal year available. Format each on a new line:
        - **Revenue:** [Value]
        - **Gross Profit:** [Value]
        - **Gross Margin:** [Calculate explicitly as (Gross Profit / Revenue) * 100]%
        - **Net Profit / Net Income:** [Value]
        - **Net Margin:** [Calculate explicitly as (Net Income / Revenue) * 100]%
        - **Operating Cash Flow:** [Value]
        - **Current Ratio:** [Calculate explicitly as Current Assets / Current Liabilities]x
        - **Debt-to-Equity Ratio:** [Calculate explicitly as (Short-term Debt + Long-term Debt) / Shareholders' Equity]x
        
        ### 🔍 INVESTOR ANALYSIS & OBSERVATIONS
        Provide a comprehensive financial analysis paragraph regarding the corporate strategy, operational execution, and revenue health vector.

        ### ⚠️ RISK EVALUATION MATRIX
        State explicitly whether the company exhibits heavy overall financial distress/risks or not (**RISK** or **NO HEAVY DISTRESS**), and justify your verdict using its liquidity parameters, margin shifts, or leverage trends.

        ### 💡 TOP 10 CRITICAL INSIGHTS
        List exactly 10 factual milestones or key operations highlights an investor absolutely must know about this company's business model, revenue durability, or regulatory boundaries based on this report.

        ### 📉 GOING CONCERN STATUS & STATISTICS
        Discuss whether there are structural going concern uncertainties mentioned by the independent auditors or management in this document. Follow this up with a bulleted summary of key statistics.

        Text Content Source Data:
        {raw_text[:85000]}
        """
        
        with st.spinner("FORGE Core Engine Calculations: Processing analytics dashboard grids..."):
            try:
                response = model.generate_content(analysis_prompt)
                ai_output = response.text
                
                st.subheader("📋 FORGE Structural Financial Intelligence Dashboard")
                st.markdown(ai_output)
                
            except Exception as e:
                st.error(f"Engine Generation Context Error: {str(e)}")
else:
    st.info("⚡ System Idle: Provide your free Gemini API Key and upload a real Form 10-K PDF file into the workspace panel to get started.")
