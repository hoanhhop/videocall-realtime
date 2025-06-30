#!/usr/bin/env python
# -*- coding: utf-8 -*-
# run_embeddings.py - Flask HTTP Service cho tìm kiếm ngữ nghĩa và xử lý ngữ cảnh

import os
import io
import time
import tempfile
import logging
import numpy as np
import json
from pathlib import Path
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import faiss
import mammoth
import fitz  # PyMuPDF
from sklearn.metrics.pairwise import cosine_similarity
import torch

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# --- Cấu hình ---
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
ENABLE_CACHE = os.environ.get("ENABLE_CACHE", "true").lower() == "true"
CACHE_DIR = os.environ.get("CACHE_DIR", "/app/data")
USE_CUDA = os.environ.get("USE_CUDA", "true").lower() == "true"

# --- Biến toàn cục ---
model = None
embedding_cache = {}
device = None

def load_model():
    """Tải mô hình embedding"""
    global model, device
    logger.info(f"Đang tải mô hình embedding: {EMBEDDING_MODEL}")

    if USE_CUDA and torch.cuda.is_available():
        device = torch.device("cuda")
        logger.info(f"Sử dụng GPU: {torch.cuda.get_device_name(0)}")
    else:
        device = torch.device("cpu")
        logger.info("Sử dụng CPU cho embedding model.")

    try:
        # Tối ưu phép nhân ma trận float32 cho tốc độ cao
        try:
            torch.set_float32_matmul_precision('high')
        except Exception:
            pass  # Không phải bản torch nào cũng hỗ trợ, bỏ qua nếu lỗi
        model = SentenceTransformer(EMBEDDING_MODEL, device=device)
        # Nếu muốn tối ưu hơn nữa với torch.compile (PyTorch 2.0+), hãy thử:
        # try:
        #     model = torch.compile(model)
        # except Exception:
        #     pass  # Không phải model nào cũng tương thích torch.compile
        logger.info(f"Tải mô hình embedding thành công trên thiết bị: {device}")
    except Exception as e:
        logger.error(f"Lỗi khi tải mô hình embedding: {e}")
        raise

# Tải mô hình khi khởi động
load_model()

def extract_text_from_docx(file_buffer):
    """Trích xuất văn bản từ file DOCX"""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as temp_file:
        temp_file.write(file_buffer.read())
        temp_path = temp_file.name
    
    try:
        result = mammoth.extract_raw_text(Path(temp_path))
        text = result.value
        os.unlink(temp_path)
        return text
    except Exception as e:
        os.unlink(temp_path)
        raise Exception(f"Lỗi khi trích xuất văn bản từ DOCX: {e}")

def extract_text_from_pdf(file_buffer):
    """Trích xuất văn bản từ file PDF sử dụng PyMuPDF"""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
        temp_file.write(file_buffer.read())
        temp_path = temp_file.name
    
    try:
        text = ""
        doc = fitz.open(temp_path)
        for page in doc:
            text += page.get_text()
        doc.close()
        os.unlink(temp_path)
        return text
    except Exception as e:
        os.unlink(temp_path)
        raise Exception(f"Lỗi khi trích xuất văn bản từ PDF: {e}")

def get_embedding(text):
    """Tạo embedding cho văn bản"""
    if not text:
        return None
    
    # Sử dụng cache nếu đã có
    if ENABLE_CACHE and text in embedding_cache:
        return embedding_cache[text]
    
    embedding = model.encode(text)
    
    # Lưu vào cache nếu cần
    if ENABLE_CACHE:
        embedding_cache[text] = embedding
    
    return embedding

def find_similar_passage(query, text, max_length=500):
    """Tìm đoạn văn tương tự trong văn bản dài"""
    if not query or not text:
        return None
    
    # Chia văn bản thành các đoạn
    paragraphs = [p for p in text.split('\n\n') if p.strip()]
    
    # Nếu không có đoạn nào, trả về None
    if not paragraphs:
        return None
    
    # Nếu chỉ có 1 đoạn, trả về luôn
    if len(paragraphs) == 1:
        return paragraphs[0][:max_length]
    
    # Tạo embedding cho query
    query_embedding = get_embedding(query)
    
    # Tạo embedding cho từng đoạn
    paragraph_embeddings = [get_embedding(p) for p in paragraphs]
    
    # Tính toán độ tương đồng
    similarities = [cosine_similarity([query_embedding], [p_emb])[0][0] 
                   for p_emb in paragraph_embeddings]
    
    # Lấy đoạn có độ tương đồng cao nhất
    max_idx = np.argmax(similarities)
    
    return paragraphs[max_idx][:max_length]

def split_text_chunks(text, chunk_size=200, overlap=50):
    """Chia văn bản thành các đoạn nhỏ có độ trùng lặp"""
    if not text:
        return []
    
    words = text.split()
    chunks = []
    
    for i in range(0, len(words), chunk_size - overlap):
        chunk = ' '.join(words[i:i + chunk_size])
        chunks.append(chunk)
        
        if i + chunk_size >= len(words):
            break
    
    return chunks

