"""
GAMA Voz — Audio Effects Pipeline
Post-processing effects using librosa/scipy
"""

import numpy as np
import librosa
import soundfile as sf
from scipy.signal import butter, sosfilt
import io


class AudioEffects:
    """Post-processing audio effects using librosa/scipy"""

    @staticmethod
    def load_wav(wav_bytes: bytes, sr: int = 22050) -> tuple:
        """Load WAV from bytes"""
        y, sr = librosa.load(io.BytesIO(wav_bytes), sr=sr)
        return y, sr

    @staticmethod
    def save_wav(y: np.ndarray, sr: int) -> bytes:
        """Save audio to WAV bytes"""
        wav_io = io.BytesIO()
        sf.write(wav_io, y, sr, format='WAV')
        return wav_io.getvalue()

    @staticmethod
    def pitch_shift(y: np.ndarray, sr: int, n_steps: float) -> np.ndarray:
        """
        Pitch shift (±12 semitones range)

        Args:
            y: audio time series
            sr: sample rate
            n_steps: number of semitones (+5 = higher, -5 = lower)
        """
        return librosa.effects.pitch_shift(y, sr=sr, n_steps=float(n_steps))

    @staticmethod
    def time_stretch(y: np.ndarray, rate: float) -> np.ndarray:
        """
        Time stretch (speed adjustment)

        Args:
            y: audio time series
            rate: speed multiplier (1.5 = 50% faster)
        """
        return librosa.effects.time_stretch(y, rate=float(rate))

    @staticmethod
    def reverb(y: np.ndarray, sr: int, decay: float = 0.5) -> np.ndarray:
        """
        Simple reverb using delay + feedback

        Args:
            y: audio time series
            sr: sample rate
            decay: feedback factor (0.3-0.7 typical)
        """
        delay_samples = int(0.05 * sr)  # 50ms delay
        delayed = np.zeros_like(y)
        delayed[delay_samples:] = y[:-delay_samples] * float(decay)
        return y + delayed

    @staticmethod
    def compressor(y: np.ndarray, threshold: float = -20.0, ratio: float = 4.0) -> np.ndarray:
        """
        Simple peak-based dynamic range compressor.

        Applies gain reduction whenever the signal amplitude exceeds the
        threshold (expressed in dBFS).  This is a simplified broadband
        compressor — full spectral compression would require an STFT round-trip.

        Args:
            y: audio time series (float32, range ~[-1, 1])
            threshold: dBFS threshold (e.g. -20)
            ratio: compression ratio (4 means 4:1)
        """
        threshold_linear = 10 ** (float(threshold) / 20.0)
        ratio = float(ratio)

        output = y.copy()
        above = np.abs(y) > threshold_linear
        # Gain reduction: keep threshold + excess/ratio
        gain = np.where(
            above,
            (threshold_linear + (np.abs(y) - threshold_linear) / ratio) / (np.abs(y) + 1e-9),
            1.0
        )
        output = y * gain
        return output

    @staticmethod
    def eq_bass_boost(y: np.ndarray, sr: int, amount: float = 1.0) -> np.ndarray:
        """
        EQ bass boost using a low-pass filter to isolate and amplify bass.

        Args:
            y: audio time series
            sr: sample rate
            amount: boost factor (1.0 = no change, 2.0 = 2× bass boost)
        """
        amount = float(amount)
        if amount == 1.0:
            return y
        # Design low-pass filter for bass (cutoff ~200 Hz)
        sos = butter(4, 200, 'low', fs=sr, output='sos')
        bass = sosfilt(sos, y)
        return y + bass * (amount - 1.0)

    @staticmethod
    def process(wav_bytes: bytes, effects: dict) -> bytes:
        """
        Apply a chain of effects to audio sequentially.

        Args:
            wav_bytes: input WAV bytes
            effects: ordered dict with effect names and params, e.g.
                {
                    "pitch_shift":   {"n_steps": 5},
                    "reverb":        {"decay": 0.5},
                    "compressor":    {"threshold": -20, "ratio": 4},
                    "eq_bass_boost": {"amount": 1.5},
                    "time_stretch":  {"rate": 1.2}
                }

        Returns:
            processed WAV bytes
        """
        y, sr = AudioEffects.load_wav(wav_bytes)

        skipped = []
        for effect_name, params in effects.items():
            if not isinstance(params, dict):
                skipped.append(effect_name)
                continue
            if effect_name == 'pitch_shift':
                y = AudioEffects.pitch_shift(y, sr, **params)
            elif effect_name == 'time_stretch':
                y = AudioEffects.time_stretch(y, **params)
            elif effect_name == 'reverb':
                y = AudioEffects.reverb(y, sr, **params)
            elif effect_name == 'compressor':
                y = AudioEffects.compressor(y, **params)
            elif effect_name == 'eq_bass_boost':
                y = AudioEffects.eq_bass_boost(y, sr, **params)
            else:
                skipped.append(effect_name)

        return AudioEffects.save_wav(y, sr), skipped
