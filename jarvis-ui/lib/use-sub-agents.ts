"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { SubAgent } from "@/lib/types"

const POLL_INTERVAL_MS = 5000

interface ApiSubAgent {
  id: string
  label: string
  ageSeconds: number
  status: "running" | "completed" | "failed" | "stalled"
}

function mapAgent(api: ApiSubAgent): SubAgent {
  return {
    id: api.id,
    label: api.label,
    elapsed: api.ageSeconds,
    status: api.status === "stalled" ? "queued" : api.status,
  }
}

export function useSubAgents() {
  const [agents, setAgents] = useState<SubAgent[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/subagents")
      if (!res.ok) return
      const data: ApiSubAgent[] = await res.json()
      if (mountedRef.current) {
        setAgents(data.map(mapAgent))
        setLoading(false)
      }
    } catch {
      // Silently fail — will retry on next poll
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchAgents()

    const interval = setInterval(fetchAgents, POLL_INTERVAL_MS)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [fetchAgents])

  return { agents, loading }
}
