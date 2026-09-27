import React, { useState, useEffect } from 'react'
import { Upload, Download, X, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { API_BASE_URL } from '../utils/config'
import { useAuthAPI } from '../hooks/useAuthAPI'
import type { TTSSettings } from '../types'
import {
  AllEffects,
  DEFAULT_EFFECTS,
  buildEffectsPayload,
  EffectsPanel,
  EffectsSectionHeader,
} from './effects'

interface Chunk { id: number; title: string; charCount: number }
interface AudiobookTask { taskId: string; chunks: Chunk[]; estimatedTime: number }
interface AudiobookStatus {
  status: 'queued' | 'processing' | 'concatenating' | 'completed' | 'error' | 'cancelled'
  progress: number; total: number; elapsed: number; eta: number
  error?: string; downloadUrl?: string
}

export default function AudiobookGenerator({ settings }: { settings: Pick<TTSSettings, 'voice' | 'speed'> }) {
  const { getToken } = useAuthAPI()
  const [text, setText] = useState('')
  const [chunkMode, setChunkMode] = useState<'auto' | 'paragraph'>('auto')
  const [isCreating, setIsCreating] = useState(false)
  const [currentTask, setCurrentTask] = useState<AudiobookTask | null>(null)
  const [status, setStatus] = useState<AudiobookStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Audio effects (applied to every chapter after synthesis)
  const [effects, setEffects] = useState<AllEffects>(DEFAULT_EFFECTS)
  const [effectsExpanded, setEffectsExpanded] = useState(false)

  const toggleEffect = (key: keyof AllEffects) => {
    setEffects(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }))
  }
  const setParam = (key: keyof AllEffects, paramKey: string, val: number) => {
    setEffects(prev => ({
      ...prev,
      [key]: { ...prev[key], params: { ...prev[key].params, [paramKey]: val } },
    }))
  }
  const activeEffectsCount = (Object.values(effects) as Array<{ enabled: boolean }>).filter(e => e.enabled).length

  useEffect(() => {
    if (!currentTask || !['queued', 'processing', 'concatenating'].includes(status?.status || '')) return
    let delay = 2000
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const token = getToken()
        const response = await fetch(`${API_BASE_URL}/api/audiobook/status/${currentTask.taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const statusData: AudiobookStatus = await response.json()
        setStatus(statusData)
        if (['completed', 'error', 'cancelled'].includes(statusData.status)) {
          if (statusData.error) setError(statusData.error)
          return
        }
        delay = Math.min(delay + 1000, 5000)
      } catch { /* silent */ }
      timer = setTimeout(poll, delay)
    }
    timer = setTimeout(poll, delay)
    return () => clearTimeout(timer)
  }, [currentTask, status?.status])

  const handleCreate = async () => {
    if (!text.trim()) { setError('Por favor, digite ou cole o texto'); return }
    if (text.length > 500000) { setError('Texto muito grande (máx 500k caracteres)'); return }
    setIsCreating(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('text', text)
      formData.append('voice', settings.voice)
      formData.append('speed', settings.speed.toString())
      formData.append('chunkMode', chunkMode)
      const effectsPayload = buildEffectsPayload(effects)
      if (Object.keys(effectsPayload).length > 0) {
        formData.append('effects', JSON.stringify(effectsPayload))
      }
      const token = getToken()
      const response = await fetch(`${API_BASE_URL}/api/audiobook/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Falha ao criar audiobook')
      }
      const taskData: AudiobookTask = await response.json()
      setCurrentTask(taskData)
      setStatus({ status: 'queued', progress: 0, total: taskData.chunks.length, elapsed: 0, eta: taskData.estimatedTime })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancel = async () => {
    if (!currentTask) return
    try {
      const token = getToken()
      const response = await fetch(`${API_BASE_URL}/api/audiobook/cancel/${currentTask.taskId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) { setCurrentTask(null); setStatus(null); setError('Audiobook cancelado') }
    } catch { setError('Erro ao cancelar') }
  }

  const handleDownload = async () => {
    if (!status?.downloadUrl) return
    try {
      const token = getToken()
      const response = await fetch(`${API_BASE_URL}${status.downloadUrl}`, { headers: { Authorization: `Bearer ${token}` } })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audiobook_${currentTask?.taskId}.mp3`
      a.click()
      URL.revokeObjectURL(url)
    } catch { setError('Erro ao fazer download') }
  }

  const fmt = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  const pct = currentTask && status ? (status.progress / status.total) * 100 : 0

  const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px', display: 'block' }
  const textAreaStyle: React.CSSProperties = {
    width: '100%', height: '160px', padding: '16px',
    borderRadius: 'var(--radius-lg)', background: 'var(--glass-bg-2)',
    border: '1px solid var(--color-border)', color: 'var(--color-text)',
    fontFamily: 'var(--font-main)', fontSize: '14px', resize: 'vertical',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 200ms',
  }
  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontFamily: 'var(--font-main)', fontSize: '14px', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Text Input */}
      <div>
        <label style={labelStyle}>Texto para Audiobook</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500000))}
          placeholder="Cole ou digite o texto do seu livro, script, roteiro... (máx 500k caracteres)"
          disabled={currentTask !== null}
          style={{ ...textAreaStyle, opacity: currentTask ? 0.5 : 1 }}
          onFocus={e => { e.target.style.borderColor = 'var(--color-primary)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--color-border)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
          <span>{text.length} / 500000</span>
          {currentTask && (
            <span style={{ color: 'var(--color-primary)' }}>
              Processando {currentTask.chunks.length} capítulo{currentTask.chunks.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Effects Section */}
      {!currentTask && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
          <EffectsSectionHeader
            activeCount={activeEffectsCount}
            expanded={effectsExpanded}
            onToggleExpanded={() => setEffectsExpanded(p => !p)}
          />
          <div
            style={{
              overflow: 'hidden',
              maxHeight: effectsExpanded ? '1200px' : '0px',
              opacity: effectsExpanded ? 1 : 0,
              transition: 'max-height 350ms ease, opacity 250ms ease',
              paddingTop: effectsExpanded ? '8px' : '0px',
            }}
          >
            <EffectsPanel
              effects={effects}
              onToggle={toggleEffect}
              onParam={setParam}
            />
          </div>
        </div>
      )}

      {/* Options + Button */}
      {!currentTask && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Divisão</label>
            <select value={chunkMode} onChange={(e) => setChunkMode(e.target.value as 'auto' | 'paragraph')} style={selectStyle}>
              <option value="auto">Auto-detectar capítulos</option>
              <option value="paragraph">Por parágrafo</option>
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={isCreating || !text.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              height: '48px', borderRadius: 'var(--radius-lg)', border: 'none',
              background: 'linear-gradient(135deg, var(--color-primary), #6fa80a)',
              color: '#000', fontFamily: 'var(--font-main)', fontWeight: 900, fontSize: '14px',
              cursor: (isCreating || !text.trim()) ? 'not-allowed' : 'pointer',
              opacity: (isCreating || !text.trim()) ? 0.55 : 1,
              transition: 'all 200ms',
              boxShadow: (!isCreating && text.trim()) ? '0 4px 20px var(--color-primary-glow)' : 'none',
            }}
            onMouseEnter={e => { if (!isCreating && text.trim()) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
          >
            <Upload style={{ width: '18px', height: '18px' }} />
            {isCreating ? 'Criando...' : 'Criar Audiobook'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px',
          borderRadius: 'var(--radius-md)', fontSize: '13px',
          background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.25)',
          color: 'var(--color-error)',
        }}>
          <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: '1px' }} />
          <span>{error}</span>
        </div>
      )}

      {/* Processing Status */}
      {currentTask && status && (
        <div style={{
          padding: '24px', borderRadius: 'var(--radius-xl)',
          background: 'var(--glass-bg-2)', border: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column', gap: '20px',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {status.status === 'completed'
                ? <CheckCircle style={{ width: '22px', height: '22px', color: 'var(--color-success)' }} />
                : status.status === 'error'
                ? <AlertCircle style={{ width: '22px', height: '22px', color: 'var(--color-error)' }} />
                : <Clock style={{ width: '22px', height: '22px', color: 'var(--color-primary)', animation: 'spin 2s linear infinite' }} />
              }
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: '14px' }}>
                  {status.status === 'completed' ? '✅ Audiobook Pronto!'
                    : status.status === 'error' ? '❌ Erro no Processamento'
                    : `Processando... (${status.status})`}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {status.status === 'concatenating' ? 'Unindo capítulos...' : `Capítulo ${status.progress} de ${status.total}`}
                </p>
              </div>
            </div>
            {status.status !== 'completed' && (
              <button onClick={handleCancel} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)', padding: '6px', borderRadius: 'var(--radius-sm)',
              }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            )}
          </div>

          {/* Progress */}
          {status.status !== 'completed' && status.status !== 'error' && (
            <>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                  <span>Progresso</span><span>{Math.round(pct)}%</span>
                </div>
                <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '999px',
                    background: 'linear-gradient(to right, var(--color-primary), #6fa80a)',
                    width: `${pct}%`, transition: 'width 300ms ease',
                  }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', textAlign: 'center' }}>
                {[
                  { label: 'Decorrido', value: fmt(status.elapsed), color: 'var(--color-text)' },
                  { label: 'ETA', value: fmt(status.eta), color: 'var(--color-primary)' },
                  { label: 'Velocidade', value: `${status.elapsed > 0 ? (status.progress / (status.elapsed / 60)).toFixed(1) : '0'}/min`, color: 'var(--color-text)' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '0 0 4px' }}>{label}</p>
                    <p style={{ fontSize: '18px', fontWeight: 700, color, margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>

              <button onClick={handleCancel} style={{
                width: '100%', padding: '10px', borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-border)',
                color: 'var(--color-text)', fontFamily: 'var(--font-main)', fontWeight: 600,
                fontSize: '14px', cursor: 'pointer',
              }}>
                Cancelar
              </button>
            </>
          )}

          {/* Download */}
          {status.status === 'completed' && status.downloadUrl && (
            <button onClick={handleDownload} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '14px', borderRadius: 'var(--radius-lg)', border: 'none',
              background: 'linear-gradient(135deg, var(--color-primary), #6fa80a)',
              color: '#000', fontFamily: 'var(--font-main)', fontWeight: 900, fontSize: '15px',
              cursor: 'pointer', boxShadow: '0 4px 20px var(--color-primary-glow)',
            }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
            >
              <Download style={{ width: '20px', height: '20px' }} />
              Baixar Audiobook
            </button>
          )}

          {/* Chunks */}
          {currentTask && (
            <div style={{ paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Capítulos
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', maxHeight: '128px', overflowY: 'auto' }}>
                {currentTask.chunks.map((chunk) => {
                  const done = chunk.id <= status.progress
                  const active = chunk.id === status.progress + 1
                  return (
                    <div
                      key={chunk.id}
                      style={{
                        padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '12px',
                        background: done ? 'rgba(16,185,129,0.15)' : active ? 'rgba(136,206,17,0.15)' : 'rgba(255,255,255,0.04)',
                        color: done ? 'var(--color-success)' : active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      {done && '✓ '}{chunk.title} ({chunk.charCount.toLocaleString()} chars)
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
