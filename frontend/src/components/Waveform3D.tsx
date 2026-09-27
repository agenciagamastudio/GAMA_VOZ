/**
 * Waveform3D — Canvas-based audio visualizer with microphone input.
 * Renders a 3D-style waveform using the Web Audio API + Canvas 2D.
 */
import React, { useRef, useEffect, useCallback } from 'react'

export interface Waveform3DProps {
  width?: number
  height?: number
  /** Control microphone externally (true = active) */
  isActive?: boolean
  /** External audio stream (e.g. TTS output, STT mic) */
  audioStream?: MediaStream
  /** Flag for controlling visualization with external stream */
  isRecording?: boolean
  /** Callback fired when internal status changes */
  onStatusChange?: (status: string) => void
}

export function Waveform3D({
  width = 500,
  height = 500,
  isActive,
  audioStream,
  isRecording,
  onStatusChange,
}: Waveform3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const ctxRef    = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const activeRef = useRef(false)

  const notify = useCallback((msg: string) => {
    onStatusChange?.(msg)
  }, [onStatusChange])

  const stopCapture = useCallback(() => {
    cancelAnimationFrame(animRef.current)
    sourceRef.current?.disconnect()
    ctxRef.current?.close()
    ctxRef.current  = null
    sourceRef.current = null
    analyserRef.current = null
    activeRef.current = false
    notify('Parado')
    // Clear canvas
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [notify])

  const startCapture = useCallback(async (stream?: MediaStream) => {
    try {
      const mediaStream = stream ?? await navigator.mediaDevices.getUserMedia({ audio: true })
      const ac = new AudioContext()
      const analyser = ac.createAnalyser()
      analyser.fftSize = 256
      const src = ac.createMediaStreamSource(mediaStream)
      src.connect(analyser)

      ctxRef.current = ac
      sourceRef.current = src
      analyserRef.current = analyser
      activeRef.current = true
      notify('Ouvindo…')

      const data = new Uint8Array(analyser.frequencyBinCount)
      const canvas = canvasRef.current!
      const c = canvas.getContext('2d')!
      const W = canvas.width
      const H = canvas.height
      const PRIMARY = '#88ce11'

      const draw = () => {
        animRef.current = requestAnimationFrame(draw)
        analyser.getByteFrequencyData(data)

        c.clearRect(0, 0, W, H)
        c.fillStyle = 'rgba(22, 22, 22, 0.85)'
        c.fillRect(0, 0, W, H)

        const barW = W / data.length
        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 255
          const barH = v * H * 0.9

          // depth gradient
          const alpha = 0.4 + v * 0.6
          c.fillStyle = `rgba(136, 206, 17, ${alpha})`
          c.fillRect(i * barW, H - barH, barW - 1, barH)

          // reflection
          c.fillStyle = `rgba(136, 206, 17, ${alpha * 0.15})`
          c.fillRect(i * barW, H, barW - 1, barH * 0.3)

          // peak dot
          if (v > 0.7) {
            c.beginPath()
            c.arc(i * barW + barW / 2, H - barH - 4, 3, 0, Math.PI * 2)
            c.fillStyle = PRIMARY
            c.fill()
          }
        }

        // concentric circle overlay
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
        for (let r = 1; r <= 3; r++) {
          c.beginPath()
          c.arc(W / 2, H / 2, (W / 2) * (r / 3) * (0.5 + avg * 0.5), 0, Math.PI * 2)
          c.strokeStyle = `rgba(136, 206, 17, ${0.08 * r * avg})`
          c.lineWidth = 1
          c.stroke()
        }
      }
      draw()
    } catch {
      notify('Erro ao acessar microfone')
    }
  }, [notify])

  // React to external isActive / audioStream / isRecording props
  useEffect(() => {
    if (audioStream && isRecording) {
      startCapture(audioStream)
      return () => stopCapture()
    }
  }, [audioStream, isRecording, startCapture, stopCapture])

  useEffect(() => {
    if (isActive === true)  startCapture()
    if (isActive === false) stopCapture()
  }, [isActive, startCapture, stopCapture])

  // Click-to-toggle when used standalone (no external props)
  const handleClick = useCallback(() => {
    if (isActive !== undefined || audioStream !== undefined) return
    if (activeRef.current) stopCapture()
    else startCapture()
  }, [isActive, audioStream, startCapture, stopCapture])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        borderRadius: '12px',
        display: 'block',
        maxWidth: '100%',
      }}
    />
  )
}

export default Waveform3D
