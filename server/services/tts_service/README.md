# TTS Service

This folder contains the Python service for Text-to-Speech using viXTTS/XTTS-v2.
The service is built and deployed via docker-compose as the `tts` service.

## Notes

- This is the **actively used TTS service folder** referenced in docker-compose.yml
- The `/server/services/tts/` folder contains an older version and should not be used
- The NodeJS client code in `/server/services/ttsService.js` connects to this service

## Configuration

The service uses these environment variables (set in docker-compose.yml):

| Environment Variable | Default Value | Description |
|---------------------|---------------|-------------|
| MODEL_PATH | /app/models/XTTS-v2 | Path to TTS model |
| ONNX_MODEL_PATH | /app/models/XTTS-v2/onnx | Path to optimized ONNX models |
| PORT | 5002 | HTTP service port |
| USE_CUDA | true | Enable GPU acceleration |
| USE_ONNX | true | Use ONNX runtime for faster inference |
| BATCH_SIZE | 2 | Inference batch size |
| SPEAKER_WAV_PATH | /app/models/speakers | Path to speaker voice samples |
| SAMPLE_RATE | 24000 | Audio sample rate |
| GPU_DEVICE | 0 | GPU device ID |
| PYTORCH_CUDA_ALLOC_CONF | max_split_size_mb:512 | Memory optimization |
| OMP_NUM_THREADS | 4 | Thread limit for optimized parallel processing |
| CHUNK_SIZE | 150 | Text chunk size for processing |
| MAX_WORKERS | 2 | Maximum worker processes |
| LOW_MEMORY | true | Optimize for lower memory usage |

## Important Files

- `run_tts.py` - Main Flask HTTP service
- `requirements.txt` - Python dependencies 
- `Dockerfile` - Container configuration for production
- `entrypoint.sh` - Docker container startup script
