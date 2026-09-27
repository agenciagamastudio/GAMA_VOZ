// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const API_ENDPOINTS = {
  HEALTH: '/health',
  CONFIG: '/api/config',
  STATUS: '/api/status',

  // TTS
  TTS_VOICES: '/api/tts/voices',
  TTS_SYNTHESIZE: '/api/tts/synthesize',

  // STT
  STT_TRANSCRIBE: '/api/stt/transcribe'
}

export const TIMEOUTS = {
  DEFAULT: 30000,
  TTS: 60000,
  STT: 120000
}

// TTS Engine preference — persisted in localStorage
export type TTSEngine = 'auto' | 'kokoro' | 'piper'

export function getTTSEnginePreference(): TTSEngine {
  const stored = localStorage.getItem('tts_engine_preference')
  if (stored === 'kokoro' || stored === 'piper') return stored
  return 'auto'
}

export function setTTSEnginePreference(engine: TTSEngine): void {
  localStorage.setItem('tts_engine_preference', engine)
}
