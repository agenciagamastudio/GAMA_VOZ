import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { VolMinimal } from '../icons/MediaIcons'
import { API_BASE_URL } from '../utils/config'
import ParticleBackground from './ParticleBackground'

interface LoginProps {
  onLoginSuccess: (token: string, user: { id: number; email: string; name: string }) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-main)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 200ms, box-shadow 200ms',
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
      const body = isLogin ? { email, password } : { email, password, name }
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Erro ao fazer login'); return }
      localStorage.setItem('gama_voz_token', data.token)
      localStorage.setItem('gama_voz_user', JSON.stringify(data.user))
      onLoginSuccess(data.token, data.user)
    } catch (err) {
      setError('Erro de conexão com o servidor')
    } finally {
      setLoading(false)
    }
  }

  const switchTab = (login: boolean) => { setIsLogin(login); setError('') }

  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--color-primary)'
    e.target.style.boxShadow = '0 0 0 3px var(--color-primary-dim)'
  }
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--color-border)'
    e.target.style.boxShadow = 'none'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
    }}>
      <ParticleBackground />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              className="pulse-green"
              style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--color-primary), #6fa80a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <VolMinimal style={{ width: '26px', height: '26px', color: '#000' }} />
            </div>
            <h1 className="gradient-text" style={{ fontSize: '32px', fontWeight: 900, margin: 0 }}>
              GAMA Voz
            </h1>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', margin: 0 }}>
            Audiobook Generator com IA
          </p>
        </div>

        {/* Card */}
        <div className="glass" style={{ borderRadius: 'var(--radius-xl)', padding: '32px' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
            {['Login', 'Registrar'].map((label, i) => {
              const active = isLogin === (i === 0)
              return (
                <button
                  key={label}
                  onClick={() => switchTab(i === 0)}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 'var(--radius-md)',
                    border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-main)', fontWeight: 700, fontSize: '14px',
                    background: active ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                    color: active ? '#000' : 'var(--color-text)',
                    transition: 'all 200ms',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {!isLogin && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  required
                  minLength={6}
                  style={{ ...inputStyle, paddingRight: '48px' }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-muted)', display: 'flex', padding: 0,
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {!isLogin && (
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Mínimo 6 caracteres
                </p>
              )}
            </div>

            {error && (
              <div style={{
                padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px',
                background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.3)',
                color: 'var(--color-error)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                borderRadius: 'var(--radius-lg)', border: 'none',
                background: 'var(--color-primary)', color: '#000',
                fontFamily: 'var(--font-main)', fontWeight: 900, fontSize: '15px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.65 : 1,
                transition: 'all 200ms',
                boxShadow: '0 4px 20px var(--color-primary-glow)',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.filter = 'brightness(1.1)' }}
              onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
            >
              {loading ? 'Carregando...' : isLogin ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          {/* Demo */}
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: '10px' }}>
              Teste com conta demo:
            </p>
            <div style={{
              background: 'rgba(0,0,0,0.3)', padding: '12px 14px', borderRadius: 'var(--radius-md)',
              fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Email:</span> demo@gama.voz
              </p>
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Senha:</span> demo123456
              </p>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '20px' }}>
          🚀 Gerador de Audiobooks com IA
        </p>
      </div>
    </div>
  )
}
