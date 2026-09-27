"""
Clone Engine — Clonagem de voz zero-shot via Coqui XTTS-v2.

Engine escolhida: Coqui TTS XTTS-v2
  - KokoClone não existe como pacote pip real (apenas stub conceitual).
  - XTTS-v2 é a opção zero-shot PT-BR mais consolidada disponível como pip:
      * Suporte nativo a PT-BR (language='pt')
      * Clonagem a partir de 3-6s de áudio de referência
      * Modelo ~1.8 GB (< limite de 4 GB)
      * CPU-friendly (gpu=False no construtor)
      * TTS 0.21.1 já presente no ambiente; torch 2.4.1+cpu + torchaudio
        2.4.1+cpu instalados para resolver conflito com versão CUDA corrompida.

O ponto de integração em app.py já está preparado: basta `is_available` ser True
para que o pipeline de clonagem seja acionado automaticamente via voice_profile_id.
"""

from __future__ import annotations

import logging
import os
import tempfile
import threading

from .base import TTSEngine

logger = logging.getLogger(__name__)

_XTTS_MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"

# Resolved absolute path of the voice-sample uploads directory.
# Must match UPLOAD_FOLDER in backend/api/voice_clone.py.
_UPLOADS_BASE = os.path.realpath(
    os.path.join(os.path.dirname(__file__), "..", "uploads", "voice_samples")
)


def _check_xtts_available() -> bool:
    """Return True if torch + TTS can be imported without errors."""
    try:
        import torch  # noqa: F401
        from TTS.api import TTS  # noqa: F401
        return True
    except Exception as exc:
        logger.warning("CloneEngine: dependências indisponíveis — %s", exc)
        return False


class CloneEngine(TTSEngine):
    """
    Engine de clonagem de voz zero-shot usando Coqui XTTS-v2.

    O modelo (~1.8 GB) é baixado automaticamente na primeira chamada a
    synthesize() e cacheado em %APPDATA%/tts/ (Windows) ou ~/.local/share/tts/.

    is_available é True quando torch e TTS são importáveis; o modelo em si
    é carregado preguiçosamente (lazy) para não penalizar o startup.
    """

    def __init__(self) -> None:
        self._tts = None
        self._load_lock = threading.Lock()  # guards lazy model load
        self._available: bool = _check_xtts_available()
        if not self._available:
            logger.warning(
                "CloneEngine: torch/TTS indisponíveis — clonagem desabilitada."
            )

    @property
    def is_available(self) -> bool:
        return self._available

    def _load(self) -> None:
        """Carrega XTTS-v2 na primeira chamada (lazy). Thread-safe via double-checked locking."""
        # Fast path — already loaded, no lock needed
        if self._tts is not None:
            return

        with self._load_lock:
            # Second check inside lock: another thread may have loaded while we waited
            if self._tts is not None:
                return

            logger.info(
                "CloneEngine: carregando XTTS-v2 (1ª vez pode demorar ~60-120s "
                "para baixar o modelo de ~1.8 GB)..."
            )
            try:
                from TTS.api import TTS

                # gpu=False: modo CPU — funciona sem CUDA
                self._tts = TTS(_XTTS_MODEL_NAME, gpu=False)
                logger.info("CloneEngine: XTTS-v2 carregado com sucesso.")
            except Exception as exc:
                logger.error("CloneEngine: falha ao carregar XTTS-v2 — %s", exc)
                self._available = False
                raise RuntimeError(f"XTTS-v2 não pôde ser carregado: {exc}") from exc

    def synthesize(
        self,
        text: str,
        voice: str = "",
        language: str = "pt-BR",
        speed: float = 1.0,
        reference_audio_path: str = "",
    ) -> bytes:
        """
        Sintetiza texto com a voz do reference_audio_path (zero-shot).

        Args:
            text: Texto a sintetizar.
            voice: Ignorado — voz definida pelo reference_audio_path.
            language: Código ISO ('pt-BR' ou 'pt' para português; 'en' etc.).
                      XTTS-v2 suporta: pt, en, es, fr, de, it, pl, tr,
                      ru, nl, cs, ar, zh-cn, hu, ko, ja, hi.
            speed: Não suportado diretamente pelo XTTS-v2 (ignorado).
            reference_audio_path: Caminho para WAV/MP3 de referência (3-6s).

        Returns:
            bytes: Áudio WAV 24 kHz mono com a voz clonada.

        Raises:
            RuntimeError: Se XTTS-v2 não puder ser carregado.
            ValueError: Se reference_audio_path estiver vazio ou não existir.
        """
        if not self._available:
            raise RuntimeError(
                "CloneEngine indisponível. "
                "Verifique se torch e TTS estão instalados corretamente."
            )

        if not reference_audio_path:
            raise ValueError("reference_audio_path é obrigatório para clonagem de voz.")

        if not os.path.isfile(reference_audio_path):
            raise ValueError(
                f"Arquivo de referência não encontrado: {reference_audio_path}"
            )

        # Path confinement: resolved path must be inside the uploads directory
        resolved = os.path.realpath(reference_audio_path)
        if not resolved.startswith(_UPLOADS_BASE + os.sep) and resolved != _UPLOADS_BASE:
            raise ValueError(
                f"Caminho de referência fora do diretório permitido: {reference_audio_path}"
            )

        # Normaliza: 'pt-BR' → 'pt'  (XTTS-v2 usa código de 2 letras)
        lang = language.split("-")[0].lower() if language else "pt"

        self._load()  # no-op se já carregado

        # XTTS-v2 salva em arquivo; lemos e retornamos os bytes
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            self._tts.tts_to_file(
                text=text,
                speaker_wav=reference_audio_path,
                language=lang,
                file_path=tmp_path,
            )
            with open(tmp_path, "rb") as f:
                wav_bytes = f.read()
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

        return wav_bytes
