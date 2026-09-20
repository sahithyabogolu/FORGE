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
    # Using the fast, highly capable reasoning model context windows
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    with st.spinner("FORGE Engine: Extracting and parsing document vectors..."):
        reader = PdfReader(uploaded_file)
        raw_text = ""
        # Pull text baseline profiles across initial pages containing standard consolidated statements
        max_pages = min(45, len(reader))
        for i in range(max_pages):
            page_content = reader.pages[i].extract_text()
            if page_content:
                raw_text += page_content
                
    if len(raw_text) < 100:
        st.error("Failed to read enough text from the PDF. Please make sure the file is not an unreadable scanned image image document.")
    else:
        st.success(f"Successfully processed {max_pages} pages of corporate filings details.")
        
        # Hyper-detailed specific formatting matrix to avoid crashes
        analysis_prompt = f"""
        You are an expert financial analysis bot checking a company's 10-K filing text text data.
        Analyze this raw text and pull the metrics accurately. 
        Structure your final output with exactly these markdown section headers so they load cleanly into the web script dashboard code layout:

        ### CORE_NUMBERS
        Extract these values for the latest fiscal year available. Write each on a new line format like 'Metric: Value':
        - Revenue
        - Gross Profit
        - Net Profit / Net Income
        - Operating Cash Flow
        - Current Ratio
        - Debt-to-Equity Ratio
        
        ### INVESTOR_ANALYSIS
        Provide a 3-4 sentence comprehensive financial analysis statement regarding the corporate health vector.

        ### RISK_EVALUATION
        State whether the company exhibits heavy overall financial distress/risks or not, and justify based on liquidity/leverage.

        ### TOP_10_INSIGHTS
        List exactly 10 critical factual things or key highlights an investor absolutely must know about this company's business model, performance, or operational realities based strictly on this file document text.

        ### GOING_CONCERN_STATUS
        Discuss whether there are structural going concern uncertainties mentioned, followed by a bulleted string containing key statistical highlights.

        Text Content Source Data:
        {raw_text[:85000]}
        """
        
        with st.spinner("FORGE Core Engine Calculations: Processing analytics dashboard grids..."):
            try:
                response = model.generate_content(analysis_prompt)
                ai_output = response.text
                
                # Render cleanly without unsafe string splits by processing structural string segments
                st.subheader("📋 FORGE Structural Financial Intelligence Dashboard")
                st.markdown(ai_output)
                
            except Exception as e:
                st.error(f"Engine Generation Context Error: {str(e)}")
else:
    st.info("⚡ System Idle: Provide your free Gemini API Key and upload a real Form 10-K PDF file into the workspace panel to get started.")
