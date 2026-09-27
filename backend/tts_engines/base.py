from abc import ABC, abstractmethod


class TTSEngine(ABC):
    @abstractmethod
    def synthesize(self, text: str, voice: str, language: str = 'pt-BR', speed: float = 1.0) -> bytes:
        """Synthesize text to audio and return WAV bytes."""
        pass
