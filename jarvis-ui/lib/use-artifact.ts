"use client"

import { useState, useCallback } from "react"

export interface Artifact {
  id: string
  type: string      // 'mermaid' | 'svg' | 'html' | 'react' | 'code'
  title: string
  language?: string
  content: string
  timestamp: string
}

export function useArtifact() {
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [history, setHistory] = useState<Artifact[]>([])
  const [panelOpen, setPanelOpen] = useState(false)

  const showArtifact = useCallback((artifact: Omit<Artifact, "id" | "timestamp">) => {
    const full: Artifact = {
      ...artifact,
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Australia/Adelaide",
      }),
    }
    setActiveArtifact(full)
    setHistory((prev) => [...prev.slice(-19), full])
    setPanelOpen(true)
  }, [])

  const closePanel = useCallback(() => setPanelOpen(false), [])

  const selectFromHistory = useCallback((id: string) => {
    const found = history.find((a) => a.id === id)
    if (found) {
      setActiveArtifact(found)
      setPanelOpen(true)
    }
  }, [history])

  return { activeArtifact, history, panelOpen, showArtifact, closePanel, selectFromHistory }
}
