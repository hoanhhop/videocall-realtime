# DEPRECATED DIRECTORY

⚠️ **WARNING: This directory is partially deprecated and should be used with caution.**

## What happened to this directory?

This directory (`/server/services/translation/`) contains code that has been mostly moved to other locations:

- **Active Node.js client**: `/server/services/translationService.js` 
- **Active Python service**: `/server/services/translation_service/`

## Why is this still here?

This directory is being preserved temporarily for reference and backward compatibility. The directory structure has been refactored, and the code here may not be maintained.

## How to fix dependencies

If your code depends on any files in this directory:

```javascript
// WRONG - Don't use this
const translationService = require('../services/translation/translationService');

// CORRECT - Use this instead
const translationService = require('../services/translationService');
```

## See also

For more information about the service structure, please refer to:
- `/server/services/README.md`
- `/docs/service-structure-guidelines.md`
