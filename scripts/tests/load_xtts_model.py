#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Load XTTS model to isolate checkpoint loading.
"""
import os
import sys
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
import traceback

def main():
    model_dir = "server/models/tts/XTTS-v2"
    model_pth = os.path.join(model_dir, "model.pth")
    config_json = os.path.join(model_dir, "config.json")
    vocab_json = os.path.join(model_dir, "vocab.json")

    print(f"model_dir: {model_dir}")
    print(f"model_pth: {model_pth}")
    print(f"config_json: {config_json}")
    print(f"vocab_json: {vocab_json}")

    config = XttsConfig()
    config.load_json(config_json)
    # attempt 1: set vocab in config
    config.vocab_path = vocab_json
    model = Xtts.init_from_config(config)
    try:
        print("Calling load_checkpoint with checkpoint_dir and checkpoint_path and vocab...")
        model.load_checkpoint(config, checkpoint_dir=model_dir, checkpoint_path=model_pth, vocab_path=vocab_json, eval=True)
        print("Loaded checkpoint successfully")
    except Exception as e:
        print(f"Error loading checkpoint: {e}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
