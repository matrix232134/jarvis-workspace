"use client"

import { useState, useCallback, useEffect } from "react"
import type { ArtifactRef } from "@/lib/types"

export interface Artifact {
  id: string
  type: string      // 'mermaid' | 'svg' | 'html' | 'react' | 'code'
  title: string
  language?: string
  content: string
  timestamp: string
}

const LIBRARY_KEY = "jarvis-library"
const MAX_ITEMS = 100

/** Generate a simple dedup key from an artifact's identity */
function dedupKey(a: { type: string; title: string; content: string }): string {
  return `${a.type}::${a.title}::${a.content.slice(0, 200)}`
}

/** Read library from localStorage */
function loadLibrary(): Artifact[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/** Write library to localStorage */
function saveLibrary(items: Artifact[]): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch { /* quota exceeded — silently cap */ }
}

/** Persist a single artifact to localStorage (dedup, cap, newest first) */
function persistToLibrary(artifact: Artifact): Artifact[] {
  const existing = loadLibrary()
  const key = dedupKey(artifact)
  // Dedup — skip if already present
  if (existing.some((a) => dedupKey(a) === key)) return existing
  const updated = [artifact, ...existing].slice(0, MAX_ITEMS)
  saveLibrary(updated)
  return updated
}

export function useArtifact() {
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [history, setHistory] = useState<Artifact[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [libraryItems, setLibraryItems] = useState<Artifact[]>([])

  // Load library from localStorage on mount
  useEffect(() => {
    setLibraryItems(loadLibrary())
  }, [])

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
    // Persist to library — every artifact shown is guaranteed saved
    const updated = persistToLibrary(full)
    setLibraryItems(updated)
  }, [])

  /** Persist multiple artifacts to library without opening panel */
  const saveAllToLibrary = useCallback((artifacts: ArtifactRef[]) => {
    if (!artifacts || artifacts.length === 0) return
    let current = loadLibrary()
    for (const ref of artifacts) {
      const full: Artifact = {
        ...ref,
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Australia/Adelaide",
        }),
      }
      const key = dedupKey(full)
      if (!current.some((a) => dedupKey(a) === key)) {
        current = [full, ...current]
      }
    }
    current = current.slice(0, MAX_ITEMS)
    saveLibrary(current)
    setLibraryItems(current)
  }, [])

  const closePanel = useCallback(() => setPanelOpen(false), [])

  const selectFromHistory = useCallback((id: string) => {
    // Search both session history and persisted library
    const found = history.find((a) => a.id === id) || libraryItems.find((a) => a.id === id)
    if (found) {
      setActiveArtifact(found)
      setPanelOpen(true)
    }
  }, [history, libraryItems])

  return { activeArtifact, history, panelOpen, libraryItems, showArtifact, saveAllToLibrary, closePanel, selectFromHistory }
}
