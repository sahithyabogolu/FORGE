import streamlit as st
import google.generativeai as genai
from pypdf import PdfReader
import pandas as pd
import re

# 1. Page Configuration & Professional Corporate Dark Aesthetic
st.set_page_config(page_title="FORGE — Financial Intelligence Engine", layout="wide")

st.markdown("""
    <style>
    .main { background-color: #0c0d0e; color: #e4e6eb; }
    div[data-testid="stSidebar"] { background-color: #16181a; border-right: 1px solid #2b2e31; }
    h1, h2, h3, h4 { color: #e4e6eb; font-family: sans-serif; font-weight: 600; }
    .stMarkdown p, p, li { color: #90949c !important; }
    .report-card { background-color: #16181a; padding: 20px; border-radius: 6px; border: 1px solid #2b2e31; margin-bottom: 20px; }
    </style>
""", unsafe_allow_html=True)

# 2. Sidebar Application Controls
st.sidebar.title("FORGE ENGINE")
st.sidebar.caption("Financial Intelligence Interface")
api_key = st.sidebar.text_input("Enter Google Gemini API Key:", type="password")
uploaded_file = st.sidebar.file_uploader("Upload SEC Form 10-K (PDF)", type=["pdf"])

st.title("FORGE — Financial Intelligence Engine")
st.caption("Turn unstructured 10-K financial reports into high-fidelity data visualizations.")
st.markdown("---")

# Helper function to extract numerical tokens from AI output text safely
def parse_metric(pattern, text, default=0.0):
    match = re.search(pattern, text)
    if match:
        try:
            # Clean string symbols out
            clean_num = match.group(1).replace('$', '').replace(',', '').replace('%', '').strip()
            return float(clean_num)
        except:
            return default
    return default

# 3. Main Data Core Program
if uploaded_file and api_key:
    # Authenticate standard production-ready client mapping layers
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    with st.spinner("FORGE Engine: Extracting and parsing document vectors..."):
        reader = PdfReader(uploaded_file)
        raw_text = ""
        total_pages = len(reader.pages)
        max_pages = min(40, total_pages)
        
        for i in range(max_pages):
            page_content = reader.pages[i].extract_text()
            if page_content:
                raw_text += page_content
                
    if len(raw_text) < 100:
        st.error("Failed to extract readable text characters from this PDF document.")
    else:
        st.success(f"Successfully processed {max_pages} pages of financial records.")
        
        analysis_prompt = f"""
        You are an elite financial calculation bot processing SEC filing raw text records.
        Analyze this text carefully and extract the requested fields. 
        
        CRITICAL OUTPUT RULE: You MUST include this exact data section block at the very top of your response text so our script can extract numbers for graphic charts:
        [DATA_START]
        REVENUE: [Write raw numerical value or 0 if missing]
        GROSS_PROFIT: [Write raw numerical value or 0 if missing]
        NET_PROFIT: [Write raw numerical value or 0 if missing]
        OPERATING_CASH_FLOW: [Write raw numerical value or 0 if missing]
        CURRENT_RATIO: [Write raw decimal ratio or 0 if missing]
        DEBT_TO_EQUITY: [Write raw decimal ratio or 0 if missing]
        [DATA_END]

        After the data block, provide the remaining analysis segments using these headers:
        
        ### 🔍 INVESTOR ANALYSIS
        Provide your expert comprehensive financial summary analysis here.
        
        ### ⚠️ RISK EVALUATION
        State clearly if the company represents a high risk / financial distress scenario or not (**RISK** or **NO HEAVY DISTRESS**), and explain why.
        
        ### 💡 TOP 10 CRITICAL INSIGHTS
        Provide exactly 10 bulleted lines detailing essential factual milestones or insights an investor must know.
        
        ### 📉 GOING CONCERN STATUS & STATISTICS
        Disclose if there are active going concern warning flags, accompanied by any underlying audit method statistics.

        Text Content Source Data:
        {raw_text[:85000]}
        """
        
        with st.spinner("FORGE Core Engine Calculations: Generating graphic dashboard matrix..."):
            try:
                response = model.generate_content(analysis_prompt)
                ai_output = response.text
                
                # 4. Safe Numerical Parsing Matrix
                rev = parse_metric(r"REVENUE:\s*([\d\.\,\-]+)", ai_output)
                gp = parse_metric(r"GROSS_PROFIT:\s*([\d\.\,\-]+)", ai_output)
                np = parse_metric(r"NET_PROFIT:\s*([\d\.\,\-]+)", ai_output)
                ocf = parse_metric(r"OPERATING_CASH_FLOW:\s*([\d\.\,\-]+)", ai_output)
                cr = parse_metric(r"CURRENT_RATIO:\s*([\d\.\,\-]+)", ai_output)
                de = parse_metric(r"DEBT_TO_EQUITY:\s*([\d\.\,\-]+)", ai_output)
                
                # Clean the raw DATA strings out of the user-facing report layout presentation
                clean_report_text = re.sub(r"\[DATA_START\].*?\[DATA_END\]", "", ai_output, flags=re.DOTALL)
                
                # 5. Render Interactive Data Panels
                st.subheader("📋 FORGE Core Financial Dashboard")
                
                # Metric Display Grids
                m_col1, m_col2, m_col3, m_col4 = st.columns(4)
                with m_col1:
                    st.metric("Revenue", f"${rev:,.2f}" if rev > 0 else "N/A")
                with m_col2:
                    st.metric("Gross Profit", f"${gp:,.2f}" if gp > 0 else "N/A")
                with m_col3:
                    st.metric("Net Profit", f"${np:,.2f}" if np > 0 else "N/A")
                with m_col4:
                    st.metric("Operating Cash Flow", f"${ocf:,.2f}" if ocf > 0 else "N/A")
                    
                r_col1, r_col2 = st.columns(2)
                with r_col1:
                    st.metric("Current Ratio (Liquidity)", f"{cr:.2f}x" if cr > 0 else "N/A")
                with r_col2:
                    st.metric("Debt-to-Equity (Leverage)", f"{de:.2f}x" if de > 0 else "N/A")
                
                st.markdown("---")
                
                # 6. Graphic Representations Rendering Layer
                st.subheader("📈 Graphical Financial Comparisons")
                g_col1, g_col2 = st.columns(2)
                
                with g_col1:
                    st.write("#### Income Statement vs Cash Flow Profile ($)")
                    chart_data = pd.DataFrame({
                        "Metric Volume": [rev, gp, np, ocf]
                    }, index=["Revenue", "Gross Profit", "Net Profit", "Operating Cash Flow"])
                    st.bar_chart(chart_data)
                    
                with g_col2:
                    st.write("#### Balance Sheet Structural Ratios (x)")
                    ratio_data = pd.DataFrame({
                        "Ratio Level": [cr, de]
                    }, index=["Current Ratio (Liquidity)", "Debt-to-Equity (Leverage)"])
                    st.bar_chart(ratio_data)
                
                st.markdown("---")
                
                # 7. Qualitative Narrative Panels
                st.markdown(clean_report_text)
                
            except Exception as e:
                st.error(f"Dashboard Processing Exception Error: {str(e)}")
else:
    st.info("⚡ System Idle: Provide your Gemini API Key and upload a Form 10-K PDF file into the workspace panel to generate your graphical dashboard analysis.")
