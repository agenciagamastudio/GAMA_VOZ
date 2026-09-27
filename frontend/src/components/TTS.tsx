import React, { useState, useEffect } from 'react'
import { Copy, Download } from 'lucide-react'
import { LoaderMinimal, VolMinimal } from '../icons/MediaIcons'
import { API_BASE_URL, getTTSEnginePreference, setTTSEnginePreference } from '../utils/config'
import type { TTSEngine } from '../utils/config'
import type { Voice, TTSSettings } from '../types'
import Toast from './Toast'
import { useAuthAPI } from '../hooks/useAuthAPI'

interface Props {
  voices: Voice[]
  settings: TTSSettings
  onSettingsChange: (settings: Partial<TTSSettings>) => void
}

const btn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontFamily: 'var(--font-main)',
  fontWeight: 700,
  cursor: 'pointer',
  border: 'none',
  borderRadius: 'var(--radius-xl)',
  transition: 'all 200ms',
}

interface VoiceProfile {
  id: number
  name: string
  created_at: string
}

export default function TTSComponent({ voices, settings, onSettingsChange }: Props) {
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [enginePreference, setEnginePreference] = useState<TTSEngine>(getTTSEnginePreference)
  const [lastUsedEngine, setLastUsedEngine] = useState<string | null>(null)
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)
  const { fetchWithAuth } = useAuthAPI()

  // Load voice profiles on mount and whenever VoiceCloneStudio creates/deletes
  // one (tabs are kept alive, so mount alone would miss later changes).
  useEffect(() => {
    const loadProfiles = () => {
      fetchWithAuth(`${API_BASE_URL}/api/voice-clone/list`)
        .then(res => res.ok ? res.json() : Promise.reject(res.status))
        .then((data: VoiceProfile[]) => setVoiceProfiles(data))
        .catch(() => {
          // Silently ignore — user may not be authenticated or has no profiles
          setVoiceProfiles([])
        })
    }
    loadProfiles()
    window.addEventListener('gama:profiles-changed', loadProfiles)
    return () => window.removeEventListener('gama:profiles-changed', loadProfiles)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEngineChange = (value: string) => {
    const engine = value as TTSEngine
    setEnginePreference(engine)
    setTTSEnginePreference(engine)
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2200)
  }

  const handleSynthesize = async () => {
    if (!text.trim()) { setError('Texto não pode estar vazio'); return }
    setIsLoading(true)
    setError(null)
    setLastUsedEngine(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 600000)

      const body: Record<string, unknown> = {
        text,
        voice: settings.voice,
        speed: settings.speed,
        engine: enginePreference,
      }
      if (selectedProfileId !== null) {
        body.voice_profile_id = selectedProfileId
      }

      const token = localStorage.getItem('gama_voz_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const response = await fetch(`${API_BASE_URL}/api/tts/synthesize`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      // 501 = clone engine not yet available — show informative toast, not a blocking error
      if (response.status === 501) {
        const data = await response.json()
        showToast(data.error || 'Clonagem de voz ainda não disponível nesta versão')
        return
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Falha na síntese')
      }
      const engineUsed = response.headers.get('X-TTS-Source')
      if (engineUsed) setLastUsedEngine(engineUsed)
      const audioBlob = await response.blob()
      setAudioUrl(URL.createObjectURL(audioBlob))
    } catch (err) {
      if (err instanceof Error) {
        setError(err.name === 'AbortError' ? 'Tempo esgotado — tente dividir em partes.' : err.message)
      } else {
        setError('Erro desconhecido')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('Texto copiado!')
    } catch { setError('Falha ao copiar') }
  }

  const handleDownload = () => {
    if (!audioUrl) return
    const a = document.createElement('a')
    a.href = audioUrl
    a.download = `synthesis_${Date.now()}.mp3`
    a.click()
    showToast('Áudio baixado!')
  }

  const handlePreview = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)
      const response = await fetch(`${API_BASE_URL}/api/tts/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Teste de qualidade com voz ${settings.voice}`,
          voice: settings.voice,
          speed: settings.speed,
          engine: enginePreference,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!response.ok) throw new Error('Falha na prévia')
      const audioBlob = await response.blob()
      new Audio(URL.createObjectURL(audioBlob)).play()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.name === 'AbortError' ? 'Prévia esgotou o tempo' : err.message)
      } else {
        setError('Falha na prévia')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => onSettingsChange({ voice: 'pm_alex', speed: 1.0 })

  const speedPct = ((settings.speed - 0.5) / 1.5) * 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Text Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
          Texto para Sintetizar
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 50000))}
          placeholder="Digite o texto para converter em fala..."
          style={{
            width: '100%',
            height: '128px',
            padding: '16px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--glass-bg-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-main)',
            fontSize: '14px',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 200ms, box-shadow 200ms',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'var(--color-primary)'
            e.target.style.boxShadow = '0 0 0 3px var(--color-primary-dim)'
          }}
          onBlur={e => {
            e.target.style.borderColor = 'var(--color-border)'
            e.target.style.boxShadow = 'none'
          }}
        />
        <div style={{ marginTop: '6px' }}>
          {/* Progress bar */}
          <div style={{ height: '2px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '999px',
              background: text.length > 45000 ? 'var(--color-error)' : 'var(--color-primary)',
              width: `${Math.min((text.length / 50000) * 100, 100)}%`,
              transition: 'width 80ms ease, background 300ms ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
            <span style={{
              fontSize: '11px',
              color: text.length > 45000 ? 'var(--color-error)' : 'var(--color-text-muted)',
              transition: 'color 300ms',
            }}>
              {text.length.toLocaleString('pt-BR')} / 50.000
            </span>
            {text.length > 0 && (
              <button
                onClick={handleCopy}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-primary)', fontFamily: 'var(--font-main)',
                  fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#a3d500')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-primary)')}
              >
                <Copy style={{ width: '11px', height: '11px' }} />
                Copiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Voice + Speed + Engine */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          {/* Voice select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Voz</label>
            <select
              value={settings.voice}
              onChange={(e) => onSettingsChange({ voice: e.target.value })}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                color: 'var(--color-text)', fontFamily: 'var(--font-main)', fontSize: '14px',
                outline: 'none', cursor: 'pointer',
              }}
            >
              {voices.length > 0 ? (
                voices.map((v) => (
                  <option key={v.id} value={v.id}>{v.description || v.id}</option>
                ))
              ) : (
                <>
                  <option value="pm_alex">Alex (Masculino)</option>
                  <option value="pm_santa">Santa (Masculino)</option>
                  <option value="pf_dora">Dora (Feminino)</option>
                </>
              )}
            </select>
          </div>

          {/* Speed slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
              Velocidade ({settings.speed.toFixed(1)}x)
            </label>
            <input
              type="range"
              min="0.5" max="2.0" step="0.1"
              value={settings.speed}
              onChange={(e) => onSettingsChange({ speed: parseFloat(e.target.value) })}
              style={{
                width: '100%', height: '6px', borderRadius: '8px',
                appearance: 'none', cursor: 'pointer', marginTop: '8px',
                background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${speedPct}%, rgba(255,255,255,0.1) ${speedPct}%, rgba(255,255,255,0.1) 100%)`,
              }}
            />
          </div>

          {/* Engine selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Engine TTS</label>
            <select
              value={enginePreference}
              onChange={(e) => handleEngineChange(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                color: 'var(--color-text)', fontFamily: 'var(--font-main)', fontSize: '14px',
                outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="auto">Automático</option>
              <option value="kokoro">Kokoro (qualidade)</option>
              <option value="piper">Piper (rápido)</option>
            </select>
          </div>
        </div>

        {/* Voice profile (clone) selector — only shown when profiles exist */}
        {voiceProfiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
              Voz clonada (opcional)
            </label>
            <select
              value={selectedProfileId ?? ''}
              onChange={(e) => setSelectedProfileId(e.target.value ? Number(e.target.value) : null)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                color: 'var(--color-text)', fontFamily: 'var(--font-main)', fontSize: '14px',
                outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="">— sem clonagem —</option>
              {voiceProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {selectedProfileId !== null && (
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>
                A clonagem de voz está em desenvolvimento — você receberá uma notificação quando estiver disponível.
              </p>
            )}
          </div>
        )}

        {/* Preview / Reset */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handlePreview}
            disabled={isLoading || !text.trim()}
            style={{
              ...btn,
              flex: 1,
              padding: '10px 16px',
              fontSize: '14px',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              opacity: (isLoading || !text.trim()) ? 0.45 : 1,
              cursor: (isLoading || !text.trim()) ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (!isLoading && text.trim()) e.currentTarget.style.borderColor = 'var(--color-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
          >
            Prévia
          </button>
          <button
            onClick={handleReset}
            style={{
              ...btn,
              flex: 1,
              padding: '10px 16px',
              fontSize: '14px',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
          >
            Restaurar Padrões
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '14px 16px', borderRadius: 'var(--radius-md)', fontSize: '13px',
          background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.25)',
          color: 'var(--color-error)',
        }}>
          {error}
        </div>
      )}

      {/* Synthesize Button */}
      <button
        onClick={handleSynthesize}
        disabled={isLoading || !text.trim()}
        style={{
          ...btn,
          width: '100%',
          padding: '16px',
          fontSize: '16px',
          background: (isLoading || !text.trim())
            ? 'rgba(136,206,17,0.35)'
            : 'var(--color-primary)',
          color: '#000',
          opacity: (isLoading || !text.trim()) ? 0.65 : 1,
          cursor: (isLoading || !text.trim()) ? 'not-allowed' : 'pointer',
          boxShadow: (isLoading || !text.trim()) ? 'none' : '0 4px 24px var(--color-primary-glow)',
        }}
        onMouseEnter={e => { if (!isLoading && text.trim()) e.currentTarget.style.filter = 'brightness(1.1)' }}
        onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
      >
        {isLoading ? (
          <><LoaderMinimal style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} /> Sintetizando...</>
        ) : (
          <><VolMinimal style={{ width: '20px', height: '20px' }} /> Sintetizar</>
        )}
      </button>

      {/* Audio Result */}
      {audioUrl && (
        <div
          className="glass-card"
          style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '13px', color: 'var(--color-success)', margin: 0 }}>✅ Síntese Completa</p>
            {lastUsedEngine && (
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '3px 10px',
                borderRadius: '999px', border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)', background: 'var(--glass-bg-2)',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                via {lastUsedEngine}
              </span>
            )}
          </div>
          <audio controls src={audioUrl} style={{ width: '100%', borderRadius: 'var(--radius-md)' }} />
          <button
            onClick={handleDownload}
            style={{
              ...btn,
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              background: 'var(--glass-bg-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
          >
            <Download style={{ width: '16px', height: '16px' }} />
            Baixar Áudio
          </button>
        </div>
      )}

      <Toast message={toastMsg} visible={toastVisible} />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
