# Video Call Translation Documentation

## Service Structure Documentation

The following documentation explains the service structure and organization:

- [Service Structure Guidelines](service-structure-guidelines.md) - Guidelines for service organization and standardization
- [Project Structure](project-structure.md) - Overall project architecture documentation

## Implementation Documentation

- [Deployment Checklist](deploymentChecklist.md) - Steps for deployment
- [Deployment Summary](deploymentSummary.md) - Summary of deployment configurations
- [VM Optimization](VM_OPTIMIZATION.md) - Virtual Machine optimization guidelines
- [Optimizations](optimizations.md) - General optimizations for the system

## Service Structure

The project follows a standardized service structure:

```
server/
  services/
    ttsService.js                # Main TTS client service (Node.js)
    translationService.js        # Main translation client service (Node.js) 
    tts_service/                 # TTS Python service with XTTS-v2
      README.md                  # Documentation for TTS service
      run_tts.py                 # Main Flask HTTP service
      Dockerfile                 # Docker configuration
      ...
    translation_service/         # Translation Python service with OPUS-MT
      README.md                  # Documentation for Translation service
      run_translation.py         # Main Flask HTTP service
      Dockerfile                 # Docker configuration
      ...
```

## Recent Changes

The service structure has been standardized with these changes:

1. Consolidated duplicate directories and files
2. Updated all imports in socket and controller files
3. Improved documentation with README.md files
4. Added clear headers to service files
5. Created standardized logging with distinct logger names

For a detailed history of changes, see [Service Structure Guidelines](service-structure-guidelines.md).

## Testing

To verify the service structure, use these scripts:

- Windows: `.\scripts\check_service_structure_fixed.ps1`
- Linux: `./scripts/check_service_structure.sh`
