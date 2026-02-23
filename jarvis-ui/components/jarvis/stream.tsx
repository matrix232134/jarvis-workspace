"use client"

import { useRef, useEffect, type ReactNode } from "react"

export default function Stream({
  children,
  panelOffset,
}: {
  children: ReactNode
  panelOffset: number
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Debounce scroll to at most once per 100ms to avoid layout thrashing during streaming
    if (scrollTimerRef.current) return
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }, [children])

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden"
      style={{
        paddingTop: 60,
        paddingBottom: 140,
        paddingRight: panelOffset > 0 ? panelOffset : 0,
        transition: "padding-right 0.4s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 620, padding: "0 20px" }}>
        {children}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
