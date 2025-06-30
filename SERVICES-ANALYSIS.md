# Docker Compose Services Analysis

Based on the `docker-compose.production.yml` configuration, here is a comprehensive analysis of each service:

## **api**
- **Build context:** `./server`
- **Dockerfile:** `Dockerfile.api`
- **Entrypoint:** `server/api/server.js`
- **Imports:**
  1. `dotenv` (require('dotenv').config())
  2. `express`
  3. `cors`
  4. `body-parser`
  5. `path`
  6. `../utils/logger` (createLogger)
  7. `../services/redisClient`
  8. `./routes/apiRoutes`
  9. `./routes/debugRoute`
  10. `./middleware/errorHandler`

## **socket**
- **Build context:** `./server`
- **Dockerfile:** `Dockerfile.socket`
- **Entrypoint:** `server/socket/server.js`
- **Imports:**
  1. `path`
  2. `dotenv` (with path resolution)
  3. `http`
  4. `socket.io` (Server)
  5. `express`
  6. `cors`
  7. `../utils/logger` (createLogger)
  8. `./socketController`
  9. `./streamHandler`
  10. `../services/asr/speechService`
  11. `../services/translation/translationService`

## **phowhisper**
- **Build context:** `./server/services/phowhisper_asr_service`
- **Dockerfile:** `Dockerfile`
- **Entrypoint:** `run_phowhisper.py`
- **Imports:**
  1. `os`
  2. `logging`
  3. `time`
  4. `flask` (Flask, request, jsonify)
  5. `faster_whisper` (WhisperModel)
  6. `torch`
  7. `dotenv` (load_dotenv)
  8. `tempfile`
  9. `numpy`
  10. `concurrent.futures` (ThreadPoolExecutor)
  11. `pathlib` (Path)
  12. `traceback`
  13. `mimetypes`
  14. `av`
  15. `subprocess`
  16. `shutil`
  17. `pkg_resources`

## **translation**
- **Build context:** `./server/services/translation_service`
- **Dockerfile:** `Dockerfile`
- **Entrypoint:** `run_translation.py`
- **Imports:**
  1. `os`
  2. `time`
  3. `logging`
  4. `torch`
  5. `multiprocessing`
  6. `concurrent.futures` (ThreadPoolExecutor)
  7. `transformers` (AutoModelForSeq2SeqLM, AutoTokenizer, pipeline)
  8. `flask` (Flask, request, jsonify)
  9. `pathlib` (Path)

## **tts**
- **Build context:** `./server/services/tts_service`
- **Dockerfile:** `Dockerfile`
- **Entrypoint:** `run_tts.py`
- **Imports:**
  1. `os`
  2. `io`
  3. `time`
  4. `tempfile`
  5. `logging`
  6. `torch`
  7. `numpy`
  8. `TTS.tts.configs.xtts_config` (XttsConfig)
  9. `TTS.tts.models.xtts` (Xtts)
  10. `TTS.utils.generic_utils` (get_user_data_dir)
  11. `TTS.utils.manage` (ModelManager)
  12. `pydub` (AudioSegment)
  13. `soundfile`
  14. `flask` (Flask, request, jsonify, send_file)
  15. `concurrent.futures` (ThreadPoolExecutor)
  16. `re`
  17. `queue`

## **embeddings**
- **Build context:** `./server/services/embeddings_service`
- **Dockerfile:** `Dockerfile`
- **Entrypoint:** `run_embeddings.py`
- **Imports:**
  1. `os`
  2. `io`
  3. `time`
  4. `tempfile`
  5. `logging`
  6. `numpy`
  7. `json`
  8. `pathlib` (Path)
  9. `flask` (Flask, request, jsonify)
  10. `sentence_transformers` (SentenceTransformer)
  11. `faiss`
  12. `mammoth`
  13. `fitz` (PyMuPDF)
  14. `sklearn.metrics.pairwise` (cosine_similarity)
  15. `torch`

## **client**
- **Build context:** `./client`
- **Dockerfile:** `Dockerfile`
- **Entrypoint:** `src/main.jsx`
- **Imports:**
  1. `react`
  2. `react-dom/client` (ReactDOM)
  3. `./App`
  4. `./index.css`

## **redis**
- **Base image:** `redis:7-alpine`
- **Build context:** N/A (uses official image)
- **Dockerfile:** N/A
- **Entrypoint:** `redis-server` (with command arguments)
- **No custom imports** (official Redis image)

---

## Summary

### Node.js Services (2):
- **api**: Express REST API server
- **socket**: Socket.IO WebSocket server

### Python Services (4):
- **phowhisper**: Vietnamese speech recognition (ASR) using WhisperModel
- **translation**: Text translation using OPUS-MT models
- **tts**: Text-to-speech using XTTS-v2
- **embeddings**: Semantic search and context processing

### Frontend Service (1):
- **client**: React application built with Vite, served via Nginx

### Infrastructure Service (1):
- **redis**: Cache and session store

### Port Mappings:
- **api**: 5000:5000
- **socket**: 4000:5001
- **client**: 8080:80
- **Internal services**: phowhisper (50051), translation (50052), tts (5002), embeddings (5003)
- **redis**: Internal only (6379)

### Network:
All services communicate through the `translation-network` bridge network.
