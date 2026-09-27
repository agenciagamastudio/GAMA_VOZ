import React from 'react'
import { CheckCircle } from 'lucide-react'

interface ToastProps {
  message: string
  visible: boolean
}

export default function Toast({ message, visible }: ToastProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '28px',
      right: '28px',
      zIndex: 9999,
      padding: '12px 20px',
      borderRadius: 'var(--radius-xl)',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(136,206,17,0.35)',
      color: 'var(--color-text)',
      fontSize: '13px',
      fontWeight: 600,
      fontFamily: 'var(--font-main)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.96)',
      transition: 'opacity 200ms ease, transform 200ms ease',
      pointerEvents: 'none',
    }}>
      <CheckCircle style={{ width: '15px', height: '15px', color: 'var(--color-primary)', flexShrink: 0 }} />
      {message}
    </div>
  )
}
