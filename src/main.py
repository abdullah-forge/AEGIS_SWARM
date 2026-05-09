"""
AEGIS-SWARM FastAPI Backend (CORRECTED)
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import joblib
import cv2
import numpy as np
import re
from scipy.sparse import hstack, csr_matrix
import pandas as pd
import uvicorn
import os
from sentence_transformers import SentenceTransformer
from supabase import create_client

# ==========================================
# APP INITIALIZATION
# ==========================================
app = FastAPI(title="AEGIS-SWARM API", version="2.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

# ==========================================
# SUPABASE CONNECTION
# ==========================================
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://fpvmqjsnqakhiqbscjle.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_waM7OZYSVfc1q_lzMZLiuA_Ou_q_GtX")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
print("✅ Supabase connected")

# ==========================================
# LOAD ALL MODELS
# ==========================================
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")

print("Loading ML Classifiers...")
nlp_model = joblib.load(f"{MODELS_DIR}/nlp_agent.pkl")
nlp_tfidf = joblib.load(f"{MODELS_DIR}/tfidf_vectorizer.pkl")
url_model = joblib.load(f"{MODELS_DIR}/url_classifier.pkl")
url_tfidf = joblib.load(f"{MODELS_DIR}/url_tfidf.pkl")
print("✅ Classifiers loaded")

print("Loading Memory Core Embedder...")
embedder = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ Embedder loaded")

# ==========================================
# FEATURE EXTRACTORS
# ==========================================
def extract_text_features(texts):
    features = []
    for text in texts:
        text = str(text).lower()
        feat = {
            'length': len(text), 'num_urls': len(re.findall(r'http[s]?://\S+', text)),
            'num_digits': sum(c.isdigit() for c in text),
            'has_urgent': int(any(w in text for w in ['urgent', 'immediate', 'alert', 'warning', 'suspended', 'blocked', 'verify now'])),
            'has_money': int(any(w in text for w in ['reward', 'won', 'prize', 'cash', 'payment', 'refund', '$', 'usd', 'free', 'win'])),
            'has_action': int(any(w in text for w in ['click', 'verify', 'confirm', 'update', 'login', 'password', 'authenticate', 'sign in'])),
            'exclamation_count': text.count('!'), 'question_count': text.count('?'),
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
            'num_subdomains': len(parsed.split('.')) - 2, 'has_port': int(':' in parsed),
            'has_at': int('@' in url), 'has_query': int('?' in url),
            'has_encoded': int('%' in url),
            'tld_length': len(parsed.split('.')[-1]) if '.' in parsed else 0,
            'path_length': len(url.split('/', 3)[-1]) if '/' in url else 0
        }
        features.append(feat)
    return pd.DataFrame(features)

# ==========================================
# MEMORY CORE FUNCTIONS
# ==========================================
def store_threat(content, embedding, threat_type, confidence, agent_source):
    """Store threat in Supabase pgvector"""
    try:
        supabase.table("threats").insert({
            "content": content,
            "embedding": embedding,
            "threat_type": threat_type,
            "confidence": confidence,
            "agent_source": agent_source
        }).execute()
    except Exception as e:
        print(f"Memory store error: {e}")

def search_similar_threats(content, threshold=0.60, k=3):
    """Search for similar threats in memory"""
    try:
        embedding = embedder.encode(content, normalize_embeddings=True).tolist()
        result = supabase.rpc("match_threats", {
            "query_embedding": embedding,
            "match_threshold": threshold,
            "match_count": k
        }).execute()
        return result.data or []
    except Exception as e:
        print(f"Memory search error: {e}")
        return []

# ==========================================
# API ENDPOINTS
# ==========================================
class TextRequest(BaseModel):
    text: str

@app.get("/")
async def root():
    return {"name": "AEGIS-SWARM", "status": "running", "version": "2.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy", "memory_core": "connected"}

@app.post("/analyze/text")
async def analyze_text(request: TextRequest):
    try:
        text = request.text
        
        # 1. NLP Classification
        tfidf_vec = nlp_tfidf.transform([text])
        handcrafted = extract_text_features([text])
        combined = hstack([tfidf_vec, csr_matrix(handcrafted.values)])
        proba = nlp_model.predict_proba(combined)[0]
        pred = nlp_model.predict(combined)[0]
        
        phishing_prob = proba[1] * 100
        verdict = "HIGH" if pred == 1 else "LOW"
        confidence = phishing_prob if pred == 1 else (100 - phishing_prob)
        
        # 2. Memory Search
        memory_matches = search_similar_threats(text, threshold=0.55, k=3)
        
        # 3. Store in Memory
        embedding = embedder.encode(text, normalize_embeddings=True).tolist()
        store_threat(text, embedding, verdict, confidence / 100, "ShieldAI_NLP")
        
        return {
            "verdict": verdict,
            "confidence": round(confidence, 2),
            "model_used": "ShieldAI NLP",
            "memory_matches": len(memory_matches),
            "similar_threats": memory_matches,
            "details": {"phishing_probability": round(phishing_prob, 2)}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/qr")
async def analyze_qr(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")
        
        # Use OpenCV QR detector (no pyzbar needed)
        detector = cv2.QRCodeDetector()
        data, bbox, _ = detector.detectAndDecode(img)
        
        if not data or not data.startswith('http'):
            return {"verdict": "UNKNOWN", "confidence": 0.0, "model_used": "QR Decoder", "details": {"message": "No URL found in QR"}}
        
        url = data
        
        # URL Classification
        tfidf_vec = url_tfidf.transform([url])
        handcrafted = extract_url_features([url])
        combined = hstack([tfidf_vec, csr_matrix(handcrafted.values)])
        
        proba = url_model.predict_proba(combined)[0]
        pred = url_model.predict(combined)[0]
        
        malicious_prob = proba[1] * 100
        verdict = "HIGH" if pred == 1 else "LOW"
        confidence = malicious_prob if pred == 1 else (100 - malicious_prob)
        
        # Memory
        memory_matches = search_similar_threats(url, threshold=0.55, k=3)
        embedding = embedder.encode(url, normalize_embeddings=True).tolist()
        store_threat(url, embedding, verdict, confidence / 100, "QR_URL_Classifier")
        
        return {
            "verdict": verdict,
            "confidence": round(confidence, 2),
            "model_used": "QR URL Classifier",
            "memory_matches": len(memory_matches),
            "similar_threats": memory_matches,
            "details": {"decoded_url": url[:100], "malicious_probability": round(malicious_prob, 2)}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("\n" + "="*50)
    print("  AEGIS-SWARM API v2.0")
    print("  Local: http://localhost:8000")
    print("  Docs:  http://localhost:8000/docs")
    print("="*50 + "\n")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)