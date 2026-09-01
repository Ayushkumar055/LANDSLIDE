import sys
import wave
from piper import PiperVoice

MODEL = "hi_IN-rohan-medium.onnx"

if len(sys.argv) < 3:
    print("Usage: python tts.py <text> <output.wav>")
    sys.exit(1)

text = sys.argv[1]
output_file = sys.argv[2]

try:
    voice = PiperVoice.load(MODEL)

    with wave.open(output_file, "wb") as wav_file:
        voice.synthesize_wav(text, wav_file)

    print(f"SUCCESS: {output_file}")

except Exception as err:
    print(f"ERROR: {err}")
    sys.exit(1)