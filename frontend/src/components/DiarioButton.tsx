import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen } from 'lucide-react'

// API em modo dev: localhost. Em produção, fallback relativo via proxy.
// O usuário pode setar window.__DIARIO_API__ antes do bundle carregar para
// apontar para outro host (ex: http://192.168.1.220:8001).
const DIARIO_API =
  (typeof window !== 'undefined' && (window as any).__DIARIO_API__) ||
  'http://localhost:8001/entries'

type CapturedContent = { text: string; source: string }

/**
 * DiarioButton — botão "📓 Adicionar ao diário" integrado ao GamaVoz.
 *
 * Aparece no header a qualquer momento (qualquer aba/tab). Ao clicar:
 *  1. Captura a transcrição atual do localStorage OU do DOM
 *  2. Se não encontrar nada, abre modal para digitar manualmente
 *  3. Faz POST para GAMA_DIARIO backend (porta 8001)
 *  4. Feedback visual: ✓ Salvo no diário
 *
 * IMPORTANTE: o modal é renderizado via React Portal direto no <body>,
 * para escapar de qualquer stacking context do GamaVoz (transform/filter/
 * will-change nos ancestrais). Sem isso, o position:fixed fica preso
 * dentro de um wrapper com transform e o modal aparece "lá encima".
 */
export default function DiarioButton() {
  const [modalOpen, setModalOpen] = useState(false)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [reachable, setReachable] = useState<boolean | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // Ping de sanidade na montagem: testa se o backend responde.
  useEffect(() => {
    let cancelled = false
    fetch(DIARIO_API.replace('/entries', '/health'), { method: 'GET' })
      .then(r => r.ok)
      .then(ok => { if (!cancelled) setReachable(ok) })
      .catch(() => { if (!cancelled) setReachable(false) })
    return () => { cancelled = true }
  }, [])

  const detectContent = (): CapturedContent | null => {
    // 1) Tenta pegar do localStorage (vários apps salvam ali)
    const lsKeys = ['gama_stt_transcript', 'gama_transcript', 'stt_result', 'last_transcript']
    for (const k of lsKeys) {
      try {
        const v = localStorage.getItem(k)
        if (v && v.trim().length > 5) return { text: v, source: `GamaVoz-${k}` }
      } catch { /* localStorage indisponível */ }
    }

    // 2) Tenta pegar do DOM (vários seletores possíveis)
    const selectors = ['.transcript-output', '.stt-result', '[data-stt-text]', '.transcript-text', 'pre.transcript']
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      if (el && el.textContent && el.textContent.trim().length > 5) {
        return { text: el.textContent.trim(), source: `GamaVoz-DOM:${sel}` }
      }
    }

    return null
  }

  const onClick = () => {
    setError(null)
    setSavedAt(null)
    const detected = detectContent()
    if (detected) {
      save(detected.text, detected.source)
    } else {
      setModalOpen(true)
    }
  }

  const save = async (text: string, source: string) => {
    if (!text || text.trim().length === 0) {
      setError('Conteúdo vazio. Digite algo para salvar.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch(DIARIO_API, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Accept': 'application/json' },
        body: JSON.stringify({ content: text.trim(), source, date: today })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      setModalOpen(false)
      setContent('')
      setReachable(true)
      setTimeout(() => setSavedAt(null), 3000)
    } catch (e: any) {
      setReachable(false)
      setError(
        `Falha ao conectar ao diário (${e?.message || 'erro'}). ` +
        `Verifique se o backend está rodando: ${DIARIO_API.replace('/entries', '')}. ` +
        `Em outro PC, defina window.__DIARIO_API__ = 'http://SEU_IP:8001/entries' antes do bundle carregar.`
      )
    } finally {
      setSaving(false)
    }
  }

  const modalNode = modalOpen ? (
    <div
      onClick={() => !saving && setModalOpen(false)}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 2147483647, // max int32 — acima de qualquer coisa
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        pointerEvents: 'auto',
        // garante que o portal está fora de qualquer stacking context
        isolation: 'isolate',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="glass-card"
        style={{
          maxWidth: '560px',
          width: '100%',
          padding: '28px',
          boxShadow: 'var(--shadow-elevation-3)',
          pointerEvents: 'auto',
          position: 'relative',
          zIndex: 2147483647,
        }}
      >
        <h2 style={{ fontSize: '1.3rem', marginBottom: '8px', fontWeight: 700, color: 'var(--color-primary)' }}>
          📓 Salvar no diário
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          Nenhuma transcrição ativa foi detectada. Cole ou digite o que quer salvar.
        </p>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="O que você quer guardar no diário?"
          disabled={saving}
          rows={6}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            fontFamily: 'inherit',
            fontSize: '0.95rem',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {error && (
          <div style={{
            marginTop: '12px',
            padding: '10px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(225, 29, 72, 0.12)',
            color: '#fda4af',
            fontSize: '0.82rem',
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setModalOpen(false)}
            disabled={saving}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => save(content, 'GamaVoz-manual')}
            disabled={saving || !content.trim()}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-primary)',
              color: '#0b0b10',
              border: 'none',
              cursor: saving || !content.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: 700,
              opacity: saving || !content.trim() ? 0.5 : 1,
            }}
          >
            {saving ? 'Salvando...' : 'Salvar no diário'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        onClick={onClick}
        title={
          reachable === false
            ? `Diário OFFLINE — abra o backend em ${DIARIO_API.replace('/entries', '')}`
            : 'Adicionar ao diário (GAMA_DIARIO)'
        }
        style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          background: savedAt
            ? 'var(--color-primary-dim)'
            : reachable === false
              ? 'rgba(225, 29, 72, 0.12)'
              : 'transparent',
          border: '1px solid ' + (
            savedAt
              ? 'var(--color-primary)'
              : reachable === false
                ? 'rgba(225, 29, 72, 0.4)'
                : 'var(--color-border)'
          ),
          cursor: 'pointer',
          color: savedAt
            ? 'var(--color-primary)'
            : reachable === false
              ? '#fda4af'
              : 'var(--color-text)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          fontWeight: 600,
          transition: 'all var(--motion-duration-fast)',
        }}
        onMouseEnter={e => {
          if (!savedAt && reachable !== false) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            e.currentTarget.style.borderColor = 'var(--color-border-green)'
          }
        }}
        onMouseLeave={e => {
          if (!savedAt && reachable !== false) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'var(--color-border)'
          }
        }}
      >
        <BookOpen style={{ width: '18px', height: '18px' }} />
        <span>
          {savedAt
            ? `✓ Salvo ${savedAt}`
            : reachable === false
              ? '📓 Diário (offline)'
              : '📓 Diário'}
        </span>
      </button>

      {/* Portal: renderiza o modal direto no <body>, escapando de qualquer
          stacking context criado por transform/filter no GamaVoz. */}
      {mounted && modalOpen && modalNode
        ? createPortal(modalNode, document.body)
        : null}
    </>
  )
}
