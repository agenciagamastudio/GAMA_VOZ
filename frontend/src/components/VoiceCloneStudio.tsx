import React, { useState, useRef, useEffect } from 'react'
import { Upload, Trash2, User } from 'lucide-react'
import { MicMinimal, MicOffMinimal, PlayMinimal, SquareMinimal, LoaderMinimal } from '../icons/MediaIcons'
import { API_BASE_URL } from '../utils/config'
import { useAuthAPI } from '../hooks/useAuthAPI'
import AudioVisualizer from './AudioVisualizer'
import Toast from './Toast'

interface VoiceProfile {
  id: number
  name: string
  created_at: string
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

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '8px 14px',
  borderRadius: 'var(--radius-md)',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-main)',
  fontWeight: 600,
  fontSize: '12px',
  cursor: 'pointer',
  transition: 'all 200ms',
}

export default function VoiceCloneStudio() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [profileName, setProfileName] = useState('')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [inputMode, setInputMode] = useState<'record' | 'upload'>('record')

  const { fetchWithAuth } = useAuthAPI()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioStreamRef = useRef<MediaStream | null>(null)
  const permissionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2500)
  }

  useEffect(() => {
    loadProfiles()
    return () => {
      if (permissionTimeoutRef.current) clearTimeout(permissionTimeoutRef.current)
      stopStream()
    }
  }, [])

  function stopStream() {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop())
      audioStreamRef.current = null
    }
  }

  async function loadProfiles() {
    setIsLoadingProfiles(true)
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/voice-clone/list`)
      if (res.ok) {
        const data = await res.json()
        setProfiles(Array.isArray(data) ? data : [])
      }
    } catch {
      // silently fail on initial load
    } finally {
      setIsLoadingProfiles(false)
    }
    // Notifica outras abas (ex.: seletor de perfil no TTS) que a lista mudou
    window.dispatchEvent(new Event('gama:profiles-changed'))
  }

  /** Converte qualquer áudio (webm/ogg da gravação) em WAV PCM 16-bit,
   *  formato exigido pelo backend e pelo XTTS. */
  async function convertToWav(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer()
    const ctx = new AudioContext()
    try {
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      const numCh = Math.min(decoded.numberOfChannels, 2)
      const sampleRate = decoded.sampleRate
      const numFrames = decoded.length
      const bytesPerSample = 2
      const dataSize = numFrames * numCh * bytesPerSample
      const buffer = new ArrayBuffer(44 + dataSize)
      const view = new DataView(buffer)
      const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
      writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeStr(8, 'WAVE')
      writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
      view.setUint16(22, numCh, true); view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * numCh * bytesPerSample, true)
      view.setUint16(32, numCh * bytesPerSample, true); view.setUint16(34, 16, true)
      writeStr(36, 'data'); view.setUint32(40, dataSize, true)
      let offset = 44
      const channels = Array.from({ length: numCh }, (_, c) => decoded.getChannelData(c))
      for (let i = 0; i < numFrames; i++) {
        for (let c = 0; c < numCh; c++) {
          const s = Math.max(-1, Math.min(1, channels[c][i]))
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
          offset += 2
        }
      }
      return new Blob([buffer], { type: 'audio/wav' })
    } finally {
      ctx.close()
    }
  }

  async function handleStartRecording() {
    setError(null)
    setAudioBlob(null)
    setAudioPreviewUrl(null)
    try {
      setIsRequestingPermission(true)
      permissionTimeoutRef.current = setTimeout(() => {
        setIsRequestingPermission(false)
        setError('⏱️ Timeout de permissão. Verifique as configurações de microfone.')
      }, 10000)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      clearTimeout(permissionTimeoutRef.current!)
      audioStreamRef.current = stream
      audioChunksRef.current = []
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.ondataavailable = e => audioChunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioPreviewUrl(URL.createObjectURL(blob))
        stopStream()
      }
      mr.start()
      setIsRecording(true)
      setIsRequestingPermission(false)
    } catch (err) {
      clearTimeout(permissionTimeoutRef.current!)
      setIsRequestingPermission(false)
      let msg = 'Acesso ao microfone negado'
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') msg = '🔒 Permissão negada. Clique no ícone de microfone na barra de endereço.'
        else if (err.name === 'NotFoundError') msg = '🎤 Nenhum microfone detectado.'
        else if (err.name === 'NotReadableError') msg = '⚠️ Microfone em uso por outro aplicativo.'
        else msg = err.message
      }
      setError(msg)
    }
  }

  function handleStopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioBlob(file)
    setAudioPreviewUrl(URL.createObjectURL(file))
    setError(null)
  }

  async function handleUpload() {
    if (!audioBlob) { setError('Nenhum áudio selecionado.'); return }
    if (!profileName.trim()) { setError('Dê um nome ao perfil de voz.'); return }
    setIsUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      // Gravações do navegador saem em webm/ogg — o backend só aceita WAV/MP3,
      // então convertemos para WAV PCM antes de enviar.
      const isAccepted = audioBlob.type.includes('wav') || audioBlob.type.includes('mpeg') || audioBlob.type.includes('mp3')
      const toSend = isAccepted ? audioBlob : await convertToWav(audioBlob)
      const ext = toSend.type.includes('wav') ? 'wav' : 'mp3'
      formData.append('file', toSend, `sample.${ext}`)
      formData.append('name', profileName.trim())
      const res = await fetchWithAuth(`${API_BASE_URL}/api/voice-clone/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Erro ${res.status}`)
      }
      showToast(`✅ Perfil "${profileName.trim()}" criado!`)
      setProfileName('')
      setAudioBlob(null)
      setAudioPreviewUrl(null)
      audioChunksRef.current = []
      await loadProfiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDelete(id: number, name: string) {
    setDeletingId(id)
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/voice-clone/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Erro ${res.status}`)
      }
      showToast(`🗑️ Perfil "${name}" removido.`)
      await loadProfiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao deletar')
    } finally {
      setDeletingId(null)
    }
  }

  const canSubmit = !!audioBlob && profileName.trim().length > 0 && !isUploading

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {(['record', 'upload'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => { setInputMode(mode); setAudioBlob(null); setAudioPreviewUrl(null); setError(null) }}
            style={{
              ...ghostBtn,
              borderColor: inputMode === mode ? 'var(--color-primary)' : 'var(--color-border)',
              color: inputMode === mode ? 'var(--color-primary)' : 'var(--color-text)',
              background: inputMode === mode ? 'rgba(136,206,17,0.08)' : 'rgba(255,255,255,0.06)',
            }}
          >
            {mode === 'record' ? <><MicMinimal style={{ width: '13px', height: '13px' }} /> Gravar</> : <><Upload style={{ width: '13px', height: '13px' }} /> Upload</>}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>

        {/* LEFT: Capture section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {inputMode === 'record' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              {isRequestingPermission && (
                <div style={{ fontSize: '13px', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <LoaderMinimal style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} />
                  Aguardando permissão de microfone...
                </div>
              )}

              <AudioVisualizer
                isRecording={isRecording}
                audioStream={audioStreamRef.current || undefined}
                onToggleRecording={isRecording ? handleStopRecording : handleStartRecording}
              />

              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', margin: 0 }}>
                {isRecording
                  ? '🔴 Gravando — clique no círculo para parar'
                  : audioBlob
                    ? '✅ Gravação capturada'
                    : 'Clique no círculo para começar a gravar (3–30s)'}
              </p>

              {audioBlob && !isRecording && (
                <button
                  onClick={() => { setAudioBlob(null); setAudioPreviewUrl(null) }}
                  style={{ ...ghostBtn, fontSize: '11px' }}
                >
                  <SquareMinimal style={{ width: '11px', height: '11px' }} /> Descartar
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                Arquivo de Áudio (WAV / MP3)
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '36px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 200ms, background 200ms',
                  background: audioBlob ? 'rgba(136,206,17,0.04)' : 'var(--glass-bg-2)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = audioBlob ? 'var(--color-primary)' : 'var(--color-border)' }}
              >
                <Upload style={{ width: '28px', height: '28px', color: 'var(--color-primary)', margin: '0 auto 10px' }} />
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  {audioBlob ? '✅ Arquivo selecionado — clique para trocar' : 'Clique para selecionar um arquivo'}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>WAV, MP3 · recomendado 3–30 segundos</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/wav,audio/mp3,audio/mpeg,audio/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>
          )}

          {/* Audio preview */}
          {audioPreviewUrl && (
            <div style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--glass-bg-2)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PlayMinimal style={{ width: '12px', height: '12px' }} /> Preview do áudio
              </p>
              <audio controls src={audioPreviewUrl} style={{ width: '100%', height: '32px' }} />
            </div>
          )}

          {/* Name input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
              Nome do Perfil de Voz
            </label>
            <input
              type="text"
              value={profileName}
              onChange={e => setProfileName(e.target.value.slice(0, 60))}
              placeholder="Ex: Minha Voz, Narrador, Cliente X..."
              maxLength={60}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--glass-bg-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-main)',
                fontSize: '14px',
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
              onKeyDown={e => { if (e.key === 'Enter' && canSubmit) handleUpload() }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px',
              background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.25)',
              color: 'var(--color-error)', display: 'flex', justifyContent: 'space-between', gap: '8px',
            }}>
              <span style={{ flex: 1, lineHeight: 1.5 }}>{error}</span>
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontWeight: 700, flexShrink: 0 }}>✕</button>
            </div>
          )}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={!canSubmit}
            style={{
              ...btn,
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              background: canSubmit ? 'var(--color-primary)' : 'rgba(136,206,17,0.3)',
              color: '#000',
              opacity: canSubmit ? 1 : 0.6,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? '0 4px 20px var(--color-primary-glow)' : 'none',
            }}
            onMouseEnter={e => { if (canSubmit) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
          >
            {isUploading ? (
              <><LoaderMinimal style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} /> Criando Perfil...</>
            ) : (
                <><MicOffMinimal style={{ width: '18px', height: '18px' }} /> Criar Perfil de Voz</>
            )}
          </button>
        </div>

        {/* RIGHT: Profiles list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User style={{ width: '15px', height: '15px', color: 'var(--color-primary)' }} />
              Perfis de Voz ({profiles.length})
            </h3>
            <button
              onClick={loadProfiles}
              disabled={isLoadingProfiles}
              style={{ ...ghostBtn, fontSize: '11px', padding: '5px 10px' }}
            >
              {isLoadingProfiles
                ? <LoaderMinimal style={{ width: '11px', height: '11px', animation: 'spin 1s linear infinite' }} />
                : '↻'}
              Atualizar
            </button>
          </div>

          {isLoadingProfiles && profiles.length === 0 ? (
            <div style={{
              padding: '40px 24px', textAlign: 'center',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--glass-bg-2)',
              border: '1px solid var(--color-border)',
            }}>
              <LoaderMinimal style={{ width: '24px', height: '24px', color: 'var(--color-primary)', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '12px' }}>Carregando perfis...</p>
            </div>
          ) : profiles.length === 0 ? (
            <div style={{
              padding: '40px 24px', textAlign: 'center',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--glass-bg-2)',
              border: '1px dashed var(--color-border)',
            }}>
              <User style={{ width: '32px', height: '32px', color: 'var(--color-text-muted)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>Nenhum perfil criado</p>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', opacity: 0.7, marginTop: '4px' }}>Grave ou faça upload de uma amostra para começar</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {profiles.map(profile => (
                <div
                  key={profile.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--glass-bg-2)',
                    border: '1px solid var(--color-border)',
                    transition: 'border-color 200ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(136,206,17,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--color-primary), #6fa80a)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <User style={{ width: '16px', height: '16px', color: '#000' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        fontSize: '14px', fontWeight: 700, color: 'var(--color-text)',
                        margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {profile.name}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                        {new Date(profile.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(profile.id, profile.name)}
                    disabled={deletingId === profile.id}
                    title="Deletar perfil"
                    style={{
                      ...ghostBtn,
                      padding: '7px 10px',
                      color: 'var(--color-error)',
                      borderColor: 'rgba(225,29,72,0.2)',
                      background: 'rgba(225,29,72,0.06)',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(225,29,72,0.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(225,29,72,0.06)' }}
                  >
                    {deletingId === profile.id
                      ? <LoaderMinimal style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />
                      : <Trash2 style={{ width: '13px', height: '13px' }} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Toast message={toastMsg} visible={toastVisible} />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
