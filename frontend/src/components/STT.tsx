import React, { useState, useRef, useEffect } from 'react'
import { Copy, Download, Trash2, Clock } from 'lucide-react'
import { PlayMinimal, PauseMinimal, LoaderMinimal } from '../icons/MediaIcons'
import { API_BASE_URL } from '../utils/config'
import { HistoryManager } from '../utils/history'
import HistoryPanel from './HistoryPanel'
import AudioVisualizer from './AudioVisualizer'
import Toast from './Toast'

type SessionState = 'idle' | 'recording' | 'paused'

export default function STTComponent() {
  const [sessionState, setSessionState] = useState<SessionState>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [liveText, setLiveText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2200)
  }
  const transcriptRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-resize do campo de transcrição conforme o conteúdo
  useEffect(() => {
    const el = transcriptRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [transcript, liveText])

  // Live update troca o value do textarea (caret iria pro fim) — restaura a
  // seleção se o usuário estava editando a parte consolidada (índices não mudam)
  useEffect(() => {
    const el = transcriptRef.current
    const sel = selectionRef.current
    if (el && sel && document.activeElement === el && sel.start <= transcript.length) {
      el.setSelectionRange(sel.start, sel.end)
    }
  }, [liveText]) // eslint-disable-line react-hooks/exhaustive-deps

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const segmentChunksRef = useRef<Blob[]>([])
  const inFlightRef = useRef(false)
  const segmentEndActionRef = useRef<'pause' | 'stop' | 'rotate' | null>(null)
  const selectionRef = useRef<{ start: number; end: number } | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const permissionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordingStartTimeRef = useRef<number | null>(null)
  const volumeAnimRef = useRef<number>(0)
  const volumeCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    return () => {
      if (permissionTimeoutRef.current) clearTimeout(permissionTimeoutRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  // Real-time volume → particles
  useEffect(() => {
    if (sessionState !== 'recording' || !audioStreamRef.current) {
      cancelAnimationFrame(volumeAnimRef.current)
      try { volumeCtxRef.current?.close() } catch {}
      volumeCtxRef.current = null
      window.dispatchEvent(new CustomEvent('gama:volume', { detail: { volume: 0 } }))
      return
    }

    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      volumeCtxRef.current = new AudioCtx()
      const ac = volumeCtxRef.current as AudioContext
      const source = ac.createMediaStreamSource(audioStreamRef.current)
      const analyser = ac.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.75
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const measure = () => {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        const volume = sum / (data.length * 255)
        window.dispatchEvent(new CustomEvent('gama:volume', { detail: { volume } }))
        volumeAnimRef.current = requestAnimationFrame(measure)
      }
      volumeAnimRef.current = requestAnimationFrame(measure)

      return () => {
        cancelAnimationFrame(volumeAnimRef.current)
        try { source.disconnect() } catch {}
        try { ac.close() } catch {}
        window.dispatchEvent(new CustomEvent('gama:volume', { detail: { volume: 0 } }))
      }
    } catch {}
  }, [sessionState])

  // Envia um blob ao endpoint de transcrição e devolve o texto
  const transcribeBlob = async (blob: Blob): Promise<string> => {
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')
    formData.append('language', 'pt')
    const token = localStorage.getItem('gama_voz_token')
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const response = await fetch(`${API_BASE_URL}/api/stt/transcribe`, { method: 'POST', body: formData, headers })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Falha na transcrição')
    }
    const data = await response.json()
    return data.text as string
  }

  // Transcrição ao vivo do segmento atual (guarda anti-concorrência; erros silenciosos)
  const liveTranscribe = async () => {
    if (inFlightRef.current || segmentChunksRef.current.length === 0) return
    inFlightRef.current = true
    try {
      const blob = new Blob(segmentChunksRef.current, { type: 'audio/webm' })
      const text = await transcribeBlob(blob)
      // só atualiza se o segmento ainda está ativo (não foi pausado/parado nesse meio tempo)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        setLiveText(text)
      }
    } catch {
      // silencioso: próximo ciclo tenta de novo
    } finally {
      inFlightRef.current = false
    }
  }

  const appendToTranscript = (segText: string) => {
    if (!segText.trim()) return
    setTranscript((prev) => (prev.trim() ? `${prev.trimEnd()} ${segText.trim()}` : segText.trim()))
  }

  // Consolida o segmento encerrado; action decide o destino da sessão
  const commitSegment = async (action: 'pause' | 'stop' | 'rotate') => {
    setLiveText('')
    const chunks = segmentChunksRef.current
    segmentChunksRef.current = []
    if (action === 'rotate') {
      // usuário editou o trecho ao vivo: o texto do segmento já foi
      // consolidado pela edição — descarta o áudio e recomeça o segmento
      const stream = audioStreamRef.current
      if (stream) startSegment(stream)
      return
    }
    let finalText = ''
    if (chunks.length > 0) {
      setIsLoading(true)
      try {
        finalText = await transcribeBlob(new Blob(chunks, { type: 'audio/webm' }))
        appendToTranscript(finalText)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setIsLoading(false)
      }
    }
    if (action === 'stop') {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop())
        audioStreamRef.current = null
      }
      const duration = recordingStartTimeRef.current ? Date.now() - recordingStartTimeRef.current : 0
      recordingStartTimeRef.current = null
      setTranscript((current) => {
        if (current.trim()) HistoryManager.addTranscription(current, duration, 'pt')
        return current
      })
      setSessionState('idle')
    } else {
      if (audioStreamRef.current) {
        audioStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false })
      }
      setSessionState('paused')
    }
  }

  // Inicia um novo segmento de gravação sobre o stream atual
  const startSegment = (stream: MediaStream) => {
    const mediaRecorder = new MediaRecorder(stream)
    mediaRecorderRef.current = mediaRecorder
    segmentChunksRef.current = []
    segmentEndActionRef.current = null
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) segmentChunksRef.current.push(event.data)
      if (mediaRecorder.state === 'recording') liveTranscribe()
    }
    mediaRecorder.onstop = () => {
      const action = segmentEndActionRef.current || 'stop'
      segmentEndActionRef.current = null
      commitSegment(action)
    }
    mediaRecorder.start(3000) // timeslice: transcrição ao vivo a cada ~3s
    setSessionState('recording')
  }

  const handleStartRecording = async () => {
    try {
      setIsRequestingPermission(true)
      setError(null)
      const permissionTimeout = setTimeout(() => {
        setIsRequestingPermission(false)
        setError('⏱️ Timeout: permissão de microfone não respondeu. Verifique suas configurações de privacidade.')
      }, 10000)
      permissionTimeoutRef.current = permissionTimeout
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (permissionTimeoutRef.current) clearTimeout(permissionTimeoutRef.current)
      audioStreamRef.current = stream
      recordingStartTimeRef.current = Date.now()
      startSegment(stream)
      setIsRequestingPermission(false)
      setError(null)
    } catch (err) {
      setIsRequestingPermission(false)
      if (permissionTimeoutRef.current) clearTimeout(permissionTimeoutRef.current)
      let errorMsg = 'Acesso ao microfone negado'
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') errorMsg = '🔒 Permissão negada. Clique no ícone de microfone na barra de endereço.'
        else if (err.name === 'NotFoundError') errorMsg = '🎤 Nenhum microfone detectado.'
        else if (err.name === 'NotReadableError') errorMsg = '⚠️ Microfone em uso por outro aplicativo.'
        else errorMsg = err.message
      }
      setError(errorMsg)
    }
  }

  const handleStopRecording = () => {
    if (sessionState === 'paused') {
      // sem recorder ativo: consolida direto
      commitSegment('stop')
      return
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      segmentEndActionRef.current = 'stop'
      mediaRecorderRef.current.stop()
    }
  }

  const handlePause = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      segmentEndActionRef.current = 'pause'
      mediaRecorderRef.current.stop()
    }
  }

  const handleResume = () => {
    const stream = audioStreamRef.current
    if (!stream) return
    stream.getAudioTracks().forEach((t) => { t.enabled = true })
    startSegment(stream)
  }

  // valor exibido no textarea durante a gravação: consolidado + ao vivo
  const composite = transcript.trim()
    ? (liveText ? `${transcript.trimEnd()} ${liveText}` : transcript)
    : liveText

  const handleEdit = (newValue: string) => {
    if (sessionState !== 'recording' || !liveText) {
      setTranscript(newValue)
      return
    }
    const liveSuffix = ` ${liveText}`
    if (transcript.trim() && newValue.endsWith(liveSuffix)) {
      // edição só na parte consolidada: o live segue atualizando normalmente
      setTranscript(newValue.slice(0, -liveSuffix.length))
    } else if (!transcript.trim() && newValue.endsWith(liveText)) {
      setTranscript(newValue.slice(0, -liveText.length))
    } else {
      // edição tocou o trecho ao vivo: usuário assume o texto → consolida
      // tudo e rotaciona o segmento (próxima fala entra depois da edição)
      setTranscript(newValue)
      setLiveText('')
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        segmentEndActionRef.current = 'rotate'
        mediaRecorderRef.current.stop()
      }
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript)
      showToast('Texto copiado!')
    } catch { setError('Falha ao copiar') }
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([transcript], { type: 'text/plain' }))
    a.download = `transcript_${Date.now()}.txt`
    a.click()
  }

  const handleClear = () => { setTranscript(''); setLiveText(''); segmentChunksRef.current = [] }

  const handleToggleRecording = () => {
    if (sessionState !== 'idle') handleStopRecording()
    else handleStartRecording()
  }

  const ghostBtn: React.CSSProperties = {
    flex: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    padding: '8px 12px', borderRadius: 'var(--radius-md)',
    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontFamily: 'var(--font-main)',
    fontWeight: 600, fontSize: '12px', cursor: 'pointer', transition: 'all 200ms',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* LEFT: History */}
        <div>
          <h3 style={{
            fontSize: '13px', fontWeight: 700, color: 'var(--color-text)',
            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px',
          }}>
            <Clock style={{ width: '16px', height: '16px', color: 'var(--color-primary)' }} />
            Histórico
          </h3>
          <HistoryPanel isOpen={true} onSelectTranscription={(t) => setTranscript(t)} />
        </div>

        {/* RIGHT: Visualizer + transcript */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          {isRequestingPermission && (
            <div style={{ fontSize: '13px', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LoaderMinimal style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
              Permitir microfone...
            </div>
          )}
          {isLoading && (
            <div style={{ fontSize: '13px', color: 'var(--color-info)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LoaderMinimal style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
              Transcrevendo...
            </div>
          )}

          <AudioVisualizer
            isRecording={sessionState !== 'idle'}
            audioStream={audioStreamRef.current || undefined}
            onToggleRecording={handleToggleRecording}
          />

          {sessionState !== 'idle' && (
            <button
              onClick={sessionState === 'recording' ? handlePause : handleResume}
              style={{
                ...ghostBtn,
                flex: 'none',
                padding: '10px 28px',
                ...(sessionState === 'paused' && {
                  borderColor: 'var(--color-primary)',
                  color: 'var(--color-primary)',
                }),
              }}
            >
              {sessionState === 'recording' ? (
                <><PauseMinimal style={{ width: '14px', height: '14px' }} /> Pausar</>
              ) : (
                <><PlayMinimal style={{ width: '14px', height: '14px' }} /> Retomar</>
              )}
            </button>
          )}

          {error && (
            <div style={{
              width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)',
              background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.3)',
              display: 'flex', justifyContent: 'space-between', gap: '8px',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--color-error)', flex: 1, lineHeight: 1.5 }}>
                {error}
              </span>
              <button
                onClick={() => setError(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}

          {(transcript || liveText || sessionState !== 'idle') && (
            <div style={{
              width: '100%', padding: '16px', borderRadius: 'var(--radius-lg)',
              background: 'var(--glass-bg-2)', border: '1px solid var(--color-border)',
              display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <p style={{
                fontSize: '11px', fontWeight: 600, margin: 0,
                color: sessionState === 'recording'
                  ? 'var(--color-info)'
                  : sessionState === 'paused' ? 'var(--color-warning)' : 'var(--color-success)',
              }}>
                {sessionState === 'recording'
                  ? '🎙 Transcrevendo ao vivo — pode editar o texto'
                  : sessionState === 'paused' ? '⏸ Pausado — pode editar o texto' : '✅ Transcrição'}
              </p>
              <textarea
                ref={transcriptRef}
                value={sessionState === 'recording' ? composite : transcript}
                onChange={(e) => handleEdit(e.target.value)}
                onSelect={(e) => {
                  const el = e.currentTarget
                  selectionRef.current = { start: el.selectionStart, end: el.selectionEnd }
                }}
                placeholder={sessionState === 'recording' ? 'Pode falar — o texto aparece aqui...' : undefined}
                spellCheck={false}
                rows={1}
                style={{
                  width: '100%',
                  fontSize: '14px',
                  color: 'var(--color-text)',
                  lineHeight: 1.6,
                  margin: 0,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  overflow: 'hidden',
                  fontFamily: 'var(--font-main)',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'box-shadow 200ms',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(136, 206, 17, 0.3)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleCopy} style={ghostBtn}>
                  <Copy style={{ width: '12px', height: '12px' }} /> Copiar
                </button>
                <button onClick={handleDownload} style={ghostBtn}>
                  <Download style={{ width: '12px', height: '12px' }} /> Baixar
                </button>
                <button onClick={handleClear} style={ghostBtn}>
                  <Trash2 style={{ width: '12px', height: '12px' }} /> Limpar
                </button>
              </div>
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
