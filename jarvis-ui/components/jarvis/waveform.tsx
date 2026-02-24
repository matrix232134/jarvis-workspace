"use client"

import { useEffect, useRef } from "react"
import type { JarvisState } from "@/lib/types"
import type { AudioLevels } from "@/lib/use-audio-reactive"

interface WaveConfig {
  count: number
  amplitude: number
  speed: number
  alpha: number
  lineWidth: number
}

const WAVE_CONFIG: Record<JarvisState, WaveConfig> = {
  idle: { count: 3, amplitude: 12, speed: 0.005, alpha: 0.12, lineWidth: 1.5 },
  processing: { count: 5, amplitude: 28, speed: 0.014, alpha: 0.18, lineWidth: 1.5 },
  listening: { count: 6, amplitude: 50, speed: 0.02, alpha: 0.22, lineWidth: 2.0 },
  speaking: { count: 7, amplitude: 65, speed: 0.025, alpha: 0.28, lineWidth: 2.0 },
  disconnected: { count: 0, amplitude: 0, speed: 0, alpha: 0, lineWidth: 0 },
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export default function Waveform({ state, audioLevels }: { state: JarvisState; audioLevels?: AudioLevels }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef(0)
  const frameRef = useRef<number>(0)
  const currentRef = useRef<WaveConfig>({ ...WAVE_CONFIG[state] })
  const targetRef = useRef<WaveConfig>({ ...WAVE_CONFIG[state] })
  const audioRef = useRef<AudioLevels | undefined>(audioLevels)

  // Keep audio levels ref in sync
  useEffect(() => {
    audioRef.current = audioLevels
  }, [audioLevels])

  // Update target when state changes — draw loop interpolates smoothly
  // When audio reactive, modulate the target based on audio levels
  useEffect(() => {
    const base = { ...WAVE_CONFIG[state] }
    const audio = audioRef.current

    if (audio && audio.volume > 0.01) {
      // Audio-reactive modulation — bass drives amplitude, volume drives alpha
      base.amplitude = Math.max(base.amplitude, 15 + audio.bass * 120)
      base.alpha = Math.max(base.alpha, 0.08 + audio.volume * 0.5)
      base.lineWidth = Math.max(base.lineWidth, 1.2 + audio.volume * 1.5)
      base.speed = Math.max(base.speed, 0.005 + audio.mid * 0.03)
      base.count = Math.max(base.count, 3 + Math.floor(audio.treble * 5))
    }

    targetRef.current = base
  }, [state, audioLevels])

  // Canvas setup + draw loop — runs once on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener("resize", resize)

    const draw = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      const target = targetRef.current
      const current = currentRef.current

      // Interpolate toward target
      const t = 0.04
      current.count = lerp(current.count, target.count, t)
      current.amplitude = lerp(current.amplitude, target.amplitude, t)
      current.speed = lerp(current.speed, target.speed, t)
      current.alpha = lerp(current.alpha, target.alpha, t)
      current.lineWidth = lerp(current.lineWidth, target.lineWidth, t)

      ctx.clearRect(0, 0, w, h)

      const waveCount = Math.round(current.count)
      if (waveCount === 0) {
        frameRef.current = requestAnimationFrame(draw)
        return
      }

      timeRef.current += current.speed

      // Main wave pass
      for (let wi = 0; wi < waveCount; wi++) {
        const waveAlpha = current.alpha * Math.pow(0.85, wi)
        const phaseOffset = wi * 0.8
        const freqMod = 1 + wi * 0.3

        // Gradient stroke — fades at edges
        const gradient = ctx.createLinearGradient(0, 0, w, 0)
        gradient.addColorStop(0, `rgba(29,78,216,0)`)
        gradient.addColorStop(0.15, `rgba(29,78,216,${waveAlpha})`)
        gradient.addColorStop(0.5, `rgba(29,78,216,${waveAlpha})`)
        gradient.addColorStop(0.85, `rgba(29,78,216,${waveAlpha})`)
        gradient.addColorStop(1, `rgba(29,78,216,0)`)

        ctx.beginPath()
        ctx.strokeStyle = gradient
        ctx.lineWidth = current.lineWidth
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        for (let x = 0; x <= w; x += 2) {
          const ratio = x / w
          const envelope = Math.exp(-Math.pow((ratio - 0.5) * 2.8, 2))
          const noise = Math.sin(timeRef.current * 3.7 + x * 0.01) * 0.15

          const y1 = Math.sin((ratio * 6 * freqMod) + timeRef.current + phaseOffset)
          const y2 = Math.sin((ratio * 11 * freqMod) + timeRef.current * 1.3 + phaseOffset) * 0.5
          const y3 = Math.sin((ratio * 17 * freqMod) + timeRef.current * 0.7 + phaseOffset) * 0.25

          const y = h / 2 + (y1 + y2 + y3 + noise) * current.amplitude * envelope

          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // Glow/bloom pass — luminous halo beneath primary strokes
      ctx.globalCompositeOperation = "lighter"
      const glowCount = Math.min(waveCount, 3)
      for (let wi = 0; wi < glowCount; wi++) {
        const glowAlpha = current.alpha * 0.4 * Math.pow(0.7, wi)
        const phaseOffset = wi * 0.8
        const freqMod = 1 + wi * 0.3

        const gGrad = ctx.createLinearGradient(0, 0, w, 0)
        gGrad.addColorStop(0, `rgba(29,78,216,0)`)
        gGrad.addColorStop(0.2, `rgba(29,78,216,${glowAlpha})`)
        gGrad.addColorStop(0.5, `rgba(29,78,216,${glowAlpha})`)
        gGrad.addColorStop(0.8, `rgba(29,78,216,${glowAlpha})`)
        gGrad.addColorStop(1, `rgba(29,78,216,0)`)

        ctx.beginPath()
        ctx.strokeStyle = gGrad
        ctx.lineWidth = current.lineWidth + 6
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        for (let x = 0; x <= w; x += 2) {
          const ratio = x / w
          const envelope = Math.exp(-Math.pow((ratio - 0.5) * 2.8, 2))
          const noise = Math.sin(timeRef.current * 3.7 + x * 0.01) * 0.15

          const y1 = Math.sin((ratio * 6 * freqMod) + timeRef.current + phaseOffset)
          const y2 = Math.sin((ratio * 11 * freqMod) + timeRef.current * 1.3 + phaseOffset) * 0.5
          const y3 = Math.sin((ratio * 17 * freqMod) + timeRef.current * 0.7 + phaseOffset) * 0.25

          const y = h / 2 + (y1 + y2 + y3 + noise) * current.amplitude * envelope

          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.globalCompositeOperation = "source-over"

      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    />
  )
}
