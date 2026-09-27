/**
 /** Shared audio-effects sub-components.
  * Used by PostProcessingStudio and AudiobookGenerator.
  */
 import React from 'react'

 // ─── Types ────────────────────────────────────────────────────────────────────

export interface EffectState<T> {
  enabled: boolean
  params: T
}

export interface AllEffects {
  pitch_shift:   EffectState<{ n_steps: number }>
  time_stretch:  EffectState<{ rate: number }>
  reverb:        EffectState<{ decay: number }>
  compressor:    EffectState<{ threshold: number; ratio: number }>
  eq_bass_boost: EffectState<{ amount: number }>
}

export const DEFAULT_EFFECTS: AllEffects = {
  pitch_shift:   { enabled: false, params: { n_steps: 0 } },
  time_stretch:  { enabled: false, params: { rate: 1.0 } },
  reverb:        { enabled: false, params: { decay: 0.4 } },
  compressor:    { enabled: false, params: { threshold: -20, ratio: 4 } },
  eq_bass_boost: { enabled: false, params: { amount: 1.5 } },
}

/** Build effects payload dict (only enabled effects) for sending to backend. */
export function buildEffectsPayload(effects: AllEffects): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (effects.pitch_shift.enabled)   payload.pitch_shift   = effects.pitch_shift.params
  if (effects.time_stretch.enabled)  payload.time_stretch  = effects.time_stretch.params
  if (effects.reverb.enabled)        payload.reverb        = effects.reverb.params
  if (effects.compressor.enabled)    payload.compressor    = effects.compressor.params
  if (effects.eq_bass_boost.enabled) payload.eq_bass_boost = effects.eq_bass_boost.params
  return payload
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function sliderBg(val: number, min: number, max: number): string {
  const p = ((val - min) / (max - min)) * 100
  return `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${p}%, rgba(255,255,255,0.1) ${p}%, rgba(255,255,255,0.1) 100%)`
}

// ─── EffectCard ───────────────────────────────────────────────────────────────

export interface EffectCardProps {
  label: string
  enabled: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function EffectCard({ label, enabled, onToggle, children }: EffectCardProps) {
  return (
    <div
      style={{
        background: enabled ? 'rgba(136,206,17,0.04)' : 'var(--glass-bg-2)',
        border: `1px solid ${enabled ? 'var(--color-border-green)' : 'var(--color-border)'}`,
        borderRadius: '12px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        transition: 'border-color 200ms, background 200ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: enabled ? 'var(--color-primary)' : 'var(--color-text-secondary)', transition: 'color 200ms' }}>
          {label}
        </span>

        <div
          onClick={onToggle}
          role="switch"
          aria-checked={enabled}
          tabIndex={0}
          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') onToggle() }}
          style={{
            width: '36px',
            height: '20px',
            borderRadius: '999px',
            background: enabled ? 'var(--color-primary)' : 'rgba(255,255,255,0.12)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 200ms',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '3px',
              left: enabled ? '19px' : '3px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: enabled ? '#000' : 'rgba(255,255,255,0.45)',
              transition: 'left 200ms, background 200ms',
            }}
          />
        </div>
      </div>

      <div
        style={{
          overflow: 'hidden',
          maxHeight: enabled ? '220px' : '0px',
          opacity: enabled ? 1 : 0,
          transition: 'max-height 280ms ease, opacity 200ms ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ─── SliderRow ────────────────────────────────────────────────────────────────

export interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}

export function SliderRow({ label, value, min, max, step, format, onChange }: SliderRowProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{label}</span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--color-primary)',
            fontVariantNumeric: 'tabular-nums',
            minWidth: '52px',
            textAlign: 'right',
          }}
        >
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          height: '6px',
          borderRadius: '8px',
          appearance: 'none' as any,
          cursor: 'pointer',
          background: sliderBg(value, min, max),
          transition: 'background 50ms',
        }}
      />
    </div>
  )
}

// ─── EffectsPanel (full effect rack) ─────────────────────────────────────────

export interface EffectsPanelProps {
  effects: AllEffects
  onToggle: (key: keyof AllEffects) => void
  onParam: (key: keyof AllEffects, paramKey: string, val: number) => void
}

export function EffectsPanel({ effects, onToggle, onParam }: EffectsPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      <EffectCard
        label="Pitch Shift"
        enabled={effects.pitch_shift.enabled}
        onToggle={() => onToggle('pitch_shift')}
      >
        <SliderRow
          label="Semitones"
          value={effects.pitch_shift.params.n_steps}
          min={-12} max={12} step={0.5}
          format={v => `${v > 0 ? '+' : ''}${v}`}
          onChange={v => onParam('pitch_shift', 'n_steps', v)}
        />
      </EffectCard>

      <EffectCard
        label="Time Stretch"
        enabled={effects.time_stretch.enabled}
        onToggle={() => onToggle('time_stretch')}
      >
        <SliderRow
          label="Velocidade"
          value={effects.time_stretch.params.rate}
          min={0.5} max={2.0} step={0.05}
          format={v => `${v.toFixed(2)}x`}
          onChange={v => onParam('time_stretch', 'rate', v)}
        />
      </EffectCard>

      <EffectCard
        label="Reverb"
        enabled={effects.reverb.enabled}
        onToggle={() => onToggle('reverb')}
      >
        <SliderRow
          label="Decaimento"
          value={effects.reverb.params.decay}
          min={0.1} max={0.9} step={0.05}
          format={v => v.toFixed(2)}
          onChange={v => onParam('reverb', 'decay', v)}
        />
      </EffectCard>

      <EffectCard
        label="Compressor"
        enabled={effects.compressor.enabled}
        onToggle={() => onToggle('compressor')}
      >
        <SliderRow
          label="Threshold"
          value={effects.compressor.params.threshold}
          min={-60} max={0} step={1}
          format={v => `${v} dB`}
          onChange={v => onParam('compressor', 'threshold', v)}
        />
        <SliderRow
          label="Ratio"
          value={effects.compressor.params.ratio}
          min={1} max={20} step={0.5}
          format={v => `${v.toFixed(1)}:1`}
          onChange={v => onParam('compressor', 'ratio', v)}
        />
      </EffectCard>

      <EffectCard
        label="EQ Bass Boost"
        enabled={effects.eq_bass_boost.enabled}
        onToggle={() => onToggle('eq_bass_boost')}
      >
        <SliderRow
          label="Intensidade"
          value={effects.eq_bass_boost.params.amount}
          min={0.5} max={2.0} step={0.05}
          format={v => `${v.toFixed(2)}x`}
          onChange={v => onParam('eq_bass_boost', 'amount', v)}
        />
      </EffectCard>

    </div>
  )
}

/** Collapsible section header + effect count pill */
export interface EffectsSectionHeaderProps {
  activeCount: number
  expanded: boolean
  onToggleExpanded: () => void
}

export function EffectsSectionHeader({ activeCount, expanded, onToggleExpanded }: EffectsSectionHeaderProps) {
  return (
    <div
      onClick={onToggleExpanded}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        padding: '14px 16px',
        borderRadius: '12px',
        background: 'var(--glass-bg-2)',
        border: `1px solid ${activeCount > 0 ? 'var(--color-border-green)' : 'var(--color-border)'}`,
        transition: 'border-color 200ms',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
        Efeitos (aplicados a todo o audiobook)
      </span>
      <span style={{ fontSize: '18px', color: 'var(--color-text-muted)', lineHeight: 1 }}>
        {expanded ? '▲' : '▼'}
      </span>
    </div>
  )
}
