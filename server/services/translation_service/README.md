# Translation Service

This folder contains the Python service for machine translation using OPUS-MT models.
The service is built and deployed via docker-compose as the `translation` service.

## Notes

- This is the **actively used Translation service folder** referenced in docker-compose.yml
- The `/server/services/translation/` folder contains a duplicate version and should be refactored
- The NodeJS client code in both `/server/services/translationService.js` and `/server/services/translation/translationService.js` connects to this service

## Configuration

The service uses these environment variables (set in docker-compose.yml):

| Environment Variable | Default Value | Description |
|---------------------|---------------|-------------|
| OPUS_MODELS_BASE_PATH | /app/models/opus_mt | Path to translation models |
| PORT_TRANSLATION | 50052 | HTTP service port |
| USE_CUDA | true | Enable GPU acceleration |
| MAX_LENGTH | 512 | Maximum sequence length |
| BATCH_SIZE | 16 | Translation batch size |
| GPU_DEVICE | 0 | GPU device ID |
| OMP_NUM_THREADS | 4 | Thread limit for optimized parallel processing |
| NUM_WORKERS | 4 | Worker processes for model loading |
| CPU_THREADS | 8 | CPU threads for processing |
| MAX_QUEUE_SIZE | 32 | Request queue size |

## Important Files

- `run_translation.py` - Main Flask HTTP service
- `requirements.txt` - Python dependencies 
- `Dockerfile` - Container configuration for production
- `entrypoint.sh` - Docker container startup script
