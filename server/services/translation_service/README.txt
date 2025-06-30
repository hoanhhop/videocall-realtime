# Translation Service

This folder contains the Python service for machine translation using OPUS-MT models.
The service is built and deployed via docker-compose as the `translation` service.

## Notes

- This is the actively used Translation service folder referenced in docker-compose.yml
- The `/server/services/translation/` folder contains a duplicate version and should be refactored
- The NodeJS client code in both `/server/services/translationService.js` and `/server/services/translation/translationService.js` connects to this service

## Configuration

The service uses these environment variables (set in docker-compose.yml):
- OPUS_MODELS_BASE_PATH=/app/models/opus_mt
- PORT_TRANSLATION=50052
- USE_CUDA=true
- MAX_LENGTH=512
- BATCH_SIZE=16
- GPU_DEVICE=0
- OMP_NUM_THREADS=4
- NUM_WORKERS=4
- CPU_THREADS=8
- MAX_QUEUE_SIZE=32

## Important Files

- run_translation.py - Main Flask HTTP service
- requirements.txt - Python dependencies 
- Dockerfile - Container configuration for production
- entrypoint.sh - Docker container startup script
