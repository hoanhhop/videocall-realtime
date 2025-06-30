# DEPRECATED DIRECTORY

⚠️ **WARNING: This directory is deprecated and should not be used for new development.**

## What happened to this directory?

This directory (`/server/services/tts/`) contains deprecated code that has been moved to other locations:

- **Active Node.js client**: `/server/services/ttsService.js` 
- **Active Python service**: `/server/services/tts_service/`

## Why is this still here?

This directory is being preserved temporarily for reference and backward compatibility. It should be removed in a future cleanup.

## How to fix dependencies

If your code depends on any files in this directory:

```javascript
// WRONG - Don't use this
const ttsService = require('../services/tts/ttsService');

// CORRECT - Use this instead
const ttsService = require('../services/ttsService');
```

## See also

For more information about the service structure, please refer to:
- `/server/services/README.md`
- `/docs/service-structure-guidelines.md`
