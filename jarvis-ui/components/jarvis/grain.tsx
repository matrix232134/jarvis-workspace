"use client"

import { useEffect, useRef } from "react"

export default function Grain() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Create a small canvas to generate the noise tile
    const tile = document.createElement("canvas")
    tile.width = 200
    tile.height = 200
    const ctx = tile.getContext("2d")
    if (!ctx) return

    const imageData = ctx.createImageData(200, 200)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 7
    }
    ctx.putImageData(imageData, 0, 0)

    // Convert to data URL and set as repeating background
    const dataUrl = tile.toDataURL("image/png")
    if (containerRef.current) {
      containerRef.current.style.backgroundImage = `url(${dataUrl})`
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 999,
        mixBlendMode: "multiply",
        opacity: 0.35,
        backgroundRepeat: "repeat",
        backgroundSize: "200px 200px",
      }}
    />
  )
}
