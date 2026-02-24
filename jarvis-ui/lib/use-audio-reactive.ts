"use client"

import { useState, useCallback, useRef, useEffect } from "react"

export interface AudioLevels {
  bass: number      // 0-1, low frequency energy
  mid: number       // 0-1, mid frequency energy
  treble: number    // 0-1, high frequency energy
  volume: number    // 0-1, overall loudness
}

const EMPTY_LEVELS: AudioLevels = { bass: 0, mid: 0, treble: 0, volume: 0 }

export function useAudioReactive() {
  const [active, setActive] = useState(false)
  const [levels, setLevels] = useState<AudioLevels>(EMPTY_LEVELS)

  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number>(0)
  const mountedRef = useRef(true)

  // Smoothed values for less jitter
  const smoothRef = useRef<AudioLevels>({ ...EMPTY_LEVELS })

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {})
      ctxRef.current = null
    }
    analyserRef.current = null
    smoothRef.current = { ...EMPTY_LEVELS }
    setLevels(EMPTY_LEVELS)
    setActive(false)
  }, [])

  const start = useCallback(async () => {
    try {
      // Request system audio via screen share
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,  // Required by Chrome, we'll discard it
        audio: true,
      })

      // Stop video track immediately — we only want audio
      stream.getVideoTracks().forEach((t) => t.stop())

      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      // Listen for track ending (user stops sharing)
      audioTracks[0].addEventListener("ended", () => {
        if (mountedRef.current) stop()
      })

      streamRef.current = stream

      // Set up Web Audio analyser
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(new MediaStream(audioTracks))
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)

      ctxRef.current = audioCtx
      analyserRef.current = analyser
      setActive(true)

      // Analysis loop
      const freqData = new Uint8Array(analyser.frequencyBinCount)
      const binCount = analyser.frequencyBinCount // 128 bins
      const nyquist = audioCtx.sampleRate / 2

      // Frequency band boundaries (as bin indices)
      const bassBin = Math.floor((200 / nyquist) * binCount)      // 0-200 Hz
      const midBin = Math.floor((2000 / nyquist) * binCount)      // 200-2000 Hz
      // treble is midBin to end

      const tick = () => {
        if (!analyserRef.current || !mountedRef.current) return

        analyserRef.current.getByteFrequencyData(freqData)

        // Calculate band averages (0-255 range)
        let bassSum = 0, midSum = 0, trebleSum = 0
        for (let i = 0; i < binCount; i++) {
          if (i < bassBin) bassSum += freqData[i]
          else if (i < midBin) midSum += freqData[i]
          else trebleSum += freqData[i]
        }

        const bassAvg = bassBin > 0 ? bassSum / bassBin / 255 : 0
        const midAvg = (midBin - bassBin) > 0 ? midSum / (midBin - bassBin) / 255 : 0
        const trebleAvg = (binCount - midBin) > 0 ? trebleSum / (binCount - midBin) / 255 : 0

        // Overall volume from all bins
        let totalSum = 0
        for (let i = 0; i < binCount; i++) totalSum += freqData[i]
        const volumeAvg = totalSum / binCount / 255

        // Smooth for less jitter (exponential moving average)
        const s = smoothRef.current
        const k = 0.3  // smoothing factor (higher = more responsive)
        s.bass = s.bass + (bassAvg - s.bass) * k
        s.mid = s.mid + (midAvg - s.mid) * k
        s.treble = s.treble + (trebleAvg - s.treble) * k
        s.volume = s.volume + (volumeAvg - s.volume) * k

        setLevels({ bass: s.bass, mid: s.mid, treble: s.treble, volume: s.volume })
        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    } catch {
      // User cancelled the share dialog
      stop()
    }
  }, [stop])

  const toggle = useCallback(() => {
    if (active) stop()
    else start()
  }, [active, start, stop])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      ctxRef.current?.close().catch(() => {})
    }
  }, [])

  return { active, levels, toggle }
}
