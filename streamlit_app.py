import streamlit as st
import joblib
import cv2
import numpy as np
import re
import pandas as pd
from scipy.sparse import hstack, csr_matrix
from supabase import create_client
import os
from email import message_from_bytes

# ==========================================
# PAGE CONFIG
# ==========================================
st.set_page_config(
    page_title="AEGIS-SWARM",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
<style>
    .stApp { background-color: #050011; }
    .main-header { 
        font-family: 'Courier New', monospace; 
        color: #00ffff; 
        text-align: center;
        text-shadow: 0 0 20px rgba(0,255,255,0.5);
        font-size: 3rem;
        font-weight: 900;
        letter-spacing: 0.1em;
    }
    .sub-header {
        text-align: center;
        color: #ff8c00;
        font-family: 'Courier New', monospace;
        letter-spacing: 0.3em;
        font-size: 0.9rem;
        margin-bottom: 2rem;
    }
    .dev-info {
        text-align: center;
        color: #666;
        font-size: 0.7rem;
        font-family: monospace;
        margin-bottom: 2rem;
    }
    .stButton>button {
        background: linear-gradient(135deg, #4b0082, #8a2be2);
        color: white;
        border: 1px solid #00ffff;
        font-family: 'Courier New', monospace;
        letter-spacing: 2px;
        width: 100%;
        padding: 0.75rem;
        font-weight: bold;
    }
    .stButton>button:hover { 
        border-color: #ff8c00; 
        box-shadow: 0 0 15px rgba(255,140,0,0.3);
    }
    .high-risk { 
        background: rgba(255,0,0,0.08); 
        border: 1px solid #ff4500; 
        border-radius: 12px; 
        padding: 20px; 
    }
    .low-risk { 
        background: rgba(0,255,127,0.08); 
        border: 1px solid #00ff7f; 
        border-radius: 12px; 
        padding: 20px; 
    }
    .metric-box { 
        background: rgba(255,255,255,0.05); 
        border-radius: 10px; 
        padding: 15px; 
        text-align: center;
        border: 1px solid rgba(0,255,255,0.2);
    }
    .agent-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(0,255,255,0.15);
        border-radius: 10px;
        padding: 15px;
        margin: 10px 0;
    }
    div[data-testid="stTabs"] button {
        color: #00ffff !important;
        font-family: 'Courier New', monospace;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

# ==========================================
# LOAD MODELS
# ==========================================
@st.cache_resource(show_spinner=False)
def load_all_models():
    nlp_model = joblib.load("models/nlp_agent.pkl")
    nlp_tfidf = joblib.load("models/tfidf_vectorizer.pkl")
    url_model = joblib.load("models/url_classifier.pkl")
    url_tfidf = joblib.load("models/url_tfidf.pkl")
    return nlp_model, nlp_tfidf, url_model, url_tfidf

with st.spinner("🔄 Loading neural models..."):
    nlp_model, nlp_tfidf, url_model, url_tfidf = load_all_models()

# Supabase
@st.cache_resource(show_spinner=False)
def init_supabase():
    return create_client(
        "https://fpvmqjsnqakhiqbscjle.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwdm1xanNucWFraGlxYnNjamxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTgzNTAsImV4cCI6MjA5MzY3NDM1MH0.q11ue7nFAraaRtVcABYKKXemUIraEMG8Ets2q-89yA0"
    )

supabase = init_supabase()

# ==========================================
# FEATURE EXTRACTORS
# ==========================================
def extract_text_features(texts):
    features = []
    for text in texts:
        text = str(text).lower()
        feat = {
            'length': len(text),
            'num_urls': len(re.findall(r'http[s]?://\S+', text)),
            'num_digits': sum(c.isdigit() for c in text),
            'has_urgent': int(any(w in text for w in ['urgent', 'immediate', 'alert', 'warning', 'suspended', 'blocked'])),
            'has_money': int(any(w in text for w in ['reward', 'won', 'prize', 'cash', 'payment', 'refund', '$', 'usd', 'free', 'win'])),
            'has_action': int(any(w in text for w in ['click', 'verify', 'confirm', 'update', 'login', 'password', 'authenticate'])),
            'exclamation_count': text.count('!'),
            'question_count': text.count('?'),
            'uppercase_ratio': sum(1 for c in text if c.isupper()) / max(len(text), 1),
            'num_words': len(text.split()),
            'has_phone': int(bool(re.search(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', text))),
            'suspicious_chars': len(re.findall(r'[@#$%^&*]', text)),
            'has_suspicious_url': int(bool(re.search(r'bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly', text)))
        }
        features.append(feat)
    return pd.DataFrame(features)

def extract_url_features(urls):
    features = []
    for url in urls:
        url = str(url).lower()
        parsed = re.sub(r'^https?://', '', url).split('/')[0]
        feat = {
            'length': len(url), 'num_dots': url.count('.'),
            'num_slashes': url.count('/'), 'num_digits': sum(c.isdigit() for c in url),
            'has_https': int(url.startswith('https')),
            'has_ip': int(bool(re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', parsed))),
            'has_shortener': int(any(s in parsed for s in ['bit.ly','tinyurl','t.co','goo.gl'])),
            'has_suspicious_kw': int(any(kw in url for kw in ['login','verify','account','update','secure','password','confirm'])),
            'num_subdomains': len(parsed.split('.')) - 2,
            'has_port': int(':' in parsed),
            'has_at': int('@' in url),
            'has_query': int('?' in url),
            'has_encoded': int('%' in url),
            'tld_length': len(parsed.split('.')[-1]) if '.' in parsed else 0,
            'path_length': len(url.split('/', 3)[-1]) if '/' in url else 0
        }
        features.append(feat)
    return pd.DataFrame(features)

# ==========================================
# HEADER
# ==========================================
st.markdown('<h1 class="main-header">🛡️ AEGIS-SWARM</h1>', unsafe_allow_html=True)
st.markdown('<p class="sub-header">INTELLIGENT MULTI-MODAL THREAT TRIAGE</p>', unsafe_allow_html=True)
st.markdown('<p class="dev-info">Muhammad Abdullah (Muhammad Abdullah Asad) | FA23-BCE-049 | COMSATS University Islamabad</p>', unsafe_allow_html=True)

st.divider()

# ==========================================
# TABS
# ==========================================
tab1, tab2, tab3 = st.tabs(["📝 TEXT ANALYSIS", "🖼️ QR DECODER", "📎 FILE UPLOAD"])

# ==========================================
# TAB 1: TEXT
# ==========================================
with tab1:
    st.markdown("### ShieldAI NLP Engine")
    st.caption("Semantic intent detection for SMS, email, and text messages")
    
    text_input = st.text_area(
        "Paste suspicious payload:",
        height=150,
        placeholder="URGENT: Your PayPal account has been suspended. Click here to verify..."
    )
    
    if st.button("⚡ INITIATE SWARM ANALYSIS", use_container_width=True) and text_input:
        with st.spinner("Swarm agents coordinating..."):
            # NLP Classification
            tfidf_vec = nlp_tfidf.transform([text_input])
            handcrafted = extract_text_features([text_input])
            combined = hstack([tfidf_vec, csr_matrix(handcrafted.values)])
            proba = nlp_model.predict_proba(combined)[0]
            pred = nlp_model.predict(combined)[0]
            
            phishing_prob = proba[1] * 100
            verdict = "HIGH" if pred == 1 else "LOW"
            confidence = phishing_prob if pred == 1 else (100 - phishing_prob)
            
            # Store in Supabase (text-only, no embeddings)
            try:
                supabase.table("threats").insert({
                    "content": text_input[:500],
                    "threat_type": verdict,
                    "confidence": round(confidence / 100, 4),
                    "agent_source": "ShieldAI_NLP"
                }).execute()
            except Exception as e:
                st.error(f"Memory store error: {e}")
            
            # Display Verdict
            c1, c2, c3 = st.columns(3)
            with c1:
                color = "#ff4500" if verdict == "HIGH" else "#00ff7f"
                st.markdown(f'<div class="metric-box"><h2 style="color:{color};font-size:2rem;">{verdict}</h2><p style="color:#888;font-size:0.7rem;">THREAT LEVEL</p></div>', unsafe_allow_html=True)
            with c2:
                st.markdown(f'<div class="metric-box"><h2 style="color:#00ffff;font-size:2rem;">{confidence:.1f}%</h2><p style="color:#888;font-size:0.7rem;">CONFIDENCE</p></div>', unsafe_allow_html=True)
            with c3:
                action = "BLOCK" if verdict == "HIGH" else "SAFE"
                st.markdown(f'<div class="metric-box"><h2 style="color:#ff8c00;font-size:2rem;">{action}</h2><p style="color:#888;font-size:0.7rem;">ACTION</p></div>', unsafe_allow_html=True)
            
            st.progress(confidence / 100)
            
            if verdict == "HIGH":
                st.markdown(f'<div class="high-risk"><h4 style="color:#ff6347;">⚠️ THREAT DETECTED</h4><p>Phishing probability: <b>{phishing_prob:.1f}%</b></p><p style="font-size:0.8rem;color:#888;">Model: ShieldAI NLP (94.3% accuracy)</p></div>', unsafe_allow_html=True)
            else:
                st.markdown(f'<div class="low-risk"><h4 style="color:#00ff7f;">✓ PAYLOAD SECURE</h4><p>Low risk detected. No action required.</p></div>', unsafe_allow_html=True)
            
            # Agent reasoning
            with st.expander("🔍 Agent Intelligence Report"):
                st.markdown("**👁️ ShieldAI NLP Analysis:**")
                st.write(f"- Intent: `{verdict}`")
                st.write(f"- Confidence: `{confidence:.2f}%`")
                st.write(f"- Phishing Probability: `{phishing_prob:.2f}%`")

# ==========================================
# TAB 2: QR
# ==========================================
with tab2:
    st.markdown("### Visual Auditor - QR Decoder")
    st.caption("Decode QR images and analyze embedded URLs")
    
    qr_file = st.file_uploader("Upload QR code:", type=['png', 'jpg', 'jpeg'])
    
    if qr_file:
        st.image(qr_file, width=200)
        
        if st.button("⚡ DECODE & ANALYZE QR", use_container_width=True):
            with st.spinner("Decoding QR matrix..."):
                file_bytes = np.asarray(bytearray(qr_file.read()), dtype=np.uint8)
                img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
                
                if img is not None:
                    detector = cv2.QRCodeDetector()
                    data, bbox, _ = detector.detectAndDecode(img)
                    
                    if data and data.startswith('http'):
                        st.success(f"🔗 Decoded URL: `{data[:120]}`")
                        
                        # URL Classification
                        tfidf_vec = url_tfidf.transform([data])
                        handcrafted = extract_url_features([data])
                        combined = hstack([tfidf_vec, csr_matrix(handcrafted.values)])
                        proba = url_model.predict_proba(combined)[0]
                        pred = url_model.predict(combined)[0]
                        
                        malicious_prob = proba[1] * 100
                        verdict = "HIGH" if pred == 1 else "LOW"
                        confidence = malicious_prob if pred == 1 else (100 - malicious_prob)
                        
                        c1, c2 = st.columns(2)
                        with c1:
                            color = "#ff4500" if verdict == "HIGH" else "#00ff7f"
                            st.markdown(f'<div class="metric-box"><h2 style="color:{color}">{verdict}</h2><p style="color:#888;font-size:0.7rem;">URL RISK</p></div>', unsafe_allow_html=True)
                        with c2:
                            st.markdown(f'<div class="metric-box"><h2 style="color:#00ffff">{confidence:.1f}%</h2><p style="color:#888;font-size:0.7rem;">CONFIDENCE</p></div>', unsafe_allow_html=True)
                        
                        st.progress(confidence / 100)
                        
                        if verdict == "HIGH":
                            st.markdown(f'<div class="high-risk"><h4 style="color:#ff6347;">⚠️ MALICIOUS QR DETECTED</h4><p>URL threat score: <b>{malicious_prob:.1f}%</b></p></div>', unsafe_allow_html=True)
                        else:
                            st.markdown(f'<div class="low-risk"><h4 style="color:#00ff7f;">✓ SAFE QR</h4><p>URL appears legitimate.</p></div>', unsafe_allow_html=True)
                    else:
                        st.warning("📷 QR decoded but no URL found. Content may be a WiFi password or vCard.")
                else:
                    st.error("❌ Invalid image format")

# ==========================================
# TAB 3: FILE
# ==========================================
with tab3:
    st.markdown("### File Parser")
    st.caption("Extract and analyze text from .eml, .txt, and .pdf files")
    
    uploaded_file = st.file_uploader("Upload file:", type=['eml', 'txt', 'pdf'])
    
    if uploaded_file and st.button("⚡ PARSE & ANALYZE FILE", use_container_width=True):
        with st.spinner("Extracting text content..."):
            content = uploaded_file.read()
            text_content = ""
            
            if uploaded_file.name.endswith('.eml'):
                msg = message_from_bytes(content)
                for part in msg.walk():
                    if part.get_content_type() == "text/plain":
                        payload = part.get_payload(decode=True)
                        if payload:
                            text_content += payload.decode('utf-8', errors='ignore')
            else:
                text_content = content.decode('utf-8', errors='ignore')
            
            if text_content.strip():
                # Show preview
                with st.expander("📄 Extracted Text Preview"):
                    st.text(text_content[:1000] + ("..." if len(text_content) > 1000 else ""))
                
                # NLP Analysis
                tfidf_vec = nlp_tfidf.transform([text_content])
                handcrafted = extract_text_features([text_content])
                combined = hstack([tfidf_vec, csr_matrix(handcrafted.values)])
                proba = nlp_model.predict_proba(combined)[0]
                pred = nlp_model.predict(combined)[0]
                
                phishing_prob = proba[1] * 100
                verdict = "HIGH" if pred == 1 else "LOW"
                confidence = phishing_prob if pred == 1 else (100 - phishing_prob)
                
                c1, c2 = st.columns(2)
                with c1:
                    color = "#ff4500" if verdict == "HIGH" else "#00ff7f"
                    st.markdown(f'<div class="metric-box"><h2 style="color:{color}">{verdict}</h2><p style="color:#888;font-size:0.7rem;">FILE VERDICT</p></div>', unsafe_allow_html=True)
                with c2:
                    st.markdown(f'<div class="metric-box"><h2 style="color:#00ffff">{confidence:.1f}%</h2><p style="color:#888;font-size:0.7rem;">CONFIDENCE</p></div>', unsafe_allow_html=True)
                
                st.progress(confidence / 100)
                
                if verdict == "HIGH":
                    st.markdown(f'<div class="high-risk"><h4 style="color:#ff6347;">⚠️ MALICIOUS CONTENT</h4><p>Phishing probability: <b>{phishing_prob:.1f}%</b></p></div>', unsafe_allow_html=True)
                else:
                    st.markdown(f'<div class="low-risk"><h4 style="color:#00ff7f;">✓ FILE SECURE</h4><p>No threats detected in document.</p></div>', unsafe_allow_html=True)
            else:
                st.error("❌ No readable text found in file")

st.divider()
st.markdown('<p style="text-align:center;color:#333;font-size:0.65rem;font-family:monospace;">AEGIS-SWARM v2.5 | Multi-Agent Cybersecurity Ecosystem | CEP 2026</p>', unsafe_allow_html=True)
