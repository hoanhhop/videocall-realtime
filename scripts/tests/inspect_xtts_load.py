#!/usr/bin/env python3
import inspect
from TTS.tts.models.xtts import Xtts
print(inspect.signature(Xtts.load_checkpoint))
# Print first lines of source
source_lines = inspect.getsource(Xtts.load_checkpoint).splitlines()[:20]
for line in source_lines:
    print(line)
