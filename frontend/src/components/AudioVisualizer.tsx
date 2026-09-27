import React, { useEffect, useRef } from 'react'

const R = 136, G = 206, B = 17

interface AudioVisualizerProps {
  isRecording: boolean
  audioStream?: MediaStream
  onToggleRecording?: () => void
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isRecording, audioStream, onToggleRecording,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const smoothedRef = useRef<number[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    cancelAnimationFrame(animRef.current)

    // Disconnect previous audio
    try { sourceRef.current?.disconnect() } catch {}
    sourceRef.current = null
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try { audioCtxRef.current.close() } catch {}
    }
    audioCtxRef.current = null
    analyserRef.current = null

    const cx = canvas.width / 2
    const cy = canvas.height / 2

    if (!isRecording || !audioStream) {
      // ── IDLE: breathing animation ──────────────────────────────────────
      const drawIdle = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const t = Date.now() / 1000
        const breath = Math.sin(t * 1.1) * 0.5 + 0.5 // 0→1 ~0.55Hz

        // Outer pulsing ring
        ctx.beginPath()
        ctx.arc(cx, cy, 92 + breath * 8, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,255,255,${0.04 + breath * 0.06})`
        ctx.lineWidth = 1
        ctx.stroke()

        // Main ring
        ctx.beginPath()
        ctx.arc(cx, cy, 76, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,255,255,${0.11 + breath * 0.05})`
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Center fill
        ctx.beginPath()
        ctx.arc(cx, cy, 62, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${0.03 + breath * 0.03})`
        ctx.fill()

        // Mic icon
        ctx.font = '38px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = 0.32 + breath * 0.18
        ctx.fillStyle = '#fff'
        ctx.fillText('🎙️', cx, cy + 1)
        ctx.globalAlpha = 1

        animRef.current = requestAnimationFrame(drawIdle)
      }
      animRef.current = requestAnimationFrame(drawIdle)
      return () => cancelAnimationFrame(animRef.current)
    }

    // ── RECORDING: discrete radial bars ───────────────────────────────────
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      audioCtxRef.current = new AudioCtx()
      const ac = audioCtxRef.current as AudioContext
      if (ac.state === 'suspended') ac.resume().catch(() => {})

      sourceRef.current = ac.createMediaStreamSource(audioStream)
      const analyser = ac.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.82
      sourceRef.current.connect(analyser)
      analyserRef.current = analyser

      const bufLen = analyser.frequencyBinCount
      const rawData = new Uint8Array(bufLen)
      smoothedRef.current = new Array(bufLen).fill(0)

      const NUM_BARS = 128
      const INNER_R = 78
      const MAX_BAR = 66

      const drawRecording = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        analyserRef.current!.getByteFrequencyData(rawData)
        const sm = smoothedRef.current
        for (let i = 0; i < bufLen; i++) {
          sm[i] = sm[i] * 0.72 + (rawData[i] / 255) * 0.28
        }

        let avg = 0
        for (let i = 0; i < sm.length; i++) avg += sm[i]
        avg /= sm.length

        // Discrete radial bars
        for (let i = 0; i < NUM_BARS; i++) {
          const di = Math.floor((i / NUM_BARS) * bufLen * 0.78)
          const v = sm[di] || 0
          const barLen = Math.max(2, v * MAX_BAR)
          const angle = (i / NUM_BARS) * Math.PI * 2 - Math.PI / 2

          const cos = Math.cos(angle), sin = Math.sin(angle)
          ctx.beginPath()
          ctx.moveTo(cx + cos * INNER_R, cy + sin * INNER_R)
          ctx.lineTo(cx + cos * (INNER_R + barLen), cy + sin * (INNER_R + barLen))
          ctx.strokeStyle = `rgba(${R},${G},${B},${0.28 + v * 0.72})`
          ctx.lineWidth = 2.2
          ctx.lineCap = 'round'
          ctx.stroke()
        }

        // Inner ring
        ctx.beginPath()
        ctx.arc(cx, cy, INNER_R - 1, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${R},${G},${B},${0.22 + avg * 0.48})`
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Center radial glow
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34)
        grd.addColorStop(0, `rgba(${R},${G},${B},${0.5 + avg * 0.4})`)
        grd.addColorStop(1, `rgba(${R},${G},${B},0)`)
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.arc(cx, cy, 34, 0, Math.PI * 2)
        ctx.fill()

        // Center pulsing dot
        const dotR = 9 + avg * 7
        ctx.beginPath()
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${R},${G},${B},${0.7 + avg * 0.3})`
        ctx.fill()

        // Stop icon (square) — indicates "click to stop"
        const sq = 8 + avg * 3
        ctx.fillStyle = '#0a0a0a'
        ctx.fillRect(cx - sq / 2, cy - sq / 2, sq, sq)

        animRef.current = requestAnimationFrame(drawRecording)
      }

      animRef.current = requestAnimationFrame(drawRecording)
    } catch (err) {
      console.error('AudioVisualizer setup error:', err)
    }

    return () => {
      cancelAnimationFrame(animRef.current)
      try { sourceRef.current?.disconnect() } catch {}
      sourceRef.current = null
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close() } catch {}
      }
      audioCtxRef.current = null
      analyserRef.current = null
    }
  }, [isRecording, audioStream])

  return (
    <div
      onClick={onToggleRecording}
      style={{
        padding: '20px',
        borderRadius: '50%',
        cursor: 'pointer',
        transition: 'transform 200ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        style={{
          backgroundColor: '#161616',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'block',
          boxShadow: isRecording
            ? '0 0 64px rgba(136,206,17,0.35), inset 0 0 48px rgba(136,206,17,0.1)'
            : '0 0 40px rgba(136,206,17,0.1), inset 0 0 30px rgba(136,206,17,0.03)',
          border: `2px solid rgba(136,206,17,${isRecording ? 0.45 : 0.16})`,
          transition: 'box-shadow 600ms ease, border-color 600ms ease',
        }}
      />
    </div>
  )
}

export default AudioVisualizer
