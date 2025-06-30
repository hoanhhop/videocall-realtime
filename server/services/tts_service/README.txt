# TTS Service

This folder contains the Python service for Text-to-Speech using viXTTS/XTTS-v2.
The service is built and deployed via docker-compose as the `tts` service.

## Notes

- This is the actively used TTS service folder referenced in docker-compose.yml
- The `/server/services/tts/` folder contains an older version and should not be used
- The NodeJS client code in `/server/services/ttsService.js` connects to this service

## Configuration

The service uses these environment variables (set in docker-compose.yml):
- MODEL_PATH=/app/models/XTTS-v2
- ONNX_MODEL_PATH=/app/models/XTTS-v2/onnx 
- PORT=5002
- USE_CUDA=true
- USE_ONNX=true
- BATCH_SIZE=2
- SPEAKER_WAV_PATH=/app/models/speakers
- SAMPLE_RATE=24000
- GPU_DEVICE=0
- PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
- OMP_NUM_THREADS=4
- CHUNK_SIZE=150
- MAX_WORKERS=2
- LOW_MEMORY=true

## Important Files

- run_tts.py - Main Flask HTTP service
- requirements.txt - Python dependencies 
- Dockerfile - Container configuration for production
- entrypoint.sh - Docker container startup script