@app.route('/health', methods=['GET'])
def health_check():
    """Kiểm tra trạng thái của dịch vụ"""
    if model is None:
        return jsonify({"status": "error", "message": "Model chưa được tải"}), 500
    
    return jsonify({
        "status": "ok", 
        "message": "Embedding service đang chạy",
        "model": EMBEDDING_MODEL,
        "device": str(device),
        "cache_enabled": ENABLE_CACHE,
        "cache_size": len(embedding_cache) if ENABLE_CACHE else 0
    }), 200

@app.route('/extract-text', methods=['POST'])
def extract_text():
    """Trích xuất văn bản từ file"""
    if 'file' not in request.files:
        return jsonify({"error": "Không có file nào được tải lên"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Không có file nào được chọn"}), 400
    
    try:
        mime_type = file.content_type
        
        if mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            text = extract_text_from_docx(file)
        elif mime_type == 'application/pdf':
            text = extract_text_from_pdf(file)
        elif mime_type == 'text/plain':
            text = file.read().decode('utf-8')
        else:
            return jsonify({"error": f"Kiểu file không được hỗ trợ: {mime_type}"}), 400
        
        return jsonify({"text": text})
    
    except Exception as e:
        logger.error(f"Lỗi khi trích xuất văn bản: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/embed', methods=['POST'])
def embed_text():
    """Tạo embedding cho văn bản"""
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Không có văn bản để tạo embedding"}), 400
    
    text = data['text']
    try:
        embedding = get_embedding(text)
        # Numpy array không thể serialize trực tiếp thành JSON
        return jsonify({"embedding": embedding.tolist()})
    
    except Exception as e:
        logger.error(f"Lỗi khi tạo embedding: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/find-similar', methods=['POST'])
def find_similar():
    """Tìm đoạn văn tương tự trong văn bản"""
    data = request.get_json()
    if not data or 'query' not in data or 'text' not in data:
        return jsonify({"error": "Thiếu thông tin query hoặc text"}), 400
    
    query = data['query']
    text = data['text']
    max_length = data.get('maxPassageLength', 500)
    
    try:
        similar_passage = find_similar_passage(query, text, max_length)
        return jsonify({"similar": similar_passage})
    
    except Exception as e:
        logger.error(f"Lỗi khi tìm đoạn tương tự: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/create-embeddings-index', methods=['POST'])
def create_embeddings_index():
    """Tạo chỉ mục embedding cho văn bản dài"""
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Không có văn bản để tạo chỉ mục"}), 400
    
    text = data['text']
    index_name = data.get('indexName', f"index_{int(time.time())}")
    
    try:
        chunks = split_text_chunks(text)
        embeddings = [get_embedding(chunk) for chunk in chunks]
        
        # Tạo FAISS index
        dimension = len(embeddings[0])
        index = faiss.IndexFlatL2(dimension)
        index.add(np.array(embeddings))
        
        # Lưu index và chunks vào file nếu cần
        if ENABLE_CACHE:
            os.makedirs(CACHE_DIR, exist_ok=True)
            faiss_path = os.path.join(CACHE_DIR, f"{index_name}.index")
            chunks_path = os.path.join(CACHE_DIR, f"{index_name}.json")
            
            faiss.write_index(index, faiss_path)
            with open(chunks_path, 'w', encoding='utf-8') as f:
                json.dump(chunks, f, ensure_ascii=False)
        
        return jsonify({
            "success": True,
            "indexName": index_name,
            "chunks": len(chunks)
        })
    
    except Exception as e:
        logger.error(f"Lỗi khi tạo chỉ mục embedding: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/search-index', methods=['POST'])
def search_index():
    """Tìm kiếm trong chỉ mục embedding"""
    data = request.get_json()
    if not data or 'query' not in data or 'indexName' not in data:
        return jsonify({"error": "Thiếu thông tin query hoặc indexName"}), 400
    
    query = data['query']
    index_name = data['indexName']
    top_k = data.get('topK', 1)
    
    try:
        # Kiểm tra xem index có tồn tại không
        faiss_path = os.path.join(CACHE_DIR, f"{index_name}.index")
        chunks_path = os.path.join(CACHE_DIR, f"{index_name}.json")
        
        if not os.path.exists(faiss_path) or not os.path.exists(chunks_path):
            return jsonify({"error": f"Không tìm thấy chỉ mục {index_name}"}), 404
        
        # Tải index và chunks
        index = faiss.read_index(faiss_path)
        with open(chunks_path, 'r', encoding='utf-8') as f:
            chunks = json.load(f)
        
        # Tạo embedding cho query
        query_embedding = get_embedding(query)
        
        # Tìm kiếm trong index
        D, I = index.search(np.array([query_embedding]), top_k)
        
        results = []
        for i in range(len(I[0])):
            idx = I[0][i]
            distance = D[0][i]
            if idx < len(chunks):
                results.append({
                    "text": chunks[idx],
                    "score": float(1.0 / (1.0 + distance))  # Chuyển đổi khoảng cách thành điểm số
                })
        
        return jsonify({
            "results": results
        })
    
    except Exception as e:
        logger.error(f"Lỗi khi tìm kiếm trong chỉ mục: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Nhận port từ biến môi trường hoặc sử dụng 5003
    port = int(os.environ.get("PORT", 5003))
    app.run(host='0.0.0.0', port=port, debug=False) 