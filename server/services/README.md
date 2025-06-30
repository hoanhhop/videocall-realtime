# Services Directory Structure

This document explains the service architecture and file organization to help maintain consistency.

## Active Service Implementations

### Node.js Client Services
- `ttsService.js` - **Main TTS service client** (used by routes, controllers, and socket handlers)
- `translationService.js` - **Main translation service client** (used by controllers and socket handlers)
- `contextService.js` - Context management for translations
- `speechService.js` - Speech processing service

### Python Microservices (Docker)
- `tts_service/` - **TTS Python service** using XTTS-v2 (referenced in docker-compose.yml)
- `translation_service/` - **Translation Python service** using OPUS-MT (referenced in docker-compose.yml)
- `phowhisper_asr_service/` - ASR Python service using PhoWhisper (referenced in docker-compose.yml)
- `embeddings_service/` - Embeddings service for context-aware features

## Standardization Status

The following standardization has been completed:

1. TTS Service:
   - ✅ `ttsService.js` (active) - Main service at root level with proper logging
   - ✅ `tts/` - Directory has been removed to avoid confusion
   - ✅ `ttsServiceOptimized.js` - Alternative optimization (documented but not currently used)

2. Translation Service:
   - ✅ `translationService.js` (active) - Main service at root level
   - ✅ `translation/` - Directory has been removed to avoid confusion
   - ✅ Socket handlers have been updated to use the main service file

## Folder Usage in Docker

The docker-compose.yml file references these specific folders:
```yaml
translation:
  build:
    context: ./server/services/translation_service
    dockerfile: Dockerfile

tts:
  build:
    context: ./server/services/tts_service
    dockerfile: Dockerfile
```

## Next Steps

1. ~~Convert README.txt files to README.md in service directories~~ ✅ Done
2. ~~Update socket handlers to import from root services~~ ✅ Done
3. ~~Add deprecation notices to duplicate files~~ ✅ Done
4. ~~Remove duplicate directories~~ ✅ Done
5. Future work: Consider migrating all service files to a standard `/services/{service_name}/` structure

## Additional Notes

- `ttsServiceOptimized.js` is kept for future optimizations but is not currently used
- Each Python service now has a dedicated README.md with configuration details
- All imports in socket handlers and other files have been updated to use root-level services

## Documentation

For more information about the service architecture, see:
- `docs/project-structure.md`
- `docs/service-structure-guidelines.md`
