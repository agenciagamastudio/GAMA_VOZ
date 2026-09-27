import io
import os
import subprocess
import tempfile
import wave

from .base import TTSEngine


class PiperEngine(TTSEngine):
    """Piper TTS — lightweight, fast, CPU-friendly fallback engine.

    Uses the piper-tts Python package which provides a CLI + Python API.
    Model for pt-BR (~50 MB) is downloaded automatically on first use to
    ~/.local/share/piper (Linux/Mac) or %APPDATA%/piper (Windows).
    """

    # Default PT-BR voice (medium quality, ~50 MB ONNX model)
    DEFAULT_VOICE = "pt_BR-faber-medium"

    def __init__(self, voice: str = DEFAULT_VOICE):
        self._voice = voice
        self.is_available = False
        self._piper_voice = None
        self._load()

    def _load(self):
        """Try to import piper and load the voice model."""
        try:
            from piper.voice import PiperVoice  # piper-tts package
            model_path, config_path = self._resolve_model_paths()
            if model_path and os.path.exists(model_path):
                self._piper_voice = PiperVoice.load(model_path, config_path=config_path)
                self.is_available = True
                print(f"✅ Piper TTS loaded: {self._voice}")
                return
            # Python package present but model not found — fall through to CLI check
        except ImportError:
            pass  # Python package absent — fall through to CLI check
        except Exception as e:
            print(f"⚠️ Piper TTS init failed: {e}")
            return

        # Common fallback: try CLI (covers both ImportError and missing model paths)
        try:
            result = subprocess.run(
                ["piper", "--version"],
                capture_output=True, timeout=5
            )
            if result.returncode == 0:
                self.is_available = True
                print("✅ Piper TTS CLI available")
            else:
                print("⚠️ Piper TTS: model not found and CLI not available")
        except (FileNotFoundError, subprocess.TimeoutExpired):
            print("⚠️ Piper TTS not available: install with 'pip install piper-tts'")

    def _resolve_model_paths(self):
        """Resolve ONNX model and config paths from common install locations."""
        candidates = []

        # Platform-specific data dirs
        if os.name == "nt":  # Windows
            base = os.environ.get("APPDATA", os.path.expanduser("~"))
            candidates.append(os.path.join(base, "piper", self._voice))
        else:
            candidates.append(os.path.expanduser(f"~/.local/share/piper/{self._voice}"))

        # Check each candidate
        for base_path in candidates:
            model_path = f"{base_path}.onnx"
            config_path = f"{base_path}.onnx.json"
            if os.path.exists(model_path):
                return model_path, config_path if os.path.exists(config_path) else None

        return None, None

    def synthesize(self, text: str, voice: str = None, language: str = "pt-BR", speed: float = 1.0) -> bytes:
        """Synthesize text to WAV bytes using Piper.

        Args:
            text: Text to synthesize.
            voice: Ignored — Piper uses a fixed voice per engine instance.
            language: Informational only (engine is initialized for pt-BR).
            speed: Speech speed multiplier (1.0 = normal). Piper uses
                   length_scale = 1.0/speed so higher speed → shorter audio.

        Returns:
            WAV audio bytes.

        Raises:
            RuntimeError: If Piper is not available or synthesis fails.
        """
        if not self.is_available:
            raise RuntimeError("Piper TTS engine is not available")

        if self._piper_voice is not None:
            return self._synthesize_python_api(text, speed)
        return self._synthesize_subprocess(text, speed)

    def _synthesize_python_api(self, text: str, speed: float) -> bytes:
        """Use piper-tts Python API (preferred)."""
        # length_scale is inverse of speed (higher = slower)
        length_scale = 1.0 / max(0.5, min(2.0, speed))

        from piper import SynthesisConfig  # piper-tts >= 1.3
        syn_config = SynthesisConfig(length_scale=length_scale)

        audio_buffer = io.BytesIO()
        with wave.open(audio_buffer, "wb") as wav_file:
            self._piper_voice.synthesize_wav(
                text,
                wav_file,
                syn_config=syn_config,
            )
        audio_buffer.seek(0)
        return audio_buffer.read()

    def _synthesize_subprocess(self, text: str, speed: float) -> bytes:
        """Use piper CLI via subprocess (fallback when Python API unavailable)."""
        length_scale = 1.0 / max(0.5, min(2.0, speed))

        # Use NamedTemporaryFile to handle Windows path constraints
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            result = subprocess.run(
                [
                    "piper",
                    "--model", self._voice,
                    "--output_file", tmp_path,
                    "--length_scale", str(length_scale),
                ],
                input=text.encode("utf-8"),
                capture_output=True,
                timeout=30,
            )
            if result.returncode != 0:
                err = result.stderr.decode("utf-8", errors="replace")
                raise RuntimeError(f"Piper CLI failed (rc={result.returncode}): {err}")

            with open(tmp_path, "rb") as f:
                return f.read()
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
