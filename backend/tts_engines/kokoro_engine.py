import io
import re
import traceback

import numpy as np
import soundfile as sf

from .base import TTSEngine


class KokoroEngine(TTSEngine):
    """Kokoro TTS engine — Portuguese voices (pm_alex, pm_santa, pf_dora)."""

    def __init__(self):
        self._pipeline = None
        self._load()

    def _load(self):
        try:
            from kokoro import KPipeline
            self._pipeline = KPipeline(lang_code='p')  # 'p' para português
            print("✅ Kokoro TTS loaded successfully")
        except Exception as e:
            print(f"❌ Kokoro init failed: {e}")
            traceback.print_exc()

    @property
    def is_available(self) -> bool:
        return self._pipeline is not None

    def synthesize(self, text: str, voice: str, language: str = 'pt-BR', speed: float = 1.0) -> bytes:
        """Synthesize text using Kokoro and return WAV bytes.

        Args:
            text: Text to synthesize (already validated by caller).
            voice: Kokoro voice id (e.g. 'pm_alex').
            language: Language tag (informational; Kokoro uses lang_code from __init__).
            speed: Playback speed between 0.5 and 2.0.

        Returns:
            WAV audio as bytes.

        Raises:
            RuntimeError: If Kokoro is not loaded or synthesis fails.
        """
        if not self._pipeline:
            raise RuntimeError("Kokoro TTS pipeline is not available")

        # Preprocess: replace \n with ". " so Kokoro gets one continuous
        # string — avoids N sequential model calls for N-line texts
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        joined = []
        for line in lines:
            if joined and not re.search(r'[.!?:;,\-]$', joined[-1]):
                joined.append('. ')
            elif joined:
                joined.append(' ')
            joined.append(line)
        text_normalized = ''.join(joined)

        all_samples = []
        for result in self._pipeline(text_normalized, voice=voice, speed=speed):
            seg = result.audio
            if hasattr(seg, 'numpy'):
                seg = seg.numpy()
            elif not isinstance(seg, np.ndarray):
                seg = np.array(seg, dtype=np.float32)
            all_samples.append(seg)

        samples = np.concatenate(all_samples) if all_samples else np.zeros(1, dtype=np.float32)

        # Kokoro sample rate is 24000 Hz
        audio_buffer = io.BytesIO()
        sf.write(audio_buffer, samples, 24000, format='WAV')
        audio_buffer.seek(0)
        return audio_buffer.read()
