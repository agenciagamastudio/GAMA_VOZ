import React from 'react'

// ── Volume2 — minimalista: fale + 3 ondas geométricas ──────────────────────────
// stroke 1.5 — linecap/square — sem curvas amigáveis
export function VolMinimal({ size = 20, color = 'currentColor', style = {}, className = '' }: {
  size?: number
  color?: string
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      style={style}
      className={className}
    >
      <path d="M5 8h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
      <path d="M15 10.5v3a6 6 0 0 1-6 6" />
      <path d="M18.5 7.5v8a8 8 0 0 1-8 8" />
      <path d="M20.5 5.5v11a10 10 0 0 1-10 10" />
    </svg>
  )
}

// ── Mic — minimalista: cápsula + suporte, sem curvas excedentes ─────────────────
export function MicMinimal({ size = 20, color = 'currentColor', style = {} }: {
  size?: number
  color?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      style={style}
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
    </svg>
  )
}

// ── MicOff — minimalista: mesmo traço com X ─────────────────────────────────────
export function MicOffMinimal({ size = 20, color = 'currentColor', style = {} }: {
  size?: number
  color?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      style={style}
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
      <path d="M7 7l10 10" />
      <path d="M17 7L7 17" />
    </svg>
  )
}

// ── Play — triângulo isósceles puro, sem round ───────────────────────────────────
export function PlayMinimal({ size = 20, color = 'currentColor', style = {} }: {
  size?: number
  color?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      style={style}
    >
      <path d="M8 5.78L18.22 12 8 18.22V5.78Z" />
    </svg>
  )
}

// ── Pause — dois retângulos, sem round ──────────────────────────────────────────
export function PauseMinimal({ size = 20, color = 'currentColor', style = {} }: {
  size?: number
  color?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      style={style}
    >
      <rect x="7" y="5" width="4" height="14" rx="0" />
      <rect x="13" y="5" width="4" height="14" rx="0" />
    </svg>
  )
}

// ── Loader — círculo concêntrico + cruz ─────────────────────────────────────────
export function LoaderMinimal({ size = 20, color = 'currentColor', style = {} }: {
  size?: number
  color?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      style={style}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
      <circle cx="12" cy="12" r="4" fill={color} stroke="none" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeOpacity={0.5} />
    </svg>
  )
}

// ── Square (stop) — quadrado cheio, bordas duras ────────────────────────────────
export function SquareMinimal({ size = 20, color = 'currentColor', style = {} }: {
  size?: number
  color?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      style={style}
    >
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  )
}
