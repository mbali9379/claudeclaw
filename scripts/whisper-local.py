#!/usr/bin/env python3
"""
Wrapper around openai-whisper to match whisper.cpp CLI interface.
Accepts: -m <model_path> -f <audio_file> --output-json --no-timestamps -l <lang>
Outputs: {"transcription": [{"text": "..."}]}
"""
import sys
import json
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('-m', '--model', default=None, help='Model path (ignored, uses openai-whisper)')
    parser.add_argument('-f', '--file', required=True, help='Audio file to transcribe')
    parser.add_argument('--output-json', action='store_true')
    parser.add_argument('--no-timestamps', action='store_true')
    parser.add_argument('-l', '--language', default='auto')
    args = parser.parse_args()

    try:
        import whisper
    except ImportError:
        print(json.dumps({"error": "openai-whisper not installed"}))
        sys.exit(1)

    model_name = args.model if args.model and not args.model.startswith('/') else "tiny"
    model = whisper.load_model(model_name, device="cpu")
    lang = None if args.language == 'auto' else args.language
    result = model.transcribe(args.file, language=lang, fp16=False)
    text = result.get("text", "").strip()
    print(json.dumps({"transcription": [{"text": text}]}))

if __name__ == "__main__":
    main()
